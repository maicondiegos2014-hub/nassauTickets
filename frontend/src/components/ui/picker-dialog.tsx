"use client";

import { type ReactElement, type ReactNode, useState } from "react";

import { Button } from "@/components/ui/button";
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

export type PickerDialogProps = {
  /** Elemento que abre o dialog. */
  trigger: ReactElement;
  title: string;
  description?: string;
  /** Chamado ao abrir, para o seletor partir do valor atual. */
  onOpen?: () => void;
  /** Chamado em "Aplicar"; o dialog fecha em seguida. */
  onApply: () => void;
  canApply?: boolean;
  applyLabel?: string;
  cancelLabel?: string;
  className?: string;
  children: ReactNode;
};

/** Dialog de seleção com o mesmo visual do calendar-04 (título, conteúdo e rodapé Cancelar/Aplicar). */
export function PickerDialog({
  trigger,
  title,
  description,
  onOpen,
  onApply,
  canApply = true,
  applyLabel = "Aplicar",
  cancelLabel = "Cancelar",
  className,
  children,
}: PickerDialogProps) {
  const [open, setOpen] = useState(false);

  function handleOpenChange(next: boolean) {
    if (next) onOpen?.();
    setOpen(next);
  }

  function apply() {
    onApply();
    setOpen(false);
  }

  return (
    <div className={className}>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger render={trigger} />
        <DialogContent className="max-w-fit!">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          {children}
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>{cancelLabel}</DialogClose>
            <Button onClick={apply} disabled={!canApply}>
              {applyLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
