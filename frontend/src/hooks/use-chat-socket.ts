// src/hooks/use-chat-socket.ts
/** biome-ignore-all lint/suspicious/noConsole: test */
/** biome-ignore-all lint/complexity/noExcessiveCognitiveComplexity: test */
/** biome-ignore-all lint/performance/useTopLevelRegex: test */
/** biome-ignore-all lint/suspicious/noExplicitAny: test */
import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

// Importe suas chaves de query geradas pelo Kubb
import {
  getWhatsappContactsContactIdMessagesQueryKey
} from '@/http/generated/hooks';


interface UseChatSocketProps {
  organizationId: string;
  selectedContactId: string | null;
}

export function useChatSocket({ organizationId, selectedContactId }: UseChatSocketProps) {
  const queryClient = useQueryClient();
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!organizationId){ return;}

    // 1. Configurar URL do WebSocket
    // Se você usa proxy no vite, pode ser apenas `ws://${window.location.host}/ws`
    // Se usa VITE_API_URL, precisa trocar http/https por ws/wss
    const baseUrl = import.meta.env.VITE_API_URL || window.location.origin;
    const wsUrl = `${baseUrl.replace(/^http/, 'ws')}/ws?organizationId=${organizationId}`;

    // 2. Conectar
    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;

    ws.onopen = () => {
      // Entra na sala da organização
      ws.send(JSON.stringify({ event: 'join', organizationId }));
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        const { event: eventName, data } = payload;

        // ============================================================
        // 📨 EVENTO: NOVA MENSAGEM (Atualiza Chat + Lista de Contatos)
        // ============================================================
        if (eventName === 'chat:message:new') {
          // 1. Se a conversa desse contato estiver aberta, adiciona a mensagem
          if (data.contactId === selectedContactId) {
            queryClient.setQueryData(
              getWhatsappContactsContactIdMessagesQueryKey(selectedContactId as string),
              (oldMessages: any[] | undefined) => {
                if (!oldMessages) { return [data]; }
                // Evita duplicatas
                if (oldMessages.some((m) => m.id === data.id)){ return oldMessages;}
                return [...oldMessages, data];
              }
            );
          }

          // 2. Atualiza a Sidebar (Lista de Contatos)
          // Usamos setQueriesData para pegar QUALQUER lista de contatos carregada (page 1, page 2, com filtro, sem filtro)
          queryClient.setQueriesData(
            { queryKey: [{ url: '/whatsapp/contacts' }] }, // Fuzzy matching na URL
            (oldData: any) => {
              if (!(oldData?.data)){ return oldData;}

              const contacts = [...oldData.data];
              const existingIndex = contacts.findIndex((c: any) => c.id === data.contactId);

              if (existingIndex > -1) {
                // --- A. Contato JÁ EXISTE: Move pro topo e atualiza ---
                const contact = { ...contacts[existingIndex] };
                
                contact.lastMessage = data.body || (data.type === 'image' ? '📷 Imagem' : '📎 Anexo');
                contact.lastMessageAt = data.timestamp;
                contact.lastMessageStatus = data.status;
                contact.lastMessageType = data.type;

                // Incrementa contador se não for msg minha e não estiver no chat aberto
                const isMyMessage = data.direction === 'OUTBOUND';
                const isChatOpen = data.contactId === selectedContactId;
                if (!(isMyMessage || isChatOpen)) {
                  contact.unreadCount = (contact.unreadCount || 0) + 1;
                }

                contacts.splice(existingIndex, 1);
                contacts.unshift(contact);
              
                // --- B. Contato NOVO: Adiciona no topo (Se o backend mandou os dados) ---
              } else   if (data.contact) {
                  // O backend mandou o objeto 'contact' montado dentro do payload
                  contacts.unshift(data.contact);
                } else {
                  // Fallback: Se não mandou, invalida para forçar recarregamento
                  queryClient.invalidateQueries({ queryKey: [{ url: '/whatsapp/contacts' }] });
                }
              

              return { ...oldData, data: contacts };
            }
          );
        }

        // ============================================================
        // ✅ EVENTO: ATUALIZAÇÃO DE STATUS (Ticks Azuis)
        // ============================================================
        if (eventName === 'chat:message:update') {
          // 1. Atualizar Mensagens no CHAT ABERTO
          // Focamos apenas na conversa ativa para garantir performance e precisão
          if (selectedContactId) {
            const activeChatKey = getWhatsappContactsContactIdMessagesQueryKey(selectedContactId);
            
            queryClient.setQueryData(activeChatKey, (oldMessages: any) => {
               // Validação defensiva: se não for array, não mexe
               if (!Array.isArray(oldMessages)) {return oldMessages;}

               return oldMessages.map((msg) => {
                 if (msg.id === data.id) {
                   return { 
                     ...msg, 
                     status: data.status, 
                     errorCode: data.errorCode, 
                     errorDesc: data.errorDesc 
                   };
                 }
                 return msg;
               });
            });
          }

         // 2. Atualizar Status na LISTA DE CONTATOS (Sidebar)
          // 🔥 AQUI ESTÁ A CORREÇÃO
          queryClient.setQueriesData(
             {
              predicate: (query) => {
                const key = query.queryKey[0] as any;
                return key?.url === '/whatsapp/contacts';
              }
             },
             (oldData: any) => {
               if (!oldData?.data){ return oldData;}
               
               return {
                 ...oldData,
                 data: oldData.data.map((contact: any) => {
                   // Se o ID do contato bater com o do payload
                   if (contact.id === data.contactId) {
                     // Atualizamos o status da última mensagem
                     // (Assumindo que a atualização de status geralmente é para a mensagem mais recente ou relevante)
                     return {
                       ...contact,
                       lastMessageStatus: data.status
                     };
                   }
                   return contact; 
                 })
               };
             }
          );
        }

      } catch (error) {
        console.error('Erro no socket:', error);
      }
    };

    return () => {
      ws.close();
    };
  }, [organizationId, selectedContactId, queryClient]);
}