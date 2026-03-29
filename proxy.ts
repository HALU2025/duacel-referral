import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// ★ 修正：関数名を `middleware` から `proxy` に変更しました！
export function proxy(request: NextRequest) {
  // 準備：後でCookieをセットしたり、そのまま画面を表示させるためのベース
  const response = NextResponse.next()

// ★ 追加：ecforceからのWebhook通信だけは、Basic認証をスルーして通す！
  if (request.nextUrl.pathname.startsWith('/api/webhooks')) {
    return response;
  }

  // ========================================================
  // 🔒 1. Basic認証（開発中の全体ロック）
  // 【つけ外しの方法】
  // ここの `ENABLE_BASIC_AUTH` を false にするだけで一瞬で解除できます。
  // ========================================================
  const ENABLE_BASIC_AUTH = true

  if (ENABLE_BASIC_AUTH) {
    const basicAuth = request.headers.get('authorization')
    // Vercelで環境変数を設定していない場合は test / 1234 になります
    const user = process.env.BASIC_AUTH_USER || 'test'
    const pwd = process.env.BASIC_AUTH_PASSWORD || '1234'

    // 認証情報がない、または間違っている場合は弾く
    if (!basicAuth) {
      return new NextResponse('認証が必要です。 (Auth required)', {
        status: 401,
        headers: { 'WWW-Authenticate': 'Basic realm="Secure Area"' },
      })
    }

    const authValue = basicAuth.split(' ')[1]
    const [providedUser, providedPwd] = atob(authValue).split(':')

    if (providedUser !== user || providedPwd !== pwd) {
      return new NextResponse('認証が必要です。 (Auth required)', {
        status: 401,
        headers: { 'WWW-Authenticate': 'Basic realm="Secure Area"' },
      })
    }
  }

  // ========================================================
  // 🎁 2. リファラルIDの保存処理（既存機能）
  // Basic認証を突破した人（または認証オフの時）だけここを通ります
  // ========================================================
  const { searchParams } = new URL(request.url)
  const referralId = searchParams.get('r')

  if (referralId) {
    // Cookieに「referral_id」という名前で保存する (30日間)
    response.cookies.set('referral_id', referralId, {
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    })
    console.log('✅ リファラルIDを保存しました:', referralId)
  }

  // ========================================================
  // 👮 3. 【将来用】 /admin へのアクセス制限
  // ========================================================
  // if (request.nextUrl.pathname.startsWith('/admin')) {
  //   // 今後、ここに「アドミン用のパスワード要求」や
  //   // 「Supabaseの権限チェック」のコードを追加します。
  // }

  // 全ての処理が終わったらレスポンスを返す
  return response
}

// ========================================================
// ⚙️ ミドルウェアを動かす範囲の設定
// ========================================================
export const config = {
  // 画像やNext.jsの裏側（_next/staticなど）はミドルウェアをスルーさせる。
  // これをやらないと、画像1枚1枚にBasic認証のポップアップが出て画面がバグります。
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}