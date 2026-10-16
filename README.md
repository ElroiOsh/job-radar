# RADAR — Job search agent for Elroi

Daily agent that shortlists manufacturing / Smart Manufacturing / engineering-management roles in Israel’s Center & Shfela, scores them against your profile, refreshes a local web dashboard, and can email you a digest at 09:00.

## Hybrid setup

| Layer | Role |
|--------|------|
| **This repo (Node)** | Fetch → score → `web/index.html` → email |
| **Small cloud host** (later) | Keep the dashboard online (Cloudflare Pages / GitHub Pages / Netlify) |
| **Cursor Automation** | Run `npm run daily` every morning + refine ranking notes |

## Quick start

```bash
npm install
copy .env.example .env
npm run demo
```

Open `web/index.html` in your browser.

## Configure

1. **Profile** — edit `profile.yaml` (roles, locations, keywords).
2. **Adzuna** — free keys at [developer.adzuna.com](https://developer.adzuna.com/) → put `ADZUNA_APP_ID` / `ADZUNA_APP_KEY` in `.env`.
3. **Email** — Gmail App Password in `SMTP_PASS` (with `SMTP_USER=elroiosh@gmail.com`).
4. **Public dashboard URL** (optional) — `WEB_DASHBOARD_URL` so the email links to the hosted page.

## Commands

| Command | What it does |
|---------|----------------|
| `npm run demo` | Sample jobs + dashboard (no API keys needed) |
| `npm run daily` | Score + web + email (board searches; Adzuna optional) |
| `npm run serve` | Local dashboard at http://localhost:8787 with feedback buttons |
| `npm run build-web` | Rebuild dashboard from last logic without refetch/email |

## Learning from your feedback

1. `npm run demo` (or `daily`) to refresh listings  
2. `npm run serve` → open http://localhost:8787  
3. On each job click **רלוונטי** or **לא רלוונטי**  
4. Saved to `data/feedback.json` and used on the next scoring run

## Boards (LinkedIn / AllJobs / Indeed / Drushim)

LinkedIn and Israeli boards do not offer a stable public jobs API. The dashboard includes **saved search links** (sort by past 24h) instead of brittle scraping. Adzuna aggregates many Israel listings for automated scoring.

## Target direction (from your brief)

- Smart Manufacturing / Industry 4.0 / Manufacturing Systems  
- Manufacturing Engineering with automation & data  
- Engineering / Manufacturing Manager  
- Advanced Manufacturing bridging R&D ↔ production  
- **Deprioritize** classic NPI / mechanical-design-only seats  

## Next steps

1. Run `npm run demo` and review the dashboard look & scoring.  
2. Add Adzuna + SMTP keys for real runs.  
3. Host `web/` on Pages and set `WEB_DASHBOARD_URL`.  
4. Add a Cursor Automation: daily 09:00 → `npm run daily`.  
