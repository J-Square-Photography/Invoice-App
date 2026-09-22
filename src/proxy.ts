import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

if (!process.env.JWT_SECRET) {
  throw new Error(
    'JWT_SECRET environment variable is required. Generate one with `openssl rand -hex 32` and set it in .env.local (see .env.example).'
  );
}

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

const COOKIE_NAME = 'jsquare-session';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Protect all /admin routes
  if (pathname.startsWith('/admin')) {
    const token = request.cookies.get(COOKIE_NAME)?.value;

    if (!token) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }

    try {
      const { payload } = await jwtVerify(token, JWT_SECRET);

      // Check if user is active (role check)
      if (!payload.role) {
        throw new Error('Invalid token payload');
      }

      // Developer (SUPER_ADMIN)-only routes
      if (
        (pathname.startsWith('/admin/team') || pathname.startsWith('/admin/settings')) &&
        payload.role !== 'SUPER_ADMIN'
      ) {
        return NextResponse.redirect(new URL('/admin', request.url));
      }

      return NextResponse.next();
    } catch {
      // Invalid token - clear cookie and redirect
      const loginUrl = new URL('/login', request.url);
      const response = NextResponse.redirect(loginUrl);
      response.cookies.delete(COOKIE_NAME);
      return response;
    }
  }

  // Redirect authenticated users away from login page
  // (a login link marked ?expired=1 is left alone: it is how someone whose account was deactivated gets out of a loop)
  if (pathname === '/login' && !request.nextUrl.searchParams.has('expired')) {
    const token = request.cookies.get(COOKIE_NAME)?.value;
    if (token) {
      try {
        await jwtVerify(token, JWT_SECRET);
        return NextResponse.redirect(new URL('/admin', request.url));
      } catch {
        // Invalid token, let them see login page
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/login'],
};
