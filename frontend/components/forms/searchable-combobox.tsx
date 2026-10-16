"use client";

import {
  KeyboardEvent,
  CSSProperties,
  ReactNode,
  useEffect,
  useEffectEvent,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ComboboxOption {
  value: string;
  label: string;
  description?: string | null;
}

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

type Placement = "popover" | "sheet";

interface PanelFrame {
  listMaxHeight?: number;
  style: CSSProperties;
}

/** Bajo este ancho las opciones se abren en una hoja inferior en vez de un desplegable. */
const SHEET_MAX_WIDTH = 640;
/** Aire que la hoja deja arriba para que se vea que es una capa sobre la pagina. */
const SHEET_TOP_GAP = 56;
/** Con pocas opciones el buscador sobra: se ven todas de una. */
const SEARCH_MIN_OPTIONS = 6;
/** Curva y duraciones de la hoja, parecidas a las de las hojas de iOS. */
const SHEET_EASE = "cubic-bezier(0.32, 0.72, 0, 1)";
const SHEET_ENTER_MS = 340;
const SHEET_EXIT_MS = 240;
const POPOVER_MS = 150;
/** Al soltar la hoja, la cierra un arrastre de mas de 90px o un tiron rapido (px/ms). */
const DRAG_CLOSE_DISTANCE = 90;
const DRAG_CLOSE_VELOCITY = 0.5;
/** Pausa tras elegir para que se alcance a ver el check antes de que la hoja baje. */
const SELECT_CLOSE_DELAY_MS = 140;

const prefersReducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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
  const titleId = `${triggerId}-titulo`;
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<Placement>("popover");
  const [query, setQuery] = useState("");
  const [highlighted, setHighlighted] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [frame, setFrame] = useState<PanelFrame>({ style: {} });
  // `open` monta el panel; `entered` lo anima a su lugar. Al cerrar, `entered` vuelve a
  // false y el panel se desmonta cuando termina la salida.
  const [entered, setEntered] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const dragStartRef = useRef<{ y: number; t: number } | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const selectTimerRef = useRef<number | null>(null);
  const isSheet = placement === "sheet";

  const selected = useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value],
  );

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("es");

    if (!normalized) return options;

    return options.filter((option) => {
      const haystack =
        `${option.label} ${option.description ?? ""}`.toLocaleLowerCase("es");
      return haystack.includes(normalized);
    });
  }, [options, query]);
  const highlightedIndex = Math.min(
    highlighted,
    Math.max(filtered.length - 1, 0),
  );

  const clearTimers = () => {
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    if (selectTimerRef.current) window.clearTimeout(selectTimerRef.current);
    closeTimerRef.current = null;
    selectTimerRef.current = null;
  };

  const openCombobox = () => {
    clearTimers();
    setReducedMotion(prefersReducedMotion());
    setPlacement(window.innerWidth < SHEET_MAX_WIDTH ? "sheet" : "popover");
    setEntered(false);
    setDragY(0);
    setOpen(true);
    setHighlighted(Math.max(options.findIndex((option) => option.value === value), 0));
  };

  const finishClose = () => {
    clearTimers();
    setOpen(false);
    setEntered(false);
    setDragY(0);
    setQuery("");
    setHighlighted(0);
  };

  const closeCombobox = () => {
    if (closeTimerRef.current) return;
    setEntered(false);
    setDragging(false);
    dragStartRef.current = null;
    const exitMs = reducedMotion ? 0 : isSheet ? SHEET_EXIT_MS : POPOVER_MS;
    closeTimerRef.current = window.setTimeout(finishClose, exitMs);
  };

  useEffect(() => clearTimers, []);

  useEffect(() => {
    if (!open) return;
    // Dos cuadros: el panel se pinta primero en su posicion de salida y despues anima.
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setEntered(true));
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [open]);

  // Layout effect: la hoja se posiciona antes de pintarse, sin un cuadro en el lugar viejo.
  useLayoutEffect(() => {
    if (!open) return;

    const updateFrame = () => {
      if (placement === "sheet") {
        // La hoja se apoya en el borde inferior del area visible: con el teclado abierto,
        // iOS achica el visualViewport pero no mueve los elementos fixed, y la lista
        // quedaria detras del teclado.
        const viewport = window.visualViewport;
        const visibleHeight = viewport?.height ?? window.innerHeight;
        const visibleBottom = (viewport?.offsetTop ?? 0) + visibleHeight;
        setFrame({
          style: {
            bottom: Math.max(window.innerHeight - visibleBottom, 0),
            left: 0,
            maxHeight: visibleHeight - SHEET_TOP_GAP,
            position: "fixed",
            right: 0,
            zIndex: 61,
          },
        });
        return;
      }

      if (!triggerRef.current) return;

      const rect = triggerRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const horizontalMargin = 12;
      const verticalMargin = 12;
      const gap = 8;
      const minListHeight = 96;

      const width = Math.min(rect.width, viewportWidth - horizontalMargin * 2);
      const maxLeft = viewportWidth - horizontalMargin - width;
      const left = Math.min(Math.max(rect.left, horizontalMargin), maxLeft);

      const spaceBelow = viewportHeight - rect.bottom - gap - verticalMargin;
      const spaceAbove = rect.top - gap - verticalMargin;
      const openAbove = spaceBelow < 220 && spaceAbove > spaceBelow;
      const availableSpace = Math.max(
        openAbove ? spaceAbove : spaceBelow,
        minListHeight,
      );

      setFrame({
        listMaxHeight: Math.min(availableSpace, compactOnMobile ? 288 : 360),
        style: openAbove
          ? {
              bottom: Math.max(viewportHeight - rect.top + gap, verticalMargin),
              left,
              position: "fixed",
              width,
              zIndex: 50,
            }
          : {
              left,
              position: "fixed",
              top: Math.max(rect.bottom + gap, verticalMargin),
              width,
              zIndex: 50,
            },
      });
    };

    updateFrame();

    const handleViewportChange = () => {
      window.requestAnimationFrame(updateFrame);
    };

    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);
    window.visualViewport?.addEventListener("resize", handleViewportChange);
    window.visualViewport?.addEventListener("scroll", handleViewportChange);

    return () => {
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
      window.visualViewport?.removeEventListener("resize", handleViewportChange);
      window.visualViewport?.removeEventListener("scroll", handleViewportChange);
    };
  }, [compactOnMobile, open, placement]);

  const closeFromOutside = useEffectEvent(() => closeCombobox());

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (event: PointerEvent) => {
      const target = event.target as Node;

      if (containerRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      // El fondo de la hoja cierra en su click: cerrar en el pointerdown dejaria que el
      // toque siguiera hacia lo que hay debajo.
      if (backdropRef.current?.contains(target)) return;

      closeFromOutside();
    };

    document.addEventListener("pointerdown", handleClickOutside);
    return () => document.removeEventListener("pointerdown", handleClickOutside);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const frameId = requestAnimationFrame(() => {
      // En la hoja no se enfoca el buscador: el teclado taparia media lista apenas abre.
      if (placement === "popover") searchInputRef.current?.focus();
      listRef.current
        ?.querySelector('[aria-selected="true"]')
        ?.scrollIntoView({ block: "center" });
    });
    return () => cancelAnimationFrame(frameId);
  }, [open, placement]);

  useEffect(() => {
    if (!open || placement !== "sheet") return;

    // Que la pagina de atras no se desplace mientras la hoja esta abierta.
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = previous;
    };
  }, [open, placement]);

  const disabledState = disabled || loading;

  const handleSelect = (option: ComboboxOption) => {
    onChange(option.value);
    if (reducedMotion || !isSheet) {
      closeCombobox();
      return;
    }
    if (selectTimerRef.current) window.clearTimeout(selectTimerRef.current);
    selectTimerRef.current = window.setTimeout(closeCombobox, SELECT_CLOSE_DELAY_MS);
  };

  const handleDragStart = (event: React.PointerEvent<HTMLDivElement>) => {
    // La X sigue funcionando como boton.
    if ((event.target as HTMLElement).closest("button")) return;
    dragStartRef.current = { y: event.clientY, t: event.timeStamp };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  };

  const handleDragMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = dragStartRef.current;
    if (!start) return;
    setDragY(Math.max(0, event.clientY - start.y));
  };

  const handleDragEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = dragStartRef.current;
    if (!start) return;
    dragStartRef.current = null;
    const distance = Math.max(0, event.clientY - start.y);
    const velocity = distance / Math.max(event.timeStamp - start.t, 1);
    setDragging(false);
    if (distance > DRAG_CLOSE_DISTANCE || velocity > DRAG_CLOSE_VELOCITY) {
      closeCombobox();
    } else {
      setDragY(0);
    }
  };

  const handleClear = (event: React.MouseEvent) => {
    event.stopPropagation();
    onChange("");
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlighted((prev) =>
        Math.min(prev + 1, Math.max(filtered.length - 1, 0)),
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlighted((prev) => Math.max(prev - 1, 0));
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const option = filtered[highlightedIndex];
      if (option) handleSelect(option);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      closeCombobox();
    }
  };

  const optionsCountLabel =
    filtered.length === 1 ? "1 opcion" : `${filtered.length} opciones`;
  const hasManyOptions = options.length > 8;
  const showSearch = !isSheet || options.length > SEARCH_MIN_OPTIONS;

  const searchBox = showSearch ? (
    <div
      className={cn(
        isSheet
          ? "px-4 pb-3"
          : "border-b border-(--border)/40 bg-surface-low px-3 py-2.5",
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2",
          isSheet && "h-11 rounded-lg bg-surface-low px-3",
        )}
      >
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <input
          ref={searchInputRef}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setHighlighted(0);
          }}
          onKeyDown={handleKeyDown}
          placeholder={searchPlaceholder}
          enterKeyHint="search"
          className={cn(
            "min-w-0 flex-1 border-0 bg-transparent text-base text-foreground placeholder:text-muted-foreground focus:outline-none sm:text-sm",
            isSheet ? "h-full" : compactOnMobile ? "h-8 sm:h-9" : "h-9",
          )}
        />
        {query ? (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-background/80 hover:text-foreground sm:size-6"
            aria-label="Limpiar busqueda"
          >
            <X className="size-3.5" />
          </button>
        ) : null}
      </div>
      {hasManyOptions && !isSheet ? (
        <div className="mt-1.5 flex items-center justify-between gap-3 px-0.5 text-[11px] text-muted-foreground">
          <span className="truncate">{optionsCountLabel}</span>
          {query ? <span className="truncate">Filtrando resultados</span> : null}
        </div>
      ) : null}
    </div>
  ) : null;

  const optionList =
    filtered.length === 0 ? (
      <div className="px-4 py-8 text-center text-sm text-muted-foreground">
        {loading ? loadingMessage : emptyMessage}
      </div>
    ) : (
      <ul
        ref={listRef}
        role="listbox"
        aria-labelledby={isSheet ? titleId : undefined}
        className={cn(
          "overflow-y-auto overscroll-contain",
          isSheet ? "min-h-0 flex-1 border-t border-border px-2 py-2" : "py-1.5",
          "[scrollbar-width:thin] [scrollbar-color:color-mix(in_oklch,var(--muted-foreground)_30%,transparent)_transparent]",
          "[&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/25 [&::-webkit-scrollbar-track]:bg-transparent",
        )}
        style={isSheet ? undefined : { maxHeight: frame.listMaxHeight }}
      >
        {filtered.map((option, index) => {
          const isSelected = option.value === value;
          const isHighlighted = index === highlightedIndex;

          return (
            <li
              key={option.value}
              role="option"
              aria-selected={isSelected}
              className={isSheet ? "combobox-option-in" : undefined}
              style={isSheet ? ({ "--i": Math.min(index, 12) } as CSSProperties) : undefined}
            >
              <button
                type="button"
                onMouseEnter={() => setHighlighted(index)}
                onClick={() => handleSelect(option)}
                className={cn(
                  "flex w-full items-center gap-3 text-left transition",
                  isSheet
                    ? "min-h-13 rounded-lg px-3 py-2.5 active:bg-surface-low"
                    : compactOnMobile
                      ? "px-3 py-2.5 sm:px-4"
                      : "px-3.5 py-2.5",
                  isHighlighted && !isSheet && "bg-primary/8",
                  isSelected && "bg-primary/12",
                )}
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span
                    className={cn(
                      "line-clamp-2 font-medium text-foreground",
                      isSheet ? "text-base leading-6" : "text-sm leading-5",
                    )}
                  >
                    {option.label}
                  </span>
                  {option.description ? (
                    <span
                      className={cn(
                        "line-clamp-2 text-xs leading-5 text-muted-foreground",
                        compactOnMobile && "sm:line-clamp-1",
                      )}
                    >
                      {option.description}
                    </span>
                  ) : null}
                </span>
                {isSelected ? (
                  <Check className="combobox-check-in size-5 shrink-0 text-primary" />
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    );

  const sheetTitle = title ?? placeholder;
  const sheetTransition =
    dragging || reducedMotion
      ? "none"
      : `transform ${entered ? SHEET_ENTER_MS : SHEET_EXIT_MS}ms ${SHEET_EASE}`;
  const backdropTransition =
    dragging || reducedMotion
      ? "none"
      : `opacity ${entered ? SHEET_ENTER_MS : SHEET_EXIT_MS}ms ease`;

  const dropdownPanel = !open ? null : isSheet ? (
    <>
      <div
        ref={backdropRef}
        aria-hidden
        className="fixed inset-0 z-60 bg-black/60"
        style={{
          // Se aclara a medida que la hoja baja con el dedo.
          opacity: entered ? Math.max(0.3, 1 - dragY / 450) : 0,
          transition: backdropTransition,
        }}
        onClick={closeCombobox}
      />
      <div
        ref={dropdownRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex flex-col overflow-hidden rounded-t-2xl bg-surface-lowest pb-[env(safe-area-inset-bottom)] shadow-(--shadow-airy-lg)"
        style={{
          ...frame.style,
          transform: entered ? `translateY(${dragY}px)` : "translateY(100%)",
          transition: sheetTransition,
          willChange: "transform",
        }}
      >
        {/* Barra y titulo: de ahi se arrastra la hoja hacia abajo para cerrarla. */}
        <div
          className="cursor-grab touch-none select-none active:cursor-grabbing"
          onPointerDown={handleDragStart}
          onPointerMove={handleDragMove}
          onPointerUp={handleDragEnd}
          onPointerCancel={handleDragEnd}
        >
          <div className="flex justify-center pt-2">
            <span className="h-1 w-10 rounded-sm bg-muted-foreground/25" />
          </div>
          <div className="flex items-center justify-between gap-3 py-1 pr-2 pl-4">
            <h2 id={titleId} className="min-w-0 truncate text-base font-semibold">
              {sheetTitle}
            </h2>
            <button
              type="button"
              onClick={closeCombobox}
              className="flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:text-foreground"
              aria-label="Cerrar"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>
        {searchBox}
        {optionList}
      </div>
    </>
  ) : (
    <div
      ref={dropdownRef}
      className="overflow-hidden rounded-xl bg-surface-lowest shadow-(--shadow-airy-lg) ring-1 ring-black/5"
      style={{
        ...frame.style,
        opacity: entered ? 1 : 0,
        transform: entered ? "none" : "translateY(-4px) scale(0.98)",
        transition: reducedMotion
          ? "none"
          : `opacity ${POPOVER_MS}ms ease, transform ${POPOVER_MS}ms ease`,
      }}
      role="dialog"
    >
      {searchBox}
      {optionList}
    </div>
  );

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      <button
        ref={triggerRef}
        type="button"
        id={triggerId}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabledState}
        onClick={() => {
          if (disabledState) return;
          if (open) {
            closeCombobox();
            return;
          }
          openCombobox();
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

      {dropdownPanel && typeof document !== "undefined"
        ? createPortal(dropdownPanel, document.body)
        : null}
    </div>
  );
}
