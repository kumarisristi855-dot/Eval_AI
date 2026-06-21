const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const db = require('../database/db');
const parsePdf = require('../services/pdfParser');
const { parseQuestions, parseAnswerKey, refineTypeWithAnswer } = require('../services/questionParser');

// Multer storage setup
const upload = multer({ 
  dest: 'uploads/',
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

const uploadFields = upload.fields([
  { name: 'questionPaper', maxCount: 1 },
  { name: 'answerKey', maxCount: 1 }
]);

/**
 * POST /api/exam/setup
 * Sets up a new exam, parses questions & answer keys, and saves metadata.
 */
router.post('/exam/setup', uploadFields, async (req, res) => {
  // Grab a dedicated client from the pool for our transaction
  const client = await db.pool.connect();
  
  try {
    const { name, subject, class: className, totalMarks, instructions } = req.body;
    
    // Auth Check: Ensure user is logged in
    const classAccountId = req.user ? req.user.classId : null;
    if (!classAccountId) {
      return res.status(401).json({ error: 'Unauthorized: Missing class credentials' });
    }
    
    if (!req.files || !req.files['questionPaper'] || !req.files['answerKey']) {
      return res.status(400).json({ error: 'Both question paper and answer key PDFs are required' });
    }

    const qPaperFile = req.files['questionPaper'][0];
    const ansKeyFile = req.files['answerKey'][0];

    // 1. Parse PDFs first before touching the database
    const qPaperText = await parsePdf(qPaperFile.path);
    const parsedQuestions = parseQuestions(qPaperText);
    
    if (parsedQuestions.length === 0) {
      console.warn("No questions parsed from question paper PDF using regex. Trying line-by-line fallback.");
    }

    const ansKeyText = await parsePdf(ansKeyFile.path);
    const parsedAnswersMap = parseAnswerKey(ansKeyText);

    // Start PostgreSQL Transaction
    await client.query('BEGIN');

    // 2. Insert exam metadata (PostgreSQL uses RETURNING to get the ID)
    const examInsertResult = await client.query(`
      INSERT INTO exams (name, subject, class, total_marks, instructions, class_account_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `, [
      name || 'Unnamed Exam', 
      subject || 'General', 
      className || 'N/A', 
      parseInt(totalMarks, 10) || 100, 
      instructions || '',
      classAccountId
    ]);
    
    const examId = examInsertResult.rows[0].id;

    // 3. Save parsed questions mapped with answer keys to DB
    for (const q of parsedQuestions) {
      const answer = parsedAnswersMap[q.number] || '';
      const finalType = refineTypeWithAnswer(q.type, answer);
      
      await client.query(`
        INSERT INTO questions (exam_id, question_number, question_text, question_type, marks, answer_key)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [examId, q.number, q.text, finalType, q.marks, answer]);
    }

    // 4. Update the exam's total_marks to be the sum of parsed question marks
    const totalMarksFromQuestions = parsedQuestions.reduce((sum, q) => sum + q.marks, 0);
    await client.query(`
      UPDATE exams SET total_marks = $1 WHERE id = $2
    `, [totalMarksFromQuestions, examId]);

    // Commit Transaction
    await client.query('COMMIT');

    // Clean up temporary uploaded files from disk
    fs.unlink(qPaperFile.path, () => {});
    fs.unlink(ansKeyFile.path, () => {});

    res.status(201).json({
      examId,
      questionsFound: parsedQuestions.length,
      totalMarks: totalMarksFromQuestions
    });

  } catch (error) {
    // Rollback transaction on error
    await client.query('ROLLBACK');
    console.error('Error setting up exam:', error);
    res.status(500).json({ error: `Internal Server Error: ${error.message}` });
  } finally {
    // Release the client back to the pool
    client.release();
  }
});

/**
 * GET /api/exams
 * Returns list of all exams sorted by created_at DESC with student counts.
 * Filtered by the logged-in class.
 */
router.get('/exams', async (req, res) => {
  try {
    const classAccountId = req.user ? req.user.classId : null;
    
    const result = await db.query(`
      SELECT id, name, subject, class, total_marks, created_at,
             (SELECT COUNT(*) FROM students WHERE exam_id = exams.id) as student_count
      FROM exams 
      WHERE class_account_id = $1
      ORDER BY created_at DESC
    `, [classAccountId]);
    
    // Postgres returns data in the .rows array
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching exams:', error);
    res.status(500).json({ error: `Internal Server Error: ${error.message}` });
  }
});

/**
 * GET /api/exam/:id
 * Fetches details of a specific exam along with all its parsed questions.
 */
router.get('/exam/:id', async (req, res) => {
  try {
    const examId = req.params.id;
    const classAccountId = req.user ? req.user.classId : null;

    // Fetch exam, ensuring it belongs to the logged-in class
    const examResult = await db.query(
      'SELECT * FROM exams WHERE id = $1 AND class_account_id = $2', 
      [examId, classAccountId]
    );
    
    if (examResult.rows.length === 0) {
      return res.status(404).json({ error: 'Exam not found or access denied' });
    }

    const exam = examResult.rows[0];

    // Fetch associated questions
    const questionsResult = await db.query(
      'SELECT * FROM questions WHERE exam_id = $1', 
      [examId]
    );

    res.json({
      exam,
      questions: questionsResult.rows
    });
  } catch (error) {
    console.error('Error fetching exam:', error);
    res.status(500).json({ error: `Internal Server Error: ${error.message}` });
  }
});

/**
 * DELETE /api/exams
 * Deletes one or more exams by ID.
 * Body: { examIds: [1, 2, 3] }
 */
router.delete('/exams', async (req, res) => {
  try {
    const { examIds } = req.body;
    const classAccountId = req.user ? req.user.classId : null;

    if (!examIds || !Array.isArray(examIds) || examIds.length === 0) {
      return res.status(400).json({ error: 'examIds must be a non-empty array' });
    }

    if (!classAccountId) {
       return res.status(403).json({ error: 'Access denied: Please login' });
    }

    // PostgreSQL's "ANY" operator allows us to efficiently delete multiple items in one query
    // while strictly enforcing that the exams belong to the logged-in class.
    const deleteResult = await db.query(`
      DELETE FROM exams 
      WHERE id = ANY($1::int[]) AND class_account_id = $2
    `, [examIds, classAccountId]);

    // deleteResult.rowCount tells us how many rows were actually deleted
    if (deleteResult.rowCount === 0) {
        return res.status(403).json({ error: 'No exams deleted. They may not exist or do not belong to your class.' });
    }

    res.json({ success: true, deleted: deleteResult.rowCount });
  } catch (error) {
    console.error('Error deleting exams:', error);
    res.status(500).json({ error: `Internal Server Error: ${error.message}` });
  }
});

module.exports = router;