import { useEffect, useState } from 'react'
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { FileText, TrendingUp, CheckCircle2, Trophy } from 'lucide-react'
import api from '../../api/axios'
import LoadingState from '../../components/LoadingState'
import { getErrorMessage } from '../../utils/getErrorMessage'
import { useNotification } from '../../context/NotificationContext'

const COLORS = ['#7C3AED', '#DB2777', '#F59E0B', '#16A34A', '#0891B2']

export default function ProgressTracking() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const { showToast } = useNotification()

  useEffect(() => {
    api.get('/analytics/student/progress')
      .then((r) => setData(r.data))
      .catch((err) => showToast(getErrorMessage(err, 'Failed to load progress data'), 'error'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingState />

  const stats = [
    { label: 'Current Average', value: data?.current_average || 0, color: 'text-primary', icon: FileText, iconBg: 'bg-primary-light text-primary' },
    { label: 'Improvement', value: `${data?.improvement >= 0 ? '+' : ''}${data?.improvement || 0}%`, color: 'text-emerald-600', icon: TrendingUp, iconBg: 'bg-emerald-50 text-emerald-600' },
    { label: 'Assessments Done', value: data?.assessments_done || 0, color: 'text-primary', icon: CheckCircle2, iconBg: 'bg-primary-light text-primary' },
    { label: 'Subjects', value: data?.subject_breakdown?.length || 0, color: 'text-orange-600', icon: Trophy, iconBg: 'bg-orange-50 text-orange-600' },
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold font-display text-slate-900">Progress Tracking</h1>
      <p className="text-slate-500 text-sm mt-1 mb-6">Monitor your academic improvement over time</p>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {stats.map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-violet-100 p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-2 ${s.iconBg}`}>
              <s.icon className="w-[18px] h-[18px]" strokeWidth={2} />
            </div>
            <p className="text-sm text-slate-500">{s.label}</p>
            <p className={`text-3xl font-black mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Overall Progress */}
        <div className="bg-white rounded-xl border border-violet-100 p-5 shadow-sm">
          <h3 className="font-bold font-display text-slate-900 mb-4">Overall Progress</h3>
          {data?.trend?.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={data.trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EDE9FE" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="score" stroke="#7C3AED" strokeWidth={2} dot={{ fill: '#7C3AED' }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-slate-400 text-sm">Submit exams to see progress</div>
          )}
        </div>

        {/* Performance by Subject */}
        <div className="bg-white rounded-xl border border-violet-100 p-5 shadow-sm">
          <h3 className="font-bold font-display text-slate-900 mb-4">Performance by Subject</h3>
          {data?.subject_breakdown?.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={data.subject_breakdown} dataKey="average" nameKey="subject" cx="50%" cy="50%" outerRadius={80} label={({ subject, average }) => `${subject}: ${average}`}>
                  {data.subject_breakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-slate-400 text-sm">No data yet</div>
          )}
        </div>
      </div>

      {/* Subject breakdown table */}
      {data?.subject_breakdown?.length > 0 && (
        <div className="bg-white rounded-xl border border-violet-100 p-5 shadow-sm">
          <h3 className="font-bold font-display text-slate-900 mb-4">Learning Goals</h3>
          <div className="space-y-3">
            {data.subject_breakdown.map((s, i) => (
              <div key={s.subject}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium text-slate-700">{s.subject}</span>
                  <span className="text-slate-500">{s.average}%</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full">
                  <div className="h-2 rounded-full" style={{ width: `${s.average}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
