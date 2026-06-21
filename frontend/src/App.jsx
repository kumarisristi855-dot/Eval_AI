import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import ExamHistory from './pages/ExamHistory';
import Setup from './pages/Setup';
import Upload from './pages/Upload';
import Dashboard from './pages/Dashboard';
import StudentReport from './pages/StudentReport';
import AddStudents from './pages/AddStudents';
import Login from './pages/Login';
import ProtectedRoute from './components/ProtectedRoute';
import { getClassName, logout, isLoggedIn } from './utils/auth';

function AppContent() {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col antialiased">
      {/* Navigation Bar */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center space-x-3 group">
            <div className="w-10 h-10 bg-gradient-to-tr from-indigo-500 to-violet-500 rounded-xl flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-all">
              E
            </div>
            <span className="font-extrabold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-indigo-300">
              EvalAI
            </span>
          </Link>
          <nav className="flex items-center space-x-6 text-sm font-medium text-slate-400">
            {isLoggedIn() && (
              <>
                <span className="text-slate-500">Logged in as: {getClassName()}</span>
                <button 
                  onClick={logout} 
                  className="hover:text-white transition-colors bg-transparent border-none cursor-pointer p-0 font-medium"
                >
                  Logout
                </button>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* Page Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-10">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><ExamHistory /></ProtectedRoute>} />
          <Route path="/setup" element={<ProtectedRoute><Setup /></ProtectedRoute>} />
          <Route path="/upload/:examId" element={<ProtectedRoute><Upload /></ProtectedRoute>} />
          <Route path="/dashboard/:examId" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/student/:examId/:studentId" element={<ProtectedRoute><StudentReport /></ProtectedRoute>} />
          <Route path="/exam/:examId/add-students" element={<ProtectedRoute><AddStudents /></ProtectedRoute>} />
        </Routes>
      </main>

      {/* Debug LocalStorage Overlay */}
      {/* {(window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && (
        <div id="localstorage-debug" className="fixed bottom-4 right-4 bg-slate-900/95 border border-slate-800 p-4 rounded-lg shadow-2xl text-xs font-mono max-w-xs z-50 backdrop-blur">
          <div className="font-bold text-slate-400 mb-2 border-b border-slate-800 pb-1 flex justify-between items-center">
            <span>LocalStorage Debug</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          </div>
          <div className="space-y-1">
            <div><span className="text-indigo-400">token:</span> <span className="text-slate-300 break-all">{localStorage.getItem('token') ? `${localStorage.getItem('token').substring(0, 15)}...` : 'null'}</span></div>
            <div><span className="text-indigo-400">className:</span> <span className="text-slate-300">{localStorage.getItem('className') || 'null'}</span></div>
            <div><span className="text-indigo-400">classId:</span> <span className="text-slate-300">{localStorage.getItem('classId') || 'null'}</span></div>
          </div>
        </div>
      )} */}
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
