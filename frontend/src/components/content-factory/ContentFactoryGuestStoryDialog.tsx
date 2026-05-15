"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/shared/Toast";
import { api } from "@/lib/api";
import {
  CF_GUEST_ANONYMITY_LABELS,
  CF_GUEST_CONSENT_STATUS_LABELS,
  CF_GUEST_GIFT_STATUS_LABELS,
  CF_GUEST_ROLE_LABELS,
  CF_GUEST_SOURCE_LABELS,
  CF_GUEST_STATUS_LABELS,
} from "@/lib/contentFactoryUtils";
import type {
  CFBundle,
  CFGuestAnonymityLevel,
  CFGuestConsentStatus,
  CFGuestGiftStatus,
  CFGuestStory,
  CFGuestStoryRole,
  CFGuestStorySource,
  CFGuestStoryStatus,
  CFNosology,
  CFPublication,
  TeamMember,
} from "@/lib/types";

const GUEST_ROLES: CFGuestStoryRole[] = [
  "patient",
  "relative",
  "doctor",
  "volunteer",
  "partner",
  "other",
];
const GUEST_SOURCES: CFGuestStorySource[] = [
  "manual",
  "open_call",
  "referral",
  "screening_form",
  "partner",
  "other",
];
const GUEST_STATUSES: CFGuestStoryStatus[] = [
  "sourced",
  "applied",
  "editorial_screening",
  "shortlisted",
  "producer_call_scheduled",
  "producer_call_done",
  "medical_factcheck_needed",
  "doctor_approved",
  "consent_sent",
  "consent_signed",
  "scheduled",
  "prep_materials_sent",
  "live_or_recorded",
  "post_production",
  "published",
  "gift_sent",
  "follow_up_done",
  "maybe_later",
  "rejected",
  "archived",
];
const CONSENT_STATUSES: CFGuestConsentStatus[] = [
  "not_started",
  "sent",
  "signed",
  "declined",
  "revoked",
  "expired",
];
const ANONYMITY_LEVELS: CFGuestAnonymityLevel[] = [
  "full_name",
  "first_name",
  "anonymous",
  "pseudonym",
];
const GIFT_STATUSES: CFGuestGiftStatus[] = [
  "not_required",
  "pending",
  "sent",
  "received",
];

function nullableText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function linesFromText(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function textFromLines(value: string[] | null | undefined): string {
  return (value ?? []).join("\n");
}

function toDateTimeInputValue(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 16);
}

function fromDateTimeInputValue(value: string): string | null {
  return value ? new Date(value).toISOString() : null;
}

export function ContentFactoryGuestStoryDialog({
  open,
  onOpenChange,
  story,
  members,
  bundles,
  publications,
  nosologies,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  story?: CFGuestStory | null;
  members: TeamMember[];
  bundles: CFBundle[];
  publications: CFPublication[];
  nosologies: CFNosology[];
  onSaved: (story: CFGuestStory) => void | Promise<void>;
}) {
  const { toastSuccess, toastError } = useToast();
  const [displayName, setDisplayName] = useState("");
  const [contactRef, setContactRef] = useState("");
  const [role, setRole] = useState<CFGuestStoryRole>("patient");
  const [source, setSource] = useState<CFGuestStorySource>("manual");
  const [sourceNotes, setSourceNotes] = useState("");
  const [storyBrief, setStoryBrief] = useState("");
  const [status, setStatus] = useState<CFGuestStoryStatus>("sourced");
  const [ownerId, setOwnerId] = useState("");
  const [stageDueAt, setStageDueAt] = useState("");
  const [nosologyId, setNosologyId] = useState("none");
  const [bundleId, setBundleId] = useState("none");
  const [publicationId, setPublicationId] = useState("none");
  const [screeningNotes, setScreeningNotes] = useState("");
  const [medicalFactcheckNotes, setMedicalFactcheckNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [consentStatus, setConsentStatus] =
    useState<CFGuestConsentStatus>("not_started");
  const [consentVersion, setConsentVersion] = useState("");
  const [consentSignedAt, setConsentSignedAt] = useState("");
  const [allowedChannelsText, setAllowedChannelsText] = useState("");
  const [anonymityLevel, setAnonymityLevel] =
    useState<CFGuestAnonymityLevel>("full_name");
  const [sensitiveTopicsText, setSensitiveTopicsText] = useState("");
  const [legalNotes, setLegalNotes] = useState("");
  const [giftStatus, setGiftStatus] =
    useState<CFGuestGiftStatus>("not_required");
  const [followUpDueAt, setFollowUpDueAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editing = Boolean(story);

  const activeMembers = useMemo(
    () => members.filter((member) => member.is_active),
    [members],
  );
  const activeBundles = useMemo(
    () => bundles.filter((bundle) => bundle.status !== "archived"),
    [bundles],
  );

  useEffect(() => {
    if (!open) return;
    setDisplayName(story?.display_name ?? "");
    setContactRef(story?.contact_ref ?? "");
    setRole(story?.role ?? "patient");
    setSource(story?.source ?? "manual");
    setSourceNotes(story?.source_notes ?? "");
    setStoryBrief(story?.story_brief ?? "");
    setStatus(story?.status ?? "sourced");
    setOwnerId(story?.owner_id ?? activeMembers[0]?.id ?? "");
    setStageDueAt(toDateTimeInputValue(story?.stage_due_at));
    setNosologyId(story?.nosology_id ?? "none");
    setBundleId(story?.bundle_id ?? "none");
    setPublicationId(story?.publication_id ?? "none");
    setScreeningNotes(story?.screening_notes ?? "");
    setMedicalFactcheckNotes(story?.medical_factcheck_notes ?? "");
    setRejectionReason(story?.rejection_reason ?? "");
    setConsentStatus(story?.consent_status ?? "not_started");
    setConsentVersion(story?.consent_version ?? "");
    setConsentSignedAt(toDateTimeInputValue(story?.consent_signed_at));
    setAllowedChannelsText(textFromLines(story?.allowed_channels));
    setAnonymityLevel(story?.anonymity_level ?? "full_name");
    setSensitiveTopicsText(textFromLines(story?.sensitive_topics));
    setLegalNotes(story?.legal_notes ?? "");
    setGiftStatus(story?.gift_status ?? "not_required");
    setFollowUpDueAt(toDateTimeInputValue(story?.follow_up_due_at));
    setError(null);
  }, [activeMembers, open, story]);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && saving) return;
    onOpenChange(nextOpen);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const cleanDisplayName = displayName.trim();
    if (!cleanDisplayName) {
      setError("Введите имя или рабочее название гостя");
      return;
    }
    if (!ownerId) {
      setError("Выберите ответственного");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload = {
        display_name: cleanDisplayName,
        contact_ref: nullableText(contactRef),
        role,
        source,
        source_notes: nullableText(sourceNotes),
        story_brief: nullableText(storyBrief),
        status,
        owner_id: ownerId,
        stage_due_at: fromDateTimeInputValue(stageDueAt),
        nosology_id: nosologyId === "none" ? null : nosologyId,
        bundle_id: bundleId === "none" ? null : bundleId,
        publication_id: publicationId === "none" ? null : publicationId,
        screening_notes: nullableText(screeningNotes),
        medical_factcheck_notes: nullableText(medicalFactcheckNotes),
        rejection_reason: nullableText(rejectionReason),
        consent_status: consentStatus,
        consent_version: nullableText(consentVersion),
        consent_signed_at: fromDateTimeInputValue(consentSignedAt),
        allowed_channels: linesFromText(allowedChannelsText),
        anonymity_level: anonymityLevel,
        sensitive_topics: linesFromText(sensitiveTopicsText),
        legal_notes: nullableText(legalNotes),
        gift_status: giftStatus,
        follow_up_due_at: fromDateTimeInputValue(followUpDueAt),
      };

      const saved = story
        ? await api.updateCFGuestStory(story.id, payload)
        : await api.createCFGuestStory(payload);
      await onSaved(saved);
      onOpenChange(false);
      toastSuccess(editing ? "История обновлена" : "История создана");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Не удалось сохранить историю";
      setError(message);
      toastError(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[calc(100vh-1.5rem)] overflow-y-auto sm:max-w-[860px]">
        <DialogHeader>
          <DialogTitle className="text-lg">
            {editing ? "Редактировать историю" : "Новая история гостя"}
          </DialogTitle>
          <DialogDescription>
            Ведите путь гостя от отбора и согласия до публикации, подарка и follow-up.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Кто это</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="cf-guest-name">Имя или рабочее название</Label>
                <Input
                  id="cf-guest-name"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  className="h-9 border-border/70 bg-muted/20"
                  disabled={saving}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cf-guest-contact">Контакт или ссылка</Label>
                <Input
                  id="cf-guest-contact"
                  value={contactRef}
                  onChange={(event) => setContactRef(event.target.value)}
                  className="h-9 border-border/70 bg-muted/20"
                  disabled={saving}
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Роль</Label>
                <Select
                  value={role}
                  onValueChange={(value) => setRole(value as CFGuestStoryRole)}
                  disabled={saving}
                >
                  <SelectTrigger className="h-9 border-border/70 bg-muted/20 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="z-[70] border-border/70 shadow-xl">
                    {GUEST_ROLES.map((item) => (
                      <SelectItem key={item} value={item}>
                        {CF_GUEST_ROLE_LABELS[item]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Источник</Label>
                <Select
                  value={source}
                  onValueChange={(value) => setSource(value as CFGuestStorySource)}
                  disabled={saving}
                >
                  <SelectTrigger className="h-9 border-border/70 bg-muted/20 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="z-[70] border-border/70 shadow-xl">
                    {GUEST_SOURCES.map((item) => (
                      <SelectItem key={item} value={item}>
                        {CF_GUEST_SOURCE_LABELS[item]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Ответственный</Label>
                <Select value={ownerId} onValueChange={setOwnerId} disabled={saving}>
                  <SelectTrigger className="h-9 border-border/70 bg-muted/20 text-sm">
                    <SelectValue placeholder="Выберите" />
                  </SelectTrigger>
                  <SelectContent className="z-[70] max-h-72 border-border/70 shadow-xl">
                    {activeMembers.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cf-guest-source-notes">Откуда пришёл кандидат</Label>
              <Textarea
                id="cf-guest-source-notes"
                value={sourceNotes}
                onChange={(event) => setSourceNotes(event.target.value)}
                className="min-h-16 border-border/70 bg-muted/20"
                disabled={saving}
              />
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">История и этап</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Этап</Label>
                <Select
                  value={status}
                  onValueChange={(value) => setStatus(value as CFGuestStoryStatus)}
                  disabled={saving}
                >
                  <SelectTrigger className="h-9 border-border/70 bg-muted/20 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="z-[70] max-h-72 border-border/70 shadow-xl">
                    {GUEST_STATUSES.map((item) => (
                      <SelectItem key={item} value={item}>
                        {CF_GUEST_STATUS_LABELS[item]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cf-guest-stage-due">Срок следующего шага</Label>
                <Input
                  id="cf-guest-stage-due"
                  type="datetime-local"
                  value={stageDueAt}
                  onChange={(event) => setStageDueAt(event.target.value)}
                  className="h-9 border-border/70 bg-muted/20"
                  disabled={saving}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cf-guest-brief">Коротко об истории</Label>
              <Textarea
                id="cf-guest-brief"
                value={storyBrief}
                onChange={(event) => setStoryBrief(event.target.value)}
                className="min-h-20 border-border/70 bg-muted/20"
                disabled={saving}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="cf-guest-screening">Заметки отбора</Label>
                <Textarea
                  id="cf-guest-screening"
                  value={screeningNotes}
                  onChange={(event) => setScreeningNotes(event.target.value)}
                  className="min-h-20 border-border/70 bg-muted/20"
                  disabled={saving}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cf-guest-factcheck">Фактчек и медицинские границы</Label>
                <Textarea
                  id="cf-guest-factcheck"
                  value={medicalFactcheckNotes}
                  onChange={(event) =>
                    setMedicalFactcheckNotes(event.target.value)
                  }
                  className="min-h-20 border-border/70 bg-muted/20"
                  disabled={saving}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cf-guest-rejection">Причина отказа или паузы</Label>
              <Textarea
                id="cf-guest-rejection"
                value={rejectionReason}
                onChange={(event) => setRejectionReason(event.target.value)}
                className="min-h-16 border-border/70 bg-muted/20"
                disabled={saving}
              />
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">
              Согласие и границы
            </h3>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Согласие</Label>
                <Select
                  value={consentStatus}
                  onValueChange={(value) =>
                    setConsentStatus(value as CFGuestConsentStatus)
                  }
                  disabled={saving}
                >
                  <SelectTrigger className="h-9 border-border/70 bg-muted/20 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="z-[70] border-border/70 shadow-xl">
                    {CONSENT_STATUSES.map((item) => (
                      <SelectItem key={item} value={item}>
                        {CF_GUEST_CONSENT_STATUS_LABELS[item]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cf-guest-consent-version">Версия согласия</Label>
                <Input
                  id="cf-guest-consent-version"
                  value={consentVersion}
                  onChange={(event) => setConsentVersion(event.target.value)}
                  className="h-9 border-border/70 bg-muted/20"
                  disabled={saving}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cf-guest-consent-signed">Дата подписи</Label>
                <Input
                  id="cf-guest-consent-signed"
                  type="datetime-local"
                  value={consentSignedAt}
                  onChange={(event) => setConsentSignedAt(event.target.value)}
                  className="h-9 border-border/70 bg-muted/20"
                  disabled={saving}
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="cf-guest-allowed-channels">
                  Разрешённые каналы
                </Label>
                <Textarea
                  id="cf-guest-allowed-channels"
                  value={allowedChannelsText}
                  onChange={(event) => setAllowedChannelsText(event.target.value)}
                  className="min-h-20 border-border/70 bg-muted/20"
                  placeholder="Telegram&#10;VK&#10;YouTube"
                  disabled={saving}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cf-guest-sensitive-topics">Границы и темы</Label>
                <Textarea
                  id="cf-guest-sensitive-topics"
                  value={sensitiveTopicsText}
                  onChange={(event) => setSensitiveTopicsText(event.target.value)}
                  className="min-h-20 border-border/70 bg-muted/20"
                  placeholder="Не называем клинику&#10;Не показываем город"
                  disabled={saving}
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-[220px_minmax(0,1fr)]">
              <div className="space-y-2">
                <Label>Публичность</Label>
                <Select
                  value={anonymityLevel}
                  onValueChange={(value) =>
                    setAnonymityLevel(value as CFGuestAnonymityLevel)
                  }
                  disabled={saving}
                >
                  <SelectTrigger className="h-9 border-border/70 bg-muted/20 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="z-[70] border-border/70 shadow-xl">
                    {ANONYMITY_LEVELS.map((item) => (
                      <SelectItem key={item} value={item}>
                        {CF_GUEST_ANONYMITY_LABELS[item]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cf-guest-legal">Юридические заметки</Label>
                <Textarea
                  id="cf-guest-legal"
                  value={legalNotes}
                  onChange={(event) => setLegalNotes(event.target.value)}
                  className="min-h-20 border-border/70 bg-muted/20"
                  disabled={saving}
                />
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">
              Связи и follow-up
            </h3>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Кампания</Label>
                <Select value={bundleId} onValueChange={setBundleId} disabled={saving}>
                  <SelectTrigger className="h-9 border-border/70 bg-muted/20 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="z-[70] max-h-72 border-border/70 shadow-xl">
                    <SelectItem value="none">Без кампании</SelectItem>
                    {activeBundles.map((bundle) => (
                      <SelectItem key={bundle.id} value={bundle.id}>
                        {bundle.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Публикация</Label>
                <Select
                  value={publicationId}
                  onValueChange={setPublicationId}
                  disabled={saving}
                >
                  <SelectTrigger className="h-9 border-border/70 bg-muted/20 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="z-[70] max-h-72 border-border/70 shadow-xl">
                    <SelectItem value="none">Без публикации</SelectItem>
                    {publications.map((publication) => (
                      <SelectItem key={publication.id} value={publication.id}>
                        {publication.title?.trim() ||
                          `Публикация ${publication.id.slice(0, 8)}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Нозология</Label>
                <Select
                  value={nosologyId}
                  onValueChange={setNosologyId}
                  disabled={saving}
                >
                  <SelectTrigger className="h-9 border-border/70 bg-muted/20 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="z-[70] max-h-72 border-border/70 shadow-xl">
                    <SelectItem value="none">Не указана</SelectItem>
                    {nosologies.map((nosology) => (
                      <SelectItem key={nosology.id} value={nosology.id}>
                        {nosology.display_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Подарок</Label>
                <Select
                  value={giftStatus}
                  onValueChange={(value) =>
                    setGiftStatus(value as CFGuestGiftStatus)
                  }
                  disabled={saving}
                >
                  <SelectTrigger className="h-9 border-border/70 bg-muted/20 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="z-[70] border-border/70 shadow-xl">
                    {GIFT_STATUSES.map((item) => (
                      <SelectItem key={item} value={item}>
                        {CF_GUEST_GIFT_STATUS_LABELS[item]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cf-guest-follow-up">Когда вернуться</Label>
                <Input
                  id="cf-guest-follow-up"
                  type="datetime-local"
                  value={followUpDueAt}
                  onChange={(event) => setFollowUpDueAt(event.target.value)}
                  className="h-9 border-border/70 bg-muted/20"
                  disabled={saving}
                />
              </div>
            </div>
          </section>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => onOpenChange(false)}
            >
              Отмена
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? "Сохранить" : "Создать"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
