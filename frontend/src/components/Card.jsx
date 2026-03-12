export function Card({ title, children, className = '', icon }) {
  return (
    <div className={`bg-[#1a2332] border border-[#1e2d3d] rounded-xl p-5 ${className}`}>
      {title && (
        <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
          {icon && <span>{icon}</span>}
          {title}
        </h3>
      )}
      {children}
    </div>
  );
}

export function StatCard({ label, value, sub, color = 'text-white', icon }) {
  return (
    <Card>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wider">{label}</p>
          <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
          {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
        </div>
        {icon && <span className="text-2xl opacity-50">{icon}</span>}
      </div>
    </Card>
  );
}
