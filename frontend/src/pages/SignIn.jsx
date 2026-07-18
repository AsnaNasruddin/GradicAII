import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Zap, MessageSquare, Target, Mail, Lock, Eye, EyeOff } from 'lucide-react'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'
import { getErrorMessage } from '../utils/getErrorMessage'

export default function SignIn() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await api.post('/auth/signin', form)
      login(res.data.user, res.data.access_token)
      navigate(res.data.user.role === 'teacher' ? '/teacher/dashboard' : '/student/grades')
    } catch (err) {
      setError(getErrorMessage(err, 'Sign in failed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-center px-16 w-[45%] bg-white">
        <div className="flex items-center gap-2 mb-10">
          <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center text-white font-bold text-xl">G</div>
        </div>
        <h2 className="text-4xl font-black text-slate-900 mb-2">Welcome Back</h2>
        <p className="text-slate-500 mb-10">Sign in to continue to GradicAI</p>
        <div className="space-y-5">
          {[
            { icon: Zap, title: 'Smart Grading', desc: 'AI-powered assessment system' },
            { icon: MessageSquare, title: 'Real-time Feedback', desc: 'Instant insights for students' },
            { icon: Target, title: 'Easy Management', desc: 'Streamlined classroom tools' },
          ].map((f) => (
            <div key={f.title} className="flex items-center gap-4">
              <div className="w-10 h-10 bg-primary-light rounded-xl flex items-center justify-center text-primary">
                <f.icon className="w-5 h-5" strokeWidth={2} />
              </div>
              <div>
                <p className="font-semibold text-slate-800">{f.title}</p>
                <p className="text-sm text-slate-500">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="bg-white rounded-2xl shadow-lg p-10 w-full max-w-md">
          <h2 className="text-2xl font-bold text-slate-900 mb-1">Sign In</h2>
          <p className="text-slate-500 text-sm mb-8">Enter your credentials to access your account</p>

          {error && <div className="bg-rose-50 text-rose-600 text-sm px-4 py-3 rounded-lg mb-5">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" strokeWidth={2} />
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full pl-9 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" strokeWidth={2} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full pl-9 pr-11 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" strokeWidth={2} /> : <Eye className="w-4 h-4" strokeWidth={2} />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-primary-dark disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition flex items-center justify-center gap-2"
            >
              {loading ? 'Signing in...' : 'Sign In →'}
            </button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200" /></div>
            <div className="relative flex justify-center"><span className="bg-white px-3 text-sm text-slate-400">Or</span></div>
          </div>
          <p className="text-center text-sm text-slate-500">
            Don't have an account?{' '}
            <Link to="/signup" className="text-primary font-medium hover:underline">Create one</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
