import { Card } from './Card';
import { usePolling } from '../hooks/usePolling';
import { api } from '../api';

export default function RecentFills() {
  const { data, loading } = usePolling(api.fills, 30000);
  if (loading || !data) return <Card title="Recent Fills"><p className="text-slate-500 text-sm">Loading...</p></Card>;

  const fills = data.fills.slice(0, 20);
  return (
    <Card title="Recent Fills" icon="⚡">
      <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
        {fills.map((f, i) => {
          const isBuy = f.side === 'buy';
          const time = new Date(f.time).toLocaleString('en-US', {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
          });
          return (
            <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-[#1e2d3d]/30">
              <div className="flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full ${isBuy ? 'bg-emerald-400' : 'bg-red-400'}`} />
                <span className={`font-medium ${isBuy ? 'text-emerald-400' : 'text-red-400'}`}>
                  {f.side.toUpperCase()}
                </span>
                <span className="text-slate-300">{f.qty}</span>
                <span className="text-white font-medium">{f.symbol.length > 12 ? f.symbol.slice(0,10)+'…' : f.symbol}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-slate-300">${parseFloat(f.price).toFixed(2)}</span>
                <span className="text-slate-500">{time}</span>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
