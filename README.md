# API Aberta — SNS Transparência Connector

Microservice that fetches and serves curated monthly datasets from the
[Portal da Transparência SNS](https://transparencia.sns.gov.pt).

**Fonte: Portal da Transparência SNS**

## Features

- Urgências by type and Manchester triage
- Surgery waiting list (LIC) within TMRG (270 and 180 days)
- Hospital and primary-care consultations
- Workforce by professional group
- National monthly totals with percentages recomputed from numerators, never averaged

Real-time ER waiting times are out of scope (they come from tempos.min-saude.pt).

## Endpoints

- `GET /health` — Service health check
- `GET /sns/meta` — Service metadata
- `GET /sns/datasets` — Curated datasets and sync state
- `GET /sns/:dataset` — Monthly records (`entidade`, `regiao`, `desde`, `ate`, `limit`, `offset`, `sort`)
- `GET /sns/:dataset/latest` — Latest period for every entity
- `GET /sns/:dataset/national` — Monthly national totals
- `GET /sns/entidades` — Institutions (`q`, `regiao`, `near=lat,lon`, `radius`)
- `GET /sns/entidades/:slug` — One entity plus the latest month of every dataset

`:dataset` keys: `urgencias`, `urgencias_triagem`, `cirurgia_tmrg`, `cirurgia_tmrg_onco`, `consultas_hospitalares`, `consultas_tmrg`, `consultas_csp`, `rh`.

Each dataset links back to `https://transparencia.sns.gov.pt/explore/dataset/<id>/`.

## Setup

```bash
npm install
cp .env.example .env
npm start
```

Ingest runs daily at `20 6 * * *` (06:20 UTC) and on startup if the database has never been synced.

## Data Source

Opendatasoft Explore API v2.1 at `https://transparencia.sns.gov.pt/api/explore/v2.1/`. Publisher DE-SNS. License metadata is null. Attribution: **Fonte: Portal da Transparência SNS**.

## License

MIT
