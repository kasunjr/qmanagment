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

Signup requires a six-digit email verification code before a session is created; unverified accounts cannot sign in. A welcome email is sent after the signup email is verified. Login also uses a six-digit email code after password verification. For test email delivery, create a dedicated Gmail account, enable 2-Step Verification, and create an App Password. Set `GMAIL_USER`, `GMAIL_APP_PASSWORD`, and optionally `GMAIL_FROM` in `.env.local` and in the Vercel project's Environment Variables. Do not commit or share the App Password. Codes expire after 10 minutes, are single-use, and can be resent once per minute.

The admin Profile tab supports editing the account name, changing the email address with verification, changing the password, and saving two-step verification and account-update notification preferences. Two-step verification is off by default for new accounts and can be enabled in Profile settings; disabling it requires the current password. Changing the password revokes sessions and requires signing in again. The notification preference is stored for future use; account-update emails are not currently sent.

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
| `GET /api/staff-users` | List staff users for the authenticated account's tenant, including `branch_id`, `counter_name` and `service_ids`. |
| `POST /api/staff-users` | Create a staff user. Required JSON: `name`, `username`, `email`, `code`; `role` is optional and defaults to `Agent`. Optional `branch_id`, `counter_name` (up to 60 characters; empty means none) and `service_ids` set up the counter. |
| `GET /api/staff-users/{id}` | Retrieve one staff user in the authenticated account's tenant, including `branch_id`, `counter_name` and `service_ids`. |
| `PATCH /api/staff-users/{id}` | Update staff fields; send `code` only to replace the staff code. Optional `branch_id` and `counter_name` (pass `null` to clear) and `service_ids` (replaces the list). |
| `DELETE /api/staff-users/{id}` | Delete a staff user in the authenticated account's tenant. |
| `POST /api/staff-auth/login` | Staff login. JSON body: `{"tenant_code":"75050B6","username":"agent1","code":"staff-code"}`. Tenant code and username must match. Success sets staff-only HttpOnly cookies. |
| `GET /api/staff-auth/me` | Verify the staff session and return the safe staff profile. Accepts the staff cookie or a staff bearer token. |
| `GET /api/staff/queue` | Return the staff member's counter (`name`, `branch_name`, `services`) and today's tickets: the branch's waiting tickets for the counter's services, plus the counter's own serving and completed tickets. Returns `counter: null` and an empty ticket list when no branch is assigned. |
| `GET /api/staff/queue/events` | Authenticated server-sent event stream. Sends `tickets-updated` when a ticket in the staff member's branch is created, called or completed. |
| `POST /api/staff/queue/next` | Call the longest-waiting ticket in the counter's branch among the services it serves, changing it from `waiting` to `serving` and recording the counter. Returns `409` if the counter has no branch, is already serving, or no ticket is waiting. |
| `POST /api/staff/queue/complete` | Complete the counter's serving ticket and call its next waiting ticket. Returns `409` if the counter has no serving ticket. |
| `POST /api/staff-auth/logout` | Clear only the staff authentication and tenant cookies. |

Staff JWTs use `JWT_STAFF_ACCESS_SECRET`, a separate issuer/audience, and an 8-hour lifetime. Account tokens cannot authenticate staff sessions, and staff tokens cannot authenticate account endpoints. `/staff/{tenantCode}` is the tenant-specific staff login page. Successful login redirects to `/staff`, which is protected by middleware; without a valid staff JWT, requests are redirected to the remembered tenant login page or `/` if no tenant is known. The shared navbar hides the Admin Portal/account controls on staff routes and shows staff logout only for a verified staff session.

The staff login and `/api/staff-auth/me` responses also include `branch_id`, `counter_name` and `service_ids`. A staff user is a counter: it belongs to one branch and serves any number of services, and a service can be served by any number of counters. The API enforces tenant boundaries, and the database allows a counter only one serving ticket at a time.

The admin staff-user screen uses these endpoints. The staff counter page reads the counter and its current-day tickets from `GET /api/staff/queue`, refreshes immediately on `tickets-updated` events, calls the longest-waiting customer with `POST /api/staff/queue/next`, and completes the serving ticket while calling the next with `POST /api/staff/queue/complete`. Two counters calling at the same moment never get the same ticket.

### Branches and Services

These routes back the admin Configurations tab. All of them require the account access token in `Authorization: Bearer <account-access-token>` and only see rows matching the account's `tenant_code`. A duplicate returns `409`; an ID from another tenant returns `404`.

- Branches and services are tenant-wide. There are no queues.
- Counters are staff users (see above). Each has a branch and the services it serves, stored in `staff_user_services`.
- A service can be booked at a branch only when at least one counter in that branch serves it. Its tickets wait in one virtual queue per branch and service, and any of those counters can call them.

| Method and path | Purpose |
| --- | --- |
| `GET /api/branches` | List the tenant's branches. |
| `POST /api/branches` | Create a branch. Body: `{"name":"Downtown","code":"DT01"}`. `code` is unique per tenant and stored uppercase. |
| `PATCH /api/branches/{id}` | Update `name` and/or `code`. |
| `DELETE /api/branches/{id}` | Delete a branch, with its tickets. Its staff users are kept with no branch. |
| `GET /api/services` | List the tenant's services. |
| `POST /api/services` | Create a service. Body: `{"name":"Loans","description":"Personal and home loans","duration_minutes":20}`; `description` is optional (up to 500 characters, default empty) and `duration_minutes` is optional (1-1440, default 15). `name` is unique per tenant. |
| `PATCH /api/services/{id}` | Update `name`, `description` and/or `duration_minutes`. |
| `DELETE /api/services/{id}` | Delete a service, with its counter assignments and tickets. |

### Customer Portal (Public)

These routes need no login. The tenant is identified by the 7-character tenant code in the path; an unknown code returns `404`. Only display fields are returned.

| Method and path | Purpose |
| --- | --- |
| `GET /api/public/{tenantCode}/booking-options` | Bookable branches (`id`, `name`, `code`, `service_ids`) and services (`id`, `name`, `description`, `duration_minutes`) a customer can choose from. A branch is listed only if at least one of its counters serves a service; its `service_ids` are the services bookable at that branch. |
| `POST /api/public/{tenantCode}/tickets` | Create a ticket. Body: `{"customer_name":"John Doe","branch_id":"<branch id>","service_id":"<service id>"}`. Returns `201` with the ticket; `400` for invalid input; `404` if the branch or service is not in the tenant, or no counter in that branch serves the service. |
| `GET /api/public/{tenantCode}/tickets/{ticketId}` | Current state of a ticket created today. Returns `404` for an unknown ticket or one from a previous day. |

A ticket response contains `id`, `ticket_number`, `customer_name`, `status`, `branch_name`, `service_name`, `counter_name`, `people_ahead` and `created_at`.

- **Number**: one running number per branch that restarts each day, taken from `ticket_counters`. The customer page shows it padded to three digits (`001`).
- **Counter**: no counter is chosen at booking. `counter_name` is copied from the counter that calls the ticket, and is `null` while waiting or if that counter has no name.
- **Status**: `waiting`, `serving` or `completed`. New tickets are `waiting`; a counter's call sets `serving`, and completing sets `completed`.
- **People ahead**: waiting tickets for the same service at the same branch on the same day with a lower number.

The customer page at `/customer/{tenantCode}` stores the ticket in the browser's local storage under `qms_ticket_{tenantCode}` so it survives a reload. On load it refreshes the ticket from the server; a ticket that is completed, missing or from a previous day is removed from local storage. It does not refresh on its own; a called ticket shows "Please go to {counter name}" after a reload. "Book Another Ticket" is shown only for a completed ticket.

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
  api/branches/route.ts       Tenant-scoped branch list and creation
  api/branches/[id]/route.ts  Branch update and deletion
  api/services/route.ts       Tenant-scoped service list and creation
  api/services/[id]/route.ts  Service update and deletion
  api/public/[tenantCode]/booking-options/route.ts  Public branches and services for booking
  api/public/[tenantCode]/tickets/route.ts          Public ticket creation
  api/public/[tenantCode]/tickets/[ticketId]/route.ts  Public ticket status
  staff/[tenantCode]/page.tsx Tenant-specific staff login page
  customer/[tenantCode]/page.tsx  Tenant-specific customer ticket booking page
  login/page.tsx              Login page
  signup/page.tsx             Signup page
  admin/page.tsx       Admin portal: QR codes, configuration, and analytics UI
  pricing/page.tsx     Static pricing plans
  staff/page.tsx       Staff counter controls
  globals.css          Global styles and Tailwind directives
  layout.tsx           Root layout, metadata, navigation, and shared page shell
  page.tsx             Home page and links to the main portals
components/
  AuthForm.tsx         Shared login/signup form
  AuthProvider.tsx     Session restoration and access-token lifecycle
  Navbar.tsx           Shared navigation bar
middleware.ts          JWT checks for /admin and the /staff counter
lib/
  auth.ts              Password, JWT, refresh-token, and request auth helpers
  staff-auth.ts        Separate staff JWT, code verification, cookies, and request auth
  staff-users.ts       Staff user (counter) validation, data types, and service assignment
  branches.ts          Branch validation and data types
  services.ts          Service validation and data types
  tickets.ts           Ticket validation, creation, lookup, and counter calling
  db.ts                Shared PostgreSQL connection pool
migrations/
  001_auth.sql         Users, tenant codes, and refresh-token tables
  003_staff_users.sql  Tenant-scoped staff users and hashed login codes
  004_branches.sql     Tenant-scoped branches
  005_services.sql     Tenant-scoped services
  006_queues.sql       Per-branch queues (removed by 018)
  007_tickets.sql      Tickets and per-branch daily ticket counters
  018_counters_replace_queues.sql  Staff counters with branch and services; drops queues
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
| `/customer/{tenantCode}` | Customer queue portal for the tenant identified by its 7-character code; no login |
| `/staff/{tenantCode}` | Staff login for the tenant identified by its 7-character code |
| `/staff` | Protected staff counter terminal; requires a staff session |
| `/admin` | Admin portal |
| `/pricing` | Pricing plans |

## Basic Development Guide

- Add or update pages in `app/`. A route is defined by a `page.tsx` file in its route folder.
- Put reusable UI in `components/`; the shared navigation is in `components/Navbar.tsx`.
- Most styling uses Tailwind utility classes. Global CSS and Tailwind directives are in `app/globals.css`; Tailwind scans the `app/` and `components/` trees.
- Pages that use React state, event handlers, or browser APIs should be client components and start with the `"use client"` directive.
- Account auth, staff-user management, staff authentication, branch/service/counter configuration, and customer tickets use PostgreSQL.
- The home page still links to `/customer`, which no longer exists; the customer portal is only reachable at `/customer/{tenantCode}`.
- Use the existing dependencies where possible: `lucide-react` for icons and `qrcode.react` for QR code rendering.
- Before sharing changes, run `npm run build` from the project root. It performs the production build and Next.js lint/type checks. The current `npm run lint` command opens interactive ESLint setup because no ESLint configuration is checked in.