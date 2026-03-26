-- Create database
CREATE DATABASE IF NOT EXISTS appdb;

-- Connect to the database
\c appdb

-- Create tables
CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    done BOOLEAN DEFAULT FALSE,
    priority VARCHAR(50) DEFAULT 'medium',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_tasks_done ON tasks(done);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at DESC);

-- Insert sample data
INSERT INTO tasks (title, priority, done) VALUES
    ('Learn Go', 'high', false),
    ('Setup PostgreSQL', 'high', true),
    ('Deploy to Docker', 'medium', false),
    ('Write tests', 'medium', false);
