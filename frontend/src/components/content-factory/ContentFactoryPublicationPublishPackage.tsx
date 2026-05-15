"use client";

import { useMemo } from "react";
import { Clipboard, FileText, PackageCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/shared/Toast";
import { buildContentFactoryPublishPackage } from "@/lib/contentFactoryUtils";
import type {
  CFBundle,
  CFExternalSegment,
  CFFormat,
  CFPlatform,
  CFPublication,
  CFPublicationSegmentTarget,
} from "@/lib/types";

function PreviewBlock({ value }: { value: string }) {
  return (
    <pre className="max-h-52 overflow-auto whitespace-pre-wrap rounded-md bg-muted/25 px-3 py-2 text-sm leading-6 text-foreground">
      {value}
    </pre>
  );
}

export function ContentFactoryPublicationPublishPackage({
  publication,
  platform,
  format,
  bundle,
  segments,
  segmentTargets,
}: {
  publication: CFPublication;
  platform: CFPlatform | null;
  format: CFFormat | null;
  bundle: CFBundle | null;
  segments: CFExternalSegment[];
  segmentTargets: CFPublicationSegmentTarget[];
}) {
  const { toastSuccess, toastError } = useToast();
  const publishPackage = useMemo(
    () =>
      buildContentFactoryPublishPackage({
        publication,
        platform,
        format,
        bundle,
        segments,
        segmentTargets,
      }),
    [bundle, format, platform, publication, segmentTargets, segments],
  );

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(publishPackage.copyText);
      toastSuccess("Пакет скопирован");
    } catch {
      toastError("Не удалось скопировать пакет");
    }
  }

  return (
    <section className="rounded-lg border border-border/70 bg-card shadow-sm">
      <div className="flex flex-col gap-3 border-b border-border/60 px-4 py-3 md:flex-row md:items-start md:justify-between">
        <div className="flex min-w-0 items-start gap-2">
          <PackageCheck className="mt-0.5 h-4 w-4 text-muted-foreground" />
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">
              Пакет для публикации
            </h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Текст, медиа, аудитории и UTM для ручного переноса на площадку.
            </p>
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          className="h-8 shrink-0 gap-1.5 rounded-md px-3 text-xs"
          onClick={() => void handleCopy()}
        >
          <Clipboard className="h-3.5 w-3.5" />
          Скопировать пакет
        </Button>
      </div>

      <div className="space-y-4 px-4 py-4">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {publishPackage.rows.map((row) => (
            <div
              key={row.label}
              className="min-w-0 rounded-md border border-border/60 bg-muted/15 px-3 py-2"
            >
              <p className="text-xs uppercase text-muted-foreground">
                {row.label}
              </p>
              <p className="mt-1 break-words text-sm font-medium leading-5 text-foreground">
                {row.value}
              </p>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <FileText className="h-3.5 w-3.5 text-muted-foreground" />
            <h3 className="text-xs font-medium uppercase text-muted-foreground">
              Текст
            </h3>
          </div>
          <PreviewBlock value={publishPackage.bodyText} />
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <div className="space-y-2">
            <h3 className="text-xs font-medium uppercase text-muted-foreground">
              Медиа
            </h3>
            <PreviewBlock value={publishPackage.mediaText} />
          </div>
          <div className="space-y-2">
            <h3 className="text-xs font-medium uppercase text-muted-foreground">
              UTM
            </h3>
            <PreviewBlock value={publishPackage.utmText} />
          </div>
        </div>
      </div>
    </section>
  );
}
