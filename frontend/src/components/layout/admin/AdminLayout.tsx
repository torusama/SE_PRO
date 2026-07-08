// src/components/layout/admin/AdminLayout.tsx
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import AdminHeader from './AdminHeader'
import '@/styles/admin-theme.css'
export default function AdminLayout() {
  return (
    <div className="admin-theme flex h-screen overflow-hidden" style={{ background: '#f5f3ee' }}>
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <AdminHeader />
        <div style={{height:1, background:"#e5e2da"}}/>
        <main className="flex-1 overflow-y-auto"
              style={{padding:"24px 28px",background:"#f5f3ee"}}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}