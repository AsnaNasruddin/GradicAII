import { useEffect, useRef, useState } from 'react'
import { X, AlertTriangle, FileText, ExternalLink, ClipboardList, Paperclip, Pencil, Upload, Clock } from 'lucide-react'
import useBrowserLock from '../hooks/useBrowserLock'
import SecurityViolationModal from './SecurityViolationModal'
import ProctoringOverlay from './ProctoringOverlay'
import { useAuth } from '../context/AuthContext'
import { useNotification } from '../context/NotificationContext'
import api from '../api/axios'

const API_BASE = api.defaults.baseURL

function formatTime(secs) {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60).toString().padStart(2, '0')
  const s = (secs % 60).toString().padStart(2, '0')
  return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`
}

export default function OnlineExam({ exam, onClose, onSubmit, submitting, forceMode }) {
  const { user } = useAuth()
  const { showToast, showConfirm: confirmDialog } = useNotification()
  // forceMode is set by the caller when the exam's submission_format is 'both'
  // ("Either") — the student explicitly chose typed or upload, so that choice
  // wins over the exam's own format (which alone can't tell typed from upload).
  const isUploadMode = forceMode ? forceMode === 'upload' : exam.submission_format === 'upload'
  const totalSecs = (exam.duration_minutes || 60) * 60
  const [timeLeft, setTimeLeft] = useState(totalSecs)
  const [answers, setAnswers] = useState('')
  const [uploadFile, setUploadFile] = useState(null)
  const [autoSubmitted, setAutoSubmitted] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [warned, setWarned] = useState(false)
  const [showSecurityModal, setShowSecurityModal] = useState(false)
  const [showFiveMinWarning, setShowFiveMinWarning] = useState(false)
  const [terminated, setTerminated] = useState(false)
  const timerRef = useRef(null)
  const answersRef = useRef(answers)
  const uploadFileRef = useRef(uploadFile)
  const autoSubmittedRef = useRef(false)
  const fileDialogOpenRef = useRef(false)
  const proctoringKey = useRef(`proctor_${exam.id}_${Date.now()}`)
  answersRef.current = answers
  uploadFileRef.current = uploadFile

  // Opening the native file-picker dialog steals window focus exactly like a
  // real tab-switch would — pause violation detection while it's open so
  // uploading an answer sheet doesn't get treated as cheating.
  useEffect(() => {
    const clearFileDialogFlag = () => { fileDialogOpenRef.current = false }
    window.addEventListener('focus', clearFileDialogFlag)
    return () => window.removeEventListener('focus', clearFileDialogFlag)
  }, [])

  useBrowserLock(() => {
    if (!autoSubmittedRef.current) {
      autoSubmittedRef.current = true
      setAutoSubmitted(true)
      setShowSecurityModal(true)
      clearInterval(timerRef.current)
      if (isUploadMode) {
        if (uploadFileRef.current) onSubmit(uploadFileRef.current, true)
      } else {
        onSubmit(answersRef.current || '(No answer submitted — cheating violation)', true)
      }
    }
  }, fileDialogOpenRef)

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current)
          if (!autoSubmittedRef.current) {
            autoSubmittedRef.current = true
            setAutoSubmitted(true)
            if (isUploadMode) {
              if (uploadFileRef.current) onSubmit(uploadFileRef.current)
            } else {
              onSubmit(answersRef.current || '(No answer submitted — time expired)')
            }
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [])

  useEffect(() => {
    if (timeLeft === 300 && !warned) {
      setWarned(true)
      setShowFiveMinWarning(true)
    }
  }, [timeLeft, warned])

  const isLow = timeLeft <= 300
  const pdfUrl = exam.question_paper_url ? `${API_BASE}${exam.question_paper_url}` : null

  if (terminated) return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden text-center px-8 py-10">
        <div className="w-16 h-16 mx-auto mb-5 bg-rose-100 rounded-full flex items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-rose-600" strokeWidth={2} />
        </div>
        <h2 className="text-2xl font-bold font-display text-slate-900 mb-3">Exam Terminated</h2>
        <p className="text-slate-600 text-sm leading-relaxed mb-8">3 violations were recorded. Your teacher has been notified.</p>
        <button onClick={onClose} className="w-full bg-primary hover:bg-primary-dark text-white font-semibold px-8 py-3 rounded-xl transition">Return to Dashboard</button>
      </div>
    </div>
  )

  const handleSubmit = async () => {
    if (isUploadMode) {
      if (!uploadFile) {
        showToast('Please select a file to upload.', 'error')
        return
      }
      clearInterval(timerRef.current)
      onSubmit(uploadFile)
      return
    }
    if (!answers.trim()) {
      const proceed = await confirmDialog('Your answer is empty. Submit anyway?', {
        title: 'Empty answer',
        confirmLabel: 'Submit Anyway',
        cancelLabel: 'Keep Writing',
      })
      if (!proceed) return
    }
    clearInterval(timerRef.current)
    onSubmit(answers)
  }

  return (
    <div className="fixed inset-0 bg-slate-950 z-50 flex flex-col">
      {/* Header bar */}
      <div className="flex items-center justify-between px-5 py-3 bg-slate-900 border-b border-slate-700 flex-shrink-0">
        <button
          onClick={() => setShowConfirm(true)}
          className="text-slate-400 hover:text-white text-sm flex items-center gap-1.5 transition"
        >
          <X className="w-4 h-4" strokeWidth={2} /> Exit
        </button>
        <div className="text-center">
          <p className="text-white font-bold font-display text-sm leading-tight">{exam.title}</p>
          <p className="text-slate-400 text-xs">{exam.subject} · {exam.total_marks} marks</p>
        </div>
        <div className={`px-4 py-1.5 rounded-xl font-mono font-black text-lg ${isLow ? 'bg-amber-600 text-white animate-pulse' : 'bg-slate-700 text-emerald-400'}`}>
          {formatTime(timeLeft)}
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-col md:flex-row flex-1 overflow-y-auto md:overflow-hidden">
        {/* Left: Question paper viewer */}
        <div className="w-full md:w-1/2 flex flex-col md:border-r border-b md:border-b-0 border-slate-700 bg-slate-900 h-[45vh] md:h-auto flex-shrink-0 md:flex-shrink">
          <div className="flex items-center justify-between px-4 py-2 border-b border-slate-700">
            <p className="text-slate-300 text-xs font-semibold uppercase tracking-wide flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" strokeWidth={2} /> Question Paper</p>
            {pdfUrl && (
              <a href={pdfUrl} target="_blank" rel="noreferrer"
                className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1">
                <ExternalLink className="w-3.5 h-3.5" strokeWidth={2} /> Open in new tab
              </a>
            )}
          </div>
          <div className="flex-1 overflow-hidden">
            {pdfUrl ? (
              <iframe
                src={pdfUrl}
                title="Question Paper"
                className="w-full h-full border-0"
                style={{ background: '#fff' }}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center px-6">
                <ClipboardList className="w-12 h-12 mb-4 text-slate-600" strokeWidth={1.5} />
                <p className="text-slate-400 text-sm font-medium">No question paper uploaded</p>
                {exam.description && (
                  <p className="text-slate-500 text-sm mt-3 leading-relaxed">{exam.description}</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: Answer area */}
        <div className="w-full md:w-1/2 flex flex-col bg-slate-950">
          <div className="px-4 py-2 border-b border-slate-700">
            <p className="text-slate-300 text-xs font-semibold uppercase tracking-wide flex items-center gap-1.5">
              {isUploadMode ? <><Paperclip className="w-3.5 h-3.5" strokeWidth={2} /> Upload Your Answer Sheet</> : <><Pencil className="w-3.5 h-3.5" strokeWidth={2} /> Your Answers</>}
            </p>
            <p className="text-slate-500 text-xs mt-0.5">
              {isUploadMode
                ? 'Write your answers on paper, then upload a single PDF below.'
                : 'Type your answers clearly. Label each question (e.g. Q1: ...)'}
            </p>
          </div>
          <div className="flex-1 p-4 flex flex-col">
            {isUploadMode ? (
              <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-700 rounded-xl p-8 text-center">
                <Upload className="w-12 h-12 mb-4 text-slate-600" strokeWidth={1.5} />
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  onClick={() => { fileDialogOpenRef.current = true }}
                  onChange={(e) => { fileDialogOpenRef.current = false; setUploadFile(e.target.files?.[0] || null) }}
                  className="text-sm text-slate-300 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-primary file:text-white file:text-sm hover:file:bg-primary-dark"
                />
                {uploadFile && <p className="text-slate-400 text-xs mt-3">Selected: {uploadFile.name}</p>}
              </div>
            ) : (
              <textarea
                value={answers}
                onChange={(e) => setAnswers(e.target.value)}
                placeholder={`Q1: (your answer here)\n\nQ2: (your answer here)\n\n...`}
                className="flex-1 w-full bg-slate-900 border border-slate-700 rounded-xl p-4 text-slate-100 text-sm leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-violet-500 placeholder-slate-600 font-mono"
              />
            )}
            <div className="mt-4 flex items-center justify-between">
              <p className="text-slate-500 text-xs">{isUploadMode ? (uploadFile ? '1 file selected' : 'No file selected') : `${answers.length} characters`}</p>
              <button
                onClick={handleSubmit}
                disabled={submitting || autoSubmitted}
                className="bg-primary hover:bg-primary-dark disabled:opacity-50 text-white font-bold px-8 py-3 rounded-xl text-sm transition shadow-lg"
              >
                {submitting ? 'Submitting...' : autoSubmitted ? 'Submitted' : 'Submit Exam'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Exit confirmation dialog */}
      {showConfirm && (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-10" onClick={() => setShowConfirm(false)}>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-white font-bold font-display text-lg mb-2">Exit Exam?</h3>
            <p className="text-slate-400 text-sm mb-5">
              If you exit, your progress will be lost and the exam will not be submitted. You will still be able to submit later before the deadline.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowConfirm(false)}
                className="flex-1 border border-slate-600 text-white font-semibold py-2.5 rounded-xl hover:bg-slate-800 text-sm">
                Keep Going
              </button>
              <button onClick={() => { clearInterval(timerRef.current); onClose() }}
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-semibold py-2.5 rounded-xl text-sm">
                Exit Anyway
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Security Violation Modal */}
      {showSecurityModal && (
        <SecurityViolationModal onClose={() => setShowSecurityModal(false)} />
      )}

      {/* AI Proctoring camera window */}
      {exam.proctoring_enabled && (
        <ProctoringOverlay
          sessionKey={proctoringKey.current}
          examId={exam.id}
          studentId={user?.id}
          onTerminate={() => { setTerminated(true); onClose() }}
        />
      )}

      {/* 5-minute warning modal */}
      {showFiveMinWarning && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-20 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
            <div className="bg-gradient-to-r from-amber-500 to-amber-600 px-6 py-4 text-white">
              <div className="flex items-center gap-3">
                <Clock className="w-6 h-6" strokeWidth={2} />
                <div>
                  <h3 className="font-bold font-display text-lg">Time Warning</h3>
                  <p className="text-amber-100 text-xs">5 minutes remaining</p>
                </div>
              </div>
            </div>
            <div className="px-6 py-5">
              <p className="text-slate-700 text-sm leading-relaxed">
                You have <span className="font-bold text-amber-600">5 minutes</span> left to complete and submit your exam. Please review your answers and submit before time runs out.
              </p>
              <button
                onClick={() => setShowFiveMinWarning(false)}
                className="mt-4 w-full bg-primary hover:bg-primary-dark text-white font-semibold py-2.5 rounded-xl text-sm transition"
              >
                Got it, keep going!
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
