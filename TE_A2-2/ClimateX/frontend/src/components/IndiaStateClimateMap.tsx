import { useState, useMemo } from 'react'
import {
  INDIA_STATES_DATA,
  INDICATOR_METAS,
  IndicatorType,
  StateClimateRecord,
  getStateColor,
} from '../data/indiaStateClimateData'

// Data year availability per indicator
const DATA_YEARS: Record<IndicatorType, number[]> = {
  temperature: [2023],
  rainfall: [2023],
  co2: [2020],
}

export default function IndiaStateClimateMap() {
  const [selectedIndicator, setSelectedIndicator] = useState<IndicatorType>('temperature')
  const [selectedYear, setSelectedYear] = useState<number>(2023)
  const [hoveredState, setHoveredState] = useState<StateClimateRecord | null>(null)
  const [pinnedState, setPinnedState] = useState<StateClimateRecord | null>(null)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null)

  const meta = INDICATOR_METAS[selectedIndicator]
  const availableYears = DATA_YEARS[selectedIndicator]
  const isYearAvailable = availableYears.includes(selectedYear)
  const YEARS = Array.from({ length: 25 }, (_, i) => 2000 + i)

  // Ranked list for the active indicator
  const rankedStates = useMemo(() => {
    return [...INDIA_STATES_DATA].sort((a, b) => b[selectedIndicator] - a[selectedIndicator])
  }, [selectedIndicator])

  // Filtered states for quick search
  const filteredStates = useMemo(() => {
    if (!searchQuery.trim()) return []
    const q = searchQuery.toLowerCase()
    return INDIA_STATES_DATA.filter((s) => s.name.toLowerCase().includes(q))
  }, [searchQuery])

  // Active state to highlight in detail card (pinned > hovered > default Maharashtra)
  const activeState = useMemo(() => {
    if (pinnedState) return pinnedState
    if (hoveredState) return hoveredState
    // Default to Maharashtra or first state
    return INDIA_STATES_DATA.find((s) => s.name === 'Maharashtra') || INDIA_STATES_DATA[0]
  }, [pinnedState, hoveredState])

  // National averages calculated from the 36 states/UTs
  const nationalStats = useMemo(() => {
    const avgTemp = INDIA_STATES_DATA.reduce((acc, s) => acc + s.temperature, 0) / INDIA_STATES_DATA.length
    const avgRain = INDIA_STATES_DATA.reduce((acc, s) => acc + s.rainfall, 0) / INDIA_STATES_DATA.length
    const totalCO2 = INDIA_STATES_DATA.reduce((acc, s) => acc + s.co2, 0)
    return { avgTemp, avgRain, totalCO2 }
  }, [])

  // Rank of active state in selected indicator
  const activeStateRank = useMemo(() => {
    const idx = rankedStates.findIndex((s) => s.name === activeState.name)
    return idx >= 0 ? idx + 1 : null
  }, [rankedStates, activeState])

  const topStates = useMemo(() => rankedStates.slice(0, 4), [rankedStates])
  const bottomStates = useMemo(() => [...rankedStates].reverse().slice(0, 4), [rankedStates])

  return (
    <div className="bg-[#0d1428] border border-white/10 rounded-2xl p-6 shadow-2xl relative overflow-hidden mb-8">
      {/* Decorative gradient glow background */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-10 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header & Indicator Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6 relative z-10 border-b border-white/5 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xl">🗺</span>
            <span className="text-xs font-semibold uppercase tracking-widest text-cyan-400">
              Sub-National Climate Intelligence
            </span>
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            India State-Wise Climate & Emission Map
          </h2>
          <p className="text-xs text-gray-400 mt-1 max-w-2xl">
            Interactive geographic distribution of {meta.label.toLowerCase()} across all 28 Indian States and 8 Union
            Territories. Grounded exclusively in verified government agency publications.
          </p>
        </div>

        {/* Right controls: Indicator + Year Selector */}
        <div className="flex flex-col gap-3 shrink-0">
          {/* Indicator Selector Buttons */}
          <div className="flex flex-wrap items-center gap-2 bg-[#080d1a] border border-white/10 p-1.5 rounded-xl shadow-inner">
            {(['temperature', 'rainfall', 'co2'] as IndicatorType[]).map((key) => {
              const m = INDICATOR_METAS[key]
              const isSelected = selectedIndicator === key
              const icons: Record<IndicatorType, string> = {
                temperature: '🌡',
                rainfall: '🌧',
                co2: '🏭',
              }
              return (
                <button
                  key={key}
                  onClick={() => {
                    setSelectedIndicator(key)
                    // Auto-snap year to closest available year for this indicator
                    const avail = DATA_YEARS[key]
                    if (!avail.includes(selectedYear)) {
                      setSelectedYear(avail[avail.length - 1])
                    }
                  }}
                  className={`px-4 py-2.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all duration-200 cursor-pointer ${
                    isSelected
                      ? 'bg-gradient-to-r from-cyan-500/25 to-blue-500/25 text-white border border-cyan-400/50 shadow-md shadow-cyan-500/10 scale-102'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <span className="text-sm">{icons[key]}</span>
                  <span>{m.label}</span>
                  <span className="text-[10px] opacity-70 font-mono">({m.unit})</span>
                </button>
              )
            })}
          </div>

          {/* Year Selector */}
          <div className="bg-[#080d1a] border border-white/10 rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold">📅 Select Year</span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-md font-mono ${
                isYearAvailable
                  ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                  : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
              }`}>{selectedYear}</span>
            </div>
            <input
              id="year-slider"
              type="range"
              min={2000}
              max={2024}
              step={1}
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-cyan-400"
              style={{
                background: `linear-gradient(to right, #22d3ee 0%, #22d3ee ${
                  ((selectedYear - 2000) / 24) * 100
                }%, rgba(255,255,255,0.1) ${
                  ((selectedYear - 2000) / 24) * 100
                }%, rgba(255,255,255,0.1) 100%)`,
              }}
            />
            <div className="flex justify-between text-[9px] text-gray-500 mt-1 font-mono">
              <span>2000</span>
              <span>2012</span>
              <span>2024</span>
            </div>
            {/* Quick-access year chips for available years */}
            <div className="flex flex-wrap gap-1 mt-2">
              {YEARS.filter((_, i) => i % 4 === 0 || availableYears.includes(2000 + i)).map((y) => (
                <button
                  key={y}
                  onClick={() => setSelectedYear(y)}
                  className={`text-[9px] px-1.5 py-0.5 rounded font-mono transition-all ${
                    y === selectedYear
                      ? 'bg-cyan-500/30 text-cyan-200 border border-cyan-400/50'
                      : availableYears.includes(y)
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20'
                      : 'bg-white/5 text-gray-500 border border-white/5 hover:bg-white/10 hover:text-gray-300'
                  }`}
                >
                  {y}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Indicator Context Strip */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4 bg-white/[0.02] border border-white/5 rounded-xl p-3.5 text-xs text-gray-300">
        <div className="flex items-center gap-2.5">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <div>
            <span className="text-gray-400 text-[10px] uppercase tracking-wider block">Active Parameter</span>
            <span className="font-semibold text-white">{meta.label}</span>
          </div>
        </div>

        <div>
          <span className="text-gray-400 text-[10px] uppercase tracking-wider block">Selected Year</span>
          <span className={`font-semibold ${ isYearAvailable ? 'text-amber-300' : 'text-amber-400/70' }`}>
            {selectedYear} {!isYearAvailable && '(see note ↓)'}
          </span>
        </div>

        <div>
          <span className="text-gray-400 text-[10px] uppercase tracking-wider block">Official Source</span>
          <span className="font-semibold text-gray-200 truncate block" title={meta.agency}>
            {meta.agency}
          </span>
        </div>

        <div>
          <span className="text-gray-400 text-[10px] uppercase tracking-wider block">National Benchmark</span>
          <span className="font-semibold text-cyan-300">
            {selectedIndicator === 'temperature' && `${nationalStats.avgTemp.toFixed(1)} °C Mean`}
            {selectedIndicator === 'rainfall' && `${Math.round(nationalStats.avgRain)} mm Mean`}
            {selectedIndicator === 'co2' && `${nationalStats.totalCO2.toFixed(1)} Mt Total`}
          </span>
        </div>
      </div>

      {/* Year Availability Notice */}
      {!isYearAvailable && (
        <div className="mb-5 bg-amber-500/8 border border-amber-500/25 rounded-xl p-3.5 flex items-start gap-3 text-xs">
          <span className="text-amber-400 text-base shrink-0 mt-0.5">⚠️</span>
          <div>
            <span className="font-semibold text-amber-300 block mb-0.5">Data for {selectedYear} not yet available</span>
            <span className="text-gray-400 leading-relaxed">
              Verified state-wise <strong className="text-gray-300">{meta.label}</strong> data is currently available only for{' '}
              <strong className="text-cyan-300">{availableYears.join(', ')}</strong>.
              The map below shows data for <strong className="text-amber-300">{meta.year}</strong> (official {meta.agency} publication).
              Sub-national climate records for all years 2000–2024 are not yet publicly available at state resolution.
            </span>
          </div>
        </div>
      )}

      {/* Main Grid: SVG Map on Left, Detailed State Intelligence on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Map Canvas (Left 7 Columns) */}
        <div className="lg:col-span-7 bg-[#070b16] border border-white/10 rounded-xl p-4 flex flex-col justify-between relative min-h-[580px] overflow-hidden">
          {/* Search Bar & State Quick Select */}
          <div className="flex items-center justify-between gap-3 mb-3 z-10">
            <div className="relative flex-1 max-w-xs">
              <input
                type="text"
                placeholder="Search state (e.g. Kerala, Gujarat)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#0d1428] border border-white/15 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 transition"
              />
              {filteredStates.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-[#0d1428] border border-white/20 rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto">
                  {filteredStates.map((st) => (
                    <button
                      key={st.name}
                      onClick={() => {
                        setPinnedState(st)
                        setSearchQuery('')
                      }}
                      className="w-full text-left px-3 py-2 text-xs text-gray-200 hover:bg-cyan-500/20 hover:text-cyan-300 flex items-center justify-between border-b border-white/5 last:border-none"
                    >
                      <span>{st.name}</span>
                      <span className="text-[10px] text-gray-400 font-mono">
                        {meta.format(st[selectedIndicator])}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {pinnedState && (
              <button
                onClick={() => setPinnedState(null)}
                className="text-[11px] text-gray-400 hover:text-white bg-white/5 border border-white/10 px-2.5 py-1 rounded-md transition"
              >
                Clear Pin: <span className="text-cyan-400 font-medium">{pinnedState.name}</span> ✕
              </button>
            )}
          </div>

          {/* SVG Map Container */}
          <div
            className="relative w-full flex items-center justify-center py-2"
            onMouseLeave={() => {
              setHoveredState(null)
              setTooltipPos(null)
            }}
          >
            <svg
              viewBox="0 0 800 920"
              className="w-full h-auto max-h-[520px] select-none filter drop-shadow-[0_8px_20px_rgba(0,0,0,0.6)]"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                {/* Glow Filter for Active/Hovered State */}
                <filter id="hoverGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>

                {/* Subtle Map Water Background Gradient */}
                <radialGradient id="oceanGrad" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#0a1224" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#050812" stopOpacity="0.8" />
                </radialGradient>
              </defs>

              {/* Water background subtle framing */}
              <rect x="0" y="0" width="800" height="920" fill="url(#oceanGrad)" rx="12" />

              {/* Coordinates Grid Lines */}
              <line x1="160" y1="40" x2="160" y2="880" stroke="rgba(255,255,255,0.03)" strokeDasharray="3 4" />
              <line x1="400" y1="40" x2="400" y2="880" stroke="rgba(255,255,255,0.04)" strokeDasharray="3 4" />
              <line x1="640" y1="40" x2="640" y2="880" stroke="rgba(255,255,255,0.03)" strokeDasharray="3 4" />
              <line x1="40" y1="240" x2="760" y2="240" stroke="rgba(255,255,255,0.03)" strokeDasharray="3 4" />
              <line x1="40" y1="480" x2="760" y2="480" stroke="rgba(255,255,255,0.04)" strokeDasharray="3 4" />
              <line x1="40" y1="720" x2="760" y2="720" stroke="rgba(255,255,255,0.03)" strokeDasharray="3 4" />

              {/* 36 State Paths */}
              <g id="india-states-layer">
                {INDIA_STATES_DATA.map((state) => {
                  const val = state[selectedIndicator]
                  const fillColor = getStateColor(selectedIndicator, val)
                  const isHovered = hoveredState?.name === state.name
                  const isPinned = pinnedState?.name === state.name
                  const isActive = isHovered || isPinned

                  return (
                    <path
                      key={state.name}
                      d={state.path}
                      fill={fillColor}
                      stroke={isActive ? '#38bdf8' : '#1e293b'}
                      strokeWidth={isActive ? '2.5' : '0.8'}
                      strokeLinejoin="round"
                      filter={isActive ? 'url(#hoverGlow)' : undefined}
                      className="cursor-pointer transition-all duration-200"
                      style={{
                        opacity: isActive ? 1.0 : hoveredState ? 0.8 : 0.95,
                      }}
                      onMouseEnter={(e) => {
                        setHoveredState(state)
                        const rect = e.currentTarget.getBoundingClientRect()
                        setTooltipPos({ x: rect.left + rect.width / 2, y: rect.top })
                      }}
                      onMouseMove={(e) => {
                        setTooltipPos({ x: e.clientX, y: e.clientY })
                      }}
                      onClick={() => {
                        setPinnedState((prev) => (prev?.name === state.name ? null : state))
                      }}
                    />
                  )
                })}
              </g>

              {/* Labels for Major States */}
              <g id="state-labels" className="pointer-events-none select-none">
                {INDIA_STATES_DATA.filter((s) =>
                  [
                    'Maharashtra',
                    'Rajasthan',
                    'Madhya Pradesh',
                    'Uttar Pradesh',
                    'Gujarat',
                    'Karnataka',
                    'Tamil Nadu',
                    'Odisha',
                    'Assam',
                    'West Bengal',
                    'Ladakh',
                    'Jammu & Kashmir',
                  ].includes(s.name)
                ).map((s) => (
                  <text
                    key={s.name}
                    x={s.center.x}
                    y={s.center.y}
                    textAnchor="middle"
                    fill="rgba(255,255,255,0.75)"
                    fontSize="9.5"
                    fontWeight="600"
                    className="drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]"
                  >
                    {s.name}
                  </text>
                ))}
              </g>

              {/* Center Map Compass / Geographic Legend */}
              <g transform="translate(680, 80)" className="pointer-events-none">
                <circle cx="20" cy="20" r="16" fill="#0d1428" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
                <path d="M 20,8 L 24,20 L 20,16 L 16,20 Z" fill="#38bdf8" />
                <path d="M 20,32 L 24,20 L 20,24 L 16,20 Z" fill="rgba(255,255,255,0.4)" />
                <text x="20" y="6" textAnchor="middle" fill="#38bdf8" fontSize="8" fontWeight="bold">
                  N
                </text>
              </g>
            </svg>

            {/* Floating Follow-Cursor Tooltip */}
            {hoveredState && tooltipPos && (
              <div
                className="fixed pointer-events-none z-50 bg-[#070b16]/95 border border-cyan-400/40 rounded-xl p-3 shadow-2xl backdrop-blur-md transform -translate-x-1/2 -translate-y-full mb-3 text-left w-64 animate-in fade-in zoom-in-95 duration-100"
                style={{
                  left: tooltipPos.x,
                  top: tooltipPos.y - 12,
                }}
              >
                <div className="flex items-center justify-between border-b border-white/10 pb-1.5 mb-2">
                  <span className="font-bold text-sm text-white">{hoveredState.name}</span>
                  <span className="text-[10px] bg-white/10 text-gray-300 px-1.5 py-0.5 rounded font-mono">
                    {hoveredState.code}
                  </span>
                </div>

                <div className="space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Region:</span>
                    <span className="text-gray-200 font-medium">{hoveredState.region} India</span>
                  </div>

                  <div className="flex items-center justify-between font-medium">
                    <span className="text-cyan-400 flex items-center gap-1">
                      <span>{selectedIndicator === 'temperature' ? '🌡' : selectedIndicator === 'rainfall' ? '🌧' : '🏭'}</span>
                      <span>{meta.label}:</span>
                    </span>
                    <span className="text-white font-bold text-sm">
                      {meta.format(hoveredState[selectedIndicator])}
                    </span>
                  </div>

                  <div className="pt-2 border-t border-white/5 grid grid-cols-3 gap-1 text-[10px] text-gray-400">
                    <div>
                      <span>Temp</span>
                      <p className="font-semibold text-gray-200">{hoveredState.temperature.toFixed(1)}°C</p>
                    </div>
                    <div>
                      <span>Rain</span>
                      <p className="font-semibold text-gray-200">{Math.round(hoveredState.rainfall)}mm</p>
                    </div>
                    <div>
                      <span>CO₂</span>
                      <p className="font-semibold text-gray-200">{hoveredState.co2.toFixed(1)}Mt</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Choropleth Gradient Color Bar & Legend */}
          <div className="mt-2 bg-[#0d1428] border border-white/10 rounded-xl p-3">
            <div className="flex items-center justify-between text-[11px] text-gray-400 mb-1.5">
              <span className="font-medium text-gray-300">Scale: {meta.label} ({meta.unit})</span>
              <span className="text-[10px] text-gray-500 font-mono">Data Year: {meta.year}</span>
            </div>

            {/* Gradient Bar */}
            <div
              className="h-2.5 w-full rounded-full shadow-inner mb-2"
              style={{
                background:
                  selectedIndicator === 'temperature'
                    ? 'linear-gradient(to right, #38bdf8 0%, #0ea5e9 35%, #f59e0b 65%, #ea580c 85%, #dc2626 100%)'
                    : selectedIndicator === 'rainfall'
                    ? 'linear-gradient(to right, #d97706 0%, #22d3ee 30%, #06b6d4 50%, #10b981 75%, #047857 100%)'
                    : 'linear-gradient(to right, #10b981 0%, #14b8a6 20%, #f59e0b 50%, #f97316 75%, #ef4444 100%)',
              }}
            />

            <div className="flex justify-between text-[10px] text-gray-400 font-mono">
              <span>{meta.format(meta.min)} (Lowest)</span>
              <span>
                {selectedIndicator === 'temperature'
                  ? '24°C (Normal)'
                  : selectedIndicator === 'rainfall'
                  ? '1,400 mm (Mean)'
                  : '140 Mt (Moderate)'}
              </span>
              <span>{meta.format(meta.max)} (Peak)</span>
            </div>
          </div>
        </div>

        {/* State Detail Inspection Panel (Right 5 Columns) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Active / Pinned State Profile Card */}
          <div className="bg-[#070b16] border border-white/10 rounded-xl p-5 relative overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="text-[10px] text-cyan-400 uppercase tracking-widest font-semibold block">
                  {pinnedState ? 'Pinned State Inspection' : 'Hover / Active State Profile'}
                </span>
                <h3 className="text-xl font-bold text-white mt-0.5">{activeState.name}</h3>
              </div>
              <span className="text-xs bg-cyan-950/80 border border-cyan-800/40 text-cyan-300 px-2.5 py-1 rounded-lg font-mono">
                {activeState.region} India
              </span>
            </div>

            {/* Primary Indicator Stat Box */}
            <div className="bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/10 rounded-xl p-4 mb-4">
              <span className="text-xs text-gray-400 block font-medium">
                {meta.label} ({meta.year}) · {meta.agency}
              </span>
              <div className="flex items-baseline justify-between mt-1.5">
                <span className="text-3xl font-extrabold text-white tracking-tight">
                  {meta.format(activeState[selectedIndicator])}
                </span>
                {activeStateRank && (
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/30">
                    Rank #{activeStateRank} of 36
                  </span>
                )}
              </div>
            </div>

            {/* All 3 Verified Indicators for this State */}
            <div className="grid grid-cols-3 gap-2.5 mb-4 text-xs">
              <div className="bg-white/[0.02] border border-white/5 rounded-lg p-2.5 text-center">
                <span className="text-[10px] text-gray-500 block uppercase">Temperature</span>
                <span className="font-bold text-amber-300 text-sm">{activeState.temperature.toFixed(1)}°C</span>
                <span className="text-[9px] text-gray-500 block">IMD 2023</span>
              </div>

              <div className="bg-white/[0.02] border border-white/5 rounded-lg p-2.5 text-center">
                <span className="text-[10px] text-gray-500 block uppercase">Rainfall</span>
                <span className="font-bold text-cyan-300 text-sm">{Math.round(activeState.rainfall)} mm</span>
                <span className="text-[9px] text-gray-500 block">IMD 2023</span>
              </div>

              <div className="bg-white/[0.02] border border-white/5 rounded-lg p-2.5 text-center">
                <span className="text-[10px] text-gray-500 block uppercase">CO₂ Emissions</span>
                <span className="font-bold text-emerald-300 text-sm">{activeState.co2.toFixed(1)} Mt</span>
                <span className="text-[9px] text-gray-500 block">ICED 2020</span>
              </div>
            </div>

            {/* Comparison vs National Mean */}
            <div className="bg-white/[0.02] border border-white/5 rounded-lg p-3 text-xs space-y-2">
              <div className="flex items-center justify-between text-gray-400">
                <span>Variance from National Average:</span>
                <span className="font-mono text-white font-medium">
                  {selectedIndicator === 'temperature' && (
                    <>
                      {activeState.temperature >= nationalStats.avgTemp ? '+' : ''}
                      {(activeState.temperature - nationalStats.avgTemp).toFixed(2)} °C
                    </>
                  )}
                  {selectedIndicator === 'rainfall' && (
                    <>
                      {activeState.rainfall >= nationalStats.avgRain ? '+' : ''}
                      {Math.round(activeState.rainfall - nationalStats.avgRain)} mm
                    </>
                  )}
                  {selectedIndicator === 'co2' && (
                    <>
                      {((activeState.co2 / nationalStats.totalCO2) * 100).toFixed(1)}% of India total
                    </>
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Regional Extremes Leaderboards */}
          <div className="bg-[#070b16] border border-white/10 rounded-xl p-4">
            <h4 className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-3 flex items-center justify-between">
              <span>{meta.label} Extremes across India</span>
              <span className="text-[10px] text-gray-500 font-mono">Rankings</span>
            </h4>

            <div className="grid grid-cols-2 gap-3 text-xs">
              {/* Top 4 */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-semibold text-rose-400 uppercase tracking-wider block">
                  Top Highest
                </span>
                {topStates.map((st, i) => (
                  <div
                    key={st.name}
                    onClick={() => setPinnedState(st)}
                    className="flex items-center justify-between p-1.5 rounded hover:bg-white/5 cursor-pointer transition text-[11px]"
                  >
                    <span className="text-gray-300 truncate max-w-[100px]">
                      {i + 1}. {st.name}
                    </span>
                    <span className="font-mono text-white font-medium">{meta.format(st[selectedIndicator])}</span>
                  </div>
                ))}
              </div>

              {/* Bottom 4 */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-semibold text-cyan-400 uppercase tracking-wider block">
                  Top Lowest
                </span>
                {bottomStates.map((st, i) => (
                  <div
                    key={st.name}
                    onClick={() => setPinnedState(st)}
                    className="flex items-center justify-between p-1.5 rounded hover:bg-white/5 cursor-pointer transition text-[11px]"
                  >
                    <span className="text-gray-300 truncate max-w-[100px]">
                      {36 - i}. {st.name}
                    </span>
                    <span className="font-mono text-white font-medium">{meta.format(st[selectedIndicator])}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Scientific Provenance & Integrity Statement */}
          <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3.5 text-[11px] text-gray-400 leading-relaxed">
            <div className="flex items-center gap-1.5 text-gray-300 font-medium mb-1">
              <span className="text-xs">🛡</span>
              <span>Data Provenance & Scientific Compliance</span>
            </div>
            <p>
              Values represent official government benchmark observations: Annual surface air temperature & rainfall
              reported by the <strong>India Meteorological Department (IMD 2023)</strong>, and greenhouse gas inventories
              from <strong>GHG Platform India / NITI Aayog ICED (2020)</strong>. No synthetic or unverified values are used.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
