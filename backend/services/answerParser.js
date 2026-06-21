/**
 * Cleans the student's answer text, specifically extracting MCQ options
 * and removing suffixes like ticks, crosses, or spaces.
 * @param {string} ansText - The raw parsed answer text
 * @returns {string} Cleaned answer text
 */
function cleanStudentAnswer(ansText) {
  const match = ansText.match(/Answer:\s*([A-D])/i);
  if (match) {
    return match[1].toUpperCase();
  } else if (ansText.includes('Answer:')) {
    return 'No answer provided';
  }
  return ansText.trim();
}

/**
 * Parses student answers from raw text extracted from student answer PDF.
 * @param {string} text - Raw text from student answer sheet
 * @returns {Object} Map of question number (e.g. Q1) to student's answer text
 */
function parseStudentAnswers(text) {
  const answers = {};
  
  // Use regex to locate student answers by matching question number markers Q1, 1., Q2, etc.
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

  // Fallback for simple line-by-line format if no distinct blocks match
  if (matches.length === 0) {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    let currentQ = null;
    let currentText = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const matchNum = line.match(/^(?:Q\s*(\d+)|(\d+))[\s.:)-]/i);
      if (matchNum) {
        if (currentQ) {
          answers[currentQ] = cleanStudentAnswer(currentText);
        }
        const num = matchNum[1] || matchNum[2];
        currentQ = `Q${num}`;
        currentText = line.substring(matchNum[0].length).trim();
      } else if (currentQ) {
        currentText += ' \n' + line;
      }
    }
    if (currentQ) {
      answers[currentQ] = cleanStudentAnswer(currentText);
    }
    return answers;
  }

  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index + matches[i].length;
    const end = (i + 1 < matches.length) ? matches[i + 1].index : text.length;
    const ansText = text.substring(start, end).trim();
    const qNum = `Q${matches[i].num}`;
    answers[qNum] = cleanStudentAnswer(ansText);
  }

  return answers;
}

module.exports = parseStudentAnswers;
