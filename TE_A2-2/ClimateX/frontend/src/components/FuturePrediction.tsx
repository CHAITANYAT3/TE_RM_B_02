import { useState, useEffect, useRef, useMemo } from "react"
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Legend,
} from "recharts"
import { useFutureV2 } from "../hooks/useFutureV2"
import { FutureYearPoint, ObservedPoint } from "../types/climate"

const BASE_URL =
  typeof window !== 'undefined' && window.location.hostname === '127.0.0.1'
    ? 'http://127.0.0.1:8000/api'
    : 'http://localhost:8000/api'

type Target = "temp" | "rain" | "co2"

const TAB_CONFIG = [
  { key: "temp" as Target, icon: "🌡️", label: "Temperature", color: "#f97316", glow: "rgba(249,115,22,0.35)" },
  { key: "rain" as Target, icon: "🌧️", label: "Rainfall",    color: "#38bdf8", glow: "rgba(56,189,248,0.35)" },
  { key: "co2"  as Target, icon: "💨", label: "CO₂",         color: "#a78bfa", glow: "rgba(167,139,250,0.35)" },
]

const TARGET_META = {
  temp: { unit: "°C" },
  rain: { unit: " mm" },
  co2:  { unit: " t" },
}

const tooltipStyle = {
  backgroundColor: "#0a0e1f",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "10px",
  color: "#e2e8f0",
  fontSize: "12px",
  padding: "10px 14px",
}

function useAnimatedNumber(target: number, duration = 600): number {
  const [current, setCurrent] = useState(target)
  const rafRef = useRef<number>(0)
  useEffect(() => {
    const start = current
    const diff  = target - start
    const t0    = performance.now()
    const tick  = (now: number) => {
      const p    = Math.min((now - t0) / duration, 1)
      const ease = 1 - Math.pow(1 - p, 3)
      setCurrent(start + diff * ease)
      if (p < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [target])
  return current
}

function ThermometerGauge({ value, min, max, color }: { value: number; min: number; max: number; color: string }) {
  const pct        = Math.max(0, Math.min(1, (value - min) / (max - min || 1)))
  const fillHeight = pct * 120
  return (
    <svg width="44" height="160" viewBox="0 0 44 160" fill="none">
      <rect x="16" y="14" width="12" height="120" rx="6" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.12)" strokeWidth="1"/>
      <rect x="18" y={14 + (120 - fillHeight)} width="8" height={fillHeight} rx="4" fill={color} style={{ transition: "all 0.6s cubic-bezier(0.34,1.56,0.64,1)" }}/>
      <circle cx="22" cy="148" r="14" fill={color} fillOpacity="0.25" stroke={color} strokeWidth="1.5"/>
      <circle cx="22" cy="148" r="8" fill={color}/>
      {[0, 0.25, 0.5, 0.75, 1].map((t) => (
        <line key={t} x1="28" y1={134 - t * 120} x2="34" y2={134 - t * 120} stroke="rgba(255,255,255,0.2)" strokeWidth="1"/>
      ))}
    </svg>
  )
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white/5 border border-white/8 rounded-xl p-4">
      <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">{label}</p>
      <p className="text-sm font-bold text-white font-mono">{value}</p>
      {sub && <p className="text-[10px] text-gray-500 mt-0.5">{sub}</p>}
    </div>
  )
}

function ChartTooltip({ active, payload, label, unit }: any) {
  if (!active || !payload?.length) return null
  const obs  = payload.find((p: any) => p.dataKey === "observed")
  const pred = payload.find((p: any) => p.dataKey === "predicted")
  const lo   = payload.find((p: any) => p.dataKey === "band_lower")
  const hi   = payload.find((p: any) => p.dataKey === "band_upper")
  const lin  = payload.find((p: any) => p.dataKey === "lin_pred")
  const pol  = payload.find((p: any) => p.dataKey === "poly_pred")

  const fmtV = (v: number) => {
    if (unit === " t") return (v / 1e6).toFixed(2) + " Mt"
    return v.toFixed(unit === " mm" ? 0 : 3) + unit
  }
  return (
    <div style={tooltipStyle}>
      <p className="font-bold text-gray-300 mb-2">{label}</p>
      {obs?.value  != null && <p className="text-cyan-400">Observed: <span className="font-bold">{fmtV(obs.value)}</span></p>}
      {pred?.value != null && <p className="text-emerald-400">Projected: <span className="font-bold">{fmtV(pred.value)}</span></p>}
      {lin?.value  != null && <p className="text-lime-400">Linear: <span className="font-bold">{fmtV(lin.value)}</span></p>}
      {pol?.value  != null && <p className="text-pink-400">Poly: <span className="font-bold">{fmtV(pol.value)}</span></p>}
      {lo?.value != null && hi?.value != null && (
        <p className="text-gray-400 text-[10px] mt-1">95% CI: {fmtV(lo.value)} – {fmtV(hi.value)}</p>
      )}
    </div>
  )
}

export default function FuturePrediction() {
  const [target, setTarget] = useState<Target>("temp")
  const [selectedYear, setSelectedYear] = useState<number>(2030)
  const [showComparison, setShowComparison] = useState(false)
  const [howOpen, setHowOpen] = useState(false)

  // 1. Fetch ML results from the exact same source as the ML page (/ml/results)
  const [mlResults, setMlResults] = useState<any>(null)
  useEffect(() => {
    let cancelled = false
    fetch(`${BASE_URL}/ml/results`)
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => {
        if (!cancelled && res) setMlResults(res)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const { data, loading, error } = useFutureV2(target, selectedYear)

  const tab  = TAB_CONFIG.find((t) => t.key === target)!
  const meta = TARGET_META[target]

  // 2. Future Temperature line: use Linear Regression by default
  const selectedLinearPt = data?.linear_future?.find((f) => f.year === selectedYear)
  const targetValue =
    target === "temp" && selectedLinearPt ? selectedLinearPt.value : (data?.selected_value ?? 0)
  const targetLower =
    target === "temp" && selectedLinearPt ? selectedLinearPt.lower : (data?.selected_lower ?? 0)
  const targetUpper =
    target === "temp" && selectedLinearPt ? selectedLinearPt.upper : (data?.selected_upper ?? 0)
  const targetChange =
    target === "temp" && selectedLinearPt && data?.observed?.length
      ? selectedLinearPt.value - data.observed[data.observed.length - 1].value
      : (data?.change_from_2024 ?? 0)

  const animVal = useAnimatedNumber(targetValue)

  // 1. Read Test RMSE directly from /ml/results (same source as ML page)
  const testRmseDisplay = useMemo(() => {
    if (mlResults?.targets) {
      const tgt = mlResults.targets.find((t: any) => t.target_key === target)
      if (tgt?.models?.length) {
        // Temperature uses Linear Regression by default
        const modelKey = target === "temp" ? "linear" : (tgt.models[0].model_key || "linear")
        const model = tgt.models.find((m: any) => m.model_key === modelKey) || tgt.models[0]
        if (model) {
          if (target === "co2") {
            return `${(model.rmse / 1e6).toFixed(2)} Mt`
          } else if (target === "rain") {
            return `${model.rmse.toFixed(1)} mm`
          } else {
            return `${model.rmse.toFixed(4)} °C`
          }
        }
      }
    }
    // Fallback if mlResults still loading
    if (!data) return "—"
    if (target === "co2") return `${(data.test_rmse / 1e6).toFixed(2)} Mt`
    return `${data.test_rmse.toFixed(target === "rain" ? 1 : 4)} ${data.unit}`
  }, [mlResults, target, data])

  const fmtBig = (v: number): string => {
    if (target === "co2")  return (v / 1e6).toFixed(1)
    if (target === "rain") return v.toFixed(0)
    return v.toFixed(3)
  }
  const bigUnit = target === "co2" ? "Mt" : meta.unit
  const rising  = targetChange >= 0

  const fmtChange = (v: number): string => {
    const prefix = v >= 0 ? "+" : ""
    if (target === "co2")  return prefix + (v / 1e6).toFixed(1) + " Mt"
    if (target === "rain") return prefix + v.toFixed(0) + " mm"
    return prefix + v.toFixed(2) + "°C"
  }

  const fmtCell = (v: number): string => {
    if (target === "co2")  return (v / 1e6).toFixed(1) + " Mt"
    if (target === "rain") return v.toFixed(0) + " mm"
    return v.toFixed(2) + " °C"
  }

  const chartData = useMemo(() => {
    if (!data) return []
    const obsMap = new Map<number, number>()
    data.observed.forEach((o: ObservedPoint) => obsMap.set(o.year, o.value))
    const futMap = new Map<number, FutureYearPoint>()
    const linMap = new Map<number, FutureYearPoint>()
    const polMap = new Map<number, FutureYearPoint>()
    data.future.forEach((f) => futMap.set(f.year, f))
    data.linear_future.forEach((f) => linMap.set(f.year, f))
    data.poly_future.forEach((f) => polMap.set(f.year, f))

    return Array.from({ length: 41 }, (_, i) => 2000 + i).map((yr) => {
      const obs = obsMap.get(yr)
      const fut = futMap.get(yr)
      const lin = linMap.get(yr)
      const pol = polMap.get(yr)

      // Temperature uses Linear Regression by default
      const defaultPred = target === "temp" ? lin : fut

      return {
        year: yr,
        observed: obs ?? null,
        predicted: defaultPred?.value ?? (yr === 2024 && obs !== undefined ? obs : null),
        band_lower: defaultPred?.lower ?? null,
        band_upper: defaultPred?.upper ?? null,
        lin_pred: lin?.value ?? null,
        poly_pred: pol?.value ?? null,
      }
    })
  }, [data, target])

  const thermoRange = useMemo(() => {
    if (!data) return { min: 0, max: 100 }
    const vals = [...data.observed.map((o) => o.value), ...data.future.map((f) => f.upper)]
    const lo = Math.min(...vals)
    const hi = Math.max(...vals)
    const pad = (hi - lo) * 0.1
    return { min: lo - pad, max: hi + pad }
  }, [data])

  const miniTableYears = [2025, 2030, 2035, 2040]

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 text-white max-w-full">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[11px] text-emerald-400 font-semibold uppercase tracking-widest">
            Predictive Modeling · 2025–2040
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-1">Future Climate Projection</h1>
        <p className="text-gray-400 text-xs sm:text-sm max-w-2xl">
          Model-based estimates for Temperature, Rainfall, and CO₂ derived from national historical trends.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {TAB_CONFIG.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTarget(t.key)}
            className={`flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 border cursor-pointer ${
              target === t.key
                ? "border-white/15 text-white"
                : "border-white/5 text-gray-400 hover:text-white hover:bg-white/5"
            }`}
            style={target === t.key ? { backgroundColor: t.color + "22", boxShadow: `0 0 18px ${t.glow}` } : {}}
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Year Slider */}
      <div className="bg-[#0d1428] border border-white/5 rounded-xl p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">Target Year</span>
          <span className="text-lg font-extrabold font-mono" style={{ color: tab.color }}>{selectedYear}</span>
        </div>
        <input
          type="range"
          min={2025}
          max={2040}
          step={1}
          value={selectedYear}
          onChange={(e) => setSelectedYear(Number(e.target.value))}
          className="w-full h-2 rounded-full outline-none cursor-pointer appearance-none"
          style={{ accentColor: tab.color }}
        />
        <div className="flex justify-between text-[10px] text-gray-500 mt-2 font-mono">
          <span>2025</span>
          <div className="flex gap-3">
            {[2025, 2030, 2035, 2040].map((y) => (
              <button
                key={y}
                type="button"
                onClick={() => setSelectedYear(y)}
                className="font-bold transition-colors hover:text-gray-300 cursor-pointer"
                style={selectedYear === y ? { color: tab.color } : {}}
              >
                {y}
              </button>
            ))}
          </div>
          <span>2040</span>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400">
          <span>⚠</span>
          <div>
            <p className="font-semibold">Failed to load prediction</p>
            <p className="text-xs opacity-80">{error}</p>
          </div>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && !data && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-32 bg-white/5 rounded-xl animate-pulse"/>)}
          </div>
          <div className="h-96 bg-white/5 rounded-xl animate-pulse"/>
        </div>
      )}

      {data && (
        <>
          {/* Notes */}
          {data.no_trend_note && (
            <div className="flex gap-3 bg-sky-500/10 border border-sky-500/25 rounded-xl p-4 text-xs sm:text-sm text-sky-300">
              <span className="text-lg">〰️</span><p>{data.no_trend_note}</p>
            </div>
          )}
          {data.fallback_note && target !== "temp" && (
            <div className="flex gap-3 bg-amber-500/10 border border-amber-500/25 rounded-xl p-4 text-xs sm:text-sm text-amber-300">
              <span className="text-lg">⚠️</span><p>{data.fallback_note}</p>
            </div>
          )}

          {/* Big number + gauge + stat cards */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
            {/* Big animated number */}
            <div
              className="lg:col-span-2 rounded-2xl border border-white/10 p-6 sm:p-7 flex flex-col justify-between relative overflow-hidden"
              style={{ background: `linear-gradient(135deg, ${tab.color}18 0%, #0a0e1f 60%)` }}
            >
              <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full blur-3xl opacity-30 pointer-events-none" style={{ backgroundColor: tab.color }}/>
              <div>
                <span
                  className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border"
                  style={{ color: tab.color, borderColor: tab.color + "60", backgroundColor: tab.color + "22" }}
                >
                  {selectedYear} Estimate
                </span>
                <p className="text-gray-400 text-xs mt-3">
                  {target === "temp" ? "Linear Regression Projection (Default)" : data.label}
                </p>
              </div>

              <div className="flex items-end gap-3 my-4 flex-wrap">
                <span className="text-5xl sm:text-6xl font-black tabular-nums tracking-tight leading-none font-mono">
                  {fmtBig(animVal)}
                </span>
                <span className="text-2xl font-bold mb-1" style={{ color: tab.color }}>{bigUnit}</span>
                <span className={`mb-1 px-3 py-1 rounded-full text-xs font-bold border ${
                  rising ? "bg-rose-500/15 text-rose-300 border-rose-500/30" : "bg-cyan-500/15 text-cyan-300 border-cyan-500/30"
                }`}>
                  {fmtChange(targetChange)} from 2024
                </span>
              </div>

              <div className="text-[11px] text-gray-400 border-t border-white/10 pt-3">
                95% CI: <span className="text-white font-mono">{fmtCell(targetLower)} – {fmtCell(targetUpper)}</span>
              </div>
            </div>

            {/* Thermometer */}
            <div className="rounded-2xl border border-white/10 bg-[#0d1428] p-5 sm:p-6 flex flex-col items-center justify-center gap-3">
              <p className="text-[10px] uppercase tracking-widest text-gray-400">Gauge</p>
              <ThermometerGauge value={targetValue} min={thermoRange.min} max={thermoRange.max} color={tab.color}/>
              <p className="text-xs font-bold font-mono" style={{ color: tab.color }}>{fmtBig(targetValue)} {bigUnit}</p>
            </div>

            {/* Stat cards */}
            <div className="flex flex-col gap-3">
              <StatCard
                label="Model"
                value={target === "temp" ? "Linear Regression" : data.model_name}
                sub={target === "temp" ? "Linear trend projection (Default)" : "Selected by lowest test RMSE"}
              />
              <StatCard label="Training Period" value="2000–2024" sub={data.training_period}/>
              {/* 1. Test RMSE reading directly from /ml/results */}
              <StatCard
                label="Test RMSE (2020–2024)"
                value={testRmseDisplay}
                sub="Source: /ml/results benchmark"
              />
            </div>
          </div>

          {/* Fan chart */}
          <div className="bg-[#0d1428] border border-white/5 rounded-2xl p-4 sm:p-6 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm sm:text-base font-bold">Historical + Projected Trend (2000–2040)</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Solid = observed · Dashed = model · Shaded = 95% prediction interval
                </p>
              </div>

              {/* Compare toggle */}
              <button
                type="button"
                onClick={() => setShowComparison((s) => !s)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border whitespace-nowrap cursor-pointer ${
                  showComparison
                    ? "bg-purple-500/20 border-purple-500/40 text-purple-300"
                    : "bg-white/5 border-white/10 text-gray-400 hover:text-white"
                }`}
              >
                {showComparison ? "✓ Hide" : "⊕ Compare"} Linear vs Poly
              </button>
            </div>

            {/* 2. Mandatory Note for Polynomial in compare toggle: "Polynomial bends down, so it is unreliable beyond 2024." */}
            {showComparison && target === "temp" && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
                <span className="text-base shrink-0">⚠️</span>
                <p className="font-medium">
                  Polynomial bends down, so it is unreliable beyond 2024.
                </p>
              </div>
            )}

            <div className="h-80 sm:h-96">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 10, right: 24, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)"/>
                  <XAxis dataKey="year" stroke="#475569" fontSize={11}/>
                  <YAxis
                    stroke="#475569"
                    fontSize={11}
                    width={target === "co2" ? 64 : 52}
                    tickFormatter={(v) =>
                      target === "co2" ? (v / 1e6).toFixed(0) + "M"
                      : target === "rain" ? v.toFixed(0)
                      : v.toFixed(1)
                    }
                  />
                  <Tooltip content={<ChartTooltip unit={meta.unit}/>}/>
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 12 }} formatter={(value) => <span style={{ color: "#94a3b8" }}>{value}</span>}/>

                  {/* 95% band */}
                  <Area type="monotone" dataKey="band_upper" stroke="none" fill={tab.color} fillOpacity={0.12} name="_upper" legendType="none" connectNulls/>
                  <Area type="monotone" dataKey="band_lower" stroke="none" fill="#0a0e1f" fillOpacity={1} name="_lower" legendType="none" connectNulls/>

                  {/* Reference lines */}
                  <ReferenceLine x={2024} stroke="rgba(255,255,255,0.25)" strokeDasharray="4 4" label={{ value: "Today", fill: "#94a3b8", fontSize: 10, position: "top" }}/>
                  <ReferenceLine x={selectedYear} stroke={tab.color} strokeWidth={1.5} strokeDasharray="3 3" label={{ value: String(selectedYear), fill: tab.color, fontSize: 10, position: "top" }}/>

                  {/* Observed */}
                  <Line type="monotone" dataKey="observed" stroke="#38bdf8" strokeWidth={2.5} dot={{ r: 2.5, fill: "#38bdf8", strokeWidth: 0 }} name="Observed (2000–2024)" connectNulls={false}/>

                  {/* Prediction (Linear by default for temperature) */}
                  <Line
                    type="monotone"
                    dataKey="predicted"
                    stroke={tab.color}
                    strokeWidth={2.5}
                    strokeDasharray="6 4"
                    dot={false}
                    name={`Projected (${target === "temp" ? "Linear Regression" : data.model_name})`}
                    connectNulls
                  />

                  {/* Comparison */}
                  {showComparison && (
                    <>
                      <Line type="monotone" dataKey="lin_pred" stroke="#a3e635" strokeWidth={1.5} strokeDasharray="3 3" dot={false} name="Linear Regression" connectNulls/>
                      <Line type="monotone" dataKey="poly_pred" stroke="#f472b6" strokeWidth={1.5} strokeDasharray="3 3" dot={false} name="Polynomial (deg 2)" connectNulls/>
                    </>
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Extra eye-catchers */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Milestones (temp) or info card */}
            {target === "temp" && data.milestones.length > 0 ? (
              <div className="bg-[#0d1428] border border-white/5 rounded-2xl p-5 sm:p-6">
                <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-4">🏁 Temperature Milestones</h3>
                <div className="space-y-3">
                  {data.milestones.map((m, i) => (
                    <div key={i} className={`flex items-center justify-between px-4 py-3 rounded-xl border ${m.reached ? "bg-rose-500/10 border-rose-500/25" : "bg-white/5 border-white/8"}`}>
                      <div>
                        <p className="text-xs font-bold text-white">{m.threshold_label}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">Above 2000 baseline</p>
                      </div>
                      {m.reached ? (
                        <div className="text-right">
                          <p className="text-lg font-black text-rose-400">{m.year_reached}</p>
                          <p className="text-[10px] text-rose-300">First year reached</p>
                        </div>
                      ) : (
                        <p className="text-xs text-gray-500 italic">Not reached by 2040</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : target !== "temp" ? (
              <div className="bg-[#0d1428] border border-white/5 rounded-2xl p-5 sm:p-6 flex items-center justify-center">
                <div className="text-center">
                  <span className="text-4xl">{tab.icon}</span>
                  <p className="text-sm text-gray-300 mt-3 font-semibold">{data.label} Projection</p>
                  <p className="text-xs text-gray-500 mt-1 max-w-xs">
                    {target === "rain"
                      ? "Rainfall has high year-to-year variability. Milestones are not computed for this variable."
                      : "CO₂ milestones are not computed. Track growth trajectory in the chart above."}
                  </p>
                </div>
              </div>
            ) : null}

            {/* Mini snapshot table */}
            <div className="bg-[#0d1428] border border-white/5 rounded-2xl p-5 sm:p-6">
              <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-4">📋 Snapshot Table</h3>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/8">
                    <th className="pb-2 text-left text-gray-500 font-semibold">Year</th>
                    <th className="pb-2 text-right text-gray-500 font-semibold">Value</th>
                    <th className="pb-2 text-right text-gray-500 font-semibold">Lower 95%</th>
                    <th className="pb-2 text-right text-gray-500 font-semibold">Upper 95%</th>
                  </tr>
                </thead>
                <tbody>
                  {miniTableYears.map((yr) => {
                    const pt = (target === "temp" ? data.linear_future : data.future).find((f) => f.year === yr)
                    if (!pt) return null
                    const isSel = yr === selectedYear
                    return (
                      <tr key={yr} className={`border-b border-white/5 ${isSel ? "bg-white/8" : "hover:bg-white/5"}`}>
                        <td className="py-2.5 font-bold" style={isSel ? { color: tab.color } : { color: "#cbd5e1" }}>
                          {yr}{isSel ? " ◀" : ""}
                        </td>
                        <td className="py-2.5 text-right font-mono text-white font-bold">{fmtCell(pt.value)}</td>
                        <td className="py-2.5 text-right font-mono text-gray-400">{fmtCell(pt.lower)}</td>
                        <td className="py-2.5 text-right font-mono text-gray-400">{fmtCell(pt.upper)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* How we predict */}
          <div className="bg-[#0d1428] border border-white/5 rounded-2xl overflow-hidden">
            <button
              type="button"
              onClick={() => setHowOpen((o) => !o)}
              className="w-full flex items-center justify-between px-6 py-4 text-sm font-semibold text-gray-300 hover:text-white transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2"><span>🔬</span> How we predict</span>
              <span className="text-gray-500 text-lg">{howOpen ? "▲" : "▼"}</span>
            </button>
            {howOpen && (
              <div className="px-6 pb-5 text-[13px] text-gray-400 space-y-2 border-t border-white/5 pt-4 leading-relaxed">
                <p>① <span className="text-white font-medium">Input is year only.</span> We fit a curve on past data (2000–2024), then extend it forward to the target year.</p>
                <p>② <span className="text-white font-medium">The shaded band</span> shows uncertainty — it widens the further out we project, like a megaphone opening.</p>
                <p>③ <span className="text-rose-400 font-medium">Not a climate forecast.</span> This is a model-based estimate using only time as a predictor. Real climate has many more drivers.</p>
                <p>④ <span className="text-white font-medium">Only 25 data points (2000–2024).</span> The further from 2024, the less reliable the estimate becomes.</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
