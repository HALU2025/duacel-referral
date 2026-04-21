'use client'

import { useEffect } from 'react'
import { Loader2 } from 'lucide-react'

export default function LiffCallbackPage() {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      // LINEがくっつけてくれた「元のURL」のメモを取り出す
      const liffState = params.get('liff.state')
      
      if (liffState) {
        // メモがあれば、元のページ（/m/xxxx など）へ即座に転送
        window.location.replace(liffState)
      } else {
        // 万が一メモがなければ、安全のためにトップページへ戻す
        window.location.replace('/')
      }
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