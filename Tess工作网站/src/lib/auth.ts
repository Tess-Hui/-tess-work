import bcrypt from "bcryptjs";
import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const SESSION_COOKIE = "tess_session";
const ADMIN_USERNAME = "Tess";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 14;

type SessionPayload = {
  username: string;
  expiresAt: number;
};

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 24) {
    throw new Error("SESSION_SECRET must be configured with at least 24 characters.");
  }
  return secret;
}

function sign(payload: string) {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function encodeSession(payload: SessionPayload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

function decodeSession(value: string): SessionPayload | null {
  const [encoded, signature] = value.split(".");
  if (!encoded || !signature || !safeEqual(sign(encoded), signature)) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as SessionPayload;
    if (payload.username !== ADMIN_USERNAME || payload.expiresAt < Date.now()) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export async function login(username: string, password: string) {
  const hash = process.env.ADMIN_PASSWORD_HASH;
  if (username !== ADMIN_USERNAME || !hash) return false;

  const valid = await bcrypt.compare(password, hash);
  if (!valid) return false;

  const cookieStore = await cookies();
  cookieStore.set(
    SESSION_COOKIE,
    encodeSession({
      username: ADMIN_USERNAME,
      expiresAt: Date.now() + SESSION_MAX_AGE_SECONDS * 1000,
    }),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
    },
  );
  return true;
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function getSession() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  return decodeSession(raw);
}

export async function requireAuth() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}
