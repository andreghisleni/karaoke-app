/* eslint-disable @typescript-eslint/no-explicit-any */
/** biome-ignore-all lint/suspicious/noExplicitAny: <explanation> */

import type { GroupBase, Options, OptionsOrGroups } from "react-select";

import { ReactSelect } from "./Select";

export interface MySelectProps<Option, Group extends GroupBase<Option>> {
  options: OptionsOrGroups<Option, Group>;

  value: string[] | string | null | undefined;

  onChange: (value: string[] | string | null) => void;

  disabled?: boolean;

  isMulti?: boolean;

  className?: string;

  placeholder?: string;

  menuPosition?: "absolute" | "fixed";
  isOptionSelected?: (option: Option, selectValue: Options<Option>) => boolean;

  id?: string;

  closeMenuOnSelect?: boolean;
}

export function MySelect({
  options,
  value,
  onChange,
  disabled,
  isMulti,
  className,
  placeholder,
  menuPosition,
  isOptionSelected,
  id,
  closeMenuOnSelect,
}: MySelectProps<any, any>) {
  return (
    <ReactSelect
      className={className}
      closeMenuOnSelect={closeMenuOnSelect}
      defaultValue={options.filter((option) =>
        isMulti ? value?.includes(option.value) : value === option.value,
      )}
      id={id}
      isDisabled={disabled}
      isMulti={isMulti}
      isOptionSelected={isOptionSelected}
      menuPosition={menuPosition}
      onChange={(v: any) => {
        // console.log(v); // eslint-disable-line no-console

        isMulti ? onChange(v.map((vv: any) => vv.value)) : onChange(v.value);
      }}
      options={options}
      placeholder={placeholder ?? "Select..."}
      value={options.filter((option) =>
        isMulti ? value?.includes(option.value) : value === option.value,
      )}
    />
  );
}
