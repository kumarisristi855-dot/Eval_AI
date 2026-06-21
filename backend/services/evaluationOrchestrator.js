const db = require('../database/db');
const { evaluateQuestionBatch } = require('./groqEvaluator');

// In-memory status tracker for ongoing evaluations
const progressMap = {};

/**
 * Gets the current grading progress for an exam.
 * @param {string|number} examId 
 * @returns {Object} Progress metrics
 */
function getEvaluationStatus(examId) {
  return progressMap[examId] || { total: 0, evaluated: 0, percentage: 0, status: 'idle' };
}

/**
 * Asynchronously processes grading for all pending students of an exam.
 * @param {string|number} examId 
 */
async function runEvaluation(examId) {
  try {
    // 1. Retrieve the exam metadata
    const examResult = await db.query('SELECT * FROM exams WHERE id = $1', [examId]);
    const exam = examResult.rows[0];
    if (!exam) {
      throw new Error(`Exam with ID ${examId} not found`);
    }

    // 2. Fetch all questions for this exam
    const questionsResult = await db.query('SELECT * FROM questions WHERE exam_id = $1', [examId]);
    const questions = questionsResult.rows;
    if (questions.length === 0) {
      throw new Error(`No questions defined for Exam ID ${examId}`);
    }

    // 3. Fetch all students with pending status for this exam
    const studentsResult = await db.query("SELECT * FROM students WHERE exam_id = $1 AND status = 'pending'", [examId]);
    const students = studentsResult.rows;
    if (students.length === 0) {
      progressMap[examId] = { total: 0, evaluated: 0, percentage: 100, status: 'done' };
      return;
    }

    const totalStudents = students.length;
    progressMap[examId] = {
      total: totalStudents,
      evaluated: 0,
      percentage: 0,
      status: 'processing'
    };

    console.log(`Starting evaluation orchestrator for Exam ${examId} (${exam.name}). ${totalStudents} students pending.`);

    // 4. Grade question by question (to enable consistent grading across batch of students)
    const studentIds = students.map(s => s.id);
    
    for (const question of questions) {
      console.log(`Grading Question ${question.question_number} (Type: ${question.question_type})...`);

      // Retrieve student answers for this specific question
      const placeholders = studentIds.map((_, idx) => `$${idx + 2}`).join(', ');
      const rawAnswersResult = await db.query(`
        SELECT e.id as evaluation_id, e.student_id, e.student_answer, s.student_name
        FROM evaluations e
        JOIN students s ON e.student_id = s.id
        WHERE e.question_id = $1 AND e.student_id IN (${placeholders})
      `, [question.id, ...studentIds]);
      
      const rawAnswers = rawAnswersResult.rows;

      // Programmatic MCQ Grading & Database Update
      if (question.question_type === 'mcq') {
        const mcqUpdates = rawAnswers.map(async (ra) => {
          const studentAnswer = ra.student_answer || '';
          const answerKey = question.answer_key || '';
          
          // After comparing student answer vs answer key for MCQ
          const isCorrect = studentAnswer.trim().toUpperCase() === answerKey.trim().toUpperCase();
          const marksAwarded = isCorrect ? question.marks : 0;

          console.log(`${question.question_number}: Student=${studentAnswer} Key=${question.answer_key} Match=${isCorrect}`);

          // Update evaluation results
          await db.query(`
            UPDATE evaluations 
            SET marks_awarded = $1, feedback = $2
            WHERE student_id = $3 AND question_id = $4
          `, [marksAwarded, isCorrect ? 'Correct' : 'Incorrect', ra.student_id, question.id]);
        });

        await Promise.all(mcqUpdates);
        continue; // MCQ graded programmatically, proceed to next question
      }

      // Map to Groq Evaluator format
      const studentAnswersForEvaluator = rawAnswers.map((ra, idx) => ({
        student_index: idx,
        student_name: ra.student_name,
        answer: ra.student_answer || 'No answer provided',
        evaluation_id: ra.evaluation_id
      }));

      // Split into batches of 25 students
      const batchSize = 25;
      for (let i = 0; i < studentAnswersForEvaluator.length; i += batchSize) {
        const batch = studentAnswersForEvaluator.slice(i, i + batchSize);

        const evaluationResults = await evaluateQuestionBatch({
          questionText: question.question_text,
          questionType: question.question_type,
          marksAllotted: question.marks,
          answerKey: question.answer_key || '',
          studentAnswers: batch,
          examContext: {
            name: exam.name,
            subject: exam.subject,
            class: exam.class,
            instructions: exam.instructions
          }
        });

        // Store graded marks and feedback inside PostgreSQL
        const savePromises = evaluationResults.map(async (res) => {
          const matchedBatchItem = batch.find(b => b.student_index === res.student_index);
          if (matchedBatchItem) {
            const cappedMarks = Math.min(res.marks_awarded || 0, question.marks);
            await db.query(`
              UPDATE evaluations 
              SET marks_awarded = $1, feedback = $2 
              WHERE id = $3
            `, [
              cappedMarks,
              res.feedback || '',
              matchedBatchItem.evaluation_id
            ]);
          }
        });

        await Promise.all(savePromises);
      }
    }

    // 5. Calculate student totals, percentages, letter grades and mark as evaluated
    const totalPossibleMarks = questions.reduce((sum, q) => sum + q.marks, 0) || 1;

    const studentGradesPromises = students.map(async (student) => {
      const scoreResult = await db.query(`
        SELECT SUM(marks_awarded) as total_score
        FROM evaluations
        WHERE student_id = $1
      `, [student.id]);

      const rawScore = parseFloat(scoreResult.rows[0].total_score || 0);
      const percentage = parseFloat(((rawScore / totalPossibleMarks) * 100).toFixed(2));
      const cappedPercentage = Math.min(percentage, 100);
      const cappedScore = Math.min(rawScore, totalPossibleMarks);

      // Grade scale:
      // 90-100% -> A+
      // 80-89% -> A
      // 70-79% -> B
      // 60-69% -> C
      // 50-59% -> D
      // Below 50% -> F
      let grade = 'F';
      if (cappedPercentage >= 90) grade = 'A+';
      else if (cappedPercentage >= 80) grade = 'A';
      else if (cappedPercentage >= 70) grade = 'B';
      else if (cappedPercentage >= 60) grade = 'C';
      else if (cappedPercentage >= 50) grade = 'D';

      await db.query(`
        UPDATE students
        SET total_marks_obtained = $1, percentage = $2, grade = $3, status = 'evaluated'
        WHERE id = $4
      `, [
        cappedScore,
        cappedPercentage,
        grade,
        student.id
      ]);

      // Update progress tracking
      progressMap[examId].evaluated += 1;
      progressMap[examId].percentage = Math.round(
        (progressMap[examId].evaluated / totalStudents) * 100
      );
    });

    await Promise.all(studentGradesPromises);

    progressMap[examId].status = 'done';
    progressMap[examId].percentage = 100;
    console.log(`Evaluation complete for Exam ${examId}.`);

  } catch (error) {
    console.error(`Error in runEvaluation for Exam ID ${examId}:`, error);
    progressMap[examId] = {
      ...progressMap[examId],
      status: 'failed',
      error: error.message
    };
  }
}

module.exports = {
  runEvaluation,
  getEvaluationStatus
};
