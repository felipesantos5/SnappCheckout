# Backend — Express 5 + TypeScript + MongoDB

## Folder Structure
```
src/
  controllers/   # request/response handling
  services/      # business logic & DB operations
  models/        # Mongoose models
  routes/        # route definitions
  middleware/    # auth, upload, error
  webhooks/      # stripe/ pagarme/
  helper/        # getUpsellSteps.ts, etc.
```

## Auth
JWT 7-day, Bearer token. `protectRoute` middleware injects `req.userId`.
```typescript
import { protectRoute } from '../middleware/auth.middleware';
router.post('/route', protectRoute, handler);
```

## Models
- **User**: `stripeAccountId`, `stripeOnboardingComplete`
- **Offer**: embedded `mainProduct` + `orderBumps[]`, nanoid 16-char `slug`
- **Sale**: webhook-only creation (`stripePaymentIntentId`, `ownerId`, `offerId`)
- **UpsellSession**: TTL 30min — `token`, `customerId`, `paymentMethodId`, `currentStepIndex`

## Embedded Products Pattern
```typescript
// Modify products within the Offer document
offer.mainProduct = { name, description, price, image };
offer.orderBumps.push({ name, description, price, image });
await offer.save();
// Never: Product.create({ ... }) for offer products
```

## Webhook Handler
Sale records created ONLY here, never in payment controller:
```typescript
const sale = await Sale.create({ ownerId, offerId, stripePaymentIntentId: pi.id, ... });
```
Webhook route uses `express.raw()` — registered before `express.json()` in app setup.

## Upsell Funnel
`src/helper/getUpsellSteps.ts` — expands offer upsell config into linear array with `acceptNextStep`/`declineNextStep` indices. `-1` = end of funnel.

Upsell data shape on Offer:
```
upsell: { enabled, name, price (centavos), redirectUrl, customId,
  downsell?: { name, price, redirectUrl },
  steps: [{ name, price, redirectUrl, downsell? }]
}
```

**CRITICAL — never spread Mongoose SubDocuments** (prototype getters, not own properties):
```typescript
// WRONG — all fields undefined
rawSteps.push({ ...step });

// CORRECT — list properties explicitly
rawSteps.push({ name: step.name, price: step.price, redirectUrl: step.redirectUrl, customId: step.customId });
```

## Payment Flow
1. `POST /api/payments` → create PaymentIntent on behalf of vendor's connected account
2. Return `clientSecret` to frontend
3. `payment_intent.succeeded` webhook → create Sale record

## Env Vars
```
MONGO_URI, JWT_SECRET, PORT=4242, NODE_ENV
STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_CLIENT_ID
CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
```
