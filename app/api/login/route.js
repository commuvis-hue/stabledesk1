import { NextResponse } from 'next/server';
import { COOKIE, sessionToken } from '@/lib/auth';

export async function POST(req) {
  const { password } = await req.json().catch(() => ({}));
  const token = await sessionToken();
  if (!token) return NextResponse.json({ ok: true });
  if (password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: '비밀번호가 맞지 않습니다.' }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(COOKIE);
  return res;
}
