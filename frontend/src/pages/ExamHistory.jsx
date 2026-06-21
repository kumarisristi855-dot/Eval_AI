import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';

function ExamHistory() {
  const navigate = useNavigate();
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Selection & Delete Feature States
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedExamIds, setSelectedExamIds] = useState([]);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [dialogError, setDialogError] = useState('');
  const [toastMessage, setToastMessage] = useState('');

  const fetchExams = async () => {
    try {
      const response = await api.get('/api/exams');
      setExams(response.data);
    } catch (err) {
      console.error('Error fetching exams:', err);
      setError('Failed to load exams history. Please check if the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExams();
  }, []);

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch (e) {
      return dateString;
    }
  };

  const handleToggleSelect = (examId) => {
    if (selectedExamIds.includes(examId)) {
      setSelectedExamIds(selectedExamIds.filter((id) => id !== examId));
    } else {
      setSelectedExamIds([...selectedExamIds, examId]);
    }
  };

  const handleDeleteConfirm = async () => {
    setDeleting(true);
    setDialogError('');
    try {
      const response = await api.delete('/api/exams', {
        data: { examIds: selectedExamIds }
      });
      if (response.data.success) {
        setToastMessage(`${selectedExamIds.length} exam(s) deleted successfully`);
        // Refresh local list
        setExams(exams.filter(e => !selectedExamIds.includes(e.id)));
        setIsSelectionMode(false);
        setSelectedExamIds([]);
        setShowConfirmDialog(false);
      }
    } catch (err) {
      console.error('Error deleting exams:', err);
      setDialogError(err.response?.data?.error || 'Failed to delete exams. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <div className="w-10 h-10 border-4 border-slate-800 border-t-indigo-500 rounded-full animate-spin"></div>
        <p className="text-slate-400 text-sm">Loading exam launch history...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto mt-10 p-6 bg-rose-500/10 border border-rose-500/20 text-center rounded-2xl">
        <span className="text-rose-400 font-bold block text-lg mb-2">Error Loading Exams</span>
        <p className="text-slate-400 text-sm">{error}</p>
        <button 
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-semibold transition-all"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto relative">
      {/* Success Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-500 text-white px-5 py-3 rounded-xl shadow-lg shadow-emerald-500/20 font-semibold text-sm animate-slideIn">
          ✅ {toastMessage}
        </div>
      )}

      {/* Confirmation Dialog Overlay */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800/80 rounded-3xl p-6 max-w-md w-full mx-4 shadow-2xl animate-scaleIn text-center space-y-4">
            <div className="w-12 h-12 bg-rose-500/10 border border-rose-500/20 rounded-full flex items-center justify-center text-2xl mx-auto text-rose-500 animate-pulse">
              ⚠️
            </div>
            <h3 className="text-xl font-bold text-white">Delete Exams?</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Are you sure you want to delete {selectedExamIds.length} exam(s)? This will permanently remove all student results, evaluations and data for these exams. This action cannot be undone.
            </p>
            {dialogError && (
              <div className="text-rose-400 text-xs bg-rose-500/10 border border-rose-500/20 rounded-xl p-2">
                {dialogError}
              </div>
            )}
            <div className="flex items-center justify-center space-x-3 pt-2">
              <button
                onClick={() => {
                  setShowConfirmDialog(false);
                  setDialogError('');
                }}
                className="w-1/2 border border-slate-800 hover:bg-slate-850 text-slate-300 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className="w-1/2 bg-rose-600 hover:bg-rose-700 text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-lg shadow-rose-600/10 hover:shadow-rose-600/20 disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-indigo-300">
            Exam History
          </h1>
          <p className="text-slate-400 mt-1">
            Access previous assessments, review class results, or initiate a new evaluation.
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          {isSelectionMode ? (
            <>
              <button
                onClick={() => setShowConfirmDialog(true)}
                disabled={selectedExamIds.length === 0}
                className="bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:hover:bg-rose-600 text-white px-5 py-3 rounded-xl font-bold text-sm transition-all flex items-center space-x-2"
              >
                🗑️ Delete Selected ({selectedExamIds.length})
              </button>
              <button
                onClick={() => {
                  setIsSelectionMode(false);
                  setSelectedExamIds([]);
                }}
                className="border border-slate-800 hover:bg-slate-800 text-slate-300 px-5 py-3 rounded-xl font-bold text-sm transition-all"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              {exams.length > 0 && (
                <button
                  onClick={() => {
                    setIsSelectionMode(true);
                    setSelectedExamIds([]);
                  }}
                  className="bg-slate-900 border border-slate-800 hover:bg-slate-850 text-slate-200 px-5 py-3 rounded-xl font-bold text-sm transition-all"
                >
                  Select
                </button>
              )}
              <button
                onClick={() => navigate('/setup')}
                className="bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white px-5 py-3 rounded-xl font-bold text-sm shadow-lg shadow-indigo-500/10 hover:shadow-indigo-500/20 transition-all flex items-center space-x-2"
              >
                <span>➕</span>
                <span>New Exam</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main content grid */}
      {exams.length === 0 ? (
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-3xl p-12 text-center flex flex-col justify-center items-center shadow-lg min-h-[40vh]">
          <div className="w-16 h-16 bg-slate-800/80 rounded-2xl flex items-center justify-center text-3xl mb-4 border border-slate-700">
            📚
          </div>
          <h3 className="text-xl font-bold text-white mb-2">No exams yet</h3>
          <p className="text-slate-400 max-w-sm text-sm mb-6">
            Get started by initializing your first exam and importing student answer booklets.
          </p>
          <button
            onClick={() => navigate('/setup')}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-semibold text-sm transition-all"
          >
            Create New Exam
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {exams.map((exam) => (
            <div
              key={exam.id}
              onClick={() => {
                if (isSelectionMode) {
                  handleToggleSelect(exam.id);
                } else {
                  navigate(`/dashboard/${exam.id}`);
                }
              }}
              className={`group cursor-pointer bg-slate-900/40 hover:bg-slate-900/80 border rounded-3xl p-6 transition-all duration-350 shadow-lg hover:shadow-2xl hover:shadow-indigo-950/20 relative overflow-hidden flex flex-col justify-between ${
                selectedExamIds.includes(exam.id)
                  ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-slate-900/60'
                  : 'border-slate-800/80 hover:border-indigo-500/50'
              }`}
            >
              {/* Checkbox overlay in top left corner */}
              {isSelectionMode && (
                <div className="absolute top-6 left-6 z-10">
                  <div
                    className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                      selectedExamIds.includes(exam.id)
                        ? 'bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-600/10'
                        : 'border-slate-700 bg-slate-800/80'
                    }`}
                  >
                    {selectedExamIds.includes(exam.id) && (
                      <span className="text-[10px] font-bold">✓</span>
                    )}
                  </div>
                </div>
              )}

              {/* Highlight background glow */}
              <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/0 group-hover:bg-indigo-500/5 rounded-full blur-xl transition-all duration-500"></div>
              
              <div>
                <div className={`flex items-center justify-between mb-4 transition-all duration-350 ${isSelectionMode ? 'pl-8' : ''}`}>
                  <span className="text-[10px] font-extrabold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded-full uppercase tracking-wider">
                    {exam.class}
                  </span>
                  <span className="text-xs text-slate-500 font-medium">
                    {formatDate(exam.created_at)}
                  </span>
                </div>

                <h3 className={`text-xl font-bold text-white group-hover:text-indigo-300 transition-colors line-clamp-1 mb-1 ${isSelectionMode ? 'pl-8' : ''}`}>
                  {exam.name}
                </h3>
                <p className={`text-slate-400 text-sm mb-4 font-medium ${isSelectionMode ? 'pl-8' : ''}`}>
                  {exam.subject}
                </p>
              </div>

              <div className="border-t border-slate-800/80 pt-4 mt-4 grid grid-cols-2 gap-4 text-xs font-semibold text-slate-400">
                <div className="flex items-center space-x-1.5">
                  <span className="text-slate-500">📊</span>
                  <span>{exam.student_count} Students</span>
                </div>
                <div className="flex items-center justify-end space-x-1.5">
                  <span className="text-slate-500">🎯</span>
                  <span>{exam.total_marks} Marks</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ExamHistory;
