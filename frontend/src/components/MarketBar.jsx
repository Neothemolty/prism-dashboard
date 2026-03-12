import { usePolling } from '../hooks/usePolling';
import { api } from '../api';

export default function MarketBar() {
  const { data } = usePolling(api.marketSnapshot, 30000);
  if (!data) return null;

  const tickers = ['SPY', 'QQQ', 'GLD', 'UVXY'];
  return (
    <div className="flex gap-4 text-sm">
      {tickers.map(t => {
        const d = data[t];
        if (!d) return null;
        const isUp = d.change_pct >= 0;
        return (
          <div key={t} className="flex items-center gap-1.5">
            <span className="text-slate-400 font-medium">{t}</span>
            <span className="text-white">${d.price?.toFixed(2)}</span>
            <span className={`text-xs ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>
              {isUp ? '+' : ''}{d.change_pct}%
            </span>
          </div>
        );
      })}
    </div>
  );
}
