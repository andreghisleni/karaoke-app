// Componente auxiliar para lidar com retentativas de carregamento de imagem
/** biome-ignore-all lint/nursery/noNoninteractiveElementInteractions: <explanation> */
/** biome-ignore-all lint/performance/noImgElement: <explanation> */
import { FileWarning, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "./ui/button";

type ImageWithRetryProps = {
  src: string;
  alt: string;
  onDelete: () => void;
  disabled?: boolean;
};

export function ImageWithRetry({
  src,
  alt,
  onDelete,
  disabled,
}: ImageWithRetryProps) {
  const [currentSrc, setCurrentSrc] = useState(src);
  const [error, setError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const retryTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setCurrentSrc(src);
    setError(false);
    setRetryCount(0);
  }, [src]);

  useEffect(() => {
    return () => {
      if (retryTimeout.current) {
        clearTimeout(retryTimeout.current);
      }
    };
  }, []);

  const handleError = () => {
    if (retryCount < 2) {
      retryTimeout.current = setTimeout(() => {
        setRetryCount((c) => c + 1);
        // Força o reload da imagem
        setCurrentSrc(
          `${src + (src.includes("?") ? "&" : "?")}retry=${retryCount + 1}`,
        );
      }, 5000);
    } else {
      setError(true);
    }
  };

  return (
    <div className="group relative">
      {error ? (
        <div className="flex h-28 w-full items-center justify-center rounded-md border border-dashed bg-muted text-muted-foreground">
          <FileWarning className="h-8 w-8 text-red-500" />
          <span className="ml-2 text-xs">Imagem não encontrada</span>
        </div>
      ) : (
        <img
          alt={alt}
          className="h-28 w-full rounded-md object-cover"
          onError={handleError}
          src={currentSrc}
        />
      )}
      <div className="absolute inset-0 flex items-center justify-center rounded-md bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
        <Button
          disabled={disabled}
          onClick={onDelete}
          size="icon"
          variant="destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
