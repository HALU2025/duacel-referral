'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import liff from '@line/liff'
import { Loader2, AlertTriangle, Sparkles } from 'lucide-react'

// --- ヘルパー関数 ---
const generateSecureToken = () => {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  return Array.from({ length: 16 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

const generateReferralCode = () => {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  return 'ref_' + Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

// ★ LINE公式アカウントのID
const LINE_BOT_ID = '@980zdibk'

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  const [statusText, setStatusText] = useState('LINEの認証を確認中...')

  useEffect(() => {
    const processLiff = async () => {
      try {
        const liffId = '2009841778-MVVi0glN' // 本番用IDを直書き！
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
          
          if (token) {
            setStatusText('トークルームへ移動します...')
            window.location.href = `https://line.me/R/ti/p/${LINE_BOT_ID}`
          } else {
            setStatusText('マイページを開きます...')
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

        // 店舗がすでに作られているかチェック
        let shopId = ''
        const { data: existingShop } = await supabase
          .from('shops')
          .select('id, name')
          .eq('invite_token', token)
          .maybeSingle()

        if (existingShop) {
          shopId = existingShop.id
        } else {
          // 誰も店舗を作っていなければ「未設定」で作成
          const { data: newShop, error: shopErr } = await supabase
            .from('shops')
            .insert([{ name: '店舗名未設定', invite_token: token }])
            .select('id')
            .single()
            
          if (shopErr) throw shopErr
          shopId = newShop.id
        }

        // スタッフを登録！
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
        
// ★ デバッグ用（改良版）：エラーを正確に読み取る
        setStatusText('連携メッセージを送信中...')
        try {
          const displayShopName = existingShop ? existingShop.name : '店舗名未設定';

          const res = await fetch('/api/line/send-welcome', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              lineUserId: profile.userId,
              shopName: displayShopName
            })
          })

          if (!res.ok) {
            // ★修正：JSONではなく、そのまま文字として読み取る（ズッコケ防止）
            const errorText = await res.text()
            alert(`【送信エラー】\nステータス: ${res.status}\n中身: ${errorText.substring(0, 100)}...`)
          } else {
            alert('✅ APIからのメッセージ送信指令が成功しました！')
          }
        } catch (fetchErr: any) {
          alert(`【通信エラー】\n裏方ファイルが見つからないか通信に失敗しました。\n詳細: ${fetchErr.message}`)
        }

        // メッセージ送信後、トークルームへジャンプ！
        setStatusText('登録完了！トークルームへ移動します...')
        setTimeout(() => {
          window.location.href = `https://line.me/R/ti/p/${LINE_BOT_ID}`
        }, 500)

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