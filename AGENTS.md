# AGENTS.md

## Cursor Cloud specific instructions

**eXmerg** is a local web application for merging Excel/ODS files. It is an npm-workspaces monorepo with three packages: `client`, `server`, `shared`.

### Running the app

- `npm run dev` starts both client (Vite, port 3002) and server (Express, port 3004) concurrently.
- The Vite dev server proxies `/api` requests to the backend automatically.
- No database or external services are needed. No `.env` file or secrets are required.
- The `shared` package must be built before `server` or `client` can run; `npm run dev` handles this via the pre-built `shared/dist/` already checked in, but if `shared/dist/` is missing, run `npm run build --prefix shared` first.

### Testing

- `npm test` runs both client (vitest) and server (vitest) unit tests (75 total).
- `npm run test:e2e` runs Playwright E2E tests (requires `npx playwright install chromium` once).
- E2E tests use fixture files in `e2e/fixtures/files/`; the dev servers must be running or Playwright starts them automatically via `webServer` config.

### Linting & Formatting

- `npm run lint` runs ESLint (flat config in `eslint.config.mjs`).
- `npm run format:check` / `npm run format` checks/applies Prettier formatting.
- Lint currently produces warnings only (0 errors): `react-hooks/exhaustive-deps`, `react-refresh/only-export-components`, `@typescript-eslint/no-explicit-any` (ExcelJS workarounds).

### Building

- `npm run build` builds all three workspaces sequentially: shared → server → client.

### Notes

- The backend health endpoint is `GET /api/health` (returns `ok`).
- Uploaded files go to `<project-root>/uploads/` (auto-created). No persistent state or database.
- The `xlsx` (SheetJS) dependency has a known prototype-pollution vulnerability with no available fix; this is a known limitation.
