/** biome-ignore-all lint/suspicious/noArrayIndexKey: <explanation> */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "../ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";

type IProps = {
  rows?: number;
  columns: number;
};

export function CardTableSkeleton({ rows = 10, columns }: IProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle>
          <Skeleton className="h-6 w-24" />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        <Table>
          <TableHeader>
            <TableRow>
              {Array.from({ length: columns }).map((_, column) => {
                return (
                  <TableHead key={column}>
                    <Skeleton className="h-4 w-[140px]" />
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: rows }).map((_, row) => {
              return (
                <TableRow key={row}>
                  {Array.from({ length: columns }).map((_c, column) => {
                    return (
                      <TableCell key={column}>
                        <Skeleton className="h-4 w-[140px]" />
                      </TableCell>
                    );
                  })}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
