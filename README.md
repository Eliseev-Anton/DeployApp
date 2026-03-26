# Deploy App

Simple Task Manager built with Go + PostgreSQL + Vanilla JS

## Project Structure

```
FirstDeployApp/
├── backend/              # Go API server
│   ├── main.go          # Main application
│   ├── go.mod
│   └── go.sum
├── frontend/            # Frontend files
│   └── static/
│       ├── index.html   # HTML
│       ├── style.css    # Styles
│       └── app.js       # JavaScript
├── database/            # Database setup
│   └── init.sql         # SQL initialization script
└── README.md
```

## Setup

### Requirements
- Go 1.24+
- PostgreSQL 16+

### Local Development

1. **Setup PostgreSQL**
```bash
createdb appdb
psql appdb < database/init.sql
```

2. **Run Backend**
```bash
cd backend
go mod tidy
DATABASE_URL="postgres://postgres@localhost:5432/appdb?sslmode=disable" go run main.go
```

3. **Access**
Open http://localhost:8000

## Environment Variables

```
DATABASE_URL=postgres://user:pass@host:5432/dbname?sslmode=disable
PORT=8000
```

## API Endpoints

- `GET /api/tasks` - Get all tasks
- `POST /api/tasks` - Create task
- `PATCH /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task

## Docker Deployment

```bash
docker-compose up
```

See Dockerfile and docker-compose.yml for configuration.
