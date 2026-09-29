"use client";

import { faker } from "@faker-js/faker";
import { useState } from "react";
import type { DateRange } from "react-day-picker";

import { Button } from "@/components/ui/calendar-04-utils/button";
import { Calendar } from "@/components/ui/calendar-04-utils/calendar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/calendar-04-utils/dialog";

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

export default function CalendarRangeDialogDemo() {
  const [date, setDate] = useState<DateRange | undefined>({ from, to });

  return (
    <div className="flex items-center justify-center px-4">
      <Dialog defaultOpen>
        <DialogTrigger
          render={<Button variant="outline">Select Date Range</Button>}
        />
        <DialogContent className="max-w-fit!">
          <DialogHeader>
            <DialogTitle>Select Date Range</DialogTitle>
          </DialogHeader>
          <Calendar
            className="rounded-md border"
            mode="range"
            numberOfMonths={2}
            onSelect={setDate}
            selected={date}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
