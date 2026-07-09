import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";

export interface SessionData {
  authenticated?: boolean;
  loginAt?: number;
}

export const SESSION_COOKIE_NAME = "fuelboard_session";

export const sessionOptions: SessionOptions = {
  // AUTH_SECRET debe tener ≥32 caracteres (iron-session lo exige).
  password: process.env.AUTH_SECRET ?? "",
  cookieName: SESSION_COOKIE_NAME,
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 días
  },
};

/** Sesión iron-session ligada a las cookies de la request (async en Next 16). */
export async function getSession() {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}
