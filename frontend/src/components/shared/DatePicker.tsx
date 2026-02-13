"use client";

import * as React from "react";
import { format, parse } from "date-fns";
import { ru } from "date-fns/locale";
import { CalendarDays, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DatePickerProps {
  /** Date value as YYYY-MM-DD string or empty string */
  value: string;
  /** Called with YYYY-MM-DD string or empty string when cleared */
  onChange: (value: string) => void;
  /** Placeholder when no date is selected */
  placeholder?: string;
  /** Show clear button */
  clearable?: boolean;
  /** Additional class for the trigger button */
  className?: string;
  /** Compact inline style (for meta grids) */
  inline?: boolean;
  /** Highlight as overdue */
  overdue?: boolean;
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Выбрать дату",
  clearable = false,
  className,
  inline = false,
  overdue = false,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);

  const date = value
    ? parse(value, "yyyy-MM-dd", new Date())
    : undefined;

  const displayText = date
    ? format(date, "d MMM yyyy", { locale: ru })
    : null;

  function handleSelect(day: Date | undefined) {
    if (day) {
      onChange(format(day, "yyyy-MM-dd"));
    }
    setOpen(false);
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange("");
  }

  if (inline) {
    return (
      <div className="flex items-center gap-1.5">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              className={cn(
                "text-sm font-medium border-b border-dashed border-border/60 hover:border-foreground/40 focus:border-foreground focus:outline-none cursor-pointer px-0 py-0.5 text-left",
                !displayText && "text-muted-foreground",
                overdue && "text-destructive",
                className
              )}
            >
              {displayText || placeholder}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={date}
              onSelect={handleSelect}
              defaultMonth={date}
              autoFocus
            />
          </PopoverContent>
        </Popover>
        {clearable && value && (
          <button
            onClick={handleClear}
            className="text-muted-foreground hover:text-destructive"
            title="Снять дату"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "justify-start text-left font-normal",
            !displayText && "text-muted-foreground",
            overdue && "text-destructive border-destructive/40",
            className
          )}
        >
          <CalendarDays className="h-4 w-4 opacity-60" />
          {displayText || placeholder}
          {clearable && value && (
            <span
              role="button"
              onClick={handleClear}
              className="ml-auto text-muted-foreground hover:text-destructive"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={handleSelect}
          defaultMonth={date}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}
