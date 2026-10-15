import { useState, useMemo, useEffect } from 'react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ReferenceDot,
} from 'recharts'
import { useHistorical } from '../hooks/useHistorical'

type IndicatorKey = 'temperature' | 'rainfall' | 'co2'
type SortColumn = 'year' | 'val' | 'diffBase' | 'diffMean'

interface IndicatorConfig {
  key: IndicatorKey
  label: string
  unit: string
  color: string
  gradientId: string
  format: (val: number) => string
  chartFormat: (val: number) => string
  description: string
}

const INDICATORS: Record<IndicatorKey, IndicatorConfig> = {
  temperature: {
    key: 'temperature',
    label: 'Temperature',
    unit: '°C',
    color: '#f97316',
    gradientId: 'tempGrad',
    format: (v) => `${v.toFixed(2)} °C`,
    chartFormat: (v) => `${v.toFixed(1)}°`,
    description: 'National mean annual surface temperature across India (National data only)',
  },
  rainfall: {
    key: 'rainfall',
    label: 'Rainfall',
    unit: 'mm',
    color: '#06b6d4',
    gradientId: 'rainGrad',
    format: (v) => `${v.toFixed(1)} mm`,
    chartFormat: (v) => `${Math.round(v)}`,
    description: 'National annual total precipitation across India (National data only)',
  },
  co2: {
    key: 'co2',
    label: 'CO₂ Emissions',
    unit: 'Gt',
    color: '#a855f7',
    gradientId: 'co2Grad',
    format: (v) => `${(v / 1_000_000_000).toFixed(3)} Gt`,
    chartFormat: (v) => `${(v / 1_000_000_000).toFixed(2)} Gt`,
    description: 'National total carbon dioxide emissions in gigatonnes (National data only)',
  },
}

const tooltipStyle = {
  backgroundColor: '#0d1428',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '8px',
  color: '#e2e8f0',
  fontSize: '12px',
}

// ─── Climate Stripe Color Interpolators ─────────────────────────────────────────
const TEMP_COLORS = [
  '#08306b',
  '#08519c',
  '#2171b5',
  '#4292c6',
  '#6baed6',
  '#9ecae1',
  '#fee391',
  '#fec44f',
  '#fe9929',
  '#ec7014',
  '#cc4c02',
  '#990000',
]

// Light to dark blue for Rainfall
const RAIN_COLORS = [
  '#e0f2fe',
  '#bae6fd',
  '#7dd3fc',
  '#38bdf8',
  '#0ea5e9',
  '#0284c7',
  '#0369a1',
  '#075985',
  '#0c4a6e',
  '#172554',
]

// Light to dark purple for CO2
const CO2_COLORS = [
  '#f3e8ff',
  '#e9d5ff',
  '#d8b4fe',
  '#c084fc',
  '#a855f7',
  '#9333ea',
  '#7e22ce',
  '#6b21a8',
  '#581c87',
  '#3b0764',
]

function getStripeColor(
  val: number,
  min: number,
  max: number,
  indicatorKey: IndicatorKey = 'temperature'
): string {
  if (max === min) return indicatorKey === 'rainfall' ? '#0ea5e9' : indicatorKey === 'co2' ? '#a855f7' : '#3b82f6'
  const t = Math.max(0, Math.min(1, (val - min) / (max - min)))
  const colors =
    indicatorKey === 'rainfall' ? RAIN_COLORS : indicatorKey === 'co2' ? CO2_COLORS : TEMP_COLORS
  const idx = Math.min(colors.length - 1, Math.floor(t * colors.length))
  return colors[idx]
}

// Helper for ordinal suffix (1st, 2nd, 3rd, etc.)
function getOrdinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

export default function IndiaExplorer() {
  const { data, loading, error } = useHistorical()
  const [selectedIndicator, setSelectedIndicator] = useState<IndicatorKey>('temperature')
  const [selectedYear, setSelectedYear] = useState<number>(2024)
  const [isPlaying, setIsPlaying] = useState<boolean>(false)
  const [hoveredYear, setHoveredYear] = useState<number | null>(null)

  // Table Sorting state
  const [sortColumn, setSortColumn] = useState<SortColumn>('year')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  const indicator = INDICATORS[selectedIndicator]
  const records = data?.records ?? []

  // ─── Play button: moves through years 2000-2024 every 0.5s ──────────────────
  useEffect(() => {
    if (!isPlaying) return
    const interval = setInterval(() => {
      setSelectedYear((prev) => (prev >= 2024 ? 2000 : prev + 1))
    }, 500)
    return () => clearInterval(interval)
  }, [isPlaying])

  // Pre-calculate summary stats and min/max for the selected indicator
  const stats = useMemo(() => {
    if (!records.length) return null

    const values = records.map((r) => r[selectedIndicator])
    const minVal = Math.min(...values)
    const maxVal = Math.max(...values)
    const sum = values.reduce((a, b) => a + b, 0)
    const mean = sum / values.length

    const rec2000 = records.find((r) => r.year === 2000) || records[0]
    const val2000 = rec2000[selectedIndicator]

    return {
      minVal,
      maxVal,
      mean,
      val2000,
    }
  }, [records, selectedIndicator])

  // ─── 1. Decade Averages: 2000-09, 2010-19, 2020-24 ─────────────────────────
  const decadeData = useMemo(() => {
    if (!records.length) return []
    const d1 = records.filter((r) => r.year >= 2000 && r.year <= 2009)
    const d2 = records.filter((r) => r.year >= 2010 && r.year <= 2019)
    const d3 = records.filter((r) => r.year >= 2020 && r.year <= 2024)

    const calcAvg = (arr: typeof records) =>
      arr.length ? arr.reduce((acc, r) => acc + r[selectedIndicator], 0) / arr.length : 0

    const avg1 = calcAvg(d1)
    const avg2 = calcAvg(d2)
    const avg3 = calcAvg(d3)

    return [
      { label: '2000–09', span: '10 Years', avg: avg1, count: d1.length },
      { label: '2010–19', span: '10 Years', avg: avg2, count: d2.length },
      { label: '2020–24', span: '5 Years', avg: avg3, count: d3.length },
    ]
  }, [records, selectedIndicator])

  // ─── 2. Top 5 Highest & Top 5 Lowest Years ──────────────────────────────────
  const { top5Highest, top5Lowest } = useMemo(() => {
    if (!records.length) return { top5Highest: [], top5Lowest: [] }
    const sortedDesc = [...records].sort((a, b) => b[selectedIndicator] - a[selectedIndicator])
    const top5H = sortedDesc.slice(0, 5)
    const top5L = [...records].sort((a, b) => a[selectedIndicator] - b[selectedIndicator]).slice(0, 5)
    return { top5Highest: top5H, top5Lowest: top5L }
  }, [records, selectedIndicator])

  // Selected Year record & ranking
  const selectedYearData = useMemo(() => {
    if (!records.length) return null
    const rec = records.find((r) => r.year === selectedYear) || records[records.length - 1]
    const val = rec[selectedIndicator]

    const sorted = [...records].sort((a, b) => b[selectedIndicator] - a[selectedIndicator])
    const rank = sorted.findIndex((r) => r.year === rec.year) + 1

    const val2000 = stats?.val2000 ?? val
    const changeFrom2000 = val - val2000
    const pctChangeFrom2000 = val2000 !== 0 ? (changeFrom2000 / val2000) * 100 : 0

    let rankPhrase = ''
    if (selectedIndicator === 'temperature') {
      rankPhrase = `${getOrdinal(rank)} warmest of ${records.length}`
    } else if (selectedIndicator === 'rainfall') {
      rankPhrase = `${getOrdinal(rank)} wettest of ${records.length}`
    } else {
      rankPhrase = `${getOrdinal(rank)} highest of ${records.length}`
    }

    return {
      record: rec,
      val,
      rank,
      rankPhrase,
      changeFrom2000,
      pctChangeFrom2000,
    }
  }, [records, selectedYear, selectedIndicator, stats])

  // ─── 3. Sorted Table Records ────────────────────────────────────────────────
  const sortedRecords = useMemo(() => {
    if (!records.length || !stats) return []
    const list = records.map((r) => ({
      ...r,
      val: r[selectedIndicator],
      diffBase: r[selectedIndicator] - stats.val2000,
      diffMean: r[selectedIndicator] - stats.mean,
    }))

    list.sort((a, b) => {
      let cmp = 0
      if (sortColumn === 'year') cmp = a.year - b.year
      else if (sortColumn === 'val') cmp = a.val - b.val
      else if (sortColumn === 'diffBase') cmp = a.diffBase - b.diffBase
      else if (sortColumn === 'diffMean') cmp = a.diffMean - b.diffMean
      return sortDirection === 'asc' ? cmp : -cmp
    })

    return list
  }, [records, selectedIndicator, stats, sortColumn, sortDirection])

  const handleSort = (col: SortColumn) => {
    if (sortColumn === col) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortColumn(col)
      setSortDirection(col === 'year' ? 'asc' : 'desc')
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 max-w-full">
      {/* ─── Header ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">📊</span>
            <span className="text-xs font-semibold uppercase tracking-widest text-cyan-400">
              Historical Observation · 2000–2024
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">India Explorer</h1>
          <p className="text-xs sm:text-sm text-gray-400 mt-1">
            National climate timeline across the Republic of India based on verified CSV records.
          </p>
        </div>

        {/* Mandatory Scope Notice Pill */}
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-3.5 py-2 flex items-center gap-2 self-start md:self-auto">
          <span className="text-amber-400 text-base shrink-0">ℹ</span>
          <p className="text-xs font-semibold text-amber-300">National data only.</p>
        </div>
      </div>

      {/* ─── Indicator Selection Buttons ────────────────────────────────────── */}
      <div className="bg-[#0d1428] border border-white/5 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 px-1">
            Indicator:
          </span>
          {(Object.keys(INDICATORS) as IndicatorKey[]).map((key) => {
            const cfg = INDICATORS[key]
            const isSelected = selectedIndicator === key
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedIndicator(key)}
                className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-150 flex items-center gap-2 cursor-pointer ${
                  isSelected
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm shadow-cyan-500/10'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-200 border border-white/5'
                }`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: cfg.color }}
                />
                <span>{cfg.label}</span>
                <span className="text-xs opacity-60">({cfg.unit})</span>
              </button>
            )
          })}
        </div>

        <div className="text-xs text-gray-400 font-mono pr-1">
          Year: <span className="text-white font-bold text-sm">{selectedYear}</span>
        </div>
      </div>

      {/* Loading & Error States */}
      {loading && (
        <div className="bg-[#0d1428] border border-white/5 rounded-xl p-12 text-center text-gray-400 animate-pulse">
          Loading 2000–2024 national climate dataset...
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-sm text-red-400">
          Failed to load historical data: {error}
        </div>
      )}

      {!loading && !error && stats && selectedYearData && (
        <>
          {/* ─── 1. CLIMATE STRIPES (25 Vertical Bars: 2000-2024) ─────────────── */}
          <div className="bg-[#0d1428] border border-white/5 rounded-xl p-4 sm:p-5 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <span>🎨</span> Climate Stripes (2000–2024)
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  25 vertical bars coloured for {indicator.label} (Temp: blue to red, Rain: light to dark blue, CO₂: light to dark purple). Hover or click to select year.
                </p>
              </div>

              {/* Hover / Selected Info Badge */}
              <div className="text-xs font-mono px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-gray-300 self-start sm:self-auto">
                {hoveredYear !== null ? (
                  <span>
                    Hover: <strong className="text-white">{hoveredYear}</strong> ·{' '}
                    <span className="text-cyan-300 font-bold">
                      {indicator.format(
                        records.find((r) => r.year === hoveredYear)?.[selectedIndicator] ?? 0
                      )}
                    </span>
                  </span>
                ) : (
                  <span>
                    Selected: <strong className="text-white">{selectedYear}</strong> ·{' '}
                    <span className="text-cyan-300 font-bold">
                      {indicator.format(selectedYearData.val)}
                    </span>
                  </span>
                )}
              </div>
            </div>

            {/* 25 Vertical Stripes Bar Grid */}
            <div className="flex w-full h-20 sm:h-24 rounded-lg overflow-hidden border border-white/10 bg-[#070b16]">
              {records.map((r) => {
                const val = r[selectedIndicator]
                const color = getStripeColor(val, stats.minVal, stats.maxVal, selectedIndicator)
                const isSelected = r.year === selectedYear
                const isHovered = r.year === hoveredYear

                return (
                  <button
                    key={r.year}
                    type="button"
                    onClick={() => setSelectedYear(r.year)}
                    onMouseEnter={() => setHoveredYear(r.year)}
                    onMouseLeave={() => setHoveredYear(null)}
                    title={`${r.year}: ${indicator.format(val)}`}
                    className={`flex-1 h-full transition-all duration-150 relative cursor-pointer group focus:outline-none ${
                      isSelected ? 'ring-2 ring-white z-10 scale-y-105 shadow-lg' : ''
                    }`}
                    style={{ backgroundColor: color }}
                  >
                    {isSelected && (
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 bg-white rotate-45 -translate-y-1" />
                    )}
                    <div
                      className={`absolute bottom-1 left-1/2 -translate-x-1/2 text-[9px] font-bold text-white transition-opacity hidden sm:block ${
                        isSelected || isHovered ? 'opacity-100' : 'opacity-0'
                      }`}
                      style={{ textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}
                    >
                      {String(r.year).slice(2)}
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Stripes Axis Legend: 2000 on left, 2024 on right */}
            <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-gray-500 font-mono px-1">
              <span>2000 (Low: {indicator.format(stats.minVal)})</span>
              <span className="text-gray-400 hidden sm:inline">← Blue (Cool / Low) · Orange / Red (Warm / High) →</span>
              <span>2024 (High: {indicator.format(stats.maxVal)})</span>
            </div>
          </div>

          {/* ─── 2. YEAR SLIDER & PLAY BUTTON ─────────────────────────────────── */}
          <div className="bg-[#0d1428] border border-white/5 rounded-xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center gap-4 sm:gap-5">
            {/* Play / Pause Button */}
            <button
              type="button"
              onClick={() => setIsPlaying(!isPlaying)}
              className={`w-full md:w-auto px-5 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shrink-0 cursor-pointer shadow-md ${
                isPlaying
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 ring-2 ring-amber-400/50'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 ring-2 ring-emerald-400/50'
              }`}
            >
              {isPlaying ? (
                <>
                  <span className="text-base">⏸</span> Pause
                </>
              ) : (
                <>
                  <span className="text-base">▶</span> Play Timeline
                </>
              )}
            </button>

            {/* Slider Track and Labels */}
            <div className="flex-1 space-y-1.5 w-full">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400 font-semibold flex items-center gap-2">
                  <span>Timeline Playback</span>
                  {isPlaying && (
                    <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-mono">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                      0.5s / yr
                    </span>
                  )}
                </span>
                <span className="font-mono text-sm font-extrabold text-cyan-300 bg-cyan-950/60 border border-cyan-800/40 px-2.5 py-0.5 rounded">
                  Year {selectedYear}
                </span>
              </div>

              <input
                type="range"
                min={2000}
                max={2024}
                step={1}
                value={selectedYear}
                onChange={(e) => {
                  setSelectedYear(Number(e.target.value))
                  if (isPlaying) setIsPlaying(false)
                }}
                className="w-full accent-cyan-400 cursor-pointer h-2.5 bg-slate-800 rounded-lg"
              />

              <div className="flex items-center justify-between text-[10px] text-gray-500 font-mono">
                <span>2000</span>
                <span>2005</span>
                <span>2010</span>
                <span>2015</span>
                <span>2020</span>
                <span>2024</span>
              </div>
            </div>
          </div>

          {/* ─── 3. BIG CARD FOR SELECTED YEAR (Value, Change, Rank, Thermometer) ── */}
          <div className="bg-[#0d1428] border border-white/5 rounded-2xl p-5 sm:p-6 relative overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              {/* Left Column: Metric Details */}
              <div className="lg:col-span-8 space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs uppercase font-bold tracking-wider px-2.5 py-1 rounded bg-white/5 border border-white/10 text-gray-300">
                    Observation Year {selectedYear}
                  </span>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20">
                    {selectedYearData.rankPhrase}
                  </span>
                  <span className="text-[11px] text-gray-500 font-mono">
                    National data only.
                  </span>
                </div>

                <div>
                  <div className="text-xs text-gray-400 font-medium">
                    National Mean {indicator.label} ({selectedYear})
                  </div>
                  <div
                    className="text-3xl sm:text-5xl font-black tracking-tight tabular-nums mt-1"
                    style={{ color: indicator.color }}
                  >
                    {indicator.format(selectedYearData.val)}
                  </div>
                </div>

                {/* Submetrics: Change from 2000 Baseline & Rank breakdown */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3">
                    <span className="text-[11px] text-gray-400 uppercase font-semibold block">
                      Shift vs 2000 Baseline
                    </span>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span
                        className={`text-lg sm:text-xl font-bold font-mono ${
                          selectedYearData.changeFrom2000 >= 0
                            ? 'text-rose-400'
                            : 'text-cyan-400'
                        }`}
                      >
                        {selectedYearData.changeFrom2000 >= 0 ? '+' : ''}
                        {selectedIndicator === 'co2'
                          ? (selectedYearData.changeFrom2000 / 1_000_000_000).toFixed(3) + ' Gt'
                          : selectedYearData.changeFrom2000.toFixed(2) + ' ' + indicator.unit}
                      </span>
                      <span className="text-xs font-medium text-gray-400">
                        ({selectedYearData.pctChangeFrom2000 >= 0 ? '+' : ''}
                        {selectedYearData.pctChangeFrom2000.toFixed(1)}%)
                      </span>
                    </div>
                    <span className="text-[10px] text-gray-500 block mt-0.5">
                      2000 Baseline: {indicator.format(stats.val2000)}
                    </span>
                  </div>

                  <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3">
                    <span className="text-[11px] text-gray-400 uppercase font-semibold block">
                      Historical 25-Year Rank
                    </span>
                    <div className="text-lg sm:text-xl font-bold font-mono text-purple-300 mt-1">
                      Rank #{selectedYearData.rank} of 25
                    </div>
                    <span className="text-[10px] text-gray-500 block mt-0.5">
                      {selectedYearData.rankPhrase}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Column: Thermometer for Temperature or Visual Gauge */}
              <div className="lg:col-span-4 flex flex-col items-center justify-center p-4 bg-white/[0.01] border border-white/5 rounded-xl w-full">
                {selectedIndicator === 'temperature' ? (
                  <div className="flex items-center justify-center gap-5 sm:gap-6 w-full">
                    {/* SVG Thermometer */}
                    <div className="relative shrink-0">
                      <svg width="60" height="170" viewBox="0 0 60 170" className="overflow-visible">
                        <rect x="23" y="10" width="14" height="120" rx="7" fill="#0f172a" stroke="#334155" strokeWidth="2.5" />
                        <circle cx="30" cy="140" r="18" fill="#0f172a" stroke="#334155" strokeWidth="2.5" />

                        {(() => {
                          const tVal = selectedYearData.val
                          const minT = 23.5
                          const maxT = 26.5
                          const pct = Math.max(0, Math.min(1, (tVal - minT) / (maxT - minT)))
                          const mercuryY = 120 - pct * 95
                          const mercuryHeight = 135 - mercuryY
                          const mercuryColor = tVal >= 25.5 ? '#ef4444' : tVal >= 24.5 ? '#f97316' : '#38bdf8'

                          return (
                            <>
                              <rect
                                x="25"
                                y={mercuryY}
                                width="10"
                                height={mercuryHeight}
                                rx="4"
                                fill={mercuryColor}
                                className="transition-all duration-300"
                              />
                              <circle
                                cx="30"
                                cy="140"
                                r="15"
                                fill={mercuryColor}
                                className="transition-all duration-300"
                              />
                              <rect x="26" y="15" width="2" height="100" rx="1" fill="#ffffff" opacity="0.25" />
                              <circle cx="26" cy="136" r="3" fill="#ffffff" opacity="0.3" />
                            </>
                          )
                        })()}

                        <g stroke="#64748b" strokeWidth="1.5">
                          <line x1="12" y1="25" x2="20" y2="25" />
                          <line x1="15" y1="57" x2="20" y2="57" />
                          <line x1="12" y1="89" x2="20" y2="89" />
                          <line x1="15" y1="120" x2="20" y2="120" />
                        </g>
                        <text x="8" y="27" fill="#94a3b8" fontSize="8" fontFamily="monospace" textAnchor="end">26.5°</text>
                        <text x="8" y="59" fill="#94a3b8" fontSize="8" fontFamily="monospace" textAnchor="end">25.5°</text>
                        <text x="8" y="91" fill="#94a3b8" fontSize="8" fontFamily="monospace" textAnchor="end">24.5°</text>
                        <text x="8" y="122" fill="#94a3b8" fontSize="8" fontFamily="monospace" textAnchor="end">23.5°</text>
                      </svg>
                    </div>

                    <div className="space-y-1 text-left">
                      <div className="text-[10px] uppercase font-bold text-gray-400">Thermometer</div>
                      <div className="text-xl font-extrabold text-white font-mono">
                        {selectedYearData.val.toFixed(2)} °C
                      </div>
                      <div className="text-[11px] text-gray-400">
                        {selectedYearData.val >= 25.5
                          ? '🔥 Above average warmth'
                          : selectedYearData.val <= 24.5
                          ? '❄️ Cool anomaly'
                          : '🌿 Moderate climate range'}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center space-y-2">
                    <div className="text-xs font-semibold text-gray-400 uppercase">
                      Relative {indicator.label} Scale
                    </div>
                    <div className="relative w-28 h-28 sm:w-32 sm:h-32 mx-auto flex items-center justify-center">
                      <svg width="112" height="112" viewBox="0 0 128 128" className="transform -rotate-90">
                        <circle cx="64" cy="64" r="50" stroke="rgba(255,255,255,0.08)" strokeWidth="10" fill="none" />
                        {(() => {
                          const val = selectedYearData.val
                          const t = Math.max(0, Math.min(1, (val - stats.minVal) / (stats.maxVal - stats.minVal || 1)))
                          const circ = 2 * Math.PI * 50
                          const strokeDashoffset = circ * (1 - t)
                          return (
                            <circle
                              cx="64"
                              cy="64"
                              r="50"
                              stroke={indicator.color}
                              strokeWidth="10"
                              fill="none"
                              strokeDasharray={circ}
                              strokeDashoffset={strokeDashoffset}
                              strokeLinecap="round"
                              className="transition-all duration-300"
                            />
                          )
                        })()}
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                        <span className="text-base sm:text-lg font-bold font-mono text-white">
                          {Math.round(
                            ((selectedYearData.val - stats.minVal) /
                              (stats.maxVal - stats.minVal || 1)) *
                              100
                          )}%
                        </span>
                        <span className="text-[9px] text-gray-400 uppercase">Of 25-Yr Max</span>
                      </div>
                    </div>
                    <p className="text-[11px] text-gray-400 font-mono">
                      {indicator.format(selectedYearData.val)}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ─── 4. DECADE BARS (2000-09, 2010-19, 2020-24) ────────────────────── */}
          <div className="bg-[#0d1428] border border-white/5 rounded-xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <div>
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <span>📅</span> Decadal Progression ({indicator.label})
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Mean averages for 2000–09, 2010–19, and 2020–24 with values displayed on the bars.
                </p>
              </div>
              <span className="text-[11px] text-gray-500 font-mono">National aggregate</span>
            </div>

            <div className="space-y-3.5">
              {decadeData.map((d) => {
                const color = getStripeColor(d.avg, stats.minVal, stats.maxVal)
                const pct = Math.max(
                  15,
                  Math.min(100, ((d.avg - stats.minVal) / (stats.maxVal - stats.minVal || 1)) * 85 + 15)
                )

                return (
                  <div key={d.label} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-sm">{d.label}</span>
                        <span className="text-gray-500 text-[11px]">({d.span})</span>
                      </div>
                      <span className="font-bold text-cyan-300 text-sm">
                        {indicator.format(d.avg)}
                      </span>
                    </div>

                    {/* Decade Bar Track */}
                    <div className="w-full h-8 bg-white/5 rounded-lg overflow-hidden border border-white/10 relative flex items-center">
                      <div
                        className="h-full rounded-lg transition-all duration-500 flex items-center px-3 justify-end shadow-md"
                        style={{ width: `${pct}%`, backgroundColor: color }}
                      >
                        <span
                          className="text-[11px] font-extrabold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] whitespace-nowrap"
                        >
                          {indicator.format(d.avg)}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ─── 5. TOP 5 HIGHEST & TOP 5 LOWEST YEARS ────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Top 5 Highest */}
            <div className="bg-[#0d1428] border border-white/5 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                  <h4 className="text-sm font-semibold text-white">Top 5 Highest Years</h4>
                </div>
                <span className="text-[10px] text-gray-500 font-mono">Click to jump</span>
              </div>

              <div className="space-y-1.5">
                {top5Highest.map((r, i) => {
                  const val = r[selectedIndicator]
                  const isSelected = r.year === selectedYear
                  const stripeColor = getStripeColor(val, stats.minVal, stats.maxVal)

                  return (
                    <button
                      key={r.year}
                      type="button"
                      onClick={() => setSelectedYear(r.year)}
                      className={`w-full flex items-center justify-between p-2.5 rounded-lg border text-xs transition cursor-pointer ${
                        isSelected
                          ? 'bg-rose-500/20 border-rose-500/50 shadow-sm'
                          : 'bg-white/[0.02] border-white/5 hover:bg-white/10'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 font-mono">
                        <span className="w-5 text-gray-400 font-bold">#{i + 1}</span>
                        <span className="font-bold text-white text-sm">{r.year}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-rose-300 tabular-nums">
                          {indicator.format(val)}
                        </span>
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: stripeColor }}
                          title="Climate stripe color"
                        />
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Top 5 Lowest */}
            <div className="bg-[#0d1428] border border-white/5 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                  <h4 className="text-sm font-semibold text-white">Top 5 Lowest Years</h4>
                </div>
                <span className="text-[10px] text-gray-500 font-mono">Click to jump</span>
              </div>

              <div className="space-y-1.5">
                {top5Lowest.map((r, i) => {
                  const val = r[selectedIndicator]
                  const isSelected = r.year === selectedYear
                  const stripeColor = getStripeColor(val, stats.minVal, stats.maxVal)

                  return (
                    <button
                      key={r.year}
                      type="button"
                      onClick={() => setSelectedYear(r.year)}
                      className={`w-full flex items-center justify-between p-2.5 rounded-lg border text-xs transition cursor-pointer ${
                        isSelected
                          ? 'bg-blue-500/20 border-blue-500/50 shadow-sm'
                          : 'bg-white/[0.02] border-white/5 hover:bg-white/10'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 font-mono">
                        <span className="w-5 text-gray-400 font-bold">#{i + 1}</span>
                        <span className="font-bold text-white text-sm">{r.year}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-blue-300 tabular-nums">
                          {indicator.format(val)}
                        </span>
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: stripeColor }}
                          title="Climate stripe color"
                        />
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* ─── 6. TREND CHART (Marked with Selected Year Dot & National data only) ─ */}
          <div className="bg-[#0d1428] border border-white/5 rounded-xl p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm sm:text-base font-semibold text-white">
                    National {indicator.label} Trend (2000–2024)
                  </h2>
                  <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 text-[10px] font-semibold border border-amber-500/20">
                    National data only.
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  Year <strong className="text-white">{selectedYear}</strong> marked with prominent indicator dot. {indicator.description}
                </p>
              </div>

              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 rounded" style={{ backgroundColor: indicator.color }} />
                  <span className="text-gray-300">Annual Observed</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-white border-2 border-cyan-400" />
                  <span className="text-white font-semibold">Selected Year ({selectedYear})</span>
                </div>
              </div>
            </div>

            <div className="h-64 sm:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={records}
                  margin={{ top: 10, right: 15, left: 10, bottom: 5 }}
                  onClick={(e: any) => {
                    if (e && e.activePayload && e.activePayload[0]) {
                      setSelectedYear(Number(e.activePayload[0].payload.year))
                    }
                  }}
                >
                  <defs>
                    <linearGradient id={indicator.gradientId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={indicator.color} stopOpacity={0.35} />
                      <stop offset="95%" stopColor={indicator.color} stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="year"
                    stroke="#475569"
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="#475569"
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    tickLine={false}
                    tickFormatter={indicator.chartFormat}
                    domain={['auto', 'auto']}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(val: any) => [
                      indicator.format(Number(val ?? 0)),
                      `National ${indicator.label}`,
                    ]}
                    labelFormatter={(label) => `Year: ${label}`}
                  />
                  <ReferenceLine
                    y={stats.mean}
                    stroke="#64748b"
                    strokeDasharray="4 4"
                    label={{
                      value: '25-Yr Mean',
                      fill: '#64748b',
                      fontSize: 10,
                      position: 'insideTopRight',
                    }}
                  />

                  {/* Mark the selected year with a prominent dot */}
                  <ReferenceDot
                    x={selectedYear}
                    y={selectedYearData.val}
                    r={7}
                    fill="#ffffff"
                    stroke={indicator.color}
                    strokeWidth={3}
                    isFront={true}
                  />

                  <Area
                    type="monotone"
                    dataKey={selectedIndicator}
                    stroke={indicator.color}
                    strokeWidth={2.5}
                    fill={`url(#${indicator.gradientId})`}
                    dot={{ fill: indicator.color, r: 2.5, strokeWidth: 0 }}
                    activeDot={{ r: 5, fill: '#ffffff', stroke: indicator.color, strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 text-[11px] text-gray-500 italic">
              Note: National data only. All observations represent nationwide aggregated figures.
            </div>
          </div>

          {/* ─── 7. TABLE (All 25 rows, sticky header, clickable sorting & row selection, coloured cells) ─ */}
          <div className="bg-[#0d1428] border border-white/5 rounded-xl p-4 sm:p-6 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <div>
                <h3 className="text-sm font-semibold text-white">
                  Annual National Observations Table (2000–2024)
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Showing all 25 rows with coloured cells (blue = low, red = high). Click any column header to sort. Click any row to select.
                </p>
              </div>
              <span className="text-xs text-gray-500 font-mono">25 records</span>
            </div>

            {/* Scroll box with sticky header */}
            <div className="overflow-x-auto max-h-80 overflow-y-auto rounded-lg border border-white/10 bg-[#090d1a]">
              <table className="w-full text-xs text-left min-w-[540px]">
                <thead className="bg-[#0c1427] text-gray-300 uppercase tracking-wider sticky top-0 z-20 shadow-md border-b border-white/10">
                  <tr>
                    <th
                      onClick={() => handleSort('year')}
                      className="py-3 px-3.5 cursor-pointer hover:text-white select-none transition"
                    >
                      <div className="flex items-center gap-1">
                        <span>Year</span>
                        <span className="text-cyan-400 font-bold">
                          {sortColumn === 'year' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                        </span>
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('val')}
                      className="py-3 px-3.5 cursor-pointer hover:text-white select-none transition"
                    >
                      <div className="flex items-center gap-1">
                        <span>National {indicator.label}</span>
                        <span className="text-cyan-400 font-bold">
                          {sortColumn === 'val' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                        </span>
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('diffBase')}
                      className="py-3 px-3.5 cursor-pointer hover:text-white select-none transition"
                    >
                      <div className="flex items-center gap-1">
                        <span>Diff vs 2000</span>
                        <span className="text-cyan-400 font-bold">
                          {sortColumn === 'diffBase' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                        </span>
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('diffMean')}
                      className="py-3 px-3.5 cursor-pointer hover:text-white select-none transition"
                    >
                      <div className="flex items-center gap-1">
                        <span>Diff vs 25-Yr Mean</span>
                        <span className="text-cyan-400 font-bold">
                          {sortColumn === 'diffMean' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                        </span>
                      </div>
                    </th>
                    <th className="py-3 px-3.5 text-right">Tone</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-gray-300">
                  {sortedRecords.map((r) => {
                    const isSelected = r.year === selectedYear
                    const cellColor = getStripeColor(r.val, stats.minVal, stats.maxVal)

                    return (
                      <tr
                        key={r.year}
                        onClick={() => setSelectedYear(r.year)}
                        className={`transition-colors cursor-pointer select-none ${
                          isSelected
                            ? 'bg-cyan-500/20 border-l-4 border-cyan-400 font-semibold'
                            : 'hover:bg-white/[0.04]'
                        }`}
                      >
                        <td className="py-2.5 px-3.5 font-mono font-bold text-white flex items-center gap-2">
                          {r.year}
                          {isSelected && (
                            <span className="text-[10px] bg-cyan-400/20 text-cyan-300 px-1.5 py-0.5 rounded font-sans">
                              active
                            </span>
                          )}
                        </td>

                        {/* Coloured Cell from Low (Blue) to High (Red) */}
                        <td className="py-2.5 px-3.5 tabular-nums">
                          <span
                            className="inline-block px-2.5 py-1 rounded-md font-bold font-mono text-xs border"
                            style={{
                              backgroundColor: `${cellColor}25`,
                              color: cellColor === '#fee391' ? '#fef08a' : cellColor,
                              borderColor: `${cellColor}60`,
                            }}
                          >
                            {indicator.format(r.val)}
                          </span>
                        </td>

                        <td className="py-2.5 px-3.5 tabular-nums">
                          <span
                            className={
                              r.diffBase > 0
                                ? 'text-rose-400 font-medium'
                                : r.diffBase < 0
                                ? 'text-cyan-400 font-medium'
                                : 'text-gray-400'
                            }
                          >
                            {r.diffBase >= 0 ? '+' : ''}
                            {selectedIndicator === 'co2'
                              ? (r.diffBase / 1_000_000_000).toFixed(3) + ' Gt'
                              : r.diffBase.toFixed(2) + ' ' + indicator.unit}
                          </span>
                        </td>

                        <td className="py-2.5 px-3.5 tabular-nums">
                          <span
                            className={
                              r.diffMean > 0
                                ? 'text-amber-400 font-medium'
                                : r.diffMean < 0
                                ? 'text-blue-400 font-medium'
                                : 'text-gray-400'
                            }
                          >
                            {r.diffMean >= 0 ? '+' : ''}
                            {selectedIndicator === 'co2'
                              ? (r.diffMean / 1_000_000_000).toFixed(3) + ' Gt'
                              : r.diffMean.toFixed(2) + ' ' + indicator.unit}
                          </span>
                        </td>

                        <td className="py-2.5 px-3.5 text-right">
                          <span
                            className="inline-block w-3.5 h-3.5 rounded-full border border-white/20"
                            style={{ backgroundColor: cellColor }}
                            title={`Warming tone for ${r.year}`}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
