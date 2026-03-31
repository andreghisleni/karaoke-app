import { useCallback, useEffect, useState } from 'react';
// 1. Mude a importação do componente
import ReactQuill from 'react-quill-new';
// 2. Mude a importação do CSS
import 'react-quill-new/dist/quill.snow.css';

// Importe suas funções do sistema antigo
import { htmlToMarkdown, markdownToHtml } from '@/utils/htmlToMd';

interface EditorProps {
  value?: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function Editor({
  value,
  onChange,
  placeholder,
  disabled,
}: EditorProps) {
  // Estado interno para segurar o HTML que o ReactQuill precisa para renderizar
  const [htmlValue, setHtmlValue] = useState('');

  // Sincroniza o Markdown que vem do banco (value) transformando em HTML
  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    const converted = value ? markdownToHtml(value) : '';
    if (converted !== htmlValue) {
      setHtmlValue(converted);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const handleChange = useCallback(
    (content: string) => {
      setHtmlValue(content);
      // Converte o HTML do Quill de volta para Markdown antes de mandar pro form
      const markdown = htmlToMarkdown(content);
      onChange(markdown);
    },
    [onChange]
  );

  // Configuração da barra de ferramentas do ReactQuill
  const modules = {
    toolbar: [
      [{ header: [1, 2, 3, false] }], // Título 1, 2, 3 e Texto Normal (false)
      ['bold', 'italic', 'strike'],
      [{ list: 'ordered' }, { list: 'bullet' }],
      ['clean'], // Botão de limpar formatação
    ],
  };

  return (
    <div className="/* Ajustes visuais da barra do Quill para combinar com o Shadcn */ /* GAMBIARRAS DE CSS: Para o Tailwind não zerar o tamanho dos títulos e listas */ overflow-hidden rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 [&_.ql-container]:border-none [&_.ql-editor]:min-h-[150px] [&_.ql-editor_h1]:mb-4 [&_.ql-editor_h1]:font-bold [&_.ql-editor_h1]:text-3xl [&_.ql-editor_h2]:mb-3 [&_.ql-editor_h2]:font-bold [&_.ql-editor_h2]:text-2xl [&_.ql-editor_h3]:mb-2 [&_.ql-editor_h3]:font-bold [&_.ql-editor_h3]:text-xl [&_.ql-editor_ol]:mb-2 [&_.ql-editor_ol]:list-decimal [&_.ql-editor_ol]:pl-5 [&_.ql-editor_p]:mb-2 [&_.ql-editor_ul]:mb-2 [&_.ql-editor_ul]:list-disc [&_.ql-editor_ul]:pl-5 [&_.ql-toolbar]:border-x-0 [&_.ql-toolbar]:border-t-0 [&_.ql-toolbar]:bg-muted/50 ">
      <ReactQuill
        modules={modules}
        onChange={handleChange}
        placeholder={placeholder}
        readOnly={disabled}
        theme="snow"
        value={htmlValue}
      />
    </div>
  );
}
