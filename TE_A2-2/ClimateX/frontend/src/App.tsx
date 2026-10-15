import { useState } from 'react'
import { useDataset } from './hooks/useDataset'
import Sidebar from './components/Sidebar'
import Dashboard from './components/Dashboard'
import HistoricalAnalysis from './components/HistoricalAnalysis'
import AnomalyDetection from './components/AnomalyDetection'
import MLModels from './components/MLModels'
import FuturePrediction from './components/FuturePrediction'
import WhatIfScenarios from './components/WhatIfScenarios'
import IndiaExplorer from './components/IndiaExplorer'
import ClimateInsights from './components/ClimateInsights'

export type Page = 'dashboard' | 'historical' | 'anomaly' | 'ml' | 'prediction' | 'what-if' | 'explorer' | 'insights'

export default function App() {
  const [page, setPage] = useState<Page>('dashboard')
  const { data, loading, error } = useDataset()

  return (
    <div className="flex min-h-screen bg-[#0a0f1e]">
      <Sidebar activePage={page} onNavigate={setPage} />
      <main className="flex-1 flex flex-col overflow-hidden">
        {page === 'dashboard' && (
          <Dashboard data={data} loading={loading} error={error} />
        )}
        {page === 'historical' && <HistoricalAnalysis />}
        {page === 'anomaly' && <AnomalyDetection />}
        {page === 'ml' && <MLModels />}
        {page === 'prediction' && <FuturePrediction />}
        {page === 'what-if' && <WhatIfScenarios />}
        {page === 'explorer' && <IndiaExplorer />}
        {page === 'insights' && <ClimateInsights />}
      </main>
    </div>
  )
}
