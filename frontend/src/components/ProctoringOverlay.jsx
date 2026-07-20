import { useEffect, useRef, useState } from 'react'
import { Smartphone, BookOpen, Users, UserX, Shuffle, AlertTriangle } from 'lucide-react'

// VITE_PROCTORING_WS_URL is set at build time to the deployed proctoring
// service's WebSocket URL (must be wss:// once the frontend is served over
// HTTPS — browsers block plain ws:// from an https:// page as mixed content).
const WS_URL = import.meta.env.VITE_PROCTORING_WS_URL || 'ws://localhost:8001/ws'

function buildWsUrl(sessionKey, examId, studentId) {
  return `${WS_URL}/${sessionKey}?exam_id=${examId || 0}&student_id=${studentId || 0}`
}

const WARNING_MESSAGES = {
  phone:            { icon: Smartphone, title: 'Mobile Phone Detected' },
  book:             { icon: BookOpen, title: 'Study Material Detected' },
  multiple_persons: { icon: Users, title: 'Multiple People Detected' },
  face_absent:      { icon: UserX, title: 'Please Return to Camera' },
  tab_switch:       { icon: Shuffle, title: 'Tab Switch Detected' },
}

// sessionKey is a unique string generated when the exam opens (no submission needed)
export default function ProctoringOverlay({ sessionKey, examId, studentId, onTerminate }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const wsRef = useRef(null)
  const intervalRef = useRef(null)
  const canvasRef = useRef(document.createElement('canvas'))

  const [cameraReady, setCameraReady] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [warning, setWarning] = useState(null)
  const [warningCount, setWarningCount] = useState(0)
  const [wsConnected, setWsConnected] = useState(false)

  // Start camera immediately on mount
  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: false })
      .then(stream => {
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.onloadedmetadata = () => setCameraReady(true)
        }
      })
      .catch(() => setCameraError('Camera access denied. Proctoring requires camera.'))

    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [])

  // Connect WebSocket immediately using sessionKey (not submission ID)
  useEffect(() => {
    if (!sessionKey) return
    const connect = () => {
      const ws = new WebSocket(buildWsUrl(sessionKey, examId, studentId))
      wsRef.current = ws

      ws.onopen = () => { setWsConnected(true) }
      ws.onclose = () => { setWsConnected(false) }
      ws.onerror = (e) => { setWsConnected(false); console.error('[Proctoring] WS error', e) }

      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data)
          if (data.type === 'warning') {
            setWarningCount(data.warning_level)
            setWarning({
              violation: data.violation,
              level: data.warning_level,
              message: data.message,
              remaining: data.warnings_remaining,
            })
            setTimeout(() => setWarning(w => (w?.level === data.warning_level ? null : w)), 8000)
          } else if (data.type === 'terminate') {
            setWarningCount(3)
            setWarning({ violation: 'terminated', level: 3, message: data.message, remaining: 0 })
            setTimeout(() => onTerminate(), 3000)
          }
        } catch (err) {
          console.error('[Proctoring] Failed to parse WS message', err, e?.data)
        }
      }
    }
    connect()
    return () => wsRef.current?.close()
  }, [sessionKey])

  // Send frames every 1.5 seconds once camera + WS are both ready
  useEffect(() => {
    if (!cameraReady || !wsConnected) return

    intervalRef.current = setInterval(() => {
      if (!videoRef.current || wsRef.current?.readyState !== WebSocket.OPEN) return
      const video = videoRef.current
      const canvas = canvasRef.current
      canvas.width = 320
      canvas.height = 240
      canvas.getContext('2d').drawImage(video, 0, 0, 320, 240)
      const b64 = canvas.toDataURL('image/jpeg', 0.6)
      wsRef.current.send(JSON.stringify({ type: 'frame', frame: b64 }))
    }, 1500)

    return () => clearInterval(intervalRef.current)
  }, [cameraReady, wsConnected])

  // Tab switch / window blur detection
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'tab_switch' }))
      }
    }
    const handleBlur = () => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'tab_switch' }))
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('blur', handleBlur)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('blur', handleBlur)
    }
  }, [])

  const warningColors = ['', 'border-amber-400', 'border-orange-500', 'border-red-600']
  const dotColors = ['bg-slate-300', 'bg-amber-400', 'bg-orange-500', 'bg-red-600']

  return (
    // Anchored below the header (not bottom-right) — the exam-taking screens put their
    // Submit button and file-upload widget in the bottom-right area, and a fixed-position
    // overlay always paints above that normal-flow content regardless of z-index, so a
    // bottom-right camera widget was silently covering the Submit button.
    <div className={`fixed top-20 right-4 z-40 flex flex-col items-end gap-2`}>
      {/* Warning banner */}
      {warning && (
        <div className={`max-w-xs rounded-xl shadow-2xl border-2 overflow-hidden ${
          warning.level === 3 ? 'border-red-600' :
          warning.level === 2 ? 'border-orange-500' : 'border-amber-400'
        }`}>
          <div className={`px-4 py-3 ${
            warning.level === 3 ? 'bg-red-600' :
            warning.level === 2 ? 'bg-orange-500' : 'bg-amber-500'
          } text-white`}>
            <div className="flex items-center gap-2 mb-1">
              {(() => {
                const WarnIcon = WARNING_MESSAGES[warning.violation]?.icon || AlertTriangle
                return <WarnIcon className="w-4 h-4 flex-shrink-0" strokeWidth={2} />
              })()}
              <span className="font-bold text-sm flex items-center gap-1.5">
                {warning.level === 3 ? <><AlertTriangle className="w-4 h-4" strokeWidth={2} /> EXAM TERMINATED</> :
                 `Warning ${warning.level} of 3`}
              </span>
            </div>
            <p className="text-xs leading-relaxed opacity-90">{warning.message}</p>
            {warning.remaining > 0 && (
              <p className="text-xs mt-1 font-semibold opacity-80">
                {warning.remaining} warning{warning.remaining !== 1 ? 's' : ''} remaining before termination
              </p>
            )}
          </div>
        </div>
      )}

      {/* Camera feed + status */}
      <div className={`bg-slate-900 rounded-xl overflow-hidden border-2 shadow-xl ${warningColors[warningCount] || 'border-slate-700'}`}
        style={{ width: '160px' }}>
        <div className="relative">
          {cameraError ? (
            <div className="w-full bg-slate-800 flex items-center justify-center text-center p-3" style={{ height: '90px' }}>
              <p className="text-rose-400 text-xs">{cameraError}</p>
            </div>
          ) : (
            <video ref={videoRef} autoPlay playsInline muted
              className="w-full object-cover" style={{ height: '90px' }} />
          )}
          {/* Warning count dots */}
          <div className="absolute top-1.5 right-1.5 flex gap-1">
            {[1, 2, 3].map(i => (
              <div key={i} className={`w-2.5 h-2.5 rounded-full ${i <= warningCount ? dotColors[i] : 'bg-slate-600'}`} />
            ))}
          </div>
        </div>
        <div className="px-2 py-1.5 flex items-center justify-between">
          <span className="text-slate-400 text-xs">AI Proctoring</span>
          <div className={`w-1.5 h-1.5 rounded-full ${wsConnected ? 'bg-emerald-400' : 'bg-rose-500'}`} />
        </div>
      </div>
    </div>
  )
}
