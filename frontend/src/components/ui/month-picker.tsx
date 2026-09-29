"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { type KeyboardEvent, useRef, useState } from "react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Mês escolhido; `month` vai de 0 (janeiro) a 11 (dezembro). */
export type MonthValue = { year: number; month: number };

export type MonthPickerProps = {
  selected?: MonthValue;
  onSelect: (value: MonthValue) => void;
  /** Meses depois desta data ficam desabilitados. */
  maxDate?: Date;
  /** Código de idioma para os nomes dos meses. */
  localeCode?: string;
  previousYearLabel?: string;
  nextYearLabel?: string;
  className?: string;
};

const MONTHS = Array.from({ length: 12 }, (_, i) => i);

// Mesmas classes do calendário (ui/calendar) para manter o visual idêntico.
const navButton = cn(
  buttonVariants({ variant: "ghost" }),
  "size-9 text-muted-foreground/80 hover:text-foreground p-0",
);
const monthButton =
  "relative flex h-9 w-20 items-center justify-center whitespace-nowrap rounded-lg p-0 text-sm text-foreground outline-offset-2 [transition-property:color,background-color,border-radius,box-shadow] duration-150 focus:outline-none focus-visible:z-10 hover:bg-accent hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring/70 disabled:pointer-events-none disabled:text-foreground/30 disabled:line-through";
const selectedMonth = "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground";
const currentMonthDot =
  "after:pointer-events-none after:absolute after:bottom-1 after:start-1/2 after:z-10 after:size-[3px] after:-translate-x-1/2 after:rounded-full after:bg-primary after:transition-colors";

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Grade de meses no estilo do calendário, com navegação por ano. */
export function MonthPicker({
  selected,
  onSelect,
  maxDate,
  localeCode = "pt-BR",
  previousYearLabel = "Ir para o ano anterior",
  nextYearLabel = "Ir para o próximo ano",
  className,
}: MonthPickerProps) {
  const today = new Date();
  const [year, setYear] = useState(selected?.year ?? today.getFullYear());
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  const shortName = new Intl.DateTimeFormat(localeCode, { month: "short" });
  const longName = new Intl.DateTimeFormat(localeCode, { month: "long", year: "numeric" });

  const isDisabled = (month: number) =>
    maxDate !== undefined &&
    (year > maxDate.getFullYear() || (year === maxDate.getFullYear() && month > maxDate.getMonth()));
  const canGoNext = maxDate === undefined || year < maxDate.getFullYear();

  // Setas movem o foco entre os meses (←/→ um mês, ↑/↓ uma linha), como na grade de dias.
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -3, ArrowDown: 3 }[event.key];
    if (step === undefined) return;
    const current = buttons.current.indexOf(document.activeElement as HTMLButtonElement);
    if (current < 0) return;
    event.preventDefault();
    for (let next = current + step; next >= 0 && next < 12; next += step) {
      if (!isDisabled(next)) {
        buttons.current[next]?.focus();
        return;
      }
    }
  }

  return (
    <div className={cn("w-fit", className)}>
      <div className="relative mb-1 flex h-9 items-center justify-center">
        <div className="absolute top-0 z-10 flex w-full justify-between">
          <button type="button" className={navButton} aria-label={previousYearLabel} onClick={() => setYear(year - 1)}>
            <ChevronLeft size={16} strokeWidth={2} aria-hidden="true" />
          </button>
          <button
            type="button"
            className={navButton}
            aria-label={nextYearLabel}
            onClick={() => setYear(year + 1)}
            disabled={!canGoNext}
          >
            <ChevronRight size={16} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
        <span className="relative z-20 text-sm font-medium" aria-live="polite">
          {year}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-1 pt-1" role="group" aria-label={String(year)} onKeyDown={handleKeyDown}>
        {MONTHS.map((month) => {
          const date = new Date(year, month, 1);
          const isSelected = selected?.year === year && selected.month === month;
          const isCurrent = today.getFullYear() === year && today.getMonth() === month;
          return (
            <button
              key={month}
              ref={(el) => {
                buttons.current[month] = el;
              }}
              type="button"
              className={cn(
                monthButton,
                isSelected && selectedMonth,
                isCurrent && currentMonthDot,
                isCurrent && isSelected && "after:bg-background",
              )}
              aria-label={longName.format(date)}
              aria-pressed={isSelected}
              disabled={isDisabled(month)}
              onClick={() => onSelect({ year, month })}
            >
              {capitalize(shortName.format(date).replace(".", ""))}
            </button>
          );
        })}
      </div>
    </div>
  );
}
