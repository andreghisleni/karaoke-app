import { useEffect, useState } from 'react';
import { codeToHtml } from 'shiki';

// biome-ignore lint/suspicious/noExplicitAny: test
export default function SJ({ data }: { data: any }) {
  // eslint-disable-line
  const [code, setCode] = useState('');

  useEffect(() => {
    (async () => {
      const c = await codeToHtml(JSON.stringify(data, null, 2), {
        lang: 'json',
        themes: {
          light: 'min-light',
          dark: 'nord',
        },
      });

      setCode(c);
    })();
  }, [data]);

  return (
    <div
      // biome-ignore lint/security/noDangerouslySetInnerHtml: test
      dangerouslySetInnerHTML={{
        __html: code,
      }}
    />
  );
}
