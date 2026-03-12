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
    """Current regime gate status — returns all index regimes + market conditions."""
    entries = read_jsonl("prism_regime_gate.jsonl")
    if not entries:
        return {"regime": "UNKNOWN", "message": "No regime data yet", "indices": []}
    
    # Find the primary (SPY) entry for top-level regime
    spy_entry = next((e for e in entries if e.get("ticker") == "SPY"), entries[-1])
    
    # Build rich response with all indices
    return {
        "regime": spy_entry.get("regime", "UNKNOWN"),
        "regime_score": spy_entry.get("regime_score", 0),
        "signal": spy_entry.get("signal", "WAIT"),
        "recommendation": spy_entry.get("recommendation", ""),
        "adx": spy_entry.get("adx", 0),
        "timestamp": spy_entry.get("timestamp", ""),
        "indices": entries
    }


@app.get("/api/prism/regime/detail")
async def get_regime_detail():
    """Institutional-grade regime intelligence for the dedicated regime page."""
    import statistics
    
    entries = read_jsonl("prism_regime_gate.jsonl")
    history = read_jsonl("prism_regime_history.jsonl")
    
    if not entries:
        return {"regime": "UNKNOWN", "indices": [], "history": [], "transitions": {}}
    
    spy_entry = next((e for e in entries if e.get("ticker") == "SPY"), entries[-1])
    regime = spy_entry.get("regime", "UNKNOWN")
    score = spy_entry.get("regime_score", 0)
    ma = spy_entry.get("ma_alignment", {})
    vol = spy_entry.get("volatility_regime", {})
    
    # ── Previous regime ──
    prev_regime = None
    regime_start = spy_entry.get("timestamp", "")
    if len(history) >= 2:
        for h in reversed(history[:-1]):
            if h.get("regime") != regime:
                prev_regime = h.get("regime")
                break
    
    # ── Markov transition probability matrix (empirical from history) ──
    all_regimes = ["BULL_TREND", "BULL_QUIET", "BULL_VOLATILE", "TRANSITION", "BEAR_QUIET", "BEAR_VOLATILE", "RISK_ON", "RISK_OFF"]
    transition_counts = {}
    for i in range(len(history) - 1):
        fr = history[i].get("regime", "UNKNOWN")
        to = history[i + 1].get("regime", "UNKNOWN")
        if fr not in transition_counts:
            transition_counts[fr] = {}
        transition_counts[fr][to] = transition_counts[fr].get(to, 0) + 1
    
    # Convert to probabilities
    transition_matrix = {}
    for fr, targets in transition_counts.items():
        total = sum(targets.values())
        if total > 0:
            transition_matrix[fr] = {to: round(cnt / total, 3) for to, cnt in sorted(targets.items(), key=lambda x: -x[1])}
    
    # If no history, use theoretical priors
    if regime not in transition_matrix:
        theoretical = {
            "BULL_TREND":    {"BULL_TREND": 0.60, "BULL_VOLATILE": 0.20, "TRANSITION": 0.15, "BEAR_QUIET": 0.05},
            "BULL_QUIET":    {"BULL_QUIET": 0.50, "BULL_TREND": 0.25, "TRANSITION": 0.20, "BULL_VOLATILE": 0.05},
            "BULL_VOLATILE": {"BULL_VOLATILE": 0.35, "TRANSITION": 0.30, "BULL_TREND": 0.20, "BEAR_VOLATILE": 0.15},
            "TRANSITION":    {"TRANSITION": 0.30, "BULL_QUIET": 0.20, "BEAR_QUIET": 0.20, "BULL_TREND": 0.15, "BEAR_VOLATILE": 0.15},
            "BEAR_QUIET":    {"BEAR_QUIET": 0.45, "BEAR_VOLATILE": 0.25, "TRANSITION": 0.25, "BULL_QUIET": 0.05},
            "BEAR_VOLATILE": {"BEAR_VOLATILE": 0.30, "BEAR_QUIET": 0.30, "TRANSITION": 0.30, "RISK_OFF": 0.10},
            "RISK_ON":       {"RISK_ON": 0.40, "BULL_TREND": 0.30, "BULL_VOLATILE": 0.20, "TRANSITION": 0.10},
            "RISK_OFF":      {"RISK_OFF": 0.25, "BEAR_VOLATILE": 0.35, "TRANSITION": 0.30, "BEAR_QUIET": 0.10},
        }
        transition_matrix[regime] = theoretical.get(regime, {"TRANSITION": 1.0})
    
    # ── Regime duration analysis ──
    regime_durations = {}  # regime -> list of durations in days
    if history:
        current_r = history[0].get("regime")
        start_t = history[0].get("timestamp", "")
        for h in history[1:]:
            if h.get("regime") != current_r:
                if start_t and h.get("timestamp"):
                    try:
                        d1 = datetime.fromisoformat(start_t.replace("Z", ""))
                        d2 = datetime.fromisoformat(h["timestamp"].replace("Z", ""))
                        days = max(1, (d2 - d1).days)
                        regime_durations.setdefault(current_r, []).append(days)
                    except Exception:
                        pass
                current_r = h.get("regime")
                start_t = h.get("timestamp", "")
    
    duration_stats = {}
    for r, durations in regime_durations.items():
        duration_stats[r] = {
            "avg_days": round(statistics.mean(durations), 1) if durations else 0,
            "max_days": max(durations) if durations else 0,
            "min_days": min(durations) if durations else 0,
            "occurrences": len(durations),
        }
    
    # Current regime age
    current_age_days = None
    if regime_start:
        try:
            rs = datetime.fromisoformat(regime_start.replace("Z", ""))
            current_age_days = max(1, (datetime.now() - rs).days)
        except Exception:
            current_age_days = 1
    
    # ── Factor exposure by regime (theoretical, quant-standard) ──
    factor_exposure = {
        "BULL_TREND":    {"momentum": 0.85, "value": 0.30, "quality": 0.50, "low_vol": -0.20, "size": 0.40, "carry": 0.60},
        "BULL_QUIET":    {"momentum": 0.60, "value": 0.50, "quality": 0.70, "low_vol": 0.40, "size": 0.30, "carry": 0.70},
        "BULL_VOLATILE": {"momentum": 0.40, "value": 0.20, "quality": 0.60, "low_vol": 0.10, "size": -0.10, "carry": 0.30},
        "TRANSITION":    {"momentum": -0.10, "value": 0.10, "quality": 0.40, "low_vol": 0.20, "size": -0.20, "carry": 0.00},
        "BEAR_QUIET":    {"momentum": -0.50, "value": 0.40, "quality": 0.60, "low_vol": 0.50, "size": -0.40, "carry": -0.20},
        "BEAR_VOLATILE": {"momentum": -0.80, "value": -0.30, "quality": 0.30, "low_vol": 0.20, "size": -0.60, "carry": -0.50},
        "RISK_ON":       {"momentum": 0.90, "value": 0.10, "quality": 0.20, "low_vol": -0.40, "size": 0.60, "carry": 0.80},
        "RISK_OFF":      {"momentum": -0.90, "value": -0.50, "quality": 0.50, "low_vol": 0.60, "size": -0.80, "carry": -0.70},
    }
    
    # ── Cross-asset correlation expectations ──
    correlation_regime = {
        "BULL_TREND":    {"spy_qqq": 0.92, "spy_tlt": -0.30, "spy_gld": -0.10, "spy_vix": -0.82, "vix_level": "12-16", "credit_spreads": "tight"},
        "BULL_QUIET":    {"spy_qqq": 0.90, "spy_tlt": -0.20, "spy_gld": -0.05, "spy_vix": -0.75, "vix_level": "10-14", "credit_spreads": "very tight"},
        "BULL_VOLATILE": {"spy_qqq": 0.88, "spy_tlt": -0.10, "spy_gld": 0.10, "spy_vix": -0.78, "vix_level": "18-25", "credit_spreads": "widening"},
        "TRANSITION":    {"spy_qqq": 0.85, "spy_tlt": 0.05, "spy_gld": 0.20, "spy_vix": -0.70, "vix_level": "16-22", "credit_spreads": "mixed"},
        "BEAR_QUIET":    {"spy_qqq": 0.88, "spy_tlt": 0.20, "spy_gld": 0.30, "spy_vix": -0.80, "vix_level": "20-28", "credit_spreads": "wide"},
        "BEAR_VOLATILE": {"spy_qqq": 0.93, "spy_tlt": 0.35, "spy_gld": 0.40, "spy_vix": -0.88, "vix_level": "28-45", "credit_spreads": "very wide"},
        "RISK_ON":       {"spy_qqq": 0.95, "spy_tlt": -0.40, "spy_gld": -0.20, "spy_vix": -0.85, "vix_level": "10-13", "credit_spreads": "minimal"},
        "RISK_OFF":      {"spy_qqq": 0.96, "spy_tlt": 0.50, "spy_gld": 0.55, "spy_vix": -0.92, "vix_level": "35-80", "credit_spreads": "blown out"},
    }
    
    # ── Risk metrics by regime ──
    risk_metrics = {
        "BULL_TREND":    {"expected_sharpe": 1.8, "max_dd_pct": -8, "daily_var_95": -1.2, "daily_cvar_95": -1.8, "position_limit_pct": 100, "leverage_max": 2.0, "kelly_fraction": 0.40},
        "BULL_QUIET":    {"expected_sharpe": 1.5, "max_dd_pct": -5, "daily_var_95": -0.8, "daily_cvar_95": -1.2, "position_limit_pct": 80, "leverage_max": 1.5, "kelly_fraction": 0.35},
        "BULL_VOLATILE": {"expected_sharpe": 0.8, "max_dd_pct": -15, "daily_var_95": -2.0, "daily_cvar_95": -3.2, "position_limit_pct": 60, "leverage_max": 1.0, "kelly_fraction": 0.20},
        "TRANSITION":    {"expected_sharpe": 0.2, "max_dd_pct": -12, "daily_var_95": -1.5, "daily_cvar_95": -2.5, "position_limit_pct": 40, "leverage_max": 0.8, "kelly_fraction": 0.10},
        "BEAR_QUIET":    {"expected_sharpe": -0.3, "max_dd_pct": -20, "daily_var_95": -1.8, "daily_cvar_95": -2.8, "position_limit_pct": 30, "leverage_max": 0.5, "kelly_fraction": 0.05},
        "BEAR_VOLATILE": {"expected_sharpe": -1.0, "max_dd_pct": -35, "daily_var_95": -3.5, "daily_cvar_95": -5.5, "position_limit_pct": 20, "leverage_max": 0.3, "kelly_fraction": 0.02},
        "RISK_ON":       {"expected_sharpe": 2.2, "max_dd_pct": -6, "daily_var_95": -1.0, "daily_cvar_95": -1.5, "position_limit_pct": 100, "leverage_max": 2.5, "kelly_fraction": 0.50},
        "RISK_OFF":      {"expected_sharpe": -2.0, "max_dd_pct": -50, "daily_var_95": -5.0, "daily_cvar_95": -8.0, "position_limit_pct": 10, "leverage_max": 0.0, "kelly_fraction": 0.00},
    }
    
    # ── Optimal allocation by regime ──
    allocation = {
        "BULL_TREND":    {"equities": 70, "bonds": 5, "gold": 5, "cash": 5, "options": 10, "alternatives": 5},
        "BULL_QUIET":    {"equities": 60, "bonds": 10, "gold": 5, "cash": 10, "options": 10, "alternatives": 5},
        "BULL_VOLATILE": {"equities": 40, "bonds": 10, "gold": 10, "cash": 20, "options": 15, "alternatives": 5},
        "TRANSITION":    {"equities": 25, "bonds": 15, "gold": 15, "cash": 30, "options": 10, "alternatives": 5},
        "BEAR_QUIET":    {"equities": 10, "bonds": 25, "gold": 20, "cash": 30, "options": 10, "alternatives": 5},
        "BEAR_VOLATILE": {"equities": 5, "bonds": 15, "gold": 25, "cash": 35, "options": 15, "alternatives": 5},
        "RISK_ON":       {"equities": 80, "bonds": 0, "gold": 0, "cash": 5, "options": 10, "alternatives": 5},
        "RISK_OFF":      {"equities": 0, "bonds": 10, "gold": 30, "cash": 50, "options": 5, "alternatives": 5},
    }
    
    # ── Triggers to watch ──
    triggers = {
        "BULL_TREND":    [
            {"condition": "VIX > 25 for 3+ days", "outcome": "→ BULL_VOLATILE", "severity": "warning"},
            {"condition": "SPY breaks below SMA50", "outcome": "→ TRANSITION", "severity": "danger"},
            {"condition": "Weekly MACD bearish cross", "outcome": "→ TRANSITION", "severity": "danger"},
            {"condition": "Yield curve re-inverts", "outcome": "→ TRANSITION", "severity": "warning"},
        ],
        "TRANSITION":    [
            {"condition": "SPY reclaims SMA50 + holds 3 days", "outcome": "→ BULL_QUIET", "severity": "bullish"},
            {"condition": "SPY breaks SMA200", "outcome": "→ BEAR_QUIET", "severity": "danger"},
            {"condition": "VIX drops below 18", "outcome": "→ BULL_QUIET", "severity": "bullish"},
            {"condition": "VIX spikes above 30", "outcome": "→ BEAR_VOLATILE", "severity": "danger"},
            {"condition": "Credit spreads widen >100bps", "outcome": "→ BEAR_VOLATILE", "severity": "danger"},
            {"condition": "Breadth >70% above SMA50", "outcome": "→ BULL_TREND", "severity": "bullish"},
        ],
        "BULL_VOLATILE": [
            {"condition": "VIX mean-reverts below 18", "outcome": "→ BULL_TREND", "severity": "bullish"},
            {"condition": "Failed rally at SMA50", "outcome": "→ TRANSITION", "severity": "warning"},
            {"condition": "Earnings miss from mega-cap", "outcome": "→ BEAR_VOLATILE", "severity": "danger"},
        ],
        "BEAR_QUIET":    [
            {"condition": "Capitulation volume spike", "outcome": "→ BEAR_VOLATILE", "severity": "danger"},
            {"condition": "Fed signals rate cuts", "outcome": "→ TRANSITION", "severity": "bullish"},
            {"condition": "Credit spreads normalize", "outcome": "→ TRANSITION", "severity": "bullish"},
        ],
        "BEAR_VOLATILE": [
            {"condition": "VIX exhaustion >40 + reversal", "outcome": "→ BEAR_QUIET", "severity": "warning"},
            {"condition": "Weekly RSI <25 (extreme oversold)", "outcome": "→ TRANSITION", "severity": "bullish"},
            {"condition": "Emergency Fed action", "outcome": "→ TRANSITION", "severity": "bullish"},
            {"condition": "Margin call cascade", "outcome": "→ RISK_OFF", "severity": "danger"},
        ],
        "RISK_ON":       [
            {"condition": "Euphoria indicators peak", "outcome": "→ BULL_VOLATILE", "severity": "warning"},
            {"condition": "Weekly RSI >80", "outcome": "→ BULL_VOLATILE", "severity": "warning"},
        ],
        "RISK_OFF":      [
            {"condition": "Central bank intervention", "outcome": "→ BEAR_VOLATILE", "severity": "bullish"},
            {"condition": "Geopolitical de-escalation", "outcome": "→ TRANSITION", "severity": "bullish"},
        ],
        "BULL_QUIET":    [
            {"condition": "Breakout on volume", "outcome": "→ BULL_TREND", "severity": "bullish"},
            {"condition": "Low-vol compression resolves down", "outcome": "→ TRANSITION", "severity": "warning"},
        ],
    }
    
    # ── Strategy playbook ──
    playbook = {
        "BULL_TREND":    {
            "stance": "Full Offense", "position_size": "80-100%", "risk": "LOW",
            "strategies": ["Momentum longs", "Breakout entries", "Trail stops wide (2-3 ATR)", "Scale into winners"],
            "avoid": ["Shorting", "Mean-reversion", "Profit-taking too early", "Hedging (waste of premium)"],
            "instruments": ["Long equities", "Call spreads", "Short puts (income)", "Leveraged ETFs"],
        },
        "BULL_QUIET":    {
            "stance": "Accumulate", "position_size": "60-80%", "risk": "LOW",
            "strategies": ["Buy dips to SMA20", "Sell puts for income", "Sector rotation into laggards", "Calendar spreads"],
            "avoid": ["Chasing extended names", "Paying up for vol", "Overconcentration"],
            "instruments": ["Long equities", "Short puts", "Iron condors", "Dividend stocks"],
        },
        "BULL_VOLATILE": {
            "stance": "Selective Offense", "position_size": "40-60%", "risk": "MEDIUM",
            "strategies": ["Buy sharp dips only", "Tighter stops (1-1.5 ATR)", "Reduce on rips", "Pair trades"],
            "avoid": ["Full position sizes", "Overnight holds in small caps", "Selling naked puts"],
            "instruments": ["Long equities (selective)", "Put spreads for hedge", "Collars", "Straddles on earnings"],
        },
        "TRANSITION":    {
            "stance": "Neutral / Hedged", "position_size": "30-50%", "risk": "ELEVATED",
            "strategies": ["Reduce exposure systematically", "Hedge with put spreads", "Wait for clarity", "Pairs: long defensives / short cyclicals"],
            "avoid": ["New directional bets", "Conviction trades", "Adding to losers", "Fighting the tape"],
            "instruments": ["Put spreads", "Gold/GLD", "Short-term bonds/TLT", "Cash", "VIX calls (tail hedge)"],
        },
        "BEAR_QUIET":    {
            "stance": "Defensive", "position_size": "20-30%", "risk": "HIGH",
            "strategies": ["Short rallies to resistance", "Put spreads on weak names", "Long gold/bonds", "Dollar-cost-average quality"],
            "avoid": ["Buying dips aggressively", "Bottom-fishing", "Selling puts", "Leveraged longs"],
            "instruments": ["Put spreads", "Short ETFs (SH, PSQ)", "Gold", "Treasuries", "Cash heavy"],
        },
        "BEAR_VOLATILE": {
            "stance": "Maximum Defense", "position_size": "10-20%", "risk": "VERY HIGH",
            "strategies": ["Cash is king", "Deep OTM puts for tail", "VIX calls", "Only safe havens"],
            "avoid": ["ANY equity longs except gold/defense", "Averaging down", "Selling vol", "Hero trades"],
            "instruments": ["Cash", "Gold", "VIX calls", "Put spreads", "T-bills"],
        },
        "RISK_ON":       {
            "stance": "Full Risk", "position_size": "80-100%", "risk": "LOW",
            "strategies": ["Leverage longs", "Aggressive breakouts", "Sell puts aggressively", "Ride momentum"],
            "avoid": ["Hedges (premium waste)", "Defensives", "Cash drag"],
            "instruments": ["Leveraged ETFs", "Call options", "Short puts", "Growth/momentum names"],
        },
        "RISK_OFF":      {
            "stance": "Bunker Mode", "position_size": "0-10%", "risk": "EXTREME",
            "strategies": ["Preserve capital above all else", "Gold and T-bills only", "Wait for central bank signal"],
            "avoid": ["ALL equity exposure", "Credit", "Emerging markets", "Anything illiquid"],
            "instruments": ["Cash", "Gold", "T-bills", "USD"],
        },
    }
    
    # ── Regime scoring components breakdown ──
    scoring_components = {
        "ma_alignment": {"value": ma.get("score", 0), "weight": 0.30, "description": "Price vs SMA20/50/200 alignment"},
        "adx_trend": {"value": spy_entry.get("adx", 0), "weight": 0.20, "description": "ADX trend strength (>25 trending, >40 strong)"},
        "volatility": {"value": vol.get("ratio", 1.0), "weight": 0.20, "description": "Short-term vs long-term vol ratio"},
        "trend_slope": {"value": spy_entry.get("trend_slope", ma.get("score", 0) / 100), "weight": 0.15, "description": "SMA50 slope direction and magnitude"},
        "breadth": {"value": 0, "weight": 0.15, "description": "Market breadth (% stocks above SMA50)"},
    }
    
    return {
        "regime": regime,
        "regime_score": score,
        "signal": spy_entry.get("signal", "WAIT"),
        "adx": spy_entry.get("adx", 0),
        "recommendation": spy_entry.get("recommendation", ""),
        "timestamp": spy_entry.get("timestamp", ""),
        "previous_regime": prev_regime,
        "current_age_days": current_age_days,
        "indices": entries,
        "history": history[-60:],
        "transition_matrix": transition_matrix.get(regime, {}),
        "full_transition_matrix": transition_matrix,
        "duration_stats": duration_stats,
        "factor_exposure": factor_exposure.get(regime, {}),
        "all_factor_exposure": factor_exposure,
        "correlations": correlation_regime.get(regime, {}),
        "risk_metrics": risk_metrics.get(regime, {}),
        "all_risk_metrics": risk_metrics,
        "allocation": allocation.get(regime, {}),
        "triggers": triggers.get(regime, []),
        "playbook": playbook.get(regime, {}),
        "scoring_components": scoring_components,
        "ma_alignment": ma,
        "volatility_regime": vol,
    }


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
