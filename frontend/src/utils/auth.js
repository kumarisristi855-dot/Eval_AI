export const setToken = (token, className, classId) => {
  localStorage.setItem('token', token);
  localStorage.setItem('className', className);
  localStorage.setItem('classId', classId ? String(classId) : '');
};

export const getToken = () => localStorage.getItem('token');
export const getClassName = () => localStorage.getItem('className');
export const getClassId = () => localStorage.getItem('classId');

export const logout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('className');
  localStorage.removeItem('classId');
  window.location.href = '/login'; 
};

export const isLoggedIn = () => {
  const token = getToken();
  if (!token) return false;
  
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000 > Date.now();
  } catch (error) {
    return false;
  }
};

