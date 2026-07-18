import { useEffect, useState } from 'react'
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'
import { GraduationCap, Clock, Users, Sparkles } from 'lucide-react'
import api from '../../api/axios'
import LoadingState from '../../components/LoadingState'

export default function ClassAnalytics() {
  const [stats, setStats] = useState(null)
  const [trend, setTrend] = useState([])
  const [subjectPerf, setSubjectPerf] = useState([])
  const [performers, setPerformers] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedSubject, setSelectedSubject] = useState(null)

  useEffect(() => {
    Promise.all([
      api.get('/analytics/dashboard'),
      api.get('/analytics/score-trend'),
      api.get('/analytics/subject-performance'),
      api.get('/analytics/top-performers'),
    ]).then(([st, t, s, p]) => {
      setStats(st.data)
      setTrend(t.data)
      setSubjectPerf(s.data)
      setPerformers(p.data)
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingState />

  const statCards = [
    { label: 'Class Average', value: `${stats?.average_score ?? 0}%`, icon: GraduationCap },
    { label: 'Pending Reviews', value: stats?.pending_reviews ?? 0, icon: Clock },
    { label: 'Class Size', value: stats?.class_size ?? 0, icon: Users },
    { label: 'Total Exams', value: stats?.total_exams ?? 0, icon: Sparkles, highlight: true },
  ]

  const rankColor = (i) => (i === 0 ? 'bg-amber-400' : i === 1 ? 'bg-slate-400' : i === 2 ? 'bg-orange-500' : 'bg-primary')

  return (
    <div>
      <h1 className="text-2xl font-bold font-display text-slate-900">Analytics &amp; Insights</h1>
      <p className="text-slate-500 text-sm mt-1 mb-6">Real-time educational performance tracking powered by GradicAI.</p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {statCards.map((s) => (
          <div key={s.label} className={`rounded-xl p-5 shadow-sm ${s.highlight ? 'bg-primary text-white shadow-lg shadow-violet-200' : 'bg-white border border-violet-100'}`}>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-xs font-semibold uppercase tracking-wide ${s.highlight ? 'text-violet-100' : 'text-slate-400'}`}>{s.label}</span>
              <s.icon className={`w-4 h-4 ${s.highlight ? 'text-white' : 'text-primary'}`} strokeWidth={2} />
            </div>
            <p className="text-3xl font-black">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Performance Trend */}
        <div className="bg-white rounded-xl border border-violet-100 p-5 shadow-sm hover:shadow-md transition-shadow">
          <h3 className="font-bold text-slate-900 mb-4 font-display">Performance Trend</h3>
          {trend.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EDE9FE" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="average_score" stroke="#7C3AED" strokeWidth={2} dot={{ fill: '#7C3AED' }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-slate-400 text-sm">No data yet</div>
          )}
        </div>

        {/* Subject-wise Performance */}
        <div className="bg-white rounded-xl border border-violet-100 p-5 shadow-sm hover:shadow-md transition-shadow">
          <h3 className="font-bold text-slate-900 mb-1 font-display">Subject-wise Performance</h3>
          <p className="text-xs text-slate-400 mb-3">Average scores per subject — click a bar to highlight it</p>
          {subjectPerf.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={subjectPerf}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EDE9FE" />
                <XAxis dataKey="subject" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar
                  dataKey="average"
                  radius={[4, 4, 0, 0]}
                  cursor="pointer"
                  onClick={(data) => setSelectedSubject((prev) => (prev === data.subject ? null : data.subject))}
                >
                  {subjectPerf.map((d) => (
                    <Cell key={d.subject} fill={selectedSubject === d.subject ? '#5B21B6' : '#A78BFA'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-slate-400 text-sm">No data yet</div>
          )}
        </div>
      </div>

      {/* Top Performers */}
      <div className="bg-white rounded-xl border border-violet-100 p-5 shadow-sm hover:shadow-md transition-shadow">
        <h3 className="font-bold text-slate-900 mb-4 font-display">Top Performers</h3>
        {performers.length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-6">No graded submissions yet</p>
        ) : (
          <div className="space-y-3">
            {performers.map((p, i) => (
              <div key={p.student_name} className="flex items-center justify-between py-2 border-b border-violet-50 last:border-0">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${rankColor(i)}`}>{i + 1}</div>
                  <span className="font-medium text-slate-900">{p.student_name}</span>
                </div>
                <span className="text-primary font-bold text-lg">{p.average_score}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
