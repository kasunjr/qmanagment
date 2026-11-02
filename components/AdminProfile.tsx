"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { SessionUser } from "@/components/AuthProvider";
import {
  Bell,
  Building2,
  Check,
  CircleUserRound,
  KeyRound,
  Mail,
  ShieldCheck,
} from "lucide-react";

interface ProfileData {
  display_name: string;
  email: string;
  role: "user" | "admin";
  tenant_code: string;
  email_verified: boolean;
  two_step_enabled: boolean;
  account_updates_enabled: boolean;
}

interface ProfileResponse {
  profile?: ProfileData;
  error?: string;
  message?: string;
  challengeId?: string;
  email?: string;
}

interface AdminProfileProps {
  user: SessionUser | null;
  accessToken: string | null;
  acceptSession: (user: SessionUser, token: string) => void;
  signOut: () => Promise<void>;
}

const inputClass = "w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";
const readOnlyInputClass = "w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700";
const primaryButtonClass = "rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:cursor-wait disabled:opacity-60";
const secondaryButtonClass = "rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60";

function initials(displayName: string, email: string): string {
  const nameParts = displayName.trim().split(/\s+/).filter(Boolean);
  if (nameParts.length > 1) return `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`.toUpperCase();
  return (nameParts[0]?.[0] ?? email[0] ?? "U").toUpperCase();
}

export default function AdminProfile({ user, accessToken, acceptSession, signOut }: AdminProfileProps) {
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [emailStage, setEmailStage] = useState<"idle" | "code">("idle");
  const [newEmail, setNewEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [emailChallengeId, setEmailChallengeId] = useState("");
  const [isSendingEmailCode, setIsSendingEmailCode] = useState(false);
  const [isVerifyingEmail, setIsVerifyingEmail] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [disableTwoStepPrompt, setDisableTwoStepPrompt] = useState(false);
  const [twoStepPassword, setTwoStepPassword] = useState("");

  useEffect(() => {
    if (!accessToken) {
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    async function loadProfile() {
      setIsLoading(true);
      setError("");
      try {
        const response = await fetch("/api/auth/profile", {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: "no-store",
          signal: controller.signal,
        });
        const result = (await response.json()) as ProfileResponse;
        if (!response.ok || !result.profile) {
          throw new Error(result.error ?? "Unable to load your profile.");
        }
        setProfile(result.profile);
        setDisplayName(result.profile.display_name);
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load your profile.");
        }
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }
    void loadProfile();
    return () => controller.abort();
  }, [accessToken]);

  async function patchProfile(settings: Record<string, unknown>, successMessage: string): Promise<boolean> {
    if (!accessToken) {
      setError("Your session has expired. Please sign in again.");
      return false;
    }
    setError("");
    setNotice("");
    setIsSaving(true);
    try {
      const response = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(settings),
      });
      const result = (await response.json()) as ProfileResponse;
      if (!response.ok || !result.profile) {
        throw new Error(result.error ?? "Unable to save profile settings.");
      }
      setProfile(result.profile);
      setDisplayName(result.profile.display_name);
      setNotice(successMessage);
      return true;
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save profile settings.");
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  async function saveDisplayName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await patchProfile({ displayName }, "Profile name saved.");
  }

  async function requestEmailChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken) return;
    setError("");
    setNotice("");
    setIsSendingEmailCode(true);
    try {
      const response = await fetch("/api/auth/profile/email", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: newEmail, currentPassword: emailPassword }),
      });
      const result = (await response.json()) as ProfileResponse;
      if (result.challengeId) {
        setEmailChallengeId(result.challengeId);
        setEmailStage("code");
      }
      if (!response.ok) throw new Error(result.error ?? "Unable to request email change.");
      setNotice("Enter the code sent to your new email address.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to request email change.");
    } finally {
      setIsSendingEmailCode(false);
    }
  }

  async function verifyEmailChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken) return;
    setError("");
    setNotice("");
    setIsVerifyingEmail(true);
    try {
      const response = await fetch("/api/auth/profile/email/verify", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ challengeId: emailChallengeId, code: emailCode }),
      });
      const result = (await response.json()) as ProfileResponse;
      if (!response.ok || !result.email) {
        throw new Error(result.error ?? "Unable to verify the new email address.");
      }
      setProfile((current) => current ? { ...current, email: result.email!, email_verified: true } : current);
      if (user && accessToken) acceptSession({ ...user, email: result.email }, accessToken);
      setEmailStage("idle");
      setEmailChallengeId("");
      setEmailCode("");
      setEmailPassword("");
      setNewEmail("");
      setNotice("Email address updated and verified.");
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : "Unable to verify the new email address.");
    } finally {
      setIsVerifyingEmail(false);
    }
  }

  async function resendEmailCode() {
    if (!accessToken) return;
    setError("");
    setNotice("");
    setIsSendingEmailCode(true);
    try {
      const response = await fetch("/api/auth/profile/email/resend", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ challengeId: emailChallengeId }),
      });
      const result = (await response.json()) as ProfileResponse;
      if (result.challengeId) setEmailChallengeId(result.challengeId);
      if (!response.ok) throw new Error(result.error ?? "Unable to resend the verification code.");
      setEmailCode("");
      setNotice("A new verification code was sent.");
    } catch (resendError) {
      setError(resendError instanceof Error ? resendError.message : "Unable to resend the verification code.");
    } finally {
      setIsSendingEmailCode(false);
    }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken) return;
    setError("");
    setNotice("");
    if (newPassword !== confirmPassword) {
      setError("The new passwords do not match.");
      return;
    }
    setIsChangingPassword(true);
    try {
      const response = await fetch("/api/auth/profile/password", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const result = (await response.json()) as ProfileResponse;
      if (!response.ok) throw new Error(result.error ?? "Unable to change password.");
      setNotice(result.message ?? "Password changed. Sign in again with your new password.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      try {
        await signOut();
      } finally {
        router.replace("/login");
      }
    } catch (passwordError) {
      setError(passwordError instanceof Error ? passwordError.message : "Unable to change password.");
    } finally {
      setIsChangingPassword(false);
    }
  }

  async function updateSecuritySetting(twoStepEnabled: boolean, password?: string) {
    const updated = await patchProfile(
      { twoStepEnabled, ...(password ? { currentPassword: password } : {}) },
      twoStepEnabled ? "Two-step verification enabled." : "Two-step verification disabled.",
    );
    if (updated) {
      setDisableTwoStepPrompt(false);
      setTwoStepPassword("");
    }
  }

  async function toggleNotifications() {
    if (!profile) return;
    const nextValue = !profile.account_updates_enabled;
    const updated = await patchProfile(
      { accountUpdatesEnabled: nextValue },
      nextValue ? "Account update notifications enabled." : "Account update notifications disabled.",
    );
    if (!updated) return;
  }

  if (isLoading) {
    return <p className="py-12 text-center text-sm text-slate-500" role="status">Loading profile...</p>;
  }
  if (!profile) {
    return <p className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error || "Unable to load your profile."}</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Profile</h2>
        <p className="mt-1 text-sm text-slate-600">Manage your account details and security preferences.</p>
      </div>

      {error && <p aria-live="polite" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}
      {notice && <p aria-live="polite" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p>}

      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <section className="h-fit rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-indigo-100 text-2xl font-semibold text-indigo-700">
              {initials(profile.display_name, profile.email)}
            </div>
            <h3 className="mt-4 break-all text-lg font-semibold text-slate-900">
              {profile.display_name || profile.email}
            </h3>
            <p className="mt-1 text-sm capitalize text-slate-500">{profile.role} account</p>
            <span className={`mt-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
              profile.email_verified ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
            }`}>
              <Check aria-hidden="true" className="h-3.5 w-3.5" />
              {profile.email_verified ? "Email verified" : "Email not verified"}
            </span>
          </div>
          <div className="mt-6 border-t border-slate-100 pt-5">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Workspace code</p>
            <p className="mt-1 font-mono text-sm font-semibold tracking-wider text-slate-800">{profile.tenant_code}</p>
          </div>
        </section>

        <div className="space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-5 py-4">
              <h3 className="font-semibold text-slate-900">Account information</h3>
              <p className="mt-1 text-sm text-slate-500">Update your name and verified email address.</p>
            </div>
            <form className="space-y-4 p-5" onSubmit={saveDisplayName}>
              <div>
                <label htmlFor="profile-name" className="mb-1.5 flex items-center gap-2 text-sm font-medium text-slate-700">
                  <CircleUserRound aria-hidden="true" className="h-4 w-4 text-slate-400" />
                  Name
                </label>
                <input
                  autoComplete="name"
                  className={inputClass}
                  id="profile-name"
                  maxLength={100}
                  onChange={(event) => setDisplayName(event.target.value)}
                  value={displayName}
                />
              </div>
              <div>
                <label htmlFor="profile-email" className="mb-1.5 flex items-center gap-2 text-sm font-medium text-slate-700">
                  <Mail aria-hidden="true" className="h-4 w-4 text-slate-400" />
                  Email address
                </label>
                <div className="flex flex-wrap gap-2">
                  <input className={`${readOnlyInputClass} min-w-0 flex-1`} id="profile-email" readOnly value={profile.email} />
                  {emailStage === "idle" && (
                    <button className={secondaryButtonClass} onClick={() => setEmailStage("code")} type="button">
                      Change email
                    </button>
                  )}
                </div>
              </div>
              {emailStage === "idle" && (
                <button className={primaryButtonClass} disabled={isSaving || displayName === profile.display_name} type="submit">
                  {isSaving ? "Saving..." : "Save profile"}
                </button>
              )}
            </form>

            {emailStage === "code" && (
              <div className="border-t border-slate-100 bg-slate-50/60 p-5">
                {!emailChallengeId ? (
                  <form className="space-y-4" onSubmit={requestEmailChange}>
                    <div>
                      <label htmlFor="new-email" className="mb-1.5 block text-sm font-medium text-slate-700">New email address</label>
                      <input
                        autoComplete="email"
                        className={inputClass}
                        id="new-email"
                        onChange={(event) => setNewEmail(event.target.value)}
                        required
                        type="email"
                        value={newEmail}
                      />
                    </div>
                    <div>
                      <label htmlFor="email-current-password" className="mb-1.5 block text-sm font-medium text-slate-700">Current password</label>
                      <input
                        autoComplete="current-password"
                        className={inputClass}
                        id="email-current-password"
                        onChange={(event) => setEmailPassword(event.target.value)}
                        required
                        type="password"
                        value={emailPassword}
                      />
                    </div>
                    <div className="flex gap-2">
                      <button className={primaryButtonClass} disabled={isSendingEmailCode} type="submit">
                        {isSendingEmailCode ? "Sending code..." : "Send verification code"}
                      </button>
                      <button
                        className={secondaryButtonClass}
                        onClick={() => {
                          setEmailStage("idle");
                          setNewEmail("");
                          setEmailPassword("");
                          setError("");
                        }}
                        type="button"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <form className="space-y-4" onSubmit={verifyEmailChange}>
                    <p className="text-sm text-slate-600">Enter the 6-digit code sent to <strong>{newEmail}</strong>.</p>
                    <div>
                      <label htmlFor="email-change-code" className="mb-1.5 block text-sm font-medium text-slate-700">Verification code</label>
                      <input
                        autoComplete="one-time-code"
                        className={inputClass}
                        id="email-change-code"
                        inputMode="numeric"
                        maxLength={6}
                        onChange={(event) => setEmailCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                        pattern="[0-9]{6}"
                        required
                        value={emailCode}
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button className={primaryButtonClass} disabled={isVerifyingEmail} type="submit">
                        {isVerifyingEmail ? "Verifying..." : "Verify new email"}
                      </button>
                      <button className={secondaryButtonClass} disabled={isSendingEmailCode} onClick={() => void resendEmailCode()} type="button">
                        {isSendingEmailCode ? "Sending..." : "Resend code"}
                      </button>
                      <button
                        className={secondaryButtonClass}
                        onClick={() => {
                          setEmailStage("idle");
                          setEmailChallengeId("");
                          setEmailCode("");
                          setNewEmail("");
                          setEmailPassword("");
                          setError("");
                        }}
                        type="button"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

            <div className="grid gap-4 border-t border-slate-100 p-5 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-slate-700">
                  <ShieldCheck aria-hidden="true" className="h-4 w-4 text-slate-400" />
                  Account role
                </label>
                <input className={`${readOnlyInputClass} capitalize`} readOnly value={profile.role} />
              </div>
              <div>
                <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-slate-700">
                  <Building2 aria-hidden="true" className="h-4 w-4 text-slate-400" />
                  Workspace code
                </label>
                <input className={`${readOnlyInputClass} font-mono`} readOnly value={profile.tenant_code} />
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-5 py-4">
              <h3 className="font-semibold text-slate-900">Security</h3>
              <p className="mt-1 text-sm text-slate-500">Manage your password and sign-in verification.</p>
            </div>
            <div className="divide-y divide-slate-100">
              <div className="px-5 py-4">
                <div className="mb-4 flex items-start gap-3">
                  <KeyRound aria-hidden="true" className="mt-0.5 h-4 w-4 text-slate-400" />
                  <div>
                    <p className="text-sm font-medium text-slate-800">Password</p>
                    <p className="mt-1 text-sm text-slate-500">Changing your password signs you out of all sessions.</p>
                  </div>
                </div>
                <form className="grid gap-3 sm:grid-cols-2" onSubmit={changePassword}>
                  <div className="sm:col-span-2">
                    <label htmlFor="current-password" className="mb-1.5 block text-sm font-medium text-slate-700">Current password</label>
                    <input
                      autoComplete="current-password"
                      className={inputClass}
                      id="current-password"
                      onChange={(event) => setCurrentPassword(event.target.value)}
                      required
                      type="password"
                      value={currentPassword}
                    />
                  </div>
                  <div>
                    <label htmlFor="new-password" className="mb-1.5 block text-sm font-medium text-slate-700">New password</label>
                    <input
                      autoComplete="new-password"
                      className={inputClass}
                      id="new-password"
                      minLength={12}
                      onChange={(event) => setNewPassword(event.target.value)}
                      required
                      type="password"
                      value={newPassword}
                    />
                  </div>
                  <div>
                    <label htmlFor="confirm-password" className="mb-1.5 block text-sm font-medium text-slate-700">Confirm new password</label>
                    <input
                      autoComplete="new-password"
                      className={inputClass}
                      id="confirm-password"
                      minLength={12}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      required
                      type="password"
                      value={confirmPassword}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <button className={primaryButtonClass} disabled={isChangingPassword} type="submit">
                      {isChangingPassword ? "Updating password..." : "Update password"}
                    </button>
                  </div>
                </form>
              </div>

              <div className="px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <ShieldCheck aria-hidden="true" className="mt-0.5 h-4 w-4 text-slate-400" />
                    <div>
                      <p className="text-sm font-medium text-slate-800">Two-step verification</p>
                      <p className="mt-1 text-sm text-slate-500">
                        Require an email code in addition to your password when signing in.
                      </p>
                    </div>
                  </div>
                  <button
                    aria-checked={profile.two_step_enabled}
                    aria-label="Two-step verification"
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:opacity-60 ${
                      profile.two_step_enabled ? "bg-indigo-600" : "bg-slate-300"
                    }`}
                    disabled={isSaving}
                    onClick={() => profile.two_step_enabled
                      ? setDisableTwoStepPrompt(true)
                      : void updateSecuritySetting(true)}
                    role="switch"
                    type="button"
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                      profile.two_step_enabled ? "translate-x-6" : "translate-x-1"
                    }`} />
                  </button>
                </div>
                {disableTwoStepPrompt && (
                  <form
                    className="mt-4 space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void updateSecuritySetting(false, twoStepPassword);
                    }}
                  >
                    <div>
                      <label htmlFor="two-step-password" className="mb-1.5 block text-sm font-medium text-slate-700">
                        Confirm your password
                      </label>
                      <p className="mb-3 text-sm text-slate-500">
                        Enter your current password to turn off email verification at sign-in.
                      </p>
                      <input
                        autoComplete="current-password"
                        className={inputClass}
                        id="two-step-password"
                        onChange={(event) => setTwoStepPassword(event.target.value)}
                        required
                        type="password"
                        value={twoStepPassword}
                      />
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                      <button
                        className={secondaryButtonClass}
                        onClick={() => {
                          setDisableTwoStepPrompt(false);
                          setTwoStepPassword("");
                          setError("");
                        }}
                        type="button"
                      >
                        Cancel
                      </button>
                      <button className={primaryButtonClass} disabled={isSaving} type="submit">
                        {isSaving ? "Saving..." : "Confirm and disable"}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-5 py-4">
              <h3 className="font-semibold text-slate-900">Notifications</h3>
              <p className="mt-1 text-sm text-slate-500">Choose whether to receive account updates.</p>
            </div>
            <div className="flex items-start gap-3 p-5">
              <Bell aria-hidden="true" className="mt-0.5 h-4 w-4 text-slate-400" />
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-800">Product and account updates</p>
                <p className="mt-1 text-sm text-slate-500">
                  Receive important service announcements and account notices.
                </p>
              </div>
              <input
                aria-label="Product and account update notifications"
                checked={profile.account_updates_enabled}
                className="mt-1 h-4 w-4 accent-indigo-600 disabled:opacity-60"
                disabled={isSaving}
                onChange={() => void toggleNotifications()}
                type="checkbox"
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
