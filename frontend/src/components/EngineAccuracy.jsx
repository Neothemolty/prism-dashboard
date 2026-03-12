import { Card } from './Card';
import { usePolling } from '../hooks/usePolling';
import { api } from '../api';

export default function EngineAccuracy() {
  const { data, loading } = usePolling(api.engineAccuracy, 60000);
  if (loading || !data) return <Card title="Engine Accuracy"><p className="text-slate-500 text-sm">Loading...</p></Card>;

  if (data.message) {
    return (
      <Card title="Engine Accuracy" icon="🎯">
        <p className="text-slate-500 text-sm">{data.message}</p>
        <p className="text-slate-600 text-xs mt-2">PRISM Signal Logger will populate this after trades are logged and closed.</p>
      </Card>
    );
  }

  const engines = Object.entries(data.engines || {}).filter(([, v]) => v.aligned_trades > 0);

  return (
    <Card title="Engine Accuracy" icon="🎯">
      <p className="text-xs text-slate-500 mb-3">P(win | engine aligned with trade direction)</p>
      <div className="space-y-2 max-h-[350px] overflow-y-auto">
        {engines.map(([name, stats]) => {
          const acc = stats.accuracy;
          const barWidth = acc != null ? acc : 0;
          const color = acc >= 60 ? 'bg-emerald-500' : acc >= 45 ? 'bg-yellow-500' : 'bg-red-500';
          return (
            <div key={name} className="flex items-center gap-2 text-xs">
              <span className="w-28 text-slate-400 truncate">{name}</span>
              <div className="flex-1 bg-[#111827] rounded-full h-3 overflow-hidden">
                <div className={`h-full rounded-full ${color}`} style={{ width: `${barWidth}%` }} />
              </div>
              <span className="w-12 text-right text-slate-300 font-medium">
                {acc != null ? `${acc}%` : '—'}
              </span>
              <span className="w-8 text-right text-slate-500">{stats.aligned_trades}t</span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
