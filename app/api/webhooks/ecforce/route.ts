// app/api/webhooks/ecforce/route.ts
import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// ecforceは GET または POST でURLパラメータに値を乗せてくる
export async function GET(request: Request) {
  return handleWebhook(request)
}

export async function POST(request: Request) {
  return handleWebhook(request)
}

async function handleWebhook(request: Request) {
  try {
    // 1. ecforceが送ってきたURLからパラメータを取得
    const { searchParams } = new URL(request.url)
    
    // 例: ?r=S001_ST001&order_id=12345
    const referralCode = searchParams.get('r')
    const orderNumber = searchParams.get('order_id') || searchParams.get('order_number') || `ORD-${Date.now()}`

    console.log('📦 ecforceから成果通知を受信:', { referralCode, orderNumber })

    if (!referralCode) {
      console.error('紹介コードなし')
      return NextResponse.json({ error: '紹介コード(r)が含まれていません' }, { status: 400 })
    }

    // "S001_ST001" を shop_id と staff_id に分割
    const [shopId, staffId] = referralCode.split('_')

    if (!shopId || !staffId) {
      console.error('フォーマットエラー:', referralCode)
      return NextResponse.json({ error: '無効な紹介コードです' }, { status: 400 })
    }

    // 2. 既存の受注番号かチェック（ecforceのリロード等による二重登録防止）
    const { data: existingRef } = await supabase
      .from('referrals')
      .select('id')
      .eq('order_number', orderNumber)
      .single()

    if (existingRef) {
      console.log('⚠️ すでに登録済みの受注番号です:', orderNumber)
      return NextResponse.json({ success: true, message: '既に登録済みです' }, { status: 200 })
    }

    // 3. Duacelのデータベース（referrals）に「仮計上」として登録
    const { error } = await supabase.from('referrals').insert([{
      shop_id: shopId,
      staff_id: staffId,
      referral_code: referralCode,
      order_number: orderNumber,
      status: 'pending', // 最初は必ず「仮計上」
      is_staff_rewarded: false
    }])

    if (error) throw error

    console.log('✅ 成果の記録に成功しました！')
    return NextResponse.json({ success: true, message: '成果を記録しました' }, { status: 200 })

  } catch (error: any) {
    console.error('❌ ecforce Webhook エラー:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}