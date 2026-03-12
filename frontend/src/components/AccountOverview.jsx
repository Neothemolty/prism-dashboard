import { StatCard } from './Card';
import { usePolling } from '../hooks/usePolling';
import { api } from '../api';

function fmt(n) { return n?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function pnlColor(n) { return n >= 0 ? 'text-emerald-400' : 'text-red-400'; }

export default function AccountOverview() {
  const { data, loading } = usePolling(api.account, 15000);
  if (loading || !data) return <div className="text-slate-500 text-sm">Loading account...</div>;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <StatCard
        label="Equity"
        value={`$${fmt(data.equity)}`}
        icon="💰"
      />
      <StatCard
        label="Total P&L"
        value={`$${fmt(data.pnl_from_start)}`}
        sub={`${data.pnl_pct >= 0 ? '+' : ''}${data.pnl_pct}%`}
        color={pnlColor(data.pnl_from_start)}
        icon="📊"
      />
      <StatCard
        label="Day P&L"
        value={`$${fmt(data.day_pnl)}`}
        sub={`${data.day_pnl_pct >= 0 ? '+' : ''}${data.day_pnl_pct}%`}
        color={pnlColor(data.day_pnl)}
        icon="📈"
      />
      <StatCard
        label="Cash"
        value={`$${fmt(data.cash)}`}
        sub={`BP: $${fmt(data.buying_power)}`}
        icon="💵"
      />
    </div>
  );
}
