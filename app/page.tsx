// app/page.tsx
import Link from 'next/link'
import { Sparkles, ArrowRight } from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
      <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-indigo-600 text-white mb-8 shadow-2xl shadow-indigo-200">
        <Sparkles className="w-10 h-10" />
      </div>
      <h1 className="text-5xl font-black text-gray-900 tracking-tight mb-4">Duacel</h1>
      <p className="text-xl text-gray-500 mb-12 max-w-md leading-relaxed">
        美容師さんのための、<br/>次世代紹介報酬管理プラットフォーム
      </p>
      <div className="flex flex-col w-full max-w-xs gap-4">
        <Link href="/join" className="py-4 bg-indigo-600 text-white rounded-2xl font-bold text-lg shadow-lg hover:bg-indigo-700 transition-all flex items-center justify-center gap-2">
          今すぐ始める <ArrowRight className="w-5 h-5" />
        </Link>
        <Link href="/login" className="py-4 bg-gray-50 text-gray-600 rounded-2xl font-bold text-lg hover:bg-gray-100 transition-all">
          ログイン
        </Link>
      </div>
    </div>
  )
}