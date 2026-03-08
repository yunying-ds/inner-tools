import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/enter') || pathname.startsWith('/api/auth')) {
    return NextResponse.next();
  }

  // English mode users bypass the invite code gate
  const lang = request.cookies.get('lang')?.value;
  if (lang === 'en') {
    return NextResponse.next();
  }

  const code = request.cookies.get('invite_code')?.value;
  if (code !== process.env.INVITE_CODE) {
    const url = request.nextUrl.clone();
    url.pathname = '/enter';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|audio|logo|icons).*)'],
};
