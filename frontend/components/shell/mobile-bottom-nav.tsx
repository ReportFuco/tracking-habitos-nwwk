"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { NavItem } from "./nav-items";

interface MobileBottomNavProps {
  items: NavItem[];
  preferredOrder?: string[];
  className?: string;
}

export const userBottomNavOrder = [
  "/app/dashboard",
  "/app/finanzas",
  "/app/entrenamientos",
  "/app/nutricion",
  "/app/compras",
];

export function isItemActive(item: NavItem, pathname: string): boolean {
  if (item.exactMatch) return pathname === item.href;
  if (pathname === item.href) return true;
  const prefixes = [item.activePrefix ?? item.href].flat();
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(prefix + "/"));
}

/**
 * Items a mostrar, en orden. Con `preferredOrder` se filtra y ordena por esos href;
 * sin el, se respetan los items tal como llegan (asi el nav admin no queda vacio por
 * no coincidir con el orden por defecto de `/app/...`).
 */
export function resolveVisibleItems(items: NavItem[], preferredOrder?: string[]): NavItem[] {
  if (!preferredOrder) return items;
  return preferredOrder
    .map((href) => items.find((item) => item.href === href))
    .filter((item): item is NavItem => Boolean(item));
}

export function MobileBottomNav({ items, preferredOrder, className }: MobileBottomNavProps) {
  const pathname = usePathname() ?? "";
  const visibleItems = resolveVisibleItems(items, preferredOrder);
  const activeIndex = visibleItems.findIndex((item) => isItemActive(item, pathname));
  const indicatorWidth =
    visibleItems.length > 0 ? `${100 / visibleItems.length}%` : "0%";

  return (
    <nav
      aria-label="Navegacion principal"
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-(--border)/30 bg-background/96 px-2 pb-[calc(env(safe-area-inset-bottom)+0.55rem)] pt-2 sm:bg-background/88 sm:backdrop-blur-xl lg:hidden",
        className,
      )}
    >
      <div className="relative mx-auto max-w-md">
        {activeIndex >= 0 ? (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 rounded-3xl bg-surface-lowest shadow-(--shadow-airy) transition-transform duration-300 ease-out"
            style={{
              width: indicatorWidth,
              transform: `translateX(${activeIndex * 100}%)`,
            }}
          />
        ) : null}
        <ul
          className="relative grid items-end"
          style={{
            gridTemplateColumns: `repeat(${Math.max(visibleItems.length, 1)}, minmax(0, 1fr))`,
          }}
        >
          {visibleItems.map((item) => {
            const isActive = isItemActive(item, pathname);
            const Icon = item.icon;

            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "relative z-10 flex flex-col items-center justify-center gap-0.5 rounded-3xl px-1.5 py-1.5 text-[9px] font-medium tracking-[0.01em] transition-colors duration-300 ease-out",
                    isActive ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-8 items-center justify-center rounded-full transition-colors duration-300 ease-out",
                      isActive ? "bg-accent" : "bg-transparent",
                    )}
                    style={
                      item.moduleColor && isActive
                        ? { color: item.moduleColor }
                        : undefined
                    }
                  >
                    <Icon className="size-4" />
                  </span>
                  <span className="truncate">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
