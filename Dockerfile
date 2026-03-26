# syntax=docker/dockerfile:1.7

# Многоэтапная сборка:
# 1) этап builder компилирует Go-бинарник с полным toolchain.
# 2) этап runtime содержит только финальные артефакты (меньше и безопаснее).
FROM golang:1.24-alpine AS builder

# Исходники храним в /src, а итоговый бинарник кладем вне дерева исходников.
WORKDIR /src

# Сначала копируем манифесты зависимостей, чтобы этот слой кэшировался,
# пока не изменятся зависимости. Если меняется только код,
# Docker переиспользует уже скачанные модули.
COPY backend/go.mod backend/go.sum ./backend/

# Кэш BuildKit сохраняет модульный кэш Go между сборками,
# что ускоряет локальные и CI-сборки.
# RUN --mount=type=cache,target=/go/pkg/mod \
#     cd backend && go mod download

# Копируем исходники после установки зависимостей для более эффективного кэша.
COPY backend ./backend
COPY frontend ./frontend

# Собираем оптимизированный production-бинарник:
# - CGO_ENABLED=0: статический бинарник без зависимости от libc в runtime-образе.
# - -trimpath: убирает локальные пути сборки для более воспроизводимого результата.
# - -ldflags="-s -w": удаляет символы и debug-данные, уменьшая размер бинарника.
# Mount-кэши сохраняют кэш модулей и компилятора между сборками.
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    cd backend && CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/app main.go

# Distroless runtime-образ:
# минимальное окружение, без shell и package manager, меньше размер и поверхность атаки.
FROM gcr.io/distroless/static-debian12:nonroot
WORKDIR /app

# Копируем только то, что реально нужно в runtime.
COPY --from=builder /out/app /app/app
COPY --from=builder /src/frontend /app/frontend

# Метаданные: приложение слушает порт 8000 внутри контейнера.
EXPOSE 8000

# Запуск от non-root пользователя для более безопасных прав по умолчанию.
USER nonroot:nonroot

# Команда запуска контейнера.
CMD ["/app/app"]
