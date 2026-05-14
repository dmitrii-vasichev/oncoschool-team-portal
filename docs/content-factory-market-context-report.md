# Рыночный контекст и best practices для внутренней «контент-фабрики»

**Проект:** русскоязычный медицинский edu-проект: онкология / онко-школа / медицинский туризм  
**Команда:** 7–10 человек  
**Горизонт исследования:** 2025–2026, открытые источники, проверка на 13 мая 2026  
**Цель:** не проектировать готовый модуль, а дать рыночный контекст, продуктовые паттерны, API-реальность и грабли для обоснованного концепта внутреннего модуля.

## Вводный вывод

По вашим данным уже видна не просто «редакция», а гибридная операционная система: контент-календарь, сегментные рассылки, live-эфиры, медицинский фактчек, много каналов и несколько продуктовых воронок. Это плохо ложится на классические social media SaaS, потому что у них сильны календарь, approvals, визуальное планирование и отчёты по западным соцсетям, но слаба связка **GetCourse-сегменты → Telegram/VK/Dzen/Max/OK → медицинский review → регистрация/покупка**.

Главный проектный вывод: строить нужно не «публикатор во все соцсети», а внутренний **content operations layer**: bundle/campaign, независимые публикации по каналам, сегментная матрица, статусы производства, согласования, источники правды, UTM/click-id, снимки метрик и ретроспектива. Автопубликацию стоит добавлять только там, где API стабилен и реально экономит ручной труд.

---

# Раздел 1. SaaS-решения для редакционных контент-календарей

## TL;DR

Для команды 7–10 человек наиболее полезны не enterprise-функции вроде omnichannel social listening, а три вещи: **drag-and-drop календарь, approval/version workflow, campaign/bundle linking**. Из глобальных SaaS наиболее релевантны Planable, CoSchedule, Hootsuite, Sprout Social, SocialPilot, Loomly и Airtable. Но для русского стека 2025–2026 они не закрывают TG/VK/Max/Dzen/OK как нативные каналы, поэтому копировать нужно паттерны, а не пытаться заменить весь процесс западным SaaS.

## Сравнение 7 наиболее релевантных решений

| SaaS | Лучше всего подходит | Цена, ориентир 2025–2026 | API / интеграции | Платформы | TG/VK/Max/Dzen/OK | Кастомные поля | Campaign / bundle | Drag-drop calendar | AI | Метрики | Вердикт для вашего кейса |
|---|---|---:|---|---|---|---|---|---|---|---|---|
| **Planable** | Редакционное согласование, preview постов, approvals | Basic/Pro по workspace; analytics/social inbox как add-on | Публичная API-история ограничена; сильнее через UI и интеграции | Facebook, Instagram, LinkedIn, X, TikTok, YouTube, Google Business и др. | Нативной поддержки TG/VK/Max/Dzen/OK не нашёл | Labels/tags можно использовать как рубрика/нозология/сегмент | В 2026 усилили Campaigns: brief, assets, drafts, approvals, timeline, analytics | Да | AI writing/ideas в продукте | Page/post-level analytics в add-on | Хороший образец approvals и campaign workspace, но плохой fit для русских каналов |
| **CoSchedule** | Marketing calendar, campaigns, связка задач и публикаций | Планы зависят от продукта; social calendar/marketing calendar отдельно | Публичного API нет; есть Webhooks/Zapier | Facebook, Instagram, LinkedIn, X, Pinterest, TikTok, YouTube Shorts, Mastodon, Bluesky, Threads | TG/VK/Max/Dzen/OK нет | Tags/projects/campaigns | Social Campaign группирует несколько social messages; отчёт по campaign | Да | AI Campaign Assistant | Social Campaign Reports, UTM через Google Analytics integration | Очень хороший паттерн campaign + tasks + UTM, но не как готовая платформа для РФ-каналов |
| **Hootsuite** | Большие команды, social inbox, платформа управления западными соцсетями | От ~$99/user/month и выше; Team/Business дороже | REST API 1.0, integrations ecosystem | Facebook, Instagram, X, LinkedIn, TikTok, YouTube, Threads, WhatsApp, Pinterest | Нативной поддержки RU-платформ нет | Есть tagging/streams/assignments, но кастомные поля ограничены SaaS-логикой | Campaign planning есть, но сильнее как social management suite | Да | OwlyWriter AI | 120+ metrics, dashboards, post performance | Для команды 7–10 человек часто overkill; полезен как reference для analytics/inbox, но не для вашего core |
| **Sprout Social** | Enterprise-grade reporting, approvals, inbox, social care | Standard от ~$199/seat/month, Professional/Advanced выше | API/enterprise integrations; сильный reporting слой | Facebook, Instagram, LinkedIn, X, TikTok, YouTube, Pinterest, Google Business, WhatsApp и др. | RU-платформы не закрывает нативно | Tags, profiles, reports; кастомность в рамках продукта | Campaign/reporting сильные, но enterprise-oriented | Да | AI assist / AI alt text / writing helpers | Premium analytics, cross-network reporting | Слишком дорого и западноцентрично; копировать только dashboards/approval discipline |
| **SocialPilot** | Дешевле для small team / agency, bulk scheduling | Standard/Premium/Ultimate; ориентир десятки–сотни $/мес | API доступ обычно в Enterprise/custom | Facebook, Instagram, TikTok, X, LinkedIn, Threads, YouTube, Pinterest | RU-платформ нет | Client/workspace fields ограничены | Есть approvals/client approval и bulk workflows | Да | AI assistant | Analytics/reports, white-label reports | Практичный SaaS для западных соцсетей, но не решает мед-воронки и RU API |
| **Loomly** | Простая редакционная доска, calendar, approvals, custom channels | Base/Standard/Advanced от десятков $/мес; ежегодно дешевле | API не является главным selling point | Facebook, Instagram, LinkedIn, X, TikTok, YouTube, Pinterest, Snapchat, Threads, Bluesky, Google Business | Нативно нет, но есть **Custom Channel** для неподдерживаемых каналов | Labels/categories + custom channel workflow | Campaign/ideas/library есть, но проще, чем у CoSchedule | Да | AI post ideas/copy | Analytics базовые/средние | Очень полезен как модель «custom channel + manual publishing», близко к вашему реальному миру |
| **Airtable + Marketing Campaign template** | Гибкая база: поля, статусы, связи, views, automations | Team ~$20/user/month annual; Business выше | Web API, automations, extensions | Не social-публикатор, а no-code database | Можно смоделировать любые каналы | Отлично: рубрика, нозология, сегмент, врач, funnel, UTM, статус | Отлично через linked records: campaign → publications → metrics | Calendar/timeline views есть | Airtable AI / automations | Метрики только через импорты/API | Лучший прототипный паттерн для внутреннего модуля: данные и связи, но не публикатор |

## Что реально работает для русского рынка после ограничений 2022+

Глобальные SaaS в основном построены вокруг Meta, X, LinkedIn, TikTok, YouTube, Pinterest и Google Business. В их публичных списках поддерживаемых платформ я не нашёл нативной поддержки **VK, Dzen, Одноклассников, Max** и устойчивой поддержки **Telegram как publishing+analytics канала**. Даже если сервис доступен из конкретной страны и его можно оплатить, операционный риск остаётся: аккаунты, OAuth, платежи, legal/compliance, нестабильность доступа и отсутствие русских API-объектов.

Практический вывод: для вашего портала западный SaaS стоит рассматривать как **референс интерфейса и процессов**, а не как replacement. Исключение — если Instagram/YouTube/Shorts станут отдельным масштабным направлением с западными аккаунтами и понятной оплатой; тогда Hootsuite/SocialPilot/Loomly/Buffer-подобные инструменты можно использовать точечно.

## Какие паттерны стоит скопировать

**1. Campaign / Bundle workspace.**  
Один эфир, вебинар, пациентская история или медтуристическая тема должны иметь общий workspace: brief, сегменты, канал-матрицу, связанные публикации, задачи, UTM, assets, версии, метрики и ретроспективу. Это паттерн CoSchedule Social Campaign, Planable Campaigns и Airtable linked records.

**2. Approval workflow с версионностью.**  
Для медицинского контента критично видеть: кто написал, кто отредактировал, что проверил фактчекер, что подтвердил эксперт-врач, какая версия ушла в публикацию. Это не «красивый workflow», а защита от медицинских, юридических и репутационных ошибок.

**3. Custom channel / manual publishing ledger.**  
У Loomly полезен подход Custom Channel: даже если платформа не поддерживается API, она есть в календаре, у неё есть текст, медиа, статус, ответственный и факт публикации. Для Max/Dzen/OK/VK/TG это часто реалистичнее, чем сразу строить auto-publisher.

**4. Labels/taxonomy-first.**  
Рубрика, нозология, сегмент, funnel, продуктовый поток, формат, врач/эксперт, уровень чувствительности, тип CTA — это не заметки в комментариях, а поля данных. Внутренний модуль должен строиться вокруг таксономии.

## От чего отказаться как от over-engineering

Для команды 7–10 человек не стоит на первом этапе копировать enterprise social suites целиком. Низкий приоритет: social inbox, sentiment analysis, competitor benchmarking, сложные approval chains на 7 уровней, ML-рекомендатель лучшего времени публикации, paid-social attribution, auto-rescheduler и полноценный social listening. Эти функции дорогие в разработке и будут давать мало ценности, пока не стабилизированы базовые сущности: campaign, publication, segment, approval, metric snapshot, retrospective.

## Источники раздела

1. Planable supported platforms: https://help.planable.io/en/articles/2835807-what-platforms-does-planable-support  
2. Planable pricing / analytics add-on: https://planable.io/pricing/  
3. Planable campaigns: https://planable.io/blog/campaigns/  
4. CoSchedule Social Calendar / Marketing Calendar: https://coschedule.com/product/social-calendar  
5. CoSchedule supported social accounts: https://support.coschedule.com/  
6. CoSchedule webhooks / no public API: https://support.coschedule.com/  
7. Hootsuite plans: https://www.hootsuite.com/plans  
8. Hootsuite integrations: https://www.hootsuite.com/integrations  
9. Sprout Social pricing: https://sproutsocial.com/pricing/  
10. Sprout Social publishing and analytics: https://sproutsocial.com/features/social-media-publishing/  
11. SocialPilot pricing: https://www.socialpilot.co/plans  
12. Loomly pricing: https://www.loomly.com/pricing  
13. Loomly supported platforms / custom channels: https://www.loomly.com/  
14. Airtable pricing: https://airtable.com/pricing  
15. Airtable Web API: https://airtable.com/developers/web/api/introduction  
16. Adobe ContentCal acquisition / Adobe Express Scheduler: https://blog.adobe.com/en/publish/2022/01/25/adobe-completes-acquisition-contentcal and https://www.adobe.com/express/feature/content-scheduler

---

# Раздел 2. Архитектурные паттерны для cross-platform publishing

## TL;DR

У зрелых продуктов редко бывает «один пост, который магически одинаково живёт во всех каналах». На практике они либо создают campaign с набором social messages, либо дают post composer с channel-specific variants. Для вашего кейса устойчивее модель **Sibling Posts linked by Bundle**, потому что Telegram, VK, Max, Dzen, OK, email и GetCourse-сегменты слишком разные по форматам, метрикам, UTM и статусам.

## Подход A: Single Post + Variants per Channel

Идея: есть одна логическая публикация, у неё несколько вариантов по каналам. Это выглядит естественно, когда команда говорит: «один и тот же пост нужно адаптировать для TG/VK/Max/Dzen». На старте это удобно: общий topic, общий brief, один owner, единый дедлайн.

### Пример модели данных

```text
content_item
- id
- campaign_id
- title
- source_type: transcript | doctor_note | article | patient_story | event_announcement
- rubric_id
- nosology_id
- medical_sensitivity: low | medium | high
- objective: reach | registration | show_up | purchase | lead | retention
- owner_user_id
- canonical_brief
- source_material_refs[]
- global_status: draft | in_review | approved | scheduled | published | archived
- created_at
- updated_at

post_variant
- id
- content_item_id
- platform: telegram | vk | max | dzen | ok | instagram | youtube | email | whatsapp | getcourse_push
- audience_segment_ids[]
- body_text
- headline
- media_asset_ids[]
- scheduled_at
- actual_published_at
- platform_post_url
- platform_post_id
- utm_source
- utm_medium
- utm_campaign
- utm_content
- status: draft | needs_copy | needs_design | factcheck | doctor_review | approved | scheduled | published | failed | cancelled
- character_limit
- platform_constraints_json
- metric_status: not_available | pending | fresh | stale | manual

metric_snapshot
- id
- post_variant_id
- captured_at
- window: 3h | 24h | 72h | 7d | custom
- views
- reach
- reactions
- comments
- reposts
- clicks
- registrations
- purchases
- raw_payload_json
- source: api | tgstat | telemetr | manual | email_provider | getcourse
- freshness_status
```

### Плюсы

Single Post + Variants удобен, когда команда действительно работает от одного исходника: например, расшифровка эфира → Telegram-анонс → VK-лонгрид → email-фрагмент → push на 200 знаков. Он снижает хаос и помогает не забыть адаптации.

Ещё один плюс — AI-пайплайн: модель может брать canonical brief и генерировать варианты по правилам каналов. Для редакции это понятная структура: «вот исходный смысл, вот его версии».

### Минусы

Через 6–12 месяцев этот паттерн ломается, если `content_item` становится слишком жёстким источником правды. Каналы расходятся: в Dzen нужен другой заголовок и длинная структура; в Telegram важен первый экран и кнопка; в VK могут быть другие медиа; в email — сегмент и тема письма; в Max — ограничения на формат и сырая аналитика; в WhatsApp — короткий lifecycle. Один global status начинает врать: TG опубликован, VK отменён, Dzen ушёл на редактирование, email ждёт сегмент, а эфирный пост уже требует ретроспективы.

Главная ошибка — считать channel variants «дочерними копиями». В реальности они становятся самостоятельными рабочими единицами.

## Подход B: Sibling Posts linked by Bundle / Campaign

Идея: есть bundle/campaign как смысловой контейнер, а публикации независимы. Они связаны общей темой, мероприятием, продуктовым потоком и UTM-campaign, но каждая публикация живёт своей жизнью.

### Пример модели данных

```text
campaign_bundle
- id
- name
- product_stream: onco_school | nko | medtourism | alternative | patient_live | expert_live | seasonal
- objective
- event_date
- funnel_id
- owner_user_id
- brief
- target_segments[]
- source_material_refs[]
- status: planning | production | live | retrospective | archived
- created_at
- updated_at

publication
- id
- bundle_id
- platform
- format: button | announcement | warming | follow_up | live | longread | patient_story | digest | push | reel | carousel
- rubric_id
- nosology_id
- audience_segment_ids[]
- title
- body_text
- media_asset_ids[]
- scheduled_at
- actual_published_at
- responsible_user_id
- approval_status
- production_status
- platform_post_url
- platform_post_id
- utm_json
- channel_constraints_json
- version_number
- source_publication_id: optional

publication_relation
- id
- from_publication_id
- to_publication_id
- relation_type: adapted_from | follow_up_to | reminder_for | digest_includes | replaces | crosspost_of

publication_metric_snapshot
- id
- publication_id
- captured_at
- window
- metric_name
- metric_value
- source
- raw_payload_json
- confidence: high | medium | low
```

### Плюсы

Sibling model лучше выдерживает реальность: можно отменить VK-пост без отмены TG; поменять визуал только для Dzen; сделать отдельную UTM-метку для email; добавить Max как экспериментальный канал без переписывания всей сущности. Она хорошо ложится на вашу сетку «мероприятие → сегмент → канал → дублирование» и на 13-листовую Excel-структуру с разными измерениями.

Эта модель также облегчает ретроспективу: можно смотреть bundle-level результат, но не терять channel-level детали.

### Минусы

Если не сделать общий brief и связи, sibling model превращается в набор несвязанных карточек. Тогда команда снова получает «испорченный телефон»: Telegram-пост, VK-пост и email как будто про одно, но с разными смыслами и CTA. Поэтому bundle должен быть не декоративным, а рабочим: owner, goal, source materials, segments, UTM, expected outcome, linked tasks, retrospective.

## Как это делают зрелые продукты

**CoSchedule** ближе к B: marketing campaign / social campaign группирует несколько social messages, задачи и отчёты. **Planable** сочетает channel-specific posts с campaign workspace и approvals. **Hootsuite** и **Sprout Social** сильнее ориентированы на profile/network-level scheduling и analytics: там посты по соцсетям самостоятельны, но объединяются планом, тегами, кампаниями и отчётами. **Airtable** как no-code база вообще подталкивает к B: campaign — linked records — publications — metrics.

Поэтому для внутреннего модуля оптимальна гибридная формула:

```text
Bundle / Campaign = смысл, цель, сегменты, источник, UTM-campaign, ретроспектива.
Publication = самостоятельная единица производства и публикации.
Variant = техническая/AI-версия внутри publication, если нужен черновик, редакторская версия, версия врача, финальная версия.
```

## Какой паттерн чаще ломается на проде

Чаще ломается **A в жёстком виде**, когда разработчики делают «один post entity + N variants» и затем пытаются все статусы, метрики, ссылки, ошибки публикации, approvals и дедлайны держать на родителе. Через несколько месяцев появляются костыли: `vk_status`, `tg_status`, `email_status`, `dzen_title`, `max_override_text`, `manual_metric_comment`, `utm_override`, `is_cancelled_only_for_vk`. Это симптом, что публикации должны быть самостоятельными.

Но и чистая B-модель ломается, если нет bundle-level discipline. Тогда контент перестаёт быть воронкой и снова становится таблицей разрозненных постов.

## Рекомендация для вашего портала

Использовать **Bundle-first + independent publications**. Каждый эфир, пациентская история, вебинар, медтуристический кейс или сезонная активность — это `campaign_bundle`. Каждая публикация в TG/VK/Max/Dzen/OK/email/WhatsApp/GetCourse push — отдельная `publication`. AI может генерировать варианты из bundle brief, но финальная публикация должна иметь собственные поля, статусы, UTM, approvals и metrics.

## Источники раздела

1. CoSchedule Social Campaigns / campaign reports: https://coschedule.com/  
2. CoSchedule UTM / Google Analytics integration: https://support.coschedule.com/  
3. Planable Campaigns: https://planable.io/blog/campaigns/  
4. Planable approvals and workflows: https://help.planable.io/  
5. Hootsuite publishing and analytics: https://help.hootsuite.com/  
6. Sprout Social publishing calendar: https://sproutsocial.com/features/social-media-publishing/  
7. Sprout Social analytics: https://sproutsocial.com/features/social-media-analytics/  
8. Loomly custom channels: https://www.loomly.com/  
9. Airtable linked records / API: https://airtable.com/developers/web/api/introduction  
10. Airtable marketing campaign templates: https://airtable.com/templates/marketing

---

# Раздел 3. API метрик из соцсетей: РФ-стек 2025–2026

## TL;DR

Надёжной единой API-картины для TG/VK/Max/Dzen/OK нет. Telegram можно частично закрывать через MTProto/Telethon, TGStat/Telemetr и ограниченно Bot API; VK имеет API и статистику, но потребуется аккуратная авторизация и лимиты; Max и Dzen — самые проблемные для пост-level аналитики; email и GetCourse API выглядят намного более зрелыми. Поэтому модуль должен хранить не только метрики, но и **источник, окно измерения, задержку, confidence и raw payload**.

## Сравнительная таблица API и интеграций

| Платформа | Реальный API-статус | Можно ли получить метрики 1 публикации | Лимиты / задержки / ограничения | Рабочий путь для портала | OSS / референсы | Вердикт |
|---|---|---|---|---|---|---|
| **Telegram** | Bot API даёт ограниченные updates; MTProto/Core API имеет `messages.getMessagesViews`, `stats.getBroadcastStats`, `stats.getMessagePublicForwards`; TGStat/Telemetr дают стороннюю аналитику | Да, но не идеально: views через MTProto, reactions через Bot API updates/Telethon, forwards частично; reach как у соцсетей — нет | Bot API не даёт полноценную post analytics; для stats нужны права администратора/пользовательская сессия; TGStat/Telemetr могут иметь задержки и тарифы | Для своих каналов: Telethon/Pyrogram + админ-доступ + snapshots T+24h/T+72h; для внешней валидации — TGStat/Telemetr; хранить confidence | Telethon, Pyrogram, tgstat-api-client, telegram-stat | Рабочая, но не «чистая Bot API» интеграция |
| **VK** | VK API имеет методы wall/stats/reactions; у VK есть кабинет статистики со статистикой сообщества и постов | Да, через wall/stats/reactions и/или кабинетную статистику, но зависит от прав и типа данных | Rate limits, токены, права администратора, возможные изменения API | OAuth/service token, регулярный polling wall posts, comments/reactions/reposts, snapshot windows | vk_api Python, vkwave, vk-top-posts, Spevktator | Рабочая интеграция, одна из наиболее реалистичных среди RU соцсетей |
| **Max** | Есть Bot API и документация по сообщениям/ботам; публичного достоверного API пост-level метрик каналов я не нашёл | Достоверного публичного API для охватов/реакций/репостов публикаций не нашёл | Платформа новая, API быстро меняется; analytics чаще через сторонние сервисы MaxStat/LiveDune | Сначала manual ledger + ссылки + ручные метрики; позднее подключить сторонние сервисы или официальный API, если появится | max-botapi-python, max-botapi-typescript, maxogram | Не закладывать как зрелую API-интеграцию; делать как экспериментальный канал |
| **Dzen** | Нет устойчивого публичного organic author analytics API в привычном виде; есть встроенная статистика и Яндекс.Метрика для сайта/трафика | Для органического контента — сомнительно; через UI/экспорт/парсеры или сторонние сервисы | Данные в кабинете; API для рекламных/промо кейсов не равно авторской аналитике | Manual import/export или парсер; для сайта медтуризма использовать Метрику API | Yandex-Zen-Parser, yandx-zen-scraper, YandexZen старые проекты | Скорее парсер/manual, не ядро автосбора |
| **Одноклассники** | OK API имеет REST-методы, group methods, counters; исторически были group stat methods | Частично возможно по группам/публикациям, но надо проверять актуальные методы и права | Требуется app id/key/secret, токены, админ-доступ; методы статистики могут отличаться от UI | Делать proof-of-concept на конкретной группе: group counters + post data + manual fallback | apiok/documentation, python-odnoklassniki, aiookru, ok.ru Node clients | Возможна интеграция, но нужна пилотная проверка на реальном аккаунте |
| **Instagram** | Instagram Graph API для Professional/Business accounts; media insights доступны для authorized media | Да, для своих professional accounts: impressions/reach/engagement-type metrics, с ограничениями по API | Для РФ-команд операционно сложно: доступ, блокировки, аккаунты, посредники; private API рискован | Если канал ведётся через отдельного ответственного, хранить manual/Graph API import; не строить core вокруг Instagram | tap-instagram, Instagram Graph API SDKs, instagrapi как рискованный unofficial | Технически зрелая, но организационно/юридически нестабильная для РФ-контекста |
| **Email: Unisender / Mailchimp / Sendsay / SendPulse / DashaMail** | Большинство дают API статистики; SendPulse/Mailchimp дают webhooks событий; Unisender/Sendsay/DashaMail имеют API/интеграции | Да: delivery, opens, clicks, bounces, CTR, CTOR, unsubscribes на campaign/message level | Apple MPP и privacy искажают open rate; клики надёжнее открытий; webhooks зависят от тарифа | Email должен быть первой зрелой интеграцией: API + webhooks + campaign_id/utm | Mailchimp official Python, SendPulse API, UniSender clients, Sendsay API client | Рабочая интеграция; метрики качественнее соцсетей |
| **GetCourse** | Есть API импорта/экспорта пользователей, заказов; есть UTM-источники, сегменты, mailing categories | Не соцметрики, но можно получать регистрации/заказы/сегменты/UTM | API требует аккуратной схемы прав; сегменты лучше зеркалить read-only | Source of truth для сегментов и conversion events; портал хранит snapshot, не редактирует сегменты | getcourse-api TypeScript, getcourse-js-sdk | Ключевая интеграция для атрибуции и сегментов |

## Telegram подробнее

Telegram — центральный канал, но он не даёт «соцсетевую аналитику» в том виде, как VK или Meta. Bot API полезен для публикации ботом и некоторых updates: например, `message_reaction_count` приходит, если бот администратор и подписан на нужные updates, но это не полноценная аналитика поста. Для views и статистики канала нужно смотреть в сторону MTProto/Core API и библиотек вроде Telethon/Pyrogram, где доступны методы вокруг просмотров, broadcast stats и public forwards.

TGStat и Telemetr полезны как сторонний слой, но их данные нужно маркировать как external estimate / partner data. Для принятия решений лучше хранить несколько окон: T+3h, T+24h, T+72h, T+7d. В вашем Excel уже есть логика «сутки / 3 дня», её стоит сохранить как операционный стандарт.

## VK подробнее

VK — самый реалистичный кандидат для API-метрик среди русских соцсетей. Можно опрашивать публикации, реакции, комментарии, репосты, статистику сообщества и постов, если есть права. Ограничения: токены, rate limits, разная доступность методов, возможные изменения API. Внутри портала лучше сделать адаптер с raw payload, чтобы при изменении VK API не терять историю.

## Max подробнее

Max — новый канал и поэтому архитектурно опасен. Есть Bot API, есть клиенты на GitHub, есть сторонние сервисы аналитики вроде MaxStat/LiveDune, но я не нашёл достоверного публичного официального API для регулярного получения охвата/просмотров/реакций по одной публикации. Его нельзя проектировать как «полностью автоматизированный канал». Правильный паттерн: добавить Max в `platform_capabilities` как `manual_publish=true`, `metrics_api=false`, `supports_post_url=unknown/true`, `metrics_source=manual|partner`.

## Dzen подробнее

Для Dzen часто встречается проблема: есть кабинет статистики, есть Яндекс.Метрика для сайта и трафика, но нет удобного публичного API для органической авторской статистики постов. Поэтому Dzen в портале лучше вести через manual import/export, парсер или сторонний сервис. Если медтуризм-сайт развивать как SEO-канал, Яндекс.Метрика API гораздо полезнее, чем попытка получить всё из Dzen.

## Email и GetCourse как «опорная аналитика»

Email и GetCourse должны стать более надёжной частью системы, чем соцсети. Открытия в email искажены privacy-технологиями, но клики, доставки, отписки, регистрации, заказы и UTM всё ещё дают хорошую attribution-картину. Для портала важно связать `publication_id` → UTM/click_id → GetCourse user/order/session → event registration/purchase.

## Паттерн хранения метрик

Не хранить «охват» как один плоский столбец. Хранить снимки:

```text
metric_snapshot
- publication_id
- metric_window: 3h | 24h | 72h | 7d | final
- metric_name
- value
- captured_at
- source
- source_method: api | partner_api | parser | manual | import
- confidence: high | medium | low
- raw_payload_json
- note
```

Так команда будет видеть не только число, но и его надёжность. Это критично, если TGStat, ручной Dzen, VK API и email API дают данные с разной задержкой и точностью.

## Источники раздела

1. Telegram Bot API: https://core.telegram.org/bots/api  
2. Telegram Core API `messages.getMessagesViews`: https://core.telegram.org/method/messages.getMessagesViews  
3. Telegram Core API `stats.getBroadcastStats`: https://core.telegram.org/method/stats.getBroadcastStats  
4. Telegram Core API `stats.getMessagePublicForwards`: https://core.telegram.org/method/stats.getMessagePublicForwards  
5. TGStat API: https://tgstat.ru/api  
6. Telemetr Public API: https://telemetr.io/docs/api  
7. Telethon documentation: https://docs.telethon.dev/  
8. VK API methods: https://dev.vk.com/method  
9. vk_api Python: https://github.com/python273/vk_api  
10. vkwave: https://github.com/fscdev/vkwave  
11. Max Bot API docs: https://dev.max.ru/  
12. max-botapi-python: https://github.com/max-messenger/max-botapi-python  
13. LiveDune MAX analytics: https://livedune.com/  
14. Yandex Metrica Reports API: https://yandex.com/dev/metrika/en/stat/  
15. OK API documentation repo: https://github.com/apiok/documentation  
16. Mailchimp Marketing API Reports: https://mailchimp.com/developer/marketing/api/reports/  
17. SendPulse API / webhooks: https://sendpulse.com/integrations/api  
18. Unisender API: https://www.unisender.com/ru/support/api/  
19. GetCourse API: https://getcourse.ru/blog/276029  
20. getcourse-api TypeScript SDK: https://github.com/NiktarioN/getcourse-api

---

# Раздел 4. Patient/Guest sourcing — workflow в медиапроектах

## TL;DR

Поиск пациентов «методом перебора через чат» — главный источник срывов сроков и юридического риска. Зрелый процесс должен быть похож не на случайный чат, а на мини-CRM: open call → screening form → editorial triage → medical/fact gate → legal consent → prep-call → эфир → follow-up. Для медицинского проекта обязательны отдельные согласия на запись, публикацию, персональные данные, медицинскую тайну и использование изображения/голоса.

## Как медиапроекты ищут «обычных людей с историей»

Подкасты, документальные проекты и health-story редакции обычно используют четыре источника:

1. **Open call** в социальных сетях, email и чатах. Формулируется не «кто хочет в эфир», а «ищем людей с конкретной историей для конкретного выпуска».
2. **Referral sourcing**: врачи, кураторы потоков, модераторы чатов, выпускники школы, партнёрские НКО.
3. **Intake form**: Google Forms, Typeform, Tally, Fillout, Paperform. Форма нужна не для красоты, а для первичного отсечения неподходящих историй.
4. **Producer screening call**: короткий созвон 15–30 минут до эфира, чтобы проверить адекватность, безопасность, готовность говорить публично, наличие слишком чувствительных деталей.

## Шаблон open-call объявления

```text
Ищем участника/участницу для эфира проекта [название].

Тема эфира: [например, как пациент проходил лечение / как семья справлялась с диагнозом / опыт реабилитации после лечения].

Кого ищем:
— взрослый пациент или родственник пациента;
— опыт связан с [нозология / этап лечения / ситуация];
— готовность спокойно рассказать свою историю в эфире или записи;
— без рекламы услуг, сборов, личных консультаций и неподтверждённых медицинских рекомендаций.

Что будет:
— предварительный короткий созвон с редактором;
— согласование темы и границ того, о чём можно/нельзя говорить;
— письменное согласие на запись и публикацию;
— эфир с ведущим/экспертом.

Если вам откликается тема, заполните короткую форму: [ссылка].
```

## Минимальные поля screening form

Форма не должна быть длинной, иначе хорошие кандидаты не дойдут. Но для медицины нужен минимальный legal/editorial фильтр.

| Блок | Поля | Зачем |
|---|---|---|
| Контакт | Имя, телефон, email/Telegram, город/часовой пояс | Связаться и планировать эфир |
| Роль | Пациент / родственник / врач / волонтёр / другое | Понять правовой и редакционный статус |
| История | Кратко: что произошло, какой этап, чем история может быть полезна аудитории | Предварительная редакционная оценка |
| Нозология / тема | РМЖ, ЖКТ, мочеполовая, палиатив, лимфология, психоонкология и т.д. | Связка с рубрикатором и календарём |
| Границы | О чём можно говорить, о чём нельзя; можно ли имя/лицо/город | Safety и privacy |
| Медицинские утверждения | Есть ли конкретные claims о лечении, препаратах, клиниках, врачах | Фактчек и риск клеветы/медсоветов |
| Конфликт интересов | Продвигает ли кандидат услуги, сборы, блог, фонд, клинику | Отсечь скрытую рекламу |
| Формат | Эфир / запись / текстовая история / анонимно | Подбор формата |
| Доступность | Даты/время, техническая готовность | Производство |
| Согласия | Первичное согласие на обработку формы и контакт | Законность первичной обработки |

## CRM-стадии гостя/пациента

Для вашего портала это может быть отдельный lightweight pipeline, необязательно полноценная CRM.

```text
sourced
→ applied
→ editorial_screening
→ rejected / maybe_later / shortlisted
→ producer_call_scheduled
→ producer_call_done
→ medical_factcheck_needed
→ doctor_approved
→ consent_sent
→ consent_signed
→ scheduled
→ prep_materials_sent
→ live_or_recorded
→ post_production
→ published
→ gift_sent
→ follow_up_done
```

Каждая стадия должна иметь owner и deadline. Сейчас у вас 25% потерь на этапе доставки подарка через Google Drive; это типичный симптом отсутствия stage-level tracking. «Подарок отправлен» и «подарок получен/скачан» должны быть отдельными статусами, а не сообщением в Telegram.

## Quality-gate: как фильтровать неподходящих гостей

Для patient/guest sourcing нужны отрицательные критерии, иначе редакция тратит время на неподходящие истории.

**Отсекать или переводить в другой формат:**

- история построена на жалобе, конфликте или обвинении без проверяемых фактов;
- человек хочет продвигать свои услуги, блог, сбор, клинику или метод;
- кандидат предлагает медицинские советы вместо личного опыта;
- есть claims о «чудо-лечении», альтернативных методах или отказе от доказательной терапии;
- человек находится в остром эмоциональном состоянии, где публичность может навредить;
- история содержит данные третьих лиц без их согласия;
- речь идёт о несовершеннолетнем без отдельного согласия законного представителя;
- тема юридически чувствительна: врачебная ошибка, суд, персональные данные, конфликт с клиникой.

## Юридические аспекты

Для России и русскоязычного медицинского проекта минимальный набор:

1. **Согласие на обработку персональных данных** по 152-ФЗ.
2. **Согласие на раскрытие сведений, составляющих врачебную тайну**, если участник раскрывает диагноз, лечение, клиники, врачей, анализы, историю болезни. В 323-ФЗ статья 13 прямо ограничивает разглашение врачебной тайны и допускает раскрытие, в том числе для публикации/образования/исследований, при письменном согласии гражданина или законного представителя.
3. **Согласие на запись эфира**: аудио/видео, live/recorded, монтаж, хранение.
4. **Согласие на публикацию**: где именно можно публиковать — Telegram, VK, Dzen, YouTube, сайт, email, GetCourse, будущие каналы.
5. **Согласие на использование изображения и голоса**. Фото/видео могут быть персональными данными, а в некоторых случаях — биометрическими персональными данными.
6. **Отдельные правила для детей**: законный представитель, отдельное согласие, осторожность с диагнозом, лицом, школой, городом.
7. **Withdrawal clause**: что участник может отозвать, а что уже опубликовано и не всегда может быть полностью удалено из репостов/кэшей.

Формально это не заменяет юриста, но продуктово означает: в модуле должны быть поля `consent_status`, `consent_version`, `signed_at`, `allowed_channels`, `anonymity_level`, `sensitive_topics`, `legal_notes`.

## Что насчёт «Радио Свобода» как примера

Я не нашёл открытого формализованного workflow именно «как Радио Свобода ищет и квалифицирует гостей» в виде production playbook. Поэтому безопаснее опираться на общие практики public media, documentary/oral history releases и podcast production: open call, producer screening, release form, editorial standards, consent, фактчек и post-publication follow-up. Если в вашей команде есть конкретный внутренний пример «как делает Радио Свобода», его можно превратить в чеклист, но не стоит выдавать это за публично подтверждённый отраслевой стандарт.

## Источники раздела

1. Beamly podcast guest intake/release workflow: https://www.beam.ly/blog/podcast-guest-intake-form  
2. Podseeker guest release workflow: https://podseeker.co/  
3. Zencastr guest release form guidance: https://zencastr.com/blog/podcast-release-form  
4. Documentary.org appearance release guidance: https://www.documentary.org/  
5. Typeform application form templates: https://www.typeform.com/templates/  
6. Tally forms: https://tally.so/templates  
7. Fillout podcast guest application template: https://www.fillout.com/templates/podcast-guest-application-form  
8. Paperform podcast guest application: https://paperform.co/templates/podcast-guest-application-form/  
9. Highmark Health media consent: https://www.highmarkhealth.org/  
10. UCLA Health media authorization: https://www.uclahealth.org/  
11. 323-ФЗ, статья 13, врачебная тайна: https://www.consultant.ru/document/cons_doc_LAW_121895/  
12. 152-ФЗ, персональные данные: https://www.consultant.ru/document/cons_doc_LAW_61801/  
13. Роскомнадзор о биометрических персональных данных: https://rkn.gov.ru/  
14. Oral history release form examples: https://www.oralhistory.org/

---

# Раздел 5. AI-assisted editorial workflows — что реально работает в 2025–2026

## TL;DR

AI хорошо снимает работу там, где нужно **переформатировать, структурировать, сжать, адаптировать и предложить варианты**. AI плохо подходит как самостоятельный фактчекер медицинского контента и как замена живому голосу врача/эксперта. Для health-edu зрелый паттерн — не «AI пишет посты», а **AI drafts + human editorial + medical review + versioned approval**.

## Сравнение AI-продуктов и применимость к медицинской редакции

| Продукт | Что делает хорошо | Цена/модель, ориентир | Интеграции/API | Где полезен вам | Где опасен | Вывод |
|---|---|---:|---|---|---|---|
| **Jasper** | Brand voice, marketing copy, knowledge base, campaign content | Pro/Business, Business custom; enterprise-oriented | API, knowledge/brand voice, connectors | Черновики, варианты заголовков, брендовый стиль, повторяемые campaign assets | Может уверенно писать медицинские claims без достаточной проверки | Полезен как branded copy engine, но не как medical reviewer |
| **Copy.ai** | Workflow automation, GTM workflows, content generation, brand voice, infobase | От self-serve до enterprise; workflows/credits | Workflows, integrations, API/enterprise | Автоматизировать цепочку: brief → варианты → CTA → email snippets | Дорогой/overkill, если нужен только текст постов | Хорош как reference для workflow builder, но можно повторить проще внутри портала |
| **Writesonic** | SEO/content generation, articles, marketing copy, AI search visibility | Планы меняются; ориентир от десятков $/мес и выше | Интеграции с SEO/content tools | SEO-черновики для медтуризма, meta descriptions, longform drafts | Медицинская точность и стиль врача требуют review | Подходит для SEO-черновиков, не для финальных медсоветов |
| **Claude Projects** | Работа с проектными знаниями, длинные документы, стиль, reasoning | Pro/Team/Enterprise | Project knowledge, team collaboration | Редакционный ассистент с knowledge base: стиль, рубрикатор, правила врача | Нет встроенной публикации/метрик | Хорош для сложных редакционных задач и анализа транскриптов |
| **ChatGPT Custom GPTs** | Инструкции, knowledge, actions/API, повторяемые редакционные ассистенты | Зависит от ChatGPT plan/workspace | Actions через OpenAPI, knowledge files | Custom GPT для «адаптируй под TG/VK/email», «сделай 5 CTA», «сожми push до 200 знаков» | Без строгих источников может галлюцинировать | Хорош для внутреннего редакционного copilota, если есть review gates |
| **Gemini for Workspace** | Работа внутри Docs/Gmail/Drive, генерация и редактирование текста | Workspace Gemini plans | Google Workspace context | Если команда живёт в Google Docs, удобно для черновиков и summary | Не решает портал, метрики, GetCourse | Хорош как офисный помощник, не как content factory backend |
| **BlogSEO AI** | SEO articles, YouTube-to-blog, brand voice, автопубликация в CMS | Basic/Advanced/Max | WordPress/Webflow/Ghost/Notion и др. | Медтуризм SEO: черновики статей, meta, outline | Медицинская валидация обязательна | Узко полезен для SEO-потока |
| **MarketMuse** | Content strategy, briefs, topical gaps, SEO optimization | Free/Optimize/Research/Strategy tiers | SEO/content planning | Планирование SEO-кластеров для сайта медтуризма | Не редакционный календарь соцсетей | Полезен для медтуризм-сайта, но не для TG/VK фабрики |
| **Postiz / Mixpost** | Open-source/self-hosted scheduling, AI/social features в части проектов | Open-source + hosted tiers | Социальные платформы западного стека | Референс self-hosted scheduler UI | Нет зрелой поддержки TG/VK/Max/Dzen/OK; medical review нет | Хорошие OSS-референсы, не готовое решение |

## Где AI реально снимает работу

**1. Транскрипт эфира → структурные артефакты.**  
AI хорошо делает summary, таймкоды, тезисы, Q&A, 5 цитат, 3 анонса, post-live recap, email digest. Это особенно полезно для эфиров с пациентом/экспертом, где исходный материал длинный.

**2. One-to-many adaptation.**  
Из одного bundle brief AI может сделать: Telegram-пост, VK-лонгрид, Dzen-outline, Max-короткий вариант, email subject/preheader, push 200 знаков, WhatsApp-сообщение, подпись для Reels/Shorts. Но это должны быть **черновики**, не финал.

**3. CTA и A/B варианты.**  
AI хорошо генерирует 5–10 вариантов заголовка, кнопки, первого абзаца, subject line, preheader. Это снимает «чистый лист», но выбор должен делать редактор по цели сегмента.

**4. Технические форматы.**  
Сжать до 200 знаков, убрать канцелярит, сделать plain-language версию, адаптировать для тёплой/холодной базы, превратить лонгрид в карусель — это сильная зона AI.

**5. Ретроспективные summary.**  
AI может сравнить посты недели, найти паттерны: «экспертные посты по РМЖ дают больше early reach, но кнопки дают клики», «реакции высокие, регистраций мало», «подарок теряется после шага X». Но численные выводы должны опираться на вашу базу метрик.

## Где AI ломает доверие

**Фактчек медицинского контента.** AI может звучать уверенно и ошибаться. Для онкологии это недопустимо. Он может помочь составить список claims для проверки, но не быть финальным проверяющим.

**Личный голос врача.** Врач-публичное лицо ценен не только фактами, но и интонацией, опытом, границами. AI-текст часто сглаживает личность до «правильной канцелярии». Нужно хранить voice guide и реальные примеры «как говорит эксперт».

**Чувствительные темы.** Палиатив, психоонкология, семейные истории, страх смерти, отказ от лечения, конфликт с врачами — зоны, где AI-стилизация может стать бесчеловечной или этически опасной. Здесь нужен human-in-the-loop с повышенным уровнем review.

## Рекомендуемый AI workflow

```text
1. Source material
   transcript / doctor notes / webinar plan / patient form / article

2. AI extraction
   key points, claims list, sensitive topics, audience-fit, possible CTAs

3. Editorial draft
   AI drafts variants by channel using style guide and channel constraints

4. Copy editor
   removes канцелярит, checks voice, trims, aligns with CTA

5. Medical/fact review
   doctor/expert/factchecker checks claims, contraindications, wording

6. Compliance snapshot
   final version stored with reviewer, timestamp, source materials

7. Publication
   manual/API publish, platform link, UTM

8. Metrics + retrospective
   AI may summarize performance, but numbers come from metric snapshots
```

## Prompt-паттерн для medical copy

```text
Ты редакционный ассистент, не врач и не фактчекер.
Задача: подготовить черновик публикации, не добавляя факты вне источника.

Контекст:
- продуктовый поток: [онко-школа / НКО / медтуризм]
- аудитория: [сегмент]
- канал: [Telegram/VK/email/etc.]
- формат: [анонс/дожимной/кнопка/история]
- цель: [регистрация/доверие/клик/просмотр]
- нозология: [если есть]
- уровень чувствительности: [low/medium/high]

Источники, которые можно использовать:
[вставить тезисы/транскрипт/документ]

Правила:
- не добавляй медицинские факты, которых нет в источниках;
- не обещай результат лечения;
- не давай индивидуальных медицинских рекомендаций;
- выдели все медицинские утверждения в блок “Claims for factcheck”;
- предложи 3 варианта заголовка и 2 CTA;
- стиль: живой, без канцелярита, но спокойно и уважительно;
- финал пометь как “черновик для редактора и врача”.
```

## Модель выбора AI по задачам

- **Транскрипты, длинный контекст, reasoning:** Claude Projects / ChatGPT с project knowledge.
- **Повторяемые редакционные GPT-инструменты:** ChatGPT Custom GPTs + Actions.
- **Brand voice и marketing copy:** Jasper / Copy.ai.
- **Google Docs workflow:** Gemini for Workspace.
- **SEO-медтуризм:** MarketMuse + BlogSEO AI / Writesonic, но с врачебным review.
- **Self-hosted scheduling reference:** Postiz/Mixpost, но только как UI/architecture reference.

## Источники раздела

1. Jasper pricing and Brand Voice: https://www.jasper.ai/pricing and https://www.jasper.ai/brand-voice  
2. Jasper API / Knowledge: https://developers.jasper.ai/  
3. Copy.ai pricing and workflows: https://www.copy.ai/prices  
4. Copy.ai platform: https://www.copy.ai/  
5. Anthropic Claude Projects: https://support.anthropic.com/  
6. OpenAI Custom GPTs help: https://help.openai.com/en/articles/8554397-creating-a-gpt  
7. OpenAI GPT Actions: https://platform.openai.com/docs/actions  
8. Google Workspace Gemini updates: https://workspaceupdates.googleblog.com/  
9. Google Workspace with Gemini help: https://support.google.com/a/answer/13623623  
10. BlogSEO AI: https://www.blogseo.ai/  
11. MarketMuse pricing/product: https://www.marketmuse.com/pricing/  
12. WHO guidance on large multi-modal models for health: https://www.who.int/publications/i/item/9789240084759  
13. NHS England AI information governance guidance: https://www.england.nhs.uk/long-read/artificial-intelligence-ai-and-information-governance/  
14. CDC plain language health communication: https://www.cdc.gov/health-literacy/php/toolkit/index.html  
15. Postiz open-source scheduler: https://github.com/gitroomhq/postiz-app  
16. Mixpost open-source scheduler: https://github.com/inovector/mixpost

---

# Раздел 6. Audience-segment-driven publishing

## TL;DR

В вашем проекте сегмент аудитории — не вторичный тег, а первичная операционная сущность. Поэтому модуль должен строиться вокруг матрицы **Segment × Channel × Format × Funnel event**, а GetCourse лучше оставить source of truth и зеркалить read-only. CDP уровня Mindbox/Sendsay/Segment.io имеет смысл только если появится реальная потребность в real-time journey orchestration, а не просто желание «сделать красиво».

## Как зрелые edtech / health-edu проекты организуют сегменты

Обычно есть три уровня зрелости.

**Уровень 1: сегменты живут в платформе рассылок / LMS.**  
Это похоже на ваш текущий GetCourse. Плюс — не надо строить CDP. Минус — редакция не видит сегменты в календаре и не контролирует, как контент связан с доходимостью.

**Уровень 2: read-only mirror сегментов в операционном портале.**  
Портал подтягивает название сегмента, размер, ссылку на GetCourse, дату обновления, где использовался, пересечения/исключения. Редакция планирует по сегментам, но не меняет source-of-truth. Это лучший уровень для вашей команды.

**Уровень 3: CDP / customer journey orchestration.**  
Mindbox, Sendsay CDP, Segment.io и подобные системы собирают события, профили, сегменты и запускают омниканальные сценарии. Это имеет смысл, когда есть много real-time триггеров, события с сайта/бота/приложений, paid media, сложная персонализация и необходимость управлять consent/identity. Для команды 7–10 человек это может быть лишней тяжестью, если главная боль — календарь, согласование и ретроспектива.

## Segment × Channel × Format matrix

Внутри портала нужна таблица не «посты», а матрица планирования.

| Поле | Пример | Зачем |
|---|---|---|
| Segment | «Были на 1 и 2 дне без покупки» | Целевая аудитория |
| Segment source | GetCourse link / segment_id | Источник правды |
| Segment size | 2624 | Приоритет и потенциал |
| Exclusions | «не были на альтернативе», «исключить уже купивших» | Не спамить и не путать воронки |
| Journey stage | cold / warm / post-webinar / alumni / medtourism lead | Разный tone и CTA |
| Channel | TG, email, WhatsApp, GetCourse, VK, Max | Доставка |
| Format | анонс, кнопка, дожимной, эфир, digest, push | Операционная форма |
| Objective | регистрация / show-up / покупка / доверие / лид | KPI |
| CTA | registration link / gift / reply / consultation | Что должен сделать человек |
| UTM/click_id | generated per publication | Атрибуция |
| Cadence cap | не чаще X сообщений в Y дней | Защита от перегруза |
| Owner | главред / техбэк / дизайнер | Ответственность |
| Success metric | CTR, registration rate, show-up, purchase, reply quality | Не единый KPI для всех |

## GetCourse как source of truth

У вас уже есть важная дисциплина: перед использованием сегментов проверять пересечение аудитории и исключать на разные мероприятия. Это должно стать системным правилом в портале.

Модель read-only mirror:

```text
external_segment
- id
- source: getcourse
- source_segment_id
- name
- source_url
- population_count
- last_fetched_at
- filter_hash
- description
- owner
- is_active

segment_snapshot
- id
- external_segment_id
- fetched_at
- population_count
- raw_payload_json
- notes

publication_segment_target
- publication_id
- external_segment_id
- role: target | exclusion | control | retargeting
- expected_count
- actual_count_at_send
```

Важно: портал не должен на первом этапе редактировать сегменты в GetCourse. Иначе появится split-brain: техслужба меняет сегмент в GetCourse, редакция меняет в портале, и никто не знает, что реально ушло в рассылку.

## CDP vs Customer Journey Orchestration

**CDP** — это про unified customer profile: события, свойства, identity resolution, аудитории, синхронизация в каналы.  
**Customer Journey Orchestration** — это про сценарии: если человек сделал X, через Y часов отправить Z, если не кликнул — другой канал, если купил — исключить.

Для вашего кейса сейчас достаточно:

- GetCourse как источник сегментов и регистраций;
- портал как planning/operations layer;
- UTM/click_id factory;
- server-side event capture для регистраций/покупок;
- read-only segment snapshots;
- ручные/полуавтоматические рассылки с контролем статусов.

Смотреть Mindbox/Sendsay CDP стоит, если появятся признаки: десятки сценариев, разные каналы с автоматическими триггерами, необходимость real-time персонализации, paid ads retargeting, сложная consent-логика и отдельный owner на marketing automation.

## Атрибуция в 2025 после cookies

Для вашего проекта не нужно начинать с сложного multi-touch attribution. Рабочий минимум:

1. **UTM на каждую publication**, а не только на campaign.
2. **Shortlink/click_id**, который сохраняет `publication_id`, `segment_id`, `channel`, `bundle_id`.
3. **Server-side event** при регистрации/покупке: landing page или GetCourse событие должно сохранять UTM/click_id.
4. **First-party tracking**, где возможно: свой сайт медтуризма, свои лендинги, свой Telegram bot.
5. **Snapshot segment size at send time**, потому что сегмент может измениться после отправки.

В Excel сейчас есть email CTR/CTOR, Telegram/VK/Dzen охваты и GetCourse-сегменты отдельно. В портале эти миры нужно связать: не просто «пост набрал 934 охвата», а «пост в bundle X для segment Y дал N кликов, M регистраций, K покупок или лидов».

## Что значит «успешный пост» для разных сегментов

| Сегмент / стадия | Главный KPI | Вторичные признаки | Что не считать успехом |
|---|---|---|---|
| Холодная база | qualified click rate, registration rate | сохранения, вопросы, подписки | реакции без кликов |
| Тёплая база после вебинара | show-up, purchase intent, переход на оплату | ответы, комментарии с вопросами | просто высокий охват |
| Участники без покупки | повторная регистрация, альтернатива, консультация | клики на дожимной контент | лайки на эмоциональный пост |
| Alumni / бывшие участники | retention, referral, repeat engagement | репосты, рекомендации | продажи любой ценой |
| Медтуризм leads | qualified lead, consultation booking | скачивание методички, reply в WhatsApp | общий CTR без квалификации |
| НКО / grant obligation | регулярность, reach среди целевой группы, доказательство публикации | комментарии/репосты | только коммерческие метрики |

## Источники раздела

1. Mindbox CDP / marketing automation: https://mindbox.ru/  
2. Sendsay CDP / персонализация: https://sendsay.ru/  
3. Twilio Segment CDP: https://segment.com/product/customer-data-platform/  
4. Segment documentation: https://segment.com/docs/  
5. Segment Audiences: https://segment.com/docs/engage/audiences/  
6. Tealium customer data orchestration guide: https://tealium.com/  
7. Server-side tracking overview: https://www.analyticsmania.com/  
8. UTM and first-party attribution guides: https://www.analyticsmania.com/post/utm-parameters/  
9. GetCourse UTM/source tracking: https://getcourse.ru/blog/  
10. GetCourse segments and mailing categories: https://getcourse.ru/blog/  
11. CXL conversion research / attribution thinking: https://cxl.com/blog/conversion-research/

---

# Раздел 7. Retrospective / «что зашло» — паттерны

## TL;DR

Ретроспектива должна быть не обсуждением «топ-постов», а регулярным operating review: что планировали, что опубликовали, что сработало по цели, где сломался процесс, что меняем на следующей неделе. Для медицинского edu-проекта реакции не могут быть главным KPI: они часто показывают эмоциональность, но не регистрацию, доходимость, покупку, доверие или quality lead.

## Как думают зрелые newsroom и media teams

Newsroom analytics в зрелых редакциях не сводится к pageviews. Reuters Institute и Data Journalism Handbook подчёркивают: метрики полезны, но они не заменяют editorial judgment и mission. American Press Institute / Metrics for News предлагает подход, где метрики согласуются с редакционными ценностями и бизнес-моделью. The Atlantic, Vox Media и другие media organizations часто смотрят не только на разовые просмотры, но и на engagement over time, time spent, subscriber actions, conversion/churn signals.

Для вас это означает: не делать единый «score поста» по реакциям. Делать **goal-based scoring**.

## Минимальная weekly content review

Формат: 45 минут, раз в неделю, один owner — главред или контент-стратег.

```text
1. План vs факт
   - что должно было выйти
   - что вышло
   - что сдвинулось и почему

2. Production bottlenecks
   - где задержка: эксперт, дизайн, фактчек, техслужба, сегмент, публикация
   - какие last-minute изменения были критичны

3. Performance by objective
   - reach/early velocity для экспертных постов
   - CTR/registration для кнопок и анонсов
   - show-up/purchase для дожимных
   - gift delivery для patient/live flows

4. Segment learning
   - какой сегмент отреагировал лучше/хуже
   - были ли пересечения/ошибки доставки

5. Editorial learning
   - что сработало по теме, тону, врачу, нозологии
   - что не стоит повторять

6. Actions next week
   - 3 решения, не больше
   - owner + deadline
```

## Monthly strategic retrospective

Раз в месяц нужна не оперативная встреча, а анализ паттернов:

- какие рубрики дают доверие, но не клики;
- какие форматы дают регистрацию;
- какие нозологии перегреты/недопредставлены;
- где врачебный голос работает лучше AI-черновика;
- какие сегменты устали от коммуникации;
- какие каналы не окупают ручной труд;
- где воронка ломается: click → registration → attendance → purchase → gift delivery.

## Leading vs lagging indicators

| Тип | Метрика | Что показывает | Где использовать |
|---|---|---|---|
| Leading | On-time publish rate | Управляемость производства | Weekly ops |
| Leading | Approval lead time | Где bottleneck: редактор/врач/дизайн | Weekly ops |
| Leading | T+3h reach velocity | Ранний сигнал интереса | Telegram/VK |
| Leading | T+24h CTR | Есть ли движение к цели | TG/email/VK |
| Leading | Comment/question quality | Возникают ли meaningful вопросы | Эфиры/экспертные |
| Leading | Segment delivery success | Дошло ли сообщение до нужных людей | Email/GetCourse/WhatsApp |
| Lagging | Registration count/rate | Реальный результат воронки | Вебинары/эфиры |
| Lagging | Attendance/show-up | Качество привлечения | Онко-школа |
| Lagging | Purchase/conversion | Коммерческий эффект | Флагман/альтернатива |
| Lagging | Qualified medtourism lead | Смысл медтуризм-контента | Медтуризм |
| Lagging | Gift delivery completion | Закрытие обещания аудитории | Patient/live flows |
| Lagging | Retention/referral | Долгосрочное доверие | Alumni/сообщество |

## Как избежать культа «реакций»

Реакции полезны как слабый сигнал эмоционального отклика. Но для вашего кейса они не должны быть главным KPI, потому что:

- экспертный пост может быть полезным, но не «лайкаться»;
- тревожная медицинская тема может давать много реакций, но мало регистраций;
- личный лайф может давать вовлечение, но не двигать продуктовую воронку;
- «дожимной» пост может выглядеть скучно, но давать покупки;
- НКО-пост может быть обязательством по гранту, а не conversion asset.

Лучше использовать **goal-based score**:

```text
score = metric_value / expected_value for this objective, channel, segment, format
```

Например, для анонса эфира: CTR и registration rate важнее реакций. Для экспертного поста: read depth, saves/reposts, quality comments, later-assisted registrations. Для email: delivered, click rate, CTOR, registration. Для patient story: completion, comments quality, trust signal, but with safety review.

## Шаблон weekly review в портале

```text
Week: [date]

1. Best by objective
- Best registration driver:
- Best trust/authority post:
- Best segment response:
- Best email/digest:

2. Worst / broken
- Missed deadline:
- Low CTR despite high reach:
- Segment/delivery issue:
- Medical review delay:

3. Learnings
- Topic:
- Format:
- Segment:
- Channel:
- Voice/style:

4. Decisions
- Stop:
- Continue:
- Try:

5. Actions
- Action / owner / deadline / linked bundle
```

## Источники раздела

1. Reuters Institute on audience analytics and editorial judgment: https://reutersinstitute.politics.ox.ac.uk/  
2. Data Journalism Handbook on audience metrics: https://datajournalism.com/read/handbook/  
3. American Press Institute Metrics for News: https://americanpressinstitute.org/metrics-for-news/  
4. The Atlantic / The Audiencers on Media Time: https://theaudiencers.com/  
5. Vox Media analytics discussions: https://www.voxmedia.com/  
6. Parse.ly / Atlantic Media ratio metrics: https://www.parse.ly/  
7. Buffer social media checklist: https://buffer.com/library/social-media-checklist/  
8. HubSpot social media audit template: https://blog.hubspot.com/marketing/social-media-audit  
9. CXL conversion research process: https://cxl.com/blog/conversion-research/  
10. TeamRetro marketing campaign retrospective: https://www.teamretro.com/  
11. Miro social media campaign recap template: https://miro.com/templates/social-media-campaign-recap/

---

# Раздел 8. Anti-patterns и грабли

## TL;DR

Главные грабли — попытаться построить универсальный автопубликатор, захардкодить рубрики/форматы, не хранить версии и согласования, поверить в ненадёжные API и сделать реакции главным KPI. Для команды 7–10 человек ценность внутреннего инструмента не в количестве фич, а в снижении хаоса: кто что делает, для какого сегмента, в каком канале, с каким review, что вышло и какой результат.

## SaaS-фичи, которые команды часто не используют

В small/mid teams часто недоиспользуются:

- enterprise social listening;
- competitive intelligence dashboards;
- sentiment analysis;
- сложные multi-level approvals;
- automated best-time optimization;
- платные white-label agency reports;
- unified inbox, если команда не отвечает массово в соцсетях;
- deep paid social analytics, если paid media не основной канал;
- AI-генерация без встроенного style guide и review.

Для вас эти функции не должны быть MVP. MVP должен отвечать на более простые вопросы: что планируем, кто делает, какая версия финальная, кто проверил, куда публикуем, для какого сегмента, какая ссылка, какие UTM, какие метрики через 24/72 часа, что решили на ретро.

## Топ-3 жалобы пользователей SaaS из раздела 1

| Продукт | Частые жалобы на G2/Capterra/обзорах | Что это значит для вас |
|---|---|---|
| **Planable** | Ограниченные advanced analytics; ограничения тарифов/workspaces; не все платформы/форматы закрыты идеально | Не копировать pricing complexity; analytics строить вокруг ваших метрик, а не красивых графиков |
| **CoSchedule** | Цена для малых команд; learning curve; интеграционные ограничения/нет публичного API | Campaign/workflow полезны, но SaaS-сложность не нужна |
| **Hootsuite** | Дорого; тяжеловесно; отдельные пользователи жалуются на UX/support/избыточность | Не строить enterprise suite для команды 7–10 |
| **Sprout Social** | Очень дорого per seat; reporting/enterprise features не всем окупаются; small teams чувствуют overkill | Premium analytics — не первый этап |
| **SocialPilot** | Ограничения reporting customization; missing features; post archiving/advanced workflows | Дешёвый scheduler не решает редакционную систему и медицинский review |
| **Loomly** | Базовая аналитика; ограничения Instagram/stories/tagging; местами clunky edits | Custom channel good, analytics не идеальна — значит manual ledger нормален |
| **Airtable** | Сложность permissions; limits/records/automation credits; сложно сделать полноценный product UI | Airtable хорош как прототип, но при росте лучше собственная модель данных |

## Архитектурные решения, которые становятся техдолгом

**1. Hard-coded enums.**  
Форматы, рубрики, нозологии и каналы нельзя жёстко забивать в код. Сегодня есть «Кнопка / Дожимной / Анонс / Эфир», завтра появятся Max-пуши, пациентский сериал, YouTube Shorts, «история без лица», новый НКО-формат. Нужны reference tables с активностью, deprecated status и display order.

**2. Один текст на все платформы.**  
Это уже ваша боль. Архитектурно нельзя делать `post.text` как общий финальный текст. Нужны channel-specific publications или variants.

**3. Нет версий и approval snapshots.**  
Для медицины это критично. Если через месяц возникнет вопрос, почему опубликована именно такая формулировка, нужно видеть финальную версию, кто согласовал, какие источники использовались.

**4. Метрики без freshness/confidence.**  
Если одно число из API, второе из ручного экспорта, третье из TGStat, четвёртое введено вручную через две недели — это разные типы данных. Без confidence портал будет создавать ложную точность.

**5. Writable mirror сегментов GetCourse.**  
Не надо давать порталу редактировать GetCourse-сегменты на первом этапе. Это создаст split-brain и ошибки рассылок.

**6. Универсальный auto-publisher как MVP.**  
Автопубликация по всем каналам — соблазнительная, но рискованная цель. API неодинаковы, каналы нестабильны, права и форматы разные. Лучше сначала manual/semi-auto ledger, потом API там, где стабильно.

**7. Нет `platform_capabilities`.**  
Каждый канал должен иметь capabilities: поддерживает ли API posting, metrics, reactions, comments, media types, scheduling, link preview, UTM, post URL, deletion, editing. Это защитит от платформенных исключений в коде.

**8. Неполная модель пациентского согласия.**  
Если эфир с пациентом хранится как обычная публикация, вы потеряете consent, ограничения, каналы публикации и legal notes. Нужна отдельная сущность guest/patient story.

**9. No retrospective object.**  
Если ретро — это устный разговор, знания не накапливаются. Нужна сущность `content_review` или `retro_note`, связанная с bundle/posts.

**10. AI без traceability.**  
Если AI генерирует финальный текст, нужно хранить источник, prompt version, draft version и reviewer. Иначе невозможно понять, откуда взялась фраза.

## Когда внутренний инструмент проигрывает покупному

Покупной SaaS лучше, если:

- каналы в основном западные и нативно поддерживаются;
- не нужны GetCourse-сегменты и медицинский review;
- главная боль — scheduling, inbox, агентские отчёты;
- команда не готова поддерживать продукт и интеграции;
- нет уникальных сущностей вроде нозологии, пациентских согласий, сегментных воронок;
- стоимость разработки выше SaaS-лицензий.

В вашем случае покупной SaaS проигрывает как core-система, потому что критичные сущности — сегменты, эфиры, пациенты, медицинский фактчек, GetCourse, русские каналы, задержка метрик, ретроспективы — находятся вне стандартного social media scheduler.

## Признаки, что вы строите Frankenstein

- Каждая новая фича добавляется без изменения data model, только новыми nullable fields.
- В системе 20 статусов, но команда всё равно договаривается в Telegram.
- В календаре красивые карточки, но нет факта публикации и ссылки на пост.
- AI пишет тексты, но врач не видит claims for review.
- Метрики подтягиваются, но никто не знает, что они означают и когда обновились.
- Сегменты видны, но не видно exclusion logic.
- Модуль пытается заменить GetCourse, Miro, Google Docs, Telegram, CRM и SaaS одновременно.

## Источники раздела

1. G2 Planable reviews: https://www.g2.com/products/planable/reviews  
2. G2 CoSchedule reviews: https://www.g2.com/products/coschedule-marketing-suite/reviews  
3. G2 Hootsuite reviews: https://www.g2.com/products/hootsuite/reviews  
4. G2 Sprout Social reviews: https://www.g2.com/products/sprout-social/reviews  
5. G2 SocialPilot reviews: https://www.g2.com/products/socialpilot/reviews  
6. G2 Loomly reviews: https://www.g2.com/products/loomly/reviews  
7. G2 Airtable reviews: https://www.g2.com/products/airtable/reviews  
8. Capterra Planable reviews: https://www.capterra.com/p/148133/Planable/  
9. Capterra Hootsuite reviews: https://www.capterra.com/p/83228/Hootsuite/  
10. Forbes Airtable review: https://www.forbes.com/advisor/business/software/airtable-review/  
11. Sprout Social pricing: https://sproutsocial.com/pricing/  
12. Hootsuite pricing: https://www.hootsuite.com/plans  
13. Airtable limits and pricing: https://airtable.com/pricing

---

# Recommendations to portal designer

1. **Делать Bundle-first модель.** Campaign/bundle должен быть главным контейнером для эфира, вебинара, patient story, медтуризм-темы или НКО-обязательства.

2. **Публикации делать независимыми sibling objects.** TG/VK/Max/Dzen/email/WhatsApp/GetCourse push не должны быть просто «полями одного поста». У каждой публикации свои статус, текст, UTM, ссылка, метрики и review.

3. **Скопировать из SaaS не публикатор, а операционные паттерны:** calendar views, approvals/version history, campaign workspace, labels/taxonomy, custom channel ledger.

4. **Сделать `platform_capabilities`.** Для каждого канала хранить: можно ли publish через API, можно ли получить metrics, какие медиа, есть ли post URL, можно ли редактировать, как получать реакции/комментарии, какая задержка.

5. **Сохранять metric snapshots, а не «одно число охвата».** Нужны окна T+3h/T+24h/T+72h/T+7d, источник, метод, raw payload, confidence, freshness.

6. **GetCourse-сегменты зеркалить read-only.** Портал должен показывать segment_id, название, размер, ссылку, snapshot, пересечения и exclusion role, но не редактировать сегменты на первом этапе.

7. **Сделать UTM/click-id factory.** Каждая публикация должна получать уникальную ссылку, связывающую bundle, publication, segment, channel, format и CTA.

8. **Встроить patient/guest CRM.** Эфир с пациентом — это не просто публикация, а pipeline: sourcing, screening, consent, prep, эфир, публикация, gift delivery, follow-up.

9. **Встроить consent модель.** Хранить consent version, signed_at, allowed_channels, anonymity_level, sensitive boundaries, legal notes.

10. **AI использовать как draft/variant engine.** AI должен генерировать черновики, адаптации, push, CTA, summary и claims list. Финальный медицинский текст — только после редактора и врача/фактчекера.

11. **Не делать universal auto-publisher в MVP.** Начать с manual/semi-auto publishing ledger, а API подключать по зрелости: email/GetCourse/VK/Telegram раньше, Max/Dzen осторожнее.

12. **Не хардкодить рубрики, форматы, нозологии.** Это справочники с активностью, версиями, deprecated status и возможностью добавлять новые форматы.

13. **Сделать weekly/monthly retrospective object.** Ретро должно сохраняться в системе: выводы, решения, actions, связанные bundle/posts, что stop/continue/try.

14. **Не использовать реакции как главный KPI.** KPI должен зависеть от objective: registration, show-up, purchase, qualified lead, trust, grant obligation, gift delivery.

15. **Ограничить MVP задачами, которые убирают хаос.** Первый релиз: calendar + bundle + publication statuses + segment targeting + approval/version + UTM + manual metrics + retro. Всё остальное — после того, как команда реально начнёт этим пользоваться.

## Три паттерна, которые стоит скопировать

1. **CoSchedule-like campaign workspace:** campaign → tasks → social messages → UTM → report.  
2. **Planable-like approvals and versioned comments:** draft → review → approve → publish.  
3. **Airtable-like relational flexibility:** segments, publications, metrics, assets, guests, channels as linked records.

## Три ловушки, которые нужно обойти

1. **Single-post монолит:** один пост на все каналы быстро превращается в набор исключений.  
2. **API-иллюзия:** Max/Dzen/Telegram/VK не дадут одинаково чистую аналитику; проектируйте источник и confidence.  
3. **AI-фактчек:** AI может ускорять редакцию, но не заменяет медицинскую проверку.
