// app/api/webhooks/ecforce/route.ts
import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// ==========================================
// 共通のデータ保存ロジック
// ==========================================
// ★ 変更: 引数に customerId を追加
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
    customer_id: customerId, // 👈 ★ 追加: 顧客IDを保存！
    status: 'pending',
    is_staff_rewarded: false
  }])

  if (error) {
    console.error('❌ DB保存エラー:', error)
    return NextResponse.json({ error: 'データベースエラーが発生しました' }, { status: 500 })
  }

  console.log(`✅ 成果を記録しました: 紹介コード[${referralCode}] / 注文[${finalOrderNumber}] / 顧客ID[${customerId || 'なし'}]`)
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
  // ★ 追加: ecforce側の設定に合わせて customer_id を取得
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
    // ★ 追加: ecforce側の設定に合わせて customer_id を取得
    const customerId = data.customer_id || data.member_id

    return processWebhookData(referralCode, orderNumber, customerId)

  } catch (error: any) {
    console.error('❌ POST Webhook エラー:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}