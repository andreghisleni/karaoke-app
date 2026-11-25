# Catálogo Karaokê Pro

Acervo de **14.531 músicas** (4.449 artistas) para procurar título, artista ou código
no celular durante a festa — sem internet, sem conta, sem instalar nada. Tudo acontece
neste aparelho: a busca, a fila de desejos e as preferências.

## Rodar

```bash
npm install
npm run dev        # http://localhost:5173
```

O `predev` (e o `prebuild`) roda `npm run catalog` sozinho, então o catálogo é regenerado
a partir de `public/catalogo.txt` antes de subir. Para regenerar manualmente:

```bash
npm run catalog    # public/catalogo.txt -> src/data/catalogo.json
```

Build de produção e pré-visualização:

```bash
npm run build && npm run preview
```

O `dist/` resultante é 100% estático (`base: './'`, sem variável de ambiente, sem
servidor). Serve em qualquer host de arquivos: Vercel, Netlify, GitHub Pages, um pendrive,
um `python -m http.server`.

## Como usar

| Quero… | Como |
| --- | --- |
| Achar uma música | Digite no campo de busca. Aceita acento ou não (`zeze` = `zézé`), palavras fora de ordem (`camargo zezé`) e erro de dedo (`legio urbna` → Legião Urbana). |
| Achar pelo código | Digite o número: `18483`. |
| Ver tudo de um artista | Toque no nome do artista em qualquer linha. Um chip `✕ Artista` aparece para desfazer. |
| Navegar pelo alfabeto | Cabeçalhos A–Z na lista + trilho lateral (some na busca ativa, onde não faz sentido). |
| Mudar a ordem | A–Z · Por artista · Por código (o mesmo controle aparece junto da contagem). |
| Guardar um desejo | Toque na estrela da linha. Vai para `#/fila`, e a lista sobrevive a recarregar a página. |
| Organizar a noite | Na aba **Minha fila**: subir, descer, remover, copiar todos os códigos de uma vez. |
| Levar a fila para outro celular | **Backup** (baixa um `.json`) / **Restaurar** (escolhe o arquivo). |
| Trabalhar no escuro | Botão de lua/sol no cabeçalho: claro, escuro ou automático com o aparelho. |
| Usar no metrô | Funciona offline depois da primeira visita; um selo `offline` aparece no cabeçalho. |

Atalhos: `/` foca a busca, `Esc` limpa, `Enter` grava o termo em "Recentes".

## Onde ficam os dados

Nenhum dado sai do aparelho e nenhum servidor é chamado durante o uso.

| O quê | Onde |
| --- | --- |
| Catálogo | `src/data/catalogo.json`, importado pelo bundle (chunk separado, ~448 KB gzip). |
| Fila, preferências, buscas recentes | IndexedDB `karaoke-local` (store `valores`), com espelho em `localStorage` sob `karaoke:fila`, `karaoke:preferencias` e `karaoke:buscas-recentes` para o caso de o IndexedDB falhar ou estar bloqueado. |
| Cache offline | `public/sw.js`: `stale-while-revalidate` na navegação, cache-first nos assets com hash. |

Sem manifest e sem prompt de instalação: a decisão foi que ninguém precisa "instalar o
catálogo" para ele funcionar sem sinal.

## Estrutura

```
scripts/build-catalog.mjs   TXT cru -> JSON normalizado (id, título, artista, verso, 2ª versão)
src/data/catalogo.json      saída commitada de propósito (o build é determinístico)
src/lib/                    texto.ts (normalização) · catalogo.ts (índices) · busca.ts (pontuação
                            exata + aproximada) · armazenamento.ts (IDB + espelho) ·
                            alturas.ts (geometria da lista) · area.ts (copiar com fallback)
src/hooks/                  useCatalogo · useListaVirtual (virtualização própria) ·
                            useBuscaComUrl (estado <-> URL) · useArmazenamentoLocal ·
                            useAmbiente (tema, rede, service worker) · useToast
src/components/             Cabecalho · BarraBusca · TelaCatalogo · TelaFila · ListaMusicas ·
                            LinhaMusica · Estados · Destaque · Toast · ui/ (shadcn)
public/catalogo.txt         fonte original do catálogo (referência; o app não busca isso em runtime)
```

## Lint e tipos

```bash
npm run lint
```

Continua existindo um erro pré-existente do boilerplate do shadcn em
`src/components/ui/button.tsx` (`react-refresh/only-export-components`), fora do escopo
deste trabalho.

## Limites conhecidos

- A busca aproximada tolera 1 letra de diferença em termos curtos e 2 em termos longos
  (>= 8 letras). Errar duas letras num nome curto devolve zero resultados, e o estado vazio
  sugere o caminho (primeiro nome do artista, palavra do verso).
- `dist/` tem ~1,5 MB por causa do acervo inteiro no bundle: é o preço de funcionar offline
  sem servidor. Num host com HTTP cache, a visita seguinte custa quase zero.
- A fila é local: limpar os dados do navegador no celular apaga a fila. Use Backup antes.
