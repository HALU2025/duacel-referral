// app/api/webhooks/ecforce/route.ts
import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
// ★ 追加: さきほど作ったLINE通知エンジンをインポート
import { sendLineNotification } from '@/lib/line'

// ==========================================
// 共通のデータ保存ロジック
// ==========================================
async function processWebhookData(referralCode: string | null, orderNumber: string | null, customerId: string | null) {
  if (!referralCode) {
    return NextResponse.json({ error: '紹介コードが含まれていません' }, { status: 400 })
  }

  // "S001_ST001" を shop_id と staff_id に分割
  const [shopId, staffId] = referralCode.split('_')

  if (!shopId || !staffId) {
    return NextResponse.json({ error: '無効な紹介コードのフォーマットです' }, { status: 400 })
  }

  // 受注番号がない場合はタイムスタンプで仮生成
  const finalOrderNumber = orderNumber || `ORD-${Date.now()}`

  // データベース（referrals）に「仮計上」として登録
  const { error } = await supabase.from('referrals').insert([{
    shop_id: shopId,
    staff_id: staffId,
    referral_code: referralCode,
    order_number: finalOrderNumber,
    customer_id: customerId, // 顧客IDを保存
    status: 'pending',
    is_staff_rewarded: false
  }])

  if (error) {
    console.error('❌ DB保存エラー:', error)
    return NextResponse.json({ error: 'データベースエラーが発生しました' }, { status: 500 })
  }

  console.log(`✅ 成果を記録しました: 紹介コード[${referralCode}] / 注文[${finalOrderNumber}] / 顧客ID[${customerId || 'なし'}]`)

  // ▼▼▼ ★ 追加: LINE通知の処理 ▼▼▼
  try {
    // 紹介元のスタッフ情報を取得（LINE IDを取り出す）
    const { data: staff } = await supabase
      .from('staffs')
      .select('line_user_id, name')
      .eq('id', staffId) // 分割したstaffIdで検索
      .maybeSingle()

    // スタッフが存在し、かつLINE連携済み(line_user_idがある)場合のみ通知を送る
    if (staff && staff.line_user_id) {
      const message = `🎉 新しい紹介が発生しました！\n\nお客様のご注文が確認されました。\n状態: 仮計上（確定待ち）\n\n商品のお届けが完了すると、報酬ポイントとして確定します！\n\n▼マイページで詳細を確認する\nhttps://duacel.net/lineapp/login`

      const isSuccess = await sendLineNotification(staff.line_user_id, message)
      if (isSuccess) {
        console.log(`📲 LINE通知を送信しました: ${staff.name}`)
      }
    }
  } catch (err) {
    console.error('❌ LINE通知処理でエラーが発生しました:', err)
    // 通知が失敗しても、成果自体は記録できているので処理は続行する
  }
  // ▲▲▲ ここまで追加 ▲▲▲

  return NextResponse.json({ success: true, message: '成果を記録しました' }, { status: 200 })
}

// ==========================================
// GETリクエスト（ecforceからURLパラメータで来る場合）
// ==========================================
export async function GET(request: Request) {
  console.log('📦 ecforceからGET通知を受信しました')
  const { searchParams } = new URL(request.url)
  
  const referralCode = searchParams.get('r') || searchParams.get('referral_code')
  const orderNumber = searchParams.get('order_id') || searchParams.get('order_number')
  const customerId = searchParams.get('customer_id') || searchParams.get('member_id')

  return processWebhookData(referralCode, orderNumber, customerId)
}

// ==========================================
// POSTリクエスト（ecforceからJSON等で来る場合）
// ==========================================
export async function POST(request: Request) {
  console.log('📦 ecforceからPOST通知を受信しました')
  try {
    const body = await request.text()
    let data: any = {}
    
    try {
      data = JSON.parse(body)
    } catch (e) {
      const params = new URLSearchParams(body)
      params.forEach((value, key) => { data[key] = value })
    }

    const referralCode = data.r || data.referral_code
    const orderNumber = data.order_id || data.order_number
    const customerId = data.customer_id || data.member_id

    return processWebhookData(referralCode, orderNumber, customerId)

  } catch (error: any) {
    console.error('❌ POST Webhook エラー:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}