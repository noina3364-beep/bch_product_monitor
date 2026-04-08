import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { NextFunction, Request, Response } from 'express';
import { Role, type PrismaClient } from '@prisma/client';
import { AppError } from './errors.js';
import type { AuthSessionDto } from './types.js';

const scrypt = promisify(scryptCallback);

const SESSION_COOKIE_NAME = 'bch_pm_session';
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

type DbClient = PrismaClient;

export interface RequestAuth {
  sessionId: string;
  role: Role;
  username: string | null;
}

type AuthedRequest = Request & {
  auth?: RequestAuth | null;
};

function getCookieValue(cookieHeader: string | undefined, cookieName: string) {
  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(';').map((value) => value.trim());
  const match = cookies.find((cookie) => cookie.startsWith(`${cookieName}=`));
  if (!match) {
    return null;
  }

  return decodeURIComponent(match.slice(cookieName.length + 1));
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${derivedKey.toString('hex')}`;
}

export async function verifyPassword(password: string, storedHash: string) {
  const [salt, hash] = storedHash.split(':');
  if (!salt || !hash) {
    return false;
  }

  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
  const storedKey = Buffer.from(hash, 'hex');

  return storedKey.length === derivedKey.length && timingSafeEqual(storedKey, derivedKey);
}

export function toAuthSessionDto(auth: RequestAuth | null): AuthSessionDto {
  return {
    authenticated: auth !== null,
    role: auth?.role ?? null,
    username: auth?.username ?? null,
  };
}

function setSessionCookie(response: Response, sessionId: string, expiresAt: Date) {
  response.cookie(SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    expires: expiresAt,
    path: '/',
  });
}

export function clearSessionCookie(response: Response) {
  response.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    path: '/',
  });
}

export async function createEditorSession(db: DbClient, userId: string, username: string, response: Response) {
  const sessionId = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await db.session.create({
    data: {
      id: sessionId,
      userId,
      role: Role.editor,
      expiresAt,
    },
  });

  setSessionCookie(response, sessionId, expiresAt);

  return toAuthSessionDto({
    sessionId,
    role: Role.editor,
    username,
  });
}

export async function createViewerSession(db: DbClient, response: Response) {
  const sessionId = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await db.session.create({
    data: {
      id: sessionId,
      role: Role.viewer,
      expiresAt,
    },
  });

  setSessionCookie(response, sessionId, expiresAt);

  return toAuthSessionDto({
    sessionId,
    role: Role.viewer,
    username: null,
  });
}

export async function destroySession(db: DbClient, sessionId: string | null, response: Response) {
  if (sessionId) {
    await db.session.deleteMany({
      where: { id: sessionId },
    });
  }

  clearSessionCookie(response);
}

export async function authMiddleware(request: Request, response: Response, next: NextFunction) {
  const sessionId = getCookieValue(request.headers.cookie, SESSION_COOKIE_NAME);

  if (!sessionId) {
    (request as AuthedRequest).auth = null;
    next();
    return;
  }

  try {
    const session = await (request.app.locals.prisma as PrismaClient).session.findUnique({
      where: { id: sessionId },
      include: {
        user: {
          select: {
            username: true,
          },
        },
      },
    });

    if (!session || session.expiresAt.getTime() <= Date.now()) {
      if (session) {
        await (request.app.locals.prisma as PrismaClient).session.deleteMany({
          where: { id: session.id },
        });
      }

      clearSessionCookie(response);
      (request as AuthedRequest).auth = null;
      next();
      return;
    }

    const nextExpiry = new Date(Date.now() + SESSION_DURATION_MS);
    await (request.app.locals.prisma as PrismaClient).session.update({
      where: { id: session.id },
      data: { expiresAt: nextExpiry },
    });
    setSessionCookie(response, session.id, nextExpiry);

    (request as AuthedRequest).auth = {
      sessionId: session.id,
      role: session.role,
      username: session.user?.username ?? null,
    };

    next();
  } catch (error) {
    next(error);
  }
}

export function getRequestAuth(request: Request) {
  return (request as AuthedRequest).auth ?? null;
}

export function requireAuthenticated(request: Request, _response: Response, next: NextFunction) {
  if (!getRequestAuth(request)) {
    next(new AppError('Authentication required', 401));
    return;
  }

  next();
}

export function requireEditor(request: Request, _response: Response, next: NextFunction) {
  const auth = getRequestAuth(request);

  if (!auth) {
    next(new AppError('Authentication required', 401));
    return;
  }

  if (auth.role !== Role.editor) {
    next(new AppError('Editor access required', 403));
    return;
  }

  next();
}
