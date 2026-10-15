import { useState, useEffect } from 'react';
import { WhatIfResponse } from '../types/climate';
import { fetchWhatIfScenario } from '../api/climateApi';

interface UseWhatIfScenarioReturn {
  data: WhatIfResponse | null;
  loading: boolean;
  error: string | null;
}

export function useWhatIfScenario(
  co2Change: number = 0,
  rainfallChange: number = 0,
  tempShift: number = 0
): UseWhatIfScenarioReturn {
  const [data, setData] = useState<WhatIfResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchWhatIfScenario(co2Change, rainfallChange)
      .then((result) => {
        if (!cancelled) {
          const regressionDelta = result.scenario.temperature_difference;
          const adjustedDelta = Number((regressionDelta + tempShift).toFixed(4));
          const adjustedTemp = Number((result.baseline.temperature + adjustedDelta).toFixed(4));

          const adjustedData: WhatIfResponse = {
            ...result,
            scenario: {
              ...result.scenario,
              estimated_temperature: adjustedTemp,
              temperature_difference: adjustedDelta,
            },
          };

          setData(adjustedData);
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
  }, [co2Change, rainfallChange, tempShift]);

  return { data, loading, error };
}
