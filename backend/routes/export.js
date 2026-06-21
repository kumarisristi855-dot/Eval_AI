const express = require('express');
const router = express.Router();

const db = require('../database/db');
const { generateExcelBuffer, generateStudentReportPDF, generateClassResultsPDF } = require('../services/reportGenerator');

/**
 * GET /api/exam/:id/export/excel
 * Generates and streams the class results Excel file.
 */
router.get('/exam/:id/export/excel', async (req, res) => {
  try {
    const examId = req.params.id;

    // Verify exam exists (PostgreSQL syntax)
    const examResult = await db.query('SELECT name FROM exams WHERE id = $1', [examId]);
    if (examResult.rows.length === 0) {
      return res.status(404).json({ error: 'Exam not found' });
    }
    const exam = examResult.rows[0];

    const studentsResult = await db.query(`
      SELECT student_name, total_marks_obtained, percentage, grade, status 
      FROM students 
      WHERE exam_id = $1 
      ORDER BY total_marks_obtained DESC
    `, [examId]);

    const students = studentsResult.rows;

    if (students.length === 0) {
      return res.status(400).json({ error: 'No students found for this exam to export' });
    }

    const buffer = generateExcelBuffer(students);

    // Normalize filename
    const safeExamName = exam.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${safeExamName}_results.xlsx"`);
    res.send(buffer);

  } catch (error) {
    console.error('Error exporting Excel:', error);
    res.status(500).json({ error: `Internal Server Error: ${error.message}` });
  }
});

/**
 * GET /api/exam/:id/student/:studentId/export/pdf
 * Generates and streams a PDF performance card for a specific student.
 */
router.get('/exam/:id/student/:studentId/export/pdf', async (req, res) => {
  try {
    const { id: examId, studentId } = req.params;

    // Fetch exam (PostgreSQL syntax)
    const examResult = await db.query('SELECT * FROM exams WHERE id = $1', [examId]);
    if (examResult.rows.length === 0) {
      return res.status(404).json({ error: 'Exam not found' });
    }
    const exam = examResult.rows[0];

    // Fetch student
    const studentResult = await db.query(
      'SELECT * FROM students WHERE id = $1 AND exam_id = $2',
      [studentId, examId]
    );
    if (studentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }
    const student = studentResult.rows[0];

    // Fetch evaluations joined with questions
    const evaluationsResult = await db.query(`
      SELECT e.id as evaluation_id, e.student_answer, e.marks_awarded, e.feedback,
             q.question_number, q.question_text, q.question_type, q.marks
      FROM evaluations e
      JOIN questions q ON e.question_id = q.id
      WHERE e.student_id = $1
      ORDER BY q.id ASC
    `, [studentId]);

    const evaluations = evaluationsResult.rows;

    const buffer = generateStudentReportPDF(student, exam, evaluations);

    // Normalize filename
    const safeStudentName = student.student_name.toLowerCase().replace(/[^a-z0-9]/g, '_');

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeStudentName}_report.pdf"`);
    res.send(buffer);

  } catch (error) {
    console.error('Error exporting PDF:', error);
    res.status(500).json({ error: `Internal Server Error: ${error.message}` });
  }
});

/**
 * GET /api/exam/:id/export/pdf
 * Generates and streams the class results PDF file.
 */
router.get('/exam/:id/export/pdf', async (req, res) => {
  try {
    const examId = req.params.id;

    // Verify exam exists (PostgreSQL syntax)
    const examResult = await db.query('SELECT * FROM exams WHERE id = $1', [examId]);
    if (examResult.rows.length === 0) {
      return res.status(404).json({ error: 'Exam not found' });
    }
    const exam = examResult.rows[0];

    const studentsResult = await db.query(`
      SELECT student_name, total_marks_obtained, percentage, grade, status 
      FROM students 
      WHERE exam_id = $1 
      ORDER BY total_marks_obtained DESC
    `, [examId]);

    const students = studentsResult.rows;

    if (students.length === 0) {
      return res.status(400).json({ error: 'No students found for this exam to export' });
    }

    const buffer = generateClassResultsPDF(exam, students);

    // Normalize filename
    const safeExamName = exam.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeExamName}_results.pdf"`);
    res.send(buffer);

  } catch (error) {
    console.error('Error exporting class results PDF:', error);
    res.status(500).json({ error: `Internal Server Error: ${error.message}` });
  }
});

module.exports = router;