"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Loader2,
  Bot,
  CheckSquare,
  ListChecks,
  Users,
  Trash2,
} from "lucide-react";
import { ModeratorGuard } from "@/components/shared/ModeratorGuard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PriorityBadge } from "@/components/shared/PriorityBadge";
import { api } from "@/lib/api";
import type {
  ParseSummaryResponse,
  ParsedTask,
  AISettingsResponse,
} from "@/lib/types";

type Step = "input" | "preview";

export default function SummaryPage() {
  return (
    <ModeratorGuard>
      <SummaryContent />
    </ModeratorGuard>
  );
}

function SummaryContent() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("input");
  const [rawSummary, setRawSummary] = useState("");
  const [parsing, setParsing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiSettings, setAiSettings] = useState<AISettingsResponse | null>(null);

  // Parsed data (editable in preview)
  const [parsed, setParsed] = useState<ParseSummaryResponse | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editSummary, setEditSummary] = useState("");
  const [editDecisions, setEditDecisions] = useState<string[]>([]);
  const [editTasks, setEditTasks] = useState<ParsedTask[]>([]);
  const [editParticipants, setEditParticipants] = useState<string[]>([]);

  useEffect(() => {
    api.getAiSettings().then(setAiSettings).catch(() => {});
  }, []);

  const handleParse = async () => {
    if (!rawSummary.trim()) return;
    setParsing(true);
    setError(null);
    try {
      const result = await api.parseSummary(rawSummary);
      setParsed(result);
      setEditTitle(result.title);
      setEditSummary(result.summary);
      setEditDecisions([...result.decisions]);
      setEditTasks(result.tasks.map((t) => ({ ...t })));
      setEditParticipants([...result.participants]);
      setStep("preview");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка парсинга");
    } finally {
      setParsing(false);
    }
  };

  const handleCreate = async () => {
    setCreating(true);
    setError(null);
    try {
      const result = await api.createMeeting({
        raw_summary: rawSummary,
        title: editTitle,
        parsed_summary: editSummary,
        decisions: editDecisions,
        participants: editParticipants,
        tasks: editTasks,
      });
      router.push(`/meetings/${result.meeting.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка создания встречи");
    } finally {
      setCreating(false);
    }
  };

  const updateTask = (index: number, field: keyof ParsedTask, value: string | null) => {
    setEditTasks((prev) =>
      prev.map((t, i) => (i === index ? { ...t, [field]: value } : t))
    );
  };

  const removeTask = (index: number) => {
    setEditTasks((prev) => prev.filter((_, i) => i !== index));
  };

  const removeDecision = (index: number) => {
    setEditDecisions((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="max-w-3xl space-y-6">
      {step === "input" && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Zoom Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {aiSettings && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Bot className="h-4 w-4" />
                  Обработка через:{" "}
                  <Badge variant="outline">
                    {aiSettings.current_provider} ({aiSettings.current_model})
                  </Badge>
                </div>
              )}

              <div>
                <Label htmlFor="summary-text">
                  Вставьте текст Zoom AI Summary
                </Label>
                <Textarea
                  id="summary-text"
                  value={rawSummary}
                  onChange={(e) => setRawSummary(e.target.value)}
                  placeholder="Скопируйте и вставьте сюда текст из Zoom AI Summary..."
                  rows={12}
                  className="mt-2 font-mono text-sm"
                />
              </div>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              <Button
                onClick={handleParse}
                disabled={!rawSummary.trim() || parsing}
                className="w-full"
              >
                {parsing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Обработка...
                  </>
                ) : (
                  "Обработать"
                )}
              </Button>
            </CardContent>
          </Card>
        </>
      )}

      {step === "preview" && parsed && (
        <>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Превью встречи</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setStep("input")}
            >
              Назад к тексту
            </Button>
          </div>

          {/* Title */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Название встречи</CardTitle>
            </CardHeader>
            <CardContent>
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
              />
            </CardContent>
          </Card>

          {/* Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Краткое резюме</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={editSummary}
                onChange={(e) => setEditSummary(e.target.value)}
                rows={4}
              />
            </CardContent>
          </Card>

          {/* Decisions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CheckSquare className="h-4 w-4" />
                Решения ({editDecisions.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {editDecisions.map((decision, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={decision}
                    onChange={(e) => {
                      const updated = [...editDecisions];
                      updated[i] = e.target.value;
                      setEditDecisions(updated);
                    }}
                    className="flex-1"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeDecision(i)}
                    className="shrink-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Participants */}
          {editParticipants.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Участники ({editParticipants.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {editParticipants.map((name, i) => (
                    <Badge key={i} variant="secondary">
                      {name}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tasks */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ListChecks className="h-4 w-4" />
                Задачи ({editTasks.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {editTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Задачи не найдены в тексте
                </p>
              ) : (
                editTasks.map((task, i) => (
                  <div
                    key={i}
                    className="border rounded-lg p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        Задача {i + 1}
                      </span>
                      <div className="flex items-center gap-2">
                        <PriorityBadge priority={task.priority} />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeTask(i)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Input
                        value={task.title}
                        onChange={(e) =>
                          updateTask(i, "title", e.target.value)
                        }
                        placeholder="Название задачи"
                      />

                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <Label className="text-xs">Приоритет</Label>
                          <Select
                            value={task.priority}
                            onValueChange={(v) =>
                              updateTask(i, "priority", v)
                            }
                          >
                            <SelectTrigger className="mt-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="low">Низкий</SelectItem>
                              <SelectItem value="medium">Средний</SelectItem>
                              <SelectItem value="high">Высокий</SelectItem>
                              <SelectItem value="urgent">Срочный</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label className="text-xs">Исполнитель</Label>
                          <Input
                            value={task.assignee_name || ""}
                            onChange={(e) =>
                              updateTask(
                                i,
                                "assignee_name",
                                e.target.value || null
                              )
                            }
                            placeholder="Имя"
                            className="mt-1"
                          />
                        </div>

                        <div>
                          <Label className="text-xs">Дедлайн</Label>
                          <Input
                            type="date"
                            value={task.deadline || ""}
                            onChange={(e) =>
                              updateTask(
                                i,
                                "deadline",
                                e.target.value || null
                              )
                            }
                            className="mt-1"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <div className="flex gap-3">
            <Button
              onClick={handleCreate}
              disabled={creating}
              className="flex-1"
            >
              {creating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Создание...
                </>
              ) : (
                `Создать встречу и ${editTasks.length} задач`
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => setStep("input")}
              disabled={creating}
            >
              Отмена
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
