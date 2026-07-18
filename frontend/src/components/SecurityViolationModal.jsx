import { AlertTriangle } from 'lucide-react'

export default function SecurityViolationModal({ onClose }) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-500 to-rose-600 px-6 py-5 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-5 h-5" strokeWidth={2} />
            </div>
            <div>
              <h2 className="text-lg font-bold">Security Violation Detected</h2>
              <p className="text-red-100 text-xs mt-0.5">Exam integrity monitoring</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-6">
          <p className="text-slate-700 font-medium text-sm leading-relaxed mb-2">
            You switched tabs or exited full-screen mode during the exam.
          </p>
          <p className="text-slate-500 text-sm leading-relaxed">
            This activity has been logged and your exam has been <span className="font-semibold text-rose-600">automatically submitted</span> to prevent academic dishonesty.
          </p>

          <div className="mt-5 bg-rose-50 border border-rose-100 rounded-xl p-4">
            <p className="text-xs text-rose-700 font-medium flex items-start gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" strokeWidth={2} /> Any attempt to cheat during an online examination is a serious academic violation and may result in disciplinary action.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6">
          <button
            onClick={onClose}
            className="w-full bg-primary hover:bg-primary-dark text-white font-semibold py-3 rounded-xl transition text-sm"
          >
            I understand
          </button>
        </div>
      </div>
    </div>
  )
}
