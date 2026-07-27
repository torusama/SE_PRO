// src/components/layout/customer/CustomerLayout.tsx
import { Outlet, useLocation } from 'react-router-dom'
import { ROUTES } from '@/constants/routes'
import Navbar from './Navbar'
import Footer from './Footer'

export default function CustomerLayout() {
  const location = useLocation()
  const isAgentPage = location.pathname === ROUTES.AI_AGENT

  return (
    <div
      className={`${isAgentPage ? 'h-screen overflow-hidden' : 'min-h-screen'} flex flex-col`}
      style={{
        background: 'var(--color-bg-primary)',
        ...(isAgentPage ? { height: '100dvh', minHeight: 0 } : {}),
      }}
    >
      <Navbar />
      <main
        className={`flex-1 ${isAgentPage ? 'min-h-0 overflow-hidden' : ''}`}
      >
        <Outlet />
      </main>
      {!isAgentPage && <Footer />}
    </div>
  )
}
