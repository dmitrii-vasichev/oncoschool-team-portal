# Документация проекта

## Структура

- `plans/archive/` — исторические планы реализации и промпты.
- `runbooks/` — операционные инструкции по интеграциям и инцидентам.
- `ai/` — гайды и материалы для AI-ассистентов.

## Статусы ключевых документов

| Документ | Статус | Назначение |
|---|---|---|
| `../README.md` | active | Запуск и разработка проекта |
| `../CHANGELOG.md` | active | Журнал изменений |
| `../CLAUDE.md` | active | Операционные правила работы с AI-агентами |
| `plans/archive/PLAN.md` | archive | Исторический основной план |
| `plans/archive/MEETINGS_PLAN.md` | archive | Исторический план модуля встреч |
| `plans/archive/TEAM_PLAN.md` | archive | Исторический план вкладки команды |
| `plans/archive/MEETINGS_PARTICIPANTS_PLAN.md` | archive | Исторический план по участникам встреч |
| `plans/archive/MEETINGS_PARTICIPANTS_PROMPTS.md` | archive | Исторические промпты реализации |
| `runbooks/ZOOM_SCOPES_CHECKLIST.md` | active | Чеклист Zoom scopes |
| `ai/frontend-design.md` | active | Дизайн-гайд для фронтенда |

## Правила

- Полная политика документации: `DOCS_POLICY.md`.
- Новые рабочие планы хранить не в корне, а в `docs/plans/`.
- После завершения работ переносить планы в `docs/plans/archive/`.
- В корне проекта держать только базовые документы (`README.md`, `CHANGELOG.md`, `CLAUDE.md`).
