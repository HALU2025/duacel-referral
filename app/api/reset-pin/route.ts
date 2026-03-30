import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// いただいたMakeのWebhook URL
const MAKE_WEBHOOK_URL = 'https://hook.us2.make.com/pdcqxfykvnz4a256ojhupwhuz7m482xv'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { secretToken, email } = body

    if (!secretToken || !email) {
      throw new Error('必要な情報が不足しています。')
    }

    // 1. スタッフの特定とメールアドレスの照合（セキュリティチェック）
    const { data: staff, error: fetchError } = await supabase
      .from('staffs')
      .select('*')
      .eq('secret_token', secretToken)
      .single()

    if (fetchError || !staff) throw new Error('スタッフ情報が見つかりません。')
    
    if (staff.email !== email) {
      throw new Error('登録されているメールアドレスと一致しません。')
    }

    // 2. 新しい4桁のPINを生成（1000〜9999のランダムな数字）
    const newPin = Math.floor(1000 + Math.random() * 9000).toString()

    // 3. データベースのPINを新しいものに上書き
    const { error: updateError } = await supabase
      .from('staffs')
      .update({ security_pin: newPin })
      .eq('id', staff.id)

    if (updateError) throw new Error('PINの更新に失敗しました。')

    // 4. MakeのWebhookをキック（JSONでデータを送信）
    const webhookResponse = await fetch(MAKE_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: staff.name,
        email: staff.email,
        new_pin: newPin,
        secret_token: staff.secret_token
      })
    })

    if (!webhookResponse.ok) {
      console.error('Make Webhook Error:', await webhookResponse.text())
      // Webhookが失敗してもDBのPINは更新されているため、エラーにはしない
    }

    return NextResponse.json({ success: true })

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 })
  }
}