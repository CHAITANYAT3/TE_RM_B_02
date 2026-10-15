import { useState, useMemo, useEffect } from 'react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import { useMLMetrics, MLTarget } from '../hooks/useMLMetrics'

// ─── Tooltip Styling ─────────────────────────────────────────────────────────
const ttStyle = {
  backgroundColor: '#0d1428',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '8px',
  color: '#e2e8f0',
  fontSize: '12px',
}
const ttLabelStyle = { color: '#94a3b8', marginBottom: 4, fontWeight: 600 }

// ─── Tab config ───────────────────────────────────────────────────────────────
const TABS: { key: MLTarget; label: string; icon: string; unit: string; color: string }[] = [
  { key: 'temp', label: 'Temperature', icon: '🌡️', unit: '°C',     color: '#f43f5e' },
  { key: 'rain', label: 'Rainfall',    icon: '🌧️', unit: 'mm',     color: '#38bdf8' },
  { key: 'co2',  label: 'CO₂',         icon: '🏭', unit: 'tonnes', color: '#34d399' },
]

// ─── SVG Diagrams ─────────────────────────────────────────────────────────────
function LinearDiagram() {
  const pts = [[20,70],[60,55],[100,40],[140,30],[180,20],[40,72],[80,50],[120,48],[160,25]]
  return (
    <svg viewBox="0 0 200 90" className="w-full h-full">
      {pts.map(([x,y],i) => <circle key={i} cx={x} cy={y} r="3.5" fill="#64748b" opacity="0.7"/>)}
      <line x1="10" y1="80" x2="190" y2="12" stroke="#22d3ee" strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  )
}
function PolyDiagram() {
  return (
    <svg viewBox="0 0 200 90" className="w-full h-full">
      {[[15,65],[40,50],[70,60],[110,38],[145,42],[175,22]].map(([x,y],i) =>
        <circle key={i} cx={x} cy={y} r="3.5" fill="#64748b" opacity="0.7"/>
      )}
      <path d="M10,70 C40,55 80,65 110,38 S160,28 190,18" stroke="#10b981" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
    </svg>
  )
}
function ForestDiagram() {
  return (
    <svg viewBox="0 0 200 90" className="w-full h-full">
      {[[20,15],[80,15],[140,15]].map(([tx,ty],i) => (
        <g key={i}>
          <polygon points={`${tx},${ty} ${tx-18},${ty+30} ${tx+18},${ty+30}`} fill="#f59e0b" opacity="0.6"/>
          <polygon points={`${tx},${ty+12} ${tx-14},${ty+36} ${tx+14},${ty+36}`} fill="#f59e0b" opacity="0.8"/>
          <rect x={tx-4} y={ty+36} width="8" height="10" fill="#92400e" opacity="0.7"/>
        </g>
      ))}
      <line x1="30" y1="56" x2="100" y2="72" stroke="#64748b" strokeWidth="1.5" strokeDasharray="4 3"/>
      <line x1="80" y1="56" x2="100" y2="72" stroke="#64748b" strokeWidth="1.5" strokeDasharray="4 3"/>
      <line x1="140" y1="56" x2="100" y2="72" stroke="#64748b" strokeWidth="1.5" strokeDasharray="4 3"/>
      <circle cx="100" cy="78" r="7" fill="#f59e0b" opacity="0.9"/>
    </svg>
  )
}
function GBDiagram() {
  const cols = [30,80,130,180]
  return (
    <svg viewBox="0 0 210 90" className="w-full h-full">
      <defs><marker id="arr" markerWidth="4" markerHeight="4" refX="3" refY="2" orient="auto"><path d="M0,0 L4,2 L0,4 Z" fill="#64748b"/></marker></defs>
      {cols.map((x,i) => (
        <g key={i}>
          <polygon points={`${x},12 ${x-16},34 ${x+16},34`} fill={['#a855f7','#8b5cf6','#7c3aed','#6d28d9'][i]} opacity={0.5+i*0.1}/>
          <rect x={x-5} y={34} width="10" height="8" fill="#4c1d95" opacity="0.7"/>
          {i < cols.length-1 && <line x1={x+16} y1="23" x2={cols[i+1]-16} y2="23" stroke="#64748b" strokeWidth="1.5" markerEnd="url(#arr)"/>}
        </g>
      ))}
    </svg>
  )
}
function XGBoostDiagram() {
  const trainPts = [[10,68],[22,64],[34,60],[46,57],[58,54],[70,51],[82,49],[94,47],[106,45],[118,43]]
  const testPts  = [[130,42],[142,42],[154,42],[166,42],[178,42]]
  return (
    <svg viewBox="0 0 200 90" className="w-full h-full">
      <line x1="6" y1="78" x2="194" y2="78" stroke="#334155" strokeWidth="1"/>
      <line x1="6" y1="78" x2="6"   y2="12" stroke="#334155" strokeWidth="1"/>
      <line x1="10" y1="68" x2="118" y2="43" stroke="#818cf8" strokeWidth="2" strokeLinecap="round"/>
      {trainPts.map(([x,y],i) => <circle key={i} cx={x} cy={y} r="2.5" fill="#818cf8" opacity="0.85"/>)}
      <line x1="118" y1="43" x2="190" y2="43" stroke="#f87171" strokeWidth="2" strokeDasharray="5 3" strokeLinecap="round"/>
      {testPts.map(([x,y],i) => <circle key={i} cx={x} cy={y-4-i*2} r="2.5" fill="#fbbf24" opacity="0.9"/>)}
      <rect x="118" y="12" width="74" height="66" fill="#f87171" opacity="0.04" rx="2"/>
      <text x="60"  y="86" textAnchor="middle" fill="#818cf8" fontSize="6.5">Train (≤2019)</text>
      <text x="154" y="86" textAnchor="middle" fill="#f87171" fontSize="6.5">Flat (&gt;2019)</text>
    </svg>
  )
}
function TFTDiagram() {
  return (
    <svg viewBox="0 0 200 90" className="w-full h-full">
      {([['Temp','#f59e0b'],['Rain','#38bdf8'],['CO₂','#34d399']] as [string,string][]).map(([label,color],i) => (
        <g key={i}>
          <rect x="3" y={6+i*22} width="34" height="16" rx="3" fill={color} opacity="0.15" stroke={color} strokeWidth="0.8"/>
          <text x="20" y={18+i*22} textAnchor="middle" fill={color} fontSize="6.5" fontWeight="600">{label}</text>
          <line x1="37" y1={14+i*22} x2="62" y2="35" stroke="#475569" strokeWidth="1" opacity="0.7"/>
        </g>
      ))}
      <rect x="62" y="22" width="34" height="20" rx="3" fill="#1e293b" stroke="#64748b" strokeWidth="1"/>
      <text x="79" y="34" textAnchor="middle" fill="#94a3b8" fontSize="6">GRN Gate</text>
      <line x1="96" y1="32" x2="110" y2="32" stroke="#38bdf8" strokeWidth="1.5"/>
      <rect x="110" y="20" width="40" height="24" rx="4" fill="#0c2340" stroke="#38bdf8" strokeWidth="1.2"/>
      <text x="130" y="30" textAnchor="middle" fill="#7dd3fc" fontSize="6" fontWeight="700">Multi-Head</text>
      <text x="130" y="39" textAnchor="middle" fill="#7dd3fc" fontSize="6" fontWeight="700">Attention</text>
      <line x1="150" y1="32" x2="162" y2="32" stroke="#38bdf8" strokeWidth="1.5"/>
      <rect x="162" y="24" width="34" height="16" rx="3" fill="#0e4a2e" stroke="#34d399" strokeWidth="1"/>
      <text x="179" y="35" textAnchor="middle" fill="#6ee7b7" fontSize="7" fontWeight="700">ŷ</text>
    </svg>
  )
}

// ─── Model definitions ────────────────────────────────────────────────────────
interface ModelDef {
  key: string
  name: string
  shortName: string   // display name for matching API keys
  caption: string
  diagram: React.ReactNode
  howItWorks: string
  limitation: string
  limitationColor: 'purple' | 'amber' | 'slate'
  experimental?: boolean
}

const MODEL_DEFS: ModelDef[] = [
  {
    key: 'linear',
    name: 'Linear Regression',
    shortName: 'Linear Regression',
    caption: 'Fits a straight-line trend',
    diagram: <LinearDiagram />,
    howItWorks: 'Fits a single straight line by minimising the sum of squared residuals. Assumes a constant rate of change across the entire time range.',
    limitation: 'Cannot capture non-linear patterns; all future predictions lie on the same slope extrapolated from training data.',
    limitationColor: 'slate',
  },
  {
    key: 'poly',
    name: 'Polynomial Regression',
    shortName: 'Polynomial Regression',
    caption: 'Fits curved trends (degree 2)',
    diagram: <PolyDiagram />,
    howItWorks: 'Extends linear regression by adding squared (and higher-degree) terms, allowing the fitted curve to bend. Captures acceleration or deceleration in trends.',
    limitation: 'High-degree polynomials can oscillate wildly outside the training range (Runge\'s phenomenon), and even degree-2 curves may diverge rapidly in future years.',
    limitationColor: 'slate',
  },
  {
    key: 'rf',
    name: 'Random Forest',
    shortName: 'Random Forest Regression',
    caption: 'Multiple trees → one prediction',
    diagram: <ForestDiagram />,
    howItWorks: 'Builds hundreds of decision trees on random sub-samples and averages their outputs. Reduces variance through bagging and handles non-linear interactions well.',
    limitation: 'Tree ensembles cannot extrapolate beyond the training range. Predictions for future years are bounded by the leaf averages seen during training.',
    limitationColor: 'purple',
  },
  {
    key: 'gb',
    name: 'Gradient Boosting',
    shortName: 'Gradient Boosting Regression',
    caption: 'Sequential error-correcting trees',
    diagram: <GBDiagram />,
    howItWorks: 'Trains trees sequentially — each tree fits the residual errors of the current ensemble. Uses gradient descent in function space for precise, adaptive correction.',
    limitation: 'Same extrapolation ceiling as Random Forest: output is flat beyond training data range. Prone to overfitting on small datasets without careful regularisation.',
    limitationColor: 'purple',
  },
  {
    key: 'xgb',
    name: 'XGBoost',
    shortName: 'XGBoost Regression',
    caption: 'Regularised boosting — flat beyond 2019',
    diagram: <XGBoostDiagram />,
    howItWorks: 'Optimised gradient boosting using second-order (Newton) gradients, L1/L2 regularisation, and parallel tree construction. The fastest and most regularised tree ensemble here.',
    limitation: 'Structurally cannot extrapolate. For years after the training cutoff the model outputs the last-seen leaf average — a constant flat value while actual climate continues to trend.',
    limitationColor: 'purple',
  },
  {
    key: 'tft',
    name: 'TFT',
    shortName: 'TFT',
    caption: 'Attention transformer — limited by N=25 samples',
    diagram: <TFTDiagram />,
    howItWorks: 'Combines a Gated Residual Network (GRN) for feature selection with multi-head self-attention to capture long-range temporal dependencies across multiple input variables.',
    limitation: 'Data-hungry by design — requires hundreds of time steps. With only 25 annual observations the model is severely overparameterised and results are diagnostic only.',
    limitationColor: 'amber',
    experimental: true,
  },
]

// Map backend model name strings → MODEL_DEFS key
function resolveModelKey(backendName: string): string {
  const n = backendName.toLowerCase()
  if (n.includes('xgboost'))             return 'xgb'
  if (n.includes('gradient'))            return 'gb'
  if (n.includes('random'))             return 'rf'
  if (n.includes('polynomial'))         return 'poly'
  if (n.includes('linear'))             return 'linear'
  if (n.includes('tft') || n.includes('temporal')) return 'tft'
  return n
}

// ─── Side Panel ───────────────────────────────────────────────────────────────
interface PanelProps {
  modelKey: string
  data: any /* TemperatureMLResponse */
  unit: string
  onClose: () => void
}

function SidePanel({ modelKey, data, unit, onClose }: PanelProps) {
  const def = MODEL_DEFS.find(m => m.key === modelKey)
  if (!def) return null

  // Find metrics row from model_comparison or tft_experimental
  const row = useMemo(() => {
    if (!data) return null
    if (modelKey === 'tft' && data.tft_experimental) {
      return {
        model: 'TFT (Experimental)',
        mae: data.tft_experimental.metrics.mae,
        rmse: data.tft_experimental.metrics.rmse,
        r2: data.tft_experimental.metrics.r2,
        rank: 6,
      }
    }
    return data.model_comparison?.find((m: any) => resolveModelKey(m.model) === modelKey) || null
  }, [data, modelKey])

  // Build actual-vs-predicted chart for this model only
  const chartData = useMemo(() => {
    if (!data) return []
    if (modelKey === 'tft' && data.tft_experimental?.yearly_predictions) {
      return data.tft_experimental.yearly_predictions.map((yp: any) => ({
        year: String(yp.year),
        Actual: yp.actual,
        Predicted: yp.predicted,
      }))
    }
    if (!data.yearly_predictions) return []
    return data.yearly_predictions.map((yp: any) => {
      const predKey = Object.keys(yp.predictions || {}).find(k => resolveModelKey(k) === modelKey)
      return {
        year: String(yp.year),
        Actual: yp.actual,
        Predicted: predKey !== undefined ? yp.predictions[predKey] : null,
      }
    })
  }, [data, modelKey])

  // Compute min-to-max y-domain with margin so chart does not start at 0
  const yDomain = useMemo(() => {
    const vals: number[] = []
    chartData.forEach((d) => {
      if (d.Actual !== null && d.Actual !== undefined && !isNaN(d.Actual)) vals.push(Number(d.Actual))
      if (d.Predicted !== null && d.Predicted !== undefined && !isNaN(d.Predicted)) vals.push(Number(d.Predicted))
    })
    if (!vals.length) return ['auto', 'auto']
    const min = Math.min(...vals)
    const max = Math.max(...vals)
    const margin = (max - min) * 0.08 || 0.1
    return [
      Number((min - margin).toFixed(4)),
      Number((max + margin).toFixed(4)),
    ]
  }, [chartData])

  const lcColors: Record<string, string> = {
    slate: '#64748b', purple: '#a855f7', amber: '#f59e0b',
  }
  const limitColor = lcColors[def.limitationColor] || '#64748b'

  return (
    <aside className="w-80 md:w-96 bg-[#080d1a] border-l border-white/10 h-full overflow-y-auto shadow-2xl flex flex-col shrink-0 z-20">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/8 shrink-0">
        <div className="flex items-center gap-2">
          {def.experimental && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border border-amber-500/40 text-amber-400 bg-amber-500/10">
              Experimental
            </span>
          )}
          <h2 className="text-sm font-bold text-white">{def.name}</h2>
        </div>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-white transition-colors w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10"
          title="Close details"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 px-5 py-4 space-y-5">
        {/* Diagram */}
        <div className="h-20 w-full rounded-lg bg-white/[0.02] border border-white/5 p-1">
          {def.diagram}
        </div>

        {/* How it works */}
        <div>
          <p className="text-[10px] font-semibold text-cyan-400 uppercase tracking-wider mb-1.5">How it works</p>
          <p className="text-[11px] text-gray-400 leading-relaxed">{def.howItWorks}</p>
        </div>

        {/* Metrics */}
        {row ? (
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Test Metrics</p>
            <div className="grid grid-cols-2 gap-2.5 bg-white/[0.02] border border-white/5 rounded-lg p-3 text-center">
              {[
                ['MAE',  `${row.mae >= 100000 ? (row.mae / 1e6).toFixed(2) + ' Mt' : row.mae.toFixed(4)}`,  'text-gray-200'],
                ['RMSE', `${row.rmse >= 100000 ? (row.rmse / 1e6).toFixed(2) + ' Mt' : row.rmse.toFixed(4)}`, 'text-cyan-400'],
                ['R²',   `${row.r2.toFixed(4)}`,   row.r2 >= 0 ? 'text-emerald-400' : 'text-rose-400'],
                ['Rank', `#${row.rank}`,            'text-gray-400'],
              ].map(([label, value, cls]) => (
                <div key={label} className="p-1">
                  <span className="text-[9px] text-gray-500 uppercase block mb-0.5">{label}</span>
                  <span className={`text-xs font-bold font-mono ${cls}`}>{value}</span>
                </div>
              ))}
            </div>

            {/* Negative R² badge */}
            {row.r2 < 0 && (
              <div className="mt-2 bg-rose-500/10 border border-rose-500/25 rounded-lg px-3 py-2 flex items-start gap-2">
                <span className="text-rose-400 shrink-0 text-xs mt-0.5">📉</span>
                <p className="text-[11px] text-rose-300/80 leading-relaxed">
                  <span className="font-semibold">Worse than the mean</span> — R² = {row.r2.toFixed(4)} means
                  this model performs worse than simply predicting the training mean.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white/[0.02] border border-white/5 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-500">
              {modelKey === 'tft' ? 'Not evaluated for this variable' : 'Metrics not available for this variable'}
            </p>
          </div>
        )}

        {/* Actual vs Predicted mini chart */}
        {chartData.length > 0 && row && (
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Predicted vs Actual</p>
            <div className="h-40 bg-white/[0.02] border border-white/5 rounded-lg p-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)"/>
                  <XAxis dataKey="year" stroke="#64748b" fontSize={9} interval="preserveStartEnd"/>
                  <YAxis
                    stroke="#64748b"
                    fontSize={9}
                    domain={yDomain}
                    tickFormatter={(v: number) => {
                      if (v >= 1e9) return (v / 1e9).toFixed(2) + ' Gt'
                      if (v >= 1e6) return (v / 1e6).toFixed(1) + ' Mt'
                      return v.toFixed(unit === '°C' ? 2 : unit === 'mm' ? 0 : 2)
                    }}
                  />
                  <Tooltip
                    contentStyle={ttStyle}
                    labelStyle={ttLabelStyle}
                    formatter={(v: any, n: any) => {
                      const num = Number(v)
                      if (num >= 1e9) return [`${(num / 1e9).toFixed(3)} Gt`, String(n)]
                      if (num >= 1e6) return [`${(num / 1e6).toFixed(2)} Mt`, String(n)]
                      return [`${num.toFixed(4)} ${unit}`, String(n)]
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="Actual"
                    stroke="#f43f5e"
                    strokeWidth={2}
                    dot={{ r: 3, fill: '#f43f5e' }}
                    name="Actual"
                  />
                  <Line
                    type="monotone"
                    dataKey="Predicted"
                    stroke="#22d3ee"
                    strokeWidth={2}
                    strokeDasharray="4 3"
                    dot={{ r: 3, fill: '#22d3ee' }}
                    name="Predicted"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Limitation badge */}
        <div
          className="rounded-lg px-3 py-2.5 flex items-start gap-2 border"
          style={{
            background: `${limitColor}10`,
            borderColor: `${limitColor}40`,
          }}
        >
          <span className="text-sm shrink-0 mt-0.5">⚠</span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide mb-0.5" style={{ color: limitColor }}>
              Limitation
            </p>
            <p className="text-[11px] leading-relaxed" style={{ color: `${limitColor}cc` }}>
              {def.limitation}
            </p>
          </div>
        </div>
      </div>
    </aside>
  )
}

// ─── Model Tile ───────────────────────────────────────────────────────────────
interface TileProps {
  def: ModelDef
  isBest: boolean
  isSelected: boolean
  onClick: () => void
}

function ModelTile({ def, isBest, isSelected, onClick }: TileProps) {
  return (
    <button
      onClick={onClick}
      className={`relative bg-[#0d1428] rounded-xl p-3 flex flex-col gap-2 text-left transition-all duration-200 border ${
        isSelected
          ? 'border-cyan-400/50 ring-1 ring-cyan-400/20 shadow-[0_0_16px_rgba(34,211,238,0.08)]'
          : 'border-white/5 hover:border-white/20'
      }`}
    >
      {/* Best badge */}
      {isBest && (
        <span className="absolute top-2 right-2 text-[9px] font-bold px-1.5 py-0.5 rounded border border-emerald-500/40 text-emerald-400 bg-emerald-500/10">
          ★ Best
        </span>
      )}
      {/* Experimental badge */}
      {def.experimental && !isBest && (
        <span className="absolute top-2 right-2 text-[9px] font-bold px-1.5 py-0.5 rounded border border-amber-500/40 text-amber-400 bg-amber-500/10">
          Experimental
        </span>
      )}
      {/* Diagram */}
      <div className="h-16 w-full">{def.diagram}</div>
      {/* Name */}
      <p className="text-xs font-semibold text-white leading-snug pr-10">{def.name}</p>
      {/* Caption */}
      <p className="text-[10px] text-gray-500 leading-relaxed">{def.caption}</p>
    </button>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function MLModels() {
  const [activeTab, setActiveTab] = useState<MLTarget>('temp')
  const [selectedModelKey, setSelectedModelKey] = useState<string | null>(null)
  const { data, loading, error } = useMLMetrics(activeTab)

  const tab = TABS.find(t => t.key === activeTab)!

  // Determine best model key from API data
  const bestModelKey = useMemo(() => {
    if (!data?.best_model?.model) return null
    return resolveModelKey(data.best_model.model)
  }, [data])

  // Leaderboard including TFT for every tab
  const leaderboard = useMemo(() => {
    if (!data?.model_comparison) return []
    const list = data.model_comparison.map((m: any) => ({
      ...m,
      isEvaluated: true,
    }))

    const hasTFT = list.some((m: any) => {
      const name = m.model.toLowerCase()
      return name.includes('tft') || name.includes('temporal fusion')
    })

    if (!hasTFT) {
      if (activeTab === 'temp' && data.tft_experimental) {
        list.push({
          rank: 6,
          model: 'TFT (Experimental)',
          mae: data.tft_experimental.metrics.mae,
          rmse: data.tft_experimental.metrics.rmse,
          r2: data.tft_experimental.metrics.r2,
          isEvaluated: true,
        })
      } else {
        list.push({
          rank: '—',
          model: 'TFT (Experimental)',
          mae: null,
          rmse: null,
          r2: null,
          isEvaluated: false,
        })
      }
    }

    return list
  }, [data, activeTab])

  // On data load or tab change: select its best model
  useEffect(() => {
    if (data?.best_model?.model) {
      setSelectedModelKey(resolveModelKey(data.best_model.model))
    }
  }, [data])

  const handleTabChange = (key: MLTarget) => {
    if (key === activeTab) {
      if (bestModelKey) setSelectedModelKey(bestModelKey)
      return
    }
    setActiveTab(key)
    setSelectedModelKey(null)
  }

  return (
    <div className="flex-1 flex h-full overflow-hidden">
      {/* ─── Scrollable Main Content ──────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8 min-w-0">

        {/* ─── Header ────────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"/>
            <span className="text-xs text-cyan-400 font-medium uppercase tracking-widest">
              Machine Learning Models
            </span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">Climate Prediction Models</h1>
          <p className="text-gray-400 text-sm max-w-2xl">
            Six models evaluated on India's annual climate data with a chronological
            train/test split — no temporal leakage.
          </p>
        </div>

        {/* ─── Tabs ──────────────────────────────────────────────────── */}
        <div className="flex items-center gap-1 bg-[#080d1a] border border-white/10 p-1 rounded-xl w-fit">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => handleTabChange(t.key)}
              className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all duration-200 ${
                activeTab === t.key
                  ? 'bg-gradient-to-r from-cyan-500/25 to-blue-500/25 text-white border border-cyan-400/40'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
              }`}
            >
              <span>{t.icon}</span>
              <span>{t.label}</span>
              <span className="text-[9px] opacity-50 font-mono">({t.unit})</span>
            </button>
          ))}
        </div>

        {/* ─── Error Banner ───────────────────────────────────────────── */}
        {error && (
          <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400">
            <span>⚠</span>
            <div>
              <p className="font-medium">Failed to load ML model data</p>
              <p className="text-xs text-red-400/70">{error}</p>
            </div>
          </div>
        )}

        {/* ─── Loading skeletons ──────────────────────────────────────── */}
        {loading && (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-40 bg-white/5 rounded-xl animate-pulse"/>
            ))}
          </div>
        )}

        {/* ─── Model tiles + overview ──────────────────────────────────── */}
        {data && !loading && (
          <>
            {/* Train/Test split info */}
            <div className="flex items-center gap-4 flex-wrap">
              <div className="bg-[#0d1428] border border-white/5 rounded-xl px-4 py-3">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">Training</p>
                <p className="text-sm font-bold text-white">
                  {data.training_period.start_year}–{data.training_period.end_year}
                  <span className="text-xs font-normal text-gray-500 ml-2">{data.training_period.total_years} samples</span>
                </p>
              </div>
              <div className="bg-[#0d1428] border border-white/5 rounded-xl px-4 py-3">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">Test</p>
                <p className="text-sm font-bold text-white">
                  {data.testing_period.start_year}–{data.testing_period.end_year}
                  <span className="text-xs font-normal text-gray-500 ml-2">{data.testing_period.total_years} samples</span>
                </p>
              </div>
              <div className="bg-gradient-to-br from-emerald-950/50 to-[#0d1428] border border-emerald-500/30 rounded-xl px-4 py-3">
                <p className="text-[10px] text-emerald-400 uppercase tracking-wider font-bold mb-0.5">★ Best Model</p>
                <p className="text-sm font-bold text-white">
                  {data.best_model.model.replace(' Regression','').replace(' (degree 2)','')}
                  <span className="text-xs font-normal text-emerald-400 font-mono ml-2">
                    RMSE {data.best_model.rmse.toFixed(4)} {tab.unit}
                  </span>
                </p>
              </div>
            </div>

            {/* Tiles */}
            <section>
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">
                Click a model to inspect metrics
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                {MODEL_DEFS.map(def => (
                  <ModelTile
                    key={def.key}
                    def={def}
                    isBest={def.key === bestModelKey}
                    isSelected={selectedModelKey === def.key}
                    onClick={() => setSelectedModelKey(def.key)}
                  />
                ))}
              </div>
            </section>

            {/* Compact metrics table */}
            <section>
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">
                All Models · Test Metrics ({tab.unit})
              </h2>
              <div className="bg-[#0d1428] border border-white/5 rounded-xl p-4 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/5 text-gray-500 uppercase text-[10px] tracking-wider">
                      <th className="pb-2 text-left pl-2">Rank</th>
                      <th className="pb-2 text-left">Model</th>
                      <th className="pb-2 text-right">MAE</th>
                      <th className="pb-2 text-right">RMSE</th>
                      <th className="pb-2 text-right pr-2">R²</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.03]">
                    {leaderboard.map((m: any) => {
                      const isBest = data?.best_model && m.model === data.best_model.model
                      const isNegativeR2 = m.isEvaluated && m.r2 !== null && m.r2 < 0
                      return (
                        <tr
                          key={m.model}
                          className={`cursor-pointer transition-colors ${
                            isBest ? 'bg-emerald-500/8' : 'hover:bg-white/[0.02]'
                          }`}
                          onClick={() => setSelectedModelKey(resolveModelKey(m.model))}
                        >
                          <td className="py-2.5 pl-2 font-mono">
                            {isBest
                              ? <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px]">1</span>
                              : <span className="text-gray-600">{m.rank}</span>}
                          </td>
                          <td className="py-2.5 font-medium text-gray-200">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span>{m.model.replace(' Regression','').replace(' (degree 2)','')}</span>
                              {isBest && <span className="text-[10px] text-emerald-400 font-bold">★ Best</span>}
                              {isNegativeR2 && (
                                <span className="text-[9px] font-bold text-rose-400 bg-rose-500/15 border border-rose-500/30 px-1.5 py-0.5 rounded tracking-wide">
                                  Worse than the mean
                                </span>
                              )}
                              {!m.isEvaluated && (
                                <span className="text-[9px] font-medium text-amber-400/80 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded">
                                  Not evaluated
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 text-right font-mono text-gray-400">
                            {m.isEvaluated && m.mae !== null ? m.mae.toFixed(4) : '—'}
                          </td>
                          <td className={`py-2.5 text-right font-mono font-bold ${isBest ? 'text-emerald-400' : 'text-gray-200'}`}>
                            {m.isEvaluated && m.rmse !== null ? m.rmse.toFixed(4) : '—'}
                          </td>
                          <td className={`py-2.5 text-right font-mono pr-2 ${!m.isEvaluated ? 'text-gray-500' : m.r2 >= 0 ? 'text-cyan-400' : 'text-rose-400'}`}>
                            {m.isEvaluated && m.r2 !== null ? m.r2.toFixed(4) : 'Not evaluated'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>

      {/* ─── Side Panel ──────────────────────────────────────────────── */}
      {selectedModelKey && data && (
        <SidePanel
          modelKey={selectedModelKey}
          data={data}
          unit={tab.unit}
          onClose={() => setSelectedModelKey(null)}
        />
      )}
    </div>
  )
}
