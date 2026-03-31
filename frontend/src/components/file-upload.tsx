import { X } from 'lucide-react';

import type { UploadFile } from '@/hooks/useUploadFile';

import { Dropzone } from './Dropzone';
import { FileViewer } from './file-viewer';
import { Button } from './ui/button';
import { Card } from './ui/card';

type ButtonProps = {
  isFileUploading: boolean;
  fileUploadedName?: string;
};

type FileUploadProps = {
  file: UploadFile;
  fileUploaded?: {
    name: string;
    url: string;
    file_name: string;
  };

  buttonTexts?: (b: ButtonProps) => string;

  uploadType?: 'image' | 'pdf' | 'all';
};

export function FileUpload({
  file,
  fileUploaded,
  buttonTexts,
  uploadType,
}: FileUploadProps) {
  return (
    <div className="flex w-full max-w-[600px] flex-col gap-4">
      <Card className="relative flex h-[502px] w-full max-w-[700px] flex-col rounded-lg">
        {fileUploaded ? (
          <FileViewer
            file_name={fileUploaded.file_name}
            name={fileUploaded.name}
            url={fileUploaded.url}
          />
        ) : file.fileUrl && file.localFile ? (
          <>
            <div className="absolute top-0 right-0 z-10 rounded-tr-lg rounded-bl-lg bg-white dark:bg-black">
              <button
                className="rounded-tr-lg rounded-bl-lg bg-primary p-2 text-white hover:bg-primary/95 disabled:bg-primary/35"
                disabled={!!file.fileUploadedName}
                onClick={() => {
                  file.handleRemoveFile();
                }}
                type="button"
              >
                <X />
              </button>
            </div>
            {file.localFile.type === 'application/pdf' ? (
              <iframe
                className="h-full w-full rounded-lg"
                frameBorder="0"
                src={file.fileUrl}
                title={file.fileUrl}
              />
            ) : (
              // biome-ignore lint/performance/noImgElement: test
              <img
                alt=""
                className="w-full overflow-x-auto rounded-lg"
                src={file.fileUrl}
              />
            )}
          </>
        ) : (
          <div className="h-full w-full p-4">
            <Dropzone onUpload={file.handleUpload} uploadType={uploadType} />
          </div>
        )}
      </Card>

      {!fileUploaded && (
        <Button
          disabled={file.isFileUploading || !!file.fileUploadedName}
          onClick={file.handleUploadFile}
        >
          {
            buttonTexts
              ? buttonTexts({
                  isFileUploading: file.isFileUploading,
                  fileUploadedName: file.fileUploadedName,
                })
              : file.isFileUploading
                ? 'Enviando...'
                : file.fileUploadedName
                  ? 'Arquivo enviado' // eslint-disable-line
                  : 'Enviar arquivo' /*eslint-disable-line*/
          }
        </Button>
      )}
    </div>
  );
}
