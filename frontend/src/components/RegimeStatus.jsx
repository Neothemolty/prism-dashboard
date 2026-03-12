import { Card } from './Card';
import { usePolling } from '../hooks/usePolling';
import { api } from '../api';

export default function RegimeStatus() {
  const { data, loading } = usePolling(api.regime, 30000);
  if (loading || !data) return <Card title="PRISM Regime Gate"><p className="text-slate-500 text-sm">Loading...</p></Card>;

  const isRiskOff = data.regime === 'RISK_OFF';
  const regime = data.regime || 'UNKNOWN';

  return (
    <Card title="PRISM Regime Gate" icon="🔮">
      <div className="flex items-center gap-4 mb-4">
        <div className={`text-3xl font-black px-4 py-2 rounded-lg ${
          isRiskOff ? 'bg-red-900/30 text-red-400 border border-red-800' :
          regime === 'RISK_ON' ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-800' :
          'bg-slate-800 text-slate-400 border border-slate-700'
        }`}>
          {regime.replace('_', ' ')}
        </div>
        {data.confidence != null && (
          <div className="text-slate-400 text-sm">
            Confidence: <span className="text-white font-bold">{data.confidence}/3</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3 text-center">
        <Signal label="SPY > SMA50" active={data.spy_above_sma50}
          detail={data.spy_price ? `${data.spy_price.toFixed(1)} vs ${data.spy_sma50?.toFixed(1)}` : ''}
        />
        <Signal label="VIX < 20" active={data.vix_below_20}
          detail={data.vix ? `VIX: ${data.vix.toFixed(1)}` : ''}
        />
        <Signal label="Yield Spread +" active={data.yield_spread_positive}
          detail={data.yield_spread != null ? `${(data.yield_spread * 100).toFixed(0)}bps` : ''}
        />
      </div>

      {isRiskOff && (
        <div className="mt-3 p-2 bg-red-950/30 rounded text-xs text-red-300 text-center">
          ⛔ New equity longs BLOCKED (except gold/defense)
        </div>
      )}
    </Card>
  );
}

function Signal({ label, active, detail }) {
  return (
    <div className={`p-2 rounded-lg border ${
      active ? 'bg-emerald-950/30 border-emerald-800 text-emerald-400' : 'bg-red-950/30 border-red-800 text-red-400'
    }`}>
      <div className="text-lg font-bold">{active ? '✅' : '❌'}</div>
      <div className="text-xs font-medium mt-1">{label}</div>
      {detail && <div className="text-[10px] opacity-70 mt-0.5">{detail}</div>}
    </div>
  );
}
