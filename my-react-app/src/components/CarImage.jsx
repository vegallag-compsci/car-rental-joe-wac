import { useState } from 'react'

// Car photos are hotlinked from other sites, which can block or remove them,
// and image_url is optional. Either way, show a tile with the car's name
// instead of the browser's broken-image icon.
export default function CarImage({ src, alt, className, loading }) {
  const [failed, setFailed] = useState(false)

  if (!src || failed) {
    return (
      <div className={`${className} car-image-fallback`} role="img" aria-label={alt}>
        {alt}
      </div>
    )
  }

  return (
    <img
      className={className}
      src={src}
      alt={alt}
      loading={loading}
      onError={() => setFailed(true)}
    />
  )
}
