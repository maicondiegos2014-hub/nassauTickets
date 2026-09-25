"use client";

import { type ReactElement, useState } from "react";

import { type MonthValue, MonthPicker } from "@/components/ui/month-picker";
import { PickerDialog } from "@/components/ui/picker-dialog";

export type MonthPickerDialogProps = {
  trigger: ReactElement;
  /** Mês atualmente escolhido no filtro. */
  selected: MonthValue;
  onApply: (value: MonthValue) => void;
  maxDate?: Date;
  title?: string;
  description?: string;
  className?: string;
};

/** Seleção de mês (grade de meses) dentro do dialog padrão. */
export default function MonthPickerDialog({
  trigger,
  selected,
  onApply,
  maxDate,
  title = "Selecionar mês",
  description,
  className,
}: MonthPickerDialogProps) {
  const [value, setValue] = useState<MonthValue>(selected);

  return (
    <PickerDialog
      trigger={trigger}
      title={title}
      description={description}
      className={className}
      onOpen={() => setValue(selected)}
      onApply={() => onApply(value)}
    >
      <MonthPicker
        selected={value}
        onSelect={setValue}
        maxDate={maxDate}
        className="rounded-lg border border-border p-2"
      />
    </PickerDialog>
  );
}
