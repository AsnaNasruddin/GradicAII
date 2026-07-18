import { useEffect, useRef } from 'react'

// pausedRef: optional ref whose .current, when true, suppresses violation
// detection — needed around native browser dialogs (e.g. an <input type="file">
// picker) which steal window focus exactly like a real tab-switch would.
export default function useBrowserLock(onViolation, pausedRef) {
  const onViolationRef = useRef(onViolation)

  useEffect(() => {
    onViolationRef.current = onViolation
  }, [onViolation])

  useEffect(() => {
    let active = true

    const enterFullScreen = async () => {
      try {
        if (active && !document.fullscreenElement) {
          await document.documentElement.requestFullscreen()
        }
      } catch (err) {
        console.warn('Fullscreen request failed:', err)
      }
    }

    // Try to enter fullscreen (requires user interaction, so we call it immediately 
    // assuming the component mounted as a result of a click)
    enterFullScreen()

    const handleVisibilityChange = () => {
      if (pausedRef?.current) return
      if (document.hidden) {
        onViolationRef.current?.()
      }
    }

    // Some browsers also trigger blur on window
    const handleBlur = () => {
      // Small timeout to prevent false positives from alerts or fullscreen prompts
      setTimeout(() => {
        if (pausedRef?.current) return
        if (document.hidden || !document.hasFocus()) {
          onViolationRef.current?.()
        }
      }, 500)
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('blur', handleBlur)

    return () => {
      active = false
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('blur', handleBlur)
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {})
      }
    }
  }, [])
}
