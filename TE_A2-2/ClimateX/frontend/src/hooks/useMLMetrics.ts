import { useState, useEffect } from 'react'
import { TemperatureMLResponse } from '../types/climate'

const BASE_URL =
  typeof window !== 'undefined' && window.location.hostname === '127.0.0.1'
    ? 'http://127.0.0.1:8000/api'
    : 'http://localhost:8000/api'

export type MLTarget = 'temp' | 'rain' | 'co2'

interface UseMLMetricsReturn {
  data: TemperatureMLResponse | null
  loading: boolean
  error: string | null
}

export function useMLMetrics(target: MLTarget): UseMLMetricsReturn {
  const [data, setData] = useState<TemperatureMLResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setData(null)
    setError(null)

    fetch(`${BASE_URL}/ml/metrics?target=${target}`)
      .then(res => {
        if (!res.ok) throw new Error(`API error ${res.status}: ${res.statusText}`)
        return res.json() as Promise<TemperatureMLResponse>
      })
      .then(result => {
        if (!cancelled) {
          setData(result)
          setLoading(false)
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message)
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [target])

  return { data, loading, error }
}

