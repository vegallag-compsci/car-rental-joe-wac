import { useState } from 'react'

// A button that asks "are you sure?" inline before acting, for changes that
// matter (cancelling a booking, granting admin). Inline rather than
// window.confirm so it matches the page and can't be blocked by the browser.
export default function ConfirmButton({
  children,
  confirmLabel = 'Confirm',
  onConfirm,
  disabled = false,
  className = 'btn btn-secondary btn-sm',
}) {
  const [asking, setAsking] = useState(false)

  if (asking) {
    return (
      <span className="confirm-inline">
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => {
            setAsking(false)
            onConfirm()
          }}
        >
          {confirmLabel}
        </button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setAsking(false)}>
          Back
        </button>
      </span>
    )
  }

  return (
    <button type="button" className={className} disabled={disabled} onClick={() => setAsking(true)}>
      {children}
    </button>
  )
}
