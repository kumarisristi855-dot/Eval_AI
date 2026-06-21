const db = require('./database/db');
const { parseQuestions, parseAnswerKey } = require('./services/questionParser');
const parseStudentAnswers = require('./services/answerParser');
const { runEvaluation, getEvaluationStatus } = require('./services/evaluationOrchestrator');
const { generateExcelBuffer, generateStudentReportPDF } = require('./services/reportGenerator');

// Define mock text inputs
const sampleQuestionPaperText = `
BIOLOGY MIDTERM ASSESSMENT
Grade: Class 10-A
Total Marks: 50
Instructions: Write clearly and answer all questions.

Q1. What is the process of photosynthesis and why is it important for green plants? [5 marks]
Q2. Which of the following organelles is known as the powerhouse of the cell? [1 mark]
A) Nucleus
B) Mitochondria
C) Ribosome
D) Chloroplast

Q3. Explain the term osmosis in detail. [5 marks]
`;

const sampleAnswerKeyText = `
BIOLOGY MIDTERM ASSESSMENT — ANSWER KEY

Q1: Photosynthesis is the process by which green plants use sunlight, carbon dioxide, and water to synthesize nutrients (glucose), releasing oxygen as a byproduct. It is critical because it forms the base of the food chain.
Q2: B
Q3: Osmosis is the passive movement of water molecules from a region of higher water potential to a region of lower water potential through a semi-permeable membrane.
`;

const student1AnswersText = `
Name: Alice Smith
Class 10-A

Q1. Photosynthesis is how plants make food using sun light, carbon dioxide and water. They make glucose and release oxygen. It is important because it feeds the plant and provides oxygen for us to breathe.
Q2. Answer: B ✓
Q3. Osmosis is the movement of water from high concentration to low concentration. It goes through a membrane.
`;

const student2AnswersText = `
Name: Bob Jones
Class 10-A

Q1. Plants use sun to make sugar.
Q2. Answer: A
Q3. Osmosis is when water moves.
`;

async function runTests() {
  console.log("=== STARTING INTEGRATION PIPELINE TESTS ===");

  try {
    // 1. Test Question Paper Parser
    console.log("\n1. Testing Question Paper parsing...");
    const questions = parseQuestions(sampleQuestionPaperText);
    console.log("Parsed Questions count:", questions.length);
    console.log(JSON.stringify(questions, null, 2));
    
    if (questions.length !== 3) {
      throw new Error(`Expected 3 questions, got ${questions.length}`);
    }
    if (questions[0].marks !== 5 || questions[1].marks !== 1) {
      throw new Error("Marks parsing failed");
    }
    if (questions[1].type !== 'mcq') {
      throw new Error("MCQ type detection failed");
    }
    console.log("✓ Question Paper parsing verified successfully.");

    // 2. Test Answer Key Parser
    console.log("\n2. Testing Answer Key mapping...");
    const answersMap = parseAnswerKey(sampleAnswerKeyText);
    console.log("Parsed Answer Key Map:", JSON.stringify(answersMap, null, 2));
    if (!answersMap.Q1 || !answersMap.Q2 || !answersMap.Q3) {
      throw new Error("Answer key map incomplete");
    }
    console.log("✓ Answer Key parsing verified successfully.");

    // 3. Test Student Answer Parser
    console.log("\n3. Testing Student Answer sheet parser...");
    const parsedAlice = parseStudentAnswers(student1AnswersText);
    console.log("Alice Parsed Answers:", JSON.stringify(parsedAlice, null, 2));
    if (parsedAlice.Q2 !== 'B') {
      throw new Error("Alice Q2 parsing failed");
    }
    console.log("✓ Student Answer parsing verified successfully.");

    // 4. Test DB Insertions & Orchestrator Setup
    console.log("\n4. Seeding exam, questions, and students to local SQLite...");
    
    // Clear old test data if present
    db.prepare('DELETE FROM evaluations').run();
    db.prepare('DELETE FROM students').run();
    db.prepare('DELETE FROM questions').run();
    db.prepare('DELETE FROM exams').run();

    const examInsert = db.prepare(`
      INSERT INTO exams (name, subject, class, total_marks, instructions)
      VALUES (?, ?, ?, ?, ?)
    `).run("Biology Midterm", "Biology", "Class 10-A", 11, "Be strict on definitions");
    const examId = examInsert.lastInsertRowid;

    // Insert questions
    const insertQStmt = db.prepare(`
      INSERT INTO questions (exam_id, question_number, question_text, question_type, marks, answer_key)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    questions.forEach(q => {
      insertQStmt.run(examId, q.number, q.text, q.type, q.marks, answersMap[q.number]);
    });

    // Insert Student 1 (Alice)
    const aliceInsert = db.prepare(`
      INSERT INTO students (exam_id, filename, student_name, total_marks_obtained, percentage, grade, status)
      VALUES (?, ?, ?, 0, 0, NULL, 'pending')
    `).run(examId, "alice_smith.pdf", "Alice Smith");
    const aliceId = aliceInsert.lastInsertRowid;

    // Insert Student 2 (Bob)
    const bobInsert = db.prepare(`
      INSERT INTO students (exam_id, filename, student_name, total_marks_obtained, percentage, grade, status)
      VALUES (?, ?, ?, 0, 0, NULL, 'pending')
    `).run(examId, "bob_jones.pdf", "Bob Jones");
    const bobId = bobInsert.lastInsertRowid;

    // Insert evaluations template
    const dbQuestions = db.prepare('SELECT id, question_number FROM questions WHERE exam_id = ?').all(examId);
    const insertEvalStmt = db.prepare(`
      INSERT INTO evaluations (student_id, question_id, student_answer, marks_awarded, feedback)
      VALUES (?, ?, ?, 0, NULL)
    `);

    // Add Alice's answers
    dbQuestions.forEach(q => {
      insertEvalStmt.run(aliceId, q.id, parsedAlice[q.question_number] || 'No answer provided');
    });

    // Add Bob's answers
    const parsedBob = parseStudentAnswers(student2AnswersText);
    dbQuestions.forEach(q => {
      insertEvalStmt.run(bobId, q.id, parsedBob[q.question_number] || 'No answer provided');
    });

    console.log("✓ Seeding database complete.");

    // 5. Test Evaluation Orchestrator (Mock Groq trigger)
    console.log("\n5. Testing Evaluation Orchestrator run loop...");
    await runEvaluation(examId);
    
    const status = getEvaluationStatus(examId);
    console.log("Evaluation run status:", JSON.stringify(status, null, 2));
    
    if (status.status !== 'done') {
      throw new Error(`Expected orchestrator status to be 'done', got ${status.status}`);
    }

    // Verify student total updates in SQLite
    const updatedStudents = db.prepare('SELECT * FROM students WHERE exam_id = ?').all(examId);
    console.log("Updated Students results in DB:", JSON.stringify(updatedStudents, null, 2));

    const aliceRecord = updatedStudents.find(s => s.id === aliceId);
    const bobRecord = updatedStudents.find(s => s.id === bobId);

    if (aliceRecord.status !== 'evaluated' || bobRecord.status !== 'evaluated') {
      throw new Error("Students not updated to 'evaluated' status");
    }
    if (aliceRecord.total_marks_obtained <= bobRecord.total_marks_obtained) {
      throw new Error("Alice score should be greater than Bob's score based on inputs");
    }
    console.log("✓ Evaluation orchestrator run verified successfully.");

    // 6. Test Excel / PDF Report Exports
    console.log("\n6. Testing report card generations...");
    
    // Excel
    const excelBuffer = generateExcelBuffer(updatedStudents);
    console.log(`Excel sheet buffer created. Size: ${excelBuffer.length} bytes`);
    if (excelBuffer.length === 0) throw new Error("Excel generator returned empty buffer");

    // PDF
    const aliceEvals = db.prepare(`
      SELECT e.*, q.question_number, q.question_text, q.question_type, q.marks
      FROM evaluations e
      JOIN questions q ON e.question_id = q.id
      WHERE e.student_id = ?
    `).all(aliceId);
    const examRecord = db.prepare('SELECT * FROM exams WHERE id = ?').get(examId);

    const pdfBuffer = generateStudentReportPDF(aliceRecord, examRecord, aliceEvals);
    console.log(`PDF report buffer created. Size: ${pdfBuffer.length} bytes`);
    if (pdfBuffer.length === 0) throw new Error("PDF generator returned empty buffer");

    console.log("✓ Report generation verified successfully.");
    console.log("\n=== ALL PIPELINE TESTS PASSED SUCCESSFULLY ===");

  } catch (error) {
    console.error("\n❌ PIPELINE INTEGRATION TEST FAILED:", error);
    process.exit(1);
  }
}

runTests();
