import { parseUTCDate } from "@/lib/dateUtils";

const MS_IN_DAY = 24 * 60 * 60 * 1000;
const UTC_TIME_RE = /^(\d{2}):(\d{2})(?::(\d{2}))?$/;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^(\d{2}):(\d{2})$/;

export const PROJECT_TIMEZONE = "Europe/Moscow";
export const PROJECT_TIMEZONE_LABEL = "MSK";
const LOCAL_TIME_LABEL = "местное";

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function getZonedDateTimeParts(date: Date, timeZone: string): ZonedParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    hourCycle: "h23",
  });

  const values: Partial<Record<keyof ZonedParts, number>> = {};

  for (const part of formatter.formatToParts(date)) {
    if (
      part.type === "year" ||
      part.type === "month" ||
      part.type === "day" ||
      part.type === "hour" ||
      part.type === "minute" ||
      part.type === "second"
    ) {
      values[part.type] = Number(part.value);
    }
  }

  return {
    year: values.year ?? 1970,
    month: values.month ?? 1,
    day: values.day ?? 1,
    hour: values.hour ?? 0,
    minute: values.minute ?? 0,
    second: values.second ?? 0,
  };
}

function getDayIndexInTimeZone(date: Date, timeZone: string): number {
  const parts = getZonedDateTimeParts(date, timeZone);
  return Math.floor(Date.UTC(parts.year, parts.month - 1, parts.day) / MS_IN_DAY);
}

function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const zoned = getZonedDateTimeParts(date, timeZone);
  const asUtc = Date.UTC(
    zoned.year,
    zoned.month - 1,
    zoned.day,
    zoned.hour,
    zoned.minute,
    zoned.second,
  );
  return asUtc - date.getTime();
}

function parseDateAndTimeParts(dateValue: string, timeValue: string) {
  const dateMatch = DATE_RE.exec(dateValue);
  const timeMatch = TIME_RE.exec(timeValue);

  if (!dateMatch || !timeMatch) {
    throw new Error("Неверный формат даты или времени");
  }

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);

  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    throw new Error("Дата или время вне допустимого диапазона");
  }

  return { year, month, day, hour, minute };
}

function parseUtcClock(timeUtc: string): { hour: number; minute: number; second: number } {
  const match = UTC_TIME_RE.exec(timeUtc);
  if (!match) {
    throw new Error("Неверный формат UTC времени");
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = match[3] ? Number(match[3]) : 0;

  if (hour > 23 || minute > 59 || second > 59) {
    throw new Error("UTC время вне допустимого диапазона");
  }

  return { hour, minute, second };
}

function capitalize(text: string): string {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

export function getBrowserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || PROJECT_TIMEZONE;
  } catch {
    return PROJECT_TIMEZONE;
  }
}

export function formatTimeInZone(date: Date, timeZone: string): string {
  return date.toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  });
}

function isBrowserInMsk(): boolean {
  return getBrowserTimeZone() === PROJECT_TIMEZONE;
}

export function formatMoscowTimeWithLocal(dateInput: string | Date): string {
  const date = typeof dateInput === "string" ? parseUTCDate(dateInput) : dateInput;
  const moscowTime = formatTimeInZone(date, PROJECT_TIMEZONE);

  if (isBrowserInMsk()) {
    return `${moscowTime} ${PROJECT_TIMEZONE_LABEL}`;
  }

  const localTz = getBrowserTimeZone();
  const localTime = formatTimeInZone(date, localTz);
  const moscowDay = getDayIndexInTimeZone(date, PROJECT_TIMEZONE);
  const localDay = getDayIndexInTimeZone(date, localTz);

  if (moscowDay !== localDay) {
    const localDateStr = date.toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "short",
      timeZone: localTz,
    });
    return `${moscowTime} ${PROJECT_TIMEZONE_LABEL} (${localTime} ${localDateStr}, ${LOCAL_TIME_LABEL})`;
  }

  return `${moscowTime} ${PROJECT_TIMEZONE_LABEL} (${localTime} ${LOCAL_TIME_LABEL})`;
}

export function formatMeetingListDateTime(dateInput: string): string {
  const date = parseUTCDate(dateInput);
  const now = new Date();
  const dayDiff =
    getDayIndexInTimeZone(date, PROJECT_TIMEZONE) -
    getDayIndexInTimeZone(now, PROJECT_TIMEZONE);

  const nowMoscowYear = getZonedDateTimeParts(now, PROJECT_TIMEZONE).year;
  const dateMoscowYear = getZonedDateTimeParts(date, PROJECT_TIMEZONE).year;

  const dateText = date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: nowMoscowYear !== dateMoscowYear ? "numeric" : undefined,
    timeZone: PROJECT_TIMEZONE,
  });

  const timeText = formatMoscowTimeWithLocal(date);

  if (dayDiff === 0) return `Сегодня, ${timeText}`;
  if (dayDiff === 1) return `Завтра, ${timeText}`;
  if (dayDiff === -1) return `Вчера, ${timeText}`;
  return `${dateText}, ${timeText}`;
}

export function formatMeetingHeaderDateTime(dateInput: string): string {
  const date = parseUTCDate(dateInput);
  const weekday = capitalize(
    date.toLocaleDateString("ru-RU", {
      weekday: "long",
      timeZone: PROJECT_TIMEZONE,
    }),
  );
  const day = date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: PROJECT_TIMEZONE,
  });

  return `${weekday}, ${day} · ${formatMoscowTimeWithLocal(date)}`;
}

export function formatUtcClockForSchedule(timeUtc: string): {
  moscow: string;
  local: string | null;
} {
  try {
    const { hour, minute, second } = parseUtcClock(timeUtc);
    const utcDate = new Date(Date.UTC(2024, 0, 1, hour, minute, second));
    const moscowTime = formatTimeInZone(utcDate, PROJECT_TIMEZONE);

    if (isBrowserInMsk()) {
      return {
        moscow: `${moscowTime} ${PROJECT_TIMEZONE_LABEL}`,
        local: null,
      };
    }

    const localTz = getBrowserTimeZone();
    const localTime = formatTimeInZone(utcDate, localTz);
    const moscowDay = getDayIndexInTimeZone(utcDate, PROJECT_TIMEZONE);
    const localDay = getDayIndexInTimeZone(utcDate, localTz);

    let localLabel: string;
    if (moscowDay !== localDay) {
      const localWeekday = utcDate.toLocaleDateString("ru-RU", {
        weekday: "short",
        timeZone: localTz,
      });
      localLabel = `${localTime} ${localWeekday}, ${LOCAL_TIME_LABEL}`;
    } else {
      localLabel = `${localTime} ${LOCAL_TIME_LABEL}`;
    }

    return {
      moscow: `${moscowTime} ${PROJECT_TIMEZONE_LABEL}`,
      local: localLabel,
    };
  } catch {
    const fallback = timeUtc.slice(0, 5);
    return {
      moscow: `${fallback} ${PROJECT_TIMEZONE_LABEL}`,
      local: null,
    };
  }
}

export function formatUtcClockAsMoscowWithLocal(timeUtc: string): string {
  const { moscow, local } = formatUtcClockForSchedule(timeUtc);
  return local ? `${moscow} (${local})` : moscow;
}

export function utcTimeToMsk(timeUtc: string): string {
  try {
    const [h, m] = timeUtc.split(":").map(Number);
    const utcDate = new Date(Date.UTC(2024, 0, 1, h, m));
    return formatTimeInZone(utcDate, PROJECT_TIMEZONE);
  } catch {
    return timeUtc.slice(0, 5);
  }
}

export function zonedDateTimeToUtcIso(
  dateValue: string,
  timeValue: string,
  timeZone: string = PROJECT_TIMEZONE,
): string {
  const { year, month, day, hour, minute } = parseDateAndTimeParts(dateValue, timeValue);
  const localAsUtcMs = Date.UTC(year, month - 1, day, hour, minute, 0);
  const initialOffsetMs = getTimeZoneOffsetMs(new Date(localAsUtcMs), timeZone);
  let utcMs = localAsUtcMs - initialOffsetMs;

  // One re-check handles timezone transitions around midnight/DST boundaries.
  const correctedOffsetMs = getTimeZoneOffsetMs(new Date(utcMs), timeZone);
  if (correctedOffsetMs !== initialOffsetMs) {
    utcMs = localAsUtcMs - correctedOffsetMs;
  }

  return new Date(utcMs).toISOString();
}
