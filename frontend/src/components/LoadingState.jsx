import { Loader2 } from 'lucide-react'

export default function LoadingState({ label = 'Loading...' }) {
  return (
    <div className="flex items-center gap-2 text-slate-400 py-6">
      <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} />
      <span>{label}</span>
    </div>
  )
}

LoadingState.Row = function LoadingStateRow({ colSpan, label = 'Loading...' }) {
  return (
    <tr>
      <td colSpan={colSpan} className="text-center py-8 text-slate-400">
        <span className="inline-flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} />
          {label}
        </span>
      </td>
    </tr>
  )
}
