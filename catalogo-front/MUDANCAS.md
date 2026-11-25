# O que mudou nesta branch (`feat/ui-ux-experiencia`)

Auditoria de UI/UX aplicada ao app. Nenhum envio ao GitHub foi feito: está tudo local,
na branch, com `patch` e `zip` na entrega.

## O problema que motivou quase tudo

O app lia `public/catalogo.txt` no navegador com um parser que comparava o marcador de
linha em maiúsculo (`TÍTULO:`) contra o texto real (`Título:`). Resultado: **3.620 das
14.531 músicas (24,9%) entravam sem título e sem artista** — invisíveis na busca, no
alfabeto e na tela. `Kumorizora` (código 18483) simplesmente não existia para o app.

A correção não foi trocar o parser em runtime: o TXT agora é convertido **no build** por
`scripts/build-catalog.mjs`, que roda sozinho no `prebuild`/`predev` e commita a saída em
`src/data/catalogo.json`. O navegador não parseia mais nada.

| Antes | Depois |
| --- | --- |
| parse no runtime, 1,66 MB baixado e lido a cada visita | JSON importado no bundle, parse zero em runtime |
| 3.620 entradas quebradas | 0 |
| 3.334 grafias diferentes de artista | 4.449 artistas (1.283 grafias unificadas) |
| 3.906 versos lixo ("indisponivel", "verso nao encontrado", ".....") | descartados (3.979 no total) |
| "Paralamas Do Sucesso" (CSS `capitalize`) | nomes prontos do build |
| 511 artistas com grafia divergente | "2ª versão" sinalizada, 608 casos |

## Busca

- **Um único caminho**: o que você digita vira condição de filtro de verdade (antes havia
  dois estados concorrentes e a lista às vezes não acompanhava o campo).
- Ignora acento e caixa (`zeze` → Zezé Di Camargo & Luciano), aceita palavras fora de ordem
  (`camargo zezé`), busca por código (`18483`) e por trecho do verso.
- **Aproximada** quando a busca exata não acha nada: Levenshtein com corte, tolerando 1 letra
  em termos curtos e 2 em termos de 8+ letras, com AND tolerante (bateram 57 Legião Urbana em
  `legio urbna`, 127 Jorge & Mateus em `jorge matus`). Termos menores que 4 caracteres não
  aproximam, para não poluir.
- O resultado diz quantas são e de quantas: `913 músicas de 14.531 · "amor"`.
- Termos confirmados com `Enter` viram chips **Recentes** (máx. 8) debaixo da busca.
- A URL carrega o estado (`?q=`, `?artista=`, `#/fila`): dá para Favoritar e compartilhar link.

## Lista

- Virtualização própria (`useListaVirtual` + `alturas.ts`): só ~19–20 linhas no DOM para um
  acervo de ~1,14 milhão de pixels de rolagem. Sem biblioteca nova, sem `overflow` quebrado.
- Linha densa de 64 px (84 com verso) em vez do card de ~200 px: 7 linhas por tela no celular
  contra 2 antes. Título, artista (que filtra ao tocar), verso e código.
- Cabeçalho A–Z **grudado** no topo do grupo atual + trilho lateral `# A B C … Z` com a letra
  em que você está. O trilho some quando há busca ou filtro ativo (ali ordem alfabética é
  ruído) e volta sozinho.
- Estrela e código são alvos de 40 px; o link de artista ganhou padding para passar dos 24 px
  mínimos de toque (WCAG 2.2) em 390×844.

## Minha fila (a lista de pedidos)

Segunda aba em `#/fila`, **100% local**, sem servidor e sem conta.

- Toque na estrela → entra na fila, com toast de confirmação (`A Cigana na sua fila`).
- Reordenar (subir/descer), remover, numerada, e uma linha só com todos os códigos
  (`Códigos: 16081, 15201, 16211`) para mandar no grupo do zap.
- **Backup** baixa um `.json`; **Restaurar** lê o arquivo de volta — é assim que a fila passa
  de um celular para o outro sem nenhum serviço no meio.
- Persistência em IndexedDB (`karaoke-local` / store `valores`) com espelho em `localStorage`
  (`karaoke:fila`, `karaoke:preferencias`, `karaoke:buscas-recentes`). Se o IndexedDB falhar ou
  estiver bloqueado, nada se perde.
- Botão "copiar todos os códigos" e "limpar" pedem confirmação no próprio clique.

## Offline e casca

- `public/sw.js`: `stale-while-revalidate` na navegação e cache-first nos assets com hash.
  Primeira visita baixa, todas as outras funcionam sem sinal, sem banner de instalação e sem
  manifest — de propósito. Selo `offline` aparece no cabeçalho quando cai a rede, e "Atualizar"
  só aparece quando existe versão nova pronta.
- `vite.config.ts` com `base: './'`: o `dist/` é portável (subpasta, Pages, pendrive).
- `index.html`: `lang="pt-BR"`, título real (`Catálogo de Karaokê · 14.531 músicas por código`),
  description, Open Graph/Twitter, `theme-color` claro e escuro, `viewport-fit=cover` e um
  script de 4 linhas que aplica o tema salvo antes do primeiro paint (nada de flash branco).
  Tem `<noscript>` também.
- Cabeçalho de 212 px → **1 linha de ~50 px**: a busca começa em y≈60, não em y≈284.
- Tema claro/escuro/automático com tokens `oklch` próprios (o primário é um rosa 0.575/0.665
  0.225 12, legível nos dois temas), `prefers-reduced-motion` respeitado,
  `overscroll-behavior-y: none` e `touch-action: manipulation` (nada de zoom de 300 ms).
- Todos os botões com `aria-label` descrevendo a ação ("Copiar código 16081 de 1 Metro e 65,
  Sorriso Maroto", "Adicionar A Cigana à minha fila", "Remover o filtro por Sorriso Maroto"),
  `aria-live` no resumo de resultados e nos avisos, foco visível, atalho `/` na busca e
  `Esc` para limpar.

## Como testar

```bash
npm install
npm run dev            # regenera o catálogo e sobe em http://localhost:5173
npm run build && npm run preview
```

Roteiro rápido: buscar `kumolizora` (acha 1) · `legio urbna` (acha Legião Urbana) ·
`18483` (por código) · tocar num artista e ver o chip `✕ Artista` · usar o trilho A–Z ·
estrelar 3 músicas, recarregar a página e ver a fila intacta · Backup/Restaurar ·
alternar tema e recarregar · cortar a rede e abrir de novo.

## Fora do escopo (decidido na auditoria)

- Manifest/instalável e push: o pedido foi "funcionar offline sem instalar nada".
- Busca por voz: o ícone de microfone que prometia isso saiu do cabeçalho.
- `src/components/ui/button.tsx` mantém o erro de lint pré-existente do boilerplate do
  shadcn (`react-refresh/only-export-components`): é código de terceiro e mexer ali abre
  diff grande sem ganho de usuário.

## Detalhe de housekeeping

O `package-lock.json` é novo porque este trabalho foi feito com `npm` (o repo só tinha
`bun.lock`). Se você continuar no bun, é só apagar o arquivo — o `bun.lock` original está
intocado. `src/data/catalogo.json` foi commitado de propósito: é a saída determinística do
gerador, e assim o build de qualquer clone não depende de rodar o script primeiro.
