import { Card } from './Card';
import { usePolling } from '../hooks/usePolling';
import { api } from '../api';

const REGIME_CONFIG = {
  BULL_TREND:   { color: 'emerald', bg: 'bg-emerald-500', label: 'BULL TREND',   icon: '🟢', glow: 'shadow-emerald-500/20' },
  BULL_QUIET:   { color: 'emerald', bg: 'bg-emerald-600', label: 'BULL QUIET',   icon: '🟢', glow: 'shadow-emerald-500/20' },
  BULL_VOLATILE:{ color: 'yellow',  bg: 'bg-yellow-600',  label: 'BULL VOLATILE', icon: '⚡', glow: 'shadow-yellow-500/20' },
  RISK_ON:      { color: 'emerald', bg: 'bg-emerald-500', label: 'RISK ON',      icon: '🚀', glow: 'shadow-emerald-500/20' },
  TRANSITION:   { color: 'amber',   bg: 'bg-amber-600',   label: 'TRANSITION',   icon: '⚠️', glow: 'shadow-amber-500/20' },
  BEAR_QUIET:   { color: 'orange',  bg: 'bg-orange-600',  label: 'BEAR QUIET',   icon: '🔻', glow: 'shadow-orange-500/20' },
  BEAR_VOLATILE:{ color: 'red',     bg: 'bg-red-600',     label: 'BEAR VOLATILE', icon: '💀', glow: 'shadow-red-500/20' },
  RISK_OFF:     { color: 'red',     bg: 'bg-red-600',     label: 'RISK OFF',     icon: '🛑', glow: 'shadow-red-500/20' },
  UNKNOWN:      { color: 'slate',   bg: 'bg-slate-600',   label: 'UNKNOWN',      icon: '❓', glow: '' },
};

function ScoreGauge({ score, label }) {
  // Score range: -100 to +100
  const pct = Math.min(100, Math.max(0, (score + 100) / 2));
  const barColor = score > 30 ? 'bg-emerald-500' : score > 0 ? 'bg-emerald-700' : score > -30 ? 'bg-amber-500' : 'bg-red-500';
  
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-[10px] text-slate-500">
        <span>{label}</span>
        <span className={`font-bold ${score > 0 ? 'text-emerald-400' : score < 0 ? 'text-red-400' : 'text-slate-400'}`}>
          {score > 0 ? '+' : ''}{score}
        </span>
      </div>
      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function IndexRow({ entry }) {
  const cfg = REGIME_CONFIG[entry.regime] || REGIME_CONFIG.UNKNOWN;
  const score = entry.regime_score || 0;
  const scoreColor = score > 30 ? 'text-emerald-400' : score > 0 ? 'text-emerald-600' : score > -30 ? 'text-amber-400' : 'text-red-400';
  
  return (
    <div className="flex items-center gap-3 py-1.5 border-b border-slate-800/50 last:border-0">
      <span className="text-xs font-bold text-white w-10">{entry.ticker}</span>
      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
        cfg.color === 'emerald' ? 'bg-emerald-900/40 text-emerald-400' :
        cfg.color === 'amber' ? 'bg-amber-900/40 text-amber-400' :
        cfg.color === 'yellow' ? 'bg-yellow-900/40 text-yellow-400' :
        cfg.color === 'orange' ? 'bg-orange-900/40 text-orange-400' :
        cfg.color === 'red' ? 'bg-red-900/40 text-red-400' :
        'bg-slate-800 text-slate-400'
      }`}>{cfg.label}</span>
      <span className={`text-xs font-mono font-bold ml-auto ${scoreColor}`}>
        {score > 0 ? '+' : ''}{score}
      </span>
      <span className="text-[10px] text-slate-500 w-12 text-right">{entry.signal}</span>
    </div>
  );
}

export default function RegimeStatus() {
  const { data, loading } = usePolling(api.regime, 30000);
  if (loading || !data) return <Card title="PRISM Regime Gate"><p className="text-slate-500 text-sm">Loading...</p></Card>;

  const regime = data.regime || 'UNKNOWN';
  const cfg = REGIME_CONFIG[regime] || REGIME_CONFIG.UNKNOWN;
  const score = data.regime_score || 0;
  const indices = data.indices || [];
  const adx = data.adx || 0;
  const timestamp = data.timestamp ? new Date(data.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '';

  return (
    <Card title="PRISM Regime Gate" icon="🔮">
      {/* Main regime display */}
      <div className={`relative rounded-xl p-4 mb-4 border shadow-lg ${
        cfg.color === 'emerald' ? 'bg-emerald-950/40 border-emerald-700/50' :
        cfg.color === 'amber' ? 'bg-amber-950/40 border-amber-700/50' :
        cfg.color === 'yellow' ? 'bg-yellow-950/40 border-yellow-700/50' :
        cfg.color === 'orange' ? 'bg-orange-950/40 border-orange-700/50' :
        cfg.color === 'red' ? 'bg-red-950/40 border-red-700/50' :
        'bg-slate-900/40 border-slate-700/50'
      } ${cfg.glow}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{cfg.icon}</span>
            <div>
              <div className={`text-2xl font-black tracking-tight ${
                cfg.color === 'emerald' ? 'text-emerald-400' :
                cfg.color === 'amber' ? 'text-amber-400' :
                cfg.color === 'yellow' ? 'text-yellow-400' :
                cfg.color === 'orange' ? 'text-orange-400' :
                cfg.color === 'red' ? 'text-red-400' :
                'text-slate-400'
              }`}>{cfg.label}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">SPY Primary • {timestamp}</div>
            </div>
          </div>
          <div className="text-right">
            <div className={`text-3xl font-black font-mono ${
              score > 0 ? 'text-emerald-400' : score < 0 ? 'text-red-400' : 'text-slate-400'
            }`}>{score > 0 ? '+' : ''}{score}</div>
            <div className="text-[10px] text-slate-500">regime score</div>
          </div>
        </div>

        {/* Score gauge */}
        <ScoreGauge score={score} label="SPY Regime Strength" />

        {/* ADX + Signal */}
        <div className="flex gap-4 mt-3">
          <div className="flex-1 bg-slate-900/60 rounded-lg p-2 text-center">
            <div className="text-[10px] text-slate-500">ADX (Trend)</div>
            <div className={`text-lg font-bold font-mono ${adx > 40 ? 'text-amber-400' : adx > 25 ? 'text-white' : 'text-slate-500'}`}>
              {adx.toFixed(1)}
            </div>
            <div className="text-[9px] text-slate-600">
              {adx > 40 ? '🔥 STRONG TREND' : adx > 25 ? 'Trending' : 'Weak/Range'}
            </div>
          </div>
          <div className="flex-1 bg-slate-900/60 rounded-lg p-2 text-center">
            <div className="text-[10px] text-slate-500">Signal</div>
            <div className={`text-lg font-bold ${
              data.signal === 'RISK_ON' ? 'text-emerald-400' : 
              data.signal === 'WAIT' ? 'text-amber-400' : 'text-red-400'
            }`}>{data.signal || 'N/A'}</div>
            <div className="text-[9px] text-slate-600">
              {data.signal === 'RISK_ON' ? '✅ GO' : data.signal === 'WAIT' ? '⏳ PATIENCE' : '🛑 HALT'}
            </div>
          </div>
        </div>
      </div>

      {/* Recommendation */}
      {data.recommendation && (
        <div className="text-xs text-slate-400 italic mb-3 px-1">
          💡 {data.recommendation}
        </div>
      )}

      {/* All indices */}
      {indices.length > 0 && (
        <div className="bg-slate-900/30 rounded-lg p-3">
          <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-2">All Indices</div>
          {indices.map((entry, i) => (
            <IndexRow key={i} entry={entry} />
          ))}
        </div>
      )}

      {/* Risk-off warning */}
      {(regime === 'RISK_OFF' || regime === 'BEAR_VOLATILE') && (
        <div className="mt-3 p-2 bg-red-950/40 rounded-lg border border-red-800/50 text-xs text-red-300 text-center font-semibold">
          ⛔ New equity longs BLOCKED — defensive mode only (gold/defense/puts)
        </div>
      )}
    </Card>
  );
}
