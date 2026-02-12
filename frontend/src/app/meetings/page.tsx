"use client";

import { CalendarDays } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useMeetings } from "@/hooks/useMeetings";

export default function MeetingsPage() {
  const { meetings, loading } = useMeetings();

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {meetings.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          Пока нет встреч. Используйте /summary в Telegram для парсинга Zoom
          Summary.
        </p>
      ) : (
        meetings.map((meeting) => (
          <Link key={meeting.id} href={`/meetings/${meeting.id}`}>
            <Card className="transition-colors hover:bg-accent cursor-pointer">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  {meeting.title || "Встреча без названия"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  {meeting.meeting_date && (
                    <span className="flex items-center gap-1">
                      <CalendarDays className="h-4 w-4" />
                      {new Date(meeting.meeting_date).toLocaleDateString(
                        "ru-RU"
                      )}
                    </span>
                  )}
                  {meeting.decisions && meeting.decisions.length > 0 && (
                    <span>
                      {meeting.decisions.length} решений
                    </span>
                  )}
                </div>
                {meeting.parsed_summary && (
                  <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                    {meeting.parsed_summary}
                  </p>
                )}
              </CardContent>
            </Card>
          </Link>
        ))
      )}
    </div>
  );
}
