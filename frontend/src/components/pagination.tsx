import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';

import { Button } from './ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

interface PaginationProps {
  pages: number;
  items: number;
  page: number;
  limit: number;
  showing: number;
  handleUpdatePage: (page: number) => void;
  handleChangeLimit: (limit: number) => void;
}

export function Pagination({
  items,
  page,
  pages,
  limit,
  showing,
  handleUpdatePage,
  handleChangeLimit,
}: PaginationProps) {
  // Navega para a primeira página (página 1)
  const firstPage = () => {
    handleUpdatePage(1);
  };

  // Navega para a página anterior, com limite em 1
  const previousPage = () => {
    if (page - 1 < 1) {
      return;
    }
    handleUpdatePage(page - 1);
  };

  // Navega para a próxima página, com limite no total de páginas
  const nextPage = () => {
    if (page + 1 > pages) {
      return;
    }
    handleUpdatePage(page + 1);
  };

  // Navega para a última página
  const lastPage = () => {
    handleUpdatePage(pages);
  };

  const changeLimit = (value: string) => {
    handleChangeLimit(Number(value));
  };

  return (
    <div className="flex items-center justify-between text-wrap text-sm">
      <span>
        Showing {showing} of {items} items
      </span>
      <div className="flex items-center gap-8">
        <div className="flex w-auto items-center gap-2">
          <span className="whitespace-no-wrap">Rows per page</span>

          <div className="w-20">
            <Select onValueChange={changeLimit} value={String(limit)}>
              <SelectTrigger aria-label="Page">
                <SelectValue placeholder="Page" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
                <SelectItem value="200">200</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Agora esta exibição está correta sem precisar de "+1" */}
        <span>
          Page {page} of {pages}
        </span>

        <div className="space-x-1.5">
          {/* Desabilita se a página atual já for a primeira (página 1) */}
          <Button disabled={page === 1} onClick={firstPage} size="icon">
            <ChevronsLeft className="size-4" />
            <span className="sr-only">First page</span>
          </Button>
          {/* Desabilita se a página atual já for a primeira (página 1) */}
          <Button disabled={page === 1} onClick={previousPage} size="icon">
            <ChevronLeft className="size-4" />
            <span className="sr-only">Previous page</span>
          </Button>
          {/* Desabilita se a página atual já for a última */}
          <Button disabled={page === pages} onClick={nextPage} size="icon">
            <ChevronRight className="size-4" />
            <span className="sr-only">Next page</span>
          </Button>
          {/* Desabilita se a página atual já for a última */}
          <Button disabled={page === pages} onClick={lastPage} size="icon">
            <ChevronsRight className="size-4" />
            <span className="sr-only">Last page</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
