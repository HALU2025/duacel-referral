// app/actions/admin-auth.ts
'use server'

import { cookies } from 'next/headers'

// 1. ログイン時に「一時Cookie」を発行する
export async function setAdminSessionCookie() {
  const cookieStore = await cookies() // ★ここで await する！

  cookieStore.set('admin_session', 'active', {
    httpOnly: true, // JavaScriptからの読み取りを禁止（XSS対策）
    secure: process.env.NODE_ENV === 'production', // 本番環境ではHTTPS必須
    sameSite: 'lax',
    path: '/',
    // ⚠️ ここに `expires` や `maxAge` を指定しないことで、
    // 「ブラウザを閉じた瞬間に消滅する」セッションCookieになります！
  })
}

// 2. ログアウト時にCookieを削除する
export async function clearAdminSessionCookie() {
  const cookieStore = await cookies() // ★ここも await する！
  
  cookieStore.delete('admin_session')
}