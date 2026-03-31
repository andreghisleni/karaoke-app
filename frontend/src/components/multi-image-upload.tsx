// src/components/multi-image-upload.tsx
/** biome-ignore-all lint/performance/noImgElement: <explanation> */
/** biome-ignore-all lint/suspicious/noConsole: <explanation> */
/** biome-ignore-all lint/correctness/useExhaustiveDependencies: <explanation> */
"use client";

import axios from "axios";
import { CheckCircle2, FileWarning, Loader2, UploadCloud } from "lucide-react";
import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";

type UploadingFile = {
  file: File;
  preview: string;
  progress: number;
  status: "pending" | "uploading" | "success" | "error";
  error?: string;
};

type MultiImageUploadProps = {
  value: string[];
  onUploadSuccess: (key: string) => Promise<void>;
  onDelete: (key: string) => Promise<void>;
  disabled?: boolean;
  parseUrl?: (url: string) => string;
};

const apiUrl = import.meta.env.VITE_API_URL;

const getFileViewUrl = (fileKey: string) => {
  return `${apiUrl}/files?file=${encodeURIComponent(fileKey)}`;
};

import { ImageWithRetry } from "./image-with-retry";

// NOVO: Função helper para renomear o arquivo com um UUID
const renameFileToUUID = (file: File): File => {
  const fileExtension = file.name.split(".").pop();
  // Gera um nome único e anexa a extensão original
  const newName = `${crypto.randomUUID()}.${fileExtension}`;

  return new File([file], newName, {
    type: file.type,
    lastModified: file.lastModified,
  });
};

export function MultiImageUpload({
  value,
  onUploadSuccess,
  onDelete,
  disabled,
  parseUrl,
}: MultiImageUploadProps) {
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      // MODIFICADO: Renomeia cada arquivo antes de iniciar o processo
      const renamedFiles = acceptedFiles.map(renameFileToUUID);

      const newFilesToUploadState: UploadingFile[] = renamedFiles.map(
        (file) => ({
          file,
          preview: URL.createObjectURL(file), // Cria preview para o arquivo já renomeado
          progress: 0,
          status: "pending",
        }),
      );

      setUploadingFiles((prev) => [...prev, ...newFilesToUploadState]);

      await Promise.all(newFilesToUploadState.map(uploadFile));
    },
    [], // Removido dependências desnecessárias para evitar re-criação da função
  );

  const updateFileStatus = (file: File, status: Partial<UploadingFile>) => {
    setUploadingFiles((prev) =>
      prev.map((uf) =>
        uf.file.name === file.name ? { ...uf, ...status } : uf,
      ),
    );
  };

  const uploadFile = async (uploadingFile: UploadingFile) => {
    try {
      updateFileStatus(uploadingFile.file, { status: "uploading" });
      if (!apiUrl) {
        throw new Error("NEXT_PUBLIC_API_URL não está definida.");
      }

      // O nome do arquivo enviado para o backend agora já é o nome randomizado
      const getUrlEndpoint = `${apiUrl}/files?file=${encodeURIComponent(uploadingFile.file.name)}`;
      const response = await fetch(getUrlEndpoint, { method: "POST" });

      if (!response.ok) {
        throw new Error(`Falha ao obter URL: ${response.statusText}`);
      }

      const { url: uploadUrl } = await response.json();

      await axios.put(uploadUrl, uploadingFile.file, {
        headers: { "Content-Type": uploadingFile.file.type },
        onUploadProgress: (progressEvent) => {
          const progress = Math.round(
            (progressEvent.loaded * 100) / (progressEvent.total || 1),
          );
          updateFileStatus(uploadingFile.file, { progress });
        },
      });

      updateFileStatus(uploadingFile.file, {
        status: "success",
        progress: 100,
      });

      // O nome do arquivo (agora o UUID) é enviado para o componente pai
      await onUploadSuccess(uploadingFile.file.name);

      setTimeout(() => {
        setUploadingFiles((prev) =>
          prev.filter((uf) => uf.file.name !== uploadingFile.file.name),
        );
      }, 500); // A pré-visualização some após 1.5 segundos
    } catch (error) {
      console.error("Erro no upload:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Ocorreu um erro desconhecido.";
      updateFileStatus(uploadingFile.file, {
        status: "error",
        error: errorMessage,
      });
      toast.error("Falha no upload.");
    }
  };

  // O handleDelete agora é mais simples e apenas propaga o evento
  const handleDelete = async (keyToDelete: string) => {
    const toastId = toast.loading("Excluindo imagem...");
    try {
      await onDelete(keyToDelete);
      toast.success("Imagem excluída com sucesso!", { id: toastId });
    } catch (error) {
      toast.error("Falha ao excluir a imagem.", { id: toastId });
      console.error(error);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [] },
    disabled,
  });

  return (
    <div>
      <div
        {...getRootProps()}
        className={`flex h-32 items-center justify-center rounded-md border-2 border-dashed text-muted-foreground transition-colors ${isDragActive ? "border-primary bg-primary/10" : "border-border"} ${disabled ? "cursor-not-allowed bg-muted" : "cursor-pointer hover:border-primary/50"}`}
      >
        <input {...getInputProps()} />
        <div className="text-center">
          <UploadCloud className="mx-auto h-8 w-8" />
          <p>Arraste e solte ou clique para enviar</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {/* MUDANÇA IMPORTANTE: Mapeia as chaves e constrói a URL de visualização */}
        {value.map((key) => (
          <ImageWithRetry
            alt="Imagem enviada"
            disabled={disabled}
            key={key}
            onDelete={() => handleDelete(key)}
            src={parseUrl ? getFileViewUrl(parseUrl(key)) : getFileViewUrl(key)}
          />
        ))}

        {/* Lógica para arquivos em upload permanece visualmente a mesma */}
        {uploadingFiles.map(({ file, preview, progress, status, error }) => (
          <div className="relative" key={preview}>
            <img
              alt={file.name}
              className="h-28 w-full rounded-md object-cover"
              src={preview}
            />
            <div className="absolute inset-0 flex items-center justify-center rounded-md bg-black/60 p-2 text-white">
              {status === "uploading" && (
                <div className="w-full text-center">
                  <Loader2 className="mx-auto mb-1 h-6 w-6 animate-spin" />
                  <Progress className="h-1 w-full" value={progress} />
                </div>
              )}
              {status === "success" && (
                <CheckCircle2 className="h-8 w-8 text-green-500" />
              )}
              {status === "error" && (
                <div className="text-center">
                  <FileWarning className="mx-auto h-8 w-8 text-red-500" />
                  <p className="mt-1 text-red-400 text-xs">{error}</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
