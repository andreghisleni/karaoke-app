/** biome-ignore-all lint/suspicious/noExplicitAny: <explanation> */
"use client";
/** eslint @typescript-eslint/no-explicit-any: 0 */
// biome-ignore lint/performance/noNamespaceImport: <explanation>
import * as Portal from "@radix-ui/react-portal";
import {
  type Column,
  type ColumnDef,
  type ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type Row,
  type SortingState,
  type Table as TableInstance,
  useReactTable,
  type VisibilityState,
} from "@tanstack/react-table";
import { ChevronDown, Expand, Shrink } from "lucide-react";
import React from "react";
import reactNodeToString from "react-node-to-string";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

import { Checkbox } from "./ui/checkbox";
import { Skeleton } from "./ui/skeleton";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  pagination?: {
    page: number;
    limit: number;
    total_pages: number;
    total_items: number;
  };
  addFunction?: () => void;
  addComponent?: React.ReactNode | React.ReactNode[];
  noDataMessage?: string;
  onRowSelectionChange?: (selectedRows: TData[]) => void;

  filterComponent?: React.ReactNode;
  ifJustFilterComponent?: boolean;

  actionComponent?: (props: { table: TableInstance<TData> }) => React.ReactNode;
  actionDisabledFunction?: (props: { row: Row<TData> }) => boolean;

  initialColumnVisibility?: VisibilityState;
  showVisibilityToggle?: boolean;

  paginationComponent?: React.ReactNode;

  rowBgColor?: (row: any) => string;

  loading?: boolean;
}

const getHeaderValue = (column: Column<unknown>): string => {
  const { header } = column.columnDef;

  if (!header) {
    return column.id;
  }

  if (typeof header === "string") {
    return header;
  }

  if (typeof header === "function") {
    return reactNodeToString(header(column as any)); // eslint-disable-line @typescript-eslint/no-explicit-any
  }

  return column.id;
};

const select = ({
  actionDisabledFunction,
}: {
  actionDisabledFunction: DataTableProps<any, any>["actionDisabledFunction"]; // eslint-disable-line
}) => ({
  id: "select",
  header: ({ table }: { table: TableInstance<any> }) => (
    <Checkbox
      aria-label="Select all"
      checked={
        table.getIsAllPageRowsSelected() ||
        (table.getIsSomePageRowsSelected() && "indeterminate")
      }
      className="border-gray-950 disabled:border-gray-400 dark:border-gray-500"
      onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
    />
  ),
  cell: ({ row }: { row: Row<any> }) => (
    <Checkbox
      aria-label="Select row"
      checked={row.getIsSelected()}
      className="border-gray-950 disabled:border-gray-400 dark:border-gray-500"
      // biome-ignore lint/complexity/useOptionalChain: <explanation>
      disabled={actionDisabledFunction && actionDisabledFunction({ row })}
      onCheckedChange={(value) => row.toggleSelected(!!value)}
    />
  ),
  enableSorting: false,
  enableHiding: false,
  maxSize: 2,
});

export function DataTable<TData, TValue>({
  paginationComponent,
  rowBgColor,
  loading,
  columns: c,
  data,
  pagination,
  addFunction,
  addComponent,
  noDataMessage = "No results.",
  onRowSelectionChange,
  filterComponent,
  ifJustFilterComponent = false,
  actionComponent,
  actionDisabledFunction,
  initialColumnVisibility = {},
  showVisibilityToggle = true,
}: DataTableProps<TData, TValue>) {
  const columns = actionComponent
    ? [select({ actionDisabledFunction }), ...c]
    : c;

  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  );
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>(initialColumnVisibility);
  const [rowSelection, setRowSelection] = React.useState({});
  const [globalFilter, setGlobalFilter] = React.useState("");

  const [isFullScreen, setIsFullScreen] = React.useState(false);
  const tabelaRef = React.useRef(null);

  const toggleFullScreen = () => {
    // if (isFullScreen) {
    //   document.exitFullscreen();
    // } else {
    //   tabelaRef.current?.requestFullscreen(); // eslint-disable-line
    // }
    setIsFullScreen(!isFullScreen);
  };

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      globalFilter,
    },
    enableRowSelection(row) {
      return actionDisabledFunction ? !actionDisabledFunction({ row }) : true;
    },
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  React.useEffect(() => {
    // biome-ignore lint/complexity/useOptionalChain: <explanation>
    onRowSelectionChange &&
      onRowSelectionChange(
        table.getSelectedRowModel().rows.map((row) => row.original)
      );
  }, [table, onRowSelectionChange, rowSelection]);

  React.useEffect(() => {
    !pagination && table.setPageSize(10_000);
  }, [table, pagination]);

  return (
    <>
      <div
        className={cn(
          "flex flex-1 flex-col overflow-x-hidden",
          "relative overflow-x-auto",
          // 'data-[full-screen=true]:fixed data-[full-screen=true]:left-0 data-[full-screen=true]:top-0 data-[fullScreen=true]:z-50',
          // 'data-[full-screen=true]:h-screen data-[full-screen=true]:w-screen',
          // 'data-[full-screen=true]:p-8',
          // 'bg-white text-zinc-950 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50',
          "text-zinc-950 dark:border-zinc-800 dark:text-zinc-50"
        )}
        data-full-screen={isFullScreen ? "true" : "false"}
        ref={tabelaRef}
      >
        <DateTableContent
          {...{
            table,
            columns,
            globalFilter,
            setGlobalFilter,
            filterComponent,
            ifJustFilterComponent,
            addFunction,
            addComponent,
            noDataMessage,
            toggleFullScreen,
            isFullScreen,
            pagination,
            paginationComponent,
            rowBgColor,
            loading,
            showVisibilityToggle,
            actionComponent,
          }}
        />
      </div>

      {isFullScreen && (
        <Portal.Root
          className="pointer-events-auto fixed inset-0 isolation-auto z-500 overflow-y-auto bg-white p-8 dark:bg-zinc-950"
          style={{
            pointerEvents: "auto",
          }}
          tabIndex={-1}
        >
          <DateTableContent
            {...{
              table,
              columns,
              globalFilter,
              setGlobalFilter,
              filterComponent,
              ifJustFilterComponent,
              addFunction,
              addComponent,
              noDataMessage,
              toggleFullScreen,
              isFullScreen,
              pagination,
              paginationComponent,
              rowBgColor,
              loading,
              showVisibilityToggle,
              actionComponent,
            }}
          />
        </Portal.Root>
      )}
    </>
  );
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: <explanation>
function DateTableContent({
  table,
  columns,
  globalFilter,
  setGlobalFilter,
  filterComponent,
  ifJustFilterComponent,
  addFunction,
  addComponent,
  noDataMessage,
  toggleFullScreen,
  isFullScreen,
  pagination,
  paginationComponent,
  rowBgColor,
  loading,
  showVisibilityToggle = true,
  actionComponent,
}: {
  table: any;
  columns: any;
  globalFilter: any;
  setGlobalFilter: any;
  filterComponent: any;
  ifJustFilterComponent: any;
  addFunction: any;
  addComponent: React.ReactNode | React.ReactNode[];
  noDataMessage: any;
  toggleFullScreen: any;
  isFullScreen: any;
  pagination: any;
  paginationComponent: any;
  rowBgColor?: (row: any) => string;
  loading?: boolean;
  showVisibilityToggle?: boolean;
  actionComponent?: (props: { table: TableInstance<any> }) => React.ReactNode;
}) {
  return (
    <>
      <div className="flex flex-col items-center gap-2 py-4 md:flex-row md:gap-0">
        {ifJustFilterComponent ? (
          filterComponent && filterComponent
        ) : (
          <div className="flex flex-row gap-2">
            <Input
              className="max-w-ssm"
              onChange={(event) => setGlobalFilter(event.target.value)}
              placeholder="Filter..."
              value={globalFilter ?? ""}
            />
            {filterComponent && filterComponent}
          </div>
        )}
        <div className="ml-auto flex gap-2">
          {showVisibilityToggle && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  Columns <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {table
                  .getAllColumns()
                  .filter((column: { getCanHide: () => any }) =>
                    column.getCanHide()
                  )
                  .map((column: Column<unknown, unknown>) => {
                    return (
                      <DropdownMenuCheckboxItem
                        checked={column.getIsVisible()}
                        className="capitalize"
                        key={column.id}
                        onCheckedChange={(value) =>
                          column.toggleVisibility(!!value)
                        }
                      >
                        {getHeaderValue(column)}
                      </DropdownMenuCheckboxItem>
                    );
                  })}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {addFunction && (
            <Button className="ml-2" onClick={addFunction} variant="outline">
              Add
            </Button>
          )}

          {addComponent && (<div className="flex gap-2">{addComponent}</div>)}

          {/** biome-ignore lint/complexity/useOptionalChain: test */}
          {actionComponent && actionComponent({ table })}
          <Button onClick={toggleFullScreen} variant="outline">
            {isFullScreen ? <Shrink /> : <Expand />}
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-x-auto">
        {/* <ScrollArea> */}
        <Table className="table-auto">
          <TableHeader className="sticky top-0">
            {table
              .getHeaderGroups()
              .map(
                (headerGroup: {
                  id: React.Key | null | undefined;
                  headers: any[];
                }) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => {
                      return (
                        <TableHead
                          className={cn(
                            // 'bg-white dark:bg-zinc-950',
                            header.column.columnDef.meta?.className
                          )}
                          key={header.id}
                        >
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                        </TableHead>
                      );
                    })}
                  </TableRow>
                )
              )}
          </TableHeader>
          <TableBody>
            {loading ? (
              [1, 2, 3, 4, 5, 6, 7].map((i) => (
                <TableRow className={cn("group")} key={i}>
                  {table
                    .getVisibleFlatColumns()
                    .map((cell: { id: React.Key | null | undefined }) => (
                      <TableCell
                        className={cn(
                          // 'bg-white dark:bg-zinc-950',
                          "group-hover:bg-zinc-100/50 dark:group-hover:bg-zinc-800/50"

                          // cell.column.columnDef.meta?.className,
                        )}
                        key={cell.id}
                      >
                        {cell.id === "actions" ? (
                          <div className="flex gap-2">
                            <Skeleton className="h-10 w-[80px]" />
                            <Skeleton className="h-10 w-[80px]" />
                          </div>
                        ) : (
                          <Skeleton className="h-4 w-full" />
                        )}
                      </TableCell>
                    ))}
                </TableRow>
              ))
            ) : // biome-ignore lint/style/noNestedTernary: <explanation>
              table.getRowModel().rows?.length ? (
                table
                  .getRowModel()
                  .rows.map(
                    (row: {
                      getIsSelected: () => any;
                      id: React.Key | null | undefined;
                      toggleSelected: (arg0: boolean) => void;
                      getVisibleCells: () => any[];
                    }) => (
                      <TableRow
                        className={cn("group")}
                        data-state={row.getIsSelected() ? "selected" : undefined}
                        key={row.id}
                        onDoubleClick={() =>
                          row.toggleSelected(!row.getIsSelected())
                        }
                      >
                        {row.getVisibleCells().map((cell) => (
                          <TableCell
                            className={cn(
                              // 'bg-white dark:bg-zinc-950',
                              "group-hover:bg-zinc-100/50 dark:group-hover:bg-zinc-800/50",
                              "group-data-[state=selected]:bg-zinc-200 dark:group-data-[state=selected]:bg-zinc-800/50",
                              "group-data-[state=selected]:group-hover:bg-blue-200/70 dark:group-data-[state=selected]:group-hover:bg-blue-800/40",
                              rowBgColor?.(row),
                              cell.column.columnDef.meta?.className
                            )}
                            key={cell.id}
                          >
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext()
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    )
                  )
              ) : (
                <TableRow>
                  {columns.length < 6 ? (
                    <TableCell
                      className="h-24 text-center"
                      colSpan={columns.length}
                    >
                      {noDataMessage}
                    </TableCell>
                  ) : (
                    new Array(Math.ceil(columns.length / 3))
                      .fill(null)
                      .map((_, i) => i)
                      .map((i) => (
                        <TableCell
                          className="h-24 text-center"
                          colSpan={Math.ceil(columns.length / 3)}
                          key={i}
                        >
                          {noDataMessage}
                        </TableCell>
                      ))
                  )}
                </TableRow>
              )}
          </TableBody>
        </Table>
        {/* <ScrollBar orientation="horizontal" />
  </ScrollArea> */}
      </div>
      <div className="flex items-center justify-end space-x-2 py-4">
        {!!table
          .getAllColumns()
          .find((c: { id: string }) => c.id === "select") && (
            <div className="flex-1 text-muted-foreground text-sm">
              {table.getFilteredSelectedRowModel().rows.length} of{" "}
              {table.getFilteredRowModel().rows.length} row(s) selected.
            </div>
          )}
        {pagination && (
          <div className="space-x-2">
            <Button
              disabled={!table.getCanPreviousPage()}
              onClick={() => table.previousPage()}
              size="sm"
              variant="outline"
            >
              Previous
            </Button>
            <Button
              disabled={!table.getCanNextPage()}
              onClick={() => table.nextPage()}
              size="sm"
              variant="outline"
            >
              Next
            </Button>
          </div>
        )}
      </div>
      {paginationComponent && paginationComponent}
    </>
  );
}
