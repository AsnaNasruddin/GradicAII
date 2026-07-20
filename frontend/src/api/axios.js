import axios from 'axios'

// VITE_API_URL is set at build time (e.g. on Vercel) to the deployed backend's
// URL; falls back to localhost so local dev needs no .env changes.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const isAuthEndpoint = /\/auth\/(signin|signup)$/.test(err.config?.url || '')
    if (err.response?.status === 401 && !isAuthEndpoint) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/signin'
    }
    return Promise.reject(err)
  }
)

export default api
