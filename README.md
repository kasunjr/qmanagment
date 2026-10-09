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

Authentication API routes use PostgreSQL. Start a local PostgreSQL server/database, then create `.env.local` from the sample file and set a private JWT secret:

```powershell
Copy-Item .env.example .env.local
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

Put the generated value in `JWT_ACCESS_SECRET` in `.env.local`, set `DATABASE_URL` to your PostgreSQL connection string, and keep `AUTH_REFRESH_COOKIE_SECURE=false` for local HTTP development. Use HTTPS and secure cookies in production. Do not commit `.env.local`.

Apply database migrations, then start the app:

```bash
npm run db:migrate
npm run dev
```

Public signup always creates a regular `user`; it cannot assign or modify an admin role. Both authenticated `user` and `admin` accounts can access the current admin dashboard. Existing account roles are not changed by signup, login, or the dashboard guard.

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
  login/page.tsx              Login page
  signup/page.tsx             Signup page
  admin/page.tsx       Admin portal: QR codes, configuration, and analytics UI
  customer/page.tsx    Customer ticket booking UI
  pricing/page.tsx     Static pricing plans
  staff/page.tsx       Staff queue and counter controls
  globals.css          Global styles and Tailwind directives
  layout.tsx           Root layout, metadata, navigation, and shared page shell
  page.tsx             Home page and links to the main portals
components/
  AuthForm.tsx         Shared login/signup form
  AuthProvider.tsx     Session restoration and access-token lifecycle
  Navbar.tsx           Shared navigation bar
middleware.ts          JWT check for /admin requests
lib/
  auth.ts              Password, JWT, refresh-token, and request auth helpers
  db.ts                Shared PostgreSQL connection pool
migrations/
  001_auth.sql         Users and refresh-token tables
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
| `/customer` | Customer queue portal |
| `/staff` | Staff counter terminal |
| `/admin` | Admin portal |
| `/pricing` | Pricing plans |

## Basic Development Guide

- Add or update pages in `app/`. A route is defined by a `page.tsx` file in its route folder.
- Put reusable UI in `components/`; the shared navigation is in `components/Navbar.tsx`.
- Most styling uses Tailwind utility classes. Global CSS and Tailwind directives are in `app/globals.css`; Tailwind scans the `app/` and `components/` trees.
- Pages that use React state, event handlers, or browser APIs should be client components and start with the `"use client"` directive.
- The queue/customer/admin portal UI still uses local React state and sample data. The authentication API persists accounts and refresh sessions in PostgreSQL, but it does not yet persist queue or admin configuration data.
- Use the existing dependencies where possible: `lucide-react` for icons and `qrcode.react` for QR code rendering.
- Before sharing changes, run `npm run build` from the project root. It performs the production build and Next.js lint/type checks. The current `npm run lint` command opens interactive ESLint setup because no ESLint configuration is checked in.