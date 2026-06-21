import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';

function Setup() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    subject: '',
    class: '',
    totalMarks: '',
    instructions: ''
  });
  const [questionPaper, setQuestionPaper] = useState(null);
  const [answerKey, setAnswerKey] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFileChange = (e, setFile) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!questionPaper || !answerKey) {
      setError('Please upload both the question paper and answer key PDFs.');
      return;
    }

    setLoading(true);
    setError('');

    const data = new FormData();
    data.append('name', formData.name);
    data.append('subject', formData.subject);
    data.append('class', formData.class);
    data.append('totalMarks', formData.totalMarks);
    data.append('instructions', formData.instructions);
    data.append('questionPaper', questionPaper);
    data.append('answerKey', answerKey);

    try {
      const response = await api.post('/api/exam/setup', data, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      navigate(`/upload/${response.data.examId}`);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to initialize exam. Please ensure backend is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="text-center mb-10">
        <h1 className="text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-200 via-white to-violet-300">
          Create New Exam Evaluation
        </h1>
        <p className="text-slate-400 mt-2 text-lg">
          Configure exam metrics, and upload PDFs to initialize the grading environment.
        </p>
      </div>

      <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 shadow-2xl shadow-indigo-950/20">
        {error && (
          <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-xl text-sm flex items-center space-x-2">
            <span className="font-semibold">Error:</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">Exam Title</label>
              <input
                type="text"
                name="name"
                required
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g., Midterm Assessment"
                className="w-full bg-slate-950/50 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">Subject / Course</label>
              <input
                type="text"
                name="subject"
                required
                value={formData.subject}
                onChange={handleChange}
                placeholder="e.g., Biology"
                className="w-full bg-slate-950/50 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">Class / Grade Level</label>
              <input
                type="text"
                name="class"
                required
                value={formData.class}
                onChange={handleChange}
                placeholder="e.g., Class 10-A"
                className="w-full bg-slate-950/50 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">Total Marks (Reference Only)</label>
              <input
                type="number"
                name="totalMarks"
                value={formData.totalMarks}
                onChange={handleChange}
                placeholder="e.g., 50 (Will be auto-calculated from PDF)"
                className="w-full bg-slate-950/50 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">Custom Grading Instructions</label>
            <textarea
              name="instructions"
              value={formData.instructions}
              onChange={handleChange}
              rows={4}
              placeholder="e.g., Award partial credit for showing formulas. Be strict on terminology definitions."
              className="w-full bg-slate-950/50 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all resize-none"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            {/* Question Paper Upload */}
            <div className="relative">
              <label className="block text-sm font-semibold text-slate-300 mb-2">Question Paper PDF</label>
              <div className="border border-dashed border-slate-800 rounded-2xl bg-slate-950/20 hover:bg-slate-950/40 hover:border-indigo-500/50 p-6 text-center cursor-pointer transition-all relative">
                <input
                  type="file"
                  accept=".pdf"
                  required
                  onChange={(e) => handleFileChange(e, setQuestionPaper)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="space-y-2">
                  <div className="mx-auto w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-400">
                    📄
                  </div>
                  <div className="text-sm font-medium text-slate-300">
                    {questionPaper ? questionPaper.name : 'Upload Question Paper'}
                  </div>
                  <div className="text-xs text-slate-500">Click or drag PDF here</div>
                </div>
              </div>
            </div>

            {/* Answer Key Upload */}
            <div className="relative">
              <label className="block text-sm font-semibold text-slate-300 mb-2">Answer Key PDF</label>
              <div className="border border-dashed border-slate-800 rounded-2xl bg-slate-950/20 hover:bg-slate-950/40 hover:border-indigo-500/50 p-6 text-center cursor-pointer transition-all relative">
                <input
                  type="file"
                  accept=".pdf"
                  required
                  onChange={(e) => handleFileChange(e, setAnswerKey)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="space-y-2">
                  <div className="mx-auto w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-400">
                    🔑
                  </div>
                  <div className="text-sm font-medium text-slate-300">
                    {answerKey ? answerKey.name : 'Upload Answer Key'}
                  </div>
                  <div className="text-xs text-slate-500">Click or drag PDF here</div>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-6">
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center space-x-2 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white font-semibold py-4 px-6 rounded-2xl shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Processing PDFs & Configuring Exam...</span>
                </>
              ) : (
                <span>Initialize Exam</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Setup;
