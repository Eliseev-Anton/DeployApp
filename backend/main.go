package main

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strconv"
	"time"

	_ "github.com/lib/pq"
)

type Task struct {
	ID        int       `json:"id"`
	Title     string    `json:"title"`
	Done      bool      `json:"done"`
	Priority  string    `json:"priority"`
	CreatedAt time.Time `json:"created_at"`
}

var (
	db *sql.DB
	memoryTasks []Task
	nextID = 1
)

func init() {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "postgres://appuser:apppass@localhost:5432/appdb?sslmode=disable"
	}

	var err error
	db, err = sql.Open("postgres", dbURL)
	if err != nil {
		log.Fatalf("Failed to open database: %v", err)
	}

	// Try to ping, but don't fail if DB not available
	if err = db.Ping(); err != nil {
		log.Printf("⚠ Warning: Could not connect to PostgreSQL: %v", err)
		log.Printf("⚠ Running in memory-only mode. Data will be lost on restart.")
		return
	}

	if err = createTable(); err != nil {
		log.Fatalf("Failed to create table: %v", err)
	}

	log.Println("✓ PostgreSQL connected and initialized")
}

func createTable() error {
	query := `
	CREATE TABLE IF NOT EXISTS tasks (
		id SERIAL PRIMARY KEY,
		title VARCHAR(255) NOT NULL,
		done BOOLEAN DEFAULT FALSE,
		priority VARCHAR(50) DEFAULT 'medium',
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);
	`
	_, err := db.Exec(query)
	return err
}

func getTasks(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if db == nil {
		w.Write([]byte("[]"))
		return
	}

	rows, err := db.Query("SELECT id, title, done, priority, created_at FROM tasks ORDER BY id DESC")
	if err != nil {
		// Fallback to memory
		if len(memoryTasks) == 0 {
			w.Write([]byte("[]"))
		} else {
			json.NewEncoder(w).Encode(memoryTasks)
		}
		return
	}
	defer rows.Close()

	tasks := []Task{}
	for rows.Next() {
		var t Task
		if err := rows.Scan(&t.ID, &t.Title, &t.Done, &t.Priority, &t.CreatedAt); err != nil {
			http.Error(w, "scan error", http.StatusInternalServerError)
			return
		}
		tasks = append(tasks, t)
	}

	if tasks == nil {
		tasks = []Task{}
	}
	json.NewEncoder(w).Encode(tasks)
}

func createTask(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	var body struct {
		Title    string `json:"title"`
		Priority string `json:"priority"`
	}

	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Title == "" {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}

	t := Task{
		ID:        nextID,
		Title:     body.Title,
		Priority:  body.Priority,
		Done:      false,
		CreatedAt: time.Now(),
	}
	nextID++

	if db != nil {
		err := db.QueryRow(
			"INSERT INTO tasks (title, priority) VALUES ($1, $2) RETURNING id, title, done, priority, created_at",
			body.Title, body.Priority,
		).Scan(&t.ID, &t.Title, &t.Done, &t.Priority, &t.CreatedAt)

		if err != nil {
			http.Error(w, "insert error", http.StatusInternalServerError)
			return
		}
		nextID = t.ID + 1
	} else {
		memoryTasks = append(memoryTasks, t)
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(t)
}

func updateTask(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}

	var body struct {
		Title    *string `json:"title"`
		Done     *bool   `json:"done"`
		Priority *string `json:"priority"`
	}

	json.NewDecoder(r.Body).Decode(&body)

	if body.Title != nil {
		db.Exec("UPDATE tasks SET title = $1 WHERE id = $2", *body.Title, id)
	}
	if body.Done != nil {
		db.Exec("UPDATE tasks SET done = $1 WHERE id = $2", *body.Done, id)
	}
	if body.Priority != nil {
		db.Exec("UPDATE tasks SET priority = $1 WHERE id = $2", *body.Priority, id)
	}

	var t Task
	err = db.QueryRow(
		"SELECT id, title, done, priority, created_at FROM tasks WHERE id = $1",
		id,
	).Scan(&t.ID, &t.Title, &t.Done, &t.Priority, &t.CreatedAt)

	if err == sql.ErrNoRows {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(t)
}

func deleteTask(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}

	result, err := db.Exec("DELETE FROM tasks WHERE id = $1", id)
	if err != nil {
		http.Error(w, "delete error", http.StatusInternalServerError)
		return
	}

	affected, err := result.RowsAffected()
	if affected == 0 {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func main() {
	defer db.Close()

	// API routes
	http.HandleFunc("GET /api/tasks", getTasks)
	http.HandleFunc("POST /api/tasks", createTask)
	http.HandleFunc("PATCH /api/tasks/{id}", updateTask)
	http.HandleFunc("DELETE /api/tasks/{id}", deleteTask)

	// Static files
	http.Handle("/static/", http.StripPrefix("/static/", http.FileServer(http.Dir("frontend/static"))))

	// Root route
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/" {
			http.ServeFile(w, r, "frontend/static/index.html")
		} else {
			http.NotFound(w, r)
		}
	})

	addr := ":8000"
	log.Printf("✓ Deploy App running on http://localhost%s", addr)
	log.Fatal(http.ListenAndServe(addr, nil))
}
