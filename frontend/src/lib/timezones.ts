export const DEFAULT_TIMEZONE = "Europe/Moscow";

export const TIMEZONE_OPTIONS = [
  { value: "Europe/Moscow", label: "Москва (МСК)" },
  { value: "Europe/Kaliningrad", label: "Калининград (UTC+2)" },
  { value: "Europe/Samara", label: "Самара (UTC+4)" },
  { value: "Asia/Yekaterinburg", label: "Екатеринбург (UTC+5)" },
  { value: "Asia/Omsk", label: "Омск (UTC+6)" },
  { value: "Asia/Krasnoyarsk", label: "Красноярск (UTC+7)" },
  { value: "Asia/Irkutsk", label: "Иркутск (UTC+8)" },
  { value: "Asia/Yakutsk", label: "Якутск (UTC+9)" },
  { value: "Asia/Vladivostok", label: "Владивосток (UTC+10)" },
  { value: "Asia/Kamchatka", label: "Камчатка (UTC+12)" },
  { value: "Europe/London", label: "Лондон (GMT)" },
  { value: "Europe/Berlin", label: "Берлин (CET)" },
  { value: "America/New_York", label: "Нью-Йорк (EST)" },
  { value: "America/Chicago", label: "Чикаго (CST)" },
  { value: "America/Denver", label: "Денвер (MST)" },
  { value: "America/Los_Angeles", label: "Лос-Анджелес (PST)" },
  { value: "Asia/Dubai", label: "Дубай (UTC+4)" },
  { value: "Asia/Tokyo", label: "Токио (JST)" },
] as const;

export function getTimezoneShortLabel(timezone: string): string {
  const option = TIMEZONE_OPTIONS.find((item) => item.value === timezone);
  if (!option) {
    return timezone;
  }

  const match = option.label.match(/\((.+)\)/);
  return match ? match[1] : timezone;
}
