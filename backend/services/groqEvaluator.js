const { Groq } = require('groq-sdk');

// Lazy initialization of Groq client
let groqClient = null;
function getGroqClient() {
  if (!groqClient) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      console.warn("WARNING: GROQ_API_KEY is not set in environmental variables. Running in MOCK evaluation mode.");
      return null;
    }
    groqClient = new Groq({ apiKey });
  }
  return groqClient;
}

/**
 * Utility to clean and parse markdown-wrapped JSON from LLM responses
 * @param {string} rawText 
 * @returns {Array} Parsed JSON array
 */
function cleanAndParseJson(rawText) {
  let cleaned = rawText.trim();
  // Strip markdown code blocks if present
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
  }
  return JSON.parse(cleaned);
}

/**
 * Helper to call Groq with retry logic for 429 rate limit errors
 */
async function callGroqWithRetry(params, maxRetries = 3, delayMs = 10000) {
  const client = getGroqClient();
  if (!client) {
    // If no client, return mock response (handled outside)
    return null;
  }

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await client.chat.completions.create(params);
      return response.choices[0].message.content;
    } catch (error) {
      const isRateLimit = 
        error.status === 429 || 
        (error.message && error.message.includes('429')) || 
        (error.message && error.message.toLowerCase().includes('rate limit'));
      
      if (isRateLimit && attempt < maxRetries) {
        console.warn(`Groq Rate Limit hit. Retrying in ${delayMs / 1000}s (Attempt ${attempt}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      } else {
        throw error;
      }
    }
  }
}

/**
 * Mock evaluation when GROQ_API_KEY is not set
 */
function generateMockEvaluation(studentAnswers, marksAllotted, isMcq, answerKey) {
  console.log(`[MOCK MODE] Simulating evaluation for ${studentAnswers.length} students...`);
  return studentAnswers.map((student) => {
    const studentAnswerText = student.answer.trim();
    if (studentAnswerText === "No answer provided") {
      return {
        student_index: student.student_index,
        marks_awarded: 0,
        feedback: 'No answer provided by the student.'
      };
    }

    if (isMcq) {
      // Mock MCQ: compare student answer and answer key after trimming and upper-casing
      const isCorrect = studentAnswerText.trim().toUpperCase() === answerKey.trim().toUpperCase();
      return {
        student_index: student.student_index,
        marks_awarded: isCorrect ? marksAllotted : 0,
        feedback: ''
      };
    } else {
      // Mock theory: check keyword matches from answer key for a simple matching score
      const cleanKeyWords = answerKey.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      const studentLower = studentAnswerText.toLowerCase();
      let matches = 0;
      cleanKeyWords.forEach(word => {
        const cleanWord = word.replace(/[^a-z]/gi, '');
        if (cleanWord.length > 2 && studentLower.includes(cleanWord)) {
          matches++;
        }
      });

      let ratio = 0.35; // base score for submitting
      if (cleanKeyWords.length > 0) {
        ratio += (matches / cleanKeyWords.length) * 0.65;
      }
      ratio = Math.min(1.0, ratio);

      const marks = Math.round(ratio * marksAllotted * 2) / 2; // round to nearest 0.5

      let feedback = 'Good response, covered the core elements.';
      if (ratio < 0.5) {
        feedback = 'Incomplete response, missing crucial definitions.';
      } else if (ratio >= 0.85) {
        feedback = 'Excellent and comprehensive answer.';
      }

      return {
        student_index: student.student_index,
        marks_awarded: marks,
        feedback: feedback
      };
    }
  });
}

/**
 * Evaluates a batch of student answers for a single question using Groq or fallback Mock.
 * @param {Object} params
 * @param {string} params.questionText
 * @param {string} params.questionType - 'mcq' | 'short' | 'long'
 * @param {number} params.marksAllotted
 * @param {string} params.answerKey
 * @param {Array<Object>} params.studentAnswers - Array of { student_index, student_name, answer }
 * @param {Object} params.examContext - { name, subject, class, instructions }
 * @returns {Promise<Array<Object>>} List of evaluation results
 */
async function evaluateQuestionBatch({
  questionText,
  questionType,
  marksAllotted,
  answerKey,
  studentAnswers,
  examContext
}) {
  const isMcq = questionType === 'mcq';
  const client = getGroqClient();

  if (!client) {
    // Return mock evaluations if no API key
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate delay
    return generateMockEvaluation(studentAnswers, marksAllotted, isMcq, answerKey);
  }

  // Choose appropriate model
  const model = 'llama-3.3-70b-versatile';

  let systemPrompt = '';
  let userPrompt = '';

  if (isMcq) {
    systemPrompt = `You are an AI answer sheet grader. Your task is to grade multiple choice questions strictly and return results in a clean JSON format.
You will compare each student's response with the correct reference answer key.
Rules:
1. Compare strictly. If correct, award full marks. If incorrect or missing, award 0 marks.
2. Do NOT provide feedback. Set feedback as an empty string "".
3. Respond in strict JSON containing only an array of objects matching the output format. No markdown, no comments, no extra text.`;

    userPrompt = `Question Context:
Question text: "${questionText}"
Correct Answer Key: "${answerKey}"
Max Marks: ${marksAllotted}

Students to grade:
${JSON.stringify(studentAnswers, null, 2)}

Expected Output Format:
[
  { "student_index": 0, "marks_awarded": ${marksAllotted}, "feedback": "" }
]`;
  } else {
    systemPrompt = `You are an expert school teacher grading student answers for a test.
Subject: ${examContext.subject || 'General'}
Class/Grade level: ${examContext.class || 'N/A'}
Exam Context/Instructions: ${examContext.instructions || 'None'}

Your task is to grade the student answers for a theory question.
Rules:
1. Evaluate based on conceptual understanding, not exact matching of words.
2. Award partial marks from 0 up to ${marksAllotted} based on the accuracy and completeness of the student's answer.
3. Consider the student's grade/class level when judging the quality of the answer.
4. For each student, write exactly one line of concise, constructive feedback (e.g. "Good definition, missing the formula").
5. If the student answer is "No answer provided", award 0 marks and set feedback to "No answer provided."
6. Ensure your grading standards are consistent across all students in the batch.
7. Respond in strict JSON containing only an array of objects matching the output format. No markdown code blocks (like \`\`\`json), no extra text.`;

    userPrompt = `Question details:
Question: "${questionText}"
Reference Answer Key: "${answerKey}"
Max Marks: ${marksAllotted}

Students answers to evaluate:
${JSON.stringify(studentAnswers, null, 2)}

Expected Output Format:
[
  { "student_index": 0, "marks_awarded": 3.5, "feedback": "Concise feedback here" }
]`;
  }

  try {
    const responseText = await callGroqWithRetry({
      model: model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.1,
      response_format: { type: "json_object" }
    });

    if (!responseText) {
      // Fallback if retry returns null (shouldn't happen with client initialized)
      return generateMockEvaluation(studentAnswers, marksAllotted, isMcq, answerKey);
    }

    const parsed = cleanAndParseJson(responseText);

    // Grab whichever key exists
    const results = Array.isArray(parsed) ? parsed : (
      parsed.evaluation_results 
      || parsed.students_evaluations 
      || parsed.student_evaluations
      || parsed.evaluations
      || parsed.evaluation
      || parsed.results
      || []
    );

    if (!results || results.length === 0) {
      console.error('WARNING: No results parsed from Groq response. Raw:', responseText);
    }

    return results;
  } catch (error) {
    console.error('GROQ EVALUATION ERROR:', error.message); // add this
    console.error('GROQ EVALUATION ERROR FULL:', error); // add this
    console.error("Error evaluating question batch via Groq:", error);
    // If Groq fails completely, fallback to mock so the application flow is not broken
    console.warn("Falling back to MOCK evaluation due to error.");
    return generateMockEvaluation(studentAnswers, marksAllotted, isMcq, answerKey);
  }
}

module.exports = {
  evaluateQuestionBatch
};
