import { useEffect, useRef, useState, useCallback } from 'react'
import { X, RotateCcw, CameraOff, Image, CheckCircle2, Loader2 } from 'lucide-react'
import jsPDF from 'jspdf'

export default function CameraCapture({ onSubmit, onClose, submitting }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [facingMode, setFacingMode] = useState('environment') // environment=back, user=front
  const [photos, setPhotos] = useState([])
  const [preview, setPreview] = useState(false)
  const [flash, setFlash] = useState(false)
  const [dragIdx, setDragIdx] = useState(null)
  const [cameraReady, setCameraReady] = useState(false)
  const [cameraError, setCameraError] = useState('')

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

  const buildPdfAndSubmit = async () => {
    if (photos.length === 0) return
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pageW = pdf.internal.pageSize.getWidth()
    const pageH = pdf.internal.pageSize.getHeight()

    for (let i = 0; i < photos.length; i++) {
      if (i > 0) pdf.addPage()
      const img = new Image()
      img.src = photos[i].dataUrl
      await new Promise(res => { img.onload = res })
      // Fit image to A4 preserving aspect ratio
      const ratio = Math.min(pageW / img.width, pageH / img.height)
      const w = img.width * ratio
      const h = img.height * ratio
      const x = (pageW - w) / 2
      const y = (pageH - h) / 2
      pdf.addImage(photos[i].dataUrl, 'JPEG', x, y, w, h)
    }

    const blob = pdf.output('blob')
    const file = new File([blob], `camera_submission_${Date.now()}.pdf`, { type: 'application/pdf' })
    onSubmit(file)
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
        <button
          onClick={() => setFacingMode(m => m === 'environment' ? 'user' : 'environment')}
          className="text-white text-sm hover:text-slate-300 flex items-center gap-1"
          title="Switch camera"
        >
          <RotateCcw className="w-4 h-4" strokeWidth={2} /> Flip
        </button>
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
                <Image className="w-6 h-6" strokeWidth={1.5} />
                <span className="text-xs">Preview</span>
              </button>

              {/* Capture btn */}
              <button onClick={capture} disabled={!cameraReady}
                className="w-18 h-18 bg-white rounded-full border-4 border-slate-300 disabled:opacity-40 hover:scale-95 active:scale-90 transition-transform flex items-center justify-center shadow-lg"
                style={{ width: '4.5rem', height: '4.5rem' }}>
                <div className="w-14 h-14 bg-white rounded-full border-2 border-slate-400" style={{ width: '3.5rem', height: '3.5rem' }} />
              </button>

              {/* Submit btn */}
              <button onClick={buildPdfAndSubmit}
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
            <button onClick={buildPdfAndSubmit} disabled={submitting}
              className="flex-1 bg-primary hover:bg-primary-dark disabled:opacity-50 text-white font-semibold py-3 rounded-xl">
              {submitting ? 'Creating PDF...' : `Submit ${photos.length} Page${photos.length > 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
