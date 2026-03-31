/** biome-ignore-all lint/suspicious/noExplicitAny: test */
import { zodResolver } from '@hookform/resolvers/zod';
import { Separator } from '@radix-ui/react-separator';
import { Filter, Loader2, X } from 'lucide-react';
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs';
import { useTransition } from 'react';
import { useForm } from 'react-hook-form';
import z from 'zod';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// import { MySelect, type MySelectProps } from './my-select';
// import { ShowJson } from './show-json';
import { Button } from './ui/button';
import { Form, FormControl, FormField, FormItem, FormMessage } from './ui/form';

// Componente principal refatorado com nuqs
export function FilterBase({
  additionalFieldsSchema,
  values = {},
}: {
  additionalFieldsSchema?: z.ZodObject<any, any>;
  values?: Record<
    string,
    { value: string; label: string; disabled?: boolean }[]
  >;
}) {
  const [isPendingFilterTransition, startTransition] = useTransition();

  // 1. Define o schema base e o combina com os campos adicionais
  const baseSchema = z.object({
    filter: z.string().optional().describe('Filtrar...'),
  });
  const combinedSchema = baseSchema.merge(
    additionalFieldsSchema || z.object({})
  );
  const filterKeys = Object.keys(combinedSchema.shape);

  // 2. Cria a configuração para o useQueryStates dinamicamente a partir do schema
  const queryStateConfig = filterKeys.reduce(
    (acc, key) => {
      // Todos os filtros são tratados como strings na URL.
      // O valor padrão '' significa que se o parâmetro não existir na URL, seu valor será uma string vazia.
      acc[key] = parseAsString.withDefault('');
      return acc;
    },
    {} as Record<string, any>
  );

  // Adiciona o pageIndex para poder resetá-lo ao filtrar
  queryStateConfig.pageIndex = parseAsInteger;

  // 3. Gerencia o estado de TODOS os filtros com um único hook do nuqs
  const [filters, setFilters] = useQueryStates(queryStateConfig, {
    shallow: false,
    history: 'push',
  });

  // 4. Integra o nuqs com o react-hook-form.
  // O formulário é inicializado e sincronizado com os valores da URL.
  const form = useForm({
    resolver: zodResolver(combinedSchema),
    values: filters, // Mágico! O form sempre reflete a URL.
  });

  // 5. Simplifica o onSubmit
  const onSubmit = (data: z.infer<typeof combinedSchema>) => {
    startTransition(() => {
      // Define os novos valores dos filtros e reseta a página para a primeira
      setFilters({ ...data, pageIndex: 1 });
    });
  };

  // 6. Simplifica o handleResetFilters
  const handleResetFilters = () => {
    // Para limpar os filtros, definimos todos os seus valores como null.
    // O nuqs irá removê-los da URL.
    const resetValues = filterKeys.reduce(
      (acc, key) => {
        acc[key] = null;
        return acc;
      },
      {} as Record<string, null>
    );

    startTransition(() => {
      form.reset(); // Limpa a UI do formulário
      setFilters(resetValues); // Limpa a URL
    });
  };

  // 7. Verifica se há filtros ativos diretamente do estado do nuqs
  const hasFilters = filterKeys.some((key) => !!filters[key]);

  const renderField = (fieldName: string, fieldSchema: z.ZodTypeAny) => {
    const description = fieldSchema?._def?.description;
    const v = (fieldSchema?._def as any)?.innerType?._def?.values;
    const typeName = (fieldSchema?._def as any)?.innerType?._def?.typeName;

    // A lógica de renderização dos campos permanece a mesma
    switch (typeName) {
      case 'ZodString':
        if (values[fieldName]) {
          return (
            <FormField
              control={form.control}
              key={fieldName}
              name={fieldName as never}
              render={({ field }) => (
                <FormItem className="group relative">
                  <label
                    className="-translate-y-1/2 absolute start-1 top-0 z-10 block bg-background px-2 font-medium text-foreground text-xs group-has-disabled:opacity-50"
                    htmlFor={field.name}
                  >
                    {description}
                  </label>
                  <FormControl>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger id={field.name}>
                        <SelectValue placeholder={description} />
                      </SelectTrigger>
                      <SelectContent>
                        {values[fieldName].map(({ value, label, disabled }) => (
                          <SelectItem
                            disabled={disabled}
                            key={value}
                            value={value}
                          >
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          );
        }
        return (
          <FormField
            control={form.control}
            key={fieldName}
            name={fieldName as never}
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Input
                    placeholder={description}
                    {...field}
                    className="w-full"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        );
      case 'ZodEnum':
        return (
          <FormField
            control={form.control}
            key={fieldName}
            name={fieldName as never}
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Select>
                    <SelectTrigger id={field.name}>
                      <SelectValue placeholder={description} />
                    </SelectTrigger>
                    <SelectContent>
                      {v.map((option: string) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        );
      case 'ZodNativeEnum':
        return (
          <FormField
            control={form.control}
            key={fieldName}
            name={fieldName as never}
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  {/* <MySelect
                    {...field}
                    className="w-48"
                    menuPosition="fixed"
                    options={Object.entries(v).map(([label, value]) => ({
                      value: value as string,
                      label,
                    }))}
                    placeholder={description}
                  /> */}
                  <Select>
                    <SelectTrigger id={field.name}>
                      <SelectValue placeholder={description} />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(v).map(([label, value]) => (
                        <SelectItem
                          key={value as string}
                          value={value as string}
                        >
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        );
      default:
        return (
          <div className="flex">
            {/* <ShowJson
              data={{ fieldSchema, fieldName, description, values, typeName }}
            /> */}
          </div>
        );
    }
  };

  return (
    <Form {...form}>
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={form.handleSubmit(onSubmit)}
      >
        {filterKeys.map((fieldName) =>
          renderField(fieldName, combinedSchema.shape[fieldName])
        )}

        <Separator className="hidden h-6 md:block" orientation="vertical" />

        <div className="flex gap-2">
          <Button
            disabled={!form.formState.isDirty}
            type="submit"
            variant="secondary"
          >
            {isPendingFilterTransition ? (
              <Loader2 className="mr-2 size-3 animate-spin" />
            ) : (
              <Filter className="size-3 md:mr-2" />
            )}
            <span className="hidden md:block">Filtrar</span>
          </Button>

          <Button
            disabled={!hasFilters}
            onClick={handleResetFilters}
            type="button"
            variant="outline"
          >
            <X className="size-3 md:mr-2" />
            <span className="hidden md:block">Limpar</span>
          </Button>
        </div>
      </form>
    </Form>
  );
}

// Exemplo de uso:
// const myAdditionalFieldsSchema = z.object({
//   category: z.string().optional().describe('Categoria'),
//   status: z.enum(['ATIVO', 'INATIVO']).optional().describe('Status'),
// });
//
// <FilterBaseNew additionalFieldsSchema={myAdditionalFieldsSchema} />;
