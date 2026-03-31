import { useCallback, useState } from 'react'

type UseUploadFile = {
  handleUploadFunction: (f: File) => Promise<{
    file_name: string
  }>
}

export function useUploadFile({ handleUploadFunction }: UseUploadFile) {
  const [isFileUploading, setIsFileUploading] = useState(false)
  const [fileUploadedName, setFileUploadedName] = useState<string>()

  const [localFile, setLocalFile] = useState<File | null>(null)
  const [fileUrl, setFileUrl] = useState<string | null>(null)

  const handleUpload = useCallback((f: File[]) => {
    setLocalFile(f[0])
    setFileUrl(URL.createObjectURL(f[0]))
  }, [])

  const handleRemoveFile = useCallback(() => {
    setLocalFile(null)
    setFileUrl(null)
  }, [])

  const handleUploadFile = useCallback(async () => {
    // biome-ignore lint/style/useBlockStatements: test
    if (!localFile) return

    setIsFileUploading(true)

    const response = await handleUploadFunction(localFile)

    setFileUploadedName(response.file_name)

    setIsFileUploading(false)
  }, [localFile, handleUploadFunction])

  return {
    isFileUploading,
    fileUploadedName,
    localFile,
    fileUrl,
    handleUpload,
    handleRemoveFile,
    handleUploadFile,
  }
}

export type UploadFile = ReturnType<typeof useUploadFile>



type UseUploadFileNew = {
  handleUploadFunction: (
    f: File,
    nName: string,
  ) => Promise<
    | {
      file_name: string;
      reset?: boolean;
    }
    | undefined
  >;
  changeName?: boolean;
  handleSelectFile?: (file: File) => Promise<void>;

  serverFileUrl?: string;
};

export function useUploadFileNew({
  handleUploadFunction,
  handleSelectFile,
  changeName = false,
  serverFileUrl,
}: UseUploadFileNew) {
  const [isFileUploading, setIsFileUploading] = useState(false);
  const [isFileSelecting, setIsFileSelecting] = useState(false);

  const [fileUploadedName, setFileUploadedName] = useState<string>();

  const [localFile, setLocalFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(serverFileUrl || null);

  const handleUpload = useCallback((f: File[]) => {
    setLocalFile(f[0]);
    setFileUrl(URL.createObjectURL(f[0]));

    setIsFileSelecting(true);
    if (typeof handleSelectFile === "function") {
      handleSelectFile(f[0])
        .then(() => {
          setIsFileSelecting(false);
        })
        .catch((error) => {
          // biome-ignore lint/suspicious/noConsole: <explanation>
          console.error("Error selecting file:", error);
          setIsFileSelecting(false);
        });
    } else {
      setIsFileSelecting(false);
    }
  }, [handleSelectFile]);

  const handleRemoveFile = useCallback(() => {
    setLocalFile(null);
    setFileUrl(null);
  }, []);

  const handleUploadFile = useCallback(async () => {
    if (!localFile) { return; }

    setIsFileUploading(true);

    let newName = localFile.name;

    if (changeName) {
      const fileExtension = localFile.name.split(".").pop();
      newName = `${crypto.randomUUID()}.${fileExtension}`;
    }

    const response = await handleUploadFunction(localFile, newName);

    if (!response) {
      setIsFileUploading(false);
      return;
    }

    if (response.reset) {
      setLocalFile(null);
      setFileUrl(null);
    } else {
      setFileUploadedName(response.file_name);
    }


    setIsFileUploading(false);
  }, [localFile, handleUploadFunction, changeName]);

  return {
    isFileUploading,
    fileUploadedName,
    localFile,
    fileUrl,
    handleUpload,
    handleRemoveFile,
    handleUploadFile,
    isFileSelecting,
  };
}

export type UploadFileNew = ReturnType<typeof useUploadFileNew>;
