import axios from 'axios';
import { getToken, logout } from './auth';
import { API_BASE } from '../config'; 

const api = axios.create({
  baseURL: API_BASE || 'http://localhost:5000', 
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      logout(); 
    }
    return Promise.reject(error);
  }
);

export default api;
