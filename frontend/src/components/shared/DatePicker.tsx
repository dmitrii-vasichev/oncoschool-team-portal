"use client";

import * as React from "react";
import { format, parse, isValid } from "date-fns";
import { ru } from "date-fns/locale";
import { CalendarDays, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
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
  /** Enable year/month dropdowns with specified range [fromYear, toYear] */
  yearRange?: [number, number];
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Выбрать дату",
  clearable = false,
  className,
  inline = false,
  overdue = false,
  yearRange,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState("");

  const date = value
    ? parse(value, "yyyy-MM-dd", new Date())
    : undefined;

  const displayText = date
    ? format(date, "d MMM yyyy", { locale: ru })
    : null;

  // Sync input field when popover opens
  React.useEffect(() => {
    if (open) {
      setInputValue(date ? format(date, "dd.MM.yyyy") : "");
    }
  }, [open, date]);

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

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    let v = e.target.value;

    // Auto-insert dots: "01" -> "01.", "01.12" -> "01.12."
    const digits = v.replace(/\D/g, "");
    if (digits.length >= 2 && !v.includes(".")) {
      v = digits.slice(0, 2) + "." + digits.slice(2);
    } else if (digits.length >= 4 && v.split(".").length < 3) {
      v = digits.slice(0, 2) + "." + digits.slice(2, 4) + "." + digits.slice(4);
    }

    // Limit to DD.MM.YYYY
    if (v.replace(/\D/g, "").length > 8) return;
    setInputValue(v);
  }

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      tryApplyInput();
    }
  }

  function handleInputBlur() {
    tryApplyInput();
  }

  function tryApplyInput() {
    if (!inputValue.trim()) return;
    const parsed = parse(inputValue, "dd.MM.yyyy", new Date());
    if (isValid(parsed) && parsed.getFullYear() >= 1900 && parsed.getFullYear() <= 2100) {
      onChange(format(parsed, "yyyy-MM-dd"));
      setOpen(false);
    }
  }

  const calendarProps: React.ComponentProps<typeof Calendar> = {
    mode: "single" as const,
    selected: date,
    onSelect: handleSelect,
    defaultMonth: date,
  };

  if (yearRange) {
    calendarProps.captionLayout = "dropdown";
    calendarProps.startMonth = new Date(yearRange[0], 0);
    calendarProps.endMonth = new Date(yearRange[1], 11);
  }

  const calendarContent = (
    <div>
      <div className="px-3 pt-3 pb-1">
        <Input
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleInputKeyDown}
          onBlur={handleInputBlur}
          placeholder="ДД.ММ.ГГГГ"
          className="h-8 text-sm"
        />
      </div>
      <Calendar {...calendarProps} />
    </div>
  );

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
            {calendarContent}
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
        {calendarContent}
      </PopoverContent>
    </Popover>
  );
}
