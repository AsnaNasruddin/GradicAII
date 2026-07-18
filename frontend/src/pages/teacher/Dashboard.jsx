import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LineChart, Line, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { ClipboardList, Clock, BarChart3, Users, Sparkles, ArrowRight } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import api from '../../api/axios'
import LoadingState from '../../components/LoadingState'

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [trend, setTrend] = useState([])
  const [dist, setDist] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedRange, setSelectedRange] = useState(null)

  useEffect(() => {
    Promise.all([
      api.get('/analytics/dashboard'),
      api.get('/analytics/score-trend'),
      api.get('/analytics/score-distribution'),
    ]).then(([s, t, d]) => {
      setStats(s.data)
      setTrend(t.data)
      setDist(d.data)
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingState />

  const statCards = [
    { label: 'Total Exams', value: stats?.total_exams ?? 0, sub: 'Created so far', icon: ClipboardList, iconBg: 'bg-primary-light text-primary' },
    { label: 'Pending Reviews', value: stats?.pending_reviews ?? 0, sub: 'Need attention', icon: Clock, iconBg: 'bg-amber-50 text-amber-600' },
    { label: 'Average Score', value: `${stats?.average_score ?? 0}`, sub: 'Across graded submissions', icon: BarChart3, iconBg: 'bg-violet-50 text-violet-600' },
    { label: 'Class Size', value: stats?.class_size ?? 0, sub: 'Students', icon: Users, iconBg: 'bg-emerald-50 text-emerald-600' },
  ]

  // Insight derived from real fetched stats — no fabricated numbers.
  const insight = (() => {
    if ((stats?.pending_reviews ?? 0) > 0) {
      return {
        text: `You have ${stats.pending_reviews} submission${stats.pending_reviews !== 1 ? 's' : ''} awaiting your review. Approving AI-graded work promptly keeps feedback timely for students.`,
        cta: 'Review Submissions', to: '/teacher/grades',
      }
    }
    if ((stats?.average_score ?? 0) > 0 && stats.average_score < 60) {
      return {
        text: `Your class average is ${stats.average_score}%, below the 60% mark. Consider reviewing recent material or flagging commonly-missed questions.`,
        cta: 'View Class Analytics', to: '/teacher/analytics',
      }
    }
    if ((stats?.total_exams ?? 0) === 0) {
      return {
        text: 'You haven\'t created any exams yet. Set up your first assessment to start collecting real-time performance data.',
        cta: 'Create Assessment', to: '/teacher/grades',
      }
    }
    return {
      text: `Class average is holding at ${stats.average_score}% across ${stats.total_exams} exam${stats.total_exams !== 1 ? 's' : ''}. Everything looks on track.`,
      cta: 'View Class Analytics', to: '/teacher/analytics',
    }
  })()

  return (
    <div>
      <h1 className="text-2xl font-bold font-display text-slate-900">Welcome back, {user?.name}!</h1>
      <p className="text-slate-500 text-sm mt-1 mb-6">Here's an overview of your class performance</p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {statCards.map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-violet-100 p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${s.iconBg}`}>
              <s.icon className="w-[18px] h-[18px]" strokeWidth={2} />
            </div>
            <p className="text-sm text-slate-500">{s.label}</p>
            <p className="text-3xl font-black mt-1 text-slate-900">{s.value}</p>
            <p className="text-xs text-slate-400 mt-1">{s.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl border border-violet-100 p-5 shadow-sm hover:shadow-md transition-shadow">
            <h3 className="font-bold text-slate-900 mb-4 font-display">Average Class Score Trend</h3>
            {trend.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EDE9FE" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="average_score" stroke="#7C3AED" strokeWidth={2} dot={{ fill: '#7C3AED' }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-slate-400 text-sm">No data yet. Upload exams and grade submissions.</div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-violet-100 p-5 shadow-sm hover:shadow-md transition-shadow">
            <h3 className="font-bold text-slate-900 mb-1 font-display">Score Distribution</h3>
            <p className="text-xs text-slate-400 mb-3">Click a bar to highlight that score range</p>
            {dist.some((d) => d.count > 0) ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={dist}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EDE9FE" />
                  <XAxis dataKey="range" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar
                    dataKey="count"
                    radius={[4, 4, 0, 0]}
                    cursor="pointer"
                    onClick={(data) => setSelectedRange((prev) => (prev === data.range ? null : data.range))}
                  >
                    {dist.map((d) => (
                      <Cell key={d.range} fill={selectedRange === d.range ? '#5B21B6' : '#A78BFA'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-slate-400 text-sm">No graded submissions yet</div>
            )}
          </div>
        </div>

        {/* AI Insights */}
        <div className="bg-primary rounded-xl p-6 shadow-lg shadow-violet-200 text-white flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5" strokeWidth={2} />
            <h3 className="font-bold font-display">AI Insights</h3>
          </div>
          <p className="text-sm text-violet-50 leading-relaxed flex-1">{insight.text}</p>
          <button
            onClick={() => navigate(insight.to)}
            className="mt-5 bg-white text-primary font-semibold text-sm px-4 py-2.5 rounded-lg hover:bg-violet-50 transition flex items-center justify-center gap-1.5"
          >
            {insight.cta} <ArrowRight className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  )
}
