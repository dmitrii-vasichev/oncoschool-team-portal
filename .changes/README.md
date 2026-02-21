# Change Fragments

В этой папке храним фрагменты изменений (по одному файлу на задачу/PR), из которых собирается `CHANGELOG.md`.

## Когда добавлять запись

- `business`: изменение важно для бизнес-отчета (по умолчанию).
- `internal`: тех. изменение для внутреннего журнала.
- `none`: запись не создаем.

## Формат файла

Используйте шаблон `_template.md` или команду `make change-add`.

Обязательные поля:

- `date` (YYYY-MM-DD)
- `task`
- `scope` (`business` или `internal`)
- `type` (`feature`, `fix`, `improvement`, `docs`, `chore`)
- `area`
- `summary`
- `risk` (`low`, `medium`, `high`)

Опционально:

- `business_value` (особенно важно для `business`)

## Пример команд

```bash
make change-add ARGS="--scope business --task ONCO-142 --type feature --area 'Расписание' --summary 'Добавили автоподбор слота врача' --business-value 'Сократили время записи пациента' --risk low"
make change-build
```
