import { randomUUID } from "node:crypto";
import cookieParser from "cookie-parser";
import type { RequestHandler } from "express";
import { db, sessions } from "@workspace/db";
import { and, eq, gt } from "drizzle-orm";

const secret = process.env.SESSION_SECRET;
if (!secret) throw new Error("SESSION_SECRET is required");
export const parseSessionCookie = cookieParser(secret);
const COOKIE = "crossover_session";
const MAX_AGE = 30 * 24 * 60 * 60 * 1000;

// Anonymous identity only: all profile and deck state stays in PostgreSQL.
export const anonymousSession: RequestHandler = async (req, res, next) => {
  const signed: unknown = req.signedCookies?.[COOKIE];
  const id = typeof signed === "string" && /^[a-f0-9-]{36}$/.test(signed) ? signed : null;
  let row = id ? (await db.select().from(sessions).where(and(eq(sessions.id, id), gt(sessions.expires_at, new Date()))).limit(1))[0] : undefined;
  if (!row) {
    [row] = await db.insert(sessions).values({
      id: randomUUID(), expires_at: new Date(Date.now() + MAX_AGE),
    }).returning();
    res.cookie(COOKIE, row!.id, {
      signed: true, httpOnly: true, sameSite: "lax",
      secure: req.secure || process.env.NODE_ENV === "production", maxAge: MAX_AGE, path: "/",
    });
  }
  res.locals.sessionId = row!.id;
  res.locals.sessionData = row!.data;
  res.setHeader("Cache-Control", "private, no-store");
  next();
};
