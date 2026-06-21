# EvalAI — Technical Architecture & Codebase Reference

---

## 1. Executive Summary & Core Intent

EvalAI is a production-grade, AI-assisted exam evaluation platform that automates the end-to-end grading workflow for school teachers. **The core problem:** manual grading of typed PDF answer sheets is slow, inconsistent, and exhausting, especially across large class sections. **EvalAI's solution** is a three-phase pipeline:

1. **Parse** — Upload a question paper and answer key PDF; the system auto-extracts questions, marks, types, and answer mappings using regex.
2. **Upload** — Batch upload student PDF answer sheets; each sheet is mapped to a student and its answers to the corresponding questions.
3. **Evaluate** — MCQ answers are graded programmatically (exact match); theory answers (short/long) are sent in batches of 25 to Groq LLM (`llama-3.3-70b-versatile`) for semantic evaluation with partial marks and feedback. A keyword-matching mock evaluator serves as fallback when no `GROQ_API_KEY` is configured.

Output includes a class dashboard with sortable results, per-student PDF/Excel reports, mark-override capabilities, and multi-exam delete.

---

## 2. Complete Tech Stack Architecture

### Frontend (`frontend/`)

| Layer | Implementation |
|---|---|
| **Framework** | React 19 (`main.jsx` — `createRoot` API) |
| **Build Tool** | Vite 8 (`vite.config.js`) |
| **Styling** | Tailwind CSS 4 (`@tailwindcss/vite` plugin, `index.css` imported in `main.jsx`) |
| **Routing** | React Router 7 (`BrowserRouter`, `useParams`, `useNavigate`, `useLocation`) in `App.jsx` |
| **HTTP Client** | Axios (wrapped in `utils/api.js` with interceptors for JWT Bearer auth and 401 auto-logout) |
| **API Config** | `config.js` reads `VITE_API_BASE` env var, falls back to `http://{hostname}:5000` |
| **Export Libraries** | jsPDF (student report PDF), xlsx/SheetJS (class results Excel) — both used server-side via `reportGenerator.js`; client-side download triggered via blob |

### Backend (`backend/`)

| Layer | Implementation |
|---|---|
| **Runtime** | Node.js (CommonJS, `type: "commonjs"`) |
| **Server Framework** | Express 5 (`express@^5.2.1`) with error-handling middleware |
| **File Uploads** | Multer 2 (`multer@^2.2.0`) — disk storage in `uploads/` |
| **PDF Text Extraction** | `pdf-parse@^2.4.5` using `PDFParse` class for Uint8Array input |
| **LLM Integration** | `groq-sdk@^1.2.1` — `client.chat.completions.create()` with JSON mode, temperature 0.1 |
| **JWT Auth** | `jsonwebtoken@^9.0.3` — HS256 tokens, 24h expiry |
| **PDF Generation** | jsPDF (server-side `jspdf@^4.2.1`) — `doc.output('arraybuffer')` → `Buffer` |
| **Excel Generation** | xlsx/SheetJS (`xlsx@^0.18.5`) — `XLSX.utils.json_to_sheet()` → `XLSX.write()` |

### Database & Cloud Infrastructure

| Component | Details |
|---|---|
| **Engine** | PostgreSQL (via `pg@^8.22.0` Pool) |
| **Connection** | `db.js` creates a `Pool` from `DATABASE_URL` with `ssl: { rejectUnauthorized: false }` for cloud DBs |
| **Schema** | 4 tables: `exams`, `questions`, `students`, `evaluations` — with `ON DELETE CASCADE` foreign keys and `CHECK` constraints on `question_type` and `status` |
| **Migrations** | Auto-run via `db.js` `initializeDatabase()` — uses `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` |
| **Hosting** | Backend → Render (PostgreSQL DB also on cloud); Frontend → Vercel |

---

## 3. Authentication & Security Model

### Credential Storage (Backend)
Credentials are stored **exclusively in environment variables**, never in the database:
- `CLASS_1_NAME`, `CLASS_1_PASSWORD`, `CLASS_2_NAME`, `CLASS_2_PASSWORD`, ... up to 10 classes
- The `/api/auth/classes` endpoint (in `routes/auth.js`) iterates `CLASS_{i}_NAME` vars to build the class list
- Login at `POST /api/auth/login` matches `className + password` against these env vars

### JWT Token Lifecycle
- On successful login, `jwt.sign({ classId, className }, JWT_SECRET, { expiresIn: '24h' })` returns a token
- The token payload includes `classId` and `className` but **not** the password

### Middleware Protection
- `middleware/auth.js` (`authenticateToken`) extracts `Bearer` token from `Authorization` header, verifies with `jwt.verify()`, and attaches `req.classId` / `req.className` / `req.user`
- Route registration in `index.js`:
  - `/api/auth/*` — **public** (before `app.use('/api', authenticateToken)`)
  - `/api/*` — **protected** (all other routes are behind the middleware)
- `routes/auth.js` is excluded from auth because it is registered before the middleware boundary

### File Download Authentication
- Export routes (`/api/exam/:id/export/excel`, `/api/exam/:id/export/pdf`, etc.) are **behind the same JWT middleware**, so direct browser hrefs fail with "Access token required"
- **Solution implemented in `Dashboard.jsx`:** `handleExport(type)` uses the authenticated Axios instance with `responseType: 'blob'`, creates a temporary `Blob` URL, and triggers a programmatic download via a dynamically created `<a>` element — no `window.location.href` or unauthenticated API_BASE URL

### Client-Side Auth
- `utils/auth.js` stores `token`, `className`, `classId` in `localStorage`
- `utils/api.js` attaches `Authorization: Bearer {token}` via request interceptor
- 401/403 responses trigger `logout()` + redirect to `/login` via response interceptor
- `ProtectedRoute.jsx` checks `isLoggedIn()` (which also validates token expiry by decoding the JWT payload) and redirects to `/login` if invalid

---

## 4. Directory Structure & Module Breakdown

```
EvalAI/
├── backend/
│   ├── index.js                     # Express 5 entry: CORS, body parsers, route registration, error handler, process lifecycle
│   ├── middleware/
│   │   └── auth.js                  # JWT Bearer token verification middleware
│   ├── database/
│   │   ├── db.js                    # pg Pool, SSL config, schema init + migrations (is_overridden, override_note, class_account_id)
│   │   └── schema.sql               # CREATE TABLE IF NOT EXISTS for exams, questions, students, evaluations
│   ├── routes/
│   │   ├── auth.js                  # GET /classes (list env classes), POST /login (verify & sign JWT)
│   │   ├── exam.js                  # POST /exam/setup (multipart PDF upload + parse + transaction), GET /exams, GET /exam/:id, DELETE /exams
│   │   ├── upload.js                # POST /exam/:id/upload-students (multer array, parse PDFs, insert evaluations)
│   │   ├── evaluate.js              # POST /exam/:id/evaluate (trigger async), GET /status (polling), GET /results, GET /student/:studentId, PATCH /override
│   │   └── export.js                # GET /exam/:id/export/excel, GET /exam/:id/export/pdf, GET /exam/:id/student/:studentId/export/pdf
│   ├── services/
│   │   ├── pdfParser.js             # Uint8Array + PDFParse → text extraction
│   │   ├── questionParser.js        # Regex-based Q number detection, marks extraction, MCQ detection, answer key parsing, short/long type refinement
│   │   ├── answerParser.js          # Student answer extraction with "Answer: X" cleanup → answer map
│   │   ├── groqEvaluator.js         # Lazy Groq client init, retry logic (429), mock fallback, MCQ vs theory prompts, JSON parsing
│   │   ├── evaluationOrchestrator.js # Per-question grading loop, MCQ programmatic, theory batched (25), grade calculation (A+ through F), in-memory progress tracking
│   │   └── reportGenerator.js       # Excel buffer (XLSX), individual student PDF (jsPDF with table + Learning Profile Analysis), class results PDF
│   ├── uploads/                     # Temporary PDF storage (gitignored)
│   └── package.json                 # express 5, pg, multer 2, pdf-parse 2, groq-sdk, jsonwebtoken, jspdf 4, xlsx, dotenv, cors
│
├── frontend/
│   ├── src/
│   │   ├── main.jsx                 # React 19 createRoot + StrictMode
│   │   ├── App.jsx                  # BrowserRouter, sticky navbar (EvalAI logo, "Logged in as:", Logout), 7 routes wrapped in ProtectedRoute
│   │   ├── config.js                # VITE_API_BASE || `http://${window.location.hostname}:5000`
│   │   ├── components/
│   │   │   └── ProtectedRoute.jsx   # isLoggedIn() guard → /login redirect
│   │   ├── utils/
│   │   │   ├── auth.js              # setToken, getToken, getClassName, getClassId, logout, isLoggedIn (JWT expiry check)
│   │   │   └── api.js               # Axios instance with JWT interceptor + 401/403 auto-logout
│   │   └── pages/
│   │       ├── Login.jsx            # Class dropdown, password with show/hide toggle (Heroicons), fixed inset-0 viewport lock
│   │       ├── ExamHistory.jsx      # Grid of exam cards, selection mode + multi-delete with confirmation dialog, toast notifications
│   │       ├── Setup.jsx            # Form: title, subject, class, total marks, instructions, question paper PDF, answer key PDF
│   │       ├── Upload.jsx           # File drag/drop area, upload + async evaluate with progress bar polling (3s interval)
│   │       ├── Dashboard.jsx        # 4 metric cards (total, avg, highest, lowest), sortable results table, export dropdown (blob download)
│   │       ├── StudentReport.jsx    # Per-question breakdown, inline mark override editor, strength/weakness analysis, toast feedback
│   │       └── AddStudents.jsx      # Same file upload UI as Upload.jsx, appends to existing exam, re-evaluates new students
│   ├── public/                      # favicon.svg, icons.svg, logo.png, manifest.json
│   └── vite.config.js               # react plugin + tailwindcss plugin + allowedHosts (ngrok)
│
└── screenshots/                     # 7 PNG screenshots of the UI
```

---

## 5. Feature-by-Feature Deep Dive

### 5a. Authentication / Login Page (`Login.jsx`)

| Aspect | Implementation |
|---|---|
| **Class list fetching** | `useEffect` calls `api.get('/api/auth/classes')` on mount; maps response to a `<select>` dropdown |
| **Password input** | Controlled `password` + `showPassword` state; `type` toggles between `'password'` and `'text'` |
| **Eye icon toggle** | `<button>` with Heroicons SVG (open/closed eye); `onClick` toggles state, `onMouseDown.preventDefault` prevents focus loss |
| **Form submission** | `onSubmit={handleLogin}` — calls `api.post('/api/auth/login', { className, password })`, stores token via `setToken()`, navigates to `/` |
| **Error handling** | `catch` block sets error state → renders a red banner; `finally` unsets loading |
| **Viewport** | Outermost `div` uses `fixed inset-0 overflow-hidden flex items-center justify-center bg-slate-900` — locks to viewport, no scrolling |

### 5b. Exam History (`ExamHistory.jsx`)

| Aspect | Implementation |
|---|---|
| **Data fetching** | `api.get('/api/exams')` returns exams filtered by `class_account_id` |
| **Display** | Grid of cards (1/2/3 columns responsive) showing class badge, date, name, subject, student count, total marks |
| **Selection mode** | Toggle with "Select" button; clicking a card toggles checkmark overlay; "Delete Selected" triggers a confirmation dialog |
| **Delete** | `api.delete('/api/exams', { data: { examIds } })` — backend uses `DELETE ... WHERE id = ANY($1::int[]) AND class_account_id = $2` |
| **Empty state** | "No exams yet" with a CTA button to navigate to `/setup` |

### 5c. Dashboard (`Dashboard.jsx`)

| Aspect | Implementation |
|---|---|
| **Metric cards** | `totalStudents`, `averageObtained`/`averagePercentage`, `highestScore`, `lowestScore` — computed from `student` array |
| **Sortable table** | `sortField` and `sortDirection` state; `sortedStudents` computed via `[...students].sort()` comparing string/numeric values |
| **Column headers** | Clicking a header toggles asc/desc sort; ▲/▼ indicators shown for active sort column |
| **Row click** | Navigates to `/student/:examId/:studentId` |
| **Export dropdown** | Click toggle shows menu with "Download as Excel" and "Download as PDF" buttons |
| **Blob download** | Both buttons call `handleExport(type)` which uses `api.get(endpoint, { responseType: 'blob' })`, creates `window.URL.createObjectURL`, appends a temporary `<a>` element, clicks it, and cleans up |

### 5d. AI Evaluation Pipeline

**Exam Setup** (`routes/exam.js`):
1. Multer receives `questionPaper` and `answerKey` PDFs (10MB limit)
2. `pdfParser.js` reads file → `Uint8Array` → `PDFParse` → `getText()`
3. `questionParser.js` uses regex `/(?:^|\r?\n)\s*(?:Q(?:uestion)?\s*(\d+)|(\d+))\s*[:.)-]/gi` to split questions
4. Marks extracted via `[2 marks]` or `(5)` regex; MCQ auto-detected if options `A-D` present
5. `parseAnswerKey` maps question numbers to answer text
6. All inserted in a PostgreSQL transaction with `BEGIN/COMMIT/ROLLBACK`

**Student Upload** (`routes/upload.js`):
1. Multer receives multiple PDFs via `studentFiles` field
2. Each PDF parsed → `answerParser.js` extracts answers map
3. Student name derived from filename (strip extension, capitalize)
4. Per-student transaction: insert into `students` table, then insert each answer into `evaluations` with `marks_awarded: 0, feedback: NULL`

**Evaluation** (`routes/evaluate.js` + `services/evaluationOrchestrator.js`):
1. `POST /evaluate` triggers async `runEvaluation(examId)` and returns immediately
2. `GET /status` returns in-memory progress (stored in `progressMap`)
3. Orchestrator loops question by question:
   - **MCQ**: Exact string comparison (uppercased trim) — writes marks + feedback directly
   - **Theory**: Batches of 25 student answers sent to `groqEvaluator.evaluateQuestionBatch()`
4. **Groq Evaluator** (`groqEvaluator.js`):
   - Lazy-loads `Groq` client; if `GROQ_API_KEY` missing → returns `generateMockEvaluation()` (keyword matching with weighted ratio)
   - Uses `llama-3.3-70b-versatile` with `response_format: { type: "json_object" }`, temperature 0.1
   - Retries up to 3 times on 429 rate limit with 10s delay
   - Cleans markdown-wrapped JSON via `cleanAndParseJson()`; handles multiple key variations (`evaluation_results`, `students_evaluations`, etc.)
5. After all questions graded: `SUM(marks_awarded)`, percentage = `(rawScore / totalPossibleMarks) * 100`, grade assignment (A+ ≥ 90, A ≥ 80, ..., F < 50)

### 5e. Export System

**Server-side** (`services/reportGenerator.js`):
- `generateExcelBuffer()` — `XLSX.utils.json_to_sheet()` → `XLSX.write({ type: 'buffer', bookType: 'xlsx' })`
- `generateStudentReportPDF()` — jsPDF canvas with metadata grid, question-by-question table, Learning Profile Analysis (strengths ≥ 80% / weaknesses < 50%), multi-page support
- `generateClassResultsPDF()` — jsPDF canvas with summary row + student list table

**Authenticated Blob Download (Dashboard)** (`Dashboard.jsx:45-63`):
```
api.get(endpoint, { responseType: 'blob' })
  → new Blob([response.data])
  → window.URL.createObjectURL(url)
  → document.createElement('a').click()
  → window.URL.revokeObjectURL(url)
```

---

## 6. Environment Configuration & Deployment State

### Local Development Variables

| Variable | Required | Description |
|---|---|---|
| `PORT` | No (default 5000) | Backend server port |
| `DATABASE_URL` | Yes | PostgreSQL connection string (e.g., `postgresql://user:pass@host:5432/evalai`) |
| `GROQ_API_KEY` | No | Groq API key for LLM evaluation; **if absent, mock evaluator activates** |
| `JWT_SECRET` | Recommended | Secret for signing JWT tokens; defaults to `'yoursecretkey123'` |
| `CLASS_{1..10}_NAME` | Per class | Display name for each class account |
| `CLASS_{1..10}_PASSWORD` | Per class | Login password for each class account |

### Frontend Variables

| Variable | Description |
|---|---|
| `VITE_API_BASE` | Override API base URL; defaults to `http://{window.location.hostname}:5000` |

### Deployment-Specific Configuration

- **Render (Backend)**: `DATABASE_URL` points to cloud PostgreSQL (SSL enabled); `NODE_VERSION` set to `>=18`; start command `node index.js`
- **Vercel (Frontend)**: `VITE_API_BASE` set to production Render URL; framework preset "Vite"; output directory `dist`
- **Vite `allowedHosts`**: `vite.config.js` includes `'brunch-lumpiness-cultivate.ngrok-free.dev'` — an ngrok tunnel for dev testing
- **Debug overlay**: Commented out in `App.jsx` lines 59–71; shows localStorage token/className/classId when active on localhost
- **`.gitignore`**: Covers `node_modules/`, `.env`, `uploads/`, `*.pdf`, `dist/`, `build/`, `.DS_Store`, `Thumbs.db`, `*.log`
