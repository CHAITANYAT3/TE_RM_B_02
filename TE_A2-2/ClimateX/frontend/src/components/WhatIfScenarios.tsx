import { useState } from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts'
import { useWhatIfScenario } from '../hooks/useWhatIfScenario'
import IndiaSatelliteMap from './IndiaSatelliteMap'

// ─── Tooltip Styling ──────────────────────────────────────────────────────────
const tooltipStyle = {
  backgroundColor: '#0d1428',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '8px',
  color: '#e2e8f0',
  fontSize: '12px',
}
const tooltipLabelStyle = { color: '#94a3b8', marginBottom: 4, fontWeight: 600 }

export default function WhatIfScenarios() {
  const [co2Change, setCo2Change] = useState<number>(0)
  const [rainfallChange, setRainfallChange] = useState<number>(0)
  const [tempShift, setTempShift] = useState<number>(0)

  const { data, loading, error } = useWhatIfScenario(co2Change, rainfallChange, tempShift)

  // Preset scenarios
  const presets = [
    { label: 'Baseline', co2: 0, rain: 0, tempShift: 0 },
    { label: 'Extreme Heat (+3 °C)', co2: 0, rain: 0, tempShift: 3 },
    { label: 'Cold Wave (-3 °C)', co2: 0, rain: 0, tempShift: -3 },
    { label: '+20% CO₂ Increase', co2: 20, rain: 0, tempShift: 0 },
    { label: '-15% Rainfall Deficit', co2: 0, rain: -15, tempShift: 0 },
    { label: 'Warming & Drought (+20% CO₂, -15% Rain)', co2: 20, rain: -15, tempShift: 0 },
    { label: 'Green Transition (-25% CO₂, +5% Rain)', co2: -25, rain: 5, tempShift: 0 },
  ]

  // Chart data: Baseline vs Scenario
  const chartData = data
    ? [
        {
          name: 'Baseline',
          temperature: data.baseline.temperature,
          color: '#06b6d4',
          label: '2024 Observed',
        },
        {
          name: 'What-If Scenario',
          temperature: data.scenario.estimated_temperature,
          color: data.scenario.temperature_difference >= 0 ? '#f43f5e' : '#10b981',
          label: 'Hypothetical Estimate',
        },
      ]
    : []

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* ─── Header ────────────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
          <span className="text-xs text-purple-400 font-medium uppercase tracking-widest">
            Exploratory Simulation · What-If Analysis
          </span>
        </div>
        <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">
          Climate What-If Scenarios
        </h1>
        <p className="text-gray-400 text-sm max-w-3xl">
          Simulate hypothetical temperature adjustments under synthetic variations in CO₂ emissions and rainfall,
          grounded in the historical empirical relationships (2000–2024) of the observational dataset.
        </p>
      </div>

      {/* ─── Scientific Disclaimer & Safety Banner ─────────────────────────── */}
      <div className="bg-amber-500/10 border border-amber-500/25 rounded-xl p-4 flex items-start gap-3 text-xs">
        <span className="text-amber-400 text-lg shrink-0">⚠</span>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-bold text-amber-300 uppercase tracking-wide text-[10px] bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/30">
              Hypothetical Scenario
            </span>
            <span className="text-gray-400 text-[11px]">Scientific Safety Protocol</span>
          </div>
          <p className="text-amber-200/90 leading-relaxed font-medium">
            "{data?.scientific_disclaimer ||
              'Future values and scenario adjustments are model-based exploratory estimates derived from observational correlations in the 2000–2024 dataset. They should not be interpreted as exact, authoritative climate forecasts.'}"
          </p>
          <p className="text-gray-400 text-[11px] leading-relaxed">
            <span className="font-semibold text-amber-300">Correlation, not causation.</span> {data?.causation_warning ||
              'Statistical correlation does not establish direct causation. Real climate feedback involves complex atmospheric, oceanic, and planetary dynamics not fully captured by simple linear regressions.'}
          </p>
        </div>
      </div>

      {/* ─── Interactive Controls Card ──────────────────────────────────────── */}
      <div className="bg-[#0d1428] border border-white/5 rounded-xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/5 pb-4">
          <div>
            <h2 className="text-base font-semibold text-white">Scenario Parameters</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Adjust CO₂, Rainfall, and direct Temperature shift relative to the 2024 baseline.
            </p>
          </div>

          {/* Quick Presets */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider mr-1">
              Presets:
            </span>
            {presets.map((p) => {
              const isActive = co2Change === p.co2 && rainfallChange === p.rain && tempShift === p.tempShift
              return (
                <button
                  key={p.label}
                  onClick={() => {
                    setCo2Change(p.co2)
                    setRainfallChange(p.rain)
                    setTempShift(p.tempShift)
                  }}
                  className={`px-2.5 py-1 text-xs rounded-md font-medium transition-all ${
                    isActive
                      ? 'bg-purple-500 text-white font-bold shadow-md shadow-purple-500/20'
                      : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {p.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Sliders Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-1">
          {/* Slider 1: CO2 Emissions Change */}
          <div className="space-y-2.5 bg-white/[0.02] border border-white/5 p-4 rounded-xl">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-gray-200 flex items-center gap-2">
                <span>🏭</span>
                <span>CO₂ Emissions Change (%)</span>
              </label>
              <div className="flex items-center gap-1.5">
                <span
                  className={`font-mono text-xs font-bold px-2 py-0.5 rounded border ${
                    co2Change > 0
                      ? 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                      : co2Change < 0
                      ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
                      : 'bg-white/5 text-gray-400 border-white/10'
                  }`}
                >
                  {co2Change > 0 ? `+${co2Change}` : co2Change}%
                </span>
              </div>
            </div>

            <input
              type="range"
              min={-50}
              max={50}
              step={1}
              value={co2Change}
              onChange={(e) => setCo2Change(Number(e.target.value))}
              className="w-full accent-rose-500 cursor-pointer h-2 bg-slate-800 rounded-lg"
            />

            <div className="flex items-center justify-between text-[10px] text-gray-500 font-mono">
              <span>-50% Reduction</span>
              <span>0% Baseline</span>
              <span>+50% Increase</span>
            </div>
          </div>

          {/* Slider 2: Rainfall Change */}
          <div className="space-y-2.5 bg-white/[0.02] border border-white/5 p-4 rounded-xl">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-gray-200 flex items-center gap-2">
                <span>🌧</span>
                <span>Rainfall Change (%)</span>
              </label>
              <div className="flex items-center gap-1.5">
                <span
                  className={`font-mono text-xs font-bold px-2 py-0.5 rounded border ${
                    rainfallChange > 0
                      ? 'bg-blue-500/10 text-blue-300 border-blue-500/30'
                      : rainfallChange < 0
                      ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                      : 'bg-white/5 text-gray-400 border-white/10'
                  }`}
                >
                  {rainfallChange > 0 ? `+${rainfallChange}` : rainfallChange}%
                </span>
              </div>
            </div>

            <input
              type="range"
              min={-30}
              max={30}
              step={1}
              value={rainfallChange}
              onChange={(e) => setRainfallChange(Number(e.target.value))}
              className="w-full accent-blue-500 cursor-pointer h-2 bg-slate-800 rounded-lg"
            />

            <div className="flex items-center justify-between text-[10px] text-gray-500 font-mono">
              <span>-30% Drought</span>
              <span>0% Normal</span>
              <span>+30% Deluge</span>
            </div>
            <p className="text-[11px] text-gray-400 mt-1 italic">
              Rainfall has almost no link with temperature in this data.
            </p>
          </div>

          {/* Slider 3: Temperature Shift */}
          <div className="space-y-2.5 bg-white/[0.02] border border-white/5 p-4 rounded-xl">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-gray-200 flex items-center gap-2">
                <span>🌡️</span>
                <span>Temperature Shift (°C)</span>
              </label>
              <div className="flex items-center gap-1.5">
                <span
                  className={`font-mono text-xs font-bold px-2 py-0.5 rounded border ${
                    tempShift > 0
                      ? 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                      : tempShift < 0
                      ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
                      : 'bg-white/5 text-gray-400 border-white/10'
                  }`}
                >
                  {tempShift > 0 ? `+${tempShift.toFixed(1)}` : tempShift.toFixed(1)} °C
                </span>
              </div>
            </div>

            <input
              type="range"
              min={-3}
              max={3}
              step={0.1}
              value={tempShift}
              onChange={(e) => setTempShift(Number(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer h-2 bg-slate-800 rounded-lg"
            />

            <div className="flex items-center justify-between text-[10px] text-gray-500 font-mono">
              <span>-3 °C Cold Wave</span>
              <span>0 °C Baseline</span>
              <span>+3 °C Extreme Heat</span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Error Banner ──────────────────────────────────────────────────── */}
      {error && (
        <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400">
          <span>⚠</span>
          <div>
            <p className="font-medium">Failed to calculate scenario</p>
            <p className="text-xs text-red-400/80">{error}</p>
          </div>
        </div>
      )}

      {/* ─── Loading Skeleton ──────────────────────────────────────────────── */}
      {loading && !data && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-36 bg-white/5 rounded-xl animate-pulse" />
            ))}
          </div>
          <div className="h-64 bg-white/5 rounded-xl animate-pulse" />
        </div>
      )}

      {/* ─── Results Section ───────────────────────────────────────────────── */}
      {data && (
        <>
          {/* Key Metric Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Card 1: Baseline Temperature */}
            <div className="bg-[#0d1428] border border-white/5 rounded-xl p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                  <span className="uppercase tracking-wider font-semibold">Baseline Temperature</span>
                  <span className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 font-mono text-[10px]">
                    {data.baseline.year_or_period}
                  </span>
                </div>
                <div className="my-2 flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-white tracking-tight tabular-nums">
                    {data.baseline.temperature.toFixed(4)}
                  </span>
                  <span className="text-xl font-bold text-cyan-400">°C</span>
                </div>
              </div>
              <div className="pt-3 border-t border-white/5 text-[11px] text-gray-400 space-y-0.5">
                <div>CO₂: {(data.baseline.co2_tonnes / 1e6).toFixed(1)}M tonnes</div>
                <div>Rainfall: {data.baseline.rainfall_mm.toFixed(1)} mm</div>
              </div>
            </div>

            {/* Card 2: Scenario Temperature Estimate */}
            <div className="bg-gradient-to-br from-purple-950/40 via-[#0d1428] to-rose-950/30 border border-purple-500/30 rounded-xl p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="uppercase tracking-wider font-semibold text-purple-300">
                    Scenario Estimate
                  </span>
                  <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-200 font-bold text-[10px] border border-purple-500/30">
                    Hypothetical
                  </span>
                </div>
                <div className="my-2 flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-white tracking-tight tabular-nums">
                    {data.scenario.estimated_temperature.toFixed(4)}
                  </span>
                  <span className="text-xl font-bold text-purple-400">°C</span>
                </div>
              </div>
              <div className="pt-3 border-t border-white/10 text-[11px] text-gray-300 space-y-0.5">
                <div>Scenario CO₂: {(data.scenario.scenario_co2_tonnes / 1e6).toFixed(1)}M tonnes</div>
                <div>Scenario Rain: {data.scenario.scenario_rainfall_mm.toFixed(1)} mm</div>
              </div>
            </div>

            {/* Card 3: Difference from Baseline */}
            <div className="bg-[#0d1428] border border-white/5 rounded-xl p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                  <span className="uppercase tracking-wider font-semibold">Difference from Baseline</span>
                  <span className="text-[10px] text-gray-500 font-mono">ΔT</span>
                </div>
                <div className="my-2 flex items-baseline gap-2">
                  <span
                    className={`text-3xl font-extrabold tracking-tight tabular-nums ${
                      data.scenario.temperature_difference > 0
                        ? 'text-rose-400'
                        : data.scenario.temperature_difference < 0
                        ? 'text-cyan-400'
                        : 'text-gray-300'
                    }`}
                  >
                    {data.scenario.temperature_difference > 0 ? '+' : ''}
                    {data.scenario.temperature_difference.toFixed(4)}
                  </span>
                  <span className="text-xl font-bold text-gray-300">°C</span>
                </div>
              </div>
              <div className="pt-3 border-t border-white/5 text-[11px] text-gray-400">
                {data.scenario.temperature_difference > 0
                  ? `Estimated warming of +${data.scenario.temperature_difference.toFixed(4)}°C over baseline.`
                  : data.scenario.temperature_difference < 0
                  ? `Estimated cooling of ${data.scenario.temperature_difference.toFixed(4)}°C under baseline.`
                  : 'Zero deviation from 2024 observed conditions.'}
              </div>
            </div>
          </div>

          {/* ─── Climatia Imaginary Island SVG Map ───────────────────────────── */}
          <IndiaSatelliteMap
            co2Change={co2Change}
            rainfallChange={rainfallChange}
            tempDiff={data.scenario.temperature_difference}
            scenarioTemp={data.scenario.estimated_temperature}
            baselineTemp={data.baseline.temperature}
            tempShift={tempShift}
          />

          {/* ─── Comparison Chart (Baseline vs Scenario) ──────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Chart: Bar Comparison */}
            <div className="lg:col-span-2 bg-[#0d1428] border border-white/5 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-semibold text-white">
                    Temperature Comparison: Baseline vs Scenario
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Visual contrast of 2024 observed baseline against hypothetical scenario estimate.
                  </p>
                </div>
                <span className="text-[11px] font-mono text-purple-300 bg-purple-500/10 px-2.5 py-1 rounded border border-purple-500/20">
                  Δ = {data.scenario.temperature_difference >= 0 ? '+' : ''}
                  {data.scenario.temperature_difference.toFixed(4)}°C
                </span>
              </div>

              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
                    <YAxis
                      stroke="#64748b"
                      fontSize={11}
                      domain={[24.0, 27.0]}
                      tickFormatter={(v: number) => `${v.toFixed(1)}°`}
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      labelStyle={tooltipLabelStyle}
                      formatter={(value: any) => [`${Number(value).toFixed(4)} °C`, 'Temperature']}
                    />
                    <Bar dataKey="temperature" radius={[6, 6, 0, 0]} barSize={80}>
                      {chartData.map((entry, index) => (
                        <Cell key={`bar-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Inputs Summary Breakdown */}
            <div className="bg-[#0d1428] border border-white/5 rounded-xl p-6 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white mb-3">Active Scenario Summary</h3>
                <div className="space-y-3 text-xs">
                  <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5">
                    <span className="text-gray-400 block text-[11px]">CO₂ Emissions Adjustment</span>
                    <span
                      className={`font-mono text-sm font-bold ${
                        co2Change >= 0 ? 'text-rose-400' : 'text-cyan-400'
                      }`}
                    >
                      {co2Change >= 0 ? '+' : ''}
                      {co2Change}%
                    </span>
                    <p className="text-[10px] text-gray-500 mt-0.5">
                      {(data.scenario.scenario_co2_tonnes - data.baseline.co2_tonnes) >= 0 ? '+' : ''}
                      {((data.scenario.scenario_co2_tonnes - data.baseline.co2_tonnes) / 1e6).toFixed(1)}M tonnes
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5">
                    <span className="text-gray-400 block text-[11px]">Rainfall Adjustment</span>
                    <span
                      className={`font-mono text-sm font-bold ${
                        rainfallChange >= 0 ? 'text-blue-400' : 'text-amber-400'
                      }`}
                    >
                      {rainfallChange >= 0 ? '+' : ''}
                      {rainfallChange}%
                    </span>
                    <p className="text-[10px] text-gray-500 mt-0.5">
                      {(data.scenario.scenario_rainfall_mm - data.baseline.rainfall_mm) >= 0 ? '+' : ''}
                      {(data.scenario.scenario_rainfall_mm - data.baseline.rainfall_mm).toFixed(1)} mm
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5">
                    <span className="text-gray-400 block text-[11px]">Direct Temperature Shift</span>
                    <span
                      className={`font-mono text-sm font-bold ${
                        tempShift > 0 ? 'text-rose-400' : tempShift < 0 ? 'text-cyan-400' : 'text-gray-300'
                      }`}
                    >
                      {tempShift > 0 ? '+' : ''}
                      {tempShift.toFixed(1)} °C
                    </span>
                    <p className="text-[10px] text-gray-500 mt-0.5">
                      Independent climate shift applied
                    </p>
                  </div>
                </div>
              </div>

              <div className="text-[10px] text-gray-500 italic mt-4 pt-3 border-t border-white/5">
                Target: India annual aggregate temperature based on 2000–2024 dataset.
              </div>
            </div>
          </div>

          {/* ─── Methodology & Scientific Calculation Explanation ─────────────── */}
          <div className="bg-[#0d1428] border border-white/5 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <span>🔬</span> Calculation Methodology & Statistical Grounding
            </h3>
            <p className="text-xs text-gray-300 leading-relaxed">
              {data.model_details.method_explanation}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 text-xs">
              <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5">
                <span className="text-gray-400 text-[10px] uppercase font-bold block">Statistical Formula</span>
                <span className="font-mono text-cyan-300 text-xs mt-1 block">
                  T_scenario = T_baseline + ΔT_regression + ΔT_shift
                </span>
                <span className="text-[10px] text-gray-500 block mt-1">
                  ΔT_regression = β_CO2 · ΔCO2 + β_Rain · ΔRain
                </span>
              </div>
              <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5">
                <span className="text-gray-400 text-[10px] uppercase font-bold block">CO₂ Sensitivity</span>
                <span className="font-mono text-rose-300 text-xs mt-1 block">
                  +{((data.model_details.beta_co2 || 0) * 1e8).toFixed(3)} °C per 100M tonnes CO₂
                </span>
                <span className="text-[10px] text-gray-500 block mt-1">
                  Correlation, not causation.
                </span>
              </div>
              <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5">
                <span className="text-gray-400 text-[10px] uppercase font-bold block">Rainfall Sensitivity</span>
                <span className="font-mono text-gray-300 text-xs mt-1 block">
                  {data.model_details.beta_rainfall >= 0 ? '+' : ''}{((data.model_details.beta_rainfall || 0) * 100).toFixed(4)} °C per 100 mm rain
                </span>
                <span className="text-[10px] text-gray-500 block mt-1">
                  Rainfall has almost no link with temperature in this data.
                </span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
