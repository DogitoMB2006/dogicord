import { useState, useEffect } from 'react'

export function useAppReady() {
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    const checkReady = () => {
      if (document.readyState === 'complete') {
        setIsReady(true)
      }
    }

    if (document.readyState === 'complete') {
      setIsReady(true)
    } else {
      window.addEventListener('load', checkReady)
      document.addEventListener('DOMContentLoaded', checkReady)
    }

    const timer = setTimeout(() => {
      setIsReady(true)
    }, 3000)

    return () => {
      window.removeEventListener('load', checkReady)
      document.removeEventListener('DOMContentLoaded', checkReady)
      clearTimeout(timer)
    }
  }, [])

  return isReady
}
