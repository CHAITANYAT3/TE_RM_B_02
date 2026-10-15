import { useState, useEffect } from 'react';
import { HistoricalData } from '../types/climate';
import { fetchHistoricalData } from '../api/climateApi';

interface UseHistoricalReturn {
  data: HistoricalData | null;
  loading: boolean;
  error: string | null;
}

export function useHistorical(): UseHistoricalReturn {
  const [data, setData] = useState<HistoricalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchHistoricalData()
      .then((result) => {
        if (!cancelled) { setData(result); setLoading(false); }
      })
      .catch((err: Error) => {
        if (!cancelled) { setError(err.message); setLoading(false); }
      });
    return () => { cancelled = true; };
  }, []);

  return { data, loading, error };
}
