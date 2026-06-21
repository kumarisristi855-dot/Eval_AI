const fs = require('fs');
const { PDFParse } = require('pdf-parse');

/**
 * Parses a PDF file and extracts its text contents.
 * @param {string} filePath - Absolute path to the PDF file
 * @returns {Promise<string>} Extracted text content
 */
async function parsePdf(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File does not exist: ${filePath}`);
    }
    const dataBuffer = fs.readFileSync(filePath);
    const uint8Array = new Uint8Array(dataBuffer);
    const parser = new PDFParse(uint8Array);
    const result = await parser.getText();
    return result.text || '';
  } catch (error) {
    console.error(`Error in pdfParser for path ${filePath}:`, error);
    throw new Error(`Failed to parse PDF: ${error.message}`);
  }
}

module.exports = parsePdf;
