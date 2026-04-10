import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#fffef2] flex flex-col items-center justify-center p-6 text-center font-sans text-[#333333] selection:bg-[#e6e2d3] selection:text-[#333333]">
      <div className="flex flex-col items-center justify-center mb-16">
        <h1 className="text-5xl font-black font-inter tracking-normal text-[#1a1a1a] mb-6">
          Duacel<sup className="text-2xl font-medium -ml-1">®</sup>
        </h1>
        <p className="text-sm text-[#666666] tracking-widest leading-loose">
          美容師さんのための、<br/>次世代紹介報酬管理プラットフォーム
        </p>
      </div>
      <div className="flex flex-col w-full max-w-xs gap-4">
        {/* Primary Action */}
        <Link href="/join" className="w-full py-5 bg-[#1a1a1a] text-[#fffef2] text-sm tracking-widest transition-all active:scale-[0.98] flex items-center justify-center gap-2">
          今すぐ始める <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
        </Link>
        {/* Secondary Action */}
        <Link href="/verify" className="w-full py-5 bg-[#f5f2e6] border border-[#e6e2d3] text-[#333333] text-[11px] tracking-widest uppercase hover:bg-[#e6e2d3] transition-all active:scale-[0.98]">
          管理画面へ (ご本人確認)
        </Link>
      </div>
    </div>
  )
}