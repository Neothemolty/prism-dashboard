import { Card } from './Card';
import { usePolling } from '../hooks/usePolling';
import { api } from '../api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export default function PnLDecomposition() {
  const { data, loading } = usePolling(api.decomposition, 60000);
  if (loading || !data) return <Card title="P&L Attribution"><p className="text-slate-500 text-sm">Loading...</p></Card>;

  const s = data.summary;
  if (!s || !s.trades) {
    return (
      <Card title="P&L Attribution" icon="🔬">
        <p className="text-slate-500 text-sm">No decomposition data yet.</p>
        <p className="text-slate-600 text-xs mt-2">PRISM Decomposer will populate this after trades are closed with full market data.</p>
      </Card>
    );
  }

  const chartData = [
    { name: 'Market', value: s.market_avg_pct },
    { name: 'Sector', value: s.sector_avg_pct },
    { name: 'Alpha', value: s.idiosyncratic_avg_pct },
    { name: 'Timing', value: s.timing_avg_pct },
  ];

  const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b'];

  return (
    <Card title="P&L Attribution" icon="🔬">
      <p className="text-xs text-slate-500 mb-3">Average return component per trade ({s.trades} trades)</p>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 10 }}>
          <XAxis type="number" tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
          <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} width={55} />
          <Tooltip
            contentStyle={{ background: '#1a2332', border: '1px solid #1e2d3d', borderRadius: 8, color: '#e2e8f0', fontSize: 12 }}
            formatter={(v) => [`${v.toFixed(2)}%`, 'Avg Contribution']}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
            {chartData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}
