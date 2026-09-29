"use client";

import { faker } from "@faker-js/faker";
import { type ReactElement, useState } from "react";
import type { DateRange, Locale } from "react-day-picker";

import { Button } from "@/components/ui/calendar-04-utils/button";
import { Calendar } from "@/components/ui/calendar-04-utils/calendar";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/calendar-04-utils/dialog";

export const title = "Calendar with Range in Dialog";

const now = new Date();
const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

const from = faker.date.between({
  from: startOfMonth,
  to: new Date(now.getFullYear(), now.getMonth(), 15),
});
const to = faker.date.between({
  from: new Date(now.getFullYear(), now.getMonth(), 16),
  to: endOfMonth,
});

export type CalendarDialogProps = {
  /** Elemento que abre o dialog. Padrão: botão "Select Date Range". */
  trigger?: ReactElement;
  /** Intervalo inicial. Padrão: intervalo aleatório no mês atual (faker), como no original. */
  selected?: DateRange;
  /** Quando informado, mostra os botões de confirmação e devolve o intervalo escolhido. */
  onApply?: (range: DateRange) => void;
  dialogTitle?: string;
  description?: string;
  applyLabel?: string;
  cancelLabel?: string;
  locale?: Partial<Locale>;
  /** Não permite escolher datas depois desta. */
  maxDate?: Date;
  /** Classes do contêiner. Padrão: centralizado, como no original. */
  className?: string;
};

export default function CalendarDialog({
  trigger,
  selected,
  onApply,
  dialogTitle = "Select Date Range",
  description,
  applyLabel = "Apply",
  cancelLabel = "Cancel",
  locale,
  maxDate,
  className = "flex items-center justify-center px-4",
}: CalendarDialogProps = {}) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState<DateRange | undefined>(
    selected ?? { from, to },
  );

  function handleOpenChange(next: boolean) {
    // Ao reabrir, parte sempre do intervalo atual do filtro.
    if (next && selected) setDate(selected);
    setOpen(next);
  }

  function apply() {
    if (!date?.from) return;
    onApply?.({ from: date.from, to: date.to ?? date.from });
    setOpen(false);
  }

  return (
    <div className={className}>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger
          render={
            trigger ?? <Button variant="outline">Select Date Range</Button>
          }
        />
        <DialogContent className="max-w-fit!">
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          <Calendar
            className="rounded-md border"
            mode="range"
            numberOfMonths={2}
            onSelect={setDate}
            selected={date}
            // No modo integrado, o 1º clique depois de um intervalo completo inicia um novo intervalo.
            resetOnSelect={Boolean(onApply)}
            defaultMonth={date?.from}
            locale={locale}
            disabled={maxDate ? { after: maxDate } : undefined}
          />
          {onApply && (
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>
                {cancelLabel}
              </DialogClose>
              <Button onClick={apply} disabled={!date?.from}>
                {applyLabel}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
