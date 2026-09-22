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

      // Team management is not delegable via permissions (see src/lib/permissions.ts), so it stays
      // a hard edge redirect. Settings is now a regular permission (checked, with a live DB lookup,
      // by the page itself and by /api/settings) rather than a role, so it can't be decided here from
      // the JWT's static role claim alone.
      if (pathname.startsWith('/admin/team') && payload.role !== 'SUPER_ADMIN') {
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
