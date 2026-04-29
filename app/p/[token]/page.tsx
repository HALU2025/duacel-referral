'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion' 
import { Loader2, Store, Users, ArrowRight, CheckCircle2, MessageCircle } from 'lucide-react'

// ※ 実際のLIFF IDに書き換えてください（LINEログインを起動するため）
const LIFF_ID = process.env.NEXT_PUBLIC_LIFF_ID || 'YOUR_LIFF_ID'

export default function PortalPage() {
  const params = useParams()
  const token = params.token as string
  const router = useRouter()

  const [isLoading, setIsLoading] = useState(true)
  const [shop, setShop] = useState<any>(null)

  useEffect(() => {
    const checkState = async () => {
      if (!token) return

      // 1. ローカルストレージ（またはCookie）を見て、すでにログイン済みかチェック
      // （※実際の認証仕様に合わせてキー名を調整してください。ここでは仮に 'duacel_session' としています）
      const existingSession = localStorage.getItem('duacel_session')
      if (existingSession) {
        // ログイン済みなら即マイページへ飛ばす
        router.replace(`/m/${existingSession}`)
        return
      }

      // 2. トークンから店舗情報を取得
      const { data: shopData } = await supabase
        .from('shops')
        .select('id, name')
        .eq('invite_token', token)
        .maybeSingle()

      if (shopData) {
        setShop(shopData)
      }
      setIsLoading(false)
    }

    checkState()
  }, [token, router])

  // LINE（LIFF）ログインを起動する関数
  const handleLineLogin = () => {
    // どのトークンから来たかをLIFFに引き継いでジャンプ
    const liffUrl = `https://liff.line.me/${LIFF_ID}?token=${token}`
    window.location.href = liffUrl
  }

  if (isLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#fffef2]">
        <Loader2 className="w-8 h-8 animate-spin text-[#1a1a1a]" />
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-[#fffef2] flex flex-col justify-center items-center p-4 sm:p-6 font-sans text-[#333333] overflow-hidden selection:bg-indigo-100 selection:text-indigo-900">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-[#e6e2d3] flex flex-col h-[85vh] max-h-[700px]">
        
        {/* --- ヘッダー部分 --- */}
        <div className="pt-10 pb-6 px-8 bg-[#fffef2] border-b border-[#e6e2d3] flex flex-col items-center text-center shrink-0 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5"><Store className="w-32 h-32" /></div>
          <h1 className="text-2xl font-serif tracking-[0.2em] text-[#1a1a1a] mb-2 relative z-10">Duacel.</h1>
          <p className="text-[10px] font-bold text-[#999999] tracking-widest uppercase relative z-10">Staff Portal</p>
        </div>

        {/* --- メインコンテンツ --- */}
        <div className="flex-1 p-8 overflow-y-auto flex flex-col justify-center relative">
          <AnimatePresence mode="wait">
            
            {shop ? (
              // 【パターン3】店舗がすでに登録されている場合
              <motion.div 
                key="join"
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                className="flex flex-col items-center text-center"
              >
                <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mb-6 shadow-inner border border-indigo-100">
                  <Users className="w-8 h-8" />
                </div>
                <p className="text-[11px] font-bold text-gray-400 tracking-widest uppercase mb-2">参加の確認</p>
                <h2 className="text-xl font-bold text-gray-900 mb-6 leading-tight">
                  <span className="text-indigo-600">「{shop.name}」</span><br/>のスタッフとして<br/>参加しますか？
                </h2>
                <div className="bg-gray-50 rounded-2xl p-5 text-left w-full space-y-3 border border-gray-100 mb-8">
                  <p className="flex items-center gap-2 text-xs font-bold text-gray-700"><CheckCircle2 className="w-4 h-4 text-emerald-500"/> LINE連携で1秒登録</p>
                  <p className="flex items-center gap-2 text-xs font-bold text-gray-700"><CheckCircle2 className="w-4 h-4 text-emerald-500"/> すぐにお客様へ紹介可能</p>
                  <p className="flex items-center gap-2 text-xs font-bold text-gray-700"><CheckCircle2 className="w-4 h-4 text-emerald-500"/> 実績に応じてポイントGET</p>
                </div>
              </motion.div>
            ) : (
              // 【パターン2】店舗がまだ登録されていない場合
              <motion.div 
                key="new"
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                className="flex flex-col items-center text-center"
              >
                <div className="w-20 h-20 bg-gray-900 text-white rounded-full flex items-center justify-center mb-6 shadow-xl border-4 border-gray-100">
                  <Store className="w-8 h-8" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">新しい店舗の作成</h2>
                <p className="text-sm text-gray-500 leading-relaxed font-semibold mb-8">
                  まだこのQRコードには<br/>店舗が登録されていません。<br/>最初のスタッフとして登録しましょう。
                </p>
                <div className="bg-amber-50 rounded-2xl p-4 text-left w-full border border-amber-100 mb-8">
                  <p className="text-[11px] font-bold text-amber-800 leading-relaxed">
                    💡 <strong className="text-amber-900">一番最初に登録した方へ</strong><br/>
                    店舗名の設定をお願いします。あとから店長への権限譲渡（管理者変更）も可能です。
                  </p>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {/* --- フッター（アクションボタン） --- */}
        <div className="p-6 bg-[#fffef2] border-t border-[#e6e2d3] shrink-0">
          <button 
            onClick={handleLineLogin}
            className="w-full py-4 bg-[#06C755] hover:bg-[#05b34c] text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-[#06C755]/20 flex items-center justify-center gap-2 active:scale-95"
          >
            <MessageCircle className="w-5 h-5 fill-current" />
            LINEで{shop ? '参加する' : '店舗を登録する'}
            <ArrowRight className="w-4 h-4 opacity-50 ml-1" />
          </button>
          <p className="text-[10px] text-center text-gray-400 font-bold mt-4">
            ※LINEの友だち追加画面が開きます
          </p>
        </div>

      </div>
    </div>
  )
}