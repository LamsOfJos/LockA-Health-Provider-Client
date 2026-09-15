# LockA Provider Client

Provider-facing dashboard for the [LockA Medical Passport](https://github.com/LockA-Medical-Passport/LockA-Documentation) platform. Lets hospitals, clinics, labs, pharmacies, and insurers request patient-consented access, view approved medical records, and upload treatment notes, prescriptions, and lab results.

## Stack

- React + TypeScript (Vite, no SSR)
- Tailwind CSS v4
- React Router
- `@stellar/freighter-api` for Stellar wallet auth

## Getting started

```bash
npm install
npm run dev
```

Requires the [Freighter](https://www.freighter.app/) browser extension to connect a Stellar wallet.

## Testing

Tests run on [Vitest](https://vitest.dev/) + [React Testing Library](https://testing-library.com/react), with `jsdom` as the DOM environment.

```bash
npm test             # run the full suite once
npm run test:watch   # watch mode for local development
npm run test:coverage  # run with a v8 coverage report (text + html + lcov)
```

Test files live next to the code they cover (`*.test.ts` / `*.test.tsx`). Shared setup (currently just `@testing-library/jest-dom` matchers) lives in `src/test/setup.ts` and is wired in via `vite.config.ts`'s `test.setupFiles`.

### End-to-end tests (Playwright)

Cross-page flows are covered by [Playwright](https://playwright.dev/) in `e2e/`, configured in `playwright.config.ts`.

```bash
npx playwright install --with-deps chromium  # one-time browser install
npm run test:e2e                             # run the full E2E suite headless
npx playwright test --ui                     # interactive UI mode for local debugging
```

The Playwright config points `webServer` at the Vite dev server (auto-started on a dedicated port for the test run, reused locally if already running) — no separate build/preview step is required.

Since there's no real Freighter browser extension available in CI or headless runs, `e2e/fixtures/freighter.ts` exports `mockFreighter(page, options)`, which stubs the extension's `window.postMessage` bridge (the same `FREIGHTER_EXTERNAL_MSG_REQUEST`/`RESPONSE` envelope the real extension's content script answers) via `page.addInitScript`. Call it before `page.goto(...)` in any spec:

```ts
import { test, expect } from '@playwright/test';
import { mockFreighter } from './fixtures/freighter';

test('connects a mocked wallet', async ({ page }) => {
  await mockFreighter(page); // installed, not yet approved — "Connect Wallet" performs the approval
  await page.goto('/');
  await page.getByRole('button', { name: 'Connect Wallet' }).click();
  // ...
});
```

Pass `{ installed: false }` to simulate no extension present, or `{ preApproved: true }` to start already connected. See `e2e/wallet-gate.spec.ts` and `e2e/provider-happy-path.spec.ts` for working examples.

## Data layer

`src/lib/api.ts` is a mock implementation of the documented `locka-api` provider endpoints (`GET /providers/{id}`, `POST /access-requests`, `GET /records`, `DELETE /access-grants/{id}`, `GET /audit-log`, etc.), backed by in-memory fixtures in `src/lib/mockData.ts`. Every function's signature mirrors the real endpoint shape, so swapping in real `fetch` calls against a live backend is a drop-in replacement — no component changes needed.

## Structure

```
src/
  components/   shared UI (Navbar, GlassCard, Badge, Toast, Modal, ...)
  hooks/        useWallet (Freighter connect/disconnect)
  lib/          types, mock API client, mock data, formatting helpers
  pages/        Dashboard, PatientSearch, RecordsPage, AccessManagement, AuditLog, ProviderProfile
  test/         shared test setup (jest-dom matchers)
e2e/            Playwright end-to-end specs + fixtures (Freighter mock)
```
