'use client'

import { useEffect, useState } from 'react'
import liff from '@line/liff'
import { Loader2, AlertTriangle } from 'lucide-react'

export default function LiffCallbackPage() {
  const [error, setError] = useState('')

  useEffect(() => {
    const processLiffLogin = async () => {
      try {
        const liffId = process.env.NEXT_PUBLIC_LIFF_ID
        if (!liffId) throw new Error('LIFF IDが設定されていません')

        // ① 待合室でLIFFを初期化し、URLにくっついてきた「カギ(code)」を処理する
        await liff.init({ liffId })

        // ② ブラウザがこっそり覚えていた「元の場所（/m/L0P0など）」を取り出す
        const redirectTo = sessionStorage.getItem('liff_redirect') || '/'
        
        // ③ 使い終わったメモはお掃除
        sessionStorage.removeItem('liff_redirect')

        // ④ カギを受け取ってログイン状態になったので、元のマイページへ転送！
        window.location.replace(redirectTo)
        
      } catch (err: any) {
        console.error('Callback Error:', err)
        setError('連携処理に失敗しました。数秒後にトップへ戻ります。')
        setTimeout(() => {
          window.location.replace('/')
        }, 3000)
      }
    }

    processLiffLogin()
  }, [])

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#fffef2]">
      {error ? (
        <>
          <AlertTriangle className="w-8 h-8 text-[#8a3c3c] mb-4" />
          <p className="text-[10px] text-[#8a3c3c] tracking-widest">{error}</p>
        </>
      ) : (
        <>
          <Loader2 className="w-8 h-8 animate-spin text-[#1a1a1a] mb-4" />
          <p className="text-[10px] text-[#999999] tracking-[0.2em] animate-pulse uppercase">
            Authenticating...
          </p>
        </>
      )}
    </div>
  )
}