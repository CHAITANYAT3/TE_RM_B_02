import { useState, useEffect } from 'react';
import { FuturePredictionResponse } from '../types/climate';
import { fetchFuturePrediction } from '../api/climateApi';

interface UseFuturePredictionReturn {
  data: FuturePredictionResponse | null;
  loading: boolean;
  error: string | null;
}

export function useFuturePrediction(
  year: number = 2030,
  modelType: string = 'polynomial'
): UseFuturePredictionReturn {
  const [data, setData] = useState<FuturePredictionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchFuturePrediction(year, modelType)
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
  }, [year, modelType]);

  return { data, loading, error };
}
