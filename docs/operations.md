# Operations runbook

This document describes the production-oriented boundaries introduced during the
repository hardening work. It is intentionally provider-agnostic: real secrets,
model calls, and hosted infrastructure are supplied by the deployment system.

## Local production-like stack

1. Copy `backend/.env.production.example` to `backend/.env.production`.
2. Replace OAuth, JWT, cookie, AI gateway, and MongoDB credentials with local
   values. Keep `LANGSMITH_TRACING=false` unless a real LangSmith workspace is
   intentionally being used.
3. Start the stack with `docker compose up --build`.
4. Verify `http://localhost:8080` and the backend health endpoint exposed inside
   the compose network.

MongoDB and Redis use named volumes (`mongo_data` and `redis_data`). Backups and
retention are deployment responsibilities; do not delete these volumes during a
routine rollout.

## Required production dependencies

- MongoDB is the durable source of truth for users, sessions, units, notes,
  credits, billing events, and generation runs.
- Redis is required in production for shared API rate limiting. The server fails
  fast when `NODE_ENV=production` and `REDIS_URL` is missing.
- LangSmith is optional. Set `LANGSMITH_API_KEY`, `LANGSMITH_PROJECT`, and
  `LANGSMITH_TRACING=true` to enable tracing. Without those values, the admin
  endpoint returns a safe, empty `configured: false` summary and makes no
  provider request.

## LangSmith data boundary

LangSmith receives the traces configured by the LangChain runtime. The internal
admin endpoint is deliberately narrower than the LangSmith API: it returns run
identifiers, names, types, status, duration, token counts, and aggregate counts.
It does not serialize `inputs`, `outputs`, prompts, completions, raw error
messages, or metadata to the frontend. Keep the admin role list restricted to
trusted operators.

The dashboard is available at `/dashboard/admin/telemetry` and is protected in
two places:

1. the frontend hides the route from non-admin users for a clear UX;
2. the backend applies the `admin` role middleware before the route, which is the
   authoritative security boundary.

## Rollout and rollback

- Deploy the backend and frontend from the same merge commit so API and UI
  contracts stay aligned.
- Confirm the `Quality and tests` and `Container builds` checks before merging.
- Roll back by redeploying the previous immutable image or commit. Do not reset
  or rewrite the Git branch, and do not remove MongoDB or Redis volumes.
- If LangSmith is unavailable, set `LANGSMITH_TRACING=false` and keep the
  product running; telemetry is intentionally non-blocking for core learning
  flows.

## CI quality gates

The required CI workflow runs typechecks, frontend linting, backend and frontend
tests, workspace builds, a production dependency audit, and both container builds.
AI tests use deterministic doubles and do not require provider credentials.
