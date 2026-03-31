// src/utils/whatsapp-formatter.tsx
/** biome-ignore-all lint/performance/useTopLevelRegex: test */
/** biome-ignore-all lint/nursery/useSingleJsDocAsterisk: test */
import type React from 'react';

/**
 * Converte texto estilo WhatsApp em Elementos React
 * Suporta:
 * *bold* -> Negrito
 * _italic_ -> Itálico
 * ~strike~ -> Tachado
 * ```code``` -> Monoespaçado
 * - Lista -> Bullet points
 */
export function formatWhatsAppText(text: string): React.ReactNode {
  if (!text) { return null; }

  // 1. Separar linhas para detectar listas
  const lines = text.split('\n');
  const result: React.ReactNode[] = [];

  let currentList: React.ReactNode[] = [];
  let inList = false;

  lines.forEach((line, index) => {
    // Detecta item de lista (começa com "- " ou "* ")
    const isListItem = /^[-*]\s/.test(line);

    if (isListItem) {
      inList = true;
      // Remove o marcador "- " para formatar só o conteúdo
      const content = line.replace(/^[-*]\s/, '');
      currentList.push(
        <li
          className="ml-4 list-disc pl-1 marker:text-muted-foreground"
          key={`li-${index.toString()}`}
        >
          {formatInlineStyles(content)}
        </li>
      );
    } else {
      // Se estávamos numa lista e a linha atual NÃO é lista, fechamos a lista anterior
      if (inList) {
        result.push(
          <ul className="my-1" key={`ul-${index.toString()}`}>
            {currentList}
          </ul>
        );
        currentList = [];
        inList = false;
      }

      // Linha normal (texto ou vazia)
      // Se for vazia e estivermos renderizando quebras de linha reais
      result.push(
        <p className="min-h-[1.2em]" key={`p-${index.toString()}`}>
          {formatInlineStyles(line)}
        </p>
      );
    }
  });

  // Se terminou o loop e ainda tem lista pendente
  if (inList) {
    result.push(
      <ul className="my-1" key="ul-last">
        {currentList}
      </ul>
    );
  }

  return result;
}

/**
 * Processa formatação inline (Bold, Italic, Strike, Code)
 * Ordem de prioridade: Code > Bold > Italic > Strike
 */
function formatInlineStyles(text: string): React.ReactNode {
  // Regex para capturar os padrões. O uso de grupos () é essencial para o split funcionar.
  // Code block (```text```)
  const codeRegex = /(```.+?```)/g;

  const parts = text.split(codeRegex);

  return parts.map((part, i) => {
    if (part.startsWith('```') && part.endsWith('```')) {
      // É código: retorna sem processar bold/italic dentro
      return (
        <code
          className='rounded bg-muted px-1 py-0.5 font-mono text-muted-foreground text-sm'
          key={i.toString()}
        >
          {part.slice(3, -3)}
        </code>
      );
    }

    // Se não é código, processa os outros estilos recursivamente
    return <span key={i.toString()}>{processBold(part)}</span>;
  });
}

function processBold(text: string): React.ReactNode {
  // Bold: *texto* (não pode ter espaço logo depois do primeiro *)
  const boldRegex = /(\*(?!\s).+?(?<!\s)\*)/g;
  return text.split(boldRegex).map((part, i) => {
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return (
        <strong className="font-bold" key={i.toString()}>
          {processItalic(part.slice(1, -1))}
        </strong>
      );
    }
    return <span key={i.toString()}>{processItalic(part)}</span>;
  });
}

function processItalic(text: string): React.ReactNode {
  // Italic: _texto_
  const italicRegex = /(_(?!\s).+?(?<!\s)_)/g;
  return text.split(italicRegex).map((part, i) => {
    if (part.startsWith('_') && part.endsWith('_') && part.length > 2) {
      return (
        <em className="italic" key={i.toString()}>
          {processStrike(part.slice(1, -1))}
        </em>
      );
    }
    return <span key={i.toString()}>{processStrike(part)}</span>;
  });
}

function processStrike(text: string): React.ReactNode {
  // Strike: ~texto~
  const strikeRegex = /(~(?!\s).+?(?<!\s)~)/g;
  return text.split(strikeRegex).map((part, i) => {
    if (part.startsWith('~') && part.endsWith('~') && part.length > 2) {
      return (
        <del className="line-through opacity-80" key={i.toString()}>
          {part.slice(1, -1)}
        </del>
      );
    }
    return part;
  });
}
