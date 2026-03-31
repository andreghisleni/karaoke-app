import type React from 'react';
import type { ReactNode } from 'react';
import { useDropzone } from 'react-dropzone';

import { cn } from '@/lib/utils';

import UploadSvg from '../assets/upload-icon.svg';

interface UploadProps {
  onUpload: (files: File[]) => void;
  uploadType?: 'image' | 'pdf' | 'all';
}

const UploadMessage: React.FC<{
  children: ReactNode;
  type?: 'error' | 'success';
}> = ({ children, type }) => {
  return (
    <p
      className={cn(
        'flex items-center justify-center px-12 text-base',
        'text-dropzone-default',
        type === 'error' && 'text-dropzone-error',
        type === 'success' && 'text-dropzone-success'
      )}
    >
      {children}
    </p>
  );
};

export const Dropzone: React.FC<UploadProps> = ({ onUpload, uploadType }) => {
  const { getRootProps, getInputProps, isDragActive, isDragReject } =
    useDropzone({
      accept: uploadType
        ? {
            ...(uploadType === 'image' && {
              'image/jpeg': ['.jpeg', '.jpg'],
              'image/png': ['.png'],
            }),
            ...(uploadType === 'pdf' && {
              'application/pdf': ['.pdf'],
            }),
            ...(uploadType === 'all' && {
              'image/jpeg': ['.jpeg', '.jpg'],
              'image/png': ['.png'],
              'application/pdf': ['.pdf'],
            }),
          }
        : {
            'image/jpeg': ['.jpeg', '.jpg'],
            'image/png': ['.png'],
            'application/pdf': ['.pdf'],
          },
      onDropAccepted: (files) => onUpload(files),
    });

  function renderDragMessage(isDragAc: boolean, isDragRe: boolean): ReactNode {
    if (!isDragAc) {
      return (
        <UploadMessage>Selecione ou arraste o arquivo aqui.</UploadMessage>
      );
    }

    if (isDragRe) {
      return <UploadMessage type="error">Arquivo não suportado</UploadMessage>;
    }

    return <UploadMessage type="success">Solte o arquivo aqui</UploadMessage>;
  }

  return (
    <div
      {...getRootProps()}
      className={cn(
        'flex h-full w-full cursor-pointer flex-col items-center justify-center gap-4 rounded-md border-[#969cb3] border-[1.5px] border-dashed p-8 hover:border-[#5636D3]',
        isDragActive && 'border-[#12a454]',
        isDragReject && 'cursor-cell border-[#e83f5b]'
      )}
    >
      <input {...getInputProps()} />

      {/** biome-ignore lint/performance/noImgElement: test */}
      <img alt="Upload Icon" className="w-[106px]" src={UploadSvg} />
      {renderDragMessage(isDragActive, isDragReject)}
    </div>
  );
};
