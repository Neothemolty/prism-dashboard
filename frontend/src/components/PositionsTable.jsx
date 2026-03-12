import { Card } from './Card';
import { usePolling } from '../hooks/usePolling';
import { api } from '../api';

function fmt(n) { return n?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

export default function PositionsTable() {
  const { data, loading } = usePolling(api.positions, 15000);
  if (loading || !data) return <Card title="Positions"><p className="text-slate-500 text-sm">Loading...</p></Card>;

  return (
    <Card title="Open Positions" icon="📋">
      <div className="flex justify-between text-xs text-slate-500 mb-2">
        <span>{data.count} positions</span>
        <span>
          Unrealized: <span className={data.total_unrealized >= 0 ? 'text-emerald-400' : 'text-red-400'}>
            ${fmt(data.total_unrealized)}
          </span>
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-slate-500 border-b border-[#1e2d3d]">
              <th className="text-left py-2">Symbol</th>
              <th className="text-left">Side</th>
              <th className="text-right">Qty</th>
              <th className="text-right">Entry</th>
              <th className="text-right">Current</th>
              <th className="text-right">P&L</th>
              <th className="text-right">P&L %</th>
            </tr>
          </thead>
          <tbody>
            {data.positions.map((p) => (
              <tr key={p.symbol} className="border-b border-[#1e2d3d]/50 hover:bg-[#111827]/50">
                <td className="py-2 font-medium">
                  <span className="text-slate-300">{p.symbol.length > 15 ? p.symbol.slice(0,10)+'…' : p.symbol}</span>
                </td>
                <td>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    p.side === 'long' ? 'bg-emerald-900/50 text-emerald-400' : 'bg-red-900/50 text-red-400'
                  }`}>
                    {p.side}
                  </span>
                </td>
                <td className="text-right text-slate-300">{p.qty}</td>
                <td className="text-right text-slate-400">${fmt(p.avg_entry)}</td>
                <td className="text-right text-slate-300">${fmt(p.current_price)}</td>
                <td className={`text-right font-medium ${p.unrealized_pl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  ${fmt(p.unrealized_pl)}
                </td>
                <td className={`text-right ${p.unrealized_plpc >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {p.unrealized_plpc >= 0 ? '+' : ''}{p.unrealized_plpc}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
