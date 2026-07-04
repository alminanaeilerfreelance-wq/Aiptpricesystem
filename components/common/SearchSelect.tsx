'use client';

import React from 'react';
import { Autocomplete, TextField } from '@mui/material';

export interface SearchSelectProps<T> {
  label: string;
  options: T[];
  value: T | T[] | null;
  onChange: (value: T | T[] | null) => void;
  getOptionLabel: (option: T) => string;
  getOptionValue: (option: T) => string;
  loading?: boolean;
  error?: boolean;
  helperText?: string;
  multiple?: boolean;
  placeholder?: string;
  disabled?: boolean;
}

export default function SearchSelect<T>({
  label,
  options,
  value,
  onChange,
  getOptionLabel,
  getOptionValue,
  loading = false,
  error = false,
  helperText,
  multiple = false,
  placeholder,
  disabled = false,
}: SearchSelectProps<T>) {
  return (
    <Autocomplete
      size="small"
      multiple={multiple}
      options={options}
      value={value as any}
      loading={loading}
      disabled={disabled}
      getOptionLabel={getOptionLabel}
      isOptionEqualToValue={(option, selected) => getOptionValue(option) === getOptionValue(selected)}
      onChange={(_, selected) => onChange(selected as T | T[] | null)}
      renderOption={(props, option) => {
        const { key: _key, ...optionProps } = props;
        return (
          <li key={getOptionValue(option)} {...optionProps}>
            {getOptionLabel(option)}
          </li>
        );
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          placeholder={loading ? 'Loading...' : placeholder}
          error={error}
          helperText={helperText}
        />
      )}
    />
  );
}
