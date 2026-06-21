# EvalAI — Requirements

## System Requirements

- Node.js v18.0.0 or higher
- npm v9.0.0 or higher
- Modern web browser (Chrome, Firefox, Edge, Safari)
- Internet connection (for Groq API calls during evaluation)

## Backend Dependencies

| Package | Version | Purpose |
|---|---|---|
| express | ^4.18.2 | Web server framework |
| better-sqlite3 | ^9.4.3 | Local SQLite database |
| multer | ^1.4.5 | PDF file upload handling |
| pdf-parse | ^1.1.1 | Extract text from PDF files |
| groq-sdk | ^0.3.3 | Groq LLM API client |
| cors | ^2.8.5 | Cross-origin request handling |
| dotenv | ^16.4.1 | Environment variable loading |
| jspdf | ^2.5.1 | PDF report generation |
| xlsx | ^0.18.5 | Excel file generation |

## Frontend Dependencies

| Package | Version | Purpose |
|---|---|---|
| react | ^18.2.0 | UI framework |
| react-dom | ^18.2.0 | React DOM rendering |
| react-router-dom | ^6.22.1 | Client-side routing |
| axios | ^1.6.7 | HTTP requests to backend |
| tailwindcss | ^3.4.1 | Utility-first CSS styling |
| jspdf | ^2.5.1 | Frontend PDF export |
| xlsx | ^0.18.5 | Frontend Excel export |

## Dev Dependencies

| Package | Version | Purpose |
|---|---|---|
| vite | ^5.1.4 | Frontend build tool |
| eslint | ^8.57.0 | Code linting |

## External Services Required

| Service | Purpose | Free Tier |
|---|---|---|
| Groq API | AI evaluation of theory answers | Yes — 6000 tokens/min |

## Environment Variables Required

```
PORT=5000
GROQ_API_KEY=your_groq_api_key_here
```

## Hardware Recommendations

- RAM: 4GB minimum, 8GB recommended
- Storage: 500MB free space (for uploaded PDFs and database)
- CPU: Any modern processor

## Installation

### Backend
```bash
cd backend
npm install
```

### Frontend
```bash
cd frontend
npm install
```
