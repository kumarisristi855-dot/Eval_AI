const express = require('express');
const router = express.Router();

const db = require('../database/db');
const { runEvaluation, getEvaluationStatus } = require('../services/evaluationOrchestrator');

/**
 * POST /api/exam/:id/evaluate
 * Triggers the evaluation orchestrator asynchronously and returns immediately.
 */
router.post('/exam/:id/evaluate', async (req, res) => {
  try {
    const examId = req.params.id;
    
    // Check if exam exists (PostgreSQL syntax)
    const examResult = await db.query('SELECT id FROM exams WHERE id = $1', [examId]);
    if (examResult.rows.length === 0) {
      return res.status(404).json({ error: `Exam with ID ${examId} not found` });
    }

    // Trigger grading asynchronously
    runEvaluation(examId);

    res.json({ message: 'Evaluation started' });
  } catch (error) {
    console.error('Error starting evaluation:', error);
    res.status(500).json({ error: `Internal Server Error: ${error.message}` });
  }
});

/**
 * GET /api/exam/:id/status
 * Returns current evaluation progress for frontend polling.
 */
router.get('/exam/:id/status', (req, res) => {
  try {
    const examId = req.params.id;
    const progress = getEvaluationStatus(examId);
    res.json(progress);
  } catch (error) {
    console.error('Error fetching status:', error);
    res.status(500).json({ error: `Internal Server Error: ${error.message}` });
  }
});

/**
 * GET /api/exam/:id/results
 * Returns all students of an exam with total marks, percentage, grade, sorted descending.
 */
router.get('/exam/:id/results', async (req, res) => {
  try {
    const examId = req.params.id;
    
    // Check if exam exists (PostgreSQL syntax)
    const examResult = await db.query('SELECT * FROM exams WHERE id = $1', [examId]);
    if (examResult.rows.length === 0) {
      return res.status(404).json({ error: `Exam with ID ${examId} not found` });
    }

    const exam = examResult.rows[0];

    // Retrieve students sorted by total marks descending
    const studentsResult = await db.query(`
      SELECT * FROM students 
      WHERE exam_id = $1 
      ORDER BY total_marks_obtained DESC
    `, [examId]);

    res.json({
      exam,
      students: studentsResult.rows
    });
  } catch (error) {
    console.error('Error fetching results:', error);
    res.status(500).json({ error: `Internal Server Error: ${error.message}` });
  }
});

/**
 * GET /api/exam/:id/student/:studentId
 * Returns detailed evaluation breakdown for a single student.
 */
router.get('/exam/:id/student/:studentId', async (req, res) => {
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
      return res.status(404).json({ error: 'Student not found for this exam' });
    }
    const student = studentResult.rows[0];

    // Fetch evaluations joined with questions
    const evaluationsResult = await db.query(`
      SELECT e.id as evaluation_id, e.student_answer, e.marks_awarded, e.feedback, e.is_overridden,
             q.id as question_id, q.question_number, q.question_text, q.question_type, q.marks as max_marks
      FROM evaluations e
      JOIN questions q ON e.question_id = q.id
      WHERE e.student_id = $1
      ORDER BY q.id ASC
    `, [studentId]);

    const evaluations = evaluationsResult.rows;

    // Compute strength areas (scored >= 80%) and weak areas (scored < 50%)
    const strengthAreas = [];
    const weakAreas = [];

    evaluations.forEach((item) => {
      const maxVal = item.max_marks || 1;
      const ratio = (item.marks_awarded || 0) / maxVal;
      
      if (ratio >= 0.8) {
        strengthAreas.push(item.question_number);
      } else if (ratio < 0.5) {
        weakAreas.push(item.question_number);
      }
    });

    res.json({
      exam,
      student,
      evaluations,
      strengthAreas,
      weakAreas
    });

  } catch (error) {
    console.error('Error fetching student report:', error);
    res.status(500).json({ error: `Internal Server Error: ${error.message}` });
  }
});

/**
 * PATCH /api/exam/:examId/student/:studentId/question/:questionId/override
 * Overrides the marks awarded for a specific question evaluation and recalculates totals.
 */
router.patch('/exam/:examId/student/:studentId/question/:questionId/override', async (req, res) => {
  const client = await db.pool.connect();
  
  try {
    const { examId, studentId, questionId } = req.params;
    const marksAwarded = parseFloat(req.body.marks_awarded);

    if (isNaN(marksAwarded)) {
      return res.status(400).json({ error: 'marks_awarded must be a valid number' });
    }

    // 1. Fetch question max marks and validate
    const questionResult = await client.query(
      'SELECT marks FROM questions WHERE id = $1 AND exam_id = $2',
      [questionId, examId]
    );
    if (questionResult.rows.length === 0) {
      client.release();
      return res.status(404).json({ error: 'Question not found' });
    }
    const question = questionResult.rows[0];

    if (marksAwarded < 0 || marksAwarded > question.marks) {
      client.release();
      return res.status(400).json({ error: `Marks must be between 0 and ${question.marks}` });
    }

    // 2. Fetch exam total marks
    const examResult = await client.query(
      'SELECT total_marks FROM exams WHERE id = $1',
      [examId]
    );
    if (examResult.rows.length === 0) {
      client.release();
      return res.status(404).json({ error: 'Exam not found' });
    }
    const exam = examResult.rows[0];

    // 3. Perform update and recalculation inside a transaction
    try {
      await client.query('BEGIN');

      // Update evaluation entry
      await client.query(`
        UPDATE evaluations
        SET marks_awarded = $1, is_overridden = 1
        WHERE student_id = $2 AND question_id = $3
      `, [marksAwarded, studentId, questionId]);

      // Recalculate student total score
      const scoreResult = await client.query(
        'SELECT SUM(marks_awarded) as total_score FROM evaluations WHERE student_id = $1',
        [studentId]
      );
      const newTotal = scoreResult.rows[0].total_score || 0;

      // Recalculate percentage and grade
      const totalPossibleMarks = exam.total_marks || 1;
      const percentage = parseFloat(((newTotal / totalPossibleMarks) * 100).toFixed(2));
      const cappedPercentage = Math.min(percentage, 100);
      const cappedScore = Math.min(newTotal, totalPossibleMarks);

      let newGrade = 'F';
      if (cappedPercentage >= 90) newGrade = 'A+';
      else if (cappedPercentage >= 80) newGrade = 'A';
      else if (cappedPercentage >= 70) newGrade = 'B';
      else if (cappedPercentage >= 60) newGrade = 'C';
      else if (cappedPercentage >= 50) newGrade = 'D';

      // Update student table
      await client.query(`
        UPDATE students
        SET total_marks_obtained = $1, percentage = $2, grade = $3
        WHERE id = $4
      `, [cappedScore, cappedPercentage, newGrade, studentId]);

      await client.query('COMMIT');

      res.json({
        success: true,
        newTotal: cappedScore,
        newPercentage: cappedPercentage,
        newGrade
      });

    } catch (txError) {
      await client.query('ROLLBACK');
      throw txError;
    }

  } catch (error) {
    console.error('Error overriding marks:', error);
    res.status(500).json({ error: `Internal Server Error: ${error.message}` });
  } finally {
    client.release();
  }
});

module.exports = router;