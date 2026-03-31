/* eslint @typescript-eslint/no-explicit-any:off */
/** biome-ignore-all lint/suspicious/noExplicitAny: test */
/* eslint react/display-name:off */

import type { CellContext, Column, Row, RowData } from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { parseAsString, useQueryStates } from 'nuqs';
import type React from 'react';
import type { ReactNode } from 'react';
import { Button } from '../ui/button';
import {
  type DataType,
  tableDataParser,
  tableDataParserNew,
} from './TableDataParser';

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
  );

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

export function tdb<TData extends RowData>(
  name: TData extends RowData ? keyof TData : string,
  label: string,
  dataType?: DataType,
  cell?: (c: CellContext<any, unknown>) => any,
  other?: any
) {
  return {
    ...{
      accessorKey: name,
      header: tableDataButton(label),
    },
    ...(cell ? { cell } : dataType ? { cell: tableDataParser(dataType) } : {}),
    ...other,
  };
}

export function tdbNew<TData extends RowData>({
  name,
  label,
  dataType,
  cell,
  other,
  columns,
  id,
  enableHiding,
  parse,
  link,
  s = false,
}: {
  name?: TData extends RowData ? keyof TData : string;
  label?: string;
  dataType?: DataType;
  cell?: (c: CellContext<any, unknown>) => any;
  other?: any;

  columns?: Column<any>[];

  id?: string;
  enableHiding?: boolean;

  parse?: (data: any) => any;
  link?: (row: Row<any>) => string;
  s?: boolean;
}) {
  return {
    ...{
      accessorKey: name,
      header:
        label &&
        (s && name
          ? tableDataButtonServer(label, String(name))
          : tableDataButton(label)),
      id,
      enableHiding,
    },
    ...(cell
      ? { cell }
      : dataType
        ? {
            cell: tableDataParserNew({
              type: dataType,
              columns,
              parse,
              link,
            }),
          }
        : {}),
    ...other,
  };
}
