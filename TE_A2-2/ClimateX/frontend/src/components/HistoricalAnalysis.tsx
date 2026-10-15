import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { useHistorical } from '../hooks/useHistorical'
import { CorrelationPair } from '../types/climate'

// ─── Shared tooltip style ────────────────────────────────────────────────────
const tooltipStyle = {
  backgroundColor: '#0d1428',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '8px',
  color: '#e2e8f0',
  fontSize: '12px',
}
const tooltipLabelStyle = { color: '#94a3b8', marginBottom: 4 }

// ─── Skeleton loader ─────────────────────────────────────────────────────────
function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`bg-white/5 rounded-lg animate-pulse ${className}`} />
}

// ─── Correlation badge (enhanced) ────────────────────────────────────────────
const CORR_REASONS: Record<string, string> = {
  'Temperature vs Rainfall': 'Temperature and rainfall show almost no linear association.',
  'Temperature vs CO₂':      'Both variables tend to increase together in the observed data.',
  'Rainfall vs CO₂':         'The variables show only a limited tendency to increase together.',
}

function strengthLabel(abs: number, positive: boolean): { label: string; color: string } {
  if (abs < 0.1) return { label: 'Negligible', color: 'text-gray-400' }
  if (abs < 0.3) return { label: positive ? 'Weak positive' : 'Weak negative', color: 'text-amber-400' }
  if (abs < 0.5) return { label: positive ? 'Moderate positive' : 'Moderate negative', color: 'text-orange-400' }
  if (abs < 0.7) return { label: positive ? 'Moderate positive' : 'Moderate negative', color: 'text-emerald-400' }
  if (abs < 0.9) return { label: positive ? 'Strong positive' : 'Strong negative', color: 'text-cyan-400' }
  return { label: positive ? 'Very strong positive' : 'Very strong negative', color: 'text-cyan-300' }
}

function CorrCard({ pair }: { pair: CorrelationPair }) {
  const r = pair.coefficient
  const abs = Math.abs(r)
  const isPos = r >= 0
  const { label: sLabel, color: sColor } = strengthLabel(abs, isPos)

  // card border/bg tones by strength
  const cardTone =
    abs >= 0.5 ? 'border-emerald-500/20 bg-emerald-500/5'
    : abs >= 0.2 ? 'border-amber-500/20 bg-amber-500/5'
    : 'border-white/10 bg-white/[0.03]'

  // bar fill colour
  const barFill =
    abs >= 0.5 ? '#34d399'   // emerald
    : abs >= 0.2 ? '#fbbf24' // amber
    : '#6b7280'              // gray

  const barW = Math.round(abs * 100)
  const reason = CORR_REASONS[pair.label] ?? pair.interpretation

  return (
    <div className={`border rounded-xl p-5 flex flex-col gap-3 ${cardTone}`}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-gray-200 leading-snug">{pair.label}</p>
        <span className="text-lg font-bold tabular-nums shrink-0 text-white">
          {r >= 0 ? '+' : ''}{r.toFixed(4)}
        </span>
      </div>
      {/* Visual bar */}
      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${barW}%`, backgroundColor: barFill }}
        />
      </div>
      {/* Strength label */}
      <p className={`text-xs font-semibold ${sColor}`}>{sLabel} relationship</p>
      {/* Short reason */}
      <p className="text-xs text-gray-400 leading-relaxed border-t border-white/5 pt-2">{reason}</p>
    </div>
  )
}

// ─── Correlation heatmap (3×3) ────────────────────────────────────────────────
const HEATMAP_VARS = ['Temperature', 'Rainfall', 'CO₂']

function corrColor(r: number): string {
  const abs = Math.abs(r)
  if (r === 1)      return 'bg-white/10 text-white'
  if (abs >= 0.5)   return r > 0 ? 'bg-emerald-500/25 text-emerald-300' : 'bg-rose-500/25 text-rose-300'
  if (abs >= 0.2)   return r > 0 ? 'bg-amber-500/20 text-amber-300'    : 'bg-rose-500/15 text-rose-400'
  return 'bg-white/5 text-gray-400'
}

function CorrelationHeatmap({ pairs }: { pairs: CorrelationPair[] }) {
  // Build lookup
  const lookup: Record<string, number> = { '0-0': 1, '1-1': 1, '2-2': 1 }
  pairs.forEach((p) => {
    if (p.label === 'Temperature vs Rainfall') { lookup['0-1'] = p.coefficient; lookup['1-0'] = p.coefficient }
    if (p.label === 'Temperature vs CO₂')      { lookup['0-2'] = p.coefficient; lookup['2-0'] = p.coefficient }
    if (p.label === 'Rainfall vs CO₂')         { lookup['1-2'] = p.coefficient; lookup['2-1'] = p.coefficient }
  })

  return (
    <div className="mt-5 bg-[#070b16] border border-white/8 rounded-xl p-4">
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-3">Correlation Heatmap</p>
      <div className="grid grid-cols-4 gap-1.5">
        {/* Top-left empty corner */}
        <div />
        {HEATMAP_VARS.map((v) => (
          <div key={v} className="text-center text-[10px] font-semibold text-gray-400 truncate">{v}</div>
        ))}
        {HEATMAP_VARS.map((row, ri) => [
          <div key={`row-${ri}`} className="text-[10px] font-semibold text-gray-400 flex items-center">{row}</div>,
          ...HEATMAP_VARS.map((_, ci) => {
            const r = lookup[`${ri}-${ci}`] ?? 0
            const isDiag = ri === ci
            return (
              <div
                key={`${ri}-${ci}`}
                className={`rounded-lg p-2 text-center ${ isDiag ? 'bg-white/8 text-white/50' : corrColor(r) }`}
              >
                <span className="text-[11px] font-bold tabular-nums block">
                  {isDiag ? '1.00' : `${r >= 0 ? '+' : ''}${r.toFixed(2)}`}
                </span>
              </div>
            )
          }),
        ])}
      </div>
    </div>
  )
}

// ─── Section header ────────────────────────────────────────────────────────────
function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-base font-semibold text-white">{title}</h2>
      {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function HistoricalAnalysis() {
  const { data, loading, error } = useHistorical()

  // Format CO₂ for axis tick
  const formatCO2Tick = (v: number) => `${(v / 1e9).toFixed(2)} Gt`
  const formatCO2Tooltip = (v: number) =>
    `${(v / 1e9).toFixed(3)} Gt`

  return (
    <div className="flex-1 overflow-y-auto p-6">
      {/* Page header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span className="text-xs text-cyan-400 font-medium uppercase tracking-widest">Historical Analysis</span>
        </div>
        <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">
          Trend Analysis · 2000–2024
        </h1>
        <p className="text-gray-400 text-sm max-w-xl">
          Year-wise breakdown of India's temperature, rainfall, and CO₂ emissions with
          Pearson correlation analysis and auto-generated insights.
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400">
          <span>⚠</span>
          <div>
            <p className="font-medium">Failed to load historical data</p>
            <p className="text-xs text-red-400/70 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* ── Mean KPI row ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        {[
          {
            label: 'Mean Temperature',
            value: loading ? null : data ? `${data.mean_temperature.toFixed(2)} °C` : '—',
            icon: '🌡',
            color: 'border-cyan-500/10 bg-cyan-500/5',
          },
          {
            label: 'Mean Rainfall',
            value: loading ? null : data ? `${data.mean_rainfall.toFixed(1)} mm` : '—',
            icon: '🌧',
            color: 'border-emerald-500/10 bg-emerald-500/5',
          },
          {
            label: 'Mean CO₂',
            value: loading ? null : data
              ? `${(data.mean_co2 / 1e9).toFixed(3)} Gt`
              : '—',
            icon: '🏭',
            color: 'border-amber-500/10 bg-amber-500/5',
          },
        ].map((kpi) => (
          <div key={kpi.label} className={`border rounded-xl px-5 py-4 flex items-center gap-4 ${kpi.color}`}>
            <span className="text-2xl">{kpi.icon}</span>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-widest font-medium">{kpi.label}</p>
              {kpi.value === null
                ? <Skeleton className="h-6 w-28 mt-1" />
                : <p className="text-xl font-bold text-white">{kpi.value}</p>}
            </div>
          </div>
        ))}
      </div>

      {/* ── Charts ─────────────────────────────────────────────────────────── */}
      <div className="space-y-6 mb-8">

        {/* Temperature chart */}
        <div className="bg-[#0d1428] border border-white/5 rounded-xl p-5">
          <SectionHeader
            title="Temperature Trend"
            subtitle="Annual mean surface temperature (°C)"
          />
          {loading ? <Skeleton className="h-56" /> : data && (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={data.records} margin={{ top: 4, right: 16, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="year" tick={{ fill: '#6b7280', fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis
                  tick={{ fill: '#6b7280', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  domain={['auto', 'auto']}
                  tickFormatter={(v: number) => `${v}°`}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelStyle={tooltipLabelStyle}
                  formatter={(v: any) => [`${Number(v).toFixed(4)} °C`, 'Temperature']}
                />
                <Legend
                  wrapperStyle={{ fontSize: 11, color: '#9ca3af', paddingTop: 8 }}
                />
                <ReferenceLine
                  y={data.mean_temperature}
                  stroke="rgba(6,182,212,0.3)"
                  strokeDasharray="4 4"
                  label={{ value: `Mean ${data.mean_temperature.toFixed(2)}°C`, fill: '#06b6d4', fontSize: 10, position: 'insideTopRight' }}
                />
                <Line
                  type="monotone"
                  dataKey="temperature"
                  name="Temperature (°C)"
                  stroke="#06b6d4"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#06b6d4', strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: '#06b6d4' }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Rainfall chart */}
        <div className="bg-[#0d1428] border border-white/5 rounded-xl p-5">
          <SectionHeader
            title="Rainfall Trend"
            subtitle="Annual precipitation (mm)"
          />
          {loading ? <Skeleton className="h-56" /> : data && (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={data.records} margin={{ top: 4, right: 16, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="year" tick={{ fill: '#6b7280', fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis
                  tick={{ fill: '#6b7280', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  domain={['auto', 'auto']}
                  tickFormatter={(v: number) => `${v}`}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelStyle={tooltipLabelStyle}
                  formatter={(v: any) => [`${Number(v).toFixed(1)} mm`, 'Rainfall']}
                />
                <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af', paddingTop: 8 }} />
                <ReferenceLine
                  y={data.mean_rainfall}
                  stroke="rgba(16,185,129,0.3)"
                  strokeDasharray="4 4"
                  label={{ value: `Mean ${data.mean_rainfall.toFixed(1)} mm`, fill: '#10b981', fontSize: 10, position: 'insideTopRight' }}
                />
                <Line
                  type="monotone"
                  dataKey="rainfall"
                  name="Rainfall (mm)"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#10b981', strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: '#10b981' }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* CO₂ chart */}
        <div className="bg-[#0d1428] border border-white/5 rounded-xl p-5">
          <SectionHeader
            title="CO₂ Emissions Trend"
            subtitle="Annual emissions (Gt)"
          />
          {loading ? <Skeleton className="h-56" /> : data && (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={data.records} margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="year" tick={{ fill: '#6b7280', fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis
                  tick={{ fill: '#6b7280', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={formatCO2Tick}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelStyle={tooltipLabelStyle}
                  formatter={(v: any) => [formatCO2Tooltip(Number(v)), 'CO₂ Emissions']}
                />
                <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af', paddingTop: 8 }} />
                <ReferenceLine
                  y={data.mean_co2}
                  stroke="rgba(245,158,11,0.3)"
                  strokeDasharray="4 4"
                  label={{ value: `Mean ${(data.mean_co2 / 1e9).toFixed(2)} Gt`, fill: '#f59e0b', fontSize: 10, position: 'insideTopRight' }}
                />
                <Line
                  type="monotone"
                  dataKey="co2"
                  name="CO₂ (Gt)"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#f59e0b', strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: '#f59e0b' }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Correlations ─────────────────────────────────────────────────────── */}
      <div className="mb-8">
        <SectionHeader
          title="Pearson Correlation Analysis"
          subtitle="Linear relationship strength between climate variables (−1 to +1)"
        />

        {/* Plain-English explanation */}
        <p className="text-xs text-gray-400 leading-relaxed mb-5 bg-white/[0.02] border border-white/5 rounded-xl px-4 py-3">
          Pearson correlation measures the strength and direction of a linear relationship between two variables.
          In ClimateX, it helps us understand how temperature, rainfall, and CO₂ emissions vary together.
          {' '}<span className="text-amber-400/80 font-medium">Correlation does not imply causation.</span>
        </p>

        {loading ? (
          <div className="grid grid-cols-3 gap-4">
            <Skeleton className="h-36" />
            <Skeleton className="h-36" />
            <Skeleton className="h-36" />
          </div>
        ) : data && (
          <>
            {/* Correlation cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {data.correlations.map((pair) => (
                <CorrCard key={pair.label} pair={pair} />
              ))}
            </div>

            {/* Correlation scale −1 to +1 */}
            <div className="mt-5 bg-[#070b16] border border-white/8 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Correlation Scale</p>
                <p className="text-[10px] text-gray-500">Observed values marked ▼</p>
              </div>
              {/* Gradient bar */}
              <div
                className="relative h-3 w-full rounded-full mb-1"
                style={{ background: 'linear-gradient(to right, #f43f5e 0%, #fb923c 20%, #6b7280 45%, #6b7280 55%, #fbbf24 65%, #34d399 82%, #22d3ee 100%)' }}
              >
                {/* Markers for each correlation */}
                {data.correlations.map((pair) => {
                  const pct = ((pair.coefficient + 1) / 2) * 100
                  return (
                    <div
                      key={pair.label}
                      className="absolute top-0 -translate-x-1/2"
                      style={{ left: `${pct}%` }}
                      title={`${pair.label}: r = ${pair.coefficient >= 0 ? '+' : ''}${pair.coefficient.toFixed(4)}`}
                    >
                      <div className="w-0.5 h-3 bg-white/80" />
                      <div className="text-[8px] text-white/70 font-mono text-center mt-0.5 whitespace-nowrap">
                        {pair.coefficient >= 0 ? '+' : ''}{pair.coefficient.toFixed(2)}
                      </div>
                    </div>
                  )
                })}
              </div>
              {/* Scale labels */}
              <div className="flex justify-between text-[9px] font-mono mt-3">
                <span className="text-rose-400">−1 Perfect negative</span>
                <span className="text-gray-500">0 No relationship</span>
                <span className="text-cyan-400">+1 Perfect positive</span>
              </div>
            </div>

            {/* Heatmap */}
            <CorrelationHeatmap pairs={data.correlations} />
          </>
        )}
      </div>

      {/* ── Auto-generated interpretation ─────────────────────────────────────── */}
      {!loading && data && (
        <div className="bg-[#0d1428] border border-cyan-500/10 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-base">💡</span>
            <h2 className="text-sm font-semibold text-white">In a Nutshell</h2>
          </div>
          <p className="text-sm text-gray-300 leading-relaxed">{data.trend_summary}</p>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {[
              { label: 'Temperature', value: data.temp_trend, icon: '🌡' },
              { label: 'Rainfall', value: data.rainfall_pattern, icon: '🌧' },
              { label: 'CO₂', value: data.co2_trend, icon: '🏭' },
            ].map((item) => (
              <div key={item.label} className="bg-white/5 border border-white/5 rounded-lg px-4 py-3">
                <p className="text-xs text-gray-500 uppercase tracking-widest">{item.icon} {item.label}</p>
                <p className="text-sm font-semibold text-white mt-1 capitalize">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
