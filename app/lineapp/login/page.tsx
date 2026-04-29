'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import liff from '@line/liff'
import { Loader2, AlertTriangle, Sparkles } from 'lucide-react'

const generateSecureToken = () => {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  return Array.from({ length: 16 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

const generateReferralCode = () => {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  return 'ref_' + Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  const [statusText, setStatusText] = useState('LINEの認証を確認中...')

  useEffect(() => {
    const processLiff = async () => {
      try {
        const liffId = process.env.NEXT_PUBLIC_LIFF_ID
        if (!liffId) throw new Error('LIFF IDが設定されていません')

        // ※ LINE公式アカウントのID (@から始まるやつ) を設定してください！
        const LINE_BOT_ID = process.env.NEXT_PUBLIC_LINE_BOT_ID || '@your_bot_id'

        await liff.init({ liffId })

        if (!liff.isLoggedIn()) {
          liff.login({ redirectUri: window.location.href })
          return
        }

        setStatusText('プロフィール情報を取得中...')
        const profile = await liff.getProfile()
        const lineUserId = profile.userId
        const token = searchParams.get('token')

        // ==========================================
        // 🚪 A. 既存ユーザーのログイン処理
        // ==========================================
        const { data: existingStaff, error: dbError } = await supabase
          .from('staffs')
          .select('secret_token')
          .eq('line_user_id', lineUserId)
          .maybeSingle()

        if (dbError) throw dbError

        if (existingStaff) {
          sessionStorage.setItem(`duacel_auth_${existingStaff.secret_token}`, 'true')
          
          // ★ 変更：QR（トークンあり）から来たならトークルームへ、それ以外（リッチメニュー）ならマイページへ
          if (token) {
            window.location.href = `https://line.me/R/ti/p/${LINE_BOT_ID}`
          } else {
            router.replace(`/m/${existingStaff.secret_token}`)
          }
          return
        }

        // ==========================================
        // ✨ B. 新規ユーザーの自動登録処理
        // ==========================================
        setStatusText('アカウントを作成中...')
        
        if (!token) {
          setError('招待QRコードからアクセスしてください。')
          return
        }

        let shopId = ''
        const { data: existingShop } = await supabase
          .from('shops')
          .select('id')
          .eq('invite_token', token)
          .maybeSingle()

        if (existingShop) {
          shopId = existingShop.id
        } else {
          const { data: newShop, error: shopErr } = await supabase
            .from('shops')
            .insert([{ name: '店舗名未設定', invite_token: token }])
            .select('id')
            .single()
          if (shopErr) throw shopErr
          shopId = newShop.id
        }

        const secretToken = generateSecureToken()
        const { error: staffErr } = await supabase
          .from('staffs')
          .insert([{ 
            shop_id: shopId, 
            name: profile.displayName,
            role: 'member',
            referral_code: generateReferralCode(), 
            secret_token: secretToken, 
            line_user_id: profile.userId,
            line_display_name: profile.displayName,
            line_picture_url: profile.pictureUrl,
            avatar_url: profile.pictureUrl,
            is_deleted: false, 
            is_team_pool_eligible: true 
          }])

        if (staffErr) throw staffErr

        sessionStorage.setItem(`duacel_auth_${secretToken}`, 'true')
        
        // ★ 変更：新規登録後もトークルームへジャンプさせる！
        window.location.href = `https://line.me/R/ti/p/${LINE_BOT_ID}`

      } catch (err: any) {
        console.error('Login Error:', err)
        setError('自動ログインに失敗しました。詳細: ' + err.message)
      }
    }

    processLiff()
  }, [router, searchParams])

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#fffef2] p-6 text-center">
      {error ? (
        <div className="animate-in fade-in zoom-in duration-300">
          <AlertTriangle className="w-12 h-12 text-[#8a3c3c] mb-4 mx-auto" />
          <p className="text-sm font-bold text-[#1a1a1a] mb-2">エラーが発生しました</p>
          <p className="text-xs text-[#666666] leading-relaxed mb-8">{error}</p>
        </div>
      ) : (
        <div className="animate-in fade-in duration-500 flex flex-col items-center">
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-indigo-500 blur-xl opacity-20 animate-pulse rounded-full"></div>
            <div className="w-16 h-16 bg-white rounded-2xl shadow-xl border border-gray-100 flex items-center justify-center relative z-10">
              <Sparkles className="w-8 h-8 text-indigo-500 animate-pulse" />
            </div>
          </div>
          <Loader2 className="w-6 h-6 animate-spin text-gray-400 mb-4" />
          <p className="text-[11px] font-bold text-gray-600 tracking-widest">{statusText}</p>
        </div>
      )}
    </div>
  )
}

export default function LineLoginPage() {
  return (
    <Suspense fallback={<div className="fixed inset-0 flex flex-col items-center justify-center bg-[#fffef2]"><Loader2 className="w-8 h-8 animate-spin text-[#1a1a1a]" /></div>}>
      <LoginContent />
    </Suspense>
  )
}