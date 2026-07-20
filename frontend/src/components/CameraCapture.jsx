import { useEffect, useRef, useState, useCallback } from 'react'
import { X, RotateCcw, CameraOff, Image as ImageIcon, CheckCircle2, Loader2, Clock, AlertTriangle } from 'lucide-react'
import jsPDF from 'jspdf'
import { useNotification } from '../context/NotificationContext'
import { getErrorMessage } from '../utils/getErrorMessage'
import useBrowserLock from '../hooks/useBrowserLock'
import SecurityViolationModal from './SecurityViolationModal'

// How long a student has, once they open the camera, to photograph their pages
// and submit — independent of the exam's own duration_minutes (that field is
// how long the physical paper exam itself lasted, a separate concept from how
// long digitizing/submitting the already-written answer sheet should take).
const CAPTURE_SESSION_MINUTES = 10

function formatTime(secs) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0')
  const s = (secs % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

export default function CameraCapture({ onSubmit, onClose, submitting }) {
  const { showToast } = useNotification()
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [facingMode, setFacingMode] = useState('environment') // environment=back, user=front
  const [photos, setPhotos] = useState([])
  const [preview, setPreview] = useState(false)
  const [flash, setFlash] = useState(false)
  const [dragIdx, setDragIdx] = useState(null)
  const [cameraReady, setCameraReady] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [timeLeft, setTimeLeft] = useState(CAPTURE_SESSION_MINUTES * 60)
  const [endReason, setEndReason] = useState(null) // null | 'violation' | 'timeout'
  const [sessionEnded, setSessionEnded] = useState(false) // time/violation hit with nothing captured
  const timerRef = useRef(null)
  const photosRef = useRef(photos)
  const autoEndedRef = useRef(false)
  // The camera permission prompt is native browser chrome that steals window
  // focus exactly like a real tab-switch would — suppress violation detection
  // until the prompt has actually been resolved (cameraReady or cameraError set).
  const pausedRef = useRef(true)
  photosRef.current = photos

  const startCamera = useCallback(async (mode) => {
    setCameraReady(false)
    setCameraError('')
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.onloadedmetadata = () => setCameraReady(true)
      }
    } catch (err) {
      setCameraError('Camera access denied or not available. Please allow camera permissions.')
    }
  }, [])

  useEffect(() => {
    startCamera(facingMode)
    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
    }
  }, [facingMode, startCamera])

  // Once the camera permission prompt has actually been resolved (granted or
  // denied), start watching for tab-switches/lost focus.
  useEffect(() => {
    if (cameraReady || cameraError) pausedRef.current = false
  }, [cameraReady, cameraError])

  const endSession = useCallback((reason) => {
    if (autoEndedRef.current) return
    autoEndedRef.current = true
    clearInterval(timerRef.current)
    setEndReason(reason)
    if (photosRef.current.length > 0) {
      // Photos already exist — submit what's there rather than discard captured
      // work, matching the app's existing "auto-submit whatever you have" policy
      // for online-exam tab-switch/timeout violations.
      buildPdfAndSubmit(reason === 'violation')
      if (reason === 'timeout') {
        showToast("Time's up — your captured pages have been submitted automatically.", 'info')
      }
    } else {
      setSessionEnded(true)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useBrowserLock(() => endSession('violation'), pausedRef)

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current)
          endSession('timeout')
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const capture = () => {
    if (!videoRef.current || !cameraReady) return
    const video = videoRef.current
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
    setPhotos(prev => [...prev, { id: Date.now(), dataUrl }])
    // Flash effect
    setFlash(true)
    setTimeout(() => setFlash(false), 150)
  }

  const deletePhoto = (id) => setPhotos(prev => prev.filter(p => p.id !== id))

  // Drag to reorder
  const onDragStart = (idx) => setDragIdx(idx)
  const onDragOver = (e, idx) => {
    e.preventDefault()
    if (dragIdx === null || dragIdx === idx) return
    setPhotos(prev => {
      const arr = [...prev]
      const [moved] = arr.splice(dragIdx, 1)
      arr.splice(idx, 0, moved)
      setDragIdx(idx)
      return arr
    })
  }
  const onDragEnd = () => setDragIdx(null)

  const buildPdfAndSubmit = async (isViolation = false) => {
    // Reads photosRef, not the closed-over `photos` state — endSession (memoized
    // once at mount so the timer/tab-lock callbacks always call the same function
    // identity) would otherwise call back into this render's stale `photos`
    // closure instead of whatever has actually been captured since.
    const currentPhotos = photosRef.current
    if (currentPhotos.length === 0) return
    try {
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const pageW = pdf.internal.pageSize.getWidth()
      const pageH = pdf.internal.pageSize.getHeight()

      for (let i = 0; i < currentPhotos.length; i++) {
        if (i > 0) pdf.addPage()
        const img = new Image()
        img.src = currentPhotos[i].dataUrl
        await new Promise((res, rej) => {
          img.onload = res
          img.onerror = () => rej(new Error('Failed to load captured photo'))
        })
        // Fit image to A4 preserving aspect ratio
        const ratio = Math.min(pageW / img.width, pageH / img.height)
        const w = img.width * ratio
        const h = img.height * ratio
        const x = (pageW - w) / 2
        const y = (pageH - h) / 2
        pdf.addImage(currentPhotos[i].dataUrl, 'JPEG', x, y, w, h)
      }

      const blob = pdf.output('blob')
      const file = new File([blob], `camera_submission_${Date.now()}.pdf`, { type: 'application/pdf' })
      onSubmit(file, isViolation)
    } catch (err) {
      console.error('buildPdfAndSubmit failed', err)
      showToast(getErrorMessage(err, 'Failed to build PDF — please retry'), 'error')
    }
  }

  if (sessionEnded) {
    const isViolation = endReason === 'violation'
    return (
      <div className="fixed inset-0 bg-slate-950 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden text-center px-8 py-10">
          <div className="w-16 h-16 mx-auto mb-5 bg-rose-100 rounded-full flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-rose-600" strokeWidth={2} />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-2">Capture Session Ended</h2>
          <p className="text-slate-500 text-sm leading-relaxed mb-8">
            {isViolation
              ? 'You switched tabs, lost focus, or exited full-screen mode. No pages had been captured yet, so nothing was submitted — this attempt has been logged.'
              : `Your ${CAPTURE_SESSION_MINUTES}-minute capture window ran out before you photographed any pages, so nothing was submitted.`}
            {' '}You can start again from the exam page.
          </p>
          <button onClick={onClose} className="w-full bg-primary hover:bg-primary-dark text-white font-semibold py-3 rounded-xl transition">Close</button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/80 z-10">
        <button onClick={onClose} className="text-white text-sm flex items-center gap-1.5 hover:text-slate-300">
          <X className="w-4 h-4" strokeWidth={2} /> Cancel
        </button>
        <span className="text-white font-semibold text-sm">
          {preview ? 'Preview Photos' : `Camera  ${photos.length > 0 ? `· ${photos.length} photo${photos.length > 1 ? 's' : ''}` : ''}`}
        </span>
        <div className="flex items-center gap-3">
          <span className={`px-2.5 py-1 rounded-lg font-mono font-bold text-xs flex items-center gap-1.5 ${timeLeft <= 120 ? 'bg-rose-600 text-white animate-pulse' : 'bg-slate-700 text-emerald-400'}`}>
            <Clock className="w-3.5 h-3.5" strokeWidth={2} /> {formatTime(timeLeft)}
          </span>
          <button
            onClick={() => setFacingMode(m => m === 'environment' ? 'user' : 'environment')}
            className="text-white text-sm hover:text-slate-300 flex items-center gap-1"
            title="Switch camera"
          >
            <RotateCcw className="w-4 h-4" strokeWidth={2} /> Flip
          </button>
        </div>
      </div>

      {!preview ? (
        <>
          {/* Camera view */}
          <div className="flex-1 relative flex items-center justify-center bg-black overflow-hidden">
            {flash && <div className="absolute inset-0 bg-white z-20 pointer-events-none" />}
            {cameraError ? (
              <div className="text-center text-white px-8">
                <CameraOff className="w-12 h-12 mx-auto mb-4 text-slate-500" strokeWidth={1.5} />
                <p className="text-rose-400 text-sm">{cameraError}</p>
              </div>
            ) : (
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-contain" />
            )}
            {/* Grid overlay */}
            {cameraReady && (
              <div className="absolute inset-0 pointer-events-none" style={{
                backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
                backgroundSize: '33.33% 33.33%'
              }} />
            )}
          </div>

          {/* Controls */}
          <div className="bg-black px-4 pb-6 pt-3">
            {/* Thumbnails strip */}
            {photos.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-3 mb-3 scrollbar-hide">
                {photos.map((p, i) => (
                  <div key={p.id} draggable onDragStart={() => onDragStart(i)} onDragOver={e => onDragOver(e, i)} onDragEnd={onDragEnd}
                    className={`relative flex-shrink-0 cursor-grab ${dragIdx === i ? 'opacity-50' : ''}`}>
                    <img src={p.dataUrl} alt={`Page ${i + 1}`} className="w-14 h-18 object-cover rounded-lg border-2 border-white/30" style={{ height: '4.5rem' }} />
                    <span className="absolute top-0.5 left-0.5 bg-black/60 text-white text-xs rounded px-1 font-bold">{i + 1}</span>
                    <button onClick={() => deletePhoto(p.id)}
                      className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white w-5 h-5 rounded-full flex items-center justify-center hover:bg-rose-600">
                      <X className="w-3 h-3" strokeWidth={2.5} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Action row */}
            <div className="flex items-center justify-between">
              {/* Preview btn */}
              <button onClick={() => photos.length > 0 && setPreview(true)}
                disabled={photos.length === 0}
                className="text-white text-sm disabled:opacity-30 flex flex-col items-center gap-1">
                <ImageIcon className="w-6 h-6" strokeWidth={1.5} />
                <span className="text-xs">Preview</span>
              </button>

              {/* Capture btn */}
              <button onClick={capture} disabled={!cameraReady}
                className="w-18 h-18 bg-white rounded-full border-4 border-slate-300 disabled:opacity-40 hover:scale-95 active:scale-90 transition-transform flex items-center justify-center shadow-lg"
                style={{ width: '4.5rem', height: '4.5rem' }}>
                <div className="w-14 h-14 bg-white rounded-full border-2 border-slate-400" style={{ width: '3.5rem', height: '3.5rem' }} />
              </button>

              {/* Submit btn */}
              <button onClick={() => buildPdfAndSubmit()}
                disabled={photos.length === 0 || submitting}
                className="text-white text-sm disabled:opacity-30 flex flex-col items-center gap-1">
                {submitting ? <Loader2 className="w-6 h-6 animate-spin" strokeWidth={2} /> : <CheckCircle2 className="w-6 h-6" strokeWidth={1.5} />}
                <span className="text-xs">{submitting ? 'Submitting' : 'Submit'}</span>
              </button>
            </div>

            <p className="text-slate-500 text-xs text-center mt-3">
              Tap the circle to capture • Drag thumbnails to reorder • Tap the X to delete
            </p>
          </div>
        </>
      ) : (
        /* ── Preview screen ── */
        <div className="flex-1 flex flex-col bg-slate-900 overflow-hidden">
          <p className="text-slate-400 text-xs text-center py-2">
            Drag to reorder • Tap the X to delete a page
          </p>
          <div className="flex-1 overflow-y-auto px-4 py-2 space-y-4">
            {photos.map((p, i) => (
              <div key={p.id} draggable onDragStart={() => onDragStart(i)} onDragOver={e => onDragOver(e, i)} onDragEnd={onDragEnd}
                className={`relative rounded-xl overflow-hidden border-2 ${dragIdx === i ? 'border-violet-400 opacity-60' : 'border-slate-700'} cursor-grab`}>
                <div className="absolute top-2 left-2 bg-black/70 text-white text-xs font-bold px-2 py-0.5 rounded-full z-10">
                  Page {i + 1}
                </div>
                <button onClick={() => deletePhoto(p.id)}
                  className="absolute top-2 right-2 bg-rose-500 hover:bg-rose-600 text-white w-7 h-7 rounded-full flex items-center justify-center z-10">
                  <X className="w-4 h-4" strokeWidth={2.5} />
                </button>
                <img src={p.dataUrl} alt={`Page ${i + 1}`} className="w-full object-contain max-h-[60vh]" />
              </div>
            ))}
          </div>

          {/* Preview action bar */}
          <div className="bg-black px-4 py-4 flex gap-3">
            <button onClick={() => setPreview(false)}
              className="flex-1 border border-slate-600 text-white font-semibold py-3 rounded-xl hover:bg-slate-800">
              ← Back to Camera
            </button>
            <button onClick={() => buildPdfAndSubmit()} disabled={submitting}
              className="flex-1 bg-primary hover:bg-primary-dark disabled:opacity-50 text-white font-semibold py-3 rounded-xl">
              {submitting ? 'Creating PDF...' : `Submit ${photos.length} Page${photos.length > 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      )}

      {endReason === 'violation' && (
        <SecurityViolationModal
          onClose={() => setEndReason(null)}
          line1="You switched tabs, lost focus, or exited full-screen mode while capturing your answer sheet."
          line2="Your already-captured pages have been automatically submitted to prevent academic dishonesty."
          footerWarning="Any attempt to cheat while submitting a physical exam answer sheet is a serious academic violation and may result in disciplinary action."
        />
      )}
    </div>
  )
}
