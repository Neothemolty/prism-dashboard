# PRISM Dashboard

**P**ortfolio **R**isk & **I**ntelligence **S**ignal **M**anagement

Real-time trading dashboard for the Neo Quant system.

## Architecture

- **Backend:** FastAPI (Python) → Alpaca API, Polygon, PRISM data
- **Frontend:** React + Vite + Tailwind + Recharts
- **Database:** Alpaca API (cloud) + PRISM JSONL sync

## Local Development

```bash
# Backend
cd backend && pip install -r requirements.txt
cp .env.example .env  # Edit with your keys
uvicorn main:app --reload --port 8000

# Frontend
cd frontend && npm install
npm run dev  # → http://localhost:5173 (proxies /api to :8000)
```

## Deploy to Render

1. Push this directory to a GitHub repo
2. Connect to Render
3. Use `render.yaml` blueprint or create manually:
   - **Backend:** Python web service, `cd backend && uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Frontend:** Static site, build `cd frontend && npm install && npm run build`, publish `frontend/dist`
4. Set environment variables in Render dashboard

Built by Neo 🟢
