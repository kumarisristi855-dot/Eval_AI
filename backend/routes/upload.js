const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const db = require('../database/db');
const parsePdf = require('../services/pdfParser');
const parseStudentAnswers = require('../services/answerParser');

// Configure Multer for student sheets
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    // Save with unique name to avoid naming collisions
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

/**
 * POST /api/exam/:id/upload-students
 * Accepts multiple PDF student answer sheets, parses them, and inserts records into DB.
 */
router.post('/exam/:id/upload-students', upload.array('studentFiles'), async (req, res) => {
  const client = await db.pool.connect();
  
  try {
    const examId = req.params.id;
    
    // Verify exam exists (PostgreSQL syntax)
    const examResult = await client.query('SELECT id FROM exams WHERE id = $1', [examId]);
    if (examResult.rows.length === 0) {
      return res.status(404).json({ error: `Exam with ID ${examId} not found` });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No student answer sheet files were uploaded' });
    }

    // Fetch questions for this exam
    const questionsResult = await client.query(
      'SELECT id, question_number FROM questions WHERE exam_id = $1',
      [examId]
    );
    const questions = questionsResult.rows;

    if (questions.length === 0) {
      return res.status(400).json({ error: 'This exam has no questions set up yet. Setup the exam first.' });
    }

    const uploadedStudentsList = [];

    for (const file of req.files) {
      // Derive student name from filename (strip .pdf, replace dashes/underscores with spaces)
      let studentName = path.basename(file.originalname, path.extname(file.originalname));
      studentName = studentName.replace(/[_-]/g, ' ');
      // Capitalize words
      studentName = studentName.replace(/\b\w/g, c => c.toUpperCase());

      // Parse the PDF text
      const pdfText = await parsePdf(file.path);
      const studentAnswersMap = parseStudentAnswers(pdfText);

      // Start transaction for this student's upload
      await client.query('BEGIN');

      try {
        // Save student record in pending status
        const studentInsertResult = await client.query(`
          INSERT INTO students (exam_id, filename, student_name, total_marks_obtained, percentage, grade, status)
          VALUES ($1, $2, $3, 0, 0, NULL, 'pending')
          RETURNING id
        `, [examId, file.originalname, studentName]);
        
        const studentId = studentInsertResult.rows[0].id;

        // Populate evaluations table with student's raw answers
        for (const q of questions) {
          // Check if there is an answer for this question number, else default
          const ansText = studentAnswersMap[q.question_number] || 'No answer provided';
          await client.query(`
            INSERT INTO evaluations (student_id, question_id, student_answer, marks_awarded, feedback)
            VALUES ($1, $2, $3, 0, NULL)
          `, [studentId, q.id, ansText]);
        }

        await client.query('COMMIT');

        uploadedStudentsList.push({
          id: studentId,
          studentName,
          filename: file.originalname,
          status: 'pending'
        });

      } catch (txError) {
        await client.query('ROLLBACK');
        throw txError;
      }
    }

    res.status(201).json({
      studentsUploaded: uploadedStudentsList.length,
      studentList: uploadedStudentsList
    });

  } catch (error) {
    console.error('Error uploading students:', error);
    res.status(500).json({ error: `Internal Server Error: ${error.message}` });
  } finally {
    client.release();
  }
});

module.exports = router;