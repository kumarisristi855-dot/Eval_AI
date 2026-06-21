-- PostgreSQL Schema for EvalAI

CREATE TABLE IF NOT EXISTS exams (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    class VARCHAR(100) NOT NULL,
    total_marks INTEGER NOT NULL,
    instructions TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    class_account_id INTEGER
);

CREATE TABLE IF NOT EXISTS questions (
    id SERIAL PRIMARY KEY,
    exam_id INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    question_number VARCHAR(50) NOT NULL,
    question_text TEXT NOT NULL,
    question_type VARCHAR(50) CHECK(question_type IN ('mcq', 'short', 'long')) NOT NULL,
    marks INTEGER NOT NULL,
    answer_key TEXT
);

CREATE TABLE IF NOT EXISTS students (
    id SERIAL PRIMARY KEY,
    exam_id INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    student_name VARCHAR(255) NOT NULL,
    total_marks_obtained REAL DEFAULT 0,
    percentage REAL DEFAULT 0,
    grade VARCHAR(10),
    status VARCHAR(50) CHECK(status IN ('pending', 'evaluated')) DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS evaluations (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    student_answer TEXT,
    marks_awarded REAL DEFAULT 0,
    feedback TEXT,
    is_overridden INTEGER DEFAULT 0,
    override_note TEXT
);