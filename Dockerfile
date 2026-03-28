# syntax=docker/dockerfile:1.7

# Builder stage: собираем Go-бинарник отдельно от финального образа.
FROM golang:1.24-alpine AS builder

# Все команды сборки backend выполняем из его рабочей директории.
WORKDIR /src/backend

# Сначала копируем go.mod/go.sum, чтобы кэшировать зависимости отдельно от исходников.
COPY backend/go.mod backend/go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    go mod download

# Затем копируем исходники backend.
COPY backend/. ./

# Собираем статический Linux-бинарник и кладем его в отдельную директорию /out.
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/server .

# Runtime stage: минимальный образ только с бинарником и нужными файлами.
FROM gcr.io/distroless/static-debian12:nonroot

# Финальное приложение будет жить в /app.
WORKDIR /app

# Копируем собранный backend и фронтовую статику, которую backend раздает по HTTP.
COPY --from=builder /out/server /app/server
COPY frontend/static /app/frontend/static

# Документируем порт, на котором backend слушает внутри контейнера.
EXPOSE 8000

# При старте контейнера запускаем собранный сервер.
ENTRYPOINT ["/app/server"]
