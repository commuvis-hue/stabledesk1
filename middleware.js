import { NextResponse } from 'next/server';
import { isAuthed } from './lib/auth';

export async function middleware(req) {
  if (await isAuthed(req)) return NextResponse.next();
  if (req.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.search = '';
  return NextResponse.redirect(url);
}

export const config = { matcher: ['/dashboard/:path*', '/api/admin/:path*'] };
