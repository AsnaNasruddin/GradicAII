import { useEffect, useRef, useState } from 'react'
import { Smartphone, BookOpen, Users, User, ShieldCheck, AlertTriangle, CheckCircle2, Ban, RotateCcw } from 'lucide-react'

const RULES = [
  { icon: Smartphone, label: 'No mobile phones', desc: 'Holding or using a phone will trigger an immediate warning.' },
  { icon: BookOpen, label: 'No study materials', desc: 'Books, notes, or printed materials are not allowed.' },
  { icon: Users, label: 'One person only', desc: 'Another person appearing on camera will be flagged.' },
  { icon: User, label: 'Stay in frame', desc: 'Leaving the camera view will trigger a warning.' },
]

export default function ExamBriefing({ exam, onStart, onCancel }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [cameraOk, setCameraOk] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [agreed, setAgreed] = useState(false)
  const proctoringEnabled = exam.proctoring_enabled

  const requestCamera = () => {
    setCameraError('')
    setCameraOk(false)
    streamRef.current?.getTracks().forEach(t => t.stop())
    navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 }, audio: false })
      .then(stream => {
        streamRef.current = stream
        // if the camera is unplugged after the check, lock the exam again
        const track = stream.getVideoTracks()[0]
        if (track) track.onended = () => {
          setCameraOk(false)
          setCameraError('Camera was disconnected. Please reconnect it and retry.')
        }
        // videoRef may not be in DOM yet — wait a tick
        setTimeout(() => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream
            videoRef.current.onloadedmetadata = () => setCameraOk(true)
          }
        }, 50)
      })
      .catch(() => setCameraError(
        proctoringEnabled
          ? 'No working camera detected. A camera is required for this proctored exam.'
          : 'Camera access denied. Please allow camera access to continue.'
      ))
  }

  useEffect(() => {
    requestCamera()
    return () => streamRef.current?.getTracks().forEach(t => t.stop())
  }, [])

  const handleStart = () => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    onStart()
  }

  return (
    <div className="fixed inset-0 bg-slate-950/95 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">

        {/* Header */}
        <div className="bg-primary px-6 py-5 text-white">
          <h2 className="text-xl font-black">Before You Start</h2>
          <p className="text-violet-200 text-sm mt-1">{exam.title} · {exam.subject} · {exam.duration_minutes || 60} minutes</p>
        </div>

        <div className="p-6 space-y-5">

          {/* Proctoring rules */}
          {proctoringEnabled && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <ShieldCheck className="w-5 h-5 text-primary" strokeWidth={2} />
                <h3 className="font-bold text-slate-900 text-sm">AI Proctoring is Active</h3>
                <span className="bg-rose-100 text-rose-600 text-xs font-semibold px-2 py-0.5 rounded-full">Live Monitoring</span>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
                <p className="text-amber-800 text-sm font-semibold mb-2 flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" strokeWidth={2} /> Termination Policy</p>
                <div className="flex items-center gap-3">
                  {['Warning 1', 'Warning 2', 'Terminated'].map((label, i) => (
                    <div key={i} className="flex-1 text-center">
                      <div className={`w-8 h-8 rounded-full mx-auto mb-1 flex items-center justify-center text-xs font-black text-white ${
                        i === 0 ? 'bg-amber-400' : i === 1 ? 'bg-orange-500' : 'bg-rose-600'
                      }`}>{i + 1}</div>
                      <p className="text-xs text-slate-600">{label}</p>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-amber-700 mt-3 text-center">
                  3 violations = exam is terminated and teacher is notified
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {RULES.map((r, i) => (
                  <div key={i} className="flex items-start gap-2 bg-slate-50 rounded-xl p-3">
                    <r.icon className="w-5 h-5 flex-shrink-0 text-slate-500" strokeWidth={2} />
                    <div>
                      <p className="text-xs font-semibold text-slate-800">{r.label}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{r.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Camera preview — always shown */}
          <div>
            <p className="text-sm font-semibold text-slate-700 mb-2">Camera Check</p>
            <div className="bg-slate-900 rounded-xl overflow-hidden flex items-center justify-center" style={{ height: '160px' }}>
              {cameraError ? (
                <p className="text-rose-400 text-xs text-center px-4">{cameraError}</p>
              ) : (
                <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
              )}
            </div>
            {cameraOk && (
              <p className="text-xs text-emerald-600 mt-1.5 font-medium flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" strokeWidth={2} /> Camera ready — make sure your face is clearly visible</p>
            )}
            {!cameraOk && !cameraError && (
              <p className="text-xs text-slate-400 mt-1.5">Requesting camera access...</p>
            )}
            {cameraError && (
              <div className={`mt-2 rounded-xl p-3 border ${proctoringEnabled ? 'bg-rose-50 border-rose-200' : 'bg-amber-50 border-amber-200'}`}>
                {proctoringEnabled && (
                  <p className="text-xs font-semibold text-rose-700 mb-2 flex items-center gap-1.5">
                    <Ban className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={2} /> This exam uses AI proctoring — you cannot start it without a working camera.
                  </p>
                )}
                <button
                  onClick={requestCamera}
                  className="bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold px-4 py-1.5 rounded-lg inline-flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" strokeWidth={2} /> Retry Camera
                </button>
              </div>
            )}
          </div>

          {/* General rules for non-proctored */}
          {!proctoringEnabled && (
            <div className="bg-slate-50 rounded-xl p-4 space-y-2">
              <p className="text-sm font-bold text-slate-800">Exam Rules</p>
              <ul className="text-sm text-slate-600 space-y-1">
                <li>• Answer all questions to the best of your ability</li>
                <li>• The timer starts immediately when you click Start</li>
                <li>• Your exam auto-submits when time runs out</li>
                <li>• You cannot pause or resume the exam</li>
              </ul>
            </div>
          )}

          {/* Acknowledgement */}
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-primary flex-shrink-0" />
            <span className="text-sm text-slate-700">
              I have read and understood the exam rules.
              {proctoringEnabled && ' I consent to camera monitoring for the duration of this exam.'}
            </span>
          </label>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button onClick={onCancel}
              className="border border-slate-300 text-slate-600 font-medium px-5 py-2.5 rounded-xl text-sm hover:bg-slate-50">
              Cancel
            </button>
            <button
              onClick={handleStart}
              disabled={!agreed || (proctoringEnabled ? !cameraOk : (!cameraOk && !cameraError))}
              className="flex-1 bg-primary hover:bg-primary-dark disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-2.5 rounded-xl text-sm transition">
              {cameraOk
                ? (proctoringEnabled ? 'Start Exam with Proctoring →' : 'Start Exam →')
                : cameraError
                  ? (proctoringEnabled ? <span className="inline-flex items-center gap-1.5"><Ban className="w-4 h-4" strokeWidth={2} /> Camera Required to Start</span> : 'Start Exam (no camera) →')
                  : 'Checking camera...'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
