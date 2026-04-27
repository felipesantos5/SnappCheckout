# Checkout Platform — Monorepo

Multi-vendor checkout/payment platform. Three apps: `backend/`, `admin/`, `checkout/`.
Each folder has its own `CLAUDE.md` with specific architecture details.

## Stack
- **backend**: Express 5 + TypeScript + MongoDB + Stripe + Cloudinary
- **admin**: React 19 + Vite + TypeScript + Radix UI + Tailwind 4
- **checkout**: React 19 + Vite + TypeScript + Stripe Elements + Tailwind 4

## Dev Commands
```bash
cd backend && npm run dev   # ts-node-dev, port 4242
cd admin && npm run dev     # Vite dev server
cd checkout && npm run dev  # Vite + HTTPS (needed for Stripe/Apple Pay)
```

## Core Business Rules (never violate)
- Products **embedded** in Offers — never create separate Product docs for offers
- Sale records created **only** by Stripe webhooks — never in payment controller
- Payment amounts calculated **server-side** — never trust client values
- Platform fee: **5%** application fee on every transaction
- Webhook route requires `express.raw()` — must come before `express.json()`

## API Routes (all `/api/*`)
| Route | Access |
|---|---|
| `GET /offers/slug/:slug` | Public |
| `POST /payments` | Public |
| `POST /webhooks/stripe` | Public (raw body) |
| `POST /payments/upsell-token` | Public |
| `POST /payments/one-click-upsell` | Public (token auth) |
| `POST /payments/upsell-refuse` | Public (token auth) |
| `/auth`, `/offers`, `/stripe`, `/sales`, `/upload` | Protected (JWT) |
