import { useState, useEffect } from 'react';
import { AnomalyAnalysisData } from '../types/climate';
import { fetchAnomalyData } from '../api/climateApi';

interface UseAnomalyReturn {
  data: AnomalyAnalysisData | null;
  loading: boolean;
  error: string | null;
}

export function useAnomaly(): UseAnomalyReturn {
  const [data, setData] = useState<AnomalyAnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchAnomalyData()
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setLoading(false);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { data, loading, error };
}
