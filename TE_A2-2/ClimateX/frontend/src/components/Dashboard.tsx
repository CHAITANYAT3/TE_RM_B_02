import { useMemo } from 'react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  YAxis,
  Tooltip,
} from 'recharts'
import { DatasetSummary } from '../types/climate'
import KpiCard from './KpiCard'
import { useHistorical } from '../hooks/useHistorical'

interface DashboardProps {
  data: DatasetSummary | null
  loading: boolean
  error: string | null
}

function formatCO2(value: number | null): string {
  if (value === null) return '—'
  const gt = value / 1_000_000_000
  return gt.toFixed(2)
}

const tooltipStyle = {
  backgroundColor: '#0d1428',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '8px',
  color: '#e2e8f0',
  fontSize: '11px',
}

export default function Dashboard({ data, loading, error }: DashboardProps) {
  const { data: histData, loading: histLoading } = useHistorical()

  const records = histData?.records ?? []

  // Compute latest values, change since 2000, and trendline datasets from real CSV records
  const nationalSummary = useMemo(() => {
    if (!records.length) return null
    const firstRec = records[0] // Year 2000
    const lastRec = records[records.length - 1] // Year 2024

    // 1. Temperature
    const tempLatest = lastRec.temperature
    const tempBase2000 = firstRec.temperature
    const tempDelta = tempLatest - tempBase2000
    const tempDeltaPct = tempBase2000 !== 0 ? (tempDelta / tempBase2000) * 100 : 0
    const tempSeries = records.map((r) => ({
      year: r.year,
      value: Number(r.temperature.toFixed(2)),
    }))

    // 2. Rainfall
    const rainLatest = lastRec.rainfall
    const rainBase2000 = firstRec.rainfall
    const rainDelta = rainLatest - rainBase2000
    const rainDeltaPct = rainBase2000 !== 0 ? (rainDelta / rainBase2000) * 100 : 0
    const rainSeries = records.map((r) => ({
      year: r.year,
      value: Math.round(r.rainfall),
    }))

    // 3. CO2
    const co2LatestGt = lastRec.co2 / 1e9
    const co2BaseGt = firstRec.co2 / 1e9
    const co2DeltaGt = co2LatestGt - co2BaseGt
    const co2DeltaPct = firstRec.co2 !== 0 ? ((lastRec.co2 - firstRec.co2) / firstRec.co2) * 100 : 0
    const co2Series = records.map((r) => ({
      year: r.year,
      value: Number((r.co2 / 1e9).toFixed(2)),
    }))

    return {
      firstRec,
      lastRec,
      temperature: {
        latest: tempLatest,
        base2000: tempBase2000,
        delta: tempDelta,
        deltaPct: tempDeltaPct,
        series: tempSeries,
      },
      rainfall: {
        latest: rainLatest,
        base2000: rainBase2000,
        delta: rainDelta,
        deltaPct: rainDeltaPct,
        series: rainSeries,
      },
      co2: {
        latest: co2LatestGt,
        base2000: co2BaseGt,
        delta: co2DeltaGt,
        deltaPct: co2DeltaPct,
        series: co2Series,
      },
    }
  }, [records])

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 max-w-full">
      {/* ─── Header ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-emerald-400 font-semibold uppercase tracking-widest">
              National Dataset · 25 Observations
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            India Climate Intelligence
          </h1>
          <p className="text-gray-400 text-xs sm:text-sm mt-1 max-w-xl">
            National aggregate climate data covering temperature, rainfall, and CO₂ emissions
            across the 2000–2024 time series.
          </p>
        </div>

        <div className="bg-[#0d1428] border border-white/10 rounded-xl px-4 py-2 self-start md:self-auto text-right">
          <span className="text-[10px] text-gray-500 uppercase font-mono block">Scope</span>
          <span className="text-xs font-bold text-cyan-300 font-mono">National Aggregate Only</span>
        </div>
      </div>

      {/* ─── Error Banner ──────────────────────────────────────────────────── */}
      {error && (
        <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400">
          <span className="text-base">⚠</span>
          <div>
            <p className="font-medium">Backend connection failed</p>
            <p className="text-red-400/70 text-xs mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* ─── Top Cards (Kept as requested): Study Period, Observations, Variables ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {[
          {
            label: 'Study Period',
            value: loading ? null : (data ? `${data.start_year}–${data.end_year}` : '—'),
            sub: '25 consecutive years',
            icon: '📅',
          },
          {
            label: 'Observations',
            value: loading ? null : (data ? `${data.observation_count} Records` : '—'),
            sub: 'Annual national totals',
            icon: '📊',
          },
          {
            label: 'Variables',
            value: loading ? null : (data ? `${data.column_names.length} columns` : '—'),
            sub: data?.column_names ? data.column_names.join(', ') : 'All 7 columns',
            icon: '🔬',
          },
        ].map((item) => (
          <div
            key={item.label}
            className="bg-[#0d1428] border border-white/5 rounded-xl px-5 py-4 flex items-center gap-4"
          >
            <span className="text-2xl">{item.icon}</span>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-gray-500 uppercase tracking-widest font-medium">{item.label}</p>
              {loading ? (
                <div className="h-5 w-16 bg-white/5 rounded animate-pulse mt-1" />
              ) : (
                <>
                  <p className="text-lg font-bold text-white">{item.value}</p>
                  <p className="text-[10px] text-gray-400 font-mono mt-0.5 truncate" title={item.sub}>{item.sub}</p>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ─── Top Cards (Kept as requested): 2000–2024 Average Indicators ───── */}
      <div>
        <h2 className="text-xs text-gray-500 uppercase tracking-widest font-semibold mb-3">
          25-Year Average Indicators (2000–2024)
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <KpiCard
            icon="🌡"
            label="Avg Temperature"
            value={data ? data.average_temperature.toFixed(2) : null}
            unit="°C"
            subLabel="Annual mean across 25 years"
            accentColor="cyan"
            loading={loading}
          />
          <KpiCard
            icon="🌧"
            label="Avg Rainfall"
            value={data ? data.average_rainfall.toFixed(1) : null}
            unit="mm"
            subLabel="Annual mean precipitation"
            accentColor="green"
            loading={loading}
          />
          <KpiCard
            icon="🏭"
            label="Avg CO₂ Emissions"
            value={data ? formatCO2(data.average_co2) : null}
            unit="Gt"
            subLabel="Annual national mean"
            accentColor="amber"
            loading={loading}
          />
        </div>
      </div>

      {/* ─── 3 BIG CARDS: Temperature, Rainfall, CO2 (Latest, Change since 2000, Trend Line) ─ */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs text-gray-400 uppercase tracking-widest font-semibold">
            National Trends · 2000 vs 2024 Latest Observation
          </h2>
          <span className="text-[11px] text-gray-500 font-mono">25-Year Trajectories</span>
        </div>

        {histLoading || !nationalSummary ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-56 bg-white/5 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* 1. BIG CARD: TEMPERATURE */}
            <div className="bg-[#0d1428] border border-white/5 hover:border-amber-500/30 transition-all rounded-2xl p-5 flex flex-col justify-between space-y-4 shadow-xl">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">
                      Temperature
                    </span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 border border-white/10 text-gray-400">
                    2024 Latest
                  </span>
                </div>

                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-3xl sm:text-4xl font-black text-amber-400 font-mono tabular-nums">
                    {nationalSummary.temperature.latest.toFixed(2)}
                  </span>
                  <span className="text-xl font-bold text-gray-400">°C</span>
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <span
                    className={`text-xs font-mono font-bold px-2.5 py-1 rounded border ${
                      nationalSummary.temperature.delta >= 0
                        ? 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                        : 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
                    }`}
                  >
                    {nationalSummary.temperature.delta >= 0 ? '+' : ''}
                    {nationalSummary.temperature.delta.toFixed(2)} °C
                  </span>
                  <span className="text-xs text-gray-400">
                    ({nationalSummary.temperature.deltaPct >= 0 ? '+' : ''}
                    {nationalSummary.temperature.deltaPct.toFixed(1)}% since 2000)
                  </span>
                </div>
              </div>

              {/* Small Trend Line */}
              <div className="space-y-1 pt-2 border-t border-white/5">
                <div className="flex justify-between text-[10px] text-gray-500 font-mono">
                  <span>2000: {nationalSummary.temperature.base2000.toFixed(2)}°C</span>
                  <span>2024: {nationalSummary.temperature.latest.toFixed(2)}°C</span>
                </div>
                <div className="h-16 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={nationalSummary.temperature.series}
                      margin={{ top: 5, right: 6, bottom: 5, left: 6 }}
                    >
                      <defs>
                        <linearGradient id="tempDashGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <YAxis
                        domain={[(min: number) => Number((min - 0.15).toFixed(2)), (max: number) => Number((max + 0.15).toFixed(2))]}
                        hide
                      />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(val: any) => [`${Number(val).toFixed(2)} °C`, 'Temperature']}
                        labelFormatter={(label) => `Year: ${label}`}
                      />
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke="#f59e0b"
                        strokeWidth={2.5}
                        fill="url(#tempDashGrad)"
                        dot={(props: any) => {
                          const { cx, cy, index } = props
                          if (index === 0 || index === nationalSummary.temperature.series.length - 1) {
                            return (
                              <circle
                                key={`temp-dot-${index}`}
                                cx={cx}
                                cy={cy}
                                r={3.5}
                                fill="#f59e0b"
                                stroke="#ffffff"
                                strokeWidth={1.5}
                              />
                            )
                          }
                          return null
                        }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* 2. BIG CARD: RAINFALL */}
            <div className="bg-[#0d1428] border border-white/5 hover:border-cyan-500/30 transition-all rounded-2xl p-5 flex flex-col justify-between space-y-4 shadow-xl">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-cyan-500" />
                    <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">
                      Rainfall
                    </span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 border border-white/10 text-gray-400">
                    2024 Latest
                  </span>
                </div>

                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-3xl sm:text-4xl font-black text-cyan-400 font-mono tabular-nums">
                    {nationalSummary.rainfall.latest.toFixed(1)}
                  </span>
                  <span className="text-xl font-bold text-gray-400">mm</span>
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <span
                    className={`text-xs font-mono font-bold px-2.5 py-1 rounded border ${
                      nationalSummary.rainfall.delta >= 0
                        ? 'bg-blue-500/10 text-blue-300 border-blue-500/30'
                        : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                    }`}
                  >
                    {nationalSummary.rainfall.delta >= 0 ? '+' : ''}
                    {nationalSummary.rainfall.delta.toFixed(1)} mm
                  </span>
                  <span className="text-xs text-gray-400">
                    ({nationalSummary.rainfall.deltaPct >= 0 ? '+' : ''}
                    {nationalSummary.rainfall.deltaPct.toFixed(1)}% since 2000)
                  </span>
                </div>
              </div>

              {/* Small Trend Line */}
              <div className="space-y-1 pt-2 border-t border-white/5">
                <div className="flex justify-between text-[10px] text-gray-500 font-mono">
                  <span>2000: {nationalSummary.rainfall.base2000.toFixed(0)} mm</span>
                  <span>2024: {nationalSummary.rainfall.latest.toFixed(0)} mm</span>
                </div>
                <div className="h-16 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={nationalSummary.rainfall.series}
                      margin={{ top: 5, right: 6, bottom: 5, left: 6 }}
                    >
                      <defs>
                        <linearGradient id="rainDashGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <YAxis
                        domain={[(min: number) => Math.floor(min - 40), (max: number) => Math.ceil(max + 40)]}
                        hide
                      />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(val: any) => [`${val} mm`, 'Rainfall']}
                        labelFormatter={(label) => `Year: ${label}`}
                      />
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke="#06b6d4"
                        strokeWidth={2.5}
                        fill="url(#rainDashGrad)"
                        dot={(props: any) => {
                          const { cx, cy, index } = props
                          if (index === 0 || index === nationalSummary.rainfall.series.length - 1) {
                            return (
                              <circle
                                key={`rain-dot-${index}`}
                                cx={cx}
                                cy={cy}
                                r={3.5}
                                fill="#06b6d4"
                                stroke="#ffffff"
                                strokeWidth={1.5}
                              />
                            )
                          }
                          return null
                        }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* 3. BIG CARD: CO2 EMISSIONS */}
            <div className="bg-[#0d1428] border border-white/5 hover:border-emerald-500/30 transition-all rounded-2xl p-5 flex flex-col justify-between space-y-4 shadow-xl">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">
                      CO₂ Emissions
                    </span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 border border-white/10 text-gray-400">
                    2024 Latest
                  </span>
                </div>

                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-3xl sm:text-4xl font-black text-emerald-400 font-mono tabular-nums">
                    {nationalSummary.co2.latest.toFixed(2)}
                  </span>
                  <span className="text-xl font-bold text-gray-400">Gt</span>
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <span className="text-xs font-mono font-bold px-2.5 py-1 rounded border bg-emerald-500/10 text-emerald-300 border-emerald-500/30">
                    +{nationalSummary.co2.delta.toFixed(2)} Gt
                  </span>
                  <span className="text-xs text-gray-400">
                    (+{nationalSummary.co2.deltaPct.toFixed(1)}% since 2000)
                  </span>
                </div>
              </div>

              {/* Small Trend Line */}
              <div className="space-y-1 pt-2 border-t border-white/5">
                <div className="flex justify-between text-[10px] text-gray-500 font-mono">
                  <span>2000: {nationalSummary.co2.base2000.toFixed(2)} Gt</span>
                  <span>2024: {nationalSummary.co2.latest.toFixed(2)} Gt</span>
                </div>
                <div className="h-16 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={nationalSummary.co2.series}
                      margin={{ top: 5, right: 6, bottom: 5, left: 6 }}
                    >
                      <defs>
                        <linearGradient id="co2DashGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <YAxis
                        domain={[(min: number) => Number((min - 0.1).toFixed(2)), (max: number) => Number((max + 0.1).toFixed(2))]}
                        hide
                      />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(val: any) => [`${val} Gt`, 'CO₂ Emissions']}
                        labelFormatter={(label) => `Year: ${label}`}
                      />
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke="#10b981"
                        strokeWidth={2.5}
                        fill="url(#co2DashGrad)"
                        dot={(props: any) => {
                          const { cx, cy, index } = props
                          if (index === 0 || index === nationalSummary.co2.series.length - 1) {
                            return (
                              <circle
                                key={`co2-dot-${index}`}
                                cx={cx}
                                cy={cy}
                                r={3.5}
                                fill="#10b981"
                                stroke="#ffffff"
                                strokeWidth={1.5}
                              />
                            )
                          }
                          return null
                        }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─── Variables Table ───────────────────────────────────────────────── */}
      {!loading && data && (
        <div>
          <h2 className="text-xs text-gray-500 uppercase tracking-widest font-semibold mb-3">
            Dataset Variables
          </h2>
          <div className="bg-[#0d1428] border border-white/5 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 bg-white/[0.02]">
                  <th className="text-left px-5 py-3 text-xs text-gray-400 uppercase tracking-widest font-medium">
                    Column
                  </th>
                  <th className="text-left px-5 py-3 text-xs text-gray-400 uppercase tracking-widest font-medium">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.column_names.map((col, i) => (
                  <tr
                    key={col}
                    className={i < data.column_names.length - 1 ? 'border-b border-white/5' : ''}
                  >
                    <td className="px-5 py-3 text-gray-200 font-mono text-xs">{col}</td>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        Loaded
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
