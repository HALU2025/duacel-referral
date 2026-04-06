import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { HttpsProxyAgent } from 'https-proxy-agent'
import fetch from 'node-fetch' 

// Vercel環境等でプロキシ(https-proxy-agent)を使用するため、Node.jsランタイムを強制する
export const runtime = 'nodejs'

const generateSecureToken = () => {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export async function POST(request: Request) {
  let targetReferralIds: string[] = []
  let exchangeId: string | null = null

  try {
    const body = await request.json()
    const { staffId, pin, redeemType } = body

    if (!staffId || !pin || !redeemType) {
      throw new Error('必要な情報が不足しています。')
    }

    // 1. スタッフの取得とPINの照合
    const { data: staff, error: staffError } = await supabase
      .from('staffs')
      .select('*, shops(*, shop_categories(*))')
      .eq('id', staffId)
      .single()

    if (staffError || !staff) throw new Error('スタッフ情報の取得に失敗しました。')
    if (staff.security_pin && staff.security_pin !== pin) {
      throw new Error('暗証番号が間違っています。')
    }

    const shop = staff.shops
    const category = shop.shop_categories
    const ratioInd = shop.ratio_individual ?? 100
    const ratioTeam = shop.ratio_team ?? 0
    const ratioOwner = shop.ratio_owner ?? 0

    // 2. 関連データの取得
    const [refRes, txRes, countRes] = await Promise.all([
      supabase.from('referrals').select('*').eq('shop_id', shop.id).order('created_at', { ascending: true }),
      supabase.from('point_transactions').select('*').eq('shop_id', shop.id).in('status', ['confirmed', 'paid']),
      supabase.from('staffs').select('id', { count: 'exact' }).eq('shop_id', shop.id).eq('is_deleted', false)
    ])

    const allReferrals = refRes.data || []
    const pointLogs = txRes.data || []
    const activeStaffCount = countRes.count || 1

    let confirmedPoints = 0

    // 3. サーバー側での厳密な残高再計算
    allReferrals.forEach((r) => {
      if (r.status === 'cancel' || r.is_staff_rewarded) return 
      if (r.status !== 'confirmed' && r.status !== 'issued') return 

      const isMine = r.staff_id === staff.id
      const refTxs = pointLogs.filter(tx => tx.referral_id === r.id && (tx.status === 'confirmed' || tx.status === 'paid'))
      const actualTxPoints = refTxs.reduce((sum, tx) => sum + (Number(tx.points) || 0), 0)

      const isOwnerAction = shop.owner_email === staff.email
      let myEarnedPoints = 0

      if (actualTxPoints > 0) {
        const indPart = isMine ? actualTxPoints * (ratioInd / 100) : 0
        const teamPart = (actualTxPoints * (ratioTeam / 100)) / activeStaffCount
        const ownerPart = isOwnerAction ? actualTxPoints * (ratioOwner / 100) : 0
        myEarnedPoints = Math.floor(indPart + teamPart + ownerPart)
      }

      if (myEarnedPoints > 0) {
        confirmedPoints += myEarnedPoints
        targetReferralIds.push(r.id)
      }
    })

    if (confirmedPoints === 0 || targetReferralIds.length === 0) {
      throw new Error('交換可能なポイントがありません。（不正なリクエストです）')
    }

    // 4. 金庫（reward_exchanges）に「処理中」のレコードを作成し、issue_identity を取得する
    const { data: newExchangeId, error: rpcError } = await supabase.rpc('create_exchange_request', {
      p_shop_id: shop.id,
      p_staff_id: staff.id,
      p_points_consumed: confirmedPoints,
      p_gift_value: confirmedPoints
    })

    if (rpcError || !newExchangeId) throw new Error('交換リクエストの生成に失敗しました。')
    exchangeId = newExchangeId

    // 5. 該当のreferralsを「交換済み(is_staff_rewarded=true)」にロックする
    const { data: updatedRefs, error: updateError } = await supabase
      .from('referrals')
      .update({ is_staff_rewarded: true })
      .in('id', targetReferralIds)
      .eq('is_staff_rewarded', false)
      .select('id')

    if (updateError || !updatedRefs || updatedRefs.length !== targetReferralIds.length) {
      throw new Error('処理中に競合が発生しました。画面を更新して再度お試しください。')
    }

    // 6. giftee API 連携（固定IPプロキシ経由）
    let giftUrl = ''

    // ※環境変数に FIXIE_URL と GIFTEE_AUTH_TOKEN がある場合のみ本番通信を行う安全設計
    if (process.env.FIXIE_URL && process.env.GIFTEE_AUTH_TOKEN && redeemType === 'eraberu') {
      const gifteeApiUrl = 'https://g4b.giftee.biz/api/giftee_boxes.json'
      
      const response = await fetch(gifteeApiUrl, {
        method: 'POST',
        agent: new HttpsProxyAgent(process.env.FIXIE_URL), // 固定IPトンネルを通す
        headers: {
          'Authorization': `Basic ${process.env.GIFTEE_AUTH_TOKEN}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: `giftee_box_config_code=${process.env.GIFTEE_BOX_CODE}&issue_identity=${exchangeId}&initial_point=${confirmedPoints}`
      })

      const result = await response.json()

      if (response.status === 423 || response.status === 401) {
        // 【重要】限度額エラー・認証エラーは「致命的」なため、ポイントを返還してロールバック
        await supabase.from('referrals').update({ is_staff_rewarded: false }).in('id', targetReferralIds)
        await supabase.from('reward_exchanges').update({ status: 'failed_fatal', error_details: result }).eq('id', exchangeId)
        throw new Error('現在、システムの交換枠が上限に達しています。運営の対応をお待ちください。')
      }

      if (response.status === 504) {
        // タイムアウト時はポイントは引いたまま「再送待ち」にする（後続のバッチ処理等でリカバリ可能）
        await supabase.from('reward_exchanges').update({ status: 'failed_retryable', error_details: result }).eq('id', exchangeId)
        throw new Error('通信が混雑しています。しばらく経ってからマイページをご確認ください。')
      }

      if (!response.ok) {
        // その他の予期せぬエラーも一旦安全のためロールバック
        await supabase.from('referrals').update({ is_staff_rewarded: false }).in('id', targetReferralIds)
        await supabase.from('reward_exchanges').update({ status: 'failed_fatal', error_details: result }).eq('id', exchangeId)
        throw new Error('ギフトの発行に失敗しました。')
      }

      giftUrl = result.url

    } else {
      // 開発環境用のモックURL発行
      giftUrl = redeemType === 'eraberu'
        ? `https://giftee.com/mock/${generateSecureToken()}${generateSecureToken()}`
        : `https://b-cart.example.com/apply/${generateSecureToken()}`
    }

    // 7. 大成功：金庫（reward_exchanges）のステータスを完了にし、URLを保存
    await supabase.from('reward_exchanges').update({ 
      status: 'completed', 
      gift_url: giftUrl 
    }).eq('id', exchangeId)

    return NextResponse.json({
      success: true,
      giftUrl: giftUrl,
      redeemedPoints: confirmedPoints
    })

  } catch (error: any) {
    // 処理中の予期せぬクラッシュ（DBエラーなど）が発生した場合のセーフティネット
    if (exchangeId && targetReferralIds.length > 0) {
       // ※ここで確実にロールバックを保証する場合はバッチ処理との併用を推奨しますが、フェイルセーフとして記述します
       await supabase.from('referrals').update({ is_staff_rewarded: false }).in('id', targetReferralIds).catch(() => {})
       await supabase.from('reward_exchanges').update({ status: 'failed_fatal', error_details: { message: error.message } }).eq('id', exchangeId).catch(() => {})
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 400 })
  }
}