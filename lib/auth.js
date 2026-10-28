// Edge(미들웨어)와 Node(API) 양쪽에서 쓰는 세션 토큰
export const COOKIE = 'sd_session';

export async function sessionToken() {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) return null;
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode('stabledesk:' + pw)
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function isAuthed(req) {
  const token = await sessionToken();
  if (!token) return true; // 비밀번호 미설정(데모 모드)
  return req.cookies.get(COOKIE)?.value === token;
}
