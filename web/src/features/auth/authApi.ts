import type { AuthError } from "@supabase/supabase-js";
import { authCallbackUrl, passwordResetUrl, setRememberDevice, supabase } from "../../lib/supabase";

export type AccountType = "student" | "owner";

const PENDING_ACCOUNT_TYPE_KEY = "mapaguapa:pending-account-type";
const NEXT_PATH_KEY = "mapaguapa:next";

function requireClient() {
  if (!supabase) {
    throw new Error("Sign-in is not configured. Add the Supabase URL and anon key to web/.env.");
  }
  return supabase;
}

export function friendlyAuthError(error: AuthError | Error | null | undefined) {
  if (!error) return null;
  const message = error.message.toLowerCase();
  if (message.includes("invalid login credentials")) return "That email and password don’t match. Try again or reset your password.";
  if (message.includes("email not confirmed")) return "Please confirm your email first. Check your inbox for the link we sent.";
  if (message.includes("user already registered")) return "An account with this email already exists. Sign in instead.";
  if (message.includes("password should be at least")) return "Use at least 8 characters for your password.";
  if (message.includes("rate limit") || message.includes("too many")) return "Too many attempts. Wait a minute and try again.";
  if (message.includes("code verifier") || message.includes("auth code")) {
    return "This link was opened in a different browser. Your email is confirmed — sign in to continue.";
  }
  return error.message;
}

/** Path to return to after a redirect-based sign-in (OAuth / email link). */
export function rememberNextPath(path: string | null | undefined) {
  try {
    if (path && path.startsWith("/") && !path.startsWith("//")) {
      sessionStorage.setItem(NEXT_PATH_KEY, path);
    } else {
      sessionStorage.removeItem(NEXT_PATH_KEY);
    }
  } catch {
    // storage unavailable: fall back to the role home
  }
}

export function peekNextPath() {
  try {
    return sessionStorage.getItem(NEXT_PATH_KEY);
  } catch {
    return null;
  }
}

export function clearNextPath() {
  rememberNextPath(null);
}

export function setPendingAccountType(type: AccountType | null) {
  try {
    if (type === "owner") {
      localStorage.setItem(PENDING_ACCOUNT_TYPE_KEY, type);
    } else {
      localStorage.removeItem(PENDING_ACCOUNT_TYPE_KEY);
    }
  } catch {
    // ignore
  }
}

export function takePendingAccountType(): AccountType | null {
  try {
    const value = localStorage.getItem(PENDING_ACCOUNT_TYPE_KEY);
    localStorage.removeItem(PENDING_ACCOUNT_TYPE_KEY);
    return value === "owner" ? "owner" : null;
  } catch {
    return null;
  }
}

export async function signInWithPassword(email: string, password: string, remember: boolean) {
  const client = requireClient();
  setRememberDevice(remember);
  const { error } = await client.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw error;
}

export async function signUpWithPassword(input: { email: string; password: string; fullName: string; accountType: AccountType }) {
  const client = requireClient();
  setRememberDevice(true);
  const { data, error } = await client.auth.signUp({
    email: input.email.trim(),
    password: input.password,
    options: {
      emailRedirectTo: authCallbackUrl(),
      data: { full_name: input.fullName.trim(), account_type: input.accountType },
    },
  });
  if (error) throw error;
  // With email confirmation on, there is no session until the link is opened.
  return { needsConfirmation: !data.session };
}

export async function signInWithGoogle(accountType: AccountType | null, nextPath?: string | null) {
  const client = requireClient();
  setRememberDevice(true);
  setPendingAccountType(accountType);
  rememberNextPath(nextPath);
  const { error } = await client.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: authCallbackUrl() },
  });
  if (error) {
    setPendingAccountType(null);
    throw error;
  }
}

export async function sendPasswordReset(email: string) {
  const client = requireClient();
  const { error } = await client.auth.resetPasswordForEmail(email.trim(), { redirectTo: passwordResetUrl() });
  if (error) throw error;
}

export async function updatePassword(password: string) {
  const client = requireClient();
  const { error } = await client.auth.updateUser({ password });
  if (error) throw error;
}

export const MIN_PASSWORD_LENGTH = 8;
