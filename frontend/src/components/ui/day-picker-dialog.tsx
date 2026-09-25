"use client";

import { type ReactElement, useState } from "react";
import type { Locale } from "react-day-picker";

import { Calendar } from "@/components/ui/calendar";
import { PickerDialog } from "@/components/ui/picker-dialog";

export type DayPickerDialogProps = {
  trigger: ReactElement;
  /** Dia atualmente escolhido no filtro. */
  selected: Date;
  onApply: (date: Date) => void;
  /** Não permite escolher dias depois deste. */
  maxDate?: Date;
  locale?: Partial<Locale>;
  title?: string;
  description?: string;
  className?: string;
};

/** Seleção de um único dia com o calendário (ui/calendar) dentro do dialog padrão. */
export default function DayPickerDialog({
  trigger,
  selected,
  onApply,
  maxDate,
  locale,
  title = "Selecionar dia",
  description,
  className,
}: DayPickerDialogProps) {
  const [date, setDate] = useState<Date>(selected);

  return (
    <PickerDialog
      trigger={trigger}
      title={title}
      description={description}
      className={className}
      onOpen={() => setDate(selected)}
      onApply={() => onApply(date)}
    >
      <Calendar
        mode="single"
        required
        selected={date}
        onSelect={setDate}
        defaultMonth={date}
        locale={locale}
        disabled={maxDate ? { after: maxDate } : undefined}
        className="rounded-lg border border-border p-2"
      />
    </PickerDialog>
  );
}
