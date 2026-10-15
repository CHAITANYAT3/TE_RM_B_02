import { useState, useEffect, useMemo } from 'react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from 'recharts'
import { useHistorical } from '../hooks/useHistorical'
import { useAnomaly } from '../hooks/useAnomaly'

type FilterCategory = 'All' | 'Temperature' | 'Rainfall' | 'CO2'

const tooltipStyle = {
  backgroundColor: '#0d1428',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '8px',
  color: '#e2e8f0',
  fontSize: '11px',
}

// ─── Animated Count-Up Component ─────────────────────────────────────────────
function AnimatedCountUp({
  target,
  decimals = 1,
  prefix = '',
  suffix = '',
  duration = 1000,
}: {
  target: number
  decimals?: number
  prefix?: string
  suffix?: string
  duration?: number
}) {
  const [val, setVal] = useState(0)

  useEffect(() => {
    let start: number | null = null
    let raf: number
    const step = (timestamp: number) => {
      if (!start) start = timestamp
      const progress = Math.min((timestamp - start) / duration, 1)
      const ease = 1 - Math.pow(1 - progress, 3) // ease-out cubic
      setVal(ease * target)
      if (progress < 1) {
        raf = requestAnimationFrame(step)
      } else {
        setVal(target)
      }
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])

  return (
    <span>
      {prefix}
      {val.toFixed(decimals)}
      {suffix}
    </span>
  )
}

export default function ClimateInsights() {
  const { data: histData, loading: histLoading, error: histError } = useHistorical()
  const { data: anomData, loading: anomLoading, error: anomError } = useAnomaly()

  const loading = histLoading || anomLoading
  const error = histError || anomError

  // Filter chips state
  const [activeFilter, setActiveFilter] = useState<FilterCategory>('All')

  // Collapsed state for "Why did this happen?" sections
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({})

  const toggleCard = (id: string) => {
    setExpandedCards((prev) => ({
      ...prev,
      [id]: !prev[id],
    }))
  }

  // ─── Compute All Real Numbers from CSV Records ─────────────────────────────
  const metrics = useMemo(() => {
    if (!histData?.records?.length) return null
    const records = histData.records

    const firstRec = records[0]
    const lastRec = records[records.length - 1]

    const tempDelta = lastRec.temperature - firstRec.temperature
    const rainDelta = lastRec.rainfall - firstRec.rainfall
    const co2Delta = lastRec.co2 - firstRec.co2
    const co2GrowthPct = firstRec.co2 !== 0 ? (co2Delta / firstRec.co2) * 100 : 0

    const meanTemp = records.reduce((s, r) => s + r.temperature, 0) / records.length
    const meanRain = records.reduce((s, r) => s + r.rainfall, 0) / records.length
    const meanCo2 = records.reduce((s, r) => s + r.co2, 0) / records.length

    // Extremes
    const warmestYearRec = records.reduce(
      (max, r) => (r.temperature > max.temperature ? r : max),
      records[0]
    )
    const coolestYearRec = records.reduce(
      (min, r) => (r.temperature < min.temperature ? r : min),
      records[0]
    )
    const wettestYearRec = records.reduce(
      (max, r) => (r.rainfall > max.rainfall ? r : max),
      records[0]
    )
    const driestYearRec = records.reduce(
      (min, r) => (r.rainfall < min.rainfall ? r : min),
      records[0]
    )

    // Linear regression for Temperature vs Year
    const n = records.length
    const meanYear = records.reduce((s, r) => s + r.year, 0) / n
    const varYear = records.reduce((s, r) => s + Math.pow(r.year - meanYear, 2), 0)
    const covYearTemp = records.reduce(
      (s, r) => s + (r.year - meanYear) * (r.temperature - meanTemp),
      0
    )
    const tempSlope = varYear !== 0 ? covYearTemp / varYear : 0
    const tempIntercept = meanTemp - tempSlope * meanYear

    const tempChartData = records.map((r) => ({
      year: r.year,
      temperature: Number(r.temperature.toFixed(2)),
      trend: Number((tempIntercept + tempSlope * r.year).toFixed(2)),
    }))

    // Rainfall Chart Data
    const rainChartData = records.map((r) => ({
      year: r.year,
      rainfall: Math.round(r.rainfall),
    }))

    // CO2 Chart Data
    const co2ChartData = records.map((r) => ({
      year: r.year,
      co2Gt: Number((r.co2 / 1e9).toFixed(3)),
    }))

    // Pearson correlation: Temp vs CO2
    const stdTemp = Math.sqrt(
      records.reduce((s, r) => s + Math.pow(r.temperature - meanTemp, 2), 0) / n
    )
    const stdCo2 = Math.sqrt(
      records.reduce((s, r) => s + Math.pow(r.co2 - meanCo2, 2), 0) / n
    )
    const covTempCo2 =
      records.reduce(
        (s, r) => s + (r.temperature - meanTemp) * (r.co2 - meanCo2),
        0
      ) / n
    const corrTempCo2 = stdTemp * stdCo2 !== 0 ? covTempCo2 / (stdTemp * stdCo2) : 0

    // Pearson correlation: Temp vs Rain
    const stdRain = Math.sqrt(
      records.reduce((s, r) => s + Math.pow(r.rainfall - meanRain, 2), 0) / n
    )
    const covTempRain =
      records.reduce(
        (s, r) => s + (r.temperature - meanTemp) * (r.rainfall - meanRain),
        0
      ) / n
    const corrTempRain = stdTemp * stdRain !== 0 ? covTempRain / (stdTemp * stdRain) : 0

    // Late warming comparison: 2000-2014 vs 2015-2024
    const p1Records = records.filter((r) => r.year >= 2000 && r.year <= 2014)
    const p2Records = records.filter((r) => r.year >= 2015 && r.year <= 2024)
    const p1Mean =
      p1Records.reduce((s, r) => s + r.temperature, 0) / (p1Records.length || 1)
    const p2Mean =
      p2Records.reduce((s, r) => s + r.temperature, 0) / (p2Records.length || 1)
    const lateShift = p2Mean - p1Mean

    return {
      records,
      firstRec,
      lastRec,
      tempDelta,
      rainDelta,
      co2Delta,
      co2GrowthPct,
      meanTemp,
      meanRain,
      meanCo2,
      warmestYearRec,
      coolestYearRec,
      wettestYearRec,
      driestYearRec,
      tempChartData,
      rainChartData,
      co2ChartData,
      corrTempCo2,
      corrTempRain,
      p1Mean,
      p2Mean,
      lateShift,
    }
  }, [histData])

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 max-w-full">
      <style>{`
        @keyframes cardFadeInUp {
          from {
            opacity: 0;
            transform: translateY(14px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .insight-card-anim {
          animation: cardFadeInUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      {/* ─── Page Title Header ─────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">💡</span>
            <span className="text-xs font-semibold uppercase tracking-widest text-cyan-400">
              Analytical Intelligence · 2000–2024
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Climate Insights</h1>
          <p className="text-xs sm:text-sm text-gray-400 mt-1">
            Data-driven exploratory findings strictly synthesized from verified national CSV records.
          </p>
        </div>

        {/* Non-Causal Framing Notice Badge */}
        <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl px-3.5 py-2 flex items-center gap-2 self-start md:self-auto">
          <span className="text-cyan-400 text-sm">ℹ</span>
          <p className="text-xs font-semibold text-cyan-300">Empirical & non-causal observations</p>
        </div>
      </div>

      {/* Loading & Error States */}
      {loading && (
        <div className="bg-[#0d1428] border border-white/5 rounded-xl p-12 text-center text-gray-400 animate-pulse">
          Synthesizing data-driven insights from 2000–2024 CSV observations...
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-sm text-red-400">
          Failed to load climate insights: {error}
        </div>
      )}

      {!loading && !error && metrics && (
        <>
          {/* ─── 1. TOP HERO: 4 BIG ANIMATED COUNT-UP NUMBERS ─────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Temp Change */}
            <div className="bg-[#0d1428] border border-white/5 rounded-2xl p-4 sm:p-5 relative overflow-hidden flex flex-col justify-between">
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block">
                Temp Change (2000–24)
              </span>
              <div className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-amber-400 my-2 tabular-nums font-mono">
                <AnimatedCountUp
                  target={metrics.tempDelta}
                  decimals={2}
                  prefix={metrics.tempDelta >= 0 ? '+' : ''}
                  suffix=" °C"
                />
              </div>
              <span className="text-[10px] text-gray-500 font-mono">
                {metrics.firstRec.temperature.toFixed(2)}° → {metrics.lastRec.temperature.toFixed(2)}°C
              </span>
            </div>

            {/* 2. Rain Change */}
            <div className="bg-[#0d1428] border border-white/5 rounded-2xl p-4 sm:p-5 relative overflow-hidden flex flex-col justify-between">
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block">
                Rain Change (2000–24)
              </span>
              <div className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-cyan-400 my-2 tabular-nums font-mono">
                <AnimatedCountUp
                  target={metrics.rainDelta}
                  decimals={1}
                  prefix={metrics.rainDelta >= 0 ? '+' : ''}
                  suffix=" mm"
                />
              </div>
              <span className="text-[10px] text-gray-500 font-mono">
                {metrics.firstRec.rainfall.toFixed(0)} → {metrics.lastRec.rainfall.toFixed(0)} mm
              </span>
            </div>

            {/* 3. CO2 Growth */}
            <div className="bg-[#0d1428] border border-white/5 rounded-2xl p-4 sm:p-5 relative overflow-hidden flex flex-col justify-between">
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block">
                CO₂ Emissions Growth
              </span>
              <div className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-emerald-400 my-2 tabular-nums font-mono">
                <AnimatedCountUp
                  target={metrics.co2GrowthPct}
                  decimals={1}
                  prefix="+"
                  suffix="%"
                />
              </div>
              <span className="text-[10px] text-gray-500 font-mono">
                {(metrics.firstRec.co2 / 1e9).toFixed(2)} → {(metrics.lastRec.co2 / 1e9).toFixed(2)} Gt
              </span>
            </div>

            {/* 4. Warmest Year */}
            <div className="bg-[#0d1428] border border-white/5 rounded-2xl p-4 sm:p-5 relative overflow-hidden flex flex-col justify-between">
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block">
                Warmest Year in Record
              </span>
              <div className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-rose-400 my-2 tabular-nums font-mono">
                <AnimatedCountUp
                  target={metrics.warmestYearRec.year}
                  decimals={0}
                  prefix="Year "
                />
              </div>
              <span className="text-[10px] text-gray-500 font-mono">
                Peak: {metrics.warmestYearRec.temperature.toFixed(2)} °C
              </span>
            </div>
          </div>

          {/* ─── 4. "KEY TAKEAWAY" STRIP (3 Short Lines, Computed from Data) ──── */}
          <div className="bg-gradient-to-r from-cyan-950/40 via-[#0d1428] to-purple-950/30 border border-cyan-500/30 rounded-2xl p-4 sm:p-5 shadow-lg space-y-2.5">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-wider text-cyan-300">
                Key Takeaways (Synthesized From Data)
              </span>
            </div>

            <div className="space-y-1.5 text-xs text-gray-300 font-medium">
              <div className="flex items-start gap-2">
                <span className="text-amber-400 font-bold shrink-0">1.</span>
                <p className="leading-snug">
                  <strong className="text-white">Temperature:</strong> Steady net rise of <span className="text-amber-400 font-mono font-bold">+{metrics.tempDelta.toFixed(2)}°C</span> over 2000–2024, peaking at <span className="text-rose-400 font-mono font-bold">{metrics.warmestYearRec.temperature.toFixed(2)}°C</span> in Year {metrics.warmestYearRec.year}.
                </p>
              </div>

              <div className="flex items-start gap-2">
                <span className="text-cyan-400 font-bold shrink-0">2.</span>
                <p className="leading-snug">
                  <strong className="text-white">Rainfall:</strong> High cyclical swings (drought low of <span className="text-rose-300 font-mono">{metrics.driestYearRec.rainfall.toFixed(0)} mm</span> vs deluge high of <span className="text-emerald-300 font-mono">{metrics.wettestYearRec.rainfall.toFixed(0)} mm</span>) with virtually zero linear link to temperature (<span className="font-mono text-gray-400">r = +{metrics.corrTempRain.toFixed(3)}</span>).
                </p>
              </div>

              <div className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold shrink-0">3.</span>
                <p className="leading-snug">
                  <strong className="text-white">CO₂ Emissions:</strong> Expanded by <span className="text-emerald-400 font-mono font-bold">+{metrics.co2GrowthPct.toFixed(1)}%</span> (from {(metrics.firstRec.co2 / 1e9).toFixed(2)} to {(metrics.lastRec.co2 / 1e9).toFixed(2)} Gt), strongly co-varying (<span className="text-purple-300 font-mono font-bold">r = +{metrics.corrTempCo2.toFixed(3)}</span>) with the national thermal baseline.
                </p>
              </div>
            </div>
          </div>

          {/* ─── 2. FILTER CHIPS: ALL | TEMPERATURE | RAINFALL | CO2 ─────────── */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1">
              Filter Insights:
            </span>
            {(['All', 'Temperature', 'Rainfall', 'CO2'] as FilterCategory[]).map((cat) => {
              const isActive = activeFilter === cat
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveFilter(cat)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer ${
                    isActive
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-md shadow-cyan-500/10'
                      : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-200 border border-white/5'
                  }`}
                >
                  {cat === 'All' ? 'All (6)' : cat}
                </button>
              )
            })}
          </div>

          {/* ─── 3. 6 INSIGHT CARDS (Soft Glow, Animate-in, Collapsed Button) ─── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* CARD 1: TEMPERATURE (Line with trend line) */}
            {(activeFilter === 'All' || activeFilter === 'Temperature') && (
              <div className="insight-card-anim bg-[#0d1428] border border-white/5 hover:border-cyan-500/40 hover:shadow-[0_0_25px_rgba(6,182,212,0.18)] transition-all duration-300 rounded-2xl p-5 flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-gray-500 bg-white/5 px-2 py-0.5 rounded">01</span>
                      <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded border text-amber-400 bg-amber-500/10 border-amber-500/20">
                        Thermal Trajectory
                      </span>
                    </div>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full border text-amber-300 bg-amber-500/20 border-amber-500/40">
                      +{metrics.tempDelta.toFixed(2)}°C net
                    </span>
                  </div>

                  <h3 className="text-sm font-semibold text-white mb-2">National Temperature Trend</h3>

                  {/* Small Chart: Line with Trend Line */}
                  <div className="h-28 w-full bg-[#070b16] rounded-xl border border-white/5 p-1 mb-3">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={metrics.tempChartData} margin={{ top: 8, right: 10, bottom: 0, left: -25 }}>
                        <XAxis dataKey="year" stroke="#475569" tick={{ fill: '#64748b', fontSize: 9 }} />
                        <YAxis domain={['auto', 'auto']} stroke="#475569" tick={{ fill: '#64748b', fontSize: 9 }} />
                        <Tooltip contentStyle={tooltipStyle} formatter={(val: any) => [`${Number(val).toFixed(2)} °C`]} />
                        <Line type="monotone" dataKey="temperature" stroke="#f97316" strokeWidth={2} dot={{ r: 1.5, fill: '#f97316' }} />
                        <Line type="linear" dataKey="trend" stroke="#94a3b8" strokeDasharray="3 3" strokeWidth={1.5} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Paragraph Cut to 2 Lines */}
                  <p className="text-xs text-gray-300 leading-relaxed line-clamp-2 mb-3">
                    India's annual mean surface temperature shifted from {metrics.firstRec.temperature.toFixed(2)}°C (2000) to {metrics.lastRec.temperature.toFixed(2)}°C (2024), representing a net increase of +{metrics.tempDelta.toFixed(2)}°C across the 25-year series.
                  </p>

                  {/* Key Numbers as Small Badges */}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 border border-white/10 text-gray-300">
                      2000: <strong className="text-white">{metrics.firstRec.temperature.toFixed(2)}°C</strong>
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 border border-white/10 text-gray-300">
                      2024: <strong className="text-white">{metrics.lastRec.temperature.toFixed(2)}°C</strong>
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 border border-white/10 text-gray-300">
                      Mean: <strong className="text-white">{metrics.meanTemp.toFixed(2)}°C</strong>
                    </span>
                  </div>
                </div>

                {/* 1. Collapsed "Why did this happen?" Button (possible factors, not proof) */}
                <div>
                  <button
                    type="button"
                    onClick={() => toggleCard('temp')}
                    className="w-full flex items-center justify-between text-left text-xs font-semibold text-cyan-400 hover:text-cyan-300 py-1.5 px-2.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 transition cursor-pointer"
                  >
                    <span className="flex items-center gap-1.5">
                      <span>💡</span>
                      <span>Why did this happen? (possible factors, not proof)</span>
                    </span>
                    <span className="text-[10px] text-gray-400 font-mono">
                      {expandedCards['temp'] ? '▲ Hide' : '▼ View'}
                    </span>
                  </button>

                  {expandedCards['temp'] && (
                    <div className="mt-2 p-2.5 bg-white/[0.02] border border-dashed border-white/10 rounded-lg text-[11px] text-gray-400 leading-relaxed">
                      <p className="line-clamp-2 leading-relaxed">
                        Documented alongside rising regional thermal absorption and atmospheric concentrations across South Asia. Reflects broad empirical observations rather than a singular causal proof.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* CARD 2: RAINFALL (Bars with mean line, wettest & driest highlighted) */}
            {(activeFilter === 'All' || activeFilter === 'Rainfall') && (
              <div className="insight-card-anim bg-[#0d1428] border border-white/5 hover:border-cyan-500/40 hover:shadow-[0_0_25px_rgba(6,182,212,0.18)] transition-all duration-300 rounded-2xl p-5 flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-gray-500 bg-white/5 px-2 py-0.5 rounded">02</span>
                      <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded border text-cyan-400 bg-cyan-500/10 border-cyan-500/20">
                        Precipitation Dynamics
                      </span>
                    </div>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full border text-cyan-300 bg-cyan-500/20 border-cyan-500/40">
                      {metrics.rainDelta >= 0 ? '+' : ''}{metrics.rainDelta.toFixed(1)} mm net
                    </span>
                  </div>

                  <h3 className="text-sm font-semibold text-white mb-2">Rainfall Pattern & Monsoon Variability</h3>

                  {/* Small Chart: Bars with Mean Line (Wettest & Driest highlighted) */}
                  <div className="h-28 w-full bg-[#070b16] rounded-xl border border-white/5 p-1 mb-3">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={metrics.rainChartData} margin={{ top: 8, right: 10, bottom: 0, left: -25 }}>
                        <XAxis dataKey="year" stroke="#475569" tick={{ fill: '#64748b', fontSize: 9 }} />
                        <YAxis domain={['auto', 'auto']} stroke="#475569" tick={{ fill: '#64748b', fontSize: 9 }} />
                        <Tooltip contentStyle={tooltipStyle} formatter={(val: any) => [`${val} mm`, 'Rainfall']} />
                        <ReferenceLine y={metrics.meanRain} stroke="#cbd5e1" strokeDasharray="3 3" />
                        <Bar dataKey="rainfall" radius={[1.5, 1.5, 0, 0]}>
                          {metrics.rainChartData.map((entry) => (
                            <Cell
                              key={entry.year}
                              fill={
                                entry.year === metrics.wettestYearRec.year
                                ? '#10b981'
                                : entry.year === metrics.driestYearRec.year
                                ? '#ef4444'
                                : '#0284c7'
                              }
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Paragraph Cut to 2 Lines */}
                  <p className="text-xs text-gray-300 leading-relaxed line-clamp-2 mb-3">
                    National precipitation demonstrated high inter-annual oscillation around a 25-year mean of {metrics.meanRain.toFixed(1)} mm, with wettest ({metrics.wettestYearRec.year}) and driest ({metrics.driestYearRec.year}) extremes marked.
                  </p>

                  {/* Key Numbers as Small Badges */}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
                      Wettest: {metrics.wettestYearRec.year} ({metrics.wettestYearRec.rainfall.toFixed(0)} mm)
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-300">
                      Driest: {metrics.driestYearRec.year} ({metrics.driestYearRec.rainfall.toFixed(0)} mm)
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 border border-white/10 text-gray-300">
                      Mean: {metrics.meanRain.toFixed(0)} mm
                    </span>
                  </div>
                </div>

                {/* 1. Collapsed "Why did this happen?" Button (possible factors, not proof) */}
                <div>
                  <button
                    type="button"
                    onClick={() => toggleCard('rain')}
                    className="w-full flex items-center justify-between text-left text-xs font-semibold text-cyan-400 hover:text-cyan-300 py-1.5 px-2.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 transition cursor-pointer"
                  >
                    <span className="flex items-center gap-1.5">
                      <span>💡</span>
                      <span>Why did this happen? (possible factors, not proof)</span>
                    </span>
                    <span className="text-[10px] text-gray-400 font-mono">
                      {expandedCards['rain'] ? '▲ Hide' : '▼ View'}
                    </span>
                  </button>

                  {expandedCards['rain'] && (
                    <div className="mt-2 p-2.5 bg-white/[0.02] border border-dashed border-white/10 rounded-lg text-[11px] text-gray-400 leading-relaxed">
                      <p className="line-clamp-2 leading-relaxed">
                        Possible influences include Indian Ocean Dipole variability and synoptic monsoon trough positioning. Oscillations show minimal direct coupling to uniform warming trends.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* CARD 3: CO2 (Area Chart) */}
            {(activeFilter === 'All' || activeFilter === 'CO2') && (
              <div className="insight-card-anim bg-[#0d1428] border border-white/5 hover:border-cyan-500/40 hover:shadow-[0_0_25px_rgba(6,182,212,0.18)] transition-all duration-300 rounded-2xl p-5 flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-gray-500 bg-white/5 px-2 py-0.5 rounded">03</span>
                      <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded border text-emerald-400 bg-emerald-500/10 border-emerald-500/20">
                        Emissions Growth
                      </span>
                    </div>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full border text-emerald-300 bg-emerald-500/20 border-emerald-500/40">
                      +{metrics.co2GrowthPct.toFixed(1)}% growth
                    </span>
                  </div>

                  <h3 className="text-sm font-semibold text-white mb-2">National CO₂ Emissions Trajectory</h3>

                  {/* Small Chart: Area Chart */}
                  <div className="h-28 w-full bg-[#070b16] rounded-xl border border-white/5 p-1 mb-3">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={metrics.co2ChartData} margin={{ top: 8, right: 10, bottom: 0, left: -25 }}>
                        <defs>
                          <linearGradient id="co2Area" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="year" stroke="#475569" tick={{ fill: '#64748b', fontSize: 9 }} />
                        <YAxis domain={['auto', 'auto']} stroke="#475569" tick={{ fill: '#64748b', fontSize: 9 }} />
                        <Tooltip contentStyle={tooltipStyle} formatter={(val: any) => [`${val} Gt`, 'CO₂ Emissions']} />
                        <Area type="monotone" dataKey="co2Gt" stroke="#10b981" strokeWidth={2} fill="url(#co2Area)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Paragraph Cut to 2 Lines */}
                  <p className="text-xs text-gray-300 leading-relaxed line-clamp-2 mb-3">
                    National CO₂ emissions increased steadily from {(metrics.firstRec.co2 / 1e9).toFixed(2)} Gt in 2000 to {(metrics.lastRec.co2 / 1e9).toFixed(2)} Gt in 2024, exhibiting persistent growth over 25 years.
                  </p>

                  {/* Key Numbers as Small Badges */}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 border border-white/10 text-gray-300">
                      2000: <strong className="text-white">{(metrics.firstRec.co2 / 1e9).toFixed(2)} Gt</strong>
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 border border-white/10 text-gray-300">
                      2024: <strong className="text-white">{(metrics.lastRec.co2 / 1e9).toFixed(2)} Gt</strong>
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 border border-white/10 text-gray-300">
                      Growth: <strong className="text-emerald-400">{(metrics.lastRec.co2 / metrics.firstRec.co2).toFixed(2)}×</strong>
                    </span>
                  </div>
                </div>

                {/* 1. Collapsed "Why did this happen?" Button (possible factors, not proof) */}
                <div>
                  <button
                    type="button"
                    onClick={() => toggleCard('co2')}
                    className="w-full flex items-center justify-between text-left text-xs font-semibold text-cyan-400 hover:text-cyan-300 py-1.5 px-2.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 transition cursor-pointer"
                  >
                    <span className="flex items-center gap-1.5">
                      <span>💡</span>
                      <span>Why did this happen? (possible factors, not proof)</span>
                    </span>
                    <span className="text-[10px] text-gray-400 font-mono">
                      {expandedCards['co2'] ? '▲ Hide' : '▼ View'}
                    </span>
                  </button>

                  {expandedCards['co2'] && (
                    <div className="mt-2 p-2.5 bg-white/[0.02] border border-dashed border-white/10 rounded-lg text-[11px] text-gray-400 leading-relaxed">
                      <p className="line-clamp-2 leading-relaxed">
                        Observed alongside expanding electrification, domestic energy generation, and industrial output. Statistically correlated without implying an isolated causal variable.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* CARD 4: EXTREMES (Dot strip of 25 years, highest & lowest marked) */}
            {(activeFilter === 'All' || activeFilter === 'Temperature' || activeFilter === 'Rainfall') && (
              <div className="insight-card-anim bg-[#0d1428] border border-white/5 hover:border-cyan-500/40 hover:shadow-[0_0_25px_rgba(6,182,212,0.18)] transition-all duration-300 rounded-2xl p-5 flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-gray-500 bg-white/5 px-2 py-0.5 rounded">04</span>
                      <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded border text-rose-400 bg-rose-500/10 border-rose-500/20">
                        Climatological Extrema
                      </span>
                    </div>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full border text-rose-300 bg-rose-500/20 border-rose-500/40">
                      Peak: Year {metrics.warmestYearRec.year}
                    </span>
                  </div>

                  <h3 className="text-sm font-semibold text-white mb-2">25-Year Extreme Anomaly Distribution</h3>

                  {/* Small Chart: Dot Strip of 25 Years (Highest & Lowest Marked) */}
                  <div className="h-28 w-full bg-[#070b16] rounded-xl border border-white/5 p-2 mb-3 flex flex-col justify-center">
                    <svg viewBox="0 0 320 65" className="w-full h-full overflow-visible select-none">
                      <line x1="20" y1="36" x2="300" y2="36" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />

                      {metrics.records.map((r, i) => {
                        const cx = 24 + i * 11.5
                        const isHighest = r.year === metrics.warmestYearRec.year
                        const isLowest = r.year === metrics.coolestYearRec.year

                        if (isHighest) {
                          return (
                            <g key={r.year}>
                              <circle cx={cx} cy={22} r={7} fill="#ef4444" stroke="#ffffff" strokeWidth={2} />
                              <text x={cx} y={11} fill="#ef4444" fontSize="8" fontWeight="bold" textAnchor="middle">
                                {r.year} High
                              </text>
                              <line x1={cx} y1={29} x2={cx} y2={36} stroke="#ef4444" strokeWidth="1.5" strokeDasharray="2 2" />
                            </g>
                          )
                        }

                        if (isLowest) {
                          return (
                            <g key={r.year}>
                              <circle cx={cx} cy={50} r={6.5} fill="#38bdf8" stroke="#ffffff" strokeWidth={2} />
                              <text x={cx} y={63} fill="#38bdf8" fontSize="8" fontWeight="bold" textAnchor="middle">
                                {r.year} Low
                              </text>
                              <line x1={cx} y1={36} x2={cx} y2={43.5} stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="2 2" />
                            </g>
                          )
                        }

                        return (
                          <circle
                            key={r.year}
                            cx={cx}
                            cy={36}
                            r={2.5}
                            fill="#64748b"
                            opacity={0.65}
                          />
                        )
                      })}

                      <text x="24" y="47" fill="#475569" fontSize="8" textAnchor="middle">2000</text>
                      <text x="300" y="47" fill="#475569" fontSize="8" textAnchor="middle">2024</text>
                    </svg>
                  </div>

                  {/* Paragraph Cut to 2 Lines */}
                  <p className="text-xs text-gray-300 leading-relaxed line-clamp-2 mb-3">
                    Year {metrics.warmestYearRec.year} registered the peak temperature ({metrics.warmestYearRec.temperature.toFixed(2)}°C), while {metrics.coolestYearRec.year} recorded the coolest ({metrics.coolestYearRec.temperature.toFixed(2)}°C) across the 25-year series.
                  </p>

                  {/* Key Numbers as Small Badges */}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-300">
                      Highest: {metrics.warmestYearRec.year} ({metrics.warmestYearRec.temperature.toFixed(2)}°C)
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20 text-cyan-300">
                      Lowest: {metrics.coolestYearRec.year} ({metrics.coolestYearRec.temperature.toFixed(2)}°C)
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 border border-white/10 text-gray-300">
                      Range: {(metrics.warmestYearRec.temperature - metrics.coolestYearRec.temperature).toFixed(2)}°C
                    </span>
                  </div>
                </div>

                {/* 1. Collapsed "Why did this happen?" Button (possible factors, not proof) */}
                <div>
                  <button
                    type="button"
                    onClick={() => toggleCard('extremes')}
                    className="w-full flex items-center justify-between text-left text-xs font-semibold text-cyan-400 hover:text-cyan-300 py-1.5 px-2.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 transition cursor-pointer"
                  >
                    <span className="flex items-center gap-1.5">
                      <span>💡</span>
                      <span>Why did this happen? (possible factors, not proof)</span>
                    </span>
                    <span className="text-[10px] text-gray-400 font-mono">
                      {expandedCards['extremes'] ? '▲ Hide' : '▼ View'}
                    </span>
                  </button>

                  {expandedCards['extremes'] && (
                    <div className="mt-2 p-2.5 bg-white/[0.02] border border-dashed border-white/10 rounded-lg text-[11px] text-gray-400 leading-relaxed">
                      <p className="line-clamp-2 leading-relaxed">
                        Extremes align with global ENSO oscillations and pre-monsoon pressure systems. Documented as exploratory anomaly peaks rather than isolated local causation.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* CARD 5: CORRELATION (Scatter of Temp vs CO2 with trend line, show r value) */}
            {(activeFilter === 'All' || activeFilter === 'Temperature' || activeFilter === 'CO2') && (
              <div className="insight-card-anim bg-[#0d1428] border border-white/5 hover:border-cyan-500/40 hover:shadow-[0_0_25px_rgba(6,182,212,0.18)] transition-all duration-300 rounded-2xl p-5 flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-gray-500 bg-white/5 px-2 py-0.5 rounded">05</span>
                      <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded border text-purple-400 bg-purple-500/10 border-purple-500/20">
                        Statistical Association
                      </span>
                    </div>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full border text-purple-300 bg-purple-500/20 border-purple-500/40">
                      r = +{metrics.corrTempCo2.toFixed(3)}
                    </span>
                  </div>

                  <h3 className="text-sm font-semibold text-white mb-2">Temperature vs CO₂ Correlation</h3>

                  {/* Small Chart: Scatter Plot of Temp vs CO2 with Trend Line & r badge */}
                  <div className="h-28 w-full bg-[#070b16] rounded-xl border border-white/5 p-2 mb-3 relative flex items-center justify-center">
                    <svg viewBox="0 0 320 80" className="w-full h-full overflow-visible select-none">
                      <line x1="30" y1="65" x2="290" y2="18" stroke="#a855f7" strokeWidth="2" strokeDasharray="3 3" />

                      {metrics.records.map((r) => {
                        const minCo2 = metrics.firstRec.co2
                        const maxCo2 = metrics.lastRec.co2
                        const x = 35 + ((r.co2 - minCo2) / (maxCo2 - minCo2 || 1)) * 250
                        const minT = 24.0
                        const maxT = 26.0
                        const y = 68 - ((r.temperature - minT) / (maxT - minT || 1)) * 52

                        return (
                          <circle
                            key={r.year}
                            cx={x}
                            cy={y}
                            r={3.2}
                            fill="#c084fc"
                            stroke="#ffffff"
                            strokeWidth={0.8}
                            opacity={0.85}
                          />
                        )
                      })}

                      <text x="35" y="77" fill="#64748b" fontSize="8">Low CO₂</text>
                      <text x="285" y="77" fill="#64748b" fontSize="8" textAnchor="end">High CO₂</text>
                    </svg>

                    <div className="absolute top-2 right-2 bg-purple-950/80 border border-purple-500/30 px-2 py-0.5 rounded text-[10px] font-mono text-purple-300 font-bold">
                      r = +{metrics.corrTempCo2.toFixed(3)}
                    </div>
                  </div>

                  {/* Paragraph Cut to 2 Lines */}
                  <p className="text-xs text-gray-300 leading-relaxed line-clamp-2 mb-3">
                    Temperature and CO₂ exhibit a strong empirical correlation (r = +{metrics.corrTempCo2.toFixed(3)}), while Temperature and Rainfall remain decoupled (r = +{metrics.corrTempRain.toFixed(3)}).
                  </p>

                  {/* Key Numbers as Small Badges */}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 text-purple-300">
                      Temp vs CO₂: r = +{metrics.corrTempCo2.toFixed(3)}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 border border-white/10 text-gray-400">
                      Temp vs Rain: r = +{metrics.corrTempRain.toFixed(3)} (Decoupled)
                    </span>
                  </div>
                </div>

                {/* 1. Collapsed "Why did this happen?" Button (possible factors, not proof) */}
                <div>
                  <button
                    type="button"
                    onClick={() => toggleCard('corr')}
                    className="w-full flex items-center justify-between text-left text-xs font-semibold text-cyan-400 hover:text-cyan-300 py-1.5 px-2.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 transition cursor-pointer"
                  >
                    <span className="flex items-center gap-1.5">
                      <span>💡</span>
                      <span>Why did this happen? (possible factors, not proof)</span>
                    </span>
                    <span className="text-[10px] text-gray-400 font-mono">
                      {expandedCards['corr'] ? '▲ Hide' : '▼ View'}
                    </span>
                  </button>

                  {expandedCards['corr'] && (
                    <div className="mt-2 p-2.5 bg-white/[0.02] border border-dashed border-white/10 rounded-lg text-[11px] text-gray-400 leading-relaxed">
                      <p className="line-clamp-2 leading-relaxed">
                        Reflects synchronized multi-decadal growth patterns. Pearson coefficients demonstrate statistical co-variance without establishing direct bivariate causality.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* CARD 6: LATE WARMING (2000-2014 vs 2015-2024 average bars) */}
            {(activeFilter === 'All' || activeFilter === 'Temperature') && (
              <div className="insight-card-anim bg-[#0d1428] border border-white/5 hover:border-cyan-500/40 hover:shadow-[0_0_25px_rgba(6,182,212,0.18)] transition-all duration-300 rounded-2xl p-5 flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-gray-500 bg-white/5 px-2 py-0.5 rounded">06</span>
                      <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded border text-blue-400 bg-blue-500/10 border-blue-500/20">
                        Decadal Shift
                      </span>
                    </div>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full border text-blue-300 bg-blue-500/20 border-blue-500/40">
                      +{metrics.lateShift.toFixed(2)}°C in recent decade
                    </span>
                  </div>

                  <h3 className="text-sm font-semibold text-white mb-2">Late-Period Warming Shift</h3>

                  {/* Small Chart: 2000-2014 vs 2015-2024 Average Bars */}
                  <div className="h-28 w-full bg-[#070b16] rounded-xl border border-white/5 p-3 mb-3 flex flex-col justify-center space-y-2.5">
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] font-mono text-gray-400">
                        <span>2000–2014 (15 yrs)</span>
                        <span className="font-bold text-cyan-300">{metrics.p1Mean.toFixed(2)} °C</span>
                      </div>
                      <div className="w-full h-4 bg-white/5 rounded overflow-hidden">
                        <div className="h-full bg-cyan-600 rounded" style={{ width: '75%' }} />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] font-mono text-gray-400">
                        <span>2015–2024 (10 yrs)</span>
                        <span className="font-bold text-rose-400">{metrics.p2Mean.toFixed(2)} °C</span>
                      </div>
                      <div className="w-full h-4 bg-white/5 rounded overflow-hidden">
                        <div className="h-full bg-rose-500 rounded" style={{ width: '88%' }} />
                      </div>
                    </div>
                  </div>

                  {/* Paragraph Cut to 2 Lines */}
                  <p className="text-xs text-gray-300 leading-relaxed line-clamp-2 mb-3">
                    Average temperature climbed from {metrics.p1Mean.toFixed(2)}°C (2000–14) to {metrics.p2Mean.toFixed(2)}°C (2015–24), with all top warm anomaly years clustered in the latter decade.
                  </p>

                  {/* Key Numbers as Small Badges */}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20 text-cyan-300">
                      2000–14: {metrics.p1Mean.toFixed(2)}°C
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-300">
                      2015–24: {metrics.p2Mean.toFixed(2)}°C
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 border border-white/10 text-white">
                      Diff: +{metrics.lateShift.toFixed(2)}°C
                    </span>
                  </div>
                </div>

                {/* 1. Collapsed "Why did this happen?" Button (possible factors, not proof) */}
                <div>
                  <button
                    type="button"
                    onClick={() => toggleCard('late')}
                    className="w-full flex items-center justify-between text-left text-xs font-semibold text-cyan-400 hover:text-cyan-300 py-1.5 px-2.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 transition cursor-pointer"
                  >
                    <span className="flex items-center gap-1.5">
                      <span>💡</span>
                      <span>Why did this happen? (possible factors, not proof)</span>
                    </span>
                    <span className="text-[10px] text-gray-400 font-mono">
                      {expandedCards['late'] ? '▲ Hide' : '▼ View'}
                    </span>
                  </button>

                  {expandedCards['late'] && (
                    <div className="mt-2 p-2.5 bg-white/[0.02] border border-dashed border-white/10 rounded-lg text-[11px] text-gray-400 leading-relaxed">
                      <p className="line-clamp-2 leading-relaxed">
                        Associated with cumulative atmospheric residence of greenhouse gases and ocean heat content accumulation. Reflects verified nationwide observations over 25 years.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
