import { createFileRoute, Navigate } from '@tanstack/react-router';

export const Route = createFileRoute('/')({
  component: Home,
});

export function Home() {
  return <Navigate replace to="/dashboard" />;
}
