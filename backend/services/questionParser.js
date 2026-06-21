/**
 * Parses a question paper text to extract individual questions.
 * @param {string} text - Raw text from question paper PDF
 * @returns {Array<Object>} List of structured question objects
 */
function parseQuestions(text) {
  const questions = [];
  // Regex to match question indicators like Q1, Q1., 1., 1) at the start of a line
  const regex = /(?:^|\r?\n)\s*(?:Q(?:uestion)?\s*(\d+)|(\d+))\s*[:.)-]/gi;
  let match;
  const matches = [];

  while ((match = regex.exec(text)) !== null) {
    matches.push({
      index: match.index,
      length: match[0].length,
      num: match[1] || match[2]
    });
  }

  // If no questions match the pattern, try a fallback line-by-line check
  if (matches.length === 0) {
    return parseQuestionsFallback(text);
  }

  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index + matches[i].length;
    const end = (i + 1 < matches.length) ? matches[i + 1].index : text.length;
    const qText = text.substring(start, end).trim();
    const qNum = `Q${matches[i].num}`;

    // Extract marks: [2 marks], (5 marks), (5), [5]
    let marks = 1; // default
    const marksRegex = /(?:\[\s*(\d+)\s*(?:marks?|pts?|points?)?\s*\]|\(\s*(\d+)\s*(?:marks?|pts?|points?)?\s*\))/i;
    const marksMatch = qText.match(marksRegex);
    if (marksMatch) {
      marks = parseInt(marksMatch[1] || marksMatch[2], 10);
    }

    // Auto-detect question type: mcq if options are present
    let type = 'short'; // default
    const mcqRegex = /\b([A-D]|[a-d])\s*[.)-]/;
    if (mcqRegex.test(qText)) {
      type = 'mcq';
    }

    questions.push({
      number: qNum,
      text: qText,
      marks: marks,
      type: type
    });
  }

  return questions;
}

/**
 * Fallback questions parser for papers that don't match the strict regex.
 */
function parseQuestionsFallback(text) {
  const questions = [];
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  let currentQ = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Check if line starts with a number
    const numMatch = line.match(/^(\d+)[\s.)-]/);
    if (numMatch) {
      if (currentQ) {
        questions.push(currentQ);
      }
      currentQ = {
        number: `Q${numMatch[1]}`,
        text: line.substring(numMatch[0].length).trim(),
        marks: 1,
        type: 'short'
      };
    } else if (currentQ) {
      currentQ.text += ' \n' + line;
    }
  }
  if (currentQ) {
    questions.push(currentQ);
  }
  
  // Try to parse marks for fallback
  questions.forEach(q => {
    const marksRegex = /(?:\[\s*(\d+)\s*(?:marks?|pts?)?\s*\]|\(\s*(\d+)\s*(?:marks?|pts?)?\s*\))/i;
    const marksMatch = q.text.match(marksRegex);
    if (marksMatch) {
      q.marks = parseInt(marksMatch[1] || marksMatch[2], 10);
    }
    const mcqRegex = /\b([A-D]|[a-d])\s*[.)-]/;
    if (mcqRegex.test(q.text)) {
      q.type = 'mcq';
    }
  });

  return questions;
}

/**
 * Parses the answer key text to map answers to question numbers.
 * @param {string} text - Raw text from answer key PDF
 * @returns {Object} Map of question number (e.g. Q1) to answer text
 */
function parseAnswerKey(text) {
  const answers = {};
  const regex = /(?:^|\r?\n)\s*(?:Q(?:uestion)?\s*(\d+)|(\d+))\s*[:.)-]/gi;
  let match;
  const matches = [];

  while ((match = regex.exec(text)) !== null) {
    matches.push({
      index: match.index,
      length: match[0].length,
      num: match[1] || match[2]
    });
  }

  // Fallback for simple list
  if (matches.length === 0) {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    lines.forEach((line) => {
      const matchNum = line.match(/^(?:Q\s*(\d+)|(\d+))[\s.:)-]/i);
      if (matchNum) {
        const num = matchNum[1] || matchNum[2];
        let val = line.substring(matchNum[0].length).trim();
        // Clean single letter answer keys (e.g. "B (Mitochondria)" -> "B")
        if (/^[A-D]\b/i.test(val)) {
          val = val.charAt(0).toUpperCase();
        }
        answers[`Q${num}`] = val;
      }
    });
    return answers;
  }

  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index + matches[i].length;
    const end = (i + 1 < matches.length) ? matches[i + 1].index : text.length;
    let ansText = text.substring(start, end).trim();
    // Clean single letter answer keys (e.g. "D\n\n-- 1 of 1 --" -> "D")
    if (/^[A-D]\b/i.test(ansText)) {
      ansText = ansText.charAt(0).toUpperCase();
    }
    const qNum = `Q${matches[i].num}`;
    answers[qNum] = ansText;
  }

  return answers;
}

/**
 * Normalizes question types (short vs long) based on answer length in the key.
 * @param {string} currentType - The current type (mcq/short/long)
 * @param {string} answerText - The answer text from the key
 * @returns {string} The final type
 */
function refineTypeWithAnswer(currentType, answerText) {
  if (currentType === 'mcq') return 'mcq';
  if (!answerText) return 'short';
  
  const lines = answerText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  // If the answer is short (under 2 lines and short content), keep it short, else long
  if (lines.length <= 2 && answerText.length < 200) {
    return 'short';
  }
  return 'long';
}

module.exports = {
  parseQuestions,
  parseAnswerKey,
  refineTypeWithAnswer
};
