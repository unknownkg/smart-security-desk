# Отчёт о дефекте: инцидент принимает недопустимый статус

## Шаги воспроизведения

1. Запустить приложение с временно отключённой проверкой статуса инцидента.
2. Создать инцидент запросом `POST /api/incidents`.
3. Отправить `PATCH /api/incidents/:id` с телом `{"status":"closed"}`.

**Ожидаемый результат:** HTTP 400 Bad Request.

**Фактический результат:** HTTP 200 OK; в ответе статус инцидента равен `closed`.

**Важность:** средняя.

## Доказательства

- [Ответ с временно отключённой проверкой](evidence/incident-invalid-status-before.json).
- [Ответ после восстановления проверки](evidence/incident-invalid-status-after.json).
- [Результат в учебной ветке до исправления](evidence/branch-exercise-before.json).
- [Результат в ветке исправления](evidence/branch-exercise-after.json).

Проверка восстановлена в `fix/incident-validation`. [Issue #12](https://github.com/unknownkg/smart-security-desk/issues/12) закрыт после проверки; [PR #13](https://github.com/unknownkg/smart-security-desk/pull/13) слит в учебную ветку `exercise/incident-validation`. В `main` намеренный дефект не переносился: проверка статуса уже существовала в основной ветке до упражнения.
