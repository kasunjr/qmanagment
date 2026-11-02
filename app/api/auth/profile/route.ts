import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, verifyPassword } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

    const result = await db.query<{
      display_name: string;
      email: string;
      role: "user" | "admin";
      tenant_code: string;
      email_verified_at: Date | null;
      two_step_enabled: boolean;
      account_updates_enabled: boolean;
    }>(
      `SELECT display_name, email, role, tenant_code, email_verified_at,
              two_step_enabled, account_updates_enabled
       FROM users
       WHERE id = $1`,
      [user.id],
    );
    const profile = result.rows[0];
    if (!profile) return NextResponse.json({ error: "Account not found." }, { status: 404 });

    return NextResponse.json({
      profile: {
        ...profile,
        email_verified: Boolean(profile.email_verified_at),
        email_verified_at: undefined,
      },
    });
  } catch (error) {
    console.error("Profile load failed:", error);
    return NextResponse.json({ error: "Unable to load profile." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  let body: {
    displayName?: unknown;
    twoStepEnabled?: unknown;
    accountUpdatesEnabled?: unknown;
    currentPassword?: unknown;
  };
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return NextResponse.json({ error: "Request body must be a JSON object." }, { status: 400 });
    }
    body = parsed;
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const hasDisplayName = Object.prototype.hasOwnProperty.call(body, "displayName");
  const hasTwoStep = Object.prototype.hasOwnProperty.call(body, "twoStepEnabled");
  const hasNotifications = Object.prototype.hasOwnProperty.call(body, "accountUpdatesEnabled");
  if (!hasDisplayName && !hasTwoStep && !hasNotifications) {
    return NextResponse.json({ error: "Provide at least one profile setting to update." }, { status: 400 });
  }
  if (hasDisplayName && (typeof body.displayName !== "string" || body.displayName.trim().length > 100)) {
    return NextResponse.json({ error: "Name must be 100 characters or fewer." }, { status: 400 });
  }
  if (hasTwoStep && typeof body.twoStepEnabled !== "boolean") {
    return NextResponse.json({ error: "Two-step verification setting must be true or false." }, { status: 400 });
  }
  if (hasNotifications && typeof body.accountUpdatesEnabled !== "boolean") {
    return NextResponse.json({ error: "Notification setting must be true or false." }, { status: 400 });
  }
  if (body.currentPassword !== undefined && typeof body.currentPassword !== "string") {
    return NextResponse.json({ error: "Current password must be a string." }, { status: 400 });
  }

  try {
    const user = await authenticateRequest(request);
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

    if (hasTwoStep && body.twoStepEnabled === false) {
      const securityResult = await db.query<{ two_step_enabled: boolean; password_hash: string }>(
        "SELECT two_step_enabled, password_hash FROM users WHERE id = $1",
        [user.id],
      );
      const security = securityResult.rows[0];
      if (security?.two_step_enabled && (
        typeof body.currentPassword !== "string" ||
        !(await verifyPassword(body.currentPassword, security.password_hash))
      )) {
        return NextResponse.json({ error: "Enter your current password to disable two-step verification." }, { status: 401 });
      }
    }

    const result = await db.query<{
      display_name: string;
      email: string;
      role: "user" | "admin";
      tenant_code: string;
      email_verified_at: Date | null;
      two_step_enabled: boolean;
      account_updates_enabled: boolean;
    }>(
      `UPDATE users
       SET display_name = CASE WHEN $2::boolean THEN $3 ELSE display_name END,
           two_step_enabled = CASE WHEN $4::boolean THEN $5 ELSE two_step_enabled END,
           account_updates_enabled = CASE WHEN $6::boolean THEN $7 ELSE account_updates_enabled END,
           updated_at = NOW()
       WHERE id = $1
       RETURNING display_name, email, role, tenant_code, email_verified_at,
                 two_step_enabled, account_updates_enabled`,
      [
        user.id,
        hasDisplayName,
        hasDisplayName && typeof body.displayName === "string" ? body.displayName.trim() : "",
        hasTwoStep,
        hasTwoStep ? body.twoStepEnabled : false,
        hasNotifications,
        hasNotifications ? body.accountUpdatesEnabled : false,
      ],
    );
    const profile = result.rows[0];
    if (!profile) return NextResponse.json({ error: "Account not found." }, { status: 404 });

    return NextResponse.json({
      profile: {
        ...profile,
        email_verified: Boolean(profile.email_verified_at),
        email_verified_at: undefined,
      },
    });
  } catch (error) {
    console.error("Profile update failed:", error);
    return NextResponse.json({ error: "Unable to update profile settings." }, { status: 500 });
  }
}
