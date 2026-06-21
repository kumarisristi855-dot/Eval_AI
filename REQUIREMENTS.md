# EvalAI — Requirements

## System Requirements

- Node.js v18.0.0 or higher
- npm v9.0.0 or higher
- PostgreSQL database (local or cloud via Supabase)
- Modern web browser (Chrome, Firefox, Edge, Safari)
- Internet connection (for Groq API calls during evaluation)

## Backend Dependencies

| Package | Version | Purpose |
|---|---|---|
| express | ^5.2.1 | Web server framework |
| pg | ^8.22.0 | PostgreSQL client (Pool with SSL) |
| multer | ^2.2.0 | PDF file upload handling (10MB limit) |
| pdf-parse | ^2.4.5 | Extract text from PDF files (Uint8Array) |
| groq-sdk | ^1.2.1 | Groq LLM API client (llama-3.3-70b-versatile) |
| jsonwebtoken | ^9.0.3 | JWT token signing and verification (24h expiry) |
| cors | ^2.8.6 | Cross-origin request handling |
| dotenv | ^17.4.2 | Environment variable loading |
| jspdf | ^4.2.1 | Server-side PDF report generation |
| xlsx | ^0.18.5 | Server-side Excel file generation |

## Frontend Dependencies

| Package | Version | Purpose |
|---|---|---|
| react | ^19.0.0 | UI framework |
| react-dom | ^19.0.0 | React DOM rendering |
| react-router-dom | ^7.0.0 | Client-side routing |
| axios | ^1.7.0 | HTTP requests to backend (with JWT interceptors) |
| tailwindcss | ^4.0.0 | Utility-first CSS styling (via @tailwindcss/vite plugin) |

## Dev Dependencies

| Package | Version | Purpose |
|---|---|---|
| vite | ^8.0.0 | Frontend build tool |
| @vitejs/plugin-react | latest | Vite React plugin |
| @tailwindcss/vite | latest | Vite Tailwind CSS 4 plugin |
| eslint | ^9.0.0 | Code linting |

## External Services Required

| Service | Purpose | Free Tier |
|---|---|---|
| Groq API | AI evaluation of theory answers | Yes — 6000 tokens/min |
| Supabase (optional) | Cloud PostgreSQL hosting | Yes — 500MB database |

## Environment Variables Required

```
PORT=5000
DATABASE_URL=postgresql://user:pass@host:5432/evalai
GROQ_API_KEY=your_groq_api_key_here
JWT_SECRET=your_jwt_secret_here
CLASS_1_NAME=Class 10
CLASS_1_PASSWORD=class10pass
CLASS_2_NAME=Class 11 Science
CLASS_2_PASSWORD=class11scipass
```

## Frontend Environment Variables

| Variable | Purpose |
|---|---|
| VITE_API_BASE | Override API base URL for production (set on Vercel); defaults to localhost:5000 in dev |

## Hardware Recommendations

- RAM: 4GB minimum, 8GB recommended
- Storage: 500MB free space (for uploaded PDFs)
- CPU: Any modern processor
- PostgreSQL connection string with SSL support

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
