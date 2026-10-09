import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import type { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { staffUserColumns, type StaffUserRecord } from "@/lib/staff-users";
import {
  STAFF_ACCESS_COOKIE,
  STAFF_JWT_AUDIENCE,
  STAFF_JWT_ISSUER,
  STAFF_JWT_LIFETIME_SECONDS,
  STAFF_TENANT_COOKIE,
} from "@/lib/staff-auth-constants";

function staffAccessSecret(): Uint8Array {
  const secret = process.env.JWT_STAFF_ACCESS_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_STAFF_ACCESS_SECRET must contain at least 32 characters.");
  }
  return new TextEncoder().encode(secret);
}

export async function verifyStaffCode(code: string, codeHash: string): Promise<boolean> {
  return bcrypt.compare(code, codeHash);
}

export async function createStaffAccessToken(
  staff: Pick<StaffUserRecord, "id" | "tenant_code">,
): Promise<string> {
  return new SignJWT({ tenant_code: staff.tenant_code })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(staff.id)
    .setIssuer(STAFF_JWT_ISSUER)
    .setAudience(STAFF_JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${STAFF_JWT_LIFETIME_SECONDS}s`)
    .sign(staffAccessSecret());
}

export function setStaffAuthCookies(
  response: NextResponse,
  token: string,
  tenantCode: string,
): void {
  const secure = process.env.NODE_ENV === "production";
  response.cookies.set(STAFF_ACCESS_COOKIE, token, {
    httpOnly: true,
    secure,
    sameSite: "strict",
    path: "/",
    maxAge: STAFF_JWT_LIFETIME_SECONDS,
  });
  response.cookies.set(STAFF_TENANT_COOKIE, tenantCode, {
    httpOnly: true,
    secure,
    sameSite: "strict",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });
}

export function clearStaffAuthCookies(response: NextResponse): void {
  const secure = process.env.NODE_ENV === "production";
  for (const name of [STAFF_ACCESS_COOKIE, STAFF_TENANT_COOKIE]) {
    response.cookies.set(name, "", {
      httpOnly: true,
      secure,
      sameSite: "strict",
      path: "/",
      maxAge: 0,
    });
  }
}

export async function authenticateStaffRequest(
  request: NextRequest,
): Promise<StaffUserRecord | null> {
  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice(7)
    : request.cookies.get(STAFF_ACCESS_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, staffAccessSecret(), {
      issuer: STAFF_JWT_ISSUER,
      audience: STAFF_JWT_AUDIENCE,
      algorithms: ["HS256"],
    });
    const tenantCode = payload.tenant_code;
    if (
      !payload.sub ||
      typeof tenantCode !== "string" ||
      !/^[A-F0-9]{7}$/.test(tenantCode)
    ) {
      return null;
    }

    const result = await db.query<StaffUserRecord>(
      `SELECT ${staffUserColumns} FROM staff_users
       WHERE id = $1 AND tenant_code = $2`,
      [payload.sub, tenantCode],
    );
    return result.rows[0] ?? null;
  } catch {
    return null;
  }
}
