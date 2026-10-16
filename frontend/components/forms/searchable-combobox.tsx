"use client";

import { ReactNode, useId, useMemo, useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { OptionPicker, type PickerOption } from "@/components/forms/option-picker";
import { cn } from "@/lib/utils";

export type ComboboxOption = PickerOption;

interface SearchableComboboxProps {
  value: string;
  onChange: (value: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  /** Titulo de la hoja en movil; por defecto, el placeholder. */
  title?: string;
  emptyMessage?: string;
  disabled?: boolean;
  disabledMessage?: string;
  loading?: boolean;
  loadingMessage?: string;
  allowClear?: boolean;
  leadingIcon?: ReactNode;
  className?: string;
  required?: boolean;
  id?: string;
  searchPlaceholder?: string;
  compactOnMobile?: boolean;
}

/** Campo de formulario que abre un OptionPicker (hoja en movil, desplegable en escritorio). */
export function SearchableCombobox({
  value,
  onChange,
  options,
  placeholder = "Selecciona una opcion",
  title,
  emptyMessage = "Sin resultados",
  disabled = false,
  disabledMessage,
  loading = false,
  loadingMessage = "Cargando...",
  allowClear = true,
  leadingIcon,
  className,
  id,
  searchPlaceholder = "Buscar...",
  compactOnMobile = false,
}: SearchableComboboxProps) {
  const generatedId = useId();
  const triggerId = id ?? generatedId;
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const selected = useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value],
  );

  const disabledState = disabled || loading;

  const handleClear = (event: React.MouseEvent) => {
    event.stopPropagation();
    onChange("");
  };

  return (
    <div className={cn("relative w-full", className)}>
      <button
        ref={triggerRef}
        type="button"
        id={triggerId}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabledState}
        onClick={() => {
          if (disabledState) return;
          setOpen((prev) => !prev);
        }}
        className={cn(
          "flex w-full items-center gap-3 rounded-3xl border-0 bg-surface-variant text-left text-sm text-foreground shadow-none outline-none transition",
          compactOnMobile ? "h-12 px-3 sm:h-13 sm:px-4" : "h-13 px-4",
          "focus-visible:border-b-2 focus-visible:border-primary",
          disabledState && "cursor-not-allowed opacity-70",
        )}
      >
        {leadingIcon ? (
          <span className="flex size-5 shrink-0 items-center justify-center text-muted-foreground">
            {leadingIcon}
          </span>
        ) : null}

        <span className="flex min-w-0 flex-1 flex-col">
          {selected ? (
            <>
              <span className="truncate text-sm font-medium text-foreground">
                {selected.label}
              </span>
              {selected.description ? (
                <span
                  className={cn(
                    "truncate text-xs text-muted-foreground",
                    compactOnMobile && "hidden sm:block",
                  )}
                >
                  {selected.description}
                </span>
              ) : null}
            </>
          ) : (
            <span className="truncate text-sm text-muted-foreground">
              {disabled && disabledMessage
                ? disabledMessage
                : loading
                  ? loadingMessage
                  : placeholder}
            </span>
          )}
        </span>

        {selected && allowClear && !disabledState ? (
          <span
            role="button"
            aria-label="Limpiar seleccion"
            tabIndex={0}
            onClick={handleClear}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onChange("");
              }
            }}
            className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-background/80 hover:text-foreground sm:size-6"
          >
            <X className="size-3.5" />
          </span>
        ) : null}

        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      <OptionPicker
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={triggerRef}
        options={options}
        value={value}
        onSelect={onChange}
        title={title ?? placeholder}
        searchPlaceholder={searchPlaceholder}
        emptyMessage={emptyMessage}
        loading={loading}
        loadingMessage={loadingMessage}
        compactOnMobile={compactOnMobile}
      />
    </div>
  );
}
