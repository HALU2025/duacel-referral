import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // 1. URLから「?r=◯◯」というパラメータを探す
  const { searchParams } = new URL(request.url)
  const referralId = searchParams.get('r')

  // 2. もしURLに「r」が入っていたら
  if (referralId) {
    // 3. レスポンス（画面を表示する準備）を作る
    const response = NextResponse.next()

    // 4. Cookieに「referral_id」という名前で保存する
    // maxAge: 60 * 60 * 24 * 30 は「30日間」という意味です
    response.cookies.set('referral_id', referralId, {
      maxAge: 60 * 60 * 24 * 30, 
      path: '/',
    })

    console.log('✅ リファラルIDを保存しました:', referralId)
    return response
  }

  return NextResponse.next()
}

// このミドルウェアを動かす範囲（基本全部でOK）
export const config = {
  matcher: '/:path*',
}