import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { API_BASE } from '../config';

function Dashboard() {
  const { examId } = useParams();
  const navigate = useNavigate();

  const [exam, setExam] = useState(null);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sortField, setSortField] = useState('total_marks_obtained'); // default sort
  const [sortDirection, setSortDirection] = useState('desc'); // default highest first
  const [showExportMenu, setShowExportMenu] = useState(false);

  useEffect(() => {
    const fetchResults = async () => {
      try {
        const response = await api.get(`/api/exam/${examId}/results`);
        setExam(response.data.exam);
        setStudents(response.data.students);
      } catch (err) {
        console.error('Error fetching dashboard results:', err);
        setError('Failed to fetch class performance statistics. Verify backend database connection.');
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [examId]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.export-dropdown')) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const handleExport = async (type) => {
    try {
      const endpoint = `/api/exam/${examId}/export/${type}`;
      const response = await api.get(endpoint, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const extension = type === 'excel' ? 'xlsx' : 'pdf';
      link.setAttribute('download', `Class_Results_${examId}.${extension}`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
      setShowExportMenu(false);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to download the file. Your session may have expired.');
    }
  };

  const handleSort = (field) => {
    const isAsc = sortField === field && sortDirection === 'asc';
    setSortDirection(isAsc ? 'desc' : 'asc');
    setSortField(field);
  };

  // Sort student records dynamically
  const sortedStudents = [...students].sort((a, b) => {
    let valA = a[sortField];
    let valB = b[sortField];

    if (valA === null || valA === undefined) valA = '';
    if (valB === null || valB === undefined) valB = '';

    if (typeof valA === 'string') {
      valA = valA.toLowerCase();
      valB = valB.toLowerCase();
    }

    if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
    if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  // Calculate Metrics
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

  const getGradeBadgeClass = (grade) => {
    switch (grade) {
      case 'A+': return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
      case 'A': return 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20';
      case 'B': return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
      case 'C': return 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20';
      case 'D': return 'bg-orange-500/10 text-orange-400 border border-orange-500/20';
      case 'F': return 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
      default: return 'bg-slate-500/10 text-slate-400 border border-slate-500/20';
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <div className="w-10 h-10 border-4 border-slate-800 border-t-indigo-500 rounded-full animate-spin"></div>
        <p className="text-slate-400 text-sm">Compiling class performance statistics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto mt-10 p-6 bg-rose-500/10 border border-rose-500/20 text-center rounded-2xl">
        <span className="text-rose-400 font-bold block text-lg mb-2">Error Loading Dashboard</span>
        <p className="text-slate-400 text-sm">{error}</p>
        <button
          onClick={() => navigate('/')}
          className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-semibold transition-all"
        >
          Return to Setup
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header Info */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-900 pb-6 gap-4">
        <div>
          <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest">
            {exam?.class} • {exam?.subject}
          </span>
          <h1 className="text-3xl font-extrabold text-white tracking-tight mt-1">
            {exam?.name}
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Overall class assessment overview and performance benchmarks.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => navigate(`/exam/${examId}/add-students`)}
            className="flex items-center space-x-2 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white px-5 py-3 rounded-xl font-semibold text-sm transition-all shadow-md shadow-indigo-500/10 hover:shadow-indigo-500/20"
          >
            <span>➕</span> <span>Add More Students</span>
          </button>
          {/* Export Dropdown */}
          <div className="relative export-dropdown">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="flex items-center space-x-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-200 px-5 py-3 rounded-xl font-semibold text-sm transition-all"
            >
              📤 <span>Export</span> <span className="text-[10px] text-slate-400">▼</span>
            </button>
            {showExportMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-slate-900 border border-slate-800 rounded-xl shadow-xl z-50 overflow-hidden animate-fadeIn">
                <button
                  onClick={() => handleExport('excel')}
                  className="w-full text-left px-4 py-3 text-sm hover:bg-slate-800 transition-colors flex items-center space-x-2 text-slate-200"
                >
                  <span>📊</span> <span>Download as Excel</span>
                </button>
                <button
                  onClick={() => handleExport('pdf')}
                  className="w-full text-left px-4 py-3 text-sm hover:bg-slate-800 transition-colors flex items-center space-x-2 text-slate-200 border-t border-slate-800/50"
                >
                  <span>📄</span> <span>Download as PDF</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-xl"></div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Students</p>
          <p className="text-3xl font-extrabold text-white mt-2">{totalStudents}</p>
        </div>

        <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-violet-500/5 rounded-full blur-xl"></div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Class Average</p>
          <p className="text-3xl font-extrabold text-indigo-300 mt-2">
            {averageObtained} <span className="text-sm font-semibold text-slate-500">/ {exam?.total_marks} ({averagePercentage}%)</span>
          </p>
        </div>

        <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl"></div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Highest Score</p>
          <p className="text-3xl font-extrabold text-emerald-400 mt-2">
            {highestScore} <span className="text-sm font-semibold text-slate-500">/ {exam?.total_marks}</span>
          </p>
        </div>

        <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-full blur-xl"></div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Lowest Score</p>
          <p className="text-3xl font-extrabold text-rose-400 mt-2">
            {lowestScore} <span className="text-sm font-semibold text-slate-500">/ {exam?.total_marks}</span>
          </p>
        </div>
      </div>

      {/* Results Table */}
      <div className="bg-slate-900/40 border border-slate-800/80 rounded-3xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase bg-slate-900/80">
                <th
                  onClick={() => handleSort('student_name')}
                  className="px-6 py-4 cursor-pointer hover:text-white transition-colors"
                >
                  Student Name {sortField === 'student_name' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th
                  onClick={() => handleSort('total_marks_obtained')}
                  className="px-6 py-4 cursor-pointer hover:text-white transition-colors text-right"
                >
                  Marks Obtained {sortField === 'total_marks_obtained' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th className="px-6 py-4 text-right">Total Marks</th>
                <th
                  onClick={() => handleSort('percentage')}
                  className="px-6 py-4 cursor-pointer hover:text-white transition-colors text-right"
                >
                  Percentage {sortField === 'percentage' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th
                  onClick={() => handleSort('grade')}
                  className="px-6 py-4 cursor-pointer hover:text-white transition-colors text-center"
                >
                  Grade {sortField === 'grade' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th className="px-6 py-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {sortedStudents.map((student) => (
                <tr
                  key={student.id}
                  onClick={() => navigate(`/student/${examId}/${student.id}`)}
                  className="hover:bg-slate-800/30 transition-colors cursor-pointer group"
                >
                  <td className="px-6 py-4">
                    <span className="text-sm font-semibold text-slate-200 group-hover:text-white transition-colors">
                      {student.student_name}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-medium text-slate-300">
                    {student.total_marks_obtained}
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-normal text-slate-500">
                    {exam?.total_marks}
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-medium text-indigo-400">
                    {student.percentage}%
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`inline-block px-3 py-1 text-xs font-bold rounded-lg border uppercase tracking-wider ${getGradeBadgeClass(student.grade)}`}>
                      {student.grade}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors group-hover:translate-x-1 inline-block transform">
                      View Report →
                    </span>
                  </td>
                </tr>
              ))}

              {sortedStudents.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500 text-sm">
                    No evaluated student records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
