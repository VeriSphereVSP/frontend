# VeriSphere Frontend (Vite + React)

Minimal UI that:
- sends user input to the **App API** via `POST /api/interpret`
- renders assistant output and claim cards

## Dev run

```bash
cd frontend
npm install
npm run dev
```

The dev server proxies `/api/*` to `http://localhost:8070` (the **app** service).

## Backend dependency (app)

```bash
cd ~/verisphere/app
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8070
```

Then open: http://localhost:5173
