# Queue Management System

A queue-management interface built with Next.js 14, React 18, TypeScript, and Tailwind CSS. It includes customer ticket booking, staff queue controls, an admin configuration interface, and a pricing page.

## Requirements

- Node.js 18.17 or newer
- npm
- PostgreSQL 13 or newer

## Getting Started

From the project root, install the exact dependency versions recorded in the lockfile and start the development server:

```bash
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The development server supports hot reloading as files change.

## Authentication Setup

Authentication, staff-user, configuration, and ticket API routes use PostgreSQL. Start a local PostgreSQL server/database, then create `.env.local` from the sample file and generate two different private JWT secrets:

```powershell
Copy-Item .env.example .env.local
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

Run the command twice. Put one value in `JWT_ACCESS_SECRET` and the other in `JWT_STAFF_ACCESS_SECRET`. Set `DATABASE_URL` to your PostgreSQL connection string, and keep `AUTH_REFRESH_COOKIE_SECURE=false` for local HTTP development. Use HTTPS and secure cookies in production. Do not commit `.env.local`.

Apply database migrations, then start the app:

```bash
npm run db:migrate
npm run dev
```

Public signup always creates a regular `user`; it cannot assign or modify an admin role. Each account gets a unique 7-character `tenant_code`, returned in account user data. Both authenticated `user` and `admin` accounts can access the current admin dashboard. Existing account roles are not changed by signup, login, or the dashboard guard.

### Auth Endpoints

All request and response bodies are JSON. Login and signup return a 15-minute access JWT in the response body, set the bearer token in browser memory, and set a matching HttpOnly cookie scoped to `/admin`. The refresh token is stored in a 30-day HttpOnly, SameSite=Strict cookie. Middleware verifies the access cookie before serving `/admin`; refresh rotates both tokens, and logout revokes the refresh token and clears both cookies. Passwords must be 12-72 UTF-8 bytes.

| Method and path | Purpose |
| --- | --- |
| `POST /api/auth/signup` | Create a regular account and session. Body: `{"email":"person@example.com","password":"at-least-12-chars"}` |
| `POST /api/auth/login` | Verify credentials and create a session; invalid credentials return `401`. |
| `POST /api/auth/refresh` | Rotate the refresh cookie and return a new access JWT. |
| `POST /api/auth/logout` | Revoke the refresh token and clear its cookie. |
| `GET /api/auth/me` | Return the current user; requires a bearer access token. |
| `GET /api/admin/session` | Verify authenticated access; returns `401` without a valid token. Both supported roles are accepted. |

### Staff Users and Staff Authentication

Staff users are separate from account users. An authenticated account manages only staff rows matching its own `tenant_code`; each staff code is stored as a bcrypt hash. Manager CRUD requests use the account access token in `Authorization: Bearer <account-access-token>`.

| Method and path | Purpose |
| --- | --- |
| `GET /api/staff-users` | List staff users for the authenticated account's tenant, including `queue_ids`. |
| `POST /api/staff-users` | Create a staff user. Required JSON: `name`, `username`, `email`, `code`; `role` is optional and defaults to `Agent`. Optional `queue_ids` assigns one or more tenant queues. |
| `GET /api/staff-users/{id}` | Retrieve one staff user in the authenticated account's tenant, including `queue_ids`. |
| `PATCH /api/staff-users/{id}` | Update staff fields; send `code` only to replace the staff code. Optional `queue_ids` replaces assignments; pass `[]` to clear them. |
| `DELETE /api/staff-users/{id}` | Delete a staff user in the authenticated account's tenant. |
| `POST /api/staff-auth/login` | Staff login. JSON body: `{"tenant_code":"75050B6","username":"agent1","code":"staff-code"}`. Tenant code and username must match. Success sets staff-only HttpOnly cookies. |
| `GET /api/staff-auth/me` | Verify the staff session and return the safe staff profile. Accepts the staff cookie or a staff bearer token. |
| `POST /api/staff-auth/logout` | Clear only the staff authentication and tenant cookies. |

Staff JWTs use `JWT_STAFF_ACCESS_SECRET`, a separate issuer/audience, and an 8-hour lifetime. Account tokens cannot authenticate staff sessions, and staff tokens cannot authenticate account endpoints. `/{tenantCode}/staff` is the tenant-specific staff login page. Successful login redirects to `/staff`, which is protected by middleware; without a valid staff JWT, requests are redirected to the remembered tenant login page or `/` if no tenant is known. The shared navbar hides the Admin Portal/account controls on staff routes and shows staff logout only for a verified staff session.

The staff login and `/api/staff-auth/me` responses also include the assigned `queue_ids`. Assignments can span branches within the same tenant; the database prevents cross-tenant queue assignments.

The admin staff-user screen uses these endpoints. The queue operations on the staff counter page still use local sample state and are not yet persisted.

### Branches, Services and Queues

These routes back the admin Configurations tab. All of them require the account access token in `Authorization: Bearer <account-access-token>` and only see rows matching the account's `tenant_code`. A duplicate returns `409`; an ID from another tenant returns `404`.

- Branches and services are tenant-wide. There is no branch-to-service link: every branch offers every service.
- Queues belong to a branch. Creating a branch also creates its `Default Queue`, which cannot be deleted.
- Within a branch a service belongs to exactly one queue. It is in the branch's default queue unless moved; `queue_services` stores only the non-default assignments.

| Method and path | Purpose |
| --- | --- |
| `GET /api/branches` | List the tenant's branches. |
| `POST /api/branches` | Create a branch and its default queue. Body: `{"name":"Downtown","code":"DT01"}`. `code` is unique per tenant and stored uppercase. |
| `PATCH /api/branches/{id}` | Update `name` and/or `code`. |
| `DELETE /api/branches/{id}` | Delete a branch, with its queues, service assignments and tickets. |
| `GET /api/services` | List the tenant's services. |
| `POST /api/services` | Create a service. Body: `{"name":"Loans","duration_minutes":20}`; `duration_minutes` is optional (1-1440, default 15). `name` is unique per tenant. |
| `PATCH /api/services/{id}` | Update `name` and/or `duration_minutes`. |
| `DELETE /api/services/{id}` | Delete a service, with its queue assignments and tickets. |
| `GET /api/queues` | List the tenant's queues, each with the `service_ids` it holds. Optional `?branch_id={id}` filter. |
| `POST /api/queues` | Create a non-default queue. Body: `{"name":"Loans Queue","branch_id":"<branch id>"}`. `name` is unique per branch. |
| `PATCH /api/queues/{id}` | Rename a queue. Body: `{"name":"New name"}`. |
| `DELETE /api/queues/{id}` | Delete a queue. Returns `409` for the default queue or while services are still assigned to it. |
| `PUT /api/queues/{id}/services/{serviceId}` | Move a service into this queue, out of the queue it used in that branch. Moving it to the default queue removes the assignment. No body. |

### Customer Portal (Public)

These routes need no login. The tenant is identified by the 7-character tenant code in the path; an unknown code returns `404`. Only display fields are returned.

| Method and path | Purpose |
| --- | --- |
| `GET /api/public/{tenantCode}/booking-options` | Branches (`id`, `name`, `code`) and services (`id`, `name`, `duration_minutes`) a customer can choose from. |
| `POST /api/public/{tenantCode}/tickets` | Create a ticket. Body: `{"customer_name":"John Doe","branch_id":"<branch id>","service_id":"<service id>"}`. Returns `201` with the ticket; `400` for invalid input; `404` if the branch or service is not in the tenant. |
| `GET /api/public/{tenantCode}/tickets/{ticketId}` | Current state of a ticket created today. Returns `404` for an unknown ticket or one from a previous day. |

A ticket response contains `id`, `ticket_number`, `customer_name`, `status`, `branch_name`, `service_name`, `queue_name`, `people_ahead` and `created_at`.

- **Number**: one running number per branch that restarts each day, taken from `ticket_counters`. The customer page shows it padded to three digits (`001`).
- **Queue**: chosen by the server from the branch and service: the queue the service is assigned to in that branch, otherwise the branch's default queue.
- **Status**: `waiting`, `serving` or `completed`. New tickets are `waiting`. Nothing sets the other two yet; that belongs to the staff counter work.
- **People ahead**: waiting tickets in the same queue on the same day with a lower number.

The customer page at `/{tenantCode}/customer` stores the ticket in the browser's local storage under `qms_ticket_{tenantCode}` so it survives a reload. On load it refreshes the ticket from the server; a ticket that is completed, missing or from a previous day is removed from local storage. "Book Another Ticket" is shown only for a completed ticket.

The ticket routes are public and not rate limited: anyone with the tenant link can create tickets.

Example endpoint check in PowerShell (the web session retains the refresh cookie):

```powershell
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$body = @{ email = "admin@example.com"; password = "replace-with-a-long-password" } | ConvertTo-Json
$login = Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/auth/login -ContentType "application/json" -Body $body -WebSession $session
$headers = @{ Authorization = "Bearer $($login.accessToken)" }
Invoke-RestMethod -Method Get -Uri http://localhost:3000/api/auth/me -Headers $headers
Invoke-RestMethod -Method Get -Uri http://localhost:3000/api/admin/session -Headers $headers
$refresh = Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/auth/refresh -WebSession $session
```

Signup can be tested by posting the same JSON body to `/api/auth/signup`; it returns `201` for a new account and `409` if the email is already registered. The `/admin` page redirects guests to `/login`; after sign-in, the short-lived access token is kept in memory and refreshed through the HttpOnly cookie.

The admin page is guarded by middleware and the client session provider. Admin API routes must independently validate the bearer access token. Do not rely on the page guard alone to protect future server data or operations.

## Available Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Run the local development server. |
| `npm run lint` | Run the Next.js lint command; the project currently has no ESLint configuration, so this opens interactive setup. |
| `npm run build` | Create an optimized production build. |
| `npm start` | Serve the production build; run `npm run build` first. |
| `npm run db:migrate` | Apply pending SQL files from `migrations/` using `DATABASE_URL`. |

To test the production server locally:

```bash
npm run build
npm start
```

## Project Structure

```text
app/
  api/admin/session/route.ts  Protected admin access check
  api/auth/*/route.ts         Signup, login, refresh, logout, and identity endpoints
  api/staff-users/route.ts    Tenant-scoped staff list and creation
  api/staff-users/[id]/route.ts  Tenant-scoped staff retrieval, update, and deletion
  api/staff-auth/*/route.ts   Separate staff login, session verification, and logout
  api/branches/route.ts       Tenant-scoped branch list and creation (with default queue)
  api/branches/[id]/route.ts  Branch update and deletion
  api/services/route.ts       Tenant-scoped service list and creation
  api/services/[id]/route.ts  Service update and deletion
  api/queues/route.ts         Tenant-scoped queue list and creation
  api/queues/[id]/route.ts    Queue rename and deletion
  api/queues/[id]/services/[serviceId]/route.ts  Move a service into a queue
  api/public/[tenantCode]/booking-options/route.ts  Public branches and services for booking
  api/public/[tenantCode]/tickets/route.ts          Public ticket creation
  api/public/[tenantCode]/tickets/[ticketId]/route.ts  Public ticket status
  [tenantCode]/staff/page.tsx Tenant-specific staff login page
  [tenantCode]/customer/page.tsx  Tenant-specific customer ticket booking page
  login/page.tsx              Login page
  signup/page.tsx             Signup page
  admin/page.tsx       Admin portal: QR codes, configuration, and analytics UI
  pricing/page.tsx     Static pricing plans
  staff/page.tsx       Staff queue and counter controls
  globals.css          Global styles and Tailwind directives
  layout.tsx           Root layout, metadata, navigation, and shared page shell
  page.tsx             Home page and links to the main portals
components/
  AuthForm.tsx         Shared login/signup form
  AuthProvider.tsx     Session restoration and access-token lifecycle
  Navbar.tsx           Shared navigation bar
middleware.ts          JWT checks for /admin and /staff requests
lib/
  auth.ts              Password, JWT, refresh-token, and request auth helpers
  staff-auth.ts        Separate staff JWT, code verification, cookies, and request auth
  staff-users.ts       Staff user validation and data types
  branches.ts          Branch validation and data types
  services.ts          Service validation and data types
  queues.ts            Queue validation, data types, and the service-to-queue rule
  tickets.ts           Ticket validation, creation, and lookup
  db.ts                Shared PostgreSQL connection pool
migrations/
  001_auth.sql         Users, tenant codes, and refresh-token tables
  003_staff_users.sql  Tenant-scoped staff users and hashed login codes
  004_branches.sql     Tenant-scoped branches
  005_services.sql     Tenant-scoped services
  006_queues.sql       Per-branch queues and non-default service assignments
  007_tickets.sql      Tickets and per-branch daily ticket counters
scripts/
  migrate.mjs          Applies pending SQL migrations
package.json           Scripts and dependency definitions
package-lock.json      Locked npm dependency versions
.env.example           Local authentication/database configuration template
postcss.config.js      PostCSS and Tailwind integration
tailwind.config.js     Tailwind content paths and theme extensions
tsconfig.json          TypeScript configuration and @/* import alias
```

The application uses the Next.js App Router. Each folder under `app/` maps to a URL route:

| Route | Page |
| --- | --- |
| `/` | Home |
| `/{tenantCode}/customer` | Customer queue portal for the tenant identified by its 7-character code; no login |
| `/{tenantCode}/staff` | Staff login for the tenant identified by its 7-character code |
| `/staff` | Protected staff counter terminal; requires a staff session |
| `/admin` | Admin portal |
| `/pricing` | Pricing plans |

## Basic Development Guide

- Add or update pages in `app/`. A route is defined by a `page.tsx` file in its route folder.
- Put reusable UI in `components/`; the shared navigation is in `components/Navbar.tsx`.
- Most styling uses Tailwind utility classes. Global CSS and Tailwind directives are in `app/globals.css`; Tailwind scans the `app/` and `components/` trees.
- Pages that use React state, event handlers, or browser APIs should be client components and start with the `"use client"` directive.
- Account auth, staff-user management, staff authentication, branch/service/queue configuration, and customer tickets use PostgreSQL. The staff counter page still uses local React state and sample data; counter operations are not yet persisted.
- The home page still links to `/customer`, which no longer exists; the customer portal is only reachable at `/{tenantCode}/customer`.
- Use the existing dependencies where possible: `lucide-react` for icons and `qrcode.react` for QR code rendering.
- Before sharing changes, run `npm run build` from the project root. It performs the production build and Next.js lint/type checks. The current `npm run lint` command opens interactive ESLint setup because no ESLint configuration is checked in.