"use client";

import Link from "next/link";
import { BookOpen, CheckCircle2, Info, Workflow } from "lucide-react";
import { CONTENT_FACTORY_SECTIONS } from "@/lib/contentFactoryUi";

const WORKFLOW_STEPS = [
  "Создаём кампанию: цель, аудитория, материалы, ответственный и сроки.",
  "Готовим публикации под разные площадки и форматы.",
  "Проводим текст, дизайн, фактчек, врачебную проверку и одобрение.",
  "Публикуем вручную или полуавтоматически, фиксируем ссылку и UTM.",
  "Вносим замеры метрик по окнам 3 часа, 24 часа, 72 часа, 7 дней и финал.",
  "Проводим ретроспективу и сохраняем решения для следующих кампаний.",
];

const GLOSSARY = [
  "Кампания — общий смысловой блок: событие, инфоповод, запуск или серия публикаций.",
  "Публикация — конкретный пост, письмо, сторис или другой материал под площадку и формат.",
  "Аудитория — внешний сегмент людей, который можно привязать к публикации и затем анализировать.",
  "Ретроспектива — короткий разбор того, что сработало, что сломалось и что команда меняет дальше.",
];

export default function ContentFactoryHelpPage() {
  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <BookOpen className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h1 className="text-xl font-semibold leading-7 text-foreground">
            Что такое Контент-фабрика
          </h1>
          <p className="text-sm leading-6 text-muted-foreground">
            Это рабочее пространство для планирования, производства, проверки,
            публикации, измерения и разбора контента Онкошколы.
          </p>
        </div>
      </div>

      <section className="rounded-lg border border-border/70 bg-card px-4 py-4 shadow-sm">
        <div className="flex items-center gap-2">
          <Workflow className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Как устроен процесс</h2>
        </div>
        <ol className="mt-3 grid gap-2 md:grid-cols-2">
          {WORKFLOW_STEPS.map((step, index) => (
            <li
              key={step}
              className="rounded-md bg-muted/30 px-3 py-2 text-sm leading-6 text-muted-foreground"
            >
              <span className="mr-2 font-semibold text-foreground">{index + 1}.</span>
              {step}
            </li>
          ))}
        </ol>
      </section>

      <section className="rounded-lg border border-border/70 bg-card px-4 py-4 shadow-sm">
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Разделы</h2>
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {CONTENT_FACTORY_SECTIONS.filter(
            (section) => section.href !== "/content-factory/help",
          ).map((section) => (
            <Link
              key={section.href}
              href={section.href}
              className="rounded-md border border-border/60 bg-muted/20 px-3 py-2 transition-colors hover:border-primary/30 hover:bg-muted/40"
            >
              <span className="text-sm font-semibold text-foreground">
                {section.label}
              </span>
              <span className="mt-1 block text-sm leading-6 text-muted-foreground">
                {section.description}
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-border/70 bg-card px-4 py-4 shadow-sm">
        <h2 className="text-sm font-semibold text-foreground">Основные понятия</h2>
        <ul className="mt-3 grid gap-2 md:grid-cols-2">
          {GLOSSARY.map((item) => (
            <li
              key={item}
              className="rounded-md bg-muted/30 px-3 py-2 text-sm leading-6 text-muted-foreground"
            >
              {item}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg border border-border/70 bg-card px-4 py-4 shadow-sm">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">
            Что важно помнить
          </h2>
        </div>
        <div className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
          <p>
            Кампания связывает общий смысл, публикации, аудитории, UTM, метрики и
            ретроспективу. Публикация остаётся самостоятельной, потому что у каждого
            канала свои сроки, формат, ссылка и результат.
          </p>
          <p>
            Сейчас часть данных вводится вручную: ссылки на посты, замеры метрик,
            выводы ретроспектив. Это осознанно: сначала команда получает понятный
            журнал работы, а интеграции подключаются только там, где они стабильны и
            действительно экономят время.
          </p>
          <p>
            Автопубликация и интеграции с внешними платформами отложены до следующих
            этапов. Контент-фабрика уже помогает не терять статусы, аудитории,
            версии текстов, проверки и решения команды.
          </p>
        </div>
      </section>
    </div>
  );
}
