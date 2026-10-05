import { useEffect, useRef } from 'react'

// Shared behavior for the nav drawer and the filter sheet: while `open`,
// focus moves into the panel and Escape closes it; on close, focus returns
// to the button that opened it. `onClose` must be stable (useCallback),
// otherwise the panel would grab focus again on every render.
//
//   const { triggerRef, panelRef } = useOverlay(open, close)
//   <button ref={triggerRef} ...>   <div ref={panelRef} tabIndex={-1} ...>
export function useOverlay(open, onClose) {
  const triggerRef = useRef(null)
  const panelRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined

    const trigger = triggerRef.current
    // preventScroll: the panel is still sliding in from off-screen.
    panelRef.current?.focus({ preventScroll: true })

    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      trigger?.focus({ preventScroll: true })
    }
  }, [open, onClose])

  return { triggerRef, panelRef }
}
