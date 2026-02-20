"use client";

import { Cake } from "lucide-react";
import { UserAvatar } from "@/components/shared/UserAvatar";
import type { TeamMember } from "@/lib/types";

interface UpcomingBirthday {
  member: TeamMember;
  date: Date;
  daysUntil: number;
}

function getUpcomingBirthdays(
  members: TeamMember[],
  daysAhead: number = 30
): UpcomingBirthday[] {
  // Use Moscow date as "today" so all users see the same birthday list
  const mskParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const mskYear = Number(mskParts.find((p) => p.type === "year")!.value);
  const mskMonth = Number(mskParts.find((p) => p.type === "month")!.value) - 1;
  const mskDay = Number(mskParts.find((p) => p.type === "day")!.value);
  const today = new Date(mskYear, mskMonth, mskDay);
  const currentYear = mskYear;
  const results: UpcomingBirthday[] = [];

  for (const member of members) {
    if (!member.birthday || !member.is_active) continue;

    const [, monthStr, dayStr] = member.birthday.split("-");
    const month = parseInt(monthStr, 10) - 1;
    const day = parseInt(dayStr, 10);

    let nextBirthday = new Date(currentYear, month, day);
    if (nextBirthday < today) {
      nextBirthday = new Date(currentYear + 1, month, day);
    }

    const daysUntil = Math.round(
      (nextBirthday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysUntil <= daysAhead) {
      results.push({ member, date: nextBirthday, daysUntil });
    }
  }

  results.sort((a, b) => a.daysUntil - b.daysUntil);
  return results;
}

function daysLabel(n: number): string {
  if (n === 0) return "Сегодня! 🎉";
  if (n === 1) return "Завтра";

  const mod10 = n % 10;
  const mod100 = n % 100;
  let word: string;
  if (mod100 >= 11 && mod100 <= 19) {
    word = "дней";
  } else if (mod10 === 1) {
    word = "день";
  } else if (mod10 >= 2 && mod10 <= 4) {
    word = "дня";
  } else {
    word = "дней";
  }
  return `Через ${n} ${word}`;
}

function formatBirthdayDate(date: Date): string {
  return date.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

interface UpcomingBirthdaysProps {
  members: TeamMember[];
  onMemberClick?: (member: TeamMember) => void;
  className?: string;
}

export function UpcomingBirthdays({ members, onMemberClick, className }: UpcomingBirthdaysProps) {
  const upcoming = getUpcomingBirthdays(members);

  if (upcoming.length === 0) return null;

  return (
    <div className={`rounded-2xl border border-border/60 bg-card p-5 ${className ?? "animate-fade-in-up stagger-2"}`}>
      <div className="flex items-center gap-2 mb-4">
        <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
          <Cake className="h-4 w-4 text-amber-500" />
        </div>
        <h3 className="font-heading font-semibold text-sm">
          Ближайшие дни рождения
        </h3>
        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-xs font-medium text-muted-foreground">
          {upcoming.length}
        </span>
      </div>

      <div className="flex overflow-x-auto gap-3 pb-1 -mb-1">
        {upcoming.map(({ member, date, daysUntil }) => {
          const isToday = daysUntil === 0;
          return (
            <div
              key={member.id}
              onClick={onMemberClick ? () => onMemberClick(member) : undefined}
              className={`
                relative flex-shrink-0 min-w-[140px] max-w-[160px] rounded-xl border p-3
                text-center transition-all duration-200
                ${onMemberClick ? "cursor-pointer hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5" : ""}
                ${isToday
                  ? "ring-2 ring-amber-400/50 border-amber-300/50"
                  : "border-border/60"
                }
              `}
            >
              {isToday && (
                <div className="absolute inset-x-0 top-0 h-1 rounded-t-xl bg-gradient-to-r from-amber-400 to-pink-400" />
              )}

              <div className="flex justify-center mb-2">
                <UserAvatar
                  name={member.full_name}
                  avatarUrl={member.avatar_url}
                  size="lg"
                />
              </div>

              <p className="font-heading font-medium text-sm truncate">
                {member.full_name}
              </p>

              <p className="text-xs text-muted-foreground mt-0.5">
                {formatBirthdayDate(date)}
              </p>

              <p className={`text-xs mt-1 ${
                isToday
                  ? "font-semibold text-amber-600 dark:text-amber-400"
                  : "text-muted-foreground"
              }`}>
                {daysLabel(daysUntil)}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
