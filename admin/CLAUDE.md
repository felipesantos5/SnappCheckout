# Admin Frontend — React 19 + Vite + TypeScript

## Stack
Radix UI (shadcn-style) + Tailwind CSS 4 + React Hook Form + Zod + Axios + sonner (toasts)

## Path Alias
`@` → `./src` (vite.config.ts + tsconfig.json)

## Folder Structure
```
src/
  components/ui/   # reusable Radix UI components (shadcn pattern)
  components/forms/ # OfferForm.tsx etc.
  pages/           # route-level components
  contexts/        # AuthContext
```

## Auth & State
- Context API only (no Redux/Zustand)
- `AuthContext`: user data, JWT token, login/logout
- JWT stored in httpOnly cookie `auth_token` via nookies
- Axios globally configured with Bearer token; auto-logout on 401

## Routes (`src/App.tsx`)
```
/login, /register
/ (DashboardLayout — protected)
  /                          → DashboardOverview
  /offers                    → OffersPage
  /offers/new                → OfferCreatePage
  /offers/:id                → OfferEditPage
  /dashboard/stripe-return   → Stripe onboarding callback
  /dashboard/stripe-refresh  → Stripe onboarding interrupted
```

## Forms
Always React Hook Form + Zod:
```typescript
const schema = z.object({ name: z.string().min(1) });
const { register, handleSubmit } = useForm({ resolver: zodResolver(schema) });
```

## RHF Gotcha — Nested Field Visibility
`form.setValue("upsell.downsell", {...})` does NOT trigger `form.watch("upsell.downsell.name")`.
Control visibility of nested sections with local state:
```typescript
const [showDownsell, setShowDownsell] = useState(!!(initialData?.upsell?.downsell?.name));
// "Adicionar" button → setShowDownsell(true)
// Trash button → clear form fields + setShowDownsell(false)
```

## API
Base URL: `VITE_BACKEND_URL`. Use existing Axios instance (already has auth header).

## Env Vars
`VITE_BACKEND_URL`
