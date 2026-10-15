import { useState } from 'react'
import { useAnomaly } from '../hooks/useAnomaly'
import { VariableStats, UnusualObservation, YearAnomalyRecord } from '../types/climate'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatValue(variable: string, val: number): string {
  if (variable === 'temperature') return `${val.toFixed(2)}°C`
  if (variable === 'rainfall') return `${val.toFixed(1)} mm`
  if (variable === 'co2') return `${(val / 1e9).toFixed(2)}B tonnes`
  return `${val}`
}

function getAnomalyColor(z: number): { bg: string; text: string; border: string; label: string } {
  if (z >= 1.5) {
    return {
      bg: 'bg-rose-500/25',
      text: 'text-rose-400',
      border: 'border-rose-500/40',
      label: 'Extreme Positive',
    }
  }
  if (z >= 0.5) {
    return {
      bg: 'bg-amber-500/20',
      text: 'text-amber-400',
      border: 'border-amber-500/30',
      label: 'Moderate Positive',
    }
  }
  if (z > -0.5) {
    return {
      bg: 'bg-slate-800/60',
      text: 'text-slate-400',
      border: 'border-white/5',
      label: 'Normal / Baseline',
    }
  }
  if (z > -1.5) {
    return {
      bg: 'bg-cyan-500/20',
      text: 'text-cyan-400',
      border: 'border-cyan-500/30',
      label: 'Moderate Negative',
    }
  }
  return {
    bg: 'bg-blue-600/30',
    text: 'text-blue-400',
    border: 'border-blue-500/40',
    label: 'Extreme Negative',
  }
}

// ─── Extreme Anomaly Card Component ──────────────────────────────────────────
function ExtremeCard({ stat }: { stat: VariableStats }) {
  const icon = stat.variable === 'temperature' ? '🌡' : stat.variable === 'rainfall' ? '🌧' : '🏭'
  const high = stat.highest_positive
  const low = stat.lowest_negative

  return (
    <div className="bg-[#0d1428] border border-white/5 rounded-xl p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="text-xl p-2 rounded-lg bg-white/5">{icon}</span>
          <div>
            <h3 className="text-sm font-semibold text-white">{stat.label}</h3>
            <p className="text-[11px] text-gray-400">
              μ = {formatValue(stat.variable, stat.mean)} · σ = {stat.variable === 'co2' ? `${(stat.std / 1e6).toFixed(0)}M` : stat.std} {stat.unit}
            </p>
          </div>
        </div>
      </div>

      {/* Extremes Grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Highest Positive Anomaly */}
        <div className="bg-rose-500/10 border border-rose-500/20 rounded-lg p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-medium text-rose-400 uppercase tracking-wider">Highest Positive</span>
            <span className="text-xs font-bold px-2 py-0.5 rounded bg-rose-500/20 text-rose-300">
              {high.year}
            </span>
          </div>
          <div className="my-1">
            <div className="text-xl font-extrabold text-rose-300 tabular-nums">
              +{high.anomaly.toFixed(2)}σ
            </div>
            <p className="text-xs text-gray-300 mt-0.5">
              {formatValue(stat.variable, high.observed)}
            </p>
          </div>
          <p className="text-[10px] text-gray-400">
            +{stat.variable === 'co2' ? `${((high.observed - stat.mean) / 1e6).toFixed(0)}M` : (high.observed - stat.mean).toFixed(2)} {stat.unit} from mean
          </p>
        </div>

        {/* Lowest Negative Anomaly */}
        <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-lg p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-medium text-cyan-400 uppercase tracking-wider">Lowest Negative</span>
            <span className="text-xs font-bold px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300">
              {low.year}
            </span>
          </div>
          <div className="my-1">
            <div className="text-xl font-extrabold text-cyan-300 tabular-nums">
              {low.anomaly.toFixed(2)}σ
            </div>
            <p className="text-xs text-gray-300 mt-0.5">
              {formatValue(stat.variable, low.observed)}
            </p>
          </div>
          <p className="text-[10px] text-gray-400">
            {stat.variable === 'co2' ? `${((low.observed - stat.mean) / 1e6).toFixed(0)}M` : (low.observed - stat.mean).toFixed(2)} {stat.unit} from mean
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Heatmap Component ────────────────────────────────────────────────────────
interface HeatmapProps {
  records: YearAnomalyRecord[]
  stats: VariableStats[]
}

function AnomalyHeatmap({ records, stats }: HeatmapProps) {
  const [hoveredCell, setHoveredCell] = useState<{
    year: number
    variable: string
    label: string
    observed: number
    anomaly: number
    mean: number
    unit: string
  } | null>(null)

  const rows = [
    { key: 'temperature', label: 'Temperature', icon: '🌡', unit: '°C' },
    { key: 'rainfall', label: 'Rainfall', icon: '🌧', unit: 'mm' },
    { key: 'co2', label: 'CO₂ Emissions', icon: '🏭', unit: 'tonnes' },
  ]

  const getStat = (key: string) => stats.find((s) => s.variable === key)

  return (
    <div className="bg-[#0d1428] border border-white/5 rounded-xl p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-base font-semibold text-white">
            Standardized Climate Anomalies Heatmap (2000–2024)
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Normalized anomaly z-scores [Anomaly = (Observed - Mean) / StdDev] across all 25 years.
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-2 text-[10px] text-gray-400 flex-wrap">
          <span className="font-medium text-gray-500 uppercase">Scale:</span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-blue-600/80 inline-block border border-blue-400/40" />
            &lt; -1.5σ
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-cyan-500/40 inline-block border border-cyan-400/30" />
            -1.5 to -0.5σ
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-slate-800 inline-block border border-white/10" />
            ±0.5σ Normal
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-amber-500/40 inline-block border border-amber-400/30" />
            +0.5 to +1.5σ
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-rose-500/80 inline-block border border-rose-400/40" />
            &gt; +1.5σ
          </span>
        </div>
      </div>

      {/* Heatmap Grid Container */}
      <div className="overflow-x-auto pb-2">
        <div className="min-w-[900px]">
          {/* Year Headers */}
          <div className="grid grid-cols-[140px_repeat(25,1fr)] gap-1 mb-1.5 items-center">
            <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider pl-1">
              Variable
            </div>
            {records.map((r) => (
              <div
                key={r.year}
                className="text-center text-[10px] font-mono text-gray-400 font-medium py-1"
                title={`Year ${r.year}`}
              >
                '{String(r.year).slice(2)}
              </div>
            ))}
          </div>

          {/* Rows */}
          {rows.map((row) => {
            const stat = getStat(row.key)
            return (
              <div
                key={row.key}
                className="grid grid-cols-[140px_repeat(25,1fr)] gap-1 mb-1.5 items-stretch"
              >
                {/* Row Header */}
                <div className="flex items-center gap-2 px-2 py-2 rounded-lg bg-white/[0.02] border border-white/5 text-xs font-medium text-gray-300">
                  <span>{row.icon}</span>
                  <span className="truncate">{row.label}</span>
                </div>

                {/* Cells */}
                {records.map((r) => {
                  let anom = 0
                  let obs = 0
                  if (row.key === 'temperature') {
                    anom = r.temperature_anomaly
                    obs = r.temperature
                  } else if (row.key === 'rainfall') {
                    anom = r.rainfall_anomaly
                    obs = r.rainfall
                  } else {
                    anom = r.co2_anomaly
                    obs = r.co2
                  }

                  const color = getAnomalyColor(anom)
                  const isHovered =
                    hoveredCell?.year === r.year && hoveredCell?.variable === row.key

                  return (
                    <button
                      key={r.year}
                      type="button"
                      onMouseEnter={() =>
                        setHoveredCell({
                          year: r.year,
                          variable: row.key,
                          label: row.label,
                          observed: obs,
                          anomaly: anom,
                          mean: stat ? stat.mean : 0,
                          unit: row.unit,
                        })
                      }
                      onMouseLeave={() => setHoveredCell(null)}
                      className={`relative h-11 rounded flex flex-col items-center justify-center p-0.5 transition-all duration-150 border cursor-pointer ${
                        color.bg
                      } ${color.border} ${
                        isHovered
                          ? 'ring-2 ring-white scale-105 z-10 shadow-lg shadow-black/50'
                          : 'hover:opacity-90'
                      }`}
                      title={`${r.year} ${row.label}: ${anom >= 0 ? '+' : ''}${anom.toFixed(2)}σ (${obs} ${row.unit})`}
                    >
                      <span
                        className={`text-[10px] font-bold font-mono tabular-nums leading-tight ${color.text}`}
                      >
                        {anom >= 0 ? '+' : ''}
                        {anom.toFixed(1)}
                      </span>
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>

      {/* Interactive Tooltip Inspector Bar */}
      <div className="mt-4 pt-3 border-t border-white/5 min-h-[44px] flex items-center justify-between text-xs">
        {hoveredCell ? (
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-gray-400">Year:</span>
              <span className="font-bold text-white bg-white/10 px-2 py-0.5 rounded text-xs">
                {hoveredCell.year}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-gray-400">Variable:</span>
              <span className="font-medium text-cyan-300">{hoveredCell.label}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-gray-400">Standardized Anomaly:</span>
              <span
                className={`font-bold tabular-nums ${
                  hoveredCell.anomaly >= 0 ? 'text-rose-400' : 'text-cyan-400'
                }`}
              >
                {hoveredCell.anomaly >= 0 ? '+' : ''}
                {hoveredCell.anomaly.toFixed(4)}σ
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-gray-400">Observed:</span>
              <span className="font-medium text-white">
                {formatValue(hoveredCell.variable, hoveredCell.observed)}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-gray-400">Mean Baseline:</span>
              <span className="text-gray-400">
                {formatValue(hoveredCell.variable, hoveredCell.mean)}
              </span>
            </div>
          </div>
        ) : (
          <p className="text-gray-500 italic text-[11px]">
            Hover over any cell in the heatmap to inspect exact standardized anomaly, observed value, and deviation.
          </p>
        )}
      </div>
    </div>
  )
}

// ─── Unusual Observations Table ───────────────────────────────────────────────
interface TableProps {
  observations: UnusualObservation[]
}

function UnusualObservationsTable({ observations }: TableProps) {
  const [filter, setFilter] = useState<'all' | 'temperature' | 'rainfall' | 'co2'>('all')

  const filtered = observations.filter((obs) => {
    if (filter === 'all') return true
    return obs.variable === filter
  })

  return (
    <div className="bg-[#0d1428] border border-white/5 rounded-xl p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
        <div>
          <h2 className="text-base font-semibold text-white">Unusual Climate Observations</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Years recording standardized anomalies of |z| ≥ 1.0σ from the 2000–2024 mean baseline.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 bg-white/5 p-1 rounded-lg">
          {(
            [
              { id: 'all', label: 'All' },
              { id: 'temperature', label: 'Temperature' },
              { id: 'rainfall', label: 'Rainfall' },
              { id: 'co2', label: 'CO₂' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${
                filter === tab.id
                  ? 'bg-cyan-500/20 text-cyan-400 shadow-sm'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-white/5 text-gray-400 uppercase text-[10px] tracking-wider">
              <th className="pb-3 font-semibold pl-2">Year</th>
              <th className="pb-3 font-semibold">Variable</th>
              <th className="pb-3 font-semibold">Observed Value</th>
              <th className="pb-3 font-semibold">Anomaly (z-score)</th>
              <th className="pb-3 font-semibold">Classification</th>
              <th className="pb-3 font-semibold pr-2">Context & Deviation</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filtered.map((obs, idx) => {
              const isPositive = obs.anomaly_value > 0
              const colorClass = isPositive
                ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'

              const icon =
                obs.variable === 'temperature' ? '🌡' : obs.variable === 'rainfall' ? '🌧' : '🏭'

              return (
                <tr key={`${obs.year}-${obs.variable}-${idx}`} className="hover:bg-white/[0.02] transition-colors">
                  <td className="py-3 pl-2 font-mono font-bold text-white">{obs.year}</td>
                  <td className="py-3">
                    <span className="inline-flex items-center gap-1.5 font-medium text-gray-200">
                      <span>{icon}</span>
                      <span>{obs.variable_label}</span>
                    </span>
                  </td>
                  <td className="py-3 font-mono text-gray-300">
                    {formatValue(obs.variable, obs.observed_value)}
                  </td>
                  <td className="py-3 font-mono font-bold">
                    <span
                      className={`inline-block px-2 py-0.5 rounded border text-[11px] tabular-nums ${colorClass}`}
                    >
                      {isPositive ? '+' : ''}
                      {obs.anomaly_value.toFixed(2)}σ
                    </span>
                  </td>
                  <td className="py-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide ${
                        obs.severity === 'Extreme'
                          ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                          : obs.severity === 'High'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-slate-700/50 text-slate-300 border border-white/10'
                      }`}
                    >
                      {obs.severity} {obs.anomaly_type}
                    </span>
                  </td>
                  <td className="py-3 pr-2 text-gray-400 text-[11px] max-w-xs">{obs.description}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function AnomalyDetection() {
  const { data, loading, error } = useAnomaly()

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
          <span className="text-xs text-rose-400 font-medium uppercase tracking-widest">
            Climate Anomaly Detection
          </span>
        </div>
        <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">
          Standardized Climate Anomalies · 2000–2024
        </h1>
        <p className="text-gray-400 text-sm max-w-2xl">
          Standardized anomaly analysis computed dynamically using{' '}
          <code className="text-cyan-300 bg-white/5 px-1.5 py-0.5 rounded text-xs font-mono">
            Anomaly = (Observed - Mean) / StdDev
          </code>{' '}
          to identify statistically unusual years across Temperature, Rainfall, and CO₂ emissions.
        </p>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400">
          <span>⚠</span>
          <div>
            <p className="font-medium">Failed to load anomaly data</p>
            <p className="text-xs text-red-400/80">{error}</p>
          </div>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && !data && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-48 bg-white/5 rounded-xl animate-pulse" />
            ))}
          </div>
          <div className="h-64 bg-white/5 rounded-xl animate-pulse" />
          <div className="h-48 bg-white/5 rounded-xl animate-pulse" />
        </div>
      )}

      {/* Content */}
      {data && (
        <>

          {/* Section 1: Extreme Anomalies Cards */}
          <div>
            <div className="mb-3">
              <h2 className="text-base font-semibold text-white">Peak Positive & Negative Anomalies</h2>
              <p className="text-xs text-gray-400">
                Highest and lowest standardized anomalies for each climate variable.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {data.stats.map((stat) => (
                <ExtremeCard key={stat.variable} stat={stat} />
              ))}
            </div>
          </div>

          {/* Section 2: Heatmap */}
          <AnomalyHeatmap records={data.records} stats={data.stats} />

          {/* Section 3: Unusual Observations Table */}
          <UnusualObservationsTable observations={data.unusual_observations} />
        </>
      )}
    </div>
  )
}
