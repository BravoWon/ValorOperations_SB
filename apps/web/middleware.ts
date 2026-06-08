import { NextResponse, type NextRequest } from 'next/server';

/**
 * ⚠️ DEMO PLACEHOLDER AUTH GATE — NOT REAL SECURITY.
 *
 * This middleware only checks for the presence of a `valor_demo_auth` cookie so
 * the intended end-to-end flow (login → workspace launcher → Field Operations)
 * can be walked and error-punchlisted. It performs NO real authentication,
 * authorization, signing, or verification. Replace with a real auth provider
 * before this ever leaves a sandbox.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAuthed = request.cookies.has('valor_demo_auth');

  if (!isAuthed && pathname !== '/login') {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    return NextResponse.redirect(loginUrl, 307);
  }

  return NextResponse.next();
}

export const config = {
  // Skip /api (route handlers carry their own auth), /login, Next internals/
  // static, and any path with a file extension.
  matcher: ['/((?!api|login|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
