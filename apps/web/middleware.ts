import { NextResponse, type NextRequest } from 'next/server';
import { supabaseConfigured, decideAuth } from '@/lib/supabase/config';
import { updateSession } from '@/lib/supabase/middleware-client';

/**
 * Real auth gate (configured) / open demo (unconfigured). When Supabase is
 * configured, refresh the session each request and redirect unauthenticated
 * users (except on the public sign-in paths) to /login. When NOT configured the
 * app is the open mock demo — pass everything through. (Static export ignores
 * middleware entirely; the client AuthGate enforces the demo cookie there.)
 */
export async function middleware(request: NextRequest) {
  if (!supabaseConfigured()) return NextResponse.next();

  const { response, user } = await updateSession(request);
  if (decideAuth(true, Boolean(user), request.nextUrl.pathname) === 'redirect') {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
