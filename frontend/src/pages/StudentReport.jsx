import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { API_BASE } from '../config';

function StudentReport() {
  const { examId, studentId } = useParams();
  const navigate = useNavigate();

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [editingQuestionId, setEditingQuestionId] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const handleStartEdit = (questionId, currentMarks) => {
    setEditingQuestionId(questionId);
    setEditValue(currentMarks.toString());
  };

  const handleCancelEdit = () => {
    setEditingQuestionId(null);
    setEditValue('');
  };

  const handleSaveOverride = async (questionId, maxMarks) => {
    const marks = parseFloat(editValue);
    if (isNaN(marks) || marks < 0 || marks > maxMarks) {
      setToast({
        message: `Validation Error: Marks must be between 0 and ${maxMarks}`,
        type: 'error'
      });
      return;
    }

    try {
      const response = await api.patch(
        `/api/exam/${examId}/student/${studentId}/question/${questionId}/override`,
        { marks_awarded: marks }
      );

      if (response.data.success) {
        setReport((prev) => {
          if (!prev) return prev;
          
          const updatedEvaluations = prev.evaluations.map((evalItem) => {
            if (evalItem.question_id === questionId) {
              return {
                ...evalItem,
                marks_awarded: marks,
                is_overridden: 1
              };
            }
            return evalItem;
          });

          const strengthAreas = [];
          const weakAreas = [];

          updatedEvaluations.forEach((item) => {
            const maxVal = item.max_marks || 1;
            const ratio = item.marks_awarded / maxVal;
            
            if (ratio >= 0.8) {
              strengthAreas.push(item.question_number);
            } else if (ratio < 0.5) {
              weakAreas.push(item.question_number);
            }
          });

          return {
            ...prev,
            student: {
              ...prev.student,
              total_marks_obtained: response.data.newTotal,
              percentage: response.data.newPercentage,
              grade: response.data.newGrade
            },
            evaluations: updatedEvaluations,
            strengthAreas,
            weakAreas
          };
        });

        setToast({
          message: 'Marks updated successfully',
          type: 'success'
        });
        setEditingQuestionId(null);
        setEditValue('');
      }
    } catch (err) {
      console.error('Error saving marks override:', err);
      setToast({
        message: err.response?.data?.error || 'Failed to update marks.',
        type: 'error'
      });
    }
  };

  useEffect(() => {
    const fetchReport = async () => {
      try {
        const response = await api.get(`/api/exam/${examId}/student/${studentId}`);
        setReport(response.data);
      } catch (err) {
        console.error('Error fetching student report:', err);
        setError('Failed to load student evaluation report. Ensure backend is running.');
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [examId, studentId]);

  const handleExportPDF = () => {
    window.location.href = `${API_BASE}/api/exam/${examId}/student/${studentId}/export/pdf`;
  };

  const getRowClass = (obtained, max) => {
    const ratio = obtained / max;
    if (ratio === 1) {
      return 'bg-emerald-500/5 hover:bg-emerald-500/10 border-l-4 border-l-emerald-500/50';
    } else if (ratio >= 0.5) {
      return 'bg-yellow-500/5 hover:bg-yellow-500/10 border-l-4 border-l-yellow-500/50';
    } else {
      return 'bg-rose-500/5 hover:bg-rose-500/10 border-l-4 border-l-rose-500/50';
    }
  };

  const getGradeColor = (grade) => {
    switch (grade) {
      case 'A+': return 'text-emerald-400';
      case 'A': return 'text-emerald-300';
      case 'B': return 'text-blue-400';
      case 'C': return 'text-yellow-400';
      case 'D': return 'text-orange-400';
      default: return 'text-rose-400';
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <div className="w-10 h-10 border-4 border-slate-800 border-t-indigo-500 rounded-full animate-spin"></div>
        <p className="text-slate-400 text-sm">Compiling student report card...</p>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="max-w-md mx-auto mt-10 p-6 bg-rose-500/10 border border-rose-500/20 text-center rounded-2xl">
        <span className="text-rose-400 font-bold block text-lg mb-2">Error Loading Report</span>
        <p className="text-slate-400 text-sm">{error || 'Report could not be retrieved.'}</p>
        <button 
          onClick={() => navigate(`/dashboard/${examId}`)}
          className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-semibold transition-all"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  const { student, exam, evaluations, strengthAreas, weakAreas } = report;

  return (
    <div className="space-y-8 animate-fadeIn max-w-5xl mx-auto">
      {/* Back button and Export pdf */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(`/dashboard/${examId}`)}
          className="flex items-center space-x-2 text-slate-400 hover:text-white transition-colors font-medium text-sm"
        >
          <span>←</span> <span>Back to Dashboard</span>
        </button>
        
        <button
          onClick={handleExportPDF}
          className="flex items-center space-x-2 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white px-5 py-2.5 rounded-xl font-semibold text-sm shadow-md shadow-indigo-500/10 hover:shadow-indigo-500/20 transition-all animate-pulse-slow"
        >
          <span>📄</span> <span>Export to PDF</span>
        </button>
      </div>

      {/* Main Student Header and Score Block */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
        {/* Profile Card */}
        <div className="md:col-span-2 bg-slate-900/40 border border-slate-800/80 rounded-3xl p-6 flex flex-col justify-between shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl"></div>
          <div>
            <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest">
              Student Report Card
            </span>
            <h2 className="text-3xl font-extrabold text-white tracking-tight mt-1">
              {student.student_name}
            </h2>
            <div className="grid grid-cols-2 gap-4 mt-6 text-sm text-slate-400">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase">Class</p>
                <p className="text-slate-300 font-medium mt-0.5">{exam.class}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase">Subject</p>
                <p className="text-slate-300 font-medium mt-0.5">{exam.subject}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase">Assessment</p>
                <p className="text-slate-300 font-medium mt-0.5">{exam.name}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase">Status</p>
                <p className="text-emerald-400 font-medium mt-0.5 flex items-center space-x-1">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping"></span>
                  <span>Evaluated</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Big Score Card */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 text-center flex flex-col justify-center items-center shadow-lg relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/5 to-violet-500/5 pointer-events-none"></div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Final Assessment</p>
          <div className="mt-4 flex items-baseline justify-center">
            <span className="text-5xl font-extrabold text-white">{student.total_marks_obtained}</span>
            <span className="text-slate-500 text-lg font-medium ml-1">/ {exam.total_marks}</span>
          </div>
          <div className="mt-2 text-sm font-semibold text-slate-400">
            {student.percentage}% Score
          </div>
          <div className={`text-4xl font-extrabold mt-4 tracking-tighter ${getGradeColor(student.grade)}`}>
            {student.grade}
          </div>
        </div>
      </div>

      {/* Learning Analysis Areas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Strengths */}
        <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/5 rounded-full blur-xl"></div>
          <div className="flex items-center space-x-2 text-emerald-400 font-semibold mb-3">
            <span className="text-lg">✓</span>
            <span className="text-sm uppercase tracking-wider">Key Strengths</span>
          </div>
          <p className="text-slate-300 text-sm leading-relaxed">
            {strengthAreas.length > 0
              ? `Demonstrated strong conceptual grasp (scored >= 80%) in questions: ${strengthAreas.join(', ')}.`
              : 'No questions met the proficiency threshold of 80% or higher.'}
          </p>
        </div>

        {/* Growth Areas */}
        <div className="bg-rose-500/5 border border-rose-500/10 rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-rose-500/5 rounded-full blur-xl"></div>
          <div className="flex items-center space-x-2 text-rose-400 font-semibold mb-3">
            <span className="text-lg">⚠</span>
            <span className="text-sm uppercase tracking-wider">Areas for Growth</span>
          </div>
          <p className="text-slate-300 text-sm leading-relaxed">
            {weakAreas.length > 0
              ? `Struggled or missed key points (scored < 50%) in questions: ${weakAreas.join(', ')}. Targeted review recommended.`
              : 'Consistent fundamental performance. No question scores fell below 50%.'}
          </p>
        </div>
      </div>

      {/* Question breakdown list */}
      <div className="bg-slate-900/40 border border-slate-800/80 rounded-3xl overflow-hidden shadow-2xl">
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/80">
          <h3 className="font-bold text-slate-200">Question-by-Question Graded Analysis</h3>
        </div>

        <div className="divide-y divide-slate-800/60">
          {evaluations.map((item) => (
            <div 
              key={item.evaluation_id} 
              className={`p-6 border-b border-slate-800/40 transition-all ${getRowClass(item.marks_awarded, item.max_marks)}`}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2.5">
                    <span className="text-xs font-bold bg-slate-800 px-2 py-0.5 rounded text-slate-300 uppercase">
                      {item.question_number}
                    </span>
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      {item.question_type}
                    </span>
                    {item.is_overridden === 1 && (
                      <span className="text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                        Edited
                      </span>
                    )}
                  </div>
                  <h4 className="text-sm font-semibold text-slate-200 leading-normal pt-1">
                    {item.question_text}
                  </h4>
                </div>

                <div className="flex-shrink-0 text-right flex items-center space-x-3">
                  {editingQuestionId === item.question_id ? (
                    <div className="flex items-center space-x-2 bg-slate-900 p-1.5 rounded-xl border border-slate-700">
                      <input
                        type="number"
                        min="0"
                        max={item.max_marks}
                        step="0.5"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="w-16 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded px-2 py-1 text-sm font-semibold text-slate-100 focus:outline-none"
                      />
                      <button
                        onClick={() => handleSaveOverride(item.question_id, item.max_marks)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-1 rounded text-xs font-bold transition-colors"
                      >
                        Save
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded text-xs font-bold transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <div className="text-right">
                        <div className="text-sm font-semibold text-slate-200">
                          <span className="text-lg">{item.marks_awarded}</span>
                          <span className="text-slate-500 font-medium"> / {item.max_marks} marks</span>
                        </div>
                        <div className="text-xs text-slate-400 font-medium mt-1">
                          {Math.round((item.marks_awarded / item.max_marks) * 100)}% Match
                        </div>
                      </div>
                      <button
                        onClick={() => handleStartEdit(item.question_id, item.marks_awarded)}
                        title="Override Marks"
                        className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg transition-all"
                      >
                        ✏️
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Student Answer */}
              <div className="mt-4 p-3 bg-slate-950/60 border border-slate-800/60 rounded-xl">
                <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Student's Answer:</p>
                <p className="text-slate-300 text-sm whitespace-pre-wrap leading-relaxed font-mono">
                  {item.student_answer}
                </p>
              </div>

              {/* Feedback Block */}
              {item.feedback && (
                <div className="mt-3 p-3 bg-indigo-500/5 border border-indigo-500/10 rounded-xl">
                  <p className="text-xs font-semibold text-indigo-400 uppercase mb-1">Teacher Feedback:</p>
                  <p className="text-indigo-200 text-sm leading-relaxed">
                    {item.feedback}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl shadow-2xl border text-sm font-semibold flex items-center space-x-2 ${
          toast.type === 'error' 
            ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' 
            : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
        }`}>
          <span>{toast.type === 'error' ? '❌' : '✅'}</span>
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}

export default StudentReport;
