import { useId } from 'react'

// GradicAI's brand mark — a geometric "G" monogram over a subtle indigo→violet
// gradient. Mirrors public/favicon.svg; kept as one component so every
// badge/nav/footer instance stays visually identical instead of drifting via
// copy-pasted markup. useId keeps the gradient's id unique per instance —
// plain "id=" duplicates across multiple Logos on one page.
export default function Logo({ className = 'w-9 h-9' }) {
  const gradientId = useId()
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="32" y2="32">
          <stop offset="0" stopColor="#6D28D9" />
          <stop offset="1" stopColor="#4C1D95" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="7" fill={`url(#${gradientId})`} />
      <path d="M21.9 9.5 A8.6 8.6 0 1 0 21.9 22.5" fill="none" stroke="#ffffff" strokeWidth="3.8" strokeLinecap="round" />
      <path d="M23.6 16.3 L16.8 16.3" fill="none" stroke="#ffffff" strokeWidth="3.8" strokeLinecap="round" />
      <path d="M16.8 16.3 L16.8 20.2" fill="none" stroke="#ffffff" strokeWidth="3.8" strokeLinecap="round" />
    </svg>
  )
}
