/* eslint @typescript-eslint/no-explicit-any:off */
/** biome-ignore-all lint/style/useBlockStatements: test */
/** biome-ignore-all lint/suspicious/noExplicitAny: test */
/* eslint react/display-name:off */

import { Link } from '@tanstack/react-router';
import type { CellContext, Column, Row } from '@tanstack/react-table';
import { format } from 'date-fns';
import type React from 'react';
import { formatToBRL } from '@/utils/formatToBRL';
import { inputPhoneMask } from '@/utils/inputMasks';
import { DataTable } from '../data-table';
import { FileViewer2 } from '../file-viwer-2';
import { ShowJson } from '../show-json';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog';
import ZoomableImage from '../zoomable-image';
import { PhoneComponent } from './phone';

/* eslint react/display-name: off */

// import { Container } from "./styles";

export type DataType =
  | 'date-time'
  | 'date'
  | 'time'
  | 'phone'
  | 'phones'
  | 'array'
  | 'file'
  | 'table'
  | 'currency'
  | 'object'
  | 'link'
  | 'capitalize'
  | 'picture';

export const TableDataTime: React.FC<{
  cellContext: CellContext<any, unknown>;
  type?: DataType;
  columns?: Column<any>[];

  parse?: (data: any) => any;

  link?: (row: Row<any>) => string;
}> = ({
  cellContext: { getValue, row },
  type = 'date-time',
  columns,

  parse,
  link,
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: test
}) => {
    if (!getValue<string | Date | null>()) return null;

    if (type === 'capitalize') {
      const d = getValue<string | null>();

      if (!d) return <span>-</span>;

      return <span className="capitalize">{parse ? parse(row) : d}</span>;
    }

    if (type === 'phone') {
      const p = getValue<string | null>();

      if (!p) return <span>-</span>;

      return (
        <span className="flex-1">
          {PhoneComponent({ phone: p }) || inputPhoneMask(p)}
        </span>
      );

      // return <span>{inputPhoneMask(getValue<string>())}</span>;
    }

    if (type === 'time' || type === 'date' || type === 'date-time') {
      const v = getValue<string | Date | null | undefined>();

      if (!v) return <span>-</span>;

      if (v.toString() === 'Invalid Date') {
        return <span>-</span>;
      }

      return (
        <span>
          {format(
            new Date(v || ''),
            type === 'date-time'
              ? 'dd/MM/yyyy HH:mm'
              : type === 'date'
                ? 'dd/MM/yyyy'
                : 'HH:mm'
          )}
        </span>
      );
    }

    if (type === 'file') {
      let fileUrl = getValue<string | null>();

      if (parse) {
        fileUrl = parse({ row });
      }

      if (!fileUrl) return <span>-</span>;

      return (
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline">Arquivo</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Arquivo</DialogTitle>
            </DialogHeader>
            <div className="h-[502px]">
              <FileViewer2 file_name="" name="" url={fileUrl} />
            </div>
          </DialogContent>
        </Dialog>
      );
    }

    if (type === 'table') {
      const d = getValue<any>();

      if (!d) return <span>-</span>;
      if (!columns) return <span>a</span>;

      return (
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline">Ver</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            {/* <DialogHeader>
            <DialogTitle>Arquivo</DialogTitle>
          </DialogHeader> */}

            <DataTable columns={columns} data={d || []} />
          </DialogContent>
        </Dialog>
      );
    }

    if (type === 'object') {
      const d = getValue<any>();

      if (!d) return <span>-</span>;

      return (
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline">Ver</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <ShowJson data={typeof d === 'object' ? d : JSON.parse(d)} />
          </DialogContent>
        </Dialog>
      );
    }

    if (type === 'array') {
      const d = getValue<any[]>();

      if (!d) return <span>-</span>;

      return <span>{d.join(', ')}</span>;
    }

    if (type === 'currency') {
      if (parse) {
        const d = parse(row);
        if (!d) return <span>-</span>;

        return <span>{formatToBRL(d)}</span>;
      }

      const d = getValue<number>();

      if (!d) return <span>-</span>;

      return <span>{formatToBRL(d)}</span>;
    }

    if (type === 'picture' && parse) {
      const pictures = getValue<string[] | string | null>();

      if (!pictures || (Array.isArray(pictures) && pictures.length === 0)) {
        return <span>Sem foto</span>;
      }

      const pictureArray = Array.isArray(pictures) ? pictures : [pictures];

      const pictureUrls = parse({ pictureArray, row });

      return (
        <div className="flex h-10 gap-2">
          {pictureUrls.map((url: string) => (
            <div
              className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg"
              key={url}
            >
              <ZoomableImage
                alt={row.original.name || 'Produto'}
                className="h-10 w-10 rounded-lg object-cover"
                src={url}
              />
            </div>
          ))}
        </div>
      );
    }

    if (type === 'link') {
      const d = getValue<string | null>();

      if (!d) return <span>-</span>;

      if (!link) return <span>{d}</span>;

      return (
        <Button asChild variant="link">
          <Link target="_blank" to={link(row)}>
            {d}
          </Link>
        </Button>
      );
    }

    return <span>{getValue<string | null>() || '-'}</span>;
  };

export const tableDataParser =
  (type?: DataType, columns?: Column<any>[], parse?: (data: any) => any) =>
    (cellContext: CellContext<any, unknown>) => (
      <TableDataTime {...{ cellContext, type, columns, parse }} />
    );
export const tableDataParserNew =
  (pa: {
    type?: DataType;
    columns?: Column<any>[];
    parse?: (data: any) => any;
    link?: (row: Row<any>) => string;
  }) =>
    (cellContext: CellContext<any, unknown>) => (
      <TableDataTime {...{ cellContext, ...pa }} />
    );
