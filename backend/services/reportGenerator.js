const XLSX = require('xlsx');
const { jsPDF } = require('jspdf');

/**
 * Generates an Excel spreadsheet buffer of class results.
 * @param {Array<Object>} students - List of students with names, marks, grades, etc.
 * @returns {Buffer} Excel workbook as a node buffer
 */
function generateExcelBuffer(students) {
  const workbook = XLSX.utils.book_new();
  
  // Format data for sheet
  const sheetData = students.map((s) => ({
    'Student Name': s.student_name,
    'Marks Obtained': s.total_marks_obtained,
    'Percentage (%)': s.percentage,
    'Grade': s.grade,
    'Status': s.status
  }));

  const worksheet = XLSX.utils.json_to_sheet(sheetData);
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Class Results');

  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  return buffer;
}

/**
 * Generates a PDF report buffer for a single student.
 * @param {Object} student - Student database object
 * @param {Object} exam - Exam database object
 * @param {Array<Object>} evaluations - Graded questions for this student
 * @returns {Buffer} PDF document as a node buffer
 */
function generateStudentReportPDF(student, exam, evaluations) {
  const doc = new jsPDF();

  // Primary Colors (HSL Sleek Dark blue/indigo styling)
  const primaryColor = '#1e293b';
  
  // Top Title Banner
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(30, 41, 59); // slate-800
  doc.text('EvalAI — Student Performance Report', 14, 20);

  // Divider Line
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.setLineWidth(0.75);
  doc.line(14, 24, 196, 24);

  // Metadata Grid
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105); // slate-600

  // Left column
  doc.text(`Student Name:  ${student.student_name}`, 14, 32);
  doc.text(`Exam Name:     ${exam.name}`, 14, 38);
  doc.text(`Subject:       ${exam.subject}`, 14, 44);
  doc.text(`Class/Grade:   ${exam.class}`, 14, 50);

  // Right column (Score box)
  doc.setFont('helvetica', 'bold');
  doc.text(`Score Obtained:  ${student.total_marks_obtained} / ${exam.total_marks}`, 120, 32);
  doc.text(`Percentage:      ${student.percentage}%`, 120, 38);
  doc.text(`Letter Grade:    ${student.grade}`, 120, 44);

  // Second Divider
  doc.line(14, 54, 196, 54);

  // Question-wise breakdown header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(30, 41, 59);
  doc.text('Question-by-Question Graded Breakdown', 14, 62);

  // Table Headers
  let y = 70;
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text('Q. No', 14, y);
  doc.text('Type', 28, y);
  doc.text('Score', 48, y);
  doc.text('Max', 62, y);
  doc.text('Teacher Feedback', 76, y);

  doc.setDrawColor(203, 213, 225); // slate-300
  doc.setLineWidth(0.5);
  doc.line(14, y + 2, 196, y + 2);
  y += 8;

  // Table Body
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85); // slate-700

  const strengthAreas = [];
  const weakAreas = [];

  evaluations.forEach((item) => {
    // Add page if near bottom
    if (y > 270) {
      doc.addPage();
      y = 20;
      
      // Reprint table header
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 116, 139);
      doc.text('Q. No', 14, y);
      doc.text('Type', 28, y);
      doc.text('Score', 48, y);
      doc.text('Max', 62, y);
      doc.text('Teacher Feedback', 76, y);
      doc.line(14, y + 2, 196, y + 2);
      y += 8;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(51, 65, 85);
    }

    const maxVal = item.marks || 1;
    const ratio = (item.marks_awarded || 0) / maxVal;

    if (ratio >= 0.8) {
      strengthAreas.push(item.question_number);
    } else if (ratio < 0.5) {
      weakAreas.push(item.question_number);
    }

    doc.text(String(item.question_number), 14, y);
    doc.text(String(item.question_type).toUpperCase(), 28, y);
    doc.text(String(item.marks_awarded), 48, y);
    doc.text(String(item.marks), 62, y);

    const feedbackText = item.feedback || (ratio === 1 ? 'Perfect answer!' : 'No feedback provided.');
    const splitFeedback = doc.splitTextToSize(feedbackText, 120);
    doc.text(splitFeedback, 76, y);

    y += (splitFeedback.length * 5) + 3;
  });

  // Summary Metrics Analysis box
  if (y > 230) {
    doc.addPage();
    y = 20;
  }

  y += 5;
  doc.setDrawColor(226, 232, 240);
  doc.line(14, y, 196, y);
  y += 8;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(30, 41, 59);
  doc.text('Learning Profile Analysis', 14, y);
  y += 6;

  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);

  const strengthsStr = strengthAreas.length > 0
    ? `Strengths: Demonstrates proficiency (scored >= 80%) in questions: ${strengthAreas.join(', ')}`
    : 'Strengths: No questions met the proficiency threshold (>= 80%).';
  doc.text(strengthsStr, 14, y);
  y += 6;

  const weaknessesStr = weakAreas.length > 0
    ? `Areas for Growth: Scored below 50% in questions: ${weakAreas.join(', ')}. Recommend review.`
    : 'Areas for Growth: Solid fundamental scoring. No questions scored below 50%.';
  doc.text(weaknessesStr, 14, y);

  // Return the PDF output as a node buffer
  const arrayBuffer = doc.output('arraybuffer');
  return Buffer.from(arrayBuffer);
}

function generateClassResultsPDF(exam, students) {
  const doc = new jsPDF();

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(30, 41, 59); // slate-800
  doc.text(`${exam.name} — Class Results`, 14, 20);

  // Divider Line
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.setLineWidth(0.75);
  doc.line(14, 24, 196, 24);

  // Subtitle: Subject, Class, Date
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105); // slate-600
  const createdDate = new Date(exam.created_at).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
  doc.text(`Subject: ${exam.subject}   |   Class: ${exam.class}   |   Date: ${createdDate}`, 14, 32);

  // Calculations for summary row
  const totalStudents = students.length;
  const averageObtained = totalStudents > 0
    ? (students.reduce((sum, s) => sum + s.total_marks_obtained, 0) / totalStudents).toFixed(1)
    : '0.0';
  const averagePercentage = totalStudents > 0
    ? (students.reduce((sum, s) => sum + s.percentage, 0) / totalStudents).toFixed(1)
    : '0.0';
  const highestScore = totalStudents > 0
    ? Math.max(...students.map(s => s.total_marks_obtained))
    : 0;
  const lowestScore = totalStudents > 0
    ? Math.min(...students.map(s => s.total_marks_obtained))
    : 0;

  // Summary Row Grid
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(`Total Students: ${totalStudents}`, 14, 42);
  doc.text(`Class Average: ${averageObtained} / ${exam.total_marks} (${averagePercentage}%)`, 55, 42);
  doc.text(`Highest: ${highestScore}`, 130, 42);
  doc.text(`Lowest: ${lowestScore}`, 165, 42);

  // Second Divider
  doc.setDrawColor(226, 232, 240);
  doc.line(14, 46, 196, 46);

  // Table Headers
  let y = 54;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text('Student Name', 14, y);
  doc.text('Marks Obtained', 80, y, { align: 'right' });
  doc.text('Total Marks', 110, y, { align: 'right' });
  doc.text('Percentage', 145, y, { align: 'right' });
  doc.text('Grade', 180, y, { align: 'center' });

  doc.setDrawColor(203, 213, 225); // slate-300
  doc.setLineWidth(0.5);
  doc.line(14, y + 2, 196, y + 2);
  y += 8;

  // Table Body
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85); // slate-700

  students.forEach((s) => {
    // Add page if near bottom
    if (y > 270) {
      doc.addPage();
      y = 20;

      // Reprint table header
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 116, 139);
      doc.text('Student Name', 14, y);
      doc.text('Marks Obtained', 80, y, { align: 'right' });
      doc.text('Total Marks', 110, y, { align: 'right' });
      doc.text('Percentage', 145, y, { align: 'right' });
      doc.text('Grade', 180, y, { align: 'center' });
      doc.line(14, y + 2, 196, y + 2);
      y += 8;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(51, 65, 85);
    }

    doc.text(s.student_name, 14, y);
    doc.text(String(s.total_marks_obtained), 80, y, { align: 'right' });
    doc.text(String(exam.total_marks), 110, y, { align: 'right' });
    doc.text(`${s.percentage}%`, 145, y, { align: 'right' });
    doc.text(s.grade || 'N/A', 180, y, { align: 'center' });

    y += 8;
  });

  const arrayBuffer = doc.output('arraybuffer');
  return Buffer.from(arrayBuffer);
}

module.exports = {
  generateExcelBuffer,
  generateStudentReportPDF,
  generateClassResultsPDF
};
