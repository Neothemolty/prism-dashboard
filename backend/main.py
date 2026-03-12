"""
PRISM Dashboard — Backend API
FastAPI server providing real-time trading data.
"""

import os
import json
import httpx
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

# ── Config ──────────────────────────────────────────────
ALPACA_KEY = os.getenv("ALPACA_KEY", "")
ALPACA_SECRET = os.getenv("ALPACA_SECRET", "")
ALPACA_BASE = os.getenv("ALPACA_BASE_URL", "https://paper-api.alpaca.markets/v2")
POLYGON_KEY = os.getenv("POLYGON_API_KEY", "")
PRISM_DIR = os.getenv("PRISM_DATA_DIR", "")
DATABASE_URL = os.getenv("DATABASE_URL", "")

ALPACA_HEADERS = {
    "APCA-API-KEY-ID": ALPACA_KEY,
    "APCA-API-SECRET-KEY": ALPACA_SECRET,
}

# ── App ─────────────────────────────────────────────────
app = FastAPI(title="PRISM Dashboard API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Helpers ─────────────────────────────────────────────

async def alpaca_get(path: str):
    async with httpx.AsyncClient() as client:
        r = await client.get(f"{ALPACA_BASE}{path}", headers=ALPACA_HEADERS, timeout=10)
        r.raise_for_status()
        return r.json()


_in_memory_store = {}  # For cloud deployment where local files aren't available

def read_jsonl(filename: str) -> List[dict]:
    # Try local file first
    path = os.path.join(PRISM_DIR, filename) if PRISM_DIR else filename
    if os.path.exists(path):
        entries = []
        with open(path) as f:
            for line in f:
                if line.strip():
                    try:
                        entries.append(json.loads(line))
                    except json.JSONDecodeError:
                        continue
        return entries
    # Fall back to in-memory store (populated via /api/sync)
    return _in_memory_store.get(filename, [])


def db_query(sql: str, params=None) -> List[dict]:
    """Query local PostgreSQL."""
    if not DATABASE_URL:
        return []
    import psycopg2
    import psycopg2.extras
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(sql, params or ())
        rows = [dict(r) for r in cur.fetchall()]
        cur.close()
        conn.close()
        return rows
    except Exception as e:
        print(f"DB error: {e}")
        return []


# ── Routes ──────────────────────────────────────────────

@app.get("/")
async def root():
    return {"name": "PRISM Dashboard API", "version": "1.0.0", "status": "online"}


# ── Account & Portfolio ─────────────────────────────────

@app.get("/api/account")
async def get_account():
    """Alpaca account summary."""
    data = await alpaca_get("/account")
    return {
        "equity": float(data["equity"]),
        "cash": float(data["cash"]),
        "buying_power": float(data["buying_power"]),
        "portfolio_value": float(data["portfolio_value"]),
        "pnl_from_start": round(float(data["equity"]) - 100000, 2),
        "pnl_pct": round((float(data["equity"]) - 100000) / 100000 * 100, 2),
        "last_equity": float(data["last_equity"]),
        "day_pnl": round(float(data["equity"]) - float(data["last_equity"]), 2),
        "day_pnl_pct": round(
            (float(data["equity"]) - float(data["last_equity"])) / float(data["last_equity"]) * 100, 3
        ),
    }


@app.get("/api/positions")
async def get_positions():
    """Current open positions with P&L."""
    positions = await alpaca_get("/positions")
    result = []
    total_unrealized = 0
    total_market_value = 0

    for p in positions:
        upl = float(p["unrealized_pl"])
        mv = abs(float(p["market_value"]))
        total_unrealized += upl
        total_market_value += mv

        result.append({
            "symbol": p["symbol"],
            "side": p["side"],
            "qty": int(p["qty"]),
            "avg_entry": float(p["avg_entry_price"]),
            "current_price": float(p["current_price"]),
            "market_value": float(p["market_value"]),
            "unrealized_pl": upl,
            "unrealized_plpc": round(float(p["unrealized_plpc"]) * 100, 2),
            "asset_class": p.get("asset_class", "us_equity"),
        })

    result.sort(key=lambda x: x["unrealized_pl"], reverse=True)
    return {
        "positions": result,
        "total_unrealized": round(total_unrealized, 2),
        "total_market_value": round(total_market_value, 2),
        "count": len(result),
    }


@app.get("/api/orders")
async def get_orders(status: str = "all", limit: int = 50):
    """Recent orders."""
    orders = await alpaca_get(f"/orders?status={status}&limit={limit}")
    result = []
    for o in orders:
        result.append({
            "id": o["id"],
            "symbol": o["symbol"],
            "side": o["side"],
            "type": o["type"],
            "qty": o.get("qty"),
            "filled_qty": o.get("filled_qty"),
            "status": o["status"],
            "filled_avg_price": o.get("filled_avg_price"),
            "created_at": o["created_at"],
            "filled_at": o.get("filled_at"),
        })
    return {"orders": result, "count": len(result)}


# ── PRISM Components ────────────────────────────────────

@app.get("/api/prism/regime")
async def get_regime():
    """Current regime gate status."""
    entries = read_jsonl("prism_regime_gate.jsonl")
    if not entries:
        return {"regime": "UNKNOWN", "message": "No regime data yet"}
    latest = entries[-1]
    return latest


@app.get("/api/prism/signals")
async def get_signals(limit: int = 50):
    """Signal log entries."""
    entries = read_jsonl("prism_signal_log.jsonl")
    return {"signals": entries[-limit:], "total": len(entries)}


@app.get("/api/prism/decomposition")
async def get_decomposition():
    """P&L decomposition history."""
    entries = read_jsonl("prism_pnl_decomposition.jsonl")
    if not entries:
        return {"decompositions": [], "summary": {}}

    # Aggregate
    n = len(entries)
    import statistics
    market_avg = statistics.mean(e.get("market_pct", 0) for e in entries) if entries else 0
    sector_avg = statistics.mean(e.get("sector_pct", 0) for e in entries) if entries else 0
    idio_avg = statistics.mean(e.get("idiosyncratic_pct", 0) for e in entries) if entries else 0
    timing_avg = statistics.mean(e.get("timing_pct", 0) for e in entries) if entries else 0

    return {
        "decompositions": entries,
        "summary": {
            "trades": n,
            "market_avg_pct": round(market_avg * 100, 2),
            "sector_avg_pct": round(sector_avg * 100, 2),
            "idiosyncratic_avg_pct": round(idio_avg * 100, 2),
            "timing_avg_pct": round(timing_avg * 100, 2),
        },
    }


@app.get("/api/prism/engine-accuracy")
async def get_engine_accuracy():
    """Engine accuracy from signal log (P(win|engine aligned))."""
    entries = read_jsonl("prism_signal_log.jsonl")
    closed = [e for e in entries if e.get("exit_price") is not None]
    if not closed:
        return {"engines": {}, "message": "No closed trades with signal data yet"}

    from collections import defaultdict
    stats = defaultdict(lambda: {"aligned_win": 0, "aligned_loss": 0, "opposed_win": 0, "opposed_loss": 0})

    for trade in closed:
        pnl = trade.get("realized_pnl", 0)
        won = pnl > 0
        direction = trade.get("direction", "long")
        for engine, score in trade.get("engine_scores", {}).items():
            aligned = (direction == "long" and score > 15) or (direction == "short" and score < -15)
            opposed = (direction == "long" and score < -15) or (direction == "short" and score > 15)
            if aligned:
                stats[engine]["aligned_win" if won else "aligned_loss"] += 1
            elif opposed:
                stats[engine]["opposed_win" if won else "opposed_loss"] += 1

    results = {}
    for eng, s in stats.items():
        total_aligned = s["aligned_win"] + s["aligned_loss"]
        results[eng] = {
            "accuracy": round(s["aligned_win"] / total_aligned * 100, 1) if total_aligned > 0 else None,
            "aligned_trades": total_aligned,
            "win": s["aligned_win"],
            "loss": s["aligned_loss"],
        }

    return {"engines": dict(sorted(results.items(), key=lambda x: x[1]["accuracy"] or 0, reverse=True))}


# ── Market Data ─────────────────────────────────────────

@app.get("/api/market/snapshot")
async def get_market_snapshot():
    """Current market overview (SPY, QQQ, VIX, GLD)."""
    tickers = "SPY,QQQ,GLD,UVXY"
    async with httpx.AsyncClient() as client:
        r = await client.get(
            f"https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers?tickers={tickers}&apiKey={POLYGON_KEY}",
            timeout=10,
        )
        if r.status_code != 200:
            return {"error": "Polygon API error", "status": r.status_code}
        data = r.json()

    results = {}
    for t in data.get("tickers", []):
        ticker = t["ticker"]
        day = t.get("day", {})
        prev = t.get("prevDay", {})
        results[ticker] = {
            "price": day.get("c") or prev.get("c", 0),
            "change_pct": round(t.get("todaysChangePerc", 0), 2),
            "volume": day.get("v", 0),
        }
    return results


# ── Trade History from DB ───────────────────────────────

@app.get("/api/trades/history")
async def get_trade_history(limit: int = 100):
    """Trade journal from PostgreSQL."""
    rows = db_query(
        "SELECT * FROM trade_journal ORDER BY entry_time DESC LIMIT %s", (limit,)
    )
    # Convert datetime objects to strings
    for r in rows:
        for k, v in r.items():
            if isinstance(v, datetime):
                r[k] = v.isoformat()
    return {"trades": rows, "count": len(rows)}


@app.get("/api/trades/fills")
async def get_fills(limit: int = 100):
    """Recent fills from Alpaca."""
    data = await alpaca_get(f"/account/activities/FILL?page_size={limit}")
    fills = []
    for f in data:
        fills.append({
            "symbol": f["symbol"],
            "side": f["side"],
            "qty": int(f["qty"]),
            "price": float(f["price"]),
            "time": f["transaction_time"],
        })
    return {"fills": fills, "count": len(fills)}


# ── Equity Curve ────────────────────────────────────────

@app.get("/api/equity-curve")
async def get_equity_curve():
    """Portfolio history from Alpaca."""
    async with httpx.AsyncClient() as client:
        r = await client.get(
            f"{ALPACA_BASE}/account/portfolio/history?period=1M&timeframe=1D",
            headers=ALPACA_HEADERS,
            timeout=10,
        )
        if r.status_code != 200:
            return {"error": "Could not fetch equity curve"}
        data = r.json()

    timestamps = data.get("timestamp", [])
    equity = data.get("equity", [])
    pnl = data.get("profit_loss", [])

    curve = []
    for i, ts in enumerate(timestamps):
        curve.append({
            "date": datetime.fromtimestamp(ts).strftime("%Y-%m-%d"),
            "equity": equity[i] if i < len(equity) else None,
            "pnl": pnl[i] if i < len(pnl) else None,
        })
    return {"curve": curve}


# ── Health ──────────────────────────────────────────────

# ── Sync Endpoint (for cloud deployment) ────────────────

@app.post("/api/sync/{filename}")
async def sync_data(filename: str, data: List[dict]):
    """Receive PRISM data from local sync script."""
    _in_memory_store[filename] = data
    return {"status": "ok", "filename": filename, "entries": len(data)}


# ── Health ──────────────────────────────────────────────

@app.get("/api/health")
async def health():
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "alpaca_configured": bool(ALPACA_KEY),
        "polygon_configured": bool(POLYGON_KEY),
        "prism_data_dir": PRISM_DIR,
        "db_configured": bool(DATABASE_URL),
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
