import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { ClipboardList, Monitor, FileCheck2, FileText, TrendingUp, Calendar, Brain, LogOut, Menu, X, HelpCircle } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import Logo from '../../components/Logo'

const nav = [
  { to: '/student/grades', icon: ClipboardList, label: 'Grades & Feedback' },
  { to: '/student/online-exams', icon: Monitor, label: 'Online Exams' },
  { to: '/student/physical-exams', icon: FileCheck2, label: 'Physical Exam Grading' },
  { to: '/student/assignments', icon: FileText, label: 'Assignments' },
  { to: '/student/progress', icon: TrendingUp, label: 'Progress Tracking' },
  { to: '/student/planner', icon: Calendar, label: 'Study Planner' },
  { to: '/student/quizzes', icon: Brain, label: 'Quiz' },
]

export default function StudentLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleLogout = () => { logout(); navigate('/') }

  return (
    <div className="flex h-screen bg-primary-light">
      {/* Backdrop (mobile only) */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed md:static inset-y-0 left-0 z-40 w-64 bg-white border-r border-violet-100 flex flex-col flex-shrink-0 transform transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
        <div className="px-5 py-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Logo className="w-9 h-9 flex-shrink-0" />
            <span className="font-display font-bold text-lg text-slate-900">Gradic<span className="text-primary">AI</span></span>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="md:hidden text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" strokeWidth={2} />
          </button>
        </div>
        <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-primary text-white shadow-sm shadow-violet-200'
                    : 'text-slate-500 hover:bg-primary-light hover:text-primary'
                }`
              }
            >
              <item.icon className="w-[18px] h-[18px] flex-shrink-0" strokeWidth={2} />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-3 py-4 border-t border-violet-100 space-y-1">
          <button className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:bg-primary-light hover:text-primary w-full transition-all">
            <HelpCircle className="w-[18px] h-[18px]" strokeWidth={2} /> Support
          </button>
          <button onClick={handleLogout} className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:bg-primary-light hover:text-primary w-full transition-all">
            <LogOut className="w-[18px] h-[18px]" strokeWidth={2} /> Logout
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="bg-white/70 backdrop-blur-sm border-b border-violet-100 px-4 md:px-8 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 md:hidden">
            <button onClick={() => setSidebarOpen(true)} className="text-slate-500 hover:text-slate-700">
              <Menu className="w-5 h-5" strokeWidth={2} />
            </button>
            <span className="font-display font-bold text-slate-900">GradicAI</span>
          </div>
          <div className="flex items-center gap-4 ml-auto">
            <div className="flex items-center gap-2 text-sm text-slate-700">
              <div className="w-9 h-9 bg-primary-light rounded-full flex items-center justify-center text-primary font-bold">
                {user?.name?.[0]?.toUpperCase()}
              </div>
              <span className="font-medium hidden sm:inline">{user?.name}</span>
            </div>
            <button onClick={handleLogout} className="text-sm text-slate-400 hover:text-primary flex items-center gap-1.5">
              <LogOut className="w-4 h-4" strokeWidth={2} /> <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
