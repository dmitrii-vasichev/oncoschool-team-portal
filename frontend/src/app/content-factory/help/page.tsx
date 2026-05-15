"use client";

import Link from "next/link";
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Compass,
  FileText,
  FolderKanban,
  Info,
  Layers3,
  Lightbulb,
  ListChecks,
  Rocket,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
  Workflow,
} from "lucide-react";
import { CONTENT_FACTORY_SECTIONS } from "@/lib/contentFactoryUi";

const RESEARCH_PILLARS = [
  {
    title: "Кампании вместо разрозненных постов",
    text: "Один эфир, запуск, пациентская история или сезонный инфоповод собирается в общий рабочий блок: цель, аудитории, материалы, публикации, UTM, метрики и выводы.",
  },
  {
    title: "Публикации живут отдельно по каналам",
    text: "Telegram, VK, Dzen, Max, email и push требуют разных текстов, сроков, ссылок, ограничений и метрик. Поэтому канал - не копия, а самостоятельная рабочая единица.",
  },
  {
    title: "Медицинский контент требует проверки",
    text: "Для Онкошколы важны фактчек, врачебное согласование, версия текста и понятная история решений. Это снижает риск ошибок и спорных формулировок.",
  },
  {
    title: "Автоматизация подключается постепенно",
    text: "Исследование показало, что для русских каналов надежнее сначала построить content operations layer, а не обещать автопубликацию там, где API может быть нестабильным.",
  },
];

const OPERATING_MODEL = [
  {
    title: "Кампания",
    text: "Фиксируем общий смысл: событие, тему, продуктовый поток, цель, исходные материалы и ответственного.",
  },
  {
    title: "Публикации",
    text: "Создаем конкретные материалы под площадки, даты, форматы, аудитории, UTM и статусы производства.",
  },
  {
    title: "Адаптации",
    text: "Готовим отдельные версии текста под Telegram, VK, email, push, Max и Dzen, чтобы не публиковать один универсальный текст везде.",
  },
  {
    title: "Проверка",
    text: "Проводим текст, дизайн, фактчек, врачебную проверку и финальное одобрение до выхода.",
  },
  {
    title: "Публикация",
    text: "Сейчас можно вручную опубликовать материал, скопировать готовый пакет и записать ссылку, дату и внешний ID.",
  },
  {
    title: "Метрики",
    text: "Добавляем замеры вручную или через импорт: 3 часа, 24 часа, 72 часа, 7 дней, финал или кастомное окно.",
  },
  {
    title: "Выводы",
    text: "Сохраняем ретроспективу: что сработало, что сломалось, какие решения команда берет в следующие кампании.",
  },
];

const CURRENT_CAPABILITIES = [
  "Создать кампанию и связать с ней публикации.",
  "Запланировать публикацию по площадке, формату, дате, статусу, рубрике, нозологии и ответственному.",
  "Подготовить исходный текст, UTM, аудитории и чек-лист готовности.",
  "Сохранить адаптации под несколько каналов и увидеть, какие версии готовы, отсутствуют или устарели.",
  "Вести гостей и истории: от отбора и согласия до публикации, подарка и follow-up.",
  "Скопировать готовый пакет для ручной публикации.",
  "Зафиксировать факт публикации: ссылку, дату и внешний ID.",
  "Добавить метрики вручную или через быстрый paste-import.",
  "Посмотреть сводку метрик, эффективность, аналитику аудиторий и ретроспективы.",
];

const FUTURE_AUTOMATION = [
  "Импорт публикационного плана из Excel или табличной вставки с предварительной проверкой строк.",
  "Матрица планирования внутри кампании: какие каналы уже заведены, а каких публикаций еще не хватает.",
  "Очередь публикации с аудитом, статусами, повторами и безопасным ручным fallback.",
  "Первая автопубликация там, где API и доступы достаточно стабильны, вероятно Telegram.",
  "Следующие интеграции по практической ценности: VK, метрики Telegram/VK, GetCourse-конверсии, email-отчеты.",
  "Автоматический сбор ссылок, внешних ID и метрик там, где это надежнее ручной фиксации.",
];

const FIRST_SAFE_PATH = [
  "Начните с кампании: назовите смысловой блок и зафиксируйте цель.",
  "Добавьте одну публикацию: площадка, формат, дата, ответственный и статус.",
  "Заполните текст и UTM настолько, насколько они уже известны.",
  "Откройте адаптации и сохраните хотя бы один канал, который реально будете публиковать.",
  "Доведите публикацию до одобрения или календаря через быстрые действия.",
  "Опубликуйте вручную, вставьте ссылку и дату факта.",
  "Через 24 часа внесите первые метрики и сохраните вывод в ретроспективе.",
];

const PUBLICATION_PLANNING_HELP = [
  {
    icon: CalendarDays,
    title: "Календарь показывает рабочий план",
    text: "Календарь нужен не только для дат. Он показывает, что запланировано, что просрочено, что осталось без даты, какие публикации уже вышли и где процесс застрял. Фильтры помогают смотреть план по статусу, площадке, формату, ответственному и кампании.",
    tips: [
      "Если публикация без даты, она попадет в отдельную группу и не потеряется.",
      "Дата в календаре помогает команде договориться о сроке, но пока не запускает публикацию автоматически.",
      "Просроченные и проблемные элементы стоит открывать из календаря и доводить до следующего статуса.",
    ],
  },
  {
    icon: FileText,
    title: "Карточка публикации собирает источник правды",
    text: "Карточка публикации хранит то, что раньше расползалось по таблицам и чатам: название, текст, площадку, формат, рубрику, нозологию, ответственного, плановую дату, UTM, аудитории, историю изменений и факт выхода.",
    tips: [
      "Не обязательно заполнять все сразу: начните с площадки, формата, даты и ответственного.",
      "Текст публикации - исходник, от которого дальше делаются адаптации под каналы.",
      "Ссылка на пост и внешний ID заполняются после ручной публикации или будущей интеграции.",
    ],
  },
  {
    icon: Layers3,
    title: "Адаптации показывают готовность каналов",
    text: "Одна идея редко одинаково работает в Telegram, VK, email, push, Max и Dzen. Адаптации позволяют сохранить отдельный текст под каждый канал, увидеть сохраненные, отсутствующие и устаревшие версии, а затем скопировать готовые тексты для ручной публикации.",
    tips: [
      "Сохраненная адаптация привязана к версии исходного текста.",
      "Если исходный текст изменился, старая адаптация может стать устаревшей и ее нужно пересмотреть.",
      "Кнопка «Скопировать готовые» собирает только актуальные сохраненные каналы.",
    ],
  },
  {
    icon: ListChecks,
    title: "Чек-лист готовности помогает не пропустить шаг",
    text: "Готовность - это не наказание и не блокировка черновика. Это подсказка, что еще мешает спокойно выпускать материал: нет текста, не хватает даты, статус не дошел до одобрения, адаптации не готовы, ссылка не записана или метрики появятся только после публикации.",
    tips: [
      "До публикации чек-лист помогает закрыть текст, дату, статус, аудитории и адаптации.",
      "После публикации он напоминает записать ссылку, дату факта и первые метрики.",
      "Пункты «после публикации» могут ждать своего момента и не должны пугать на этапе подготовки.",
    ],
  },
];

const MANUAL_PUBLICATION_FLOW = [
  "Создайте публикацию из списка, кампании или будущего импорта Excel.",
  "Поставьте плановую дату, площадку, формат и ответственного.",
  "Заполните исходный текст, UTM и аудитории настолько, насколько они известны.",
  "Сохраните адаптации для каналов, где материал действительно будет выходить.",
  "Проведите проверку: текст, дизайн, фактчек, врачебное согласование и одобрение.",
  "Скопируйте пакет или готовые адаптации и опубликуйте вручную во внешнем канале.",
  "Вернитесь в карточку и сохраните факт публикации: дату, ссылку и внешний ID.",
  "Добавьте первые метрики и используйте их в эффективности и ретроспективе.",
];

const PUBLICATION_CONFUSION_NOTES = [
  "Плановая дата в календаре не означает автопубликацию: автоматический выпуск появится позже через очередь публикации и интеграции.",
  "Устаревшая адаптация не удаляется сама: она остается как рабочая версия, но команда видит, что исходный текст уже изменился.",
  "Метрики нужны не для красивого отчета, а как evidence: по ним видно, какой канал, тема, аудитория и CTA действительно сработали.",
  "Чек-лист готовности помогает принять решение, но ранний черновик может быть неполным - это нормальное состояние производства.",
];

const CAMPAIGN_REVIEW_AUDIENCE_HELP = [
  {
    icon: FolderKanban,
    title: "Кампания связывает смысл, сроки и публикации",
    text: "Кампания - это рабочий контекст для эфира, запуска, пациентской истории, сезонной темы или серии материалов. В ней удобно держать цель, продуктовый поток, дату события, владельца, brief, исходные материалы и все связанные публикации.",
    tips: [
      "Кампания - не просто папка: она объясняет, зачем выходят публикации и как они связаны между собой.",
      "Brief и материалы помогают не искать исходники в чатах перед каждой новой публикацией.",
      "Если публикации живут в одной кампании, проще увидеть пропущенные каналы и подготовить будущую матрицу планирования.",
    ],
  },
  {
    icon: ListChecks,
    title: "Очередь проверки показывает, где застрял материал",
    text: "Очередь проверки собирает публикации, которым нужен текст, дизайн, фактчек, медицинская проверка, одобрение или расписание. Это операционный triage: команда видит следующий шаг, срочность и ответственного без ручной сверки таблиц.",
    tips: [
      "Очередь проверки - не список виноватых, а способ быстро понять, что сейчас мешает выпуску.",
      "Медицинская проверка особенно важна для формулировок, обещаний, фактов и чувствительных тем.",
      "После одобрения публикацию нужно довести до календаря или факта выхода, иначе она останется в подвешенном состоянии.",
    ],
  },
  {
    icon: Users,
    title: "Аудитории помогают не писать в пустоту",
    text: "Аудитории - это зеркало внешних сегментов, сейчас прежде всего GetCourse. Их стоит привязывать к публикации до выхода, чтобы команда понимала, кому предназначен материал и какие группы нужно включить или исключить.",
    tips: [
      "Роли аудитории: целевая, исключение, контрольная и ретаргетинг.",
      "Размер базы и история обновлений помогают заметить, что сегмент устарел или больше не подходит.",
      "Владелец аудитории отвечает за смысл сегмента и за то, когда его нужно обновить.",
    ],
  },
  {
    icon: BarChart3,
    title: "Аналитика аудиторий показывает использование сегментов",
    text: "Аналитика аудиторий показывает, какие сегменты реально используются в публикациях, какие активные аудитории простаивают, с какими кампаниями они связаны и есть ли метрики по публикациям.",
    tips: [
      "Если аудитория активна, но нигде не используется, это сигнал пересмотреть план коммуникаций.",
      "Если публикация использует аудиторию, но метрик нет, эффективность невозможно нормально оценить.",
      "Связка аудитория -> публикация -> метрики нужна для будущих решений, а не только для отчета после факта.",
    ],
  },
];

const CAMPAIGN_REVIEW_AUDIENCE_FLOW = [
  "Создайте кампанию и зафиксируйте цель, владельца, дату события и brief.",
  "Добавьте исходные материалы: расшифровки, ссылки, тезисы, экспертные заметки или документы.",
  "Создайте связанные публикации под нужные площадки и форматы.",
  "Назначьте ответственных и переведите материалы в понятные статусы производства.",
  "Используйте очередь проверки, чтобы закрыть текст, дизайн, фактчек, медицинскую проверку и одобрение.",
  "Привяжите аудитории к публикациям в правильных ролях: целевая, исключение, контрольная и ретаргетинг.",
  "Проверьте аналитику аудиторий: какие сегменты используются, какие простаивают и где есть evidence по метрикам.",
];

const CAMPAIGN_REVIEW_AUDIENCE_NOTES = [
  "Кампания - не просто папка для публикаций: она хранит общий смысл, сроки, материалы, владельца и будущие выводы.",
  "Очередь проверки не заменяет личную коммуникацию, но показывает, где нужен следующий редакционный или медицинский шаг.",
  "Аудитория из GetCourse не обновляется магически каждую минуту: размер базы и снимки нужно периодически сверять.",
  "Аналитика аудиторий становится полезной только тогда, когда публикации связаны с сегментами и по ним есть метрики.",
];

const GLOSSARY = [
  "Кампания: общий смысловой блок, например эфир, запуск, пациентская история, сезонная тема или серия материалов.",
  "Публикация: конкретный пост, письмо, push, карточка или другой материал под одну площадку и один формат.",
  "Адаптация: версия текста под конкретный канал, с учетом длины, первого экрана, CTA, UTM и ограничений площадки.",
  "Аудитория: внешний сегмент людей, который можно привязать к публикации и затем анализировать.",
  "Гости и истории: отдельный путь кандидата, согласия, границ публичности, публикации и последующего контакта.",
  "Готовность: чек-лист, который показывает, хватает ли текста, статуса, даты, адаптаций, факта публикации и метрик.",
  "Факт публикации: ссылка, дата выхода и внешний идентификатор, которые подтверждают, что материал действительно опубликован.",
  "Метрика: замер результата в конкретное окно времени, например просмотры за 24 часа или регистрации за 7 дней.",
  "Ретроспектива: зафиксированный разбор того, что сработало, что сломалось и что команда меняет дальше.",
];

export default function ContentFactoryHelpPage() {
  const lifecycleText =
    "кампания -> публикации -> адаптации -> проверка -> публикация -> метрики -> выводы";

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <section className="rounded-lg border border-border/70 bg-card px-4 py-5 shadow-sm sm:px-5">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.6fr)]">
          <div className="min-w-0">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <BookOpen className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                  Справка
                </p>
                <h1 className="mt-1 text-2xl font-semibold leading-8 text-foreground">
                  Что такое Контент-фабрика
                </h1>
              </div>
            </div>
            <p className="mt-4 max-w-4xl text-sm leading-6 text-muted-foreground">
              Контент-фабрика - это рабочее пространство для планирования,
              производства, проверки, публикации, измерения и разбора контента
              Онкошколы. Она заменяет рассыпанные таблицы, заметки, сообщения и
              ручные списки единым операционным журналом: от идеи кампании до
              метрик и выводов.
            </p>
            <p className="mt-3 max-w-4xl text-sm leading-6 text-muted-foreground">
              Это не просто календарь и не попытка сразу стать автопубликатором во
              все социальные сети. Сначала система помогает команде не терять
              смыслы, статусы, аудитории, версии, проверки, ссылки и результаты.
              Автоматизация добавляется поэтапно там, где она надежна и реально
              экономит ручной труд.
            </p>
          </div>

          <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-primary">
              <Compass className="h-4 w-4" />
              Главная логика
            </div>
            <p className="mt-3 text-sm leading-6 text-foreground">
              {lifecycleText}
            </p>
            <p className="mt-3 text-xs leading-5 text-muted-foreground">
              Если в этом пути есть разрыв, команда видит риск заранее: не готов
              текст, нет адаптации, не пройдена проверка, нет ссылки или не
              заведены метрики.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-border/70 bg-card px-4 py-4 shadow-sm sm:px-5">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">
            Почему это сделано именно так
          </h2>
        </div>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Структура основана на deep research, разборе рынка контент-календарей,
          campaign workspaces, approval workflow, custom/manual channel workflows,
          taxonomy-first planning и ручного Excel-процесса команды. Лучшие
          практики взяты не как копия чужого SaaS, а как объяснение, какие блоки
          нужны внутренней медицинской редакции.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {RESEARCH_PILLARS.map((pillar) => (
            <div key={pillar.title} className="border-l-2 border-primary/30 pl-3">
              <h3 className="text-sm font-semibold text-foreground">
                {pillar.title}
              </h3>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {pillar.text}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-border/70 bg-card px-4 py-4 shadow-sm sm:px-5">
        <div className="flex items-center gap-2">
          <Workflow className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">
            Как работает операционная модель
          </h2>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-7">
          {OPERATING_MODEL.map((step, index) => (
            <div
              key={step.title}
              className="rounded-lg border border-border/70 bg-background px-3 py-3"
            >
              <span className="text-xs font-semibold text-primary">
                {index + 1}
              </span>
              <h3 className="mt-1 text-sm font-semibold text-foreground">
                {step.title}
              </h3>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                {step.text}
              </p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="rounded-lg border border-border/70 bg-card px-4 py-4 shadow-sm sm:px-5">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">
              Что уже можно делать сейчас
            </h2>
          </div>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
            {CURRENT_CAPABILITIES.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-lg border border-border/70 bg-card px-4 py-4 shadow-sm sm:px-5">
          <div className="flex items-center gap-2">
            <Rocket className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">
              Что будет автоматизировано позже
            </h2>
          </div>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
            {FUTURE_AUTOMATION.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/50" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="rounded-lg border border-border/70 bg-card px-4 py-4 shadow-sm sm:px-5">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">
            Как начать без страха
          </h2>
        </div>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Не нужно сразу заполнять всю систему идеально. Первый полезный сценарий:
          завести одну кампанию, одну публикацию, одну адаптацию, один факт
          публикации и один замер метрик. Этого достаточно, чтобы увидеть полный
          цикл и понять, где ручная работа начнет сокращаться.
        </p>
        <ol className="mt-4 grid gap-2 md:grid-cols-2">
          {FIRST_SAFE_PATH.map((step, index) => (
            <li
              key={step}
              className="flex gap-3 rounded-md bg-muted/30 px-3 py-2 text-sm leading-6 text-muted-foreground"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {index + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="rounded-lg border border-border/70 bg-card px-4 py-4 shadow-sm sm:px-5">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">
            Планирование публикации: от календаря до готовности
          </h2>
        </div>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Этот блок помогает пройти путь одной публикации: увидеть ее в плане,
          собрать карточку, подготовить адаптации, проверить готовность,
          опубликовать вручную и вернуться за ссылкой и метриками.
        </p>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {PUBLICATION_PLANNING_HELP.map((item) => {
            const Icon = item.icon;
            return (
              <article
                key={item.title}
                className="rounded-lg border border-border/70 bg-background px-4 py-4"
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-foreground">
                      {item.title}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {item.text}
                    </p>
                  </div>
                </div>
                <ul className="mt-3 space-y-1.5 text-xs leading-5 text-muted-foreground">
                  {item.tips.map((tip) => (
                    <li key={tip} className="flex gap-2">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70" />
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(280px,0.72fr)]">
          <div className="rounded-lg border border-border/70 bg-muted/20 px-4 py-4">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">
                Ручной маршрут публикации сегодня
              </h3>
            </div>
            <ol className="mt-3 grid gap-2 md:grid-cols-2">
              {MANUAL_PUBLICATION_FLOW.map((step, index) => (
                <li
                  key={step}
                  className="flex gap-3 rounded-md bg-background px-3 py-2 text-sm leading-6 text-muted-foreground"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-4 text-amber-900">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              <h3 className="text-sm font-semibold">Что часто путают</h3>
            </div>
            <ul className="mt-3 space-y-2 text-sm leading-6">
              {PUBLICATION_CONFUSION_NOTES.map((note) => (
                <li key={note} className="flex gap-2">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-700" />
                  <span>{note}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-border/70 bg-card px-4 py-4 shadow-sm sm:px-5">
        <div className="flex items-center gap-2">
          <FolderKanban className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">
            Кампании, проверка и аудитории
          </h2>
        </div>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Этот слой связывает отдельные публикации в управляемую работу:
          кампания хранит общий смысл, очередь проверки показывает следующий
          редакционный шаг, а аудитории помогают заранее понять, для кого и зачем
          выходит материал.
        </p>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {CAMPAIGN_REVIEW_AUDIENCE_HELP.map((item) => {
            const Icon = item.icon;
            return (
              <article
                key={item.title}
                className="rounded-lg border border-border/70 bg-background px-4 py-4"
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-foreground">
                      {item.title}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {item.text}
                    </p>
                  </div>
                </div>
                <ul className="mt-3 space-y-1.5 text-xs leading-5 text-muted-foreground">
                  {item.tips.map((tip) => (
                    <li key={tip} className="flex gap-2">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70" />
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(280px,0.72fr)]">
          <div className="rounded-lg border border-border/70 bg-muted/20 px-4 py-4">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">
                Как вести кампанию с проверкой и аудиториями
              </h3>
            </div>
            <ol className="mt-3 grid gap-2 md:grid-cols-2">
              {CAMPAIGN_REVIEW_AUDIENCE_FLOW.map((step, index) => (
                <li
                  key={step}
                  className="flex gap-3 rounded-md bg-background px-3 py-2 text-sm leading-6 text-muted-foreground"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-4 text-sky-950">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4" />
              <h3 className="text-sm font-semibold">Что часто путают</h3>
            </div>
            <ul className="mt-3 space-y-2 text-sm leading-6">
              {CAMPAIGN_REVIEW_AUDIENCE_NOTES.map((note) => (
                <li key={note} className="flex gap-2">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-700" />
                  <span>{note}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-border/70 bg-card px-4 py-4 shadow-sm sm:px-5">
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

      <section className="rounded-lg border border-border/70 bg-card px-4 py-4 shadow-sm sm:px-5">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">
            Основные понятия
          </h2>
        </div>
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

      <section className="rounded-lg border border-border/70 bg-card px-4 py-4 shadow-sm sm:px-5">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">
            Что важно помнить
          </h2>
        </div>
        <div className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
          <p>
            Кампания связывает общий смысл, публикации, аудитории, UTM, метрики
            и ретроспективу. Публикация остается самостоятельной, потому что у
            каждого канала свои сроки, формат, ссылка, ограничения и результат.
          </p>
          <p>
            Ручные действия сейчас не являются слабостью системы. Это честный
            первый слой: команда получает понятный журнал работы, а интеграции
            подключаются там, где они стабильны, прозрачны и дают меньше риска,
            чем ручной процесс.
          </p>
          <p>
            Если раздел кажется избыточным, его задача не усложнить работу, а
            сделать явными вещи, которые раньше жили в голове, в Excel, в чатах
            или в разных сервисах.
          </p>
        </div>
      </section>

      <section className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-4 shadow-sm sm:px-5">
        <div className="flex items-center gap-2 text-primary">
          <Sparkles className="h-4 w-4" />
          <h2 className="text-sm font-semibold">Куда двигаться дальше</h2>
        </div>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          После этой общей справки следующие шаги: подробная помощь по календарю,
          публикациям, адаптациям и готовности; затем по кампаниям, проверке,
          аудиториям, метрикам, эффективности, ретроспективам и справочникам.
          После объяснения текущего каркаса можно безопасно переходить к импорту
          плана из Excel, матрице каналов, очереди публикации и интеграциям.
        </p>
      </section>
    </div>
  );
}
