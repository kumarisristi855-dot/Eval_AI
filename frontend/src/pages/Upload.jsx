import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';

function Upload() {
  const { examId } = useParams();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [progress, setProgress] = useState({ total: 0, evaluated: 0, percentage: 0, status: 'idle' });
  const [error, setError] = useState('');
  const pollIntervalRef = useRef(null);

  // Clean up poll interval on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  const handleFileChange = (e) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files).filter(file => file.type === 'application/pdf');
      const processedFiles = [];
      const warnings = [];

      const currentNames = files.map(f => f.name);

      selectedFiles.forEach(file => {
        let name = file.name;
        let isDuplicate = currentNames.includes(name);
        let finalFile = file;

        if (isDuplicate) {
          const lastDotIndex = name.lastIndexOf('.');
          const nameWithoutExt = lastDotIndex !== -1 ? name.substring(0, lastDotIndex) : name;
          const ext = lastDotIndex !== -1 ? name.substring(lastDotIndex) : '';
          
          let counter = 1;
          let newName = `${nameWithoutExt} (${counter})${ext}`;
          while (
            currentNames.includes(newName) || 
            processedFiles.some(f => f.name === newName)
          ) {
            counter++;
            newName = `${nameWithoutExt} (${counter})${ext}`;
          }
          
          finalFile = new File([file], newName, { type: file.type });
          warnings.push(`File "${name}" already selected. Automatically renamed to "${newName}".`);
        }

        processedFiles.push(finalFile);
      });

      if (warnings.length > 0) {
        setError(warnings.join(' '));
      } else {
        setError('');
      }

      setFiles(prev => [...prev, ...processedFiles]);
    }
  };

  const removeFile = (indexToRemove) => {
    setFiles(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleUploadAndEvaluate = async () => {
    if (files.length === 0) {
      setError('Please select at least one student answer sheet PDF.');
      return;
    }

    setLoading(true);
    setError('');

    const data = new FormData();
    files.forEach(file => {
      data.append('studentFiles', file);
    });

    try {
      // 1. Upload student PDFs
      const uploadResponse = await api.post(`/api/exam/${examId}/upload-students`, data, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      // 2. Start evaluation pipeline
      await api.post(`/api/exam/${examId}/evaluate`);

      setEvaluating(true);
      startPolling();

    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to upload or evaluate student sheets. Ensure backend is running.');
      setLoading(false);
    }
  };

  const startPolling = () => {
    // Immediate first check
    checkStatus();

    pollIntervalRef.current = setInterval(() => {
      checkStatus();
    }, 3000);
  };

  const checkStatus = async () => {
    try {
      const statusResponse = await api.get(`/api/exam/${examId}/status`);
      const data = statusResponse.data;

      setProgress(data);

      if (data.status === 'done') {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        navigate(`/dashboard/${examId}`);
      } else if (data.status === 'failed') {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        setError(data.error || 'Evaluation failed. Please try again.');
        setEvaluating(false);
        setLoading(false);
      }
    } catch (err) {
      console.error('Error polling status:', err);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="text-center mb-10">
        <h1 className="text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-200 via-white to-violet-300">
          Upload Student Answer Sheets
        </h1>
        <p className="text-slate-400 mt-2 text-lg">
          Add the students' completed PDF files to initialize parallel evaluation.
        </p>
      </div>

      <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 shadow-2xl shadow-indigo-950/20">
        {error && (
          <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-xl text-sm flex items-center space-x-2 animate-pulse">
            <span className="font-semibold">Notice:</span>
            <span>{error}</span>
          </div>
        )}

        {!evaluating ? (
          <div className="space-y-6">
            {/* File drop area */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-800 rounded-2xl bg-slate-950/20 hover:bg-slate-950/40 hover:border-indigo-500/50 p-10 text-center cursor-pointer transition-all space-y-4"
            >
              <input
                type="file"
                multiple
                accept=".pdf"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="w-14 h-14 bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-400 mx-auto text-2xl">
                📂
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-200">Drag & Drop Student PDFs here</p>
                <p className="text-xs text-slate-500">or click to browse local files (PDF only)</p>
              </div>
            </div>

            {/* Selected files count header */}
            {files.length > 0 && (
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <span className="text-sm font-semibold text-slate-300">
                  {files.length} student{files.length > 1 ? 's' : ''} ready for evaluation
                </span>
                <button
                  onClick={() => setFiles([])}
                  className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                >
                  Clear All
                </button>
              </div>
            )}

            {/* List of files */}
            <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
              {files.map((file, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 bg-slate-950/40 border border-slate-800/80 rounded-xl text-sm"
                >
                  <div className="flex items-center space-x-3 overflow-hidden">
                    <span className="text-indigo-400 flex-shrink-0">📄</span>
                    <span className="text-slate-300 truncate font-medium">{file.name}</span>
                    <span className="text-xs text-slate-500">({(file.size / 1024).toFixed(1)} KB)</span>
                  </div>
                  <button
                    onClick={() => removeFile(idx)}
                    className="text-slate-500 hover:text-rose-400 font-bold px-2 transition-colors"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={handleUploadAndEvaluate}
              disabled={loading || files.length === 0}
              className="w-full flex items-center justify-center space-x-2 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white font-semibold py-4 px-6 rounded-2xl shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Uploading files...</span>
                </>
              ) : (
                <span>Upload & Start Evaluation</span>
              )}
            </button>
          </div>
        ) : (
          /* Evaluating / Progress state */
          <div className="space-y-8 py-6 text-center">
            <div className="relative w-24 h-24 mx-auto">
              <div className="absolute inset-0 bg-indigo-500/20 rounded-full blur-xl animate-pulse"></div>
              <div className="relative w-24 h-24 rounded-full border-4 border-slate-800 border-t-indigo-500 animate-spin flex items-center justify-center">
                <span className="text-xl">🤖</span>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-bold text-slate-200">AI Evaluation in Progress</h3>
              <p className="text-slate-400 text-sm">
                Evaluating {progress.evaluated} of {progress.total} students...
              </p>
            </div>

            {/* Progress bar container */}
            <div className="space-y-2">
              <div className="w-full h-3 bg-slate-950 border border-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 shadow-[0_0_12px_rgba(99,102,241,0.5)] transition-all duration-500 rounded-full"
                  style={{ width: `${progress.percentage}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-xs text-slate-500 font-semibold px-1">
                <span>{progress.percentage}% COMPLETE</span>
                <span>STATUS: {progress.status.toUpperCase()}</span>
              </div>
            </div>

            <p className="text-xs text-slate-500 italic max-w-sm mx-auto">
              Evaluation is happening asynchronously on the server. Please do not close this window.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Upload;
