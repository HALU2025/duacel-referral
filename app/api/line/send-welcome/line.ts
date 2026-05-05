import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { lineUserId, shopName } = await request.json()

    if (!lineUserId) {
      return NextResponse.json({ error: 'LINE User ID is required' }, { status: 400 })
    }

    const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN
    if (!accessToken) {
      console.error('Missing LINE_CHANNEL_ACCESS_TOKEN')
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    // LINE Messaging API にプッシュメッセージを送信
    const response = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        to: lineUserId,
        messages: [
          {
            type: 'text',
            text: `✨ Duacelパートナー連携が完了しました！\n\n店舗：${shopName === '店舗名未設定' ? '登録待ち' : shopName}\n\n👇 下のメニューの「マイページ」から、すぐに紹介をはじめられます！`
          }
        ]
      })
    })

    if (!response.ok) {
      const errorData = await response.json()
      console.error('LINE API Error:', JSON.stringify(errorData))
      return NextResponse.json({ error: 'Failed to send LINE message' }, { status: response.status })
    }

    return NextResponse.json({ success: true })

  } catch (error: any) {
    console.error('Push Message Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}