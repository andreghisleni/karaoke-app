import { createFileRoute, Outlet } from '@tanstack/react-router';
import { Header } from '@/components/navbar-components/header';
import { PainelGuard } from '@/components/painel-acesso';

export const Route = createFileRoute('/_app')({
  component: RouteComponent,
  notFoundComponent: () => <div>App - 404!</div>,
});

function RouteComponent() {
  return (
    // Toda página dentro de /_app (dashboard, config) passa pelo token do painel.
    // A raiz / fica fora porque é só um <Navigate replace to="/dashboard"> (9 linhas)
    // e não há mais NENHUMA página de TV no front: ele removeu /tv no e434dcb e eu não
    // reintroduzi. Quem desenha a tela da festa é o Swing do Java (PlayerService.TvPanel),
    // então na TV não se abre navegador nenhum — painel é coisa de celular/PC do operador.
    <PainelGuard>
      <div className="mb-5">
        <Header />
        <Outlet />
      </div>
    </PainelGuard>
  );
}
