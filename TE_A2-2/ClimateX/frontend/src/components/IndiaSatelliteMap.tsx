import { useState } from 'react'

interface MapProps {
  co2Change?: number
  rainfallChange?: number
  tempDiff?: number
  scenarioTemp?: number
  baselineTemp?: number
  tempShift?: number
}

export default function IndiaSatelliteMap({
  co2Change = 0,
  rainfallChange = 0,
  tempDiff = 0,
  tempShift = 0,
}: MapProps) {
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isExpanded, setIsExpanded] = useState(false)

  // Use temperature slider shift (or fallback to tempDiff)
  const shift = tempShift !== 0 ? tempShift : tempDiff

  // ─── Slider 1: Temperature Effects (Land Colour, Cracks, Snow) ──────────────
  const getLandColor = (t: number) => {
    if (t <= -1.5) return '#60a5fa' // cool blue tint
    if (t < -0.2) return '#38bdf8'  // mild cool blue
    if (t <= 0.6) return '#22c55e'  // normal green
    if (t <= 1.5) return '#eab308'  // yellow
    if (t <= 2.3) return '#f97316'  // orange
    return '#ef4444'                // red
  }

  const landColor = getLandColor(shift)

  // Hot: cracks on land (scales smoothly with positive temp)
  const crackOpacity = shift > 0 ? Math.min(0.85, (shift / 3) * 0.9) : 0

  // Cold: snow dots on hills/forest (scales smoothly with negative temp)
  const snowOpacity = shift < 0 ? Math.min(1, (-shift / 3) * 1.1) : 0

  // ─── Slider 2: Rainfall Effects (Lake, River, Fields, Floods) ───────────────
  // rainfallChange ranges from -30% to +30%
  const rNorm = rainfallChange / 30 // -1 to +1

  // Lake size: shrinks when dry, grows when wet
  const lakeRx = Math.max(18, 42 + rNorm * 18)
  const lakeRy = Math.max(11, 26 + rNorm * 12)

  // River: dries when rainfall is low, swells when rainfall is high
  const riverWidth = Math.max(0.8, 3.8 + rNorm * 2.2)
  const riverOpacity = rainfallChange < 0 ? Math.max(0.25, 0.95 + rNorm * 0.65) : 0.95

  // Farm fields brownness (less rain = dry brown; more rain = lush green/gold)
  const droughtFactor = Math.max(0, -rNorm) // 0 to 1
  const field1Fill = droughtFactor > 0.4 ? '#78350f' : droughtFactor > 0.1 ? '#92400e' : '#ca8a04'
  const field2Fill = droughtFactor > 0.5 ? '#854d0e' : droughtFactor > 0.2 ? '#a16207' : '#65a30d'

  // More rain: flood water covering low land
  const floodOpacity = rainfallChange > 0 ? Math.min(0.65, (rainfallChange / 30) * 0.7) : 0

  // ─── Slider 3: CO2 Effects (Smog over city vs Clear sky) ────────────────────
  // co2Change ranges from -50% to +50%
  const smogOpacity = co2Change > 0 ? Math.min(0.8, (co2Change / 50) * 0.85) : 0
  const skyCleanliness = co2Change < 0 ? Math.min(1, (-co2Change / 50)) : 0

  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.25, 2.5))
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.25, 0.75))
  const handleReset = () => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }

  return (
    <div
      className={`bg-[#0d1428] border border-white/10 rounded-2xl p-5 shadow-xl transition-all duration-300 ${
        isExpanded ? 'fixed inset-4 z-50 overflow-auto bg-[#090d1a] border-cyan-500/30' : 'relative'
      }`}
    >
      {/* ─── Header & Controls ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-white/5">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-white tracking-wide">
              Island of Climatia
            </h3>
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded-full border text-white transition-colors duration-300"
              style={{ backgroundColor: `${landColor}25`, borderColor: landColor }}
            >
              {shift > 0 ? `+${shift.toFixed(1)}` : shift.toFixed(1)} °C
            </span>
            {rainfallChange !== 0 && (
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20">
                Rain: {rainfallChange > 0 ? `+${rainfallChange}` : rainfallChange}%
              </span>
            )}
            {co2Change !== 0 && (
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-500/10 text-slate-300 border border-slate-500/20">
                CO₂: {co2Change > 0 ? `+${co2Change}` : co2Change}%
              </span>
            )}
          </div>
          {/* Mandatory Label */}
          <p className="text-xs text-amber-400 font-medium mt-0.5">
            Imaginary land. Illustration only.
          </p>
        </div>

        {/* Buttons: + / - / Reset / Expand */}
        <div className="flex items-center gap-1.5 bg-white/5 p-1 rounded-xl border border-white/10">
          <button
            type="button"
            onClick={handleZoomIn}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/15 text-white font-bold text-sm transition"
            title="Zoom In"
          >
            +
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/15 text-white font-bold text-sm transition"
            title="Zoom Out"
          >
            -
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="px-3 h-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/15 text-gray-200 text-xs font-semibold transition"
            title="Reset View"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="px-3 h-8 flex items-center justify-center rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 text-xs font-semibold border border-cyan-500/30 transition"
            title="Expand View"
          >
            {isExpanded ? 'Close' : 'Expand'}
          </button>
        </div>
      </div>

      {/* ─── SVG Canvas: Climatia Island ─────────────────────────────────────── */}
      <div className="relative w-full rounded-xl overflow-hidden bg-[#071326] border border-white/5">
        <svg
          viewBox="0 0 800 480"
          className="w-full h-auto select-none"
          style={{ maxHeight: isExpanded ? 'calc(100vh - 160px)' : '460px' }}
        >
          <defs>
            {/* Dynamic Sky Gradient (Clearer when low CO2, hazier when high CO2) */}
            <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={co2Change > 0 ? '#1e293b' : '#071836'} />
              <stop offset="60%" stopColor={co2Change > 0 ? '#334155' : '#1e3a68'} />
              <stop offset="100%" stopColor={co2Change > 0 ? '#475569' : '#2563eb'} />
            </linearGradient>

            {/* Sea Gradient */}
            <linearGradient id="seaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0f345c" />
              <stop offset="100%" stopColor="#061e38" />
            </linearGradient>
          </defs>

          {/* Canvas container supporting zoom & pan */}
          <g
            transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}
            style={{ transformOrigin: '400px 240px', transition: 'transform 0.2s ease-out' }}
          >
            {/* 1. SKY */}
            <rect x="0" y="0" width="800" height="150" fill="url(#skyGrad)" style={{ transition: 'fill 0.4s ease' }} />
            
            {/* Sun / Sky Light (Brighter if clear sky / less CO2) */}
            <circle
              cx="680"
              cy="55"
              r={28 + skyCleanliness * 6}
              fill="#fde047"
              opacity={0.85 + skyCleanliness * 0.15}
              filter="drop-shadow(0 0 16px #facc15)"
            />
            <circle cx="680" cy="55" r={38 + skyCleanliness * 8} fill="#fde047" opacity={0.25} />

            {/* Clouds */}
            <g fill="#e0f2fe" opacity={0.65}>
              <path d="M 120 70 q 15 -20 35 0 q 20 -15 35 5 q 15 2 20 15 h -95 z" />
              <path d="M 320 50 q 20 -25 45 -5 q 25 -15 45 5 q 15 2 25 18 h -120 z" />
              <path d="M 520 80 q 15 -18 30 0 q 18 -10 30 6 h -65 z" />
            </g>

            {/* 2. SEA */}
            <rect x="0" y="140" width="800" height="340" fill="url(#seaGrad)" />
            
            {/* Sea Waves / Ripples */}
            <g stroke="#38bdf8" strokeWidth="1.5" strokeOpacity="0.3" fill="none">
              <path d="M 40 180 Q 70 175 100 180 T 160 180" />
              <path d="M 640 190 Q 670 185 700 190 T 760 190" />
              <path d="M 80 430 Q 110 425 140 430 T 200 430" />
              <path d="M 620 440 Q 650 435 680 440 T 740 440" />
              <path d="M 50 300 Q 80 295 110 300" />
              <path d="M 690 320 Q 720 315 750 320" />
            </g>

            {/* 3. LAND: Climatia Island */}
            {/* Island Shoreline / Beach */}
            <path
              d="M 170 310 C 150 240, 220 180, 310 170 C 400 160, 480 175, 560 200 C 640 220, 670 280, 640 350 C 610 420, 520 440, 420 445 C 320 450, 230 425, 190 380 Z"
              fill="#d97706"
              opacity="0.35"
            />
            {/* Main Landmass (Dynamic color changes with temperature) */}
            <path
              d="M 180 305 C 165 245, 230 190, 315 180 C 400 170, 475 185, 550 208 C 625 228, 655 285, 625 345 C 595 410, 510 430, 415 435 C 325 440, 240 415, 200 372 Z"
              fill={landColor}
              stroke="#0f172a"
              strokeWidth="2.5"
              style={{ transition: 'fill 0.4s ease' }}
            />

            {/* HOT: Cracks on the land (Smoothly fades in with positive temp) */}
            <g
              stroke="#451a03"
              strokeWidth="1.8"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={crackOpacity}
              style={{ transition: 'opacity 0.3s ease-out' }}
            >
              {/* Crack cluster 1: central south */}
              <path d="M 330 380 L 345 395 L 340 415 M 345 395 L 360 400 L 375 392" />
              {/* Crack cluster 2: near fields */}
              <path d="M 470 375 L 485 390 L 500 385 M 485 390 L 488 410" />
              {/* Crack cluster 3: western plains */}
              <path d="M 230 330 L 250 340 L 245 360 M 250 340 L 270 335 L 285 350" />
              {/* Crack cluster 4: north-east */}
              <path d="M 440 220 L 455 235 L 470 230 M 455 235 L 450 250" />
            </g>

            {/* MORE RAIN: Flood water covering low land (Smoothly fades in with rain > 0) */}
            <g
              fill="#38bdf8"
              opacity={floodOpacity}
              stroke="#0284c7"
              strokeWidth="1.5"
              style={{ transition: 'opacity 0.3s ease-out' }}
            >
              {/* Low-lying Southern Coastal Flood */}
              <path d="M 320 445 C 370 410, 460 410, 510 435 C 470 448, 380 452, 320 445 Z" />
              {/* Western Shoreline Flood */}
              <path d="M 180 320 C 195 350, 225 390, 210 405 C 190 385, 175 350, 180 320 Z" />
              {/* Estuary flood along lower riverbank */}
              <ellipse cx="400" cy="425" rx="28" ry="14" />
            </g>

            {/* 4. FARM FIELDS (Turns dry brown on less rain) */}
            <g transform="translate(430, 310)">
              {/* Field 1 */}
              <polygon
                points="10,15 70,5 85,45 20,55"
                fill={field1Fill}
                opacity="0.85"
                stroke="#451a03"
                strokeWidth="1.5"
                style={{ transition: 'fill 0.4s ease' }}
              />
              <line x1="22" y1="23" x2="74" y2="15" stroke="#fef08a" strokeWidth="1.5" opacity={droughtFactor > 0.5 ? 0.3 : 0.6} />
              <line x1="25" y1="33" x2="77" y2="25" stroke="#fef08a" strokeWidth="1.5" opacity={droughtFactor > 0.5 ? 0.3 : 0.6} />
              <line x1="28" y1="43" x2="80" y2="35" stroke="#fef08a" strokeWidth="1.5" opacity={droughtFactor > 0.5 ? 0.3 : 0.6} />
              {/* Field 2 */}
              <polygon
                points="75,5 135,12 145,50 88,44"
                fill={field2Fill}
                opacity="0.85"
                stroke="#27272a"
                strokeWidth="1.5"
                style={{ transition: 'fill 0.4s ease' }}
              />
              <line x1="87" y1="14" x2="137" y2="20" stroke="#bef264" strokeWidth="1.5" opacity={droughtFactor > 0.5 ? 0.2 : 0.6} />
              <line x1="90" y1="24" x2="140" y2="30" stroke="#bef264" strokeWidth="1.5" opacity={droughtFactor > 0.5 ? 0.2 : 0.6} />
              <line x1="92" y1="34" x2="142" y2="40" stroke="#bef264" strokeWidth="1.5" opacity={droughtFactor > 0.5 ? 0.2 : 0.6} />
              <text x="80" y="66" fill="#fef3c7" fontSize="10" fontWeight="bold" textAnchor="middle">
                {droughtFactor > 0.4 ? 'Parched Fields' : 'Farm Fields'}
              </text>
            </g>

            {/* 5. ONE LAKE (Shrinks with less rain, grows with more rain) */}
            <g>
              <ellipse
                cx="370"
                cy="295"
                rx={lakeRx}
                ry={lakeRy}
                fill="#0284c7"
                stroke="#38bdf8"
                strokeWidth={rainfallChange < -15 ? 1 : 2}
                style={{ transition: 'rx 0.3s ease-out, ry 0.3s ease-out' }}
              />
              {/* Lake shimmer */}
              <path
                d={`M ${370 - lakeRx * 0.5} 292 Q 370 288 ${370 + lakeRx * 0.5} 292`}
                stroke="#bae6fd"
                strokeWidth="1.5"
                fill="none"
                opacity={rainfallChange < -20 ? 0.2 : 0.8}
              />
              <text x="370" y="300" fill="#e0f2fe" fontSize="10" fontWeight="bold" textAnchor="middle">
                {rainfallChange < -15 ? 'Dry Lake' : 'Lake'}
              </text>
            </g>

            {/* 6. ONE RIVER (Dries with less rain, swells with more rain) */}
            <g
              fill="none"
              stroke="#38bdf8"
              strokeWidth={riverWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={riverOpacity}
              strokeDasharray={rainfallChange < -20 ? '4 4' : 'none'}
              style={{ transition: 'stroke-width 0.3s ease-out, opacity 0.3s ease-out' }}
            >
              {/* Upper river from forest/highlands to Lake */}
              <path d="M 285 205 Q 310 235 340 280" />
              {/* Lower river from Lake to Sea */}
              <path d="M 390 315 Q 410 365 400 440" />
            </g>

            {/* 7. A FOREST & HILLS */}
            <g transform="translate(230, 205)">
              <text x="50" y="72" fill="#dcfce7" fontSize="10" fontWeight="bold" textAnchor="middle">Forest</text>
              {/* Tree 1 */}
              <polygon points="30,35 15,60 45,60" fill="#14532d" />
              <polygon points="30,22 18,44 42,44" fill="#15803d" />
              <rect x="27" y="60" width="6" height="8" fill="#78350f" />
              {/* Tree 2 */}
              <polygon points="50,30 35,55 65,55" fill="#166534" />
              <polygon points="50,18 38,40 62,40" fill="#22c55e" />
              <rect x="47" y="55" width="6" height="8" fill="#78350f" />
              {/* Tree 3 */}
              <polygon points="70,36 55,62 85,62" fill="#14532d" />
              <polygon points="70,24 58,46 82,46" fill="#15803d" />
              <rect x="67" y="62" width="6" height="8" fill="#78350f" />
              {/* Tree 4 */}
              <polygon points="40,42 28,66 52,66" fill="#166534" />
              <rect x="38" y="66" width="5" height="6" fill="#78350f" />
              {/* Tree 5 */}
              <polygon points="62,40 50,65 74,65" fill="#15803d" />
              <rect x="60" y="65" width="5" height="6" fill="#78350f" />

              {/* COLD: Snow dots on the hills and trees (Smoothly fades in with cold temp) */}
              <g
                fill="#f8fafc"
                stroke="#93c5fd"
                strokeWidth="0.8"
                opacity={snowOpacity}
                style={{ transition: 'opacity 0.3s ease-out' }}
              >
                {/* Tree snow peaks */}
                <circle cx="30" cy="22" r="3.5" />
                <circle cx="50" cy="18" r="4" />
                <circle cx="70" cy="24" r="3.5" />
                <circle cx="40" cy="42" r="3" />
                <circle cx="62" cy="40" r="3" />
                {/* Hillside snow dots */}
                <circle cx="15" cy="15" r="3" />
                <circle cx="22" cy="10" r="4" />
                <circle cx="45" cy="5" r="4.5" />
                <circle cx="68" cy="8" r="3.5" />
                <circle cx="85" cy="18" r="3" />
                <circle cx="10" cy="45" r="2.5" />
                <circle cx="88" cy="50" r="2.5" />
              </g>
            </g>

            {/* 8. A CITY */}
            <g transform="translate(485, 215)">
              <text x="45" y="78" fill="#f1f5f9" fontSize="10" fontWeight="bold" textAnchor="middle">City</text>
              {/* Building 1 */}
              <rect x="10" y="25" width="18" height="42" fill="#334155" stroke="#64748b" strokeWidth="1" />
              <rect x="14" y="30" width="3" height="4" fill="#fef08a" />
              <rect x="21" y="30" width="3" height="4" fill="#fef08a" />
              <rect x="14" y="40" width="3" height="4" fill="#fef08a" />
              <rect x="21" y="40" width="3" height="4" fill="#94a3b8" />
              <rect x="14" y="50" width="3" height="4" fill="#fef08a" />
              {/* Building 2 (Tall Tower) */}
              <rect x="32" y="10" width="22" height="57" fill="#1e293b" stroke="#475569" strokeWidth="1" />
              <line x1="43" y1="0" x2="43" y2="10" stroke="#e2e8f0" strokeWidth="2" />
              <circle cx="43" cy="0" r="2" fill="#ef4444" />
              <rect x="36" y="18" width="4" height="4" fill="#38bdf8" />
              <rect x="44" y="18" width="4" height="4" fill="#38bdf8" />
              <rect x="36" y="28" width="4" height="4" fill="#fef08a" />
              <rect x="44" y="28" width="4" height="4" fill="#fef08a" />
              <rect x="36" y="38" width="4" height="4" fill="#fef08a" />
              <rect x="44" y="38" width="4" height="4" fill="#fef08a" />
              <rect x="36" y="48" width="4" height="4" fill="#38bdf8" />
              <rect x="44" y="48" width="4" height="4" fill="#fef08a" />
              {/* Building 3 */}
              <rect x="58" y="28" width="20" height="39" fill="#475569" stroke="#64748b" strokeWidth="1" />
              <polygon points="58,28 68,18 78,28" fill="#e11d48" />
              <rect x="63" y="35" width="4" height="5" fill="#fef08a" />
              <rect x="70" y="35" width="4" height="5" fill="#fef08a" />
              <rect x="63" y="46" width="4" height="5" fill="#fef08a" />
              <rect x="70" y="46" width="4" height="5" fill="#fef08a" />

              {/* MORE CO2: Grey Smog over the city (Fades in smoothly with CO2 > 0) */}
              <g
                opacity={smogOpacity}
                style={{ transition: 'opacity 0.3s ease-out' }}
              >
                <ellipse cx="45" cy="22" rx="48" ry="24" fill="#64748b" opacity="0.65" />
                <ellipse cx="35" cy="10" rx="36" ry="18" fill="#475569" opacity="0.75" />
                <ellipse cx="55" cy="32" rx="42" ry="20" fill="#334155" opacity="0.6" />
                <ellipse cx="20" cy="28" rx="28" ry="16" fill="#64748b" opacity="0.5" />
                {/* Smog haze plume text */}
                {co2Change > 15 && (
                  <text x="45" y="-4" fill="#cbd5e1" fontSize="9" fontWeight="bold" textAnchor="middle">
                    Smog Layer
                  </text>
                )}
              </g>
            </g>
          </g>
        </svg>

        {/* Dynamic Legend / Status Indicators */}
        <div className="absolute bottom-3 left-3 bg-[#0d1428]/90 backdrop-blur-sm border border-white/10 px-3 py-2 rounded-lg text-[10px] text-gray-300 flex flex-wrap items-center gap-3">
          <span className="font-semibold text-gray-200">Conditions:</span>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: landColor }} />
            <span>Land ({shift > 0 ? `+${shift.toFixed(1)}` : shift.toFixed(1)}°C)</span>
          </div>
          {crackOpacity > 0 && (
            <div className="flex items-center gap-1 text-amber-400 font-semibold">
              <span>⚡</span> Cracks
            </div>
          )}
          {snowOpacity > 0 && (
            <div className="flex items-center gap-1 text-cyan-300 font-semibold">
              <span>❄️</span> Snow on hills
            </div>
          )}
          {rainfallChange < 0 && (
            <div className="flex items-center gap-1 text-amber-500 font-semibold">
              <span>🍂</span> Dry lake/river & brown fields
            </div>
          )}
          {rainfallChange > 0 && (
            <div className="flex items-center gap-1 text-blue-400 font-semibold">
              <span>🌊</span> Full lake & floods
            </div>
          )}
          {co2Change > 0 ? (
            <div className="flex items-center gap-1 text-slate-400 font-semibold">
              <span>🌫️</span> City smog
            </div>
          ) : co2Change < 0 ? (
            <div className="flex items-center gap-1 text-sky-400 font-semibold">
              <span>✨</span> Clear sky
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
