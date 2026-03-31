/** biome-ignore-all lint/suspicious/noExplicitAny: test */

import { X } from 'lucide-react';
import type { UseFormReturn } from 'react-hook-form';
import z from 'zod';
import { formatDateWithTimeToLocalInput } from '@/utils/format-date-with-time-to-local-input';
import { Button } from './ui/button';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from './ui/form';
import { Input } from './ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Switch } from './ui/switch';

type extraFieldOptions = {
  values?: { value: string; label: string; disabled?: boolean }[] | undefined;
  loading: boolean;
  type?: 'datetime-local' | 'date' | 'array';
};

export function generateFormFieldsFromZodSchema<T extends z.ZodTypeAny>(
  schema: T,
  form: UseFormReturn<z.infer<T>>,
  values: Record<string, extraFieldOptions> = {},
  fieldArrays: Record<string, { fields: Array<{ id: string;[key: string]: any }>; append: (value: any) => void; remove: (index: number) => void }> = {}
) {
  return Object.entries((schema as any).shape).map(
    ([fieldName, fieldSchema]) => {
      return renderField(fieldName, fieldSchema as any, form, values, undefined, fieldArrays);
    }
  );
}
function renderField<T extends z.ZodTypeAny>(
  fieldName: string,
  fieldSchema: T,
  form: UseFormReturn<z.infer<T>>,
  values: Record<string, extraFieldOptions> = {},
  overrideDescription?: string,
  fieldArrays: Record<string, { fields: Array<{ id: string;[key: string]: any }>; append: (value: any) => void; remove: (index: number) => void }> = {}
) {
  const description =
    overrideDescription || fieldSchema.description || fieldName;
  const typeName = fieldSchema._def.typeName;

  const fieldValues = values[fieldName];

  if (fieldValues?.loading) {
    return <div key={fieldName}>Carregando {description}...</div>;
  }

  const v = fieldValues?.values;
  // const type = fieldValues?.type;

  switch (typeName) {
    case z.ZodFirstPartyTypeKind.ZodString:
    case z.ZodFirstPartyTypeKind.ZodNumber:
      if (typeName === z.ZodFirstPartyTypeKind.ZodString && v) {
        return (
          <FormField
            control={form.control}
            key={fieldName}
            name={fieldName as never}
            render={({ field }) => (
              <FormItem>
                <FormLabel>{description}</FormLabel>
                <FormControl>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger className="w-full" id={field.name}>
                      <SelectValue placeholder={description} />
                    </SelectTrigger>
                    <SelectContent>
                      {v.map((option) => (
                        <SelectItem
                          disabled={option.disabled}
                          key={option.value}
                          value={option.value}
                        >
                          {option.label}
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
              <FormLabel>{description}</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  id={field.name}
                  onChange={(e) => {
                    const value =
                      typeName === 'ZodNumber'
                        ? e.target.valueAsNumber
                        : e.target.value;
                    field.onChange(value);
                  }}
                  placeholder={description}
                  type={typeName === 'ZodNumber' ? 'number' : 'text'}
                  value={field.value || ''}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      );
    case z.ZodFirstPartyTypeKind.ZodBoolean:
      return (
        <FormField
          control={form.control}
          key={fieldName}
          name={fieldName as never}
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
              <FormLabel className="m-0">{description}</FormLabel>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      );
    // case z.ZodFirstPartyTypeKind.ZodEnum:
    //   return (
    //     <FormField
    //       control={form.control}
    //       key={fieldName}
    //       name={fieldName as never}
    //       render={({ field }) => (
    //         <FormItem>
    //           <FormLabel>{description}</FormLabel>
    //           <FormControl>
    //             <Select>
    //               <SelectTrigger id={field.name}>
    //                 <SelectValue placeholder={description} />
    //               </SelectTrigger>
    //               <SelectContent>
    //                 {v?.map((option: string) => (
    //                   <SelectItem key={option} value={option}>
    //                     {option}
    //                   </SelectItem>
    //                 ))}
    //               </SelectContent>
    //             </Select>
    //           </FormControl>
    //           <FormMessage />
    //         </FormItem>
    //       )}
    //     />
    //   );
    // case z.ZodFirstPartyTypeKind.ZodNativeEnum:
    //   return (
    //     <FormField
    //       control={form.control}
    //       key={fieldName}
    //       name={fieldName as never}
    //       render={({ field }) => (
    //         <FormItem>
    //           <FormLabel>{description}</FormLabel>
    //           <FormControl>
    //             <Select>
    //               <SelectTrigger id={field.name}>
    //                 <SelectValue placeholder={description} />
    //               </SelectTrigger>
    //               <SelectContent>
    //                 {v?.map((option: string) => (
    //                   <SelectItem key={option} value={option}>
    //                     {option}
    //                   </SelectItem>
    //                 ))}
    //               </SelectContent>
    //             </Select>
    //           </FormControl>
    //           <FormMessage />
    //         </FormItem>
    //       )}
    //     />
    //   );
    case z.ZodFirstPartyTypeKind.ZodArray: {
      const fieldArray = fieldArrays[fieldName];
      if (fieldArray) {
        return (
          <FormItem key={fieldName}>
            <FormLabel>{description}</FormLabel>
            <FormControl>
              <div className="space-y-2">
                {fieldArray.fields.map((field, index) => (
                  <div className="flex gap-2" key={field.id}>
                    <FormField
                      control={form.control}
                      name={`${fieldName}.${index}` as never}
                      render={({ field: inputField }) => (
                        <FormControl>
                          <Input
                            {...inputField}
                            placeholder={`${description} ${index + 1}`}
                          />
                        </FormControl>
                      )}
                    />
                    <Button
                      onClick={() => fieldArray.remove(index)}
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  onClick={() => fieldArray.append('')}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Adicionar {description}
                </Button>
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        );
      }

      // Fallback se não houver fieldArray
      return (
        <div className="flex" key={fieldName}>
          {/* <ShowJson
              data={{ fieldSchema, fieldName, description, values, typeName }}
            /> */}
          <span>
            Não sei renderizar o campo {fieldName} do tipo {typeName}
          </span>
        </div>
      );
    }
    case z.ZodFirstPartyTypeKind.ZodDate:
      return (
        <FormField
          control={form.control}
          key={fieldName}
          name={fieldName as never}
          render={({ field }) => (
            <FormItem>
              <FormLabel>{description}</FormLabel>
              <FormControl>
                <Input
                  id={field.name}
                  onChange={(e) => {
                    const date = e.target.value
                      ? new Date(e.target.value)
                      : undefined;
                    field.onChange(date);
                  }}
                  placeholder={description}
                  type={fieldValues?.type || 'date'} // Usa o tipo definido (datetime-local ou date)
                  // CORREÇÃO AQUI:
                  value={
                    field.value
                      ? fieldValues?.type === 'datetime-local'
                        ? formatDateWithTimeToLocalInput(new Date(field.value)) // YYYY-MM-DDTHH:mm
                        : new Date(field.value).toISOString().split('T')[0] // YYYY-MM-DD
                      : ''
                  }
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      );
    case z.ZodFirstPartyTypeKind.ZodOptional:
    case z.ZodFirstPartyTypeKind.ZodNullable:
      return renderField(
        fieldName,
        (fieldSchema as unknown as z.ZodOptional<z.ZodTypeAny>).unwrap(),
        form,
        values,
        description,
        fieldArrays
      );
    case z.ZodFirstPartyTypeKind.ZodUnion:
      {
        const options = (
          fieldSchema as unknown as z.ZodUnion<[z.ZodTypeAny, z.ZodTypeAny]>
        )._def.options;

        // Se for uma união de literais, renderiza um select
        if (options.every((opt) => opt._def.typeName === 'ZodLiteral')) {
          const opts = options.map(
            (opt) => (opt as z.ZodLiteral<any>)._def.value
          );
          return (
            <FormField
              control={form.control}
              key={fieldName}
              name={fieldName as never}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{description}</FormLabel>
                  <FormControl>
                    <Select>
                      <SelectTrigger id={field.name}>
                        <SelectValue placeholder={description} />
                      </SelectTrigger>
                      <SelectContent>
                        {opts.map((option) => (
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
        }
      } // Se não for uma união de literais, tenta renderizar o primeiro tipo
      return renderField(
        fieldName,
        (fieldSchema as unknown as z.ZodUnion<[z.ZodTypeAny, z.ZodTypeAny]>)
          ._def.options[0],
        form,
        values,
        description
      );
    default:
      return (
        <div className="flex" key={fieldName}>
          {/* <ShowJson
              data={{ fieldSchema, fieldName, description, values, typeName }}
            /> */}
          <span>
            Não sei renderizar o campo {fieldName} do tipo {typeName}
          </span>
        </div>
      );
  }
}
