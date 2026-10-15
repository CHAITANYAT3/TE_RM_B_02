import { useState, useEffect } from 'react';
import { DatasetSummary } from '../types/climate';
import { fetchDatasetSummary } from '../api/climateApi';

interface UseDatasetReturn {
  data: DatasetSummary | null;
  loading: boolean;
  error: string | null;
}

export function useDataset(): UseDatasetReturn {
  const [data, setData] = useState<DatasetSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetchDatasetSummary()
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
