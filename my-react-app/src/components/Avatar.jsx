import { useState } from 'react'

// Round profile photo that falls back to the first letter of `name` when
// there's no image or it fails to load. Used in the nav and on reviews.
export default function Avatar({ src, name, size = 'md' }) {
  const [failed, setFailed] = useState(false)
  const className = size === 'lg' ? 'avatar avatar-lg' : 'avatar'

  if (!src || failed) {
    return (
      <span className={className} role="img" aria-label={name}>
        {name.charAt(0).toUpperCase()}
      </span>
    )
  }

  return (
    <img
      className={className}
      src={src}
      alt={name}
      loading="lazy"
      // Some image hosts (Google's included) refuse requests carrying a
      // Referer from another site, which would show a broken image.
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  )
}
