import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { App } from './app.tsx';
import { capturarTokenDaUrl, instalarFetchDoPainel } from './lib/painel-token';

// Antes de qualquer render: ?token= → localStorage → URL limpa, e o fetch passa a mandar o
// cabeçalho do painel. Assim o primeiro pedido já sai autenticado (sem 401 + reload).
capturarTokenDaUrl();
instalarFetchDoPainel();

// biome-ignore lint/style/noNonNullAssertion: mandatory by React
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
