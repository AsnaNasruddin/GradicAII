import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { GraduationCap, Presentation, Sparkles, TrendingUp, ShieldCheck, Eye, EyeOff, CheckCircle2, Circle } from 'lucide-react'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'
import { getErrorMessage } from '../utils/getErrorMessage'

const PASSWORD_RULES = [
  { label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { label: 'Contains a letter', test: (p) => /[A-Za-z]/.test(p) },
  { label: 'Contains a number', test: (p) => /\d/.test(p) },
]

export default function SignUp() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'student' })
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const allRulesPassed = PASSWORD_RULES.every((r) => r.test(form.password))
  const passwordsMatch = confirmPassword.length > 0 && form.password === confirmPassword
  const canSubmit = allRulesPassed && passwordsMatch

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!allRulesPassed) {
      setError('Please meet all password requirements before submitting.')
      return
    }
    if (form.password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    try {
      const res = await api.post('/auth/signup', form)
      login(res.data.user, res.data.access_token)
      navigate(res.data.user.role === 'teacher' ? '/teacher/dashboard' : '/student/grades')
    } catch (err) {
      setError(getErrorMessage(err, 'Sign up failed'))
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
        <h2 className="text-4xl font-black text-slate-900 mb-2">Get Started</h2>
        <p className="text-slate-500 mb-10">Create your account for free — for students and teachers</p>
        <div className="space-y-5">
          {[
            { icon: Sparkles, title: 'AI-Powered Grading', desc: 'Automate grading and save hours every week' },
            { icon: TrendingUp, title: 'Track Progress', desc: 'Monitor growth with detailed analytics' },
            { icon: ShieldCheck, title: 'Secure & Private', desc: 'Your academic data stays protected' },
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
      <div className="flex-1 flex items-center justify-center px-6 py-10">
        <div className="bg-white rounded-2xl shadow-lg p-10 w-full max-w-md">
        <h2 className="text-2xl font-bold text-slate-900 mb-1">Create Account</h2>
        <p className="text-slate-500 text-sm mb-8">Join GradicAI to get started</p>

        {error && <div className="bg-rose-50 text-rose-600 text-sm px-4 py-3 rounded-lg mb-5">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Full Name</label>
            <input
              type="text"
              placeholder="Your full name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
            <input
              type="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full px-4 py-3 pr-11 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
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
            {/* Password strength checklist */}
            {form.password.length > 0 && (
              <ul className="mt-2 space-y-1">
                {PASSWORD_RULES.map((r) => (
                  <li key={r.label} className={`text-xs flex items-center gap-1.5 ${r.test(form.password) ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {r.test(form.password) ? <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={2} /> : <Circle className="w-3.5 h-3.5" strokeWidth={2} />} {r.label}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Confirm Password</label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={`w-full px-4 py-3 pr-11 border rounded-xl text-sm focus:outline-none focus:ring-2 transition ${
                  confirmPassword.length > 0
                    ? passwordsMatch
                      ? 'border-emerald-400 focus:ring-emerald-400'
                      : 'border-rose-400 focus:ring-rose-400'
                    : 'border-slate-200 focus:ring-violet-500'
                }`}
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                tabIndex={-1}
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" strokeWidth={2} /> : <Eye className="w-4 h-4" strokeWidth={2} />}
              </button>
            </div>
            {confirmPassword.length > 0 && !passwordsMatch && (
              <p className="text-rose-500 text-xs mt-1">Passwords do not match</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">I am a</label>
            <div className="grid grid-cols-2 gap-3">
              {['student', 'teacher'].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setForm({ ...form, role: r })}
                  className={`py-3 rounded-xl border-2 font-medium capitalize transition ${
                    form.role === r
                      ? 'border-primary bg-primary-light text-primary-dark'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <span className="flex items-center justify-center gap-2">
                    {r === 'student' ? <GraduationCap className="w-4 h-4" strokeWidth={2} /> : <Presentation className="w-4 h-4" strokeWidth={2} />}
                    {r === 'student' ? 'Student' : 'Teacher'}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <button
            type="submit"
            disabled={loading || !canSubmit}
            className="w-full bg-primary hover:bg-primary-dark disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition"
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-sm text-slate-500 mt-6">
          Already have an account?{' '}
          <Link to="/signin" className="text-primary font-medium hover:underline">Sign in</Link>
        </p>
        </div>
      </div>
    </div>
  )
}
