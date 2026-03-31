import type React from 'react';
import { useCallback, useEffect, useState } from 'react';

import { api } from '@/lib/api';
import { getUrlExtension } from '@/utils/get-extension-of-url';

// import { Container } from './styles';

const verifyExtension = (url: string) => {
  return url ? getUrlExtension(url) : '';
};

export const FileViewer: React.FC<{
  url: string;
  file_name: string;
  name: string;
}> = ({ url, file_name }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [localUrl, setLocalUrl] = useState('');

  const downloadFile = useCallback(async () => {
    setIsLoading(true);

    const response = await api.get(url, {
      responseType: 'blob',
      withCredentials: false,
    });

    // const fileBlob = new Blob([
    //   new File([response.data], `${name}.${verifyExtension(file_name)}`),
    // ])

    const fileURL = URL.createObjectURL(response.data);

    setLocalUrl(fileURL);
    setIsLoading(false);
  }, [url]);

  useEffect(() => {
    downloadFile();
  }, [downloadFile]);

  return isLoading ? (
    <div className="flex h-full w-full items-center justify-center">
      Carregando...
    </div>
  ) : verifyExtension(file_name) === 'pdf' ? (
    <iframe
      className="h-full w-full rounded-lg"
      frameBorder="0"
      src={localUrl}
      title={file_name}
    />
  ) : (
    // biome-ignore lint/performance/noImgElement: test
    <img
      alt={file_name}
      className="w-full overflow-x-auto rounded-lg"
      src={localUrl}
    />
  );
};
