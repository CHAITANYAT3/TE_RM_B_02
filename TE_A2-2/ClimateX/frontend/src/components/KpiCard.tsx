interface KpiCardProps {
  icon: string
  label: string
  value: string | number | null
  unit: string
  subLabel: string
  accentColor: 'cyan' | 'green' | 'amber'
  loading: boolean
}

const colorMap = {
  cyan: {
    icon: 'bg-cyan-500/10 text-cyan-400',
    value: 'text-cyan-400',
    border: 'border-cyan-500/10',
    glow: 'shadow-cyan-500/5',
  },
  green: {
    icon: 'bg-emerald-500/10 text-emerald-400',
    value: 'text-emerald-400',
    border: 'border-emerald-500/10',
    glow: 'shadow-emerald-500/5',
  },
  amber: {
    icon: 'bg-amber-500/10 text-amber-400',
    value: 'text-amber-400',
    border: 'border-amber-500/10',
    glow: 'shadow-amber-500/5',
  },
}

export default function KpiCard({
  icon, label, value, unit, subLabel, accentColor, loading,
}: KpiCardProps) {
  const colors = colorMap[accentColor]

  return (
    <div
      className={`bg-[#0d1428] border ${colors.border} rounded-xl p-5 shadow-lg ${colors.glow} flex flex-col gap-4`}
    >
      <div className="flex items-start justify-between">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg ${colors.icon}`}>
          {icon}
        </div>
        <span className="text-xs font-medium text-gray-500 bg-gray-800/60 px-2 py-1 rounded-full">
          avg
        </span>
      </div>

      <div>
        <p className="text-xs text-gray-500 mb-1 uppercase tracking-widest font-medium">{label}</p>
        {loading ? (
          <div className="h-8 w-28 bg-white/5 rounded-md animate-pulse" />
        ) : (
          <p className={`text-2xl font-bold ${colors.value}`}>
            {value !== null ? value : '—'}
            <span className="text-sm font-normal text-gray-400 ml-1">{unit}</span>
          </p>
        )}
        <p className="text-xs text-gray-600 mt-1">{subLabel}</p>
      </div>
    </div>
  )
}
