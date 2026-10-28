'use client';
import { useState } from 'react';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    setBusy(false);
    if (res.ok) window.location.href = '/dashboard';
    else setError((await res.json()).error || '로그인하지 못했습니다.');
  }

  return (
    <main className="login">
      <div className="panel">
        <h2>StableDesk 로그인</h2>
        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="pw">비밀번호</label>
            <input id="pw" type="password" autoFocus value={password}
              onChange={(e) => setPassword(e.target.value)} />
            <span className="hint">Vercel 환경변수 ADMIN_PASSWORD에 넣은 값입니다.</span>
          </div>
          <button className="btn" disabled={busy || !password}>로그인</button>
          {error && <p className="error">{error}</p>}
        </form>
      </div>
    </main>
  );
}
