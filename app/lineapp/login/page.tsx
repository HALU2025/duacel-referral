'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import liff from '@line/liff'
import { Loader2, AlertTriangle } from 'lucide-react'

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)

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

        // ★ 追加：緑のボタンから来た場合（ブラウザのメモがある場合）は、マイページへ戻す！
        const redirectTo = sessionStorage.getItem('liff_redirect')
        if (redirectTo) {
          sessionStorage.removeItem('liff_redirect')
          window.location.replace(redirectTo)
          return
        }

        // 3. リッチメニューから来た場合：LINEプロフィールを取得して自動ログイン
        const profile = await liff.getProfile()
        const lineUserId = profile.userId

        // 4. SupabaseでこのLINE IDを持つスタッフを探す
        const { data: staff, error: dbError } = await supabase
          .from('staffs')
          .select('secret_token')
          .eq('line_user_id', lineUserId)
          .maybeSingle()

        if (dbError) throw dbError

        if (!staff) {
          setError('このLINEアカウントはDuacelに連携されていません。ブラウザから一度ログインして連携を完了させてください。')
          return
        }

        // 5. 転送先のタブ情報を取得
        const targetTab = searchParams.get('tab') || 'qr'

        // 6. マイページの「カギ」をセッションに保存（PIN入力をスキップ）
        sessionStorage.setItem(`duacel_auth_${staff.secret_token}`, 'true')

        // 7. 本人のマイページへ転送！
        router.replace(`/m/${staff.secret_token}?tab=${targetTab}`)

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
          <p className="text-sm font-bold text-[#1a1a1a] mb-2">ログインできません</p>
          <p className="text-xs text-[#666666] leading-relaxed">{error}</p>
          <button onClick={() => window.location.replace('/')} className="mt-8 text-xs underline text-[#999999]">トップへ戻る</button>
        </div>
      ) : (
        <>
          <Loader2 className="w-8 h-8 animate-spin text-[#1a1a1a] mb-4" />
          <p className="text-[10px] text-[#999999] tracking-[0.2em] animate-pulse uppercase">Identifying...</p>
        </>
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