# EvalAI - Project Context

## Overview
EvalAI is an AI-powered examination platform that automates answer sheet evaluation. Teachers upload question papers, answer keys, and student PDFs. The system parses questions, evaluates answers (MCQ programmatically + theory via Groq LLM), and generates reports with grades, feedback, and export options.

## Tech Stack
- **Backend:** Node.js, Express 5, PostgreSQL, Multer, pdf-parse, Groq SDK, jsPDF, SheetJS
- **Frontend:** React 19, Vite 8, Tailwind CSS 4, React Router 7, Axios, jsPDF, SheetJS
- **AI:** Groq LLM (llama-3.3-70b-versatile) for theory question evaluation

## Project Structure
```
EvalAI/
├── backend/
│   ├── index.js                    # Express server entry (port 5000)
│   ├── .env                        # Config: PORT, GROQ_API_KEY, JWT_SECRET, class credentials
│   ├── .env.example                # Template (PORT, GROQ_API_KEY only)
│   ├── database/
│   │   ├── db.js                   # PostgreSQL connection + schema init + migrations
│   │   └── schema.sql              # CREATE TABLE (exams, questions, students, evaluations)
│   ├── routes/
│   │   ├── exam.js                 # Exam CRUD: setup, list, get, delete
│   │   ├── upload.js               # Student PDF upload + parsing
│   │   ├── evaluate.js             # Evaluation trigger, status polling, results, mark override
│   │   └── export.js               # Excel and PDF export
│   ├── services/
│   │   ├── pdfParser.js            # PDF text extraction
│   │   ├── questionParser.js       # Regex question/answer-key parsing
│   │   ├── answerParser.js         # Student answer extraction
│   │   ├── groqEvaluator.js        # Groq LLM calls with retry + mock fallback
│   │   ├── evaluationOrchestrator.js  # Full pipeline coordinator
│   │   └── reportGenerator.js      # Excel + PDF report generation
│   ├── uploads/                    # Temp directory for uploaded PDFs
│   └── test_pipeline.js            # Manual integration test
├── frontend/
│   ├── src/
│   │   ├── main.jsx                # React 19 entry point
│   │   ├── App.jsx                 # Routes + sticky navbar (no redundant New Exam link)
│   │   ├── config.js               # Central API config
│   │   ├── components/
│   │   │   └── ProtectedRoute.jsx  # Auth route guard
│   │   ├── utils/
│   │   │   ├── auth.js             # LocalStorage token helper, isLoggedIn, logout
│   │   │   └── api.js              # Axios wrapper with auth headers & auto-logout
│   │   └── pages/
│   │       ├── Login.jsx           # Class selection & password entry (with visibility toggle)
│   │       ├── ExamHistory.jsx     # Exam listing with select/delete (Protected)
│   │       ├── Setup.jsx           # New exam creation form (Protected)
│   │       ├── Upload.jsx          # Student PDF upload + evaluation (Protected)
│   │       ├── Dashboard.jsx       # Class results table + metrics + authenticated export (Protected)
│   │       ├── StudentReport.jsx   # Individual report + mark override (Protected)
│   │       └── AddStudents.jsx     # Add more students to existing exam (Protected)
│   ├── public/
│   │   ├── favicon.svg
│   │   ├── icons.svg
│   │   ├── logo.png
│   │   └── manifest.json
│   └── vite.config.js              # Vite + React + Tailwind + ngrok config
├── screenshots/                    # 7 UI screenshots (PNG)
├── .gitignore
├── README.md
├── REQUIREMENTS.md
└── development_log.md
```

## Database Schema
```
exams (1) ──< (N) questions
  │
  └──< (N) students
              │
              └──< (N) evaluations >── questions
```

### Tables
| Table | Key Columns |
|---|---|
| exams | id, name, subject, class, total_marks, instructions, created_at, class_account_id |
| questions | id, exam_id (FK), question_number, question_text, question_type (mcq/short/long), marks, answer_key |
| students | id, exam_id (FK), filename, student_name, total_marks_obtained, percentage, grade, status (pending/evaluated) |
| evaluations | id, student_id (FK), question_id (FK), student_answer, marks_awarded, feedback, is_overridden, override_note |

## API Routes

### Authentication Routes
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/auth/classes` | Fetch all available class names |
| POST | `/api/auth/login` | Login with class name and password (returns JWT) |

### Exam Routes (Protected)
| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/exam/setup` | Create exam with question paper + answer key PDFs |
| GET | `/api/exams` | List all exams with student counts |
| GET | `/api/exam/:id` | Get exam details with questions |
| DELETE | `/api/exams` | Delete one or more exams |

### Upload Routes (Protected)
| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/exam/:id/upload-students` | Upload student PDF answer sheets |

### Evaluate Routes (Protected)
| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/exam/:id/evaluate` | Trigger async evaluation |
| GET | `/api/exam/:id/status` | Get evaluation progress |
| GET | `/api/exam/:id/results` | Get all student results |
| GET | `/api/exam/:id/student/:studentId` | Get detailed student report |
| PATCH | `/api/exam/:examId/student/:studentId/question/:questionId/override` | Override marks |

### Export Routes (Protected/Public fallback)
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/exam/:id/export/excel` | Download class results as .xlsx |
| GET | `/api/exam/:id/export/pdf` | Download class results as PDF |
| GET | `/api/exam/:id/student/:studentId/export/pdf` | Download student report as PDF |

### Debug Routes
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Health check |
| GET | `/api/debug/student/:studentId` | Raw student dump |
| POST | `/api/debug/parse-pdf` | Debug PDF parsing |

## Frontend Routes
| Path | Component | Purpose |
|---|---|---|
| `/login` | Login | Authentication & Class selection |
| `/` | ExamHistory | List all exams (Protected) |
| `/setup` | Setup | Create new exam (Protected) |
| `/upload/:examId` | Upload | Upload student PDFs (Protected) |
| `/dashboard/:examId` | Dashboard | Class results + metrics (Protected) |
| `/student/:examId/:studentId` | StudentReport | Individual report + mark override (Protected) |
| `/exam/:examId/add-students` | AddStudents | Add more students (Protected) |

## Key Features
1. **Exam Setup** - Upload question paper + answer key PDFs, auto-parse questions (regex)
2. **Student Upload** - Batch upload student answer sheet PDFs
3. **AI Evaluation** - MCQ graded programmatically, theory via Groq LLM (batches of 25)
4. **Mock Fallback** - Keyword-matching evaluator when no API key configured
5. **Grade Scale** - A+ (90-100%), A (80-89%), B (70-79%), C (60-69%), D (50-59%), F (<50%)
6. **Dashboard** - Summary metrics, sortable results table
7. **Student Report** - Question-by-question breakdown, strengths/weaknesses analysis
8. **Mark Override** - Teachers can manually override AI-awarded marks
 9. **Export** - Excel (SheetJS) and PDF (jsPDF) for class and individual reports (authenticated blob download)
10. **Add More Students** - Upload additional sheets to existing exam
11. **JWT Authentication** - Role-based / Class-based authentication for dynamic and secure cross-device access

## Dependencies

### Backend
| Package | Purpose |
|---|---|
| express | Web framework (v5) |
| pg | PostgreSQL client driver |
| multer | File upload middleware |
| pdf-parse | PDF text extraction |
| groq-sdk | Groq LLM API client |
| cors | Cross-origin middleware |
| dotenv | Environment variables |
| jspdf | PDF generation |
| xlsx | Excel generation |

### Frontend
| Package | Purpose |
|---|---|
| react | UI framework (v19) |
| react-dom | DOM rendering |
| react-router-dom | Client routing (v7) |
| axios | HTTP client |
| tailwindcss | CSS utilities (v4) |
| jspdf | Client-side PDF export |
| xlsx | Client-side Excel export |

## Current Auth Status
- **Active JWT Authentication** - Users select their class and enter their password on the `/login` page. On success, a JWT is returned by the PostgreSQL backend.
- **Client API Client Interceptors** - The axios wrapper (`api.js`) automatically attaches the JWT token to the `Authorization` header as a Bearer token for all requests.
- **Unauthenticated Redirects** - Standard routes are wrapped in a `<ProtectedRoute>` component. If the server responds with a 401 or 403 error, the client interceptor clears credentials and redirects the user to `/login`.
- **Navbar Integration** - The application navbar displays "Logged in as: {getClassName()}" and features a functional "Logout" button. The redundant "New Exam" navbar link was removed since it duplicates the Dashboard's primary action.

## Environment Variables (.env)
```
PORT=5000
GROQ_API_KEY=<set in .env, not committed>
JWT_SECRET=yoursecretkey123
CLASS_1_NAME=Class 6       CLASS_1_PASSWORD=class6pass
CLASS_2_NAME=Class 7       CLASS_2_PASSWORD=class7pass
CLASS_3_NAME=Class 8       CLASS_3_PASSWORD=class8pass
CLASS_4_NAME=Class 9       CLASS_4_PASSWORD=class9pass
CLASS_5_NAME=Class 10      CLASS_5_PASSWORD=class10pass
CLASS_6_NAME=Class 11 Science   CLASS_6_PASSWORD=class11scipass
CLASS_7_NAME=Class 11 Commerce  CLASS_7_PASSWORD=class11compass
CLASS_8_NAME=Class 12 Science   CLASS_8_PASSWORD=class12scipass
CLASS_9_NAME=Class 12 Commerce  CLASS_9_PASSWORD=class12compass
CLASS_10_NAME=Class 12 Arts     CLASS_10_PASSWORD=class12artspass
```

## Architecture Notes
- **3-phase pipeline:** Parse (question paper + answer key) -> Upload (student sheets) -> Evaluate (MCQ programmatic + theory via LLM)
- **Monolithic Express server** with PostgreSQL database.
- **In-memory progress tracking** for evaluation (lost on server restart)
- **Express 5** used (unusual, most projects use Express 4)
- **No tests** - only a manual integration test script
- **Centralized API config resolved** - Removed hardcoded `http://localhost:5000` URLs across all components, standardizing on relative paths using the centralized `api.js` Axios wrapper.
