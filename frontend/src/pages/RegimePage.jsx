import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

/* ── Regime visual config ── */
const R = {
  BULL_TREND:    { c: 'emerald', icon: '🟢', g: 'from-emerald-600/20 to-emerald-950/40' },
  BULL_QUIET:    { c: 'emerald', icon: '🟢', g: 'from-emerald-700/20 to-emerald-950/40' },
  BULL_VOLATILE: { c: 'yellow',  icon: '⚡', g: 'from-yellow-600/20 to-yellow-950/40' },
  RISK_ON:       { c: 'emerald', icon: '🚀', g: 'from-emerald-500/20 to-emerald-950/40' },
  TRANSITION:    { c: 'amber',   icon: '⚠️',  g: 'from-amber-600/20 to-amber-950/40' },
  BEAR_QUIET:    { c: 'orange',  icon: '🔻', g: 'from-orange-600/20 to-orange-950/40' },
  BEAR_VOLATILE: { c: 'red',     icon: '💀', g: 'from-red-600/20 to-red-950/40' },
  RISK_OFF:      { c: 'red',     icon: '🛑', g: 'from-red-500/20 to-red-950/40' },
  UNKNOWN:       { c: 'slate',   icon: '❓', g: 'from-slate-600/20 to-slate-900/40' },
};
const rc = (regime) => R[regime] || R.UNKNOWN;

const RISK_COLORS = {
  LOW: 'text-emerald-400 bg-emerald-950/50 border-emerald-700',
  MEDIUM: 'text-yellow-400 bg-yellow-950/50 border-yellow-700',
  ELEVATED: 'text-amber-400 bg-amber-950/50 border-amber-700',
  HIGH: 'text-orange-400 bg-orange-950/50 border-orange-700',
  'VERY HIGH': 'text-red-400 bg-red-950/50 border-red-700',
  EXTREME: 'text-red-300 bg-red-900/50 border-red-500 animate-pulse',
};

const tc = (color) => ({
  emerald: 'text-emerald-400', amber: 'text-amber-400', yellow: 'text-yellow-400',
  orange: 'text-orange-400', red: 'text-red-400', slate: 'text-slate-400',
}[color] || 'text-slate-400');

const bc = (color) => ({
  emerald: 'border-emerald-700/40 bg-emerald-950/20', amber: 'border-amber-700/40 bg-amber-950/20',
  yellow: 'border-yellow-700/40 bg-yellow-950/20', orange: 'border-orange-700/40 bg-orange-950/20',
  red: 'border-red-700/40 bg-red-950/20', slate: 'border-slate-700/40 bg-slate-900/20',
}[color] || 'border-slate-700/40 bg-slate-900/20');

/* ── Reusable components ── */
function Card({ title, icon, children, className = '' }) {
  return (
    <div className={`bg-[#0d1320] border border-[#1e2d3d] rounded-xl p-5 ${className}`}>
      {title && (
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-800/50">
          {icon && <span className="text-sm">{icon}</span>}
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">{title}</h3>
        </div>
      )}
      {children}
    </div>
  );
}

function ScoreBar({ value, min = -100, max = 100, height = 'h-2', showLabels = true }) {
  const range = max - min;
  const pct = Math.min(100, Math.max(0, ((value - min) / range) * 100));
  const color = value > 30 ? 'bg-emerald-500' : value > 0 ? 'bg-emerald-700' : value > -30 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div>
      <div className={`${height} bg-slate-800 rounded-full overflow-hidden relative`}>
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-600 z-10" />
        <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      {showLabels && (
        <div className="flex justify-between text-[8px] text-slate-600 mt-0.5 font-mono">
          <span>{min}</span><span>0</span><span>+{max}</span>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, sub, color = 'text-white', size = 'text-2xl' }) {
  return (
    <div>
      <div className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</div>
      <div className={`${size} font-black font-mono ${color} mt-0.5`}>{value}</div>
      {sub && <div className="text-[9px] text-slate-600 mt-0.5">{sub}</div>}
    </div>
  );
}

function FactorBar({ name, value }) {
  const pct = Math.min(100, Math.max(0, (value + 1) / 2 * 100));
  const color = value > 0.3 ? 'bg-emerald-500' : value > 0 ? 'bg-emerald-700' : value > -0.3 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-3">
      <span className="text-[10px] text-slate-400 w-20 text-right capitalize">{name.replace('_', ' ')}</span>
      <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden relative">
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-600 z-10" />
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-[10px] font-mono w-10 ${value > 0 ? 'text-emerald-400' : value < 0 ? 'text-red-400' : 'text-slate-400'}`}>
        {value > 0 ? '+' : ''}{value.toFixed(2)}
      </span>
    </div>
  );
}

function AllocationBar({ data }) {
  if (!data) return null;
  const colors = {
    equities: 'bg-blue-500', bonds: 'bg-emerald-600', gold: 'bg-yellow-500',
    cash: 'bg-slate-400', options: 'bg-purple-500', alternatives: 'bg-cyan-600',
  };
  const entries = Object.entries(data).filter(([, v]) => v > 0);
  return (
    <div>
      <div className="h-8 rounded-lg overflow-hidden flex">
        {entries.map(([k, v]) => (
          <div key={k} className={`${colors[k] || 'bg-slate-500'} flex items-center justify-center`}
            style={{ width: `${v}%` }} title={`${k}: ${v}%`}>
            {v >= 10 && <span className="text-[9px] font-bold text-white/90">{v}%</span>}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
        {entries.map(([k, v]) => (
          <div key={k} className="flex items-center gap-1.5">
            <div className={`w-2.5 h-2.5 rounded-sm ${colors[k] || 'bg-slate-500'}`} />
            <span className="text-[10px] text-slate-400 capitalize">{k}</span>
            <span className="text-[10px] font-bold text-white">{v}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TransitionProb({ regime, prob }) {
  const cfg = rc(regime);
  const pctW = Math.max(4, prob * 100);
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="text-sm w-6">{cfg.icon}</span>
      <span className={`text-xs font-bold w-32 ${tc(cfg.c)}`}>{regime.replace('_', ' ')}</span>
      <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${
          prob > 0.3 ? 'bg-amber-500' : prob > 0.15 ? 'bg-slate-500' : 'bg-slate-700'
        }`} style={{ width: `${pctW}%` }} />
      </div>
      <span className={`text-xs font-mono w-12 text-right ${
        prob > 0.3 ? 'text-amber-400' : 'text-slate-500'
      }`}>{(prob * 100).toFixed(1)}%</span>
    </div>
  );
}

/* ── Main Page ── */
export default function RegimePage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');

  useEffect(() => {
    api.regimeDetail().then(d => { setData(d); setLoading(false); }).catch(() => setLoading(false));
    const id = setInterval(() => { api.regimeDetail().then(setData).catch(() => {}); }, 60000);
    return () => clearInterval(id);
  }, []);

  if (loading) return <div className="min-h-screen bg-[#0a0e17] flex items-center justify-center"><div className="text-slate-500 animate-pulse">Loading regime intelligence...</div></div>;
  if (!data || data.regime === 'UNKNOWN') return (
    <div className="min-h-screen bg-[#0a0e17] p-6">
      <Link to="/" className="text-slate-400 hover:text-white text-sm">← Dashboard</Link>
      <div className="text-center text-slate-500 mt-20">No regime data available. Run analysis to populate.</div>
    </div>
  );

  const cfg = rc(data.regime);
  const prevCfg = data.previous_regime ? rc(data.previous_regime) : null;
  const score = data.regime_score || 0;
  const pb = data.playbook || {};
  const rm = data.risk_metrics || {};
  const factors = data.factor_exposure || {};
  const corr = data.correlations || {};
  const trans = data.transition_matrix || {};
  const triggers = data.triggers || [];
  const components = data.scoring_components || {};
  const ma = data.ma_alignment || {};
  const vol = data.volatility_regime || {};
  const ts = data.timestamp ? new Date(data.timestamp).toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'risk', label: 'Risk & Sizing' },
    { id: 'factors', label: 'Factor Exposure' },
    { id: 'transitions', label: 'Transitions' },
    { id: 'playbook', label: 'Strategy Playbook' },
  ];

  return (
    <div className="min-h-screen bg-[#0a0e17]">
      {/* Header */}
      <header className="border-b border-[#1e2d3d] px-6 py-3">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-slate-400 hover:text-white transition text-sm">← Dashboard</Link>
            <div className="w-px h-6 bg-slate-700" />
            <h1 className="text-lg font-bold text-white tracking-tight">🔮 Regime Gate</h1>
            <span className="text-[10px] text-slate-600 hidden md:inline">Quantitative Regime Classification & Risk Framework</span>
          </div>
          <div className="text-[10px] text-slate-500 font-mono">{ts} ET</div>
        </div>
      </header>

      {/* Hero Banner */}
      <div className={`border-b border-[#1e2d3d] bg-gradient-to-r ${cfg.g}`}>
        <div className="max-w-[1600px] mx-auto px-6 py-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-5">
              <span className="text-5xl">{cfg.icon}</span>
              <div>
                <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Current Regime</div>
                <h2 className={`text-3xl md:text-4xl font-black tracking-tight ${tc(cfg.c)}`}>{data.regime?.replace('_', ' ')}</h2>
                <div className="flex items-center gap-3 mt-1">
                  {data.previous_regime && data.previous_regime !== data.regime && (
                    <span className="text-xs text-slate-500">
                      from <span className={`font-bold ${tc(prevCfg?.c)}`}>{prevCfg?.icon} {data.previous_regime?.replace('_', ' ')}</span>
                    </span>
                  )}
                  {data.current_age_days && (
                    <span className="text-[10px] text-slate-600 bg-slate-800 px-2 py-0.5 rounded">
                      Day {data.current_age_days} in regime
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-8">
              <div className="text-center">
                <div className={`text-4xl font-black font-mono ${score > 0 ? 'text-emerald-400' : score < 0 ? 'text-red-400' : 'text-slate-400'}`}>
                  {score > 0 ? '+' : ''}{score}
                </div>
                <div className="text-[9px] text-slate-500 uppercase">Score</div>
              </div>
              <div className="text-center">
                <div className={`text-2xl font-black ${
                  data.signal === 'RISK_ON' ? 'text-emerald-400' : data.signal === 'WAIT' ? 'text-amber-400' : 'text-red-400'
                }`}>{data.signal}</div>
                <div className="text-[9px] text-slate-500 uppercase">Signal</div>
              </div>
              <div className="text-center">
                <div className={`text-2xl font-black ${data.adx > 40 ? 'text-amber-400' : data.adx > 25 ? 'text-white' : 'text-slate-500'}`}>
                  {(data.adx || 0).toFixed(1)}
                </div>
                <div className="text-[9px] text-slate-500 uppercase">ADX</div>
              </div>
              <div className="text-center">
                <div className={`text-sm font-bold px-3 py-1.5 rounded-lg border ${RISK_COLORS[pb.risk] || RISK_COLORS.ELEVATED}`}>
                  {pb.risk || 'N/A'}
                </div>
                <div className="text-[9px] text-slate-500 uppercase mt-1">Risk</div>
              </div>
            </div>
          </div>
          <div className="mt-4 w-full max-w-xl">
            <ScoreBar value={score} />
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-[#1e2d3d] bg-[#0a0e17] sticky top-0 z-20">
        <div className="max-w-[1600px] mx-auto px-6 flex gap-1 overflow-x-auto">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-4 py-3 text-xs font-semibold transition whitespace-nowrap border-b-2 ${
                tab === t.id ? `${tc(cfg.c)} border-current` : 'text-slate-500 border-transparent hover:text-slate-300'
              }`}>{t.label}</button>
          ))}
        </div>
      </div>

      {/* Content */}
      <main className="max-w-[1600px] mx-auto p-6 space-y-6">
        {tab === 'overview' && <OverviewTab data={data} cfg={cfg} ma={ma} vol={vol} components={components} corr={corr} rm={rm} />}
        {tab === 'risk' && <RiskTab data={data} rm={rm} allocation={data.allocation} cfg={cfg} />}
        {tab === 'factors' && <FactorsTab factors={factors} allFactors={data.all_factor_exposure} regime={data.regime} />}
        {tab === 'transitions' && <TransitionsTab trans={trans} triggers={triggers} duration={data.duration_stats} regime={data.regime} history={data.history} />}
        {tab === 'playbook' && <PlaybookTab pb={pb} cfg={cfg} />}
      </main>
    </div>
  );
}

/* ── TAB: Overview ── */
function OverviewTab({ data, cfg, ma, vol, components, corr, rm }) {
  return (
    <div className="space-y-6">
      {/* Row 1: Score Decomposition + Market Structure + Quick Risk */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card title="Score Decomposition" icon="🧮">
          <div className="space-y-3">
            {Object.entries(components).map(([key, comp]) => (
              <div key={key}>
                <div className="flex justify-between text-[10px] mb-1">
                  <span className="text-slate-400">{comp.description}</span>
                  <span className="text-slate-500 font-mono">w={comp.weight}</span>
                </div>
                <ScoreBar value={typeof comp.value === 'number' ? comp.value : 0}
                  min={key === 'adx_trend' ? 0 : -100} max={key === 'adx_trend' ? 80 : 100}
                  height="h-1.5" showLabels={false} />
              </div>
            ))}
          </div>
        </Card>

        <Card title="Market Structure" icon="📐">
          <div className="space-y-2.5">
            {ma.price && (
              <>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-slate-500">SPY Price</span>
                  <span className="text-sm font-bold text-white font-mono">${ma.price?.toFixed(2)}</span>
                </div>
                {[['SMA 20', ma.sma20], ['SMA 50', ma.sma50], ['SMA 200', ma.sma200]].map(([label, val]) => val && (
                  <div key={label} className="flex justify-between items-center py-1 border-t border-slate-800/30">
                    <span className="text-[10px] text-slate-500">{label}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-slate-300">${val.toFixed(2)}</span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                        ma.price > val ? 'bg-emerald-950/40 text-emerald-400' : 'bg-red-950/40 text-red-400'
                      }`}>{ma.price > val ? 'ABOVE' : 'BELOW'} ({((ma.price - val) / val * 100).toFixed(1)}%)</span>
                    </div>
                  </div>
                ))}
              </>
            )}
            {ma.alignment && (
              <div className="flex justify-between items-center pt-2 border-t border-slate-800">
                <span className="text-[10px] text-slate-500">MA Alignment</span>
                <span className={`text-xs font-bold ${ma.alignment?.includes('bull') ? 'text-emerald-400' : 'text-red-400'}`}>
                  {ma.alignment?.replace('_', ' ').toUpperCase()}
                </span>
              </div>
            )}
            {vol.regime && (
              <div className="flex justify-between items-center pt-1">
                <span className="text-[10px] text-slate-500">Vol Regime</span>
                <span className="text-xs font-bold text-white">
                  {vol.regime?.toUpperCase()} <span className="text-slate-500 font-normal">(ratio: {vol.ratio?.toFixed(2)})</span>
                </span>
              </div>
            )}
            <div className="flex justify-between items-center pt-1">
              <span className="text-[10px] text-slate-500">ADX</span>
              <span className={`text-xs font-bold font-mono ${data.adx > 40 ? 'text-amber-400' : data.adx > 25 ? 'text-white' : 'text-slate-500'}`}>
                {(data.adx || 0).toFixed(1)} <span className="text-[9px] text-slate-500 font-normal">
                  {data.adx > 40 ? '(STRONG TREND)' : data.adx > 25 ? '(TRENDING)' : '(WEAK/RANGE)'}
                </span>
              </span>
            </div>
          </div>
        </Card>

        <Card title="Cross-Asset Correlations" icon="🔗">
          <div className="space-y-2.5">
            {[
              ['SPY ↔ QQQ', corr.spy_qqq], ['SPY ↔ TLT', corr.spy_tlt],
              ['SPY ↔ GLD', corr.spy_gld], ['SPY ↔ VIX', corr.spy_vix],
            ].map(([label, val]) => val != null && (
              <div key={label} className="flex justify-between items-center py-1 border-b border-slate-800/30">
                <span className="text-[10px] text-slate-400">{label}</span>
                <span className={`text-xs font-bold font-mono ${
                  val > 0.5 ? 'text-emerald-400' : val < -0.5 ? 'text-red-400' : 'text-slate-300'
                }`}>{val > 0 ? '+' : ''}{val.toFixed(2)}</span>
              </div>
            ))}
            {corr.vix_level && (
              <div className="flex justify-between items-center pt-1">
                <span className="text-[10px] text-slate-500">Expected VIX Range</span>
                <span className="text-xs font-bold text-amber-400">{corr.vix_level}</span>
              </div>
            )}
            {corr.credit_spreads && (
              <div className="flex justify-between items-center pt-1">
                <span className="text-[10px] text-slate-500">Credit Spreads</span>
                <span className={`text-xs font-bold ${
                  corr.credit_spreads.includes('tight') ? 'text-emerald-400' : 
                  corr.credit_spreads.includes('wide') ? 'text-red-400' : 'text-amber-400'
                }`}>{corr.credit_spreads.toUpperCase()}</span>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Row 2: All Indices */}
      <Card title="Index Regime Classification" icon="🌐">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {(data.indices || []).map((entry, i) => {
            const ecfg = rc(entry.regime);
            const s = entry.regime_score || 0;
            return (
              <div key={i} className={`rounded-xl p-4 border ${bc(ecfg.c)}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-black text-white">{entry.ticker}</span>
                  <span className="text-lg">{ecfg.icon}</span>
                </div>
                <div className={`text-xs font-bold ${tc(ecfg.c)} mb-2`}>{entry.regime?.replace('_', ' ')}</div>
                <div className={`text-xl font-black font-mono mb-1 ${s > 0 ? 'text-emerald-400' : s < 0 ? 'text-red-400' : 'text-slate-400'}`}>
                  {s > 0 ? '+' : ''}{s}
                </div>
                <ScoreBar value={s} height="h-1" showLabels={false} />
                <div className="flex justify-between mt-2 text-[9px]">
                  <span className={`font-bold ${entry.signal === 'RISK_ON' ? 'text-emerald-400' : entry.signal === 'WAIT' ? 'text-amber-400' : 'text-red-400'}`}>{entry.signal}</span>
                  <span className="text-slate-500">ADX {(entry.adx || 0).toFixed(0)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Recommendation */}
      {data.recommendation && (
        <div className={`rounded-xl p-4 border ${bc(cfg.c)} text-sm ${tc(cfg.c)}`}>
          💡 <span className="font-semibold">Regime Insight:</span> {data.recommendation}
        </div>
      )}
    </div>
  );
}

/* ── TAB: Risk & Sizing ── */
function RiskTab({ data, rm, allocation, cfg }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card title="Risk Parameters" icon="⚡">
          <div className="grid grid-cols-2 gap-6">
            <Metric label="Daily VaR (95%)" value={`${rm.daily_var_95 ?? '—'}%`} color="text-red-400" sub="Value at Risk" />
            <Metric label="Daily CVaR (95%)" value={`${rm.daily_cvar_95 ?? '—'}%`} color="text-red-400" sub="Conditional VaR (Tail)" />
            <Metric label="Expected Max DD" value={`${rm.max_dd_pct ?? '—'}%`} color="text-red-400" sub="Max drawdown in regime" />
            <Metric label="Expected Sharpe" value={rm.expected_sharpe != null ? rm.expected_sharpe.toFixed(1) : '—'} 
              color={(rm.expected_sharpe ?? 0) > 0.5 ? 'text-emerald-400' : (rm.expected_sharpe ?? 0) > 0 ? 'text-amber-400' : 'text-red-400'} 
              sub="Risk-adjusted return" />
            <Metric label="Kelly Fraction" value={`${((rm.kelly_fraction || 0) * 100).toFixed(0)}%`}
              color="text-blue-400" sub="Optimal bet size" />
            <Metric label="Max Leverage" value={`${rm.leverage_max ?? '—'}x`}
              color={(rm.leverage_max ?? 0) >= 1.5 ? 'text-emerald-400' : (rm.leverage_max ?? 0) >= 0.5 ? 'text-amber-400' : 'text-red-400'}
              sub="Permitted leverage" />
          </div>
        </Card>

        <Card title="Position Limits" icon="📏">
          <div className="space-y-6">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-[10px] text-slate-500">MAX GROSS EXPOSURE</span>
                <span className="text-xl font-black text-white">{rm.position_limit_pct ?? 50}%</span>
              </div>
              <div className="h-4 bg-slate-800 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${
                  (rm.position_limit_pct ?? 50) >= 80 ? 'bg-emerald-500' : (rm.position_limit_pct ?? 50) >= 40 ? 'bg-amber-500' : 'bg-red-500'
                }`} style={{ width: `${rm.position_limit_pct ?? 50}%` }} />
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Regime-Adjusted Sizing</div>
              <div className="text-sm text-slate-300">
                Position size: <span className="font-bold text-white">{data.playbook?.position_size || 'N/A'}</span>
              </div>
              <div className="text-sm text-slate-300 mt-1">
                Single name max: <span className="font-bold text-white">{Math.round((rm.position_limit_pct || 50) / 5)}%</span>
              </div>
              <div className="text-sm text-slate-300 mt-1">
                Sector max: <span className="font-bold text-white">{Math.round((rm.position_limit_pct || 50) / 3)}%</span>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <Card title="Optimal Allocation" icon="🎯">
        <AllocationBar data={allocation} />
      </Card>

      {/* Risk comparison across all regimes */}
      <Card title="Risk Metrics Across Regimes" icon="📊">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[9px] text-slate-500 uppercase tracking-wider border-b border-slate-800">
                <th className="text-left py-2 px-2">Regime</th>
                <th className="text-right py-2 px-2">Sharpe</th>
                <th className="text-right py-2 px-2">Max DD</th>
                <th className="text-right py-2 px-2">VaR 95</th>
                <th className="text-right py-2 px-2">CVaR 95</th>
                <th className="text-right py-2 px-2">Kelly</th>
                <th className="text-right py-2 px-2">Leverage</th>
                <th className="text-right py-2 px-2">Exposure</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(data.all_risk_metrics || {}).map(([regime, m]) => {
                const c = rc(regime);
                const isCurrent = regime === data.regime;
                return (
                  <tr key={regime} className={`border-b border-slate-800/30 ${isCurrent ? 'bg-slate-800/30' : ''}`}>
                    <td className={`py-2 px-2 font-bold ${tc(c.c)} ${isCurrent ? 'underline' : ''}`}>
                      {c.icon} {regime.replace('_', ' ')}
                    </td>
                    <td className={`py-2 px-2 text-right font-mono ${m.expected_sharpe > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {m.expected_sharpe?.toFixed(1)}
                    </td>
                    <td className="py-2 px-2 text-right font-mono text-red-400">{m.max_dd_pct}%</td>
                    <td className="py-2 px-2 text-right font-mono text-red-400">{m.daily_var_95}%</td>
                    <td className="py-2 px-2 text-right font-mono text-red-400">{m.daily_cvar_95}%</td>
                    <td className="py-2 px-2 text-right font-mono text-blue-400">{((m.kelly_fraction || 0) * 100).toFixed(0)}%</td>
                    <td className="py-2 px-2 text-right font-mono text-white">{m.leverage_max}x</td>
                    <td className="py-2 px-2 text-right font-mono text-white">{m.position_limit_pct}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ── TAB: Factor Exposure ── */
function FactorsTab({ factors, allFactors, regime }) {
  const factorNames = ['momentum', 'value', 'quality', 'low_vol', 'size', 'carry'];
  return (
    <div className="space-y-6">
      <Card title={`Factor Tilts — ${regime?.replace('_', ' ')}`} icon="📈">
        <div className="space-y-3">
          {factorNames.map(f => factors[f] != null && <FactorBar key={f} name={f} value={factors[f]} />)}
        </div>
        <div className="mt-4 text-[10px] text-slate-600">
          +1.0 = maximum positive exposure | -1.0 = maximum negative exposure | 0 = neutral
        </div>
      </Card>

      <Card title="Factor Exposure Heatmap — All Regimes" icon="🗺️">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[9px] text-slate-500 uppercase tracking-wider border-b border-slate-800">
                <th className="text-left py-2 px-2">Regime</th>
                {factorNames.map(f => <th key={f} className="text-center py-2 px-2 capitalize">{f.replace('_', ' ')}</th>)}
              </tr>
            </thead>
            <tbody>
              {Object.entries(allFactors || {}).map(([r, facs]) => {
                const c = rc(r);
                const isCurrent = r === regime;
                return (
                  <tr key={r} className={`border-b border-slate-800/30 ${isCurrent ? 'bg-slate-800/30' : ''}`}>
                    <td className={`py-2 px-2 font-bold ${tc(c.c)} whitespace-nowrap ${isCurrent ? 'underline' : ''}`}>
                      {c.icon} {r.replace('_', ' ')}
                    </td>
                    {factorNames.map(f => {
                      const v = facs[f] || 0;
                      const bg = v > 0.5 ? 'bg-emerald-800/60' : v > 0 ? 'bg-emerald-900/30' : v > -0.5 ? 'bg-red-900/30' : 'bg-red-800/60';
                      return (
                        <td key={f} className={`py-2 px-2 text-center font-mono ${bg} ${v > 0 ? 'text-emerald-400' : v < 0 ? 'text-red-400' : 'text-slate-500'}`}>
                          {v > 0 ? '+' : ''}{v.toFixed(2)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ── TAB: Transitions ── */
function TransitionsTab({ trans, triggers, duration, regime, history }) {
  const sortedTrans = Object.entries(trans).sort((a, b) => b[1] - a[1]);
  const ds = duration?.[regime];
  
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card title="Transition Probability Matrix" icon="🔄">
          <div className="text-[10px] text-slate-500 mb-3">
            Probability of next regime given current: <span className="font-bold text-white">{regime?.replace('_', ' ')}</span>
          </div>
          <div className="space-y-1">
            {sortedTrans.map(([r, p]) => <TransitionProb key={r} regime={r} prob={p} />)}
          </div>
          <div className="mt-3 text-[9px] text-slate-600">
            {history?.length > 10 ? 'Based on empirical transition history' : 'Based on theoretical priors (insufficient history)'}
          </div>
        </Card>

        <div className="space-y-6">
          <Card title="Regime Duration" icon="⏱️">
            {ds ? (
              <div className="grid grid-cols-2 gap-4">
                <Metric label="Avg Duration" value={`${ds.avg_days}d`} size="text-xl" />
                <Metric label="Max Duration" value={`${ds.max_days}d`} size="text-xl" />
                <Metric label="Min Duration" value={`${ds.min_days}d`} size="text-xl" />
                <Metric label="Occurrences" value={ds.occurrences} size="text-xl" />
              </div>
            ) : (
              <div className="text-xs text-slate-500">Insufficient history data. Duration stats will populate after multiple regime changes.</div>
            )}
          </Card>

          <Card title="Triggers to Watch" icon="🎯">
            {triggers.length > 0 ? (
              <div className="space-y-2">
                {triggers.map((t, i) => (
                  <div key={i} className={`flex items-start gap-3 p-2.5 rounded-lg border ${
                    t.severity === 'danger' ? 'border-red-800/30 bg-red-950/10' :
                    t.severity === 'bullish' ? 'border-emerald-800/30 bg-emerald-950/10' :
                    'border-amber-800/30 bg-amber-950/10'
                  }`}>
                    <span className="text-sm mt-0.5">{t.severity === 'danger' ? '🔴' : t.severity === 'bullish' ? '🟢' : '🟡'}</span>
                    <div>
                      <div className="text-xs text-white font-medium">{t.condition}</div>
                      <div className={`text-[10px] mt-0.5 ${
                        t.severity === 'danger' ? 'text-red-400' : t.severity === 'bullish' ? 'text-emerald-400' : 'text-amber-400'
                      }`}>{t.outcome}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-slate-500">No specific triggers defined for this regime.</div>
            )}
          </Card>
        </div>
      </div>

      {/* History */}
      {history && history.length > 0 && (
        <Card title="Regime History" icon="📜">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[9px] text-slate-500 uppercase tracking-wider border-b border-slate-800">
                  <th className="text-left py-2 px-2">Date</th>
                  <th className="text-left py-2 px-2">Regime</th>
                  <th className="text-right py-2 px-2">Score</th>
                  <th className="text-right py-2 px-2">ADX</th>
                  <th className="text-right py-2 px-2">Signal</th>
                </tr>
              </thead>
              <tbody>
                {history.slice().reverse().map((h, i) => {
                  const hc = rc(h.regime);
                  return (
                    <tr key={i} className="border-b border-slate-800/30 hover:bg-slate-900/30">
                      <td className="py-1.5 px-2 text-slate-400 font-mono">
                        {h.timestamp ? new Date(h.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                      </td>
                      <td className={`py-1.5 px-2 font-bold ${tc(hc.c)}`}>{hc.icon} {h.regime?.replace('_', ' ')}</td>
                      <td className={`py-1.5 px-2 text-right font-mono ${(h.regime_score||0) > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {(h.regime_score||0) > 0 ? '+' : ''}{h.regime_score||0}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono text-slate-400">{(h.adx||0).toFixed(1)}</td>
                      <td className="py-1.5 px-2 text-right text-slate-400">{h.signal}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

/* ── TAB: Playbook ── */
function PlaybookTab({ pb, cfg }) {
  return (
    <div className="space-y-6">
      <div className={`rounded-2xl p-6 border bg-gradient-to-r ${cfg.g}`}>
        <div className="flex items-center gap-4 mb-4">
          <span className="text-4xl">{cfg.icon}</span>
          <div>
            <div className="text-[10px] text-slate-500 uppercase tracking-widest">Current Stance</div>
            <div className={`text-3xl font-black ${tc(cfg.c)}`}>{pb.stance || 'N/A'}</div>
          </div>
          <div className="ml-auto text-right">
            <div className="text-[10px] text-slate-500">Position Sizing</div>
            <div className="text-2xl font-black text-white">{pb.position_size || 'N/A'}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card title="Strategies" icon="✅">
          <ul className="space-y-2">
            {(pb.strategies || []).map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-emerald-300">
                <span className="text-emerald-500 mt-1">▸</span>{s}
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Avoid" icon="❌">
          <ul className="space-y-2">
            {(pb.avoid || []).map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-red-300">
                <span className="text-red-500 mt-1">▸</span>{s}
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Instruments" icon="🛠️">
          <ul className="space-y-2">
            {(pb.instruments || []).map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-blue-300">
                <span className="text-blue-500 mt-1">▸</span>{s}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
