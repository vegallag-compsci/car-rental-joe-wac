import { useCallback, useEffect, useState } from 'react'

/**
 * Run an async function and track loading / data / error for it.
 *
 *   const { loading, data, error, reload } = useAsync(
 *     (signal) => getCars({ categoryId, signal }),
 *     [categoryId]
 *   )
 *
 * The function receives an AbortSignal. Passing it to the API call means a
 * superseded request is cancelled, which prevents the bug where a user
 * changes filters quickly and a slower earlier response lands last and
 * overwrites the newer results.
 */
export function useAsync(asyncFn, deps = []) {
  const [state, setState] = useState({
    loading: true,
    data: null,
    error: null,
  })
  const [reloadCount, setReloadCount] = useState(0)

  const reload = useCallback(() => setReloadCount((n) => n + 1), [])

  useEffect(() => {
    const controller = new AbortController()
    let active = true

    setState({ loading: true, data: null, error: null })

    asyncFn(controller.signal).then(
      (data) => {
        if (active) setState({ loading: false, data, error: null })
      },
      (error) => {
        if (error?.name === 'AbortError') return
        if (active) setState({ loading: false, data: null, error })
      }
    )

    return () => {
      active = false
      controller.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, reloadCount])

  return { ...state, reload }
}
