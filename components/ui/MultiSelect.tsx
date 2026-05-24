'use client';

import React, { useState, useRef, useEffect } from 'react';
import clsx from 'clsx';

export interface MultiSelectOption {
  value: string;
  label: string;
}

export interface MultiSelectProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  label?: string;
  error?: string;
  helperText?: string;
  options: MultiSelectOption[];
  value: string[];
  onChange: (selectedValues: string[]) => void;
  placeholder?: string;
  searchable?: boolean;
}

const MultiSelect = React.forwardRef<HTMLDivElement, MultiSelectProps>(
  (
    {
      label,
      error,
      helperText,
      options,
      value,
      onChange,
      placeholder = 'Select items...',
      searchable = true,
      ...rest
    },
    ref
  ) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);

    // Filter options based on search term
    const filteredOptions = searchable
      ? options.filter((opt) =>
          opt.label.toLowerCase().includes(searchTerm.toLowerCase())
        )
      : options;

    // Get labels of selected options
    const selectedLabels = value
      .map((v) => options.find((opt) => opt.value === v)?.label)
      .filter(Boolean);

    const handleToggleOption = (optionValue: string) => {
      const newValue = value.includes(optionValue)
        ? value.filter((v) => v !== optionValue)
        : [...value, optionValue];
      onChange(newValue);
    };

    const handleRemoveTag = (optionValue: string, e: React.MouseEvent) => {
      e.stopPropagation();
      handleToggleOption(optionValue);
    };

    const handleClear = (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange([]);
    };

    // Close dropdown when clicking outside
    useEffect(() => {
      const handleClickOutside = (e: MouseEvent) => {
        if (
          containerRef.current &&
          !containerRef.current.contains(e.target as Node)
        ) {
          setIsOpen(false);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
      <div ref={ref} className="w-full" {...rest}>
        {label && <label className="label">{label}</label>}
        <div ref={containerRef} className="relative">
          <div
            className={clsx(
              'input min-h-[2.75rem] p-2 cursor-pointer flex flex-wrap gap-2 items-center',
              error && 'border-danger focus:ring-danger focus:border-danger',
              isOpen && 'ring-2 ring-primary border-primary'
            )}
            onClick={() => setIsOpen(!isOpen)}
          >
            {selectedLabels.length > 0 ? (
              <>
                {selectedLabels.map((label, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary text-xs rounded"
                  >
                    {label}
                    <button
                      type="button"
                      className="hover:text-primary/80"
                      onClick={(e) => handleRemoveTag(value[idx], e)}
                    >
                      ✕
                    </button>
                  </span>
                ))}
                {value.length > 0 && (
                  <button
                    type="button"
                    className="ml-auto text-xs text-gray-400 hover:text-gray-600"
                    onClick={handleClear}
                  >
                    Clear all
                  </button>
                )}
              </>
            ) : (
              <span className="text-gray-400">{placeholder}</span>
            )}
          </div>

          {isOpen && (
            <div className="absolute z-20 mt-1 w-full rounded-lg border border-border bg-white shadow-lg">
              {searchable && (
                <input
                  type="text"
                  placeholder="Search..."
                  className="w-full px-3 py-2 border-b border-border focus:outline-none"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                />
              )}
              <div className="max-h-60 overflow-y-auto">
                {filteredOptions.length > 0 ? (
                  filteredOptions.map((opt) => (
                    <label
                      key={opt.value}
                      className="flex items-center gap-2 px-3 py-2 hover:bg-surface cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={value.includes(opt.value)}
                        onChange={() => handleToggleOption(opt.value)}
                        className="cursor-pointer"
                      />
                      <span className="text-sm">{opt.label}</span>
                    </label>
                  ))
                ) : (
                  <div className="px-3 py-2 text-xs text-gray-400">
                    No options available
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {error && (
          <p className="mt-1 text-xs text-danger" role="alert">
            {error}
          </p>
        )}
        {!error && helperText && (
          <p className="mt-1 text-xs text-gray-500">{helperText}</p>
        )}
      </div>
    );
  }
);

MultiSelect.displayName = 'MultiSelect';

export default MultiSelect;
