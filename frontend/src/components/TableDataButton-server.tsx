/** biome-ignore-all lint/suspicious/noExplicitAny: test */
import type { Column } from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { parseAsString, useQueryStates } from 'nuqs';
import type React from 'react';
import type { ReactNode } from 'react';
import { Button } from './ui/button';

// import { Container } from './styles';

export const TableDataButtonServer: React.FC<{
  children: ReactNode;
  name: string;
}> = ({ children, name }) => {
  const [queryStates, setQueryStates] = useQueryStates({
    [`ob.${name}`]: parseAsString.withDefault(''), // Exemplo de filtro adicional
  });

  return (
    <Button
      data-text={children}
      onClick={() => {
        const isAsc = queryStates[`ob.${name}`] === 'asc';
        const isDesc = queryStates[`ob.${name}`] === 'desc';
        if (isDesc) {
          // Se estiver em desc, ao clicar volta para sem ordenação
          setQueryStates({
            [`ob.${name}`]: '',
          });
          return;
        }
        // Se estiver em asc, ao clicar vira desc. Se não tiver ordenação, vira asc.
        setQueryStates({
          [`ob.${name}`]: isAsc ? 'desc' : 'asc',
        });
      }}
      variant="ghost"
    >
      {children}
      {queryStates[`ob.${name}`] === 'asc' && (
        <ArrowDown className="ml-2 h-4 w-4" />
      )}
      {queryStates[`ob.${name}`] === 'desc' && (
        <ArrowUp className="ml-2 h-4 w-4" />
      )}
      {queryStates[`ob.${name}`] === '' && (
        <ArrowUpDown className="ml-2 h-4 w-4" />
      )}
    </Button>
  );
};

export const tableDataButtonServer =
  (label: string, name: string) =>
  ({ column: _ }: { column: Column<any> }) => (
    <TableDataButtonServer name={name}>{label}</TableDataButtonServer>
  ); // eslint-disable-line

export const tdbs = (name: string, label: string, w?: number) => ({
  accessorKey: name,
  header: tableDataButtonServer(label, name),
  ...(w ? { size: w } : {}),
});
