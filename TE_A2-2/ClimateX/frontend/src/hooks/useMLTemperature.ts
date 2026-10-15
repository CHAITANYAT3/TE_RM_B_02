import { useState, useEffect } from 'react';
import { TemperatureMLResponse } from '../types/climate';
import { fetchMLTemperatureData } from '../api/climateApi';

interface UseMLTemperatureReturn {
  data: TemperatureMLResponse | null;
  loading: boolean;
  error: string | null;
}

export function useMLTemperature(): UseMLTemperatureReturn {
  const [data, setData] = useState<TemperatureMLResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchMLTemperatureData()
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
