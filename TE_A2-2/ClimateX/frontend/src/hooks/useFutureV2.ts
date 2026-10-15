import { useState, useEffect } from 'react';
import { FutureV2Response } from '../types/climate';
import { fetchFutureV2 } from '../api/climateApi';

interface UseFutureV2Return {
  data: FutureV2Response | null;
  loading: boolean;
  error: string | null;
}

export function useFutureV2(
  target: 'temp' | 'rain' | 'co2',
  year: number
): UseFutureV2Return {
  const [data, setData] = useState<FutureV2Response | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchFutureV2(target, year)
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
  }, [target, year]);

  return { data, loading, error };
}
