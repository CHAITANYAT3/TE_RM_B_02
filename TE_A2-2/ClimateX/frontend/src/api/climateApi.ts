import {
  DatasetSummary,
  HistoricalData,
  AnomalyAnalysisData,
  TemperatureMLResponse,
  FuturePredictionResponse,
  WhatIfResponse,
  TFTExperimentalResponse,
  FutureV2Response,
} from '../types/climate';

const BASE_URL = 'http://localhost:8000/api';

export async function fetchDatasetSummary(): Promise<DatasetSummary> {
  const response = await fetch(`${BASE_URL}/dataset`);
  if (!response.ok) {
    throw new Error(`API error ${response.status}: ${response.statusText}`);
  }
  return response.json();
}

export async function fetchHistoricalData(): Promise<HistoricalData> {
  const response = await fetch(`${BASE_URL}/historical`);
  if (!response.ok) {
    throw new Error(`API error ${response.status}: ${response.statusText}`);
  }
  return response.json();
}

export async function fetchAnomalyData(): Promise<AnomalyAnalysisData> {
  const response = await fetch(`${BASE_URL}/anomaly`);
  if (!response.ok) {
    throw new Error(`API error ${response.status}: ${response.statusText}`);
  }
  return response.json();
}

export async function fetchMLTemperatureData(): Promise<TemperatureMLResponse> {
  const response = await fetch(`${BASE_URL}/ml/temperature`);
  if (!response.ok) {
    throw new Error(`API error ${response.status}: ${response.statusText}`);
  }
  return response.json();
}

export async function fetchTFTExperimental(): Promise<TFTExperimentalResponse> {
  const response = await fetch(`${BASE_URL}/ml/tft`);
  if (!response.ok) {
    throw new Error(`API error ${response.status}: ${response.statusText}`);
  }
  return response.json();
}

export async function fetchFuturePrediction(
  year: number = 2030,
  modelType: string = 'polynomial'
): Promise<FuturePredictionResponse> {
  const response = await fetch(
    `${BASE_URL}/prediction/temperature?year=${year}&model_type=${modelType}`
  );
  if (!response.ok) {
    throw new Error(`API error ${response.status}: ${response.statusText}`);
  }
  return response.json();
}

export async function fetchWhatIfScenario(
  co2Change: number = 0,
  rainfallChange: number = 0
): Promise<WhatIfResponse> {
  const response = await fetch(
    `${BASE_URL}/scenarios/what-if?co2_change=${co2Change}&rainfall_change=${rainfallChange}`
  );
  if (!response.ok) {
    throw new Error(`API error ${response.status}: ${response.statusText}`);
  }
  return response.json();
}

export async function fetchFutureV2(
  target: 'temp' | 'rain' | 'co2',
  year: number
): Promise<FutureV2Response> {
  const response = await fetch(
    `${BASE_URL}/predict/future?target=${target}&year=${year}`
  );
  if (!response.ok) {
    throw new Error(`API error ${response.status}: ${response.statusText}`);
  }
  return response.json();
}

