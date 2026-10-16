"use client";

import {
  CSSProperties,
  KeyboardEvent,
  RefObject,
  useEffect,
  useEffectEvent,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Check, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PickerOption {
  value: string;
  label: string;
  description?: string | null;
}

interface OptionPickerProps {
  open: boolean;
  /** El picker pide cerrarse (fondo, X, arrastre, Escape o al elegir); el padre baja `open`. */
  onClose: () => void;
  /** Elemento que lo abre: ancla el desplegable y no cuenta como "tocar afuera". */
  anchorRef: RefObject<HTMLElement | null>;
  options: PickerOption[];
  value: string;
  onSelect: (value: string) => void;
  /** Titulo de la hoja en movil. */
  title: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  loading?: boolean;
  loadingMessage?: string;
  compactOnMobile?: boolean;
  /** Ancho minimo del desplegable de escritorio, para anclas angostas como un filtro. */
  minPopoverWidth?: number;
  /** Etiquetas en minuscula guardadas tal cual (categorias): se muestran capitalizadas. */
  capitalize?: boolean;
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

/**
 * Marca del panel y su fondo. Un dialogo que contenga un selector la usa para no cerrarse
 * cuando se toca la hoja, que vive en un portal fuera de el (ver ejercicio-form-dialog).
 */
export const OPTION_PICKER_ATTR = "data-option-picker";

export const isInsideOptionPicker = (target: EventTarget | null) =>
  target instanceof Element && Boolean(target.closest(`[${OPTION_PICKER_ATTR}]`));

const prefersReducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Lista de opciones con buscador: hoja inferior animada en movil (se arrastra para cerrar y
 * se apoya sobre el teclado) y desplegable anclado en escritorio. No trae disparador: lo
 * usan el SearchableCombobox, el "Mas..." de ChipSelect y los filtros de listas.
 */
export function OptionPicker({
  open,
  onClose,
  anchorRef,
  options,
  value,
  onSelect,
  title,
  searchPlaceholder = "Buscar...",
  emptyMessage = "Sin resultados",
  loading = false,
  loadingMessage = "Cargando...",
  compactOnMobile = false,
  minPopoverWidth = 0,
  capitalize = false,
}: OptionPickerProps) {
  const titleId = useId();
  // `mounted` mantiene el panel en pantalla mientras anima la salida; `entered` lo lleva a
  // su lugar un par de cuadros despues de montarse.
  const [mounted, setMounted] = useState(false);
  const [entered, setEntered] = useState(false);
  const [placement, setPlacement] = useState<Placement>("popover");
  const [reducedMotion, setReducedMotion] = useState(false);
  const [query, setQuery] = useState("");
  const [highlighted, setHighlighted] = useState(0);
  const [frame, setFrame] = useState<PanelFrame>({ style: {} });
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragStartRef = useRef<{ y: number; t: number } | null>(null);
  const selectTimerRef = useRef<number | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Al abrir se decide el formato y desde donde parte la seleccion (ajuste en render, sin
  // un cuadro intermedio con el estado viejo).
  if (open && !mounted) {
    setMounted(true);
    setEntered(false);
    setDragY(0);
    setQuery("");
    setReducedMotion(prefersReducedMotion());
    setPlacement(window.innerWidth < SHEET_MAX_WIDTH ? "sheet" : "popover");
    setHighlighted(Math.max(options.findIndex((option) => option.value === value), 0));
  }

  const isSheet = placement === "sheet";
  const shown = open && entered;

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("es");
    if (!normalized) return options;
    return options.filter((option) =>
      `${option.label} ${option.description ?? ""}`.toLocaleLowerCase("es").includes(normalized),
    );
  }, [options, query]);
  const highlightedIndex = Math.min(highlighted, Math.max(filtered.length - 1, 0));

  useEffect(() => {
    if (!open || !mounted) return;
    // Dos cuadros: el panel se pinta primero en su posicion de salida y despues anima.
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setEntered(true));
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [open, mounted]);

  useEffect(() => {
    if (open || !mounted) return;
    const exitMs = reducedMotion ? 0 : isSheet ? SHEET_EXIT_MS : POPOVER_MS;
    const timer = window.setTimeout(() => {
      setMounted(false);
      setEntered(false);
      setDragging(false);
      setDragY(0);
    }, exitMs);
    return () => window.clearTimeout(timer);
  }, [open, mounted, reducedMotion, isSheet]);

  useEffect(
    () => () => {
      if (selectTimerRef.current) window.clearTimeout(selectTimerRef.current);
    },
    [],
  );

  // Layout effect: el panel se posiciona antes de pintarse, sin un cuadro en el lugar viejo.
  useLayoutEffect(() => {
    if (!mounted) return;

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

      const anchor = anchorRef.current;
      if (!anchor) return;

      const rect = anchor.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const horizontalMargin = 12;
      const verticalMargin = 12;
      const gap = 8;
      const minListHeight = 96;

      const width = Math.min(Math.max(rect.width, minPopoverWidth), viewportWidth - horizontalMargin * 2);
      const maxLeft = viewportWidth - horizontalMargin - width;
      const left = Math.min(Math.max(rect.left, horizontalMargin), maxLeft);

      const spaceBelow = viewportHeight - rect.bottom - gap - verticalMargin;
      const spaceAbove = rect.top - gap - verticalMargin;
      const openAbove = spaceBelow < 220 && spaceAbove > spaceBelow;
      const availableSpace = Math.max(openAbove ? spaceAbove : spaceBelow, minListHeight);

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
  }, [anchorRef, compactOnMobile, minPopoverWidth, mounted, placement]);

  const closeFromOutside = useEffectEvent(() => onClose());

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (event: PointerEvent) => {
      const target = event.target as Node;

      if (anchorRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      // El fondo de la hoja cierra en su click: cerrar en el pointerdown dejaria que el
      // toque siguiera hacia lo que hay debajo.
      if (backdropRef.current?.contains(target)) return;

      closeFromOutside();
    };

    document.addEventListener("pointerdown", handleClickOutside);
    return () => document.removeEventListener("pointerdown", handleClickOutside);
  }, [anchorRef, open]);

  useEffect(() => {
    if (!open || !mounted) return;

    const frameId = requestAnimationFrame(() => {
      // En la hoja no se enfoca el buscador: el teclado taparia media lista apenas abre.
      if (placement === "popover") searchInputRef.current?.focus();
      listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "center" });
    });
    return () => cancelAnimationFrame(frameId);
  }, [mounted, open, placement]);

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

  const handleSelect = (option: PickerOption) => {
    onSelect(option.value);
    if (reducedMotion || !isSheet) {
      onClose();
      return;
    }
    if (selectTimerRef.current) window.clearTimeout(selectTimerRef.current);
    selectTimerRef.current = window.setTimeout(onClose, SELECT_CLOSE_DELAY_MS);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlighted((prev) => Math.min(prev + 1, Math.max(filtered.length - 1, 0)));
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
      onClose();
    }
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
      onClose();
    } else {
      setDragY(0);
    }
  };

  if (!mounted || typeof document === "undefined") return null;

  const hasManyOptions = options.length > 8;
  const showSearch = !isSheet || options.length > SEARCH_MIN_OPTIONS;
  const optionsCountLabel = filtered.length === 1 ? "1 opcion" : `${filtered.length} opciones`;

  const searchBox = showSearch ? (
    <div className={cn(isSheet ? "px-4 pb-3" : "border-b border-(--border)/40 bg-surface-low px-3 py-2.5")}>
      <div className={cn("flex items-center gap-2", isSheet && "h-11 rounded-lg bg-surface-low px-3")}>
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
                      capitalize && "capitalize",
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
                {isSelected ? <Check className="combobox-check-in size-5 shrink-0 text-primary" /> : null}
              </button>
            </li>
          );
        })}
      </ul>
    );

  const enterOrExitMs = shown ? SHEET_ENTER_MS : SHEET_EXIT_MS;
  const sheetTransition =
    dragging || reducedMotion ? "none" : `transform ${enterOrExitMs}ms ${SHEET_EASE}`;
  const backdropTransition = dragging || reducedMotion ? "none" : `opacity ${enterOrExitMs}ms ease`;

  const panel = isSheet ? (
    <>
      <div
        ref={backdropRef}
        aria-hidden
        {...{ [OPTION_PICKER_ATTR]: "" }}
        className="fixed inset-0 z-60 bg-black/60"
        style={{
          // Se aclara a medida que la hoja baja con el dedo.
          opacity: shown ? Math.max(0.3, 1 - dragY / 450) : 0,
          transition: backdropTransition,
          pointerEvents: open ? "auto" : "none",
        }}
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        {...{ [OPTION_PICKER_ATTR]: "" }}
        className="flex flex-col overflow-hidden rounded-t-2xl bg-surface-lowest pb-[env(safe-area-inset-bottom)] shadow-(--shadow-airy-lg)"
        style={{
          ...frame.style,
          transform: shown ? `translateY(${dragY}px)` : "translateY(100%)",
          transition: sheetTransition,
          willChange: "transform",
          pointerEvents: open ? "auto" : "none",
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
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
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
      ref={panelRef}
      role="dialog"
      aria-label={title}
      {...{ [OPTION_PICKER_ATTR]: "" }}
      className="overflow-hidden rounded-xl bg-surface-lowest shadow-(--shadow-airy-lg) ring-1 ring-black/5"
      style={{
        ...frame.style,
        opacity: shown ? 1 : 0,
        transform: shown ? "none" : "translateY(-4px) scale(0.98)",
        transition: reducedMotion ? "none" : `opacity ${POPOVER_MS}ms ease, transform ${POPOVER_MS}ms ease`,
        pointerEvents: open ? "auto" : "none",
      }}
    >
      {searchBox}
      {optionList}
    </div>
  );

  return createPortal(panel, document.body);
}
