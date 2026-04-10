// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // `/admin` から始まるURLへのアクセスをすべて監視（`/admin-login` は除く）
  if (pathname.startsWith('/admin') && !pathname.startsWith('/admin-login')) {
    
    // STEP 1で発行した「一時Cookie」を持っているかチェック
    const adminSession = request.cookies.get('admin_session')

    if (!adminSession) {
      // Cookieがない（＝未ログイン、またはブラウザを閉じて消滅した）場合
      // 強制的にログイン画面に弾き返す！
      const url = request.nextUrl.clone()
      url.pathname = '/admin-login'
      return NextResponse.redirect(url)
    }
  }

  return NextResponse.next()
}

// ミドルウェアを監視・発動させるパスの指定
export const config = {
  matcher: ['/admin', '/admin/:path*'],
}