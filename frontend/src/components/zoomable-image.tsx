import type { DetailedHTMLProps, ImgHTMLAttributes } from 'react';
import { Dialog, DialogContent, DialogTrigger } from './ui/dialog';

export default function ZoomableImage({
  src,
  alt,
  className,
}: DetailedHTMLProps<ImgHTMLAttributes<HTMLImageElement>, HTMLImageElement>) {
  if (!src) { return null; }
  return (
    <Dialog>
      <DialogTrigger asChild>
        <picture>
          <img
            alt={alt || ''}
            className={className}
            height={100}
            sizes="100vw"
            src={src}
            style={{
              width: '100%',
              height: 'auto',
            }}
            width={500}
          />
        </picture>
      </DialogTrigger>
      <DialogContent className="max-w-auto border-0 bg-transparent p-0">
        <div className="relative h-[calc(100vh-220px)] w-full overflow-clip rounded-md bg-transparent shadow-md">
          <picture>
            <img
              alt={alt || ''}
              className="h-full w-full object-contain"
              src={src}
            />
          </picture>
        </div>
      </DialogContent>
    </Dialog>
  );
}
