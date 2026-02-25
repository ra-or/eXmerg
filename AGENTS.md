# AGENTS.md

## Cursor Cloud specific instructions

**eXmerg** is a local web application for merging Excel/ODS files. It is an npm-workspaces monorepo with three packages: `client`, `server`, `shared`.

### Running the app

- `npm run dev` starts both client (Vite, port 3002) and server (Express, port 3004) concurrently.
- The Vite dev server proxies `/api` requests to the backend automatically.
- No database or external services are needed. No `.env` file or secrets are required.
- The `shared` package must be built before `server` or `client` can run; `npm run dev` handles this via the pre-built `shared/dist/` already checked in, but if `shared/dist/` is missing, run `npm run build --prefix shared` first.

### Testing

- `npm test` runs both client (vitest) and server (vitest) tests.
- Server tests: `npm run test --prefix server` (11 tests, all passing).
- Client tests: `npm run test:run --prefix client` (64 tests; 3 pre-existing failures in `shared-generateWorksheetName.test.ts` and `MergePage.test.tsx`).

### Building

- `npm run build` builds all three workspaces sequentially: shared → server → client.

### Notes

- The backend health endpoint is `GET /api/health` (returns `ok`).
- Uploaded files go to `<project-root>/uploads/` (auto-created). No persistent state or database.
- There is no ESLint or dedicated lint script configured in this project.
