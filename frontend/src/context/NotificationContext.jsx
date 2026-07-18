import { createContext, useContext, useState, useCallback, useRef } from 'react'
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react'

const NotificationContext = createContext(null)

let idCounter = 0

const TOAST_STYLES = {
  success: { icon: CheckCircle2, accent: 'border-l-emerald-500', iconBg: 'bg-emerald-50 text-emerald-600' },
  error:   { icon: AlertTriangle, accent: 'border-l-rose-500', iconBg: 'bg-rose-50 text-rose-600' },
  info:    { icon: Info, accent: 'border-l-sky-500', iconBg: 'bg-sky-50 text-sky-600' },
}

function Toast({ toast, onDismiss }) {
  const style = TOAST_STYLES[toast.type] || TOAST_STYLES.info
  const ToastIcon = style.icon
  return (
    <div
      className={`toast-enter pointer-events-auto w-full max-w-sm bg-white rounded-xl shadow-lg border border-slate-200 border-l-4 ${style.accent} px-4 py-3 flex items-start gap-3`}
    >
      <span className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${style.iconBg}`}><ToastIcon className="w-4 h-4" strokeWidth={2} /></span>
      <p className="text-sm text-slate-700 leading-snug flex-1 pt-0.5">{toast.message}</p>
      <button onClick={() => onDismiss(toast.id)} className="text-slate-300 hover:text-slate-500 flex-shrink-0"><X className="w-4 h-4" strokeWidth={2} /></button>
    </div>
  )
}

export function NotificationProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const [confirmState, setConfirmState] = useState(null)
  const timers = useRef({})

  const dismissToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
    clearTimeout(timers.current[id])
    delete timers.current[id]
  }, [])

  const showToast = useCallback((message, type = 'info', duration = 4500) => {
    const id = ++idCounter
    setToasts(prev => [...prev, { id, message, type }])
    timers.current[id] = setTimeout(() => dismissToast(id), duration)
  }, [dismissToast])

  const showConfirm = useCallback((message, opts = {}) => {
    return new Promise((resolve) => {
      setConfirmState({ message, opts, resolve })
    })
  }, [])

  const resolveConfirm = (result) => {
    confirmState?.resolve(result)
    setConfirmState(null)
  }

  return (
    <NotificationContext.Provider value={{ showToast, showConfirm }}>
      {children}

      {/* Toast stack */}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-full max-w-sm pointer-events-none">
        {toasts.map(t => <Toast key={t.id} toast={t} onDismiss={dismissToast} />)}
      </div>

      {/* Confirm modal */}
      {confirmState && (
        <div className="fixed inset-0 bg-black/50 z-[110] flex items-center justify-center p-4" onClick={() => resolveConfirm(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-slate-900 text-lg mb-2">{confirmState.opts.title || 'Please confirm'}</h3>
            <p className="text-sm text-slate-600 leading-relaxed mb-6">{confirmState.message}</p>
            <div className="flex gap-3">
              <button onClick={() => resolveConfirm(false)}
                className="flex-1 border border-slate-300 text-slate-600 font-semibold py-2.5 rounded-xl text-sm hover:bg-slate-50">
                {confirmState.opts.cancelLabel || 'Cancel'}
              </button>
              <button onClick={() => resolveConfirm(true)}
                className="flex-1 bg-primary hover:bg-primary-dark text-white font-semibold py-2.5 rounded-xl text-sm">
                {confirmState.opts.confirmLabel || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </NotificationContext.Provider>
  )
}

export function useNotification() {
  const ctx = useContext(NotificationContext)
  if (!ctx) throw new Error('useNotification must be used within NotificationProvider')
  return ctx
}
