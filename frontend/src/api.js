const BASE = import.meta.env.VITE_API_URL || '';

async function fetchJSON(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export const api = {
  account:        () => fetchJSON('/api/account'),
  positions:      () => fetchJSON('/api/positions'),
  orders:         (limit = 50) => fetchJSON(`/api/orders?limit=${limit}`),
  equityCurve:    () => fetchJSON('/api/equity-curve'),
  regime:         () => fetchJSON('/api/prism/regime'),
  signals:        (limit = 50) => fetchJSON(`/api/prism/signals?limit=${limit}`),
  decomposition:  () => fetchJSON('/api/prism/decomposition'),
  engineAccuracy: () => fetchJSON('/api/prism/engine-accuracy'),
  marketSnapshot: () => fetchJSON('/api/market/snapshot'),
  fills:          (limit = 100) => fetchJSON(`/api/trades/fills?limit=${limit}`),
  regimeDetail:   () => fetchJSON('/api/prism/regime/detail'),
  health:         () => fetchJSON('/api/health'),
};
