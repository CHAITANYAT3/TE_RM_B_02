export interface DatasetSummary {
  observation_count: number;
  start_year: number;
  end_year: number;
  column_names: string[];
  average_temperature: number;
  average_rainfall: number;
  average_co2: number;
}

export interface YearRecord {
  year: number;
  temperature: number;
  rainfall: number;
  co2: number;
}

export interface CorrelationPair {
  label: string;
  coefficient: number;
  interpretation: string;
}

export interface HistoricalData {
  records: YearRecord[];
  mean_temperature: number;
  mean_rainfall: number;
  mean_co2: number;
  correlations: CorrelationPair[];
  trend_summary: string;
  temp_trend: string;
  rainfall_pattern: string;
  co2_trend: string;
}

export interface YearAnomalyRecord {
  year: number;
  temperature: number;
  temperature_anomaly: number;
  rainfall: number;
  rainfall_anomaly: number;
  co2: number;
  co2_anomaly: number;
}

export interface ExtremeAnomaly {
  year: number;
  anomaly: number;
  observed: number;
}

export interface VariableStats {
  variable: string;
  label: string;
  unit: string;
  mean: number;
  std: number;
  highest_positive: ExtremeAnomaly;
  lowest_negative: ExtremeAnomaly;
}

export interface UnusualObservation {
  year: number;
  variable: string;
  variable_label: string;
  observed_value: number;
  unit: string;
  anomaly_value: number;
  anomaly_type: string;
  severity: string;
  baseline_mean: number;
  description: string;
}

export interface AnomalyAnalysisData {
  records: YearAnomalyRecord[];
  stats: VariableStats[];
  unusual_observations: UnusualObservation[];
  interpretation: string;
}

export interface PeriodInfo {
  start_year: number;
  end_year: number;
  total_years: number;
}

export interface ModelMetrics {
  model: string;
  mae: number;
  mse: number;
  rmse: number;
  r2: number;
  rank: number;
  model_type: string;
  viva_notes: string;
}

export interface BestModelInfo {
  model: string;
  selection_criterion: string;
  mae: number;
  mse: number;
  rmse: number;
  r2: number;
  summary: string;
}

export interface YearlyPrediction {
  year: number;
  actual: number;
  predictions: Record<string, number>;
}

export interface ModelPredictionSeries {
  model: string;
  predicted_values: number[];
  errors: number[];
}

export interface TFTDataSufficiency {
  total_observations: number;
  training_samples: number;
  testing_samples: number;
  lookback_window: number;
  training_sequences: number;
  testing_sequences: number;
  recommended_minimum: number;
  sufficiency_percentage: number;
  status: string;
}

export interface TFTVariableImportance {
  feature_name: string;
  weight: number;
  percentage: number;
}

export interface TFTArchitectureInfo {
  model_name: string;
  paradigm: string;
  lookback_window: number;
  input_features: string[];
  target_feature: string;
  hidden_dimension: number;
  attention_heads: number;
  parameter_count: number;
}

export interface TFTExperimentalMetrics {
  mae: number;
  mse: number;
  rmse: number;
  r2: number;
  training_loss: number;
}

export interface TFTYearlyPrediction {
  year: number;
  actual: number;
  predicted: number;
  error: number;
}

export interface TFTExperimentalResponse {
  model_name: string;
  status: string;
  status_label: string;
  is_reliable: boolean;
  data_sufficiency: TFTDataSufficiency;
  architecture: TFTArchitectureInfo;
  metrics: TFTExperimentalMetrics;
  variable_selection_weights: TFTVariableImportance[];
  yearly_predictions: TFTYearlyPrediction[];
  scientific_disclaimer: string;
  limitations: string[];
}

export interface TemperatureMLResponse {
  target_variable: string;
  input_feature: string;
  validation_strategy: string;
  training_period: PeriodInfo;
  testing_period: PeriodInfo;
  model_comparison: ModelMetrics[];
  best_model: BestModelInfo;
  yearly_predictions: YearlyPrediction[];
  model_series: ModelPredictionSeries[];
  viva_insights: string[];
  tft_experimental?: TFTExperimentalResponse;
}

export interface TrendPoint {
  year: number;
  temperature: number;
  status: 'Historical' | 'Estimated';
}

export interface FuturePredictionResponse {
  parameter: string;
  input_feature: string;
  selected_year: number;
  estimated_temperature: number;
  model_used: string;
  training_period: string;
  temperature_change_from_2000: number;
  temperature_change_from_2024: number;
  historical_data: TrendPoint[];
  future_series: TrendPoint[];
  all_model_estimates: Record<string, number>;
  extrapolation_rationale: string;
  scientific_disclaimer: string;
}

export interface BaselineData {
  name: string;
  year_or_period: string;
  temperature: number;
  co2_tonnes: number;
  rainfall_mm: number;
}

export interface ScenarioResult {
  co2_change_percent: number;
  rainfall_change_percent: number;
  scenario_co2_tonnes: number;
  scenario_rainfall_mm: number;
  estimated_temperature: number;
  temperature_difference: number;
  status: string;
}

export interface ModelDetails {
  model_name: string;
  intercept: number;
  beta_co2: number;
  beta_rainfall: number;
  r2_score: number;
  method_explanation: string;
}

export interface WhatIfResponse {
  scenario_title: string;
  baseline: BaselineData;
  scenario: ScenarioResult;
  model_details: ModelDetails;
  scientific_disclaimer: string;
  causation_warning: string;
}

// ── Future Prediction V2 (/predict/future) ──────────────────────────────────

export interface FutureYearPoint {
  year: number;
  value: number;
  lower: number;
  upper: number;
}

export interface ObservedPoint {
  year: number;
  value: number;
}

export interface MilestoneInfo {
  threshold_label: string;
  year_reached: number | null;
  reached: boolean;
}

export interface FutureV2Response {
  target: string;
  unit: string;
  label: string;
  model_name: string;
  training_period: string;
  test_rmse: number;
  selected_year: number;
  selected_value: number;
  selected_lower: number;
  selected_upper: number;
  change_from_2024: number;
  observed: ObservedPoint[];
  future: FutureYearPoint[];
  linear_future: FutureYearPoint[];
  poly_future: FutureYearPoint[];
  no_trend_note: string | null;
  fallback_note: string | null;
  milestones: MilestoneInfo[];
}

