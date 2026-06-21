require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

console.log('🚀 Starting EvalAI backend initialization...');

// Auto-initialize PostgreSQL database connection
let db;
try {
  db = require('./database/db');
  console.log('✅ Database module loaded successfully');
} catch (error) {
  console.error('❌ CRITICAL: Failed to load database module:', error);
  process.exit(1);
}

// Import routing modules with error catching
let authRoutes, authenticateToken, examRoutes, uploadRoutes, evaluateRoutes, exportRoutes;

try {
  authRoutes = require('./routes/auth');
  console.log('✅ Auth routes loaded');
} catch (error) {
  console.error('❌ CRITICAL: Failed to load auth routes:', error);
  process.exit(1);
}

try {
  authenticateToken = require('./middleware/auth');
  console.log('✅ Auth middleware loaded');
} catch (error) {
  console.error('❌ CRITICAL: Failed to load auth middleware:', error);
  process.exit(1);
}

try {
  examRoutes = require('./routes/exam');
  console.log('✅ Exam routes loaded');
} catch (error) {
  console.error('❌ CRITICAL: Failed to load exam routes:', error);
  process.exit(1);
}

try {
  uploadRoutes = require('./routes/upload');
  console.log('✅ Upload routes loaded');
} catch (error) {
  console.error('❌ CRITICAL: Failed to load upload routes:', error);
  process.exit(1);
}

try {
  evaluateRoutes = require('./routes/evaluate');
  console.log('✅ Evaluate routes loaded');
} catch (error) {
  console.error('❌ CRITICAL: Failed to load evaluate routes:', error);
  process.exit(1);
}

try {
  exportRoutes = require('./routes/export');
  console.log('✅ Export routes loaded');
} catch (error) {
  console.error('❌ CRITICAL: Failed to load export routes:', error);
  process.exit(1);
}

// Debug tooling imports
let multer, upload, pdfParser;
try {
  multer = require('multer');
  upload = multer({ dest: 'uploads/' });
  pdfParser = require('./services/pdfParser');
  console.log('✅ Multer and PDF parser loaded');
} catch (error) {
  console.error('❌ CRITICAL: Failed to load multer/pdfParser:', error);
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 5000;

// Create uploads folder on startup if not present
const uploadsPath = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath);
  console.log('✅ Created local uploads directory.');
}

// CORS middleware setup 
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    callback(null, true);
  },
  credentials: true
}));

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded assets
app.use('/uploads', express.static(uploadsPath));

// ========== ROUTE REGISTRATION ==========

// 1. PUBLIC ROUTES (no auth required)
console.log('📍 Registering public routes...');

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);
console.log('✅ Registered: /api/auth (public - no auth required)');

// Debug routes
app.get('/api/debug/student/:studentId', async (req, res) => {
  try {
    const studentResult = await db.query('SELECT * FROM students WHERE id = $1', [req.params.studentId]);
    const evalResult = await db.query('SELECT * FROM evaluations WHERE student_id = $1', [req.params.studentId]);
    res.json({ 
      student: studentResult.rows[0], 
      evaluations: evalResult.rows 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/debug/parse-pdf', upload.single('pdf'), async (req, res) => {
  try {
    const text = await pdfParser(req.file.path);
    res.json({ text });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. PROTECTED ROUTES (JWT auth required)
console.log('📍 Registering protected routes with JWT middleware...');

// Apply authentication middleware to all subsequent /api routes
app.use('/api', authenticateToken);
console.log('✅ Registered: /api/* (protected - auth required)');

app.use('/api', examRoutes);
app.use('/api', uploadRoutes);
app.use('/api', evaluateRoutes);
app.use('/api', exportRoutes);

// 3. Error handler (must be last)
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

// ========== SERVER START ==========
const server = app.listen(PORT, () => {
  console.log(`✅ Server listening on port ${PORT}`);
});

// ========== ERROR HANDLERS ==========

server.on('close', () => {
  console.warn("⚠️ WARNING: The Express server was forcefully closed!");
});

process.on('unhandledRejection', (reason, promise) => {
  console.error("🚨 CRITICAL ERROR: Unhandled Rejection:", reason);
});

process.on('uncaughtException', (err) => {
  console.error("🚨 CRITICAL ERROR: Uncaught Exception:", err);
});

process.on('exit', (code) => {
  if (code === 0) {
    console.log(`✅ Node process exited cleanly (code 0)`);
  } else {
    console.log(`🛑 Node process exiting with ERROR code: ${code}`);
  }
});

// Keep process alive
process.stdin.resume();