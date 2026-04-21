'use client'

import { useEffect } from 'react'
import { Loader2 } from 'lucide-react'

export default function LiffCallbackPage() {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // 1. ブラウザがこっそり覚えていた「元の場所（/m/L0P0など）」を取り出す
      const redirectTo = sessionStorage.getItem('liff_redirect') || '/'
      
      // 2. 使い終わったメモはお掃除しておく
      sessionStorage.removeItem('liff_redirect')

      // 3. 元のマイページへ瞬時に転送！
      window.location.replace(redirectTo)
    }
  }, [])

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#fffef2]">
      <Loader2 className="w-8 h-8 animate-spin text-[#1a1a1a] mb-4" />
      <p className="text-[10px] text-[#999999] tracking-[0.2em] animate-pulse uppercase">
        Redirecting...
      </p>
    </div>
  )
}