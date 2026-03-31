/** biome-ignore-all lint/suspicious/noExplicitAny: test */
import type { Column } from '@tanstack/react-table';
import { ArrowUpDown } from 'lucide-react';
import type React from 'react';
import type { ReactNode } from 'react';

import { Button } from './ui/button';

// import { Container } from './styles';

export const TableDataButton: React.FC<{
  column: Column<any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  children: ReactNode;
}> = ({ column, children }) => {
  return (
    <Button
      data-text={children}
      onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      variant="ghost"
    >
      {children}
      <ArrowUpDown className="ml-2 h-4 w-4" />
    </Button>
  );
};

export const tableDataButton =
  (label: string) =>
  ({ column }: { column: Column<any> }) => (
    <TableDataButton column={column}>{label}</TableDataButton>
  ); // eslint-disable-line

export const tdb = (name: string, label: string, w?: number) => ({
  accessorKey: name,
  header: tableDataButton(label),
  ...(w ? { size: w } : {}),
});
