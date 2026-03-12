import { useState, useEffect } from 'react';
import AccountOverview from './components/AccountOverview';
import PositionsTable from './components/PositionsTable';
import EquityChart from './components/EquityChart';
import RegimeStatus from './components/RegimeStatus';
import MarketBar from './components/MarketBar';
import RecentFills from './components/RecentFills';
import EngineAccuracy from './components/EngineAccuracy';
import PnLDecomposition from './components/PnLDecomposition';
import RegimePage from './pages/RegimePage';
import { api } from './api';

export default function App() {
  const [page, setPage] = useState('dashboard');
  const [time, setTime] = useState(new Date());
  const [health, setHealth] = useState(null);

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    api.health().then(setHealth).catch(() => {});
  }, []);

  const kuwaitTime = time.toLocaleTimeString('en-US', {
    timeZone: 'Asia/Kuwait', hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
  const etTime = time.toLocaleTimeString('en-US', {
    timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', second: '2-digit'
  });

  if (page === 'regime') return <RegimePage onBack={() => setPage('dashboard')} />;

  // Market hours: 9:30 AM - 4:00 PM ET
  const etDate = new Date(time.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const h = etDate.getHours(); const m = etDate.getMinutes();
  const etMinutes = h * 60 + m;
  const isMarketOpen = etMinutes >= 570 && etMinutes <= 960 && etDate.getDay() >= 1 && etDate.getDay() <= 5;

  return (
    <div className="min-h-screen bg-[#0a0e17]">
      {/* Header */}
      <header className="border-b border-[#1e2d3d] px-6 py-3">
        <div className="max-w-[1440px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-blue-500 rounded-lg flex items-center justify-center font-black text-sm text-white">
                P
              </div>
              <div>
                <h1 className="text-lg font-bold text-white tracking-tight">PRISM</h1>
                <p className="text-[10px] text-slate-500 -mt-0.5">Portfolio Risk & Intelligence</p>
              </div>
            </div>
            <div className="hidden md:block ml-6">
              <MarketBar />
            </div>
          </div>
          <div className="flex items-center gap-6 text-xs">
            <div className="text-right">
              <div className="text-slate-400">Kuwait: <span className="text-white font-mono">{kuwaitTime}</span></div>
              <div className="text-slate-400">ET: <span className="text-white font-mono">{etTime}</span></div>
            </div>
            <div className={`px-3 py-1.5 rounded-full text-xs font-bold ${
              isMarketOpen ? 'bg-emerald-900/50 text-emerald-400 border border-emerald-800' :
                             'bg-slate-800 text-slate-400 border border-slate-700'
            }`}>
              {isMarketOpen ? '🟢 MARKET OPEN' : '⚫ MARKET CLOSED'}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1440px] mx-auto p-6 space-y-6">
        {/* Row 1: Account Overview */}
        <AccountOverview />

        {/* Row 2: Chart + Regime */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <EquityChart />
          </div>
          <div onClick={() => setPage('regime')} className="cursor-pointer hover:ring-1 hover:ring-slate-600 rounded-xl transition">
            <RegimeStatus />
          </div>
        </div>

        {/* Row 3: Positions + Fills */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <PositionsTable />
          </div>
          <RecentFills />
        </div>

        {/* Row 4: PRISM Analytics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <EngineAccuracy />
          <PnLDecomposition />
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-slate-600 py-4">
          PRISM v1.0.0 — Built by Neo 🟢 | {health?.status === 'healthy' ? '🟢 API Connected' : '🔴 API Disconnected'}
        </div>
      </main>
    </div>
  );
}
