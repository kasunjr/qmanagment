import { createHash, randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const STATE_COOKIE = "qms_google_state";
const VERIFIER_COOKIE = "qms_google_verifier";
const NEXT_COOKIE = "qms_google_next";
const COOKIE_PATH = "/api/auth/google";

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: COOKIE_PATH,
    maxAge: 600,
  };
}

function safeNextPath(value: string | null, baseUrl: string): string {
  if (!value) return "/admin";
  try {
    const destination = new URL(value, baseUrl);
    if (destination.origin === new URL(baseUrl).origin) {
      return `${destination.pathname}${destination.search}${destination.hash}`;
    }
  } catch {
    return "/admin";
  }
  return "/admin";
}

export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !process.env.GOOGLE_CLIENT_SECRET || !redirectUri) {
    return NextResponse.redirect(new URL("/login?error=google_configuration", request.url));
  }

  let redirect: URL;
  try {
    redirect = new URL(redirectUri);
    if (redirect.protocol !== "https:" && redirect.hostname !== "localhost") {
      throw new Error("Google redirect URI must use HTTPS.");
    }
  } catch (error) {
    console.error("Google OAuth redirect URI is invalid:", error);
    return NextResponse.redirect(new URL("/login?error=google_configuration", request.url));
  }

  const state = randomBytes(32).toString("base64url");
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const authorizationUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authorizationUrl.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirect.toString(),
    response_type: "code",
    scope: "openid email profile",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  }).toString();

  const response = NextResponse.redirect(authorizationUrl);
  response.cookies.set(STATE_COOKIE, state, cookieOptions());
  response.cookies.set(VERIFIER_COOKIE, verifier, cookieOptions());
  response.cookies.set(
    NEXT_COOKIE,
    safeNextPath(request.nextUrl.searchParams.get("next"), request.url),
    cookieOptions(),
  );
  return response;
}
