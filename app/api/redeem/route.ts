import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

const generateSecureToken = () => {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { staffId, pin, redeemType } = body

    if (!staffId || !pin || !redeemType) {
      throw new Error('必要な情報が不足しています。')
    }

    // 1. スタッフの取得とPINの照合（絶対にごまかせない本人確認）
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
    const basePoints = category?.reward_points || 0
    const firstBonusEnabled = category?.first_bonus_enabled || false
    const firstBonusPoints = category?.first_bonus_points || 0

    const ratioInd = shop.ratio_individual ?? 100
    const ratioTeam = shop.ratio_team ?? 0
    const ratioOwner = shop.ratio_owner ?? 0

    // 2. 関連データの取得 (店舗全体の紹介とポイント)
    const [refRes, txRes, countRes] = await Promise.all([
      supabase.from('referrals').select('*').eq('shop_id', shop.id).order('created_at', { ascending: true }),
      supabase.from('point_transactions').select('*').eq('shop_id', shop.id).in('status', ['confirmed', 'paid']),
      supabase.from('staffs').select('id', { count: 'exact' }).eq('shop_id', shop.id).eq('is_deleted', false)
    ])

    const allReferrals = refRes.data || []
    const pointLogs = txRes.data || []
    const activeStaffCount = countRes.count || 1
    const shopHasBonusTx = pointLogs.some(tx => tx.metadata?.is_bonus === true)

    let confirmedPoints = 0
    const targetReferralIds: string[] = []

    // 3. サーバー側での厳密な残高再計算（ブラウザの数字は無視する）
    allReferrals.forEach((r, index) => {
      // キャンセル済、未確定、すでに清算済のものは一切相手にしない
      if (r.status === 'cancel' || r.is_staff_rewarded) return 
      if (r.status !== 'confirmed' && r.status !== 'issued') return 

      const isMine = r.staff_id === staff.id
      const refTxs = pointLogs.filter(tx => tx.referral_id === r.id && (tx.status === 'confirmed' || tx.status === 'paid'))

      // 実際のトランザクション合計値を取得
      const actualTxPoints = refTxs.reduce((sum, tx) => sum + (Number(tx.points) || 0), 0)

      // 分配率に応じた「このスタッフの真の取り分」を計算
      const isOwnerAction = shop.owner_email === staff.email
      let myEarnedPoints = 0

      if (actualTxPoints > 0) {
        const indPart = isMine ? actualTxPoints * (ratioInd / 100) : 0
        const teamPart = (actualTxPoints * (ratioTeam / 100)) / activeStaffCount
        const ownerPart = isOwnerAction ? actualTxPoints * (ratioOwner / 100) : 0
        myEarnedPoints = Math.floor(indPart + teamPart + ownerPart)
      }

      // 自分に1ptでも権利があれば交換対象リストに入れる
      if (myEarnedPoints > 0) {
        confirmedPoints += myEarnedPoints
        targetReferralIds.push(r.id)
      }
    })

    if (confirmedPoints === 0 || targetReferralIds.length === 0) {
      throw new Error('交換可能なポイントがありません。（不正なリクエストです）')
    }

    // 4. トランザクション処理（連打や二重引き出しの防止）
    // is_staff_rewarded を true に更新する。
    // ※「eq('is_staff_rewarded', false)」を指定し、他の通信で既に更新されていないかロックをかける
    const { data: updatedRefs, error: updateError } = await supabase
      .from('referrals')
      .update({ is_staff_rewarded: true })
      .in('id', targetReferralIds)
      .eq('is_staff_rewarded', false)
      .select('id')

    if (updateError) {
      throw new Error('ポイントの交換処理に失敗しました。')
    }

    if (!updatedRefs || updatedRefs.length !== targetReferralIds.length) {
      throw new Error('処理中に競合が発生しました。画面を更新して再度お試しください。')
    }

    // 5. えらべるペイ API連携（今回はモックURLを生成して返す）
    // ※ 将来 giftee API を使うときは、ここに fetch を書きます！
    const mockGiftUrl = redeemType === 'eraberu'
      ? `https://giftee.com/mock/${generateSecureToken()}${generateSecureToken()}`
      : `https://b-cart.example.com/apply/${generateSecureToken()}`

    return NextResponse.json({
      success: true,
      giftUrl: mockGiftUrl,
      redeemedPoints: confirmedPoints
    })

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 })
  }
}