'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import liff from '@line/liff'
import { Loader2, AlertTriangle, Sparkles } from 'lucide-react'

// --- ヘルパー関数 ---
const generateSecureToken = () => {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  // マイページのURLになる推測不可能なトークン（16文字）
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

        // 1. LIFF初期化
        await liff.init({ liffId })

        // 2. 未ログインならLINEログイン画面へ
        if (!liff.isLoggedIn()) {
          liff.login({ redirectUri: window.location.href })
          return
        }

        // 3. LINEプロフィールを取得
        setStatusText('プロフィール情報を取得中...')
        const profile = await liff.getProfile()
        const lineUserId = profile.userId

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
          // 既に登録されている場合は、そのままマイページへ！
          sessionStorage.setItem(`duacel_auth_${existingStaff.secret_token}`, 'true')
          router.replace(`/m/${existingStaff.secret_token}`)
          return
        }

        // ==========================================
        // ✨ B. 新規ユーザーの自動登録処理（魔法のドア）
        // ==========================================
        setStatusText('アカウントを自動作成中...')
        
        // 招待トークンがURLにあるか確認（p/[token] から引き継がれる）
        const token = searchParams.get('token')
        if (!token) {
          setError('招待QRコードからアクセスしてください。')
          return
        }

        // 店舗がすでに作られているかチェック
        let shopId = ''
        const { data: existingShop } = await supabase
          .from('shops')
          .select('id')
          .eq('invite_token', token)
          .maybeSingle()

        if (existingShop) {
          // すでに誰かがこのQRで店舗を作っていたら、それに相乗りする
          shopId = existingShop.id
        } else {
          // 誰も店舗を作っていなければ（1人目なら）、「未設定」で仮の店舗を自動作成！
          const { data: newShop, error: shopErr } = await supabase
            .from('shops')
            .insert([{ 
              name: '店舗名未設定', 
              invite_token: token 
            }])
            .select('id')
            .single()
            
          if (shopErr) throw shopErr
          shopId = newShop.id
        }

        // LINEの情報を使って、スタッフを「メンバー（平社員）」として自動登録！
        const secretToken = generateSecureToken()
        const { error: staffErr } = await supabase
          .from('staffs')
          .insert([{ 
            shop_id: shopId, 
            name: profile.displayName, // LINEの表示名をそのまま使う
            role: 'member',            // 最初は全員ただのメンバー！
            referral_code: generateReferralCode(), 
            secret_token: secretToken, 
            line_user_id: profile.userId,
            line_display_name: profile.displayName,
            line_picture_url: profile.pictureUrl,
            avatar_url: profile.pictureUrl,
            is_deleted: false, 
            is_team_pool_eligible: true 
            // ※ security_pin はDBのデフォルト('0000')が勝手に入ります
          }])

        if (staffErr) throw staffErr

        // 登録完了！顔パス状態にしてマイページへジャンプ！
        sessionStorage.setItem(`duacel_auth_${secretToken}`, 'true')
        router.replace(`/m/${secretToken}`)

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