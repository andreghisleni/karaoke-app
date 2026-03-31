import { createRootRoute, HeadContent, Outlet } from '@tanstack/react-router';
import { NuqsAdapter } from 'nuqs/adapters/tanstack-router';

export const Route = createRootRoute({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <NuqsAdapter>
      <HeadContent />
      <Outlet />
    </NuqsAdapter>
  );
}
