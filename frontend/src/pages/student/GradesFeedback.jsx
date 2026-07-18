import { useEffect, useState } from 'react'
import { CheckCircle2, XCircle, ClipboardList, FileText, Brain, Sparkles, ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import api from '../../api/axios'
import LoadingState from '../../components/LoadingState'

function AssignmentDetailsModal({ sub, assignment, onClose }) {
  if (!sub) return null
  let analysis = []
  try { analysis = JSON.parse(sub.question_analysis || '[]') } catch {}
  const score = sub.final_score ?? sub.ai_score
  const pct = score != null ? Math.round((score / sub.total_marks) * 100) : null

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="bg-primary text-white px-6 py-5 rounded-t-2xl">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold">{assignment?.title || sub.assignment_title}</h2>
              <p className="text-violet-200 text-sm mt-0.5">{assignment?.teacher_name} • {assignment?.subject || 'Assignment'}</p>
            </div>
            <button onClick={onClose} className="text-violet-200 hover:text-white text-2xl leading-none">×</button>
          </div>
          <div className="flex items-end gap-6 mt-4">
            <div>
              <p className="text-violet-300 text-xs mb-0.5">Score</p>
              <p className="text-4xl font-black">{score}<span className="text-xl text-violet-300">/{sub.total_marks}</span></p>
            </div>
            {pct != null && (
              <div>
                <p className="text-violet-300 text-xs mb-0.5">Percentage</p>
                <p className="text-3xl font-black">{pct}%</p>
              </div>
            )}
          </div>
        </div>
        <div className="p-6 space-y-5">
          {sub.ai_feedback && (
            <div className="bg-primary-light border border-violet-100 rounded-xl p-4">
              <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-1">Overall Feedback</p>
              <p className="text-slate-700 text-sm leading-relaxed">{sub.ai_feedback}</p>
            </div>
          )}
          {sub.teacher_notes && (
            <div className="bg-primary-light border border-violet-100 rounded-xl p-4">
              <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-1">Teacher's Note</p>
              <p className="text-slate-700 text-sm leading-relaxed">{sub.teacher_notes}</p>
            </div>
          )}
          {analysis.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Question Breakdown</p>
              <div className="space-y-3">
                {analysis.map(q => {
                  const qPct = q.marks_available ? Math.round((q.marks_awarded / q.marks_available) * 100) : 0
                  return (
                    <div key={q.question_number} className={`border rounded-xl p-4 ${q.correct ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white ${q.correct ? 'bg-emerald-500' : 'bg-rose-500'}`}>Q{q.question_number}</span>
                          <span className={`text-sm font-semibold inline-flex items-center gap-1 ${q.correct ? 'text-emerald-700' : 'text-rose-700'}`}>
                            {q.correct ? <><CheckCircle2 className="w-3.5 h-3.5" strokeWidth={2} /> Correct</> : <><XCircle className="w-3.5 h-3.5" strokeWidth={2} /> Needs Improvement</>}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className={`text-lg font-black ${q.correct ? 'text-emerald-700' : 'text-rose-600'}`}>{q.marks_awarded}</span>
                          <span className="text-slate-400 text-sm">/{q.marks_available} marks</span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-slate-200 rounded-full mb-3">
                        <div className={`h-1.5 rounded-full ${q.correct ? 'bg-emerald-500' : 'bg-rose-400'}`} style={{ width: `${qPct}%` }} />
                      </div>
                      <p className="text-sm text-slate-600 leading-relaxed">{q.feedback}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          <button onClick={onClose} className="w-full bg-primary hover:bg-primary-dark text-white font-semibold py-3 rounded-xl transition">Close</button>
        </div>
      </div>
    </div>
  )
}

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good Morning'
  if (h < 18) return 'Good Afternoon'
  return 'Good Evening'
}

export default function GradesFeedback() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [quizzes, setQuizzes] = useState([])
  const [quizAttempts, setQuizAttempts] = useState([])
  const [assignments, setAssignments] = useState([])
  const [assignSubs, setAssignSubs] = useState([])
  const [examSubs, setExamSubs] = useState([])
  const [loading, setLoading] = useState(true)
  const [detailsSub, setDetailsSub] = useState(null)
  const [detailsAssignment, setDetailsAssignment] = useState(null)

  useEffect(() => {
    Promise.all([
      api.get('/quizzes/'),
      api.get('/quizzes/my-attempts'),
      api.get('/assignments/'),
      api.get('/assignments/my-submissions'),
      api.get('/submissions/my')
    ]).then(([q, qa, a, as, es]) => {
      setQuizzes(q.data)
      setQuizAttempts(qa.data.filter(att => att.score != null))
      setAssignments(a.data)
      setAssignSubs(as.data.filter(sub => sub.status === 'graded'))
      setExamSubs(es.data.filter(sub => sub.status === 'graded'))
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingState label="Loading feedback..." />

  const hasNoData = quizAttempts.length === 0 && assignSubs.length === 0 && examSubs.length === 0

  // Real per-subject averages derived from actual graded work — no fabricated numbers.
  const bySubject = {}
  const addScore = (subject, score, total) => {
    if (score == null || !total) return
    const key = subject || 'General'
    if (!bySubject[key]) bySubject[key] = []
    bySubject[key].push((score / total) * 100)
  }
  examSubs.forEach(s => addScore(s.exam_subject, s.final_score ?? s.ai_score, s.total_marks))
  assignSubs.forEach(s => {
    const a = assignments.find(x => x.id === s.assignment_id)
    addScore(a?.subject, s.final_score ?? s.ai_score, s.total_marks)
  })
  quizAttempts.forEach(att => {
    const quiz = quizzes.find(q => q.id === att.quiz_id)
    if (quiz?.subject && att.score != null) {
      if (!bySubject[quiz.subject]) bySubject[quiz.subject] = []
      bySubject[quiz.subject].push(att.score)
    }
  })
  const subjectAverages = Object.entries(bySubject)
    .map(([subject, scores]) => ({ subject, avg: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) }))
    .sort((a, b) => b.avg - a.avg)

  const overallAvg = subjectAverages.length
    ? Math.round(subjectAverages.reduce((sum, s) => sum + s.avg, 0) / subjectAverages.length)
    : null
  const weakest = subjectAverages[subjectAverages.length - 1]
  const strongest = subjectAverages[0]

  const insight = !hasNoData && weakest
    ? (weakest.avg < 70
        ? { text: `Your average in ${weakest.subject} is ${weakest.avg}% — your lowest right now. A focused study session could help bring it up.`, cta: 'Open Study Planner', to: '/student/planner' }
        : { text: `Strong work across the board — ${strongest.subject} is your best subject at ${strongest.avg}%. Keep up the consistency!`, cta: 'View Progress', to: '/student/progress' })
    : { text: 'Complete a graded exam, assignment, or quiz to start seeing personalized insights here.', cta: 'View Online Exams', to: '/student/online-exams' }

  return (
    <div>
      {detailsSub && (
        <AssignmentDetailsModal
          sub={detailsSub}
          assignment={detailsAssignment}
          onClose={() => { setDetailsSub(null); setDetailsAssignment(null) }}
        />
      )}

      <h1 className="text-2xl font-bold font-display text-slate-900">{greeting()}, {user?.name?.split(' ')[0]}!</h1>
      <p className="text-slate-500 text-sm mt-1 mb-8">
        {overallAvg != null ? `You're averaging ${overallAvg}% across your graded work.` : 'Your scores and AI feedback will appear here once work is graded.'}
      </p>

      {!hasNoData && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2 bg-white rounded-xl border border-violet-100 p-5 shadow-sm">
            <h3 className="font-bold text-slate-900 mb-1 font-display">Subject Progress</h3>
            <p className="text-xs text-slate-400 mb-4">Average score by subject, based on your graded work</p>
            <div className="space-y-3">
              {subjectAverages.map((s) => (
                <div key={s.subject}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-slate-700">{s.subject}</span>
                    <span className="text-slate-500">{s.avg}%</span>
                  </div>
                  <div className="h-2 bg-primary-light rounded-full overflow-hidden">
                    <div className="h-2 bg-primary rounded-full transition-all" style={{ width: `${s.avg}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

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
      )}

      {hasNoData ? (
        <div className="bg-white rounded-xl border border-slate-200 p-16 flex flex-col items-center justify-center shadow-sm">
          <ClipboardList className="w-14 h-14 mb-4 text-slate-200" strokeWidth={1.5} />
          <h2 className="text-xl font-bold text-slate-800">No Graded Items Yet</h2>
          <p className="text-slate-500 mt-2">Your graded exams, quizzes and assignments will appear here once they are evaluated.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Graded Exams */}
          {examSubs.length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-2 h-6 bg-primary rounded-full" />
                <h2 className="text-xl font-bold text-slate-800">Graded Exams</h2>
                <div className="flex-1 h-px bg-slate-200" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {examSubs.map(sub => {
                  const score = sub.final_score ?? sub.ai_score
                  const pct = score != null && sub.total_marks ? Math.round((score / sub.total_marks) * 100) : 0
                  return (
                    <div key={`exam-${sub.id}`} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <FileText className="w-[18px] h-[18px] text-violet-500" strokeWidth={2} />
                            <h3 className="font-bold text-slate-900">{sub.exam_title || 'Exam'}</h3>
                          </div>
                          <span className="text-xs px-2 py-0.5 bg-violet-100 text-primary-dark rounded-full">{sub.exam_subject || 'Subject'}</span>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-black text-primary">{score}<span className="text-sm text-slate-400">/{sub.total_marks}</span></p>
                          <p className="text-xs text-slate-500 font-medium">{pct}%</p>
                        </div>
                      </div>
                      <p className="text-sm text-slate-600 line-clamp-2 mb-4">{sub.ai_feedback || sub.teacher_notes || 'No detailed feedback.'}</p>
                      <button
                        onClick={() => {
                          setDetailsSub(sub)
                          setDetailsAssignment({ title: sub.exam_title, subject: sub.exam_subject, teacher_name: sub.teacher_name })
                        }}
                        className="w-full text-sm font-semibold text-primary bg-primary-light hover:bg-violet-100 py-2 rounded-lg transition"
                      >
                        View Report
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Graded Assignments */}
          {assignSubs.length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-2 h-6 bg-primary rounded-full" />
                <h2 className="text-xl font-bold text-slate-800">Graded Assignments</h2>
                <div className="flex-1 h-px bg-slate-200" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {assignSubs.map(sub => {
                  const assignment = assignments.find(a => a.id === sub.assignment_id)
                  const score = sub.final_score ?? sub.ai_score
                  const pct = score != null && sub.total_marks ? Math.round((score / sub.total_marks) * 100) : 0
                  return (
                    <div key={sub.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <ClipboardList className="w-[18px] h-[18px] text-violet-500" strokeWidth={2} />
                            <h3 className="font-bold text-slate-900">{assignment?.title || sub.assignment_title || 'Assignment'}</h3>
                          </div>
                          <span className="text-xs px-2 py-0.5 bg-violet-100 text-primary-dark rounded-full">{assignment?.subject || 'Subject'}</span>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-black text-primary">{score}<span className="text-sm text-slate-400">/{sub.total_marks}</span></p>
                          <p className="text-xs text-slate-500 font-medium">{pct}%</p>
                        </div>
                      </div>
                      <p className="text-sm text-slate-600 line-clamp-2 mb-4">{sub.ai_feedback || sub.teacher_notes || 'No detailed feedback.'}</p>
                      <button 
                        onClick={() => { setDetailsSub(sub); setDetailsAssignment(assignment) }}
                        className="w-full text-sm font-semibold text-primary bg-primary-light hover:bg-violet-100 py-2 rounded-lg transition"
                      >
                        View Detailed Feedback
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Graded Quizzes */}
          {quizAttempts.length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-4 mt-8">
                <div className="w-2 h-6 bg-emerald-500 rounded-full" />
                <h2 className="text-xl font-bold text-slate-800">Graded AI Quizzes</h2>
                <div className="flex-1 h-px bg-slate-200" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {quizAttempts.map(attempt => {
                  const quiz = quizzes.find(q => q.id === attempt.quiz_id)
                  return (
                    <div key={attempt.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Brain className="w-[18px] h-[18px] text-emerald-500" strokeWidth={2} />
                          <h3 className="font-bold text-slate-900">{quiz?.title || 'AI Quiz'}</h3>
                        </div>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-xs px-2 py-0.5 bg-violet-100 text-primary-dark rounded-full">{quiz?.subject || 'Practice'}</span>
                          <span className="text-xs text-slate-400">{new Date(attempt.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className="text-right bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-100">
                        <p className="text-xs text-emerald-600 font-bold uppercase tracking-wider mb-0.5">Score</p>
                        <p className="text-2xl font-black text-emerald-700">{attempt.score}%</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
