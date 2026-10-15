import { Page } from '../App'

interface NavItem {
  icon: string
  label: string
  page: Page | null
}

const navItems: NavItem[] = [
  { icon: '⊞', label: 'Dashboard', page: 'dashboard' },
  { icon: '📈', label: 'Historical Analysis', page: 'historical' },
  { icon: '⚠', label: 'Anomaly Detection', page: 'anomaly' },
  { icon: '🤖', label: 'ML Models', page: 'ml' },
  { icon: '🔮', label: 'Future Prediction', page: 'prediction' },
  { icon: '⚙', label: 'What-If Scenarios', page: 'what-if' },
  { icon: '🗺', label: 'India Explorer', page: 'explorer' },
  { icon: '💡', label: 'Climate Insights', page: 'insights' },
]

interface SidebarProps {
  activePage: Page
  onNavigate: (page: Page) => void
}

export default function Sidebar({ activePage, onNavigate }: SidebarProps) {
  return (
    <aside className="w-60 bg-[#0d1428] border-r border-white/5 flex flex-col shrink-0">
      {/* Logo */}
      <div className="px-5 py-6 border-b border-white/5">
        <div className="flex items-center gap-2.5 mb-1">
          <span className="text-2xl">🌍</span>
          <span className="text-lg font-bold tracking-tight text-white">ClimateX</span>
        </div>
        <p className="text-[10px] text-cyan-400/70 font-medium uppercase tracking-widest pl-9">
          India Climate Intelligence
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map((item) => {
          const isActive = item.page === activePage
          const isEnabled = item.page !== null
          return (
            <button
              key={item.label}
              disabled={!isEnabled}
              onClick={() => item.page && onNavigate(item.page)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors duration-150 text-left ${
                isActive
                  ? 'bg-cyan-500/10 text-cyan-400 font-medium'
                  : isEnabled
                  ? 'text-gray-400 hover:bg-white/5 hover:text-gray-200 cursor-pointer'
                  : 'text-gray-600 cursor-not-allowed'
              }`}
            >
              <span className="text-base w-5 text-center">{item.icon}</span>
              <span>{item.label}</span>
              {!isEnabled && (
                <span className="ml-auto text-[9px] font-medium text-gray-600 bg-gray-800 px-1.5 py-0.5 rounded">
                  SOON
                </span>
              )}
            </button>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-white/5">
        <p className="text-[10px] text-gray-600">Research Methodology Lab</p>
        <p className="text-[10px] text-gray-600">Experiment 7 · 2000–2024</p>
      </div>
    </aside>
  )
}
