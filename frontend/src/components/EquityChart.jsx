import { Card } from './Card';
import { usePolling } from '../hooks/usePolling';
import { api } from '../api';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function EquityChart() {
  const { data, loading } = usePolling(api.equityCurve, 60000);
  if (loading || !data?.curve?.length) return <Card title="Equity Curve"><p className="text-slate-500 text-sm">Loading chart...</p></Card>;

  const chartData = data.curve.filter(d => d.equity != null);
  const startEquity = 100000;
  const currentEquity = chartData[chartData.length - 1]?.equity || startEquity;
  const isUp = currentEquity >= startEquity;

  return (
    <Card title="Equity Curve" icon="📈">
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
          <defs>
            <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={isUp ? '#10b981' : '#ef4444'} stopOpacity={0.3} />
              <stop offset="100%" stopColor={isUp ? '#10b981' : '#ef4444'} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e2d3d" />
          <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={(d) => d.slice(5)} />
          <YAxis
            tick={{ fill: '#64748b', fontSize: 11 }}
            domain={['dataMin - 500', 'dataMax + 500']}
            tickFormatter={(v) => `$${(v/1000).toFixed(1)}k`}
          />
          <Tooltip
            contentStyle={{ background: '#1a2332', border: '1px solid #1e2d3d', borderRadius: 8, color: '#e2e8f0', fontSize: 12 }}
            formatter={(v) => [`$${v.toLocaleString()}`, 'Equity']}
          />
          <Area type="monotone" dataKey="equity" stroke={isUp ? '#10b981' : '#ef4444'} fill="url(#eqGrad)" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </Card>
  );
}
