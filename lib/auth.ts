import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import type { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const ACCESS_TOKEN_LIFETIME_SECONDS = 15 * 60;
const REFRESH_TOKEN_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;
const REFRESH_COOKIE = "qms_refresh";
const ACCESS_COOKIE = "qms_access";
const JWT_ISSUER = "queue-management-system";
const JWT_AUDIENCE = "queue-management-api";

export type UserRole = "user" | "admin";
export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  tenant_code: string;
}

function accessSecret(): Uint8Array {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_ACCESS_SECRET must contain at least 32 characters.");
  }
  return new TextEncoder().encode(secret);
}

function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function equalHash(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function refreshCookieName(): string {
  return REFRESH_COOKIE;
}

export function setRefreshCookie(response: NextResponse, token: string): void {
  response.cookies.set(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: process.env.AUTH_REFRESH_COOKIE_SECURE === "true" || process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api/auth",
    maxAge: Math.floor(REFRESH_TOKEN_LIFETIME_MS / 1000),
  });
}

export function setAccessCookie(response: NextResponse, token: string): void {
  response.cookies.set(ACCESS_COOKIE, token, {
    httpOnly: true,
    secure: process.env.AUTH_REFRESH_COOKIE_SECURE === "true" || process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/admin",
    maxAge: ACCESS_TOKEN_LIFETIME_SECONDS,
  });
}

export function clearRefreshCookie(response: NextResponse): void {
  response.cookies.set(REFRESH_COOKIE, "", {
    httpOnly: true,
    secure: process.env.AUTH_REFRESH_COOKIE_SECURE === "true" || process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api/auth",
    maxAge: 0,
  });
}

async function createAccessToken(user: AuthUser): Promise<string> {
  return new SignJWT({ role: user.role })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(user.id)
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_LIFETIME_SECONDS}s`)
    .sign(accessSecret());
}

export async function createSession(user: AuthUser): Promise<{ accessToken: string; refreshToken: string }> {
  const tokenId = randomUUID();
  const familyId = randomUUID();
  const refreshToken = `${tokenId}.${randomBytes(32).toString("base64url")}`;

  await db.query(
    `INSERT INTO refresh_tokens (id, family_id, user_id, token_hash, expires_at)
     VALUES ($1, $2, $3, $4, NOW() + INTERVAL '30 days')`,
    [tokenId, familyId, user.id, hashRefreshToken(refreshToken)],
  );

  return { accessToken: await createAccessToken(user), refreshToken };
}

export async function rotateRefreshToken(token: string): Promise<{ user: AuthUser; refreshToken: string; accessToken: string } | null> {
  const separator = token.indexOf(".");
  if (separator < 1) return null;
  const tokenId = token.slice(0, separator);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(tokenId)) return null;
  const client = await db.connect();

  try {
    await client.query("BEGIN");
    const result = await client.query<{
      id: string;
      family_id: string;
      user_id: string;
      token_hash: string;
      expires_at: Date;
      revoked_at: Date | null;
      email: string;
      role: UserRole;
            tenant_code: string;
    }>(
      `SELECT rt.id, rt.family_id, rt.user_id, rt.token_hash, rt.expires_at, rt.revoked_at,
              u.email, u.role, u.tenant_code
       FROM refresh_tokens rt JOIN users u ON u.id = rt.user_id
       WHERE rt.id = $1 FOR UPDATE OF rt`,
      [tokenId],
    );
    const row = result.rows[0];
    if (!row) {
      await client.query("ROLLBACK");
      return null;
    }

    const tokenMatches = equalHash(row.token_hash, hashRefreshToken(token));
    if (!tokenMatches) {
      await client.query("ROLLBACK");
      return null;
    }
    if (row.revoked_at) {
      await client.query(
        "UPDATE refresh_tokens SET revoked_at = COALESCE(revoked_at, NOW()) WHERE family_id = $1",
        [row.family_id],
      );
      await client.query("COMMIT");
      return null;
    }
    if (row.expires_at.getTime() <= Date.now()) {
      await client.query("UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1", [row.id]);
      await client.query("COMMIT");
      return null;
    }

    await client.query("UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1", [row.id]);
    const nextId = randomUUID();
    const nextRefreshToken = `${nextId}.${randomBytes(32).toString("base64url")}`;
    await client.query(
      `INSERT INTO refresh_tokens (id, family_id, user_id, token_hash, expires_at)
       VALUES ($1, $2, $3, $4, NOW() + INTERVAL '30 days')`,
      [nextId, row.family_id, row.user_id, hashRefreshToken(nextRefreshToken)],
    );
    await client.query("COMMIT");

    const user = { id: row.user_id, email: row.email, role: row.role, tenant_code: row.tenant_code };
    return { user, refreshToken: nextRefreshToken, accessToken: await createAccessToken(user) };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function revokeRefreshToken(token: string | undefined): Promise<void> {
  if (!token) return;
  const tokenId = token.slice(0, token.indexOf("."));
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(tokenId)) return;
  const result = await db.query<{ token_hash: string }>(
    "SELECT token_hash FROM refresh_tokens WHERE id = $1",
    [tokenId],
  );
  const storedHash = result.rows[0]?.token_hash;
  if (!storedHash || !equalHash(storedHash, hashRefreshToken(token))) return;
  await db.query("UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1 AND revoked_at IS NULL", [tokenId]);
}

export async function authenticateRequest(request: NextRequest): Promise<AuthUser | null> {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;

  try {
    const { payload } = await jwtVerify(authorization.slice(7), accessSecret(), {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      algorithms: ["HS256"],
    });
    if (!payload.sub) return null;
    const result = await db.query<AuthUser>(
      "SELECT id, email, role, tenant_code FROM users WHERE id = $1",
      [payload.sub],
    );
    return result.rows[0] ?? null;
  } catch {
    return null;
  }
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export function isValidPassword(password: unknown): password is string {
  return typeof password === "string" && password.length >= 12 && Buffer.byteLength(password, "utf8") <= 72;
}

export function normalizeEmail(email: unknown): string | null {
  if (typeof email !== "string") return null;
  const normalized = email.trim().toLowerCase();
  if (normalized.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return null;
  return normalized;
}

export function clearAccessCookie(response: NextResponse): void {
  response.cookies.set(ACCESS_COOKIE, "", {
    httpOnly: true,
    secure: process.env.AUTH_REFRESH_COOKIE_SECURE === "true" || process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/admin",
    maxAge: 0,
  });
}