import { useState, useEffect } from 'react';
import { Card } from '../components/Card';
import { api } from '../api';

const REGIME_CONFIG = {
  BULL_TREND:    { color: 'emerald', icon: '🟢', gradient: 'from-emerald-600 to-emerald-900' },
  BULL_QUIET:    { color: 'emerald', icon: '🟢', gradient: 'from-emerald-700 to-emerald-950' },
  BULL_VOLATILE: { color: 'yellow',  icon: '⚡', gradient: 'from-yellow-600 to-yellow-950' },
  RISK_ON:       { color: 'emerald', icon: '🚀', gradient: 'from-emerald-500 to-emerald-900' },
  TRANSITION:    { color: 'amber',   icon: '⚠️',  gradient: 'from-amber-600 to-amber-950' },
  BEAR_QUIET:    { color: 'orange',  icon: '🔻', gradient: 'from-orange-600 to-orange-950' },
  BEAR_VOLATILE: { color: 'red',     icon: '💀', gradient: 'from-red-600 to-red-950' },
  RISK_OFF:      { color: 'red',     icon: '🛑', gradient: 'from-red-500 to-red-950' },
  UNKNOWN:       { color: 'slate',   icon: '❓', gradient: 'from-slate-600 to-slate-900' },
};

const RISK_COLORS = {
  LOW: 'text-emerald-400 bg-emerald-950/40 border-emerald-800',
  MEDIUM: 'text-yellow-400 bg-yellow-950/40 border-yellow-800',
  ELEVATED: 'text-amber-400 bg-amber-950/40 border-amber-800',
  HIGH: 'text-orange-400 bg-orange-950/40 border-orange-800',
  'VERY HIGH': 'text-red-400 bg-red-950/40 border-red-800',
  EXTREME: 'text-red-300 bg-red-900/40 border-red-600 animate-pulse',
  UNKNOWN: 'text-slate-400 bg-slate-900/40 border-slate-700',
};

function colorClass(color, type) {
  const map = {
    emerald: { text: 'text-emerald-400', bg: 'bg-emerald-950/40', border: 'border-emerald-700/50', badge: 'bg-emerald-900/50 text-emerald-400' },
    amber:   { text: 'text-amber-400',   bg: 'bg-amber-950/40',   border: 'border-amber-700/50',   badge: 'bg-amber-900/50 text-amber-400' },
    yellow:  { text: 'text-yellow-400',   bg: 'bg-yellow-950/40',  border: 'border-yellow-700/50',  badge: 'bg-yellow-900/50 text-yellow-400' },
    orange:  { text: 'text-orange-400',   bg: 'bg-orange-950/40',  border: 'border-orange-700/50',  badge: 'bg-orange-900/50 text-orange-400' },
    red:     { text: 'text-red-400',      bg: 'bg-red-950/40',     border: 'border-red-700/50',     badge: 'bg-red-900/50 text-red-400' },
    slate:   { text: 'text-slate-400',    bg: 'bg-slate-900/40',   border: 'border-slate-700/50',   badge: 'bg-slate-800 text-slate-400' },
  };
  return (map[color] || map.slate)[type];
}

function ScoreBar({ score, max = 100 }) {
  const pct = Math.min(100, Math.max(0, (score + max) / (2 * max) * 100));
  const barColor = score > 30 ? 'bg-emerald-500' : score > 0 ? 'bg-emerald-700' : score > -30 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="w-full">
      <div className="h-3 bg-slate-800 rounded-full overflow-hidden relative">
        {/* Center marker */}
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-600 z-10" />
        <div className={`h-full rounded-full transition-all duration-1000 ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between text-[9px] text-slate-600 mt-0.5">
        <span>-{max}</span>
        <span>0</span>
        <span>+{max}</span>
      </div>
    </div>
  );
}

function IndexCard({ entry }) {
  const cfg = REGIME_CONFIG[entry.regime] || REGIME_CONFIG.UNKNOWN;
  const score = entry.regime_score || 0;
  return (
    <div className={`rounded-xl p-4 border ${colorClass(cfg.color, 'bg')} ${colorClass(cfg.color, 'border')}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-lg font-black text-white">{entry.ticker}</span>
        <span className={`text-2xl font-black font-mono ${score > 0 ? 'text-emerald-400' : score < 0 ? 'text-red-400' : 'text-slate-400'}`}>
          {score > 0 ? '+' : ''}{score}
        </span>
      </div>
      <div className={`text-sm font-bold mb-2 ${colorClass(cfg.color, 'text')}`}>
        {cfg.icon} {entry.regime?.replace('_', ' ')}
      </div>
      <ScoreBar score={score} />
      <div className="flex justify-between mt-2 text-[10px]">
        <span className="text-slate-500">Signal: <span className={`font-bold ${
          entry.signal === 'RISK_ON' ? 'text-emerald-400' : entry.signal === 'WAIT' ? 'text-amber-400' : 'text-red-400'
        }`}>{entry.signal}</span></span>
        <span className="text-slate-500">ADX: <span className="text-white font-mono">{(entry.adx || 0).toFixed(1)}</span></span>
      </div>
    </div>
  );
}

function TransitionArrow({ from, to, type }) {
  const isLikely = type === 'likely';
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
      isLikely ? 'bg-amber-950/20 border-amber-800/30' : 'bg-slate-900/30 border-slate-800/30'
    }`}>
      <span className={`text-xs ${isLikely ? 'text-amber-400' : 'text-slate-500'}`}>
        {isLikely ? '→' : '⇢'}
      </span>
      <span className={`text-sm font-bold ${isLikely ? 'text-amber-300' : 'text-slate-500'}`}>
        {(REGIME_CONFIG[to] || REGIME_CONFIG.UNKNOWN).icon} {to?.replace('_', ' ')}
      </span>
      <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded ${
        isLikely ? 'bg-amber-900/40 text-amber-400' : 'bg-slate-800 text-slate-600'
      }`}>
        {isLikely ? 'LIKELY' : 'UNLIKELY'}
      </span>
    </div>
  );
}

export default function RegimePage({ onBack }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.regimeDetail().then(d => { setData(d); setLoading(false); }).catch(() => setLoading(false));
    const id = setInterval(() => {
      api.regimeDetail().then(setData).catch(() => {});
    }, 30000);
    return () => clearInterval(id);
  }, []);

  if (loading) return (
    <div className="min-h-screen bg-[#0a0e17] flex items-center justify-center">
      <div className="text-slate-500">Loading regime data...</div>
    </div>
  );

  if (!data || data.regime === 'UNKNOWN') return (
    <div className="min-h-screen bg-[#0a0e17] p-6">
      <button onClick={onBack} className="text-slate-400 hover:text-white text-sm mb-4">← Back to Dashboard</button>
      <div className="text-center text-slate-500 mt-20">No regime data available yet.</div>
    </div>
  );

  const cfg = REGIME_CONFIG[data.regime] || REGIME_CONFIG.UNKNOWN;
  const char = data.characteristics || {};
  const transitions = data.transitions || {};
  const score = data.regime_score || 0;
  const prevCfg = data.previous_regime ? (REGIME_CONFIG[data.previous_regime] || REGIME_CONFIG.UNKNOWN) : null;
  const timestamp = data.timestamp ? new Date(data.timestamp).toLocaleString('en-US', { 
    timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
  }) : '';
  const ma = data.ma_alignment || {};
  const vol = data.volatility_regime || {};

  return (
    <div className="min-h-screen bg-[#0a0e17]">
      {/* Header */}
      <header className="border-b border-[#1e2d3d] px-6 py-3">
        <div className="max-w-[1440px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="text-slate-400 hover:text-white transition text-sm flex items-center gap-1">
              ← Dashboard
            </button>
            <div className="w-px h-6 bg-slate-700" />
            <h1 className="text-lg font-bold text-white">🔮 PRISM Regime Gate</h1>
          </div>
          <div className="text-xs text-slate-500">
            Last scan: {timestamp} ET
          </div>
        </div>
      </header>

      <main className="max-w-[1440px] mx-auto p-6 space-y-6">
        {/* Hero: Current Regime */}
        <div className={`relative rounded-2xl p-8 border bg-gradient-to-br ${cfg.gradient} bg-opacity-30 border-opacity-30 overflow-hidden`}>
          <div className="absolute inset-0 bg-[#0a0e17]/70" />
          <div className="relative z-10">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div>
                <div className="text-xs text-slate-400 uppercase tracking-widest mb-2">Current Market Regime</div>
                <div className="flex items-center gap-4">
                  <span className="text-5xl">{cfg.icon}</span>
                  <div>
                    <h2 className={`text-4xl md:text-5xl font-black tracking-tight ${colorClass(cfg.color, 'text')}`}>
                      {data.regime?.replace('_', ' ')}
                    </h2>
                    {data.previous_regime && data.previous_regime !== data.regime && (
                      <div className="flex items-center gap-2 mt-1 text-sm text-slate-400">
                        <span>Previously:</span>
                        <span className={`font-bold ${colorClass(prevCfg.color, 'text')}`}>
                          {prevCfg.icon} {data.previous_regime?.replace('_', ' ')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className={`text-6xl font-black font-mono ${score > 0 ? 'text-emerald-400' : score < 0 ? 'text-red-400' : 'text-slate-400'}`}>
                  {score > 0 ? '+' : ''}{score}
                </div>
                <div className="text-xs text-slate-500">Regime Score</div>
                <div className="w-48">
                  <ScoreBar score={score} />
                </div>
              </div>
            </div>
            {data.recommendation && (
              <div className="mt-6 text-sm text-slate-300 italic border-t border-white/10 pt-4">
                💡 {data.recommendation}
              </div>
            )}
          </div>
        </div>

        {/* Row 2: Characteristics + Risk + MA Alignment */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Trading Stance */}
          <Card title="Trading Stance" icon="🎯">
            <div className="space-y-4">
              <div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider">Stance</div>
                <div className={`text-xl font-black mt-1 ${colorClass(cfg.color, 'text')}`}>{char.stance || 'N/A'}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider">Position Sizing</div>
                <div className="text-2xl font-black text-white mt-1">{char.position_size || 'N/A'}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider">Risk Level</div>
                <div className={`inline-block mt-1 text-sm font-bold px-3 py-1 rounded-lg border ${RISK_COLORS[char.risk] || RISK_COLORS.UNKNOWN}`}>
                  {char.risk || 'UNKNOWN'}
                </div>
              </div>
            </div>
          </Card>

          {/* Strategy */}
          <Card title="Strategy Playbook" icon="📋">
            <div className="space-y-4">
              <div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">✅ Recommended</div>
                <div className="text-sm text-emerald-300 leading-relaxed">{char.strategy || 'N/A'}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">❌ Avoid</div>
                <div className="text-sm text-red-300 leading-relaxed">{char.avoid || 'N/A'}</div>
              </div>
            </div>
          </Card>

          {/* Market Internals */}
          <Card title="Market Internals" icon="📊">
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-slate-800">
                <span className="text-xs text-slate-500">ADX (Trend Strength)</span>
                <span className={`text-lg font-bold font-mono ${
                  data.adx > 40 ? 'text-amber-400' : data.adx > 25 ? 'text-white' : 'text-slate-500'
                }`}>{(data.adx || 0).toFixed(1)}</span>
              </div>
              {ma.price && (
                <>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-xs text-slate-500">Price</span>
                    <span className="text-sm font-bold text-white font-mono">${ma.price?.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-xs text-slate-500">SMA 20</span>
                    <span className={`text-sm font-mono ${ma.price > ma.sma20 ? 'text-emerald-400' : 'text-red-400'}`}>
                      ${ma.sma20?.toFixed(2)} {ma.price > ma.sma20 ? '✅' : '❌'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-xs text-slate-500">SMA 50</span>
                    <span className={`text-sm font-mono ${ma.price > ma.sma50 ? 'text-emerald-400' : 'text-red-400'}`}>
                      ${ma.sma50?.toFixed(2)} {ma.price > ma.sma50 ? '✅' : '❌'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-xs text-slate-500">SMA 200</span>
                    <span className={`text-sm font-mono ${ma.price > ma.sma200 ? 'text-emerald-400' : 'text-red-400'}`}>
                      ${ma.sma200?.toFixed(2)} {ma.price > ma.sma200 ? '✅' : '❌'}
                    </span>
                  </div>
                </>
              )}
              {ma.alignment && (
                <div className="flex justify-between items-center py-1 border-t border-slate-800">
                  <span className="text-xs text-slate-500">MA Alignment</span>
                  <span className={`text-xs font-bold ${
                    ma.alignment?.includes('bull') ? 'text-emerald-400' : 'text-red-400'
                  }`}>{ma.alignment?.replace('_', ' ').toUpperCase()}</span>
                </div>
              )}
              {vol.regime && (
                <div className="flex justify-between items-center py-1 border-t border-slate-800">
                  <span className="text-xs text-slate-500">Volatility Regime</span>
                  <span className="text-xs font-bold text-white">{vol.regime?.toUpperCase()}</span>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Row 3: Transitions + All Indices */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Possible Next Regimes */}
          <Card title="Regime Transitions" icon="🔄">
            <div className="space-y-2 mb-4">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Possible Next Regimes</div>
              {(transitions.likely || []).map((r, i) => (
                <TransitionArrow key={i} from={data.regime} to={r} type="likely" />
              ))}
              {(transitions.unlikely || []).map((r, i) => (
                <TransitionArrow key={i} from={data.regime} to={r} type="unlikely" />
              ))}
            </div>
            {transitions.triggers && transitions.triggers.length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-800">
                <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">🎯 Triggers to Watch</div>
                <ul className="space-y-1.5">
                  {transitions.triggers.map((t, i) => (
                    <li key={i} className="text-xs text-slate-300 flex items-start gap-2">
                      <span className="text-amber-500 mt-0.5">•</span>
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>

          {/* All Indices */}
          <Card title="Index Regimes" icon="🌐">
            <div className="grid grid-cols-1 gap-3">
              {(data.indices || []).map((entry, i) => (
                <IndexCard key={i} entry={entry} />
              ))}
            </div>
          </Card>
        </div>

        {/* Row 4: Regime History */}
        {data.history && data.history.length > 0 && (
          <Card title="Regime History" icon="📜">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] text-slate-500 uppercase tracking-wider border-b border-slate-800">
                    <th className="text-left py-2 px-2">Date</th>
                    <th className="text-left py-2 px-2">Regime</th>
                    <th className="text-right py-2 px-2">Score</th>
                    <th className="text-right py-2 px-2">Signal</th>
                  </tr>
                </thead>
                <tbody>
                  {data.history.slice().reverse().map((h, i) => {
                    const hCfg = REGIME_CONFIG[h.regime] || REGIME_CONFIG.UNKNOWN;
                    return (
                      <tr key={i} className="border-b border-slate-800/30 hover:bg-slate-900/30">
                        <td className="py-1.5 px-2 text-xs text-slate-400 font-mono">
                          {h.timestamp ? new Date(h.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                        </td>
                        <td className={`py-1.5 px-2 text-xs font-bold ${colorClass(hCfg.color, 'text')}`}>
                          {hCfg.icon} {h.regime?.replace('_', ' ')}
                        </td>
                        <td className={`py-1.5 px-2 text-xs font-mono text-right ${
                          (h.regime_score || 0) > 0 ? 'text-emerald-400' : 'text-red-400'
                        }`}>
                          {(h.regime_score || 0) > 0 ? '+' : ''}{h.regime_score || 0}
                        </td>
                        <td className="py-1.5 px-2 text-xs text-right text-slate-400">{h.signal}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Regime Definitions */}
        <Card title="Regime Definitions" icon="📖">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {Object.entries(REGIME_CONFIG).filter(([k]) => k !== 'UNKNOWN').map(([key, c]) => (
              <div key={key} className={`rounded-lg p-3 border ${colorClass(c.color, 'bg')} ${colorClass(c.color, 'border')} ${
                key === data.regime ? 'ring-2 ring-white/20' : 'opacity-60'
              }`}>
                <div className={`text-sm font-bold ${colorClass(c.color, 'text')}`}>
                  {c.icon} {key.replace('_', ' ')}
                </div>
                <div className="text-[10px] text-slate-400 mt-1">
                  {key === 'BULL_TREND' && 'Strong uptrend, price above all MAs'}
                  {key === 'BULL_QUIET' && 'Uptrend with low volatility'}
                  {key === 'BULL_VOLATILE' && 'Uptrend but choppy/uncertain'}
                  {key === 'RISK_ON' && 'Maximum bullish, all signals aligned'}
                  {key === 'TRANSITION' && 'Mixed signals, regime changing'}
                  {key === 'BEAR_QUIET' && 'Downtrend with orderly selling'}
                  {key === 'BEAR_VOLATILE' && 'Downtrend with panic/spikes'}
                  {key === 'RISK_OFF' && 'Crisis mode, capital preservation only'}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <div className="text-center text-xs text-slate-600 py-4">
          PRISM Regime Gate v2.0 — Built by Neo 🟢
        </div>
      </main>
    </div>
  );
}
