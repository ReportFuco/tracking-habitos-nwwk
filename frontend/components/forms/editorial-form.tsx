"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function FormPanel({
  eyebrow,
  title,
  description,
  aside,
  children,
  accent = "primary",
}: {
  eyebrow?: string;
  title?: string;
  description?: string;
  aside?: ReactNode;
  children: ReactNode;
  accent?: "primary" | "tertiary";
}) {
  const accentClass =
    accent === "tertiary"
      ? "from-tertiary/12 via-tertiary/6 to-transparent"
      : "from-primary/12 via-primary/6 to-transparent";
  const accentColor =
    accent === "tertiary" ? "var(--module-entrenamientos)" : "var(--primary)";

  const hasFullHeader = Boolean(title || description);
  const showCompactEyebrow = !hasFullHeader && Boolean(eyebrow);

  return (
    <section className="rounded-[1.5rem] bg-surface-lowest shadow-(--shadow-airy-lg) sm:rounded-[1.75rem]">
      {hasFullHeader ? (
        <div
          className={cn(
            "rounded-t-[1.5rem] bg-linear-to-br px-4 py-5 sm:rounded-t-[1.75rem] sm:px-8 sm:py-6",
            accentClass,
          )}
        >
          <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr] lg:items-start lg:gap-6">
            <div className="space-y-2 sm:space-y-3">
              {eyebrow ? (
                <p className="font-label text-[0.65rem] uppercase tracking-[0.22em] text-muted-foreground sm:text-[0.72rem] sm:tracking-[0.24em]">
                  {eyebrow}
                </p>
              ) : null}
              {title ? (
                <h2 className="text-xl font-semibold tracking-[-0.02em] text-foreground sm:text-3xl sm:tracking-[-0.03em]">
                  {title}
                </h2>
              ) : null}
              {description ? (
                <p className="max-w-xl text-sm leading-6 text-muted-foreground">
                  {description}
                </p>
              ) : null}
            </div>
            {aside ? (
              <div className="hidden rounded-[1.5rem] bg-white/70 p-5 backdrop-blur-sm lg:block">
                {aside}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <div
        className={cn(
          "px-4 py-5 sm:px-8 sm:py-7",
          showCompactEyebrow || aside ? "pt-4 sm:pt-6" : null,
        )}
      >
        {showCompactEyebrow || aside ? (
          <div className="mb-5 flex items-center justify-between gap-3 sm:mb-6">
            {showCompactEyebrow ? (
              <span className="inline-flex items-center gap-1.5 font-label text-[0.62rem] uppercase tracking-[0.2em] text-muted-foreground sm:text-[0.68rem] sm:tracking-[0.22em]">
                <span
                  aria-hidden
                  className="size-1.5 rounded-full"
                  style={{ background: accentColor }}
                />
                {eyebrow}
              </span>
            ) : (
              <span />
            )}
            {aside ? <div className="hidden lg:block">{aside}</div> : null}
          </div>
        ) : null}

        {children}
      </div>
    </section>
  );
}

export function FieldGroup({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2 sm:space-y-2.5">
      <div className="flex items-center justify-between gap-3">
        <label className="font-label text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground sm:text-[11px] sm:tracking-[0.24em]">
          {label}
        </label>
        {hint ? (
          <span className="text-[11px] text-muted-foreground sm:text-xs">
            {hint}
          </span>
        ) : null}
      </div>
      {children}
    </div>
  );
}

export function EditorialInput({
  className,
  ...props
}: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "h-13 w-full rounded-3xl border-0 bg-surface-variant px-4 text-base text-foreground shadow-none outline-none transition placeholder:text-muted-foreground focus:border-b-2 focus:border-primary disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm",
        className,
      )}
      {...props}
    />
  );
}

export function EditorialSelect({
  className,
  ...props
}: React.ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "h-13 w-full rounded-3xl border-0 bg-surface-variant px-4 text-sm text-foreground shadow-none outline-none transition focus:border-b-2 focus:border-primary",
        className,
      )}
      {...props}
    />
  );
}

export function FormNote({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[1.5rem] bg-surface-low p-4">
      <p className="text-sm leading-6 text-muted-foreground">{children}</p>
    </div>
  );
}

export function FormSubmitBar({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "sticky bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] z-10 -mx-4 mt-5 border-t border-(--border)/25 px-4 py-3 backdrop-blur-md sm:-mx-8 sm:px-8 sm:py-4 lg:static lg:bottom-auto lg:mx-0 lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none",
        className,
      )}
    >
      {children}
    </div>
  );
}
