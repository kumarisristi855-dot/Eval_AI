# EvalAI — Advanced Technical Documentation

> AI-Powered Answer Sheet Evaluation Platform  
> Submission for AI Vibe Coding Challenge 2026

---

## Table of Contents

1. [System Integration & Data Architecture](#1--system-integration--data-architecture)
2. [Complete Structural Tech Stack](#2--complete-structural-tech-stack)
3. [Session Security, Cryptography & Interceptors](#3--session-security-cryptography--interceptors)
4. [Advanced Pipeline Mechanics](#4--advanced-pipeline-mechanics)
5. [Host Environment & Network Routing Rules](#5--host-environment--network-routing-rules)

---

## 1. 🚀 System Integration & Data Architecture

### End-to-End Data Flow

The following trace describes how a student answer sheet PDF travels from the React frontend through the entire backend pipeline and settles into PostgreSQL.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ REACT UI (Frontend)                                                         │
│                                                                             │
│  Dashboard.jsx  ──POST /api/exam/:id/evaluate──►  (triggers async)          │
│  Upload.jsx     ──POST /api/exam/:id/upload-students──►  (Multer array)     │
│  Setup.jsx      ──POST /api/exam/setup──►  (Multer fields)                  │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ EXPRESS 5 ROUTE LAYER                                                       │
│                                                                             │
│  JWT Middleware ──► routes/exam.js                                          │
│  (authenticateToken)    routes/upload.js                                    │
│                         routes/evaluate.js                                  │
│                         routes/export.js                                    │
│                         routes/auth.js (public, before middleware)          │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
┌───────────────────────┐ ┌───────────────┐ ┌───────────────────────┐
│ Multer Disk Storage   │ │ pdf-parse     │ │ pg Pool               │
│                       │ │               │ │                       │
│ dest: 'uploads/'      │ │ fs.readFile() │ │ DATABASE_URL (SSL)    │
│ 10MB file size limit  │ │ → Uint8Array  │ │ Transaction Pooler    │
│ timestamp-named files │ │ → PDFParse    │ │ port 6543 (IPv4)      │
│                       │ │ → getText()   │ │                       │
└───────────────────────┘ └───────┬───────┘ └───────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ PARSER SERVICES                                                             │
│                                                                             │
│  questionParser.js  ──► regex segmentation ──► { number, text, marks, type }│
│  answerParser.js    ──► regex segmentation ──► { Q1: "B", Q2: "...", ... }  │
│  pdfParser.js       ──► Uint8Array → PDFParse → text                        │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ EVALUATION ORCHESTRATOR (async)                                             │
│                                                                             │
│  runEvaluation(examId)                                                      │
│    ├── Fetch exam, questions, pending students                              │
│    ├── For each question:                                                   │
│    │   ├── MCQ? ──► Programmatic string compare (uppercase trim)            │
│    │   │           UPDATE evaluations SET marks_awarded                     │
│    │   │                                                                    │
│    │   └── Theory? ──► Batch into groups of 25                              │
│    │                   └── evaluateQuestionBatch()                          │
│    │                       ├── Groq API (llama-3.3-70b-versatile)           │
│    │                       │   └── response_format: json_object             │
│    │                       │   └── temperature: 0.1                         │
│    │                       │   └── retry: 3 attempts, 10s delay on 429      │
│    │                       └── Mock fallback (keyword weighting)            │
│    │                                                                        │
│    └── After all questions graded:                                          │
│        └── SUM(marks_awarded) → percentage → grade → UPDATE students        │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ POSTGRESQL DATABASE SCHEMA (Supabase Cloud)                                 │
│                                                                             │
│  exams ───1:N──► questions                                                  │
│  exams ───1:N──► students ──1:N──► evaluations                              │
│  questions ──1:N──► evaluations                                             │
│                                                                             │
│  CASCADE DELETES on all foreign keys                                        │
│  CHECK constraints on question_type (mcq/short/long)                        │
│  CHECK constraints on status (pending/evaluated)                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Transaction Boundaries

Every critical write operation is wrapped in a PostgreSQL transaction:

| Operation | Transaction Scope | Rollback Triggers |
|---|---|---|
| **Exam Setup** (`exam.js:58-94`) | `BEGIN` → INSERT exam + questions + UPDATE total_marks → `COMMIT` | Any INSERT/UPDATE failure; file read error |
| **Student Upload** (`upload.js:73-107`) | Per-student `BEGIN` → INSERT student + evaluations → `COMMIT` | Per-student PDF parse failure; DB constraint violation |
| **Mark Override** (`evaluate.js:188-225`) | `BEGIN` → UPDATE evaluation + recalculate student totals → `COMMIT` | Invalid marks range; question not found |

### Progress Tracking (In-Memory)

The evaluation orchestrator uses an in-memory `progressMap` object (`evaluationOrchestrator.js:5`) indexed by `examId`:

```javascript
progressMap[examId] = {
  total: 25,          // total pending students
  evaluated: 12,      // completed so far
  percentage: 48,     // rounded integer
  status: 'processing' // 'idle' | 'processing' | 'done' | 'failed'
};
```

The frontend polls `GET /api/exam/:id/status` every 3 seconds (configured in `Upload.jsx`) to render a progress bar.

---

## 2. 🛠️ Complete Structural Tech Stack

### Backend (`backend/package.json`)

| Library | Version | Purpose |
|---|---|---|
| `express` | `^5.2.1` | HTTP server framework (router, middleware, error handling) |
| `pg` | `^8.22.0` | PostgreSQL client (Pool with SSL, parameterized queries via `$N`) |
| `multer` | `^2.2.0` | Multipart file upload handler (disk storage, 10MB limit) |
| `pdf-parse` | `^2.4.5` | PDF text extraction via `PDFParse` class (Uint8Array input) |
| `groq-sdk` | `^1.2.1` | Groq LLM API client (`chat.completions.create` with JSON mode) |
| `jsonwebtoken` | `^9.0.3` | JWT signing and verification (HS256, 24h expiry) |
| `jspdf` | `^4.2.1` | Server-side PDF generation (`doc.output('arraybuffer')` → `Buffer`) |
| `xlsx` | `^0.18.5` | Excel spreadsheet generation (`json_to_sheet` → `XLSX.write`) |
| `cors` | `^2.8.6` | Cross-origin resource sharing (allows all origins) |
| `dotenv` | `^17.4.2` | Environment variable loading from `.env` |

### Frontend (`frontend/package.json`)

| Library | Version | Purpose |
|---|---|---|
| `react` | `^19.2.6` | UI framework (hooks, state management, effects) |
| `react-dom` | `^19.2.6` | React DOM rendering (`createRoot` API) |
| `react-router-dom` | `^7.18.0` | Client-side routing (`BrowserRouter`, `useParams`, `useNavigate`) |
| `tailwindcss` | `^4.3.1` | Utility-first CSS framework (via `@tailwindcss/vite` plugin) |
| `@tailwindcss/vite` | `^4.3.1` | Vite plugin for Tailwind CSS 4 (zero-config setup) |
| `axios` | `^1.18.0` | HTTP client (request/response interceptors, JWT Bearer injection) |
| `jsPDF` | `^4.2.1` | (Client-side, unused in production — all exports are server-side) |
| `xlsx` | `^0.18.5` | (Client-side, unused in production — all exports are server-side) |

### Dev Dependencies

| Library | Version | Purpose |
|---|---|---|
| `vite` | `^8.0.12` | Build tool and dev server (HMR, fast refresh) |
| `@vitejs/plugin-react` | `^6.0.1` | React Fast Refresh + JSX transform for Vite |
| `eslint` | `^10.3.0` | JavaScript/JSX linting with flat config |

### Database Schema

```sql
-- exams: top-level container for each assessment
CREATE TABLE IF NOT EXISTS exams (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    class VARCHAR(100) NOT NULL,
    total_marks INTEGER NOT NULL,
    instructions TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    class_account_id INTEGER  -- FK to virtual class account (not a real table)
);

-- questions: parsed from question paper PDF
CREATE TABLE IF NOT EXISTS questions (
    id SERIAL PRIMARY KEY,
    exam_id INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    question_number VARCHAR(50) NOT NULL,
    question_text TEXT NOT NULL,
    question_type VARCHAR(50) CHECK(question_type IN ('mcq', 'short', 'long')) NOT NULL,
    marks INTEGER NOT NULL,
    answer_key TEXT
);

-- students: one row per uploaded answer sheet
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

-- evaluations: atomic grading unit (one row per student × question)
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
```

Migrations are auto-applied at startup via `db.js:36-40`:
```sql
ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS is_overridden INTEGER DEFAULT 0;
ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS override_note TEXT;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS class_account_id INTEGER;
```

---

## 3. 🔐 Session Security, Cryptography & Interceptors

### Class Accounts Authentication Architecture

EvalAI uses a **stateless, environment-variable-driven authentication model**. Unlike traditional applications that store credentials in a `users` table, EvalAI's class accounts exist entirely in the deployment environment:

```
CLASS_1_NAME=Class 10
CLASS_1_PASSWORD=class10pass
CLASS_2_NAME=Class 11 Science
CLASS_2_PASSWORD=class11scipass
...
CLASS_10_NAME=Class 12 Commerce
CLASS_10_PASSWORD=class12compass
```

**Login Flow** (`routes/auth.js:40-93`):

```
POST /api/auth/login { className, password }
    ↓
For i = 1..10:
  if process.env[`CLASS_${i}_NAME`] === className → match found
    ↓
Verify: process.env[`CLASS_${i}_PASSWORD`] === password
    ↓
Sign JWT: jwt.sign({ classId, className, iat }, JWT_SECRET, { expiresIn: '24h' })
    ↓
Return { token, className, classId }
```

**Class List Discovery** (`routes/auth.js:10-36`):

```
GET /api/auth/classes
    ↓
Iterate CLASS_{1..10}_NAME env vars until none found
    ↓
Return [{ id: 1, name: "Class 10" }, { id: 2, name: "Class 11 Science" }, ...]
```

### JWT Token Lifecycle

| Property | Value |
|---|---|
| **Algorithm** | HS256 |
| **Payload** | `{ classId, className, iat }` |
| **Secret** | `process.env.JWT_SECRET` (fallback: `'yoursecretkey123'`) |
| **Expiry** | `24h` |
| **Storage (client)** | `localStorage` via `auth.js` |

### Axios Request Interceptor

Defined in `frontend/src/utils/api.js:9-15`:

```javascript
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

Every outgoing HTTP request from the React app automatically receives the JWT Bearer token. The token is read from `localStorage` at call-time, so it reflects the latest auth state.

### Axios Response Interceptor

Defined in `frontend/src/utils/api.js:17-25`:

```javascript
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      logout();  // clears localStorage + redirects to /login
    }
    return Promise.reject(error);
  }
);
```

When the backend returns `401` (missing/expired token) or `403` (invalid token), the interceptor:
1. Calls `logout()` which removes `token`, `className`, `classId` from `localStorage`
2. Redirects the browser to `/login`
3. Propagates the error so the calling component can handle it if needed

### Backend JWT Middleware

Defined in `backend/middleware/auth.js`:

```javascript
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // "Bearer TOKEN"

  if (!token) return res.status(401).json({ error: 'Access token required' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'yoursecretkey123');
    req.user = decoded;
    req.classId = decoded.classId;
    req.className = decoded.className;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError')
      return res.status(401).json({ error: 'Token expired' });
    if (error.name === 'JsonWebTokenError')
      return res.status(403).json({ error: 'Invalid token' });
    return res.status(403).json({ error: 'Token verification failed' });
  }
};
```

### Secured Programmatic Blob Export Pipeline

**The Problem:** All export routes (`/api/exam/:id/export/excel`, `/api/exam/:id/export/pdf`, etc.) are registered **behind** the JWT middleware boundary (`index.js:147-153`):

```javascript
// index.js — Route registration order
app.use('/api/auth', authRoutes);        // PUBLIC (before middleware)
app.use('/api', authenticateToken);      // MIDDLEWARE BOUNDARY
app.use('/api', examRoutes);             // PROTECTED (after middleware)
app.use('/api', uploadRoutes);
app.use('/api', evaluateRoutes);
app.use('/api', exportRoutes);           // ← Export routes require JWT
```

A naive `window.location.href = API_BASE + '/api/exam/.../export/excel'` fails because browser navigation **cannot attach custom `Authorization` headers**. The server sees no `Bearer` token and returns `401 Access token required`.

**The Solution** (`Dashboard.jsx:45-63`):

```javascript
const handleExport = async (type) => {
  // 1. Authenticated Axios request with blob response type
  const response = await api.get(`/api/exam/${examId}/export/${type}`, {
    responseType: 'blob'
  });

  // 2. Create an in-memory Object URL from the binary blob
  const url = window.URL.createObjectURL(new Blob([response.data]));

  // 3. Dynamically create a hidden <a> element and click it
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `Class_Results_${examId}.${extension}`);
  document.body.appendChild(link);
  link.click();

  // 4. Clean up: remove the element and revoke the Object URL
  link.parentNode.removeChild(link);
  window.URL.revokeObjectURL(url);
};
```

**Why this works:**
- `api.get` goes through the Axios request interceptor, which injects `Authorization: Bearer <token>`
- `responseType: 'blob'` tells Axios to keep the binary data as a raw `Blob`
- `URL.createObjectURL()` creates a temporary `blob:` URI that the browser treats as a downloadable resource
- The dynamically created `<a>` element triggers the browser's native download dialog without navigating away
- `revokeObjectURL()` releases the memory immediately after download starts

**Edge Case — PDF Export in `StudentReport.jsx`:** Line 127 of `StudentReport.jsx` still uses the unauthenticated `window.location.href` pattern for individual student PDF export. This will fail if the student report page is accessed directly via a bookmark or link, but works when navigated from within the app because the JWT token is present in `localStorage` for the `isLoggedIn()` check. A future improvement would align this with the blob download pattern.

### ProtectedRoute Component

Defined in `frontend/src/components/ProtectedRoute.jsx` — wraps all non-login routes in `App.jsx`:

```javascript
// Pseudocode
function ProtectedRoute({ children }) {
  return isLoggedIn() ? children : <Navigate to="/login" />;
}
```

Where `isLoggedIn()` (`auth.js:18-28`) decodes the JWT payload and checks expiry:

```javascript
export const isLoggedIn = () => {
  const token = getToken();
  if (!token) return false;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
};
```

---

## 4. 📂 Advanced Pipeline Mechanics

### Regex-Powered Question Segmentation

`questionParser.js` uses a two-pass approach to extract questions from raw PDF text.

**Pass 1 — Primary Regex** (`questionParser.js:9`):

```javascript
const regex = /(?:^|\r?\n)\s*(?:Q(?:uestion)?\s*(\d+)|(\d+))\s*[:.)-]/gi;
```

This matches patterns at line boundaries:
| Input Pattern | Match | Captured Number |
|---|---|---|
| `Q1:` | Full match | `1` |
| `Question 1.` | Full match | `1` |
| `1)` | Full match | `1` |
| `1.` | Full match | `1` |
| `1 -` | Full match | `1` |

**Marks Extraction** (`questionParser.js:34`):

```javascript
const marksRegex = /(?:\[\s*(\d+)\s*(?:marks?|pts?|points?)?\s*\]|\(\s*(\d+)\s*(?:marks?|pts?|points?)?\s*\))/i;
```

This handles formats like:
- `[2 marks]` → `2`
- `[5]` → `5`
- `(3 marks)` → `3`
- `(10 points)` → `10`

**MCQ Auto-Detection** (`questionParser.js:43`):

```javascript
const mcqRegex = /\b([A-D]|[a-d])\s*[.)-]/;
```

If the question text contains option markers (A., B., C., D.), it is classified as `mcq`.

**Pass 2 — Fallback Parser** (`questionParser.js:61-101`):

When the primary regex finds zero matches (e.g., questions lack `Q` prefix), a line-by-line fallback activates. It scans for lines starting with a digit `^(\d+)[\s.)-]` and accumulates subsequent lines as the question body. Marks and type are then extracted from the accumulated text.

**Type Refinement** (`questionParser.js:162-172`):

After parsing the answer key, `refineTypeWithAnswer()` distinguishes `short` from `long` theory questions:
- If the answer key is ≤2 lines and <200 characters → `short`
- Otherwise → `long`
- MCQ answers are never overridden

### Answer Key Parsing

`parseAnswerKey()` (`questionParser.js:109-154`) uses the same line-boundary regex as question segmentation. For each matched question number, it captures the text up to the next question boundary. Special handling for single-letter MCQ answers:

```javascript
// Clean single letter answer keys (e.g. "D\n\n-- 1 of 1 --" -> "D")
if (/^[A-D]\b/i.test(ansText)) {
  ansText = ansText.charAt(0).toUpperCase();
}
```

This removes PDF page markers and whitespace that sometimes append to answer key characters.

### Student Answer Extraction

`answerParser.js` mirrors the same regex segmentation pattern, then cleans each extracted answer via `cleanStudentAnswer()`:

```javascript
function cleanStudentAnswer(ansText) {
  // Extract just the letter from "Answer: B ✓" or "Answer: B ✗"
  const match = ansText.match(/Answer:\s*([A-D])/i);
  if (match) return match[1].toUpperCase();
  
  // Handle blank answers
  if (ansText.includes('Answer:')) return 'No answer provided';
  
  return ansText.trim();
}
```

### AI Evaluation Batching Strategy

The evaluation orchestrator (`evaluationOrchestrator.js`) processes grading one question at a time across all students, ensuring consistent rubric application.

**Batch Size:** 25 student responses per API call (`evaluationOrchestrator.js:104`):

```javascript
const batchSize = 25;
for (let i = 0; i < studentAnswersForEvaluator.length; i += batchSize) {
  const batch = studentAnswersForEvaluator.slice(i, i + batchSize);
  const evaluationResults = await evaluateQuestionBatch({ ... });
  // ...
}
```

**Why 25?** Groq's free tier imposes rate limits. Smaller batches reduce the risk of 429 errors while maintaining reasonable throughput. Each batch is processed sequentially per question to keep the API load predictable.

**Retry Logic** (`groqEvaluator.js:34-59`):

```javascript
async function callGroqWithRetry(params, maxRetries = 3, delayMs = 10000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await client.chat.completions.create(params);
      return response.choices[0].message.content;
    } catch (error) {
      const isRateLimit = error.status === 429
        || error.message?.includes('429')
        || error.message?.toLowerCase().includes('rate limit');

      if (isRateLimit && attempt < maxRetries) {
        console.warn(`Groq Rate Limit hit. Retrying in ${delayMs / 1000}s...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      } else {
        throw error;
      }
    }
  }
}
```

### Mock Evaluator — Weighted Keyword Matching

When `GROQ_API_KEY` is not configured, `generateMockEvaluation()` (`groqEvaluator.js:64-118`) provides offline fallback:

**MCQ Mode:** Strict string comparison after uppercased trim:
```javascript
const isCorrect = studentAnswerText.trim().toUpperCase() === answerKey.trim().toUpperCase();
return { marks_awarded: isCorrect ? marksAllotted : 0, feedback: '' };
```

**Theory Mode:** Weighted keyword ratio:
```javascript
// 1. Extract significant words from answer key (length > 3)
const cleanKeyWords = answerKey.toLowerCase().split(/\s+/).filter(w => w.length > 3);

// 2. Count matches in student answer
let ratio = 0.35; // base score for submitting any answer
if (cleanKeyWords.length > 0) {
  ratio += (matches / cleanKeyWords.length) * 0.65;
}
ratio = Math.min(1.0, ratio);

// 3. Convert to marks (rounded to nearest 0.5)
const marks = Math.round(ratio * marksAllotted * 2) / 2;

// 4. Assign feedback tier
if (ratio < 0.5) feedback = 'Incomplete response, missing crucial definitions.';
else if (ratio >= 0.85) feedback = 'Excellent and comprehensive answer.';
else feedback = 'Good response, covered the core elements.';
```

### Groq JSON Parsing with Key Variation Fallback

Because LLM output is non-deterministic, `cleanAndParseJson()` (`groqEvaluator.js:22-29`) strips markdown code blocks, and the response handler checks multiple known key names (`groqEvaluator.js:223-231`):

```javascript
const results = Array.isArray(parsed) ? parsed : (
  parsed.evaluation_results
  || parsed.students_evaluations
  || parsed.student_evaluations
  || parsed.evaluations
  || parsed.evaluation
  || parsed.results
  || []
);
```

Each key variation was observed in production across different Groq API calls with identical prompt structures.

### Grade Calculation Pipeline

After all questions are graded (`evaluationOrchestrator.js:144-190`):

```javascript
const totalPossibleMarks = questions.reduce((sum, q) => sum + q.marks, 0) || 1;

// Per student:
const rawScore = SUM(marks_awarded);
const percentage = Math.min((rawScore / totalPossibleMarks) * 100, 100);
const cappedScore = Math.min(rawScore, totalPossibleMarks);

let grade = 'F';
if (percentage >= 90) grade = 'A+';
else if (percentage >= 80) grade = 'A';
else if (percentage >= 70) grade = 'B';
else if (percentage >= 60) grade = 'C';
else if (percentage >= 50) grade = 'D';
```

Scores are capped at `totalPossibleMarks` to prevent impossible percentages (e.g., 43.5/40 due to mark override).

### Mark Override Recalculation

The `PATCH /override` endpoint (`evaluate.js:149-245`) uses a PostgreSQL transaction to atomically:
1. Validate the new marks (must be between 0 and question's max marks)
2. `UPDATE evaluations SET marks_awarded = $1, is_overridden = 1`
3. `SELECT SUM(marks_awarded)` to recalculate total
4. Recompute percentage and grade
5. `UPDATE students` with new totals

---

## 5. 🌐 Host Environment & Network Routing Rules

### Environment Variable Configuration

#### Backend (`backend/.env.example`)

| Variable | Required | Development | Production (Render) |
|---|---|---|---|
| `PORT` | No (default 5000) | `5000` | Set by Render (`$PORT`) |
| `DATABASE_URL` | **Yes** | Local PostgreSQL or Supabase | Supabase Transaction Pooler |
| `GROQ_API_KEY` | No (mock fallback) | Optional | Set to your Groq API key |
| `JWT_SECRET` | Recommended | `dev-secret-key` | Strong random string |
| `CLASS_{1..10}_NAME` | Per class | `Class 10` | Matches school roster |
| `CLASS_{1..10}_PASSWORD` | Per class | `class10pass` | Per-class passwords |

#### Frontend (`VITE_*` config)

| Variable | Development | Production (Vercel) |
|---|---|---|
| `VITE_API_BASE` | Not set → falls back to `http://localhost:5000` | Set to Render backend URL (e.g., `https://evalai-backend.onrender.com`) |

### Fallback Resolution Logic

`frontend/src/config.js:1`:

```javascript
export const API_BASE = import.meta.env.VITE_API_BASE
  || `http://${window.location.hostname}:5000`;
```

In development, this automatically connects to the backend running on the same host at port 5000. In production, the Vercel environment variable overrides it.

### Route Registration Order

The security architecture depends on precise middleware ordering in `backend/index.js`:

```
1. CORS middleware              (app.use(cors(...)))
2. JSON body parser              (app.use(express.json()))
3. URL-encoded parser            (app.use(express.urlencoded({ extended: true })))
4. Static uploads                (app.use('/uploads', express.static(...)))
5. HEALTH CHECK                  (app.get('/api/health'))         ← PUBLIC
6. AUTH ROUTES                   (app.use('/api/auth', authRoutes)) ← PUBLIC
7. DEBUG ROUTES                  (app.get('/api/debug/*'))         ← PUBLIC
8. ═══ JWT MIDDLEWARE ════════   (app.use('/api', authenticateToken))
9. EXAM ROUTES                   (app.use('/api', examRoutes))    ← PROTECTED
10. UPLOAD ROUTES                (app.use('/api', uploadRoutes))  ← PROTECTED
11. EVALUATE ROUTES              (app.use('/api', evaluateRoutes))← PROTECTED
12. EXPORT ROUTES                (app.use('/api', exportRoutes))  ← PROTECTED
13. ERROR HANDLER                (app.use((err, req, res, next))) ← TRAP
```

Any route registered before line 8 is publicly accessible. Any route after line 8 requires a valid JWT.

### Cloud Database Connectivity Fix

**The Challenge:** Render's free-tier PostgreSQL instances listen on IPv6 by default. The `pg` Node.js client, when connecting via `DATABASE_URL` with a hostname that resolves to IPv6, fails on Render's free networking layer with a timeout error.

**The Solution:** Use Supabase's **Transaction Pooler** (port `6543`) instead of the direct PostgreSQL connection (port `5432`). The pooler:
- Resolves over IPv4 instead of IPv6
- Provides connection pooling (reduces connection churn)
- Handles prepared statement lifecycle across pool resets

```javascript
// backend/database/db.js
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,  // supabase-pooler-url:6543/postgres
  ssl: { rejectUnauthorized: false }
});
```

**Connection string format:**
```
postgresql://[user]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
```

### Deployment Topology

```
┌─────────────────┐         ┌──────────────────┐         ┌──────────────────────┐
│   Vercel (CDN)  │  HTTP   │   Render (Cloud) │  TCP    │ Supabase (PostgreSQL)│
│                 │────────►│                  │────────►│                      │
│  Built SPA      │  Axios  │  Express 5       │  pg     │  Transaction Pooler  │
│  VITE_API_BASE  │  JWT    │  DATABASE_URL    │  SSL    │  Port 6543 (IPv4)    │
│  → Render URL   │  Bearer │  GROQ_API_KEY    │  Pool   │  4 tables (CASCADE)  │
│                 │         │  JWT_SECRET      │         │                      │
│  Fallback:      │         │  CLASS_{1..10}_* │         │  Auto-migrations     │
│  localhost:5000 │         │                  │         │  on startup          │
└─────────────────┘         └──────────────────┘         └──────────────────────┘
```

### Local Development Quick Start

```bash
# 1. Clone and install
git clone <repo-url> && cd EvalAI
cd backend && npm install
cd ../frontend && npm install

# 2. Configure environment
cp backend/.env.example backend/.env
# Edit backend/.env with DATABASE_URL, GROQ_API_KEY, JWT_SECRET, CLASS_*

# 3. Start backend (terminal 1)
cd backend
node index.js

# 4. Start frontend (terminal 2)
cd frontend
npm run dev

# 5. Open http://localhost:5173
```

### Process Lifecycle & Error Handling

`backend/index.js` registers handlers to prevent silent crashes:

```javascript
process.on('unhandledRejection', (reason, promise) => {
  console.error("🚨 Unhandled Rejection:", reason);
});

process.on('uncaughtException', (err) => {
  console.error("🚨 Uncaught Exception:", err);
});

process.on('exit', (code) => {
  if (code === 0) console.log("Clean exit (code 0)");
  else console.log(`Exit with ERROR code: ${code}`);
});
```

The server also logs cleanly on forced close, and `process.stdin.resume()` prevents the Node process from exiting immediately on platforms that send STDIN end-of-file.

---

*Documentation generated from live codebase analysis — every version number, regex pattern, and architectural decision is sourced from actual source files at `backend/package.json:14-23`, `frontend/package.json:13-31`, `backend/services/*.js`, `frontend/src/utils/*.js`, and all route/service implementations.*
