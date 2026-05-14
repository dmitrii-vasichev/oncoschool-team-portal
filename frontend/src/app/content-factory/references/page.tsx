"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, RefreshCw, Settings2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/shared/Toast";
import { ContentFactoryReferenceDialog } from "@/components/content-factory/ContentFactoryReferenceDialog";
import {
  ContentFactoryReferenceTable,
  type ContentFactoryReferenceRecord,
} from "@/components/content-factory/ContentFactoryReferenceTable";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { api } from "@/lib/api";
import {
  CF_REFERENCE_TABLE_LABELS,
  getContentFactoryReferenceLabel,
  summarizeContentFactoryReferenceRecords,
  type ContentFactoryReferenceTableKey,
} from "@/lib/contentFactoryUtils";
import { PermissionService } from "@/lib/permissions";

const REFERENCE_TABLES: ContentFactoryReferenceTableKey[] = [
  "platforms",
  "formats",
  "rubrics",
  "nosologies",
  "funnel_templates",
];

type ReferenceData = Record<
  ContentFactoryReferenceTableKey,
  ContentFactoryReferenceRecord[]
>;

const EMPTY_REFERENCE_DATA: ReferenceData = {
  platforms: [],
  formats: [],
  rubrics: [],
  nosologies: [],
  funnel_templates: [],
};

function ReferencesLoadingSkeleton() {
  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-48 rounded-md" />
            <Skeleton className="h-3 w-72 rounded-md" />
          </div>
        </div>
        <Skeleton className="h-8 w-32 rounded-md" />
      </div>
      <Skeleton className="h-12 rounded-lg" />
      <Skeleton className="h-64 rounded-lg" />
    </div>
  );
}

export default function ContentFactoryReferencesPage() {
  const { user } = useCurrentUser();
  const { toastError, toastSuccess } = useToast();
  const [referenceData, setReferenceData] =
    useState<ReferenceData>(EMPTY_REFERENCE_DATA);
  const [activeTable, setActiveTable] =
    useState<ContentFactoryReferenceTableKey>("platforms");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] =
    useState<ContentFactoryReferenceRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    tableKey: ContentFactoryReferenceTableKey;
    record: ContentFactoryReferenceRecord;
  } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const latestRequestSeqRef = useRef(0);
  const isAdmin = user ? PermissionService.isAdmin(user) : false;

  const fetchData = useCallback(async () => {
    const requestSeq = latestRequestSeqRef.current + 1;
    latestRequestSeqRef.current = requestSeq;
    const isLatestRequest = () => latestRequestSeqRef.current === requestSeq;

    setLoading(true);
    try {
      const [platforms, formats, rubrics, nosologies, funnelTemplates] =
        await Promise.all([
          api.getCFPlatforms({ only_active: false }),
          api.getCFFormats({ only_active: false }),
          api.getCFRubrics({ only_active: false }),
          api.getCFNosologies({ only_active: false }),
          api.getCFFunnelTemplates({ only_active: false }),
        ]);
      if (!isLatestRequest()) return;
      setReferenceData({
        platforms,
        formats,
        rubrics,
        nosologies,
        funnel_templates: funnelTemplates,
      });
    } catch {
      if (isLatestRequest()) toastError("Не удалось загрузить справочники");
    } finally {
      if (isLatestRequest()) setLoading(false);
    }
  }, [toastError]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const activeRecords = referenceData[activeTable];
  const activeSummary = useMemo(
    () => summarizeContentFactoryReferenceRecords(activeRecords),
    [activeRecords],
  );

  function openCreateDialog() {
    setEditingRecord(null);
    setDialogOpen(true);
  }

  function openEditDialog(record: ContentFactoryReferenceRecord) {
    setEditingRecord(record);
    setDialogOpen(true);
  }

  async function handleSaved() {
    await fetchData();
  }

  async function handleDeleteConfirmed() {
    if (!deleteTarget) return;
    setDeletingId(deleteTarget.record.id);
    try {
      if (deleteTarget.tableKey === "platforms") {
        await api.deleteCFPlatform(deleteTarget.record.id);
      } else if (deleteTarget.tableKey === "formats") {
        await api.deleteCFFormat(deleteTarget.record.id);
      } else if (deleteTarget.tableKey === "rubrics") {
        await api.deleteCFRubric(deleteTarget.record.id);
      } else if (deleteTarget.tableKey === "nosologies") {
        await api.deleteCFNosology(deleteTarget.record.id);
      } else {
        await api.deleteCFFunnelTemplate(deleteTarget.record.id);
      }
      toastSuccess("Reference deleted");
      setDeleteTarget(null);
      await fetchData();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Не удалось удалить справочник";
      toastError(message);
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return <ReferencesLoadingSkeleton />;
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Settings2 className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold leading-7 text-foreground">
              References
            </h1>
            <p className="text-sm text-muted-foreground">
              Platforms, formats, taxonomies, and reusable funnel templates
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-full gap-1.5 px-2.5 text-xs sm:w-auto"
            onClick={() => void fetchData()}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Обновить
          </Button>
          {isAdmin && (
            <Button
              type="button"
              size="sm"
              className="h-8 w-full gap-1.5 rounded-md px-3 text-xs sm:w-auto"
              onClick={openCreateDialog}
            >
              <Plus className="h-3.5 w-3.5" />
              New record
            </Button>
          )}
        </div>
      </div>

      {!isAdmin && (
        <div className="rounded-lg border border-border/70 bg-muted/25 px-4 py-3 text-sm text-muted-foreground">
          You can inspect Content Factory dictionaries here. Admin access is
          required for create, edit, and delete actions.
        </div>
      )}

      <Tabs
        value={activeTable}
        onValueChange={(value) =>
          setActiveTable(value as ContentFactoryReferenceTableKey)
        }
        className="space-y-3"
      >
        <div className="overflow-x-auto pb-1">
          <TabsList className="h-auto min-w-max justify-start">
            {REFERENCE_TABLES.map((tableKey) => (
              <TabsTrigger key={tableKey} value={tableKey} className="text-xs">
                {CF_REFERENCE_TABLE_LABELS[tableKey]}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <div className="flex flex-col gap-3 rounded-lg border border-border/70 bg-card px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">
              {CF_REFERENCE_TABLE_LABELS[activeTable]}
            </p>
            <p className="text-sm text-muted-foreground">
              {activeSummary.total} total · {activeSummary.active} active ·{" "}
              {activeSummary.inactive} inactive
            </p>
          </div>
          {isAdmin && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 w-full gap-1.5 px-2.5 text-xs sm:w-auto"
              onClick={openCreateDialog}
            >
              <Plus className="h-3.5 w-3.5" />
              Add {CF_REFERENCE_TABLE_LABELS[activeTable]}
            </Button>
          )}
        </div>

        {REFERENCE_TABLES.map((tableKey) => (
          <TabsContent key={tableKey} value={tableKey} className="mt-0">
            <ContentFactoryReferenceTable
              tableKey={tableKey}
              records={referenceData[tableKey]}
              isAdmin={isAdmin}
              deletingId={deletingId}
              onEdit={openEditDialog}
              onDelete={(record) => setDeleteTarget({ tableKey, record })}
            />
          </TabsContent>
        ))}
      </Tabs>

      <ContentFactoryReferenceDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        tableKey={activeTable}
        record={editingRecord}
        onSaved={handleSaved}
      />

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !deletingId) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete reference record?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `${getContentFactoryReferenceLabel(deleteTarget.record)} will be deleted if it is not used by Content Factory records.`
                : "This reference record will be deleted if it is not in use."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(deletingId)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={Boolean(deletingId)}
              onClick={() => void handleDeleteConfirmed()}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
