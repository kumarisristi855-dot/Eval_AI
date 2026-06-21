// Production mein Vercel ka environment variable use hoga, local mein localhost:5000
export const API_BASE = import.meta.env.VITE_API_BASE || `http://${window.location.hostname}:5000`;