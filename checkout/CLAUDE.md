# Checkout Frontend — React 19 + Vite + TypeScript

## Stack
Stripe Elements + Tailwind CSS 4. HTTPS dev via `@vitejs/plugin-basic-ssl` (required for Apple Pay).

## Path Alias
`@` → `./src`

## Routing
Single route: `/c/:slug` — loads offer from `GET /api/offers/slug/:slug` (public).

## Context Providers
- `ThemeContext`: primary/button colors from offer config + contrast calculation
- `I18nContext`: translations (pt/en/fr) driven by **offer language**, not browser locale

## Checkout Flow
1. Load offer from `GET /api/offers/slug/{slug}`
2. Apply theme colors + language
3. Customer selects qty, order bumps, enters contact info + UTM params from URL
4. `POST /api/payments` → returns `clientSecret`
5. Confirm with Stripe Elements (card) or redirect (PIX)
6. On success → redirect to `upsellLink` or show success screen

## Payment Methods
Credit card, Apple Pay, Google Pay, PIX (Brazil) — all via Stripe Elements.

## i18n
Translations in `src/i18n/translations/` (pt.ts, en.ts, fr.ts) — type-safe.
Never hardcode user-facing strings; always use `t('key')` from `I18nContext`.

## Env Vars
`VITE_BACKEND_URL`, `VITE_STRIPE_PUBLIC_KEY`

## Build & Test (run after every code change)
```bash
cd checkout && npx vitest run && rtk npx tsc --noEmit && rtk npx vite build
```
Tests run first (unit tests via vitest), then type check, then build. If anything fails, fix before proceeding.
