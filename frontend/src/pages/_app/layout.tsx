import { createFileRoute, Outlet } from '@tanstack/react-router';
import { Header } from '@/components/navbar-components/header';

export const Route = createFileRoute('/_app')({
  component: RouteComponent,
  notFoundComponent: () => <div>App - 404!</div>,
});

function RouteComponent() {
  return (
    <div className="mb-5">
      <Header />
      <Outlet />
    </div>
  );
}
