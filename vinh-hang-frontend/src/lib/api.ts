// src/lib/api.ts
import axios from 'axios'
import { useAuthStore } from '@/store/authStore'

// Đổi URL này thành địa chỉ backend thật của bạn (Node/Express, .NET, v.v.)
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

// Tự động gắn access token vào mỗi request (nếu đã đăng nhập)
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) {
    config.headers = config.headers ?? {}
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Nếu token hết hạn (401) -> tự logout, đẩy về trang login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      useAuthStore.getState().logout()
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)
