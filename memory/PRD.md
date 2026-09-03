# Grace Cares — Product Requirements & Build Log

## Original problem statement
Replace the WordPress site for Grace Cares (Lichfield CIC, "making care sustainable") with a new
website + ecommerce platform: shop pre-loved care equipment with correct line-level VAT and VAT-relief
declarations, Stripe payments, Xero accounting feed, equipment/financial donations, events & bookings,
care-provider resources, support enquiry routing, news/impact content, customer accounts, and a
role-based non-technical admin area. WCAG 2.2 AA, UK GDPR, security.

## User choices (this build)
- Scope: everything in one phase (broad MVP).
- Auth: JWT email/password with role-based admin.
- Xero: data model + admin sync queue built, **sync MOCKED** (real OAuth/mappings later).
- Email marketing: consent + subscribers stored in-app now, provider later.
- Brand: crawled grace-cares.com; fresh accessible design (Forest Green #144D36 + Terracotta #C85A40,
  Atkinson Hyperlegible + Outfit fonts).

## Architecture
- Backend: FastAPI (modular: core.py, auth.py, shop.py, content.py, admin.py, seed_data.py), MongoDB (motor).
- Frontend: React 19 + react-router 7, Tailwind, shadcn/ui, sonner, lucide-react. Contexts: Auth, Cart (localStorage).
- Payments: Stripe claimable sandbox (GB), server-computed totals (custom VAT), webhook /api/stripe/webhook + status polling.

## Personas
Individuals/families buying equipment; equipment donors; people claiming VAT relief; caregivers;
older people; NHS & care providers; care managers (ESG); volunteers; corporate partners; funders; event bookers.

## Implemented (2026-06)
- Auth: register/login/logout/me/refresh/forgot/reset, bcrypt, JWT httpOnly cookies, brute-force lockout,
  7 admin roles + customer, sensitive-role gating, super_admin seeded (paul@cass-online.co.uk).
- Shop: categories + 12 seeded products; search/filter/sort; product detail (specs, safety, carbon, related);
  VAT-relief price shown ONLY on eligible products.
- VAT engine: line-level; relief applied only when product eligible AND declaration valid; mixed baskets split;
  delivery standard-rated; verified across 5 scenarios.
- Checkout: guest/account, billing, collection/delivery, VAT-relief declaration capture, optional donation,
  separate unticked marketing consent, T&C acceptance, Stripe redirect, order + reservation created.
- Stock control: reserve on checkout, decrement on payment, 30-min reservation release, oversell => 409,
  stock movements, refund returns stock, wishlist/item requests.
- Donations (one-off + monthly Stripe). Equipment donation form (statuses, admin review). 
- Events: free/paid booking, capacity, waiting list, private online_link hidden from public API.
- Resources: gated/free downloads, consent-gated marketing, download tracking.
- Enquiries: routing by type + sensitive flagging + restricted admin visibility.
- News/Impact articles, homepage content, impact stats (editable), partners, testimonials, newsletter.
- Customer account: orders, bookings, preferences, deletion request, addresses.
- Admin: dashboard reports (+CSV export), products CRUD, orders + refunds, VAT declarations (restricted),
  equipment donations, events + bookings, Xero sync queue + reconciliation (MOCKED), enquiries, donations,
  users & roles, audit logging.

## Testing
- iteration_1.json: backend 38/38 passed; all critical frontend flows pass; no critical/minor bugs.

## Backlog (P1/P2 — not yet built)
- P1: Real Xero OAuth + approved account-code mappings; email provider integration; photo upload (object
  storage) for equipment donations & products; admin MFA; SEO (sitemaps, 301 redirects, structured data);
  WordPress content migration.
- P2: Gift Aid (pending legal confirmation), equipment hire flow, PDF VAT-receipt/declaration export,
  scheduled reminder emails, cookie-consent banner, full a11y screen-reader audit.

## v3 alignment (path B — React+FastAPI, not SSR)
- Confirmed with user: stay on supported CRA+FastAPI stack; true Next.js SSR is a platform limitation (they may contact support@emergent.sh later).
- Applied: v3 brand (#006738 primary, #85E845 accent used only for Donate, 18px base type); v3 10-category set (Bathing, Beds, Fall Prevention, Furniture, Kitchen & Catering, Mobility, Moving & Handling, Toilet Aids, Special Offers, Seating); exact condition-grade wording; unique/repeat stock_model field; "This item has found a new home" sold state; editable announcement bar; grey "REAL PHOTO TO REPLACE" placeholders (no stock photos of people, per v3); v3 hero messaging + mission line; Product JSON-LD (client-side) + Organization JSON-LD in index.html; returns/Incontinence policy wording drafted for legal sign-off.
- Deliverable: 3 homepage visual directions PDF at /frontend/public/grace-cares-visual-directions.pdf (Direction 1 built).
- Deferred (documented, not done): money-as-integer-pence refactor; true SSR/server-rendered HTML; separate Stock table; one-Contact-with-roles CRM; 3 fulfilment routes (postable/hub/bulky questionnaire); Grace AI; partner portals; Google Merchant/Meta feeds; sitemap.xml/robots.txt; admin draft→approve gate; guided one-question volunteer product form.

## v3 round 2 (this session)
- Built: **3 fulfilment routes** (postable / Lichfield hub collection / bulky delivery with an access questionnaire captured on the order); **draft→approve** workflow (product_contributor drafts, product_approver/shop_admin publish; drafts hidden from public shop + sitemap); **guided one-question-at-a-time listing form** with localStorage autosave (saves as draft for approval); **Grace AI** stub assistant (rule-based, refuses clinical/suitability + VAT-eligibility questions and offers a human with call button); **sitemap.xml + robots.txt** (backend) + **301 redirect manager** (admin CRUD + automatic resolution on 404 via NotFound page).
- Verified via API: draft hidden from public list, products-review lists drafts, redirect resolve works, Grace AI refuses with handoff.

## v3 round 3 (this session)
- **Postage bands**: products have `weight_kg`; postable orders are charged by total weight against editable bands (Admin → Postage & Shipping). Verified: 2.5 kg → £7.95 (+VAT).
- **Approval notifications**: creating a draft/awaiting listing writes an in-app notification + a **MOCKED** email log to approvers; Dashboard shows a notifications banner. (Real email = wire provider later.)
- **Bulky delivery quotes**: Admin → Orders "Set delivery quote" on bulky orders creates a Stripe payment link; paying it marks `delivery_quote.status=paid` (webhook + status handled).
- **Redirect CSV import**: Admin → Redirects & SEO bulk-imports `old,new[,code]` CSV (upsert). Verified: imported 2.

## v3 round 4 (this session)
- **Excel + CSV upload**: `/api/admin/products/import-file` accepts `.xlsx`/`.csv` (openpyxl) with a `dry_run` flag.
- **Import preview**: dry-run returns created/updated/error lists and writes nothing; Admin shows a preview then "Apply".
- **Bulk photo import**: `/api/admin/products/import-photos` accepts a `.zip`, matches images to products by SKU (full stem or prefix), stored as base64 data URLs (deploy-safe, no pod-local files).
- **Scheduled weekly export**: `.emergent/crons.yml` → Monday 08:00 UTC POST `/api/cron/weekly-product-export` (Bearer `WEBHOOK_CRON_SECRET`), builds the product+stock CSV and MOCK-emails admins; logged to `export_runs`. Verified: 401 without token, 200 with, dry-run writes nothing, xlsx round-trip creates/updates by SKU.

## v3 round 5 (this session — 2026-06)
- **Object Storage for photos**: integrated Emergent Object Storage (`/app/backend/storage.py`). Bulk zip photo import (`/api/admin/products/import-photos`) and a NEW single-photo upload on the product edit form (`/api/admin/products/upload-image`) now push image bytes to the bucket and store a served URL (`/api/files/{path}`) instead of base64 — ends MongoDB document bloat. Images served via public passthrough endpoint with long cache headers. Verified: upload returns URL, served file is image/png.
- **Product export filters**: `/api/admin/products-export.csv` accepts `category` (slug or id), `stock_status` (in_stock/low_stock/out_of_stock), `date_from`, `date_to`. Admin → Products has an "Export CSV" filter panel. Verified: category=mobility → 4 rows, date_to=2020 → header only, stock filters apply.

## v3 round 6 (this session — 2026-06)
- **Editable VAT declaration wording**: admin can edit the exact checkout declaration statement (heading, intro, guidance bullets, three purpose choices, both confirmation lines) via Admin → VAT Declarations → "Edit the VAT declaration wording". Stored in `site_settings` key `vat_declaration`; served publicly at `GET /api/vat-declaration-statement`; checkout reads it live with code defaults as fallback. Endpoints: `GET/PUT /api/admin/vat-declaration-statement` (finance_admin/content_admin/super_admin).
- **VAT declarations report + export**: Admin → VAT Declarations now has date presets (All time, This month, Last month, This calendar year, Last calendar year, Custom) that filter an on-screen table and a CSV download. Endpoints: `GET /api/admin/vat-declarations?date_from&date_to` and `GET /api/admin/vat-declarations-export.csv?date_from&date_to` (finance_admin). Verified: 2020 range → 0, current year → 2, CSV downloads with all declaration columns.

## v3 round 7 (this session — 2026-06)
- **VAT declaration PDF receipts + email**: `/app/backend/receipts.py` generates a branded PDF per declaration (order ref, date, eligible person, condition, signature, itemised VAT-relieved lines, totals, and the declaration wording). Admin → VAT Declarations rows now have **PDF** (authenticated download/print, `GET /api/admin/vat-declarations/{id}/receipt.pdf`) and **Email** (`POST /api/admin/vat-declarations/{id}/email-receipt`) actions. Email uses Emergent-managed **Resend** — sends the customer (on-file email only, per guardrail G4) an inline receipt summary plus a first-party tokenised secure PDF link (`GET /api/vat-declarations/{id}/receipt.pdf?token=`, bad token → 403). "Sent {date}" shown after emailing. Verified: PDF 200 (3.2KB), tokenised link 200, bad token 403, email send returned an email_id.

## Deferred (still open)
- Confirm VAT declaration wording + product classifications with Grace Cares' VAT adviser.
- Provide Xero credentials + approved mappings to switch sync from mocked to live.
