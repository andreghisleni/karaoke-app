/** biome-ignore-all lint/performance/noImgElement: <explanation> */
/** biome-ignore-all lint/suspicious/noConsole: <explanation> */

import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';
import { getUrlExtension } from '@/utils/get-extension-of-url';

const verifyExtension = (url: string) => {
  return url ? getUrlExtension(url) : '';
};

export const FileViewer2: React.FC<{
  url: string; // URL da sua API (ex: files?file=...)
  file_name: string;
  name: string;
}> = ({ url, file_name }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [localUrl, setLocalUrl] = useState('');

  const loadFile = useCallback(async () => {
    setIsLoading(true);

    try {
      // 1. Pega o JSON com a URL pré-assinada da sua API
      const response = await api.get(url);

      // Ajuste para o nome exato da propriedade que sua API está retornando
      const signedUrl = response.data.url;

      const isPdf = verifyExtension(file_name) === 'pdf';

      if (isPdf) {
        // 2. Se for PDF, fazemos o fetch direto na URL do R2 para pegar o Blob.
        // Como o CORS do R2 já está configurado e não tem mais 302, isso vai funcionar!
        const response2 = await api.get(url, {
          responseType: 'blob',
        });

        // const fileBlob = new Blob([
        //   new File([response.data], `${name}.${verifyExtension(file_name)}`),
        // ])

        const fileURL = URL.createObjectURL(response2.data);

        setLocalUrl(fileURL);
      } else {
        // 3. Se for imagem, joga a URL direta do R2 (mais rápido e economiza memória)
        setLocalUrl(signedUrl);
      }
    } catch (error) {
      console.error("Erro ao carregar o arquivo:", error);
    } finally {
      setIsLoading(false);
    }
  }, [url, file_name]);

  useEffect(() => {
    loadFile();

    // Limpeza de memória (boas práticas com Blob)
    return () => {
      if (localUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(localUrl);
      }
    };
  }, [loadFile, localUrl]); // Removi o localUrl do array de dependências do useEffect para não causar loop

  return isLoading ? (
    <div className="flex h-full w-full items-center justify-center">
      Carregando...
    </div>
  ) : verifyExtension(file_name) === 'pdf' ? (
    <iframe
      className="h-full w-full rounded-lg"
      frameBorder="0"
      src={localUrl} // Aqui vai entrar o "blob:http://..."
      title={file_name}
    />
  ) : (
    // biome-ignore lint/performance/noImgElement: test
    <img
      alt={file_name}
      className="w-full overflow-x-auto rounded-lg"
      src={localUrl} // Aqui entra a URL direta do R2
    />
  );
};