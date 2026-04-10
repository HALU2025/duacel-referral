'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { 
  CheckCircle2, ShoppingCart, ArrowRight, 
  Database, Zap, Gift, ExternalLink, RefreshCw 
} from 'lucide-react'

export default function ConversionTestPage() {
  const router = useRouter() 
  const [referralId, setReferralId] = useState<string | null>(null)
  const [status, setStatus] = useState('')
  const [isOrdered, setIsOrdered] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const id = document.cookie
      .split('; ')
      .find(row => row.startsWith('referral_id='))
      ?.split('=')[1]
    
    if (id) setReferralId(id)
  }, [])

  const handlePurchase = async () => {
    if (!referralId) {
      alert('紹介情報（クッキー）が見つかりません。おもてなしページから来てください。')
      return
    }

    setLoading(true)
    setStatus('Supabaseへ成果を書き込み中...')

    const parts = referralId.split('_')
    const shopId = parts[0]
    const staffId = parts[1]
    const orderId = `ORD-${Date.now()}`

    try {
      // 1. Supabaseへ保存
      const { error } = await supabase
        .from('referrals')
        .insert([
          { 
            referral_code: referralId,
            shop_id: shopId,
            staff_id: staffId,
            order_number: orderId,
            status: 'pending',
            is_staff_rewarded: false
          }
        ])

      if (error) throw error

      // 2. Make (Webhook) に通知
      setStatus('Make.comへWebhookを送信中...')
      const MAKE_WEBHOOK_URL = 'https://hook.us2.make.com/1w9q1sb6qon2mzlbgx883b666535jfym'

      await fetch(MAKE_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shop_id: shopId,
          staff_id: staffId,
          referral_code: referralId,
          order_id: orderId,
          event: 'purchase_complete'
        })
      })

      setIsOrdered(true)
      setStatus('✅ 全てのプロセスが完了しました')
    } catch (err: any) {
      console.error(err)
      setStatus('❌ エラー発生: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 font-sans text-gray-800">
      
      {!isOrdered ? (
        <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-white rounded-[2.5rem] shadow-xl border border-gray-200 overflow-hidden">
            <div className="h-48 bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white p-8">
              <div className="text-center">
                <p className="text-xs font-bold opacity-80 uppercase tracking-widest mb-1">Duacel Demo Product</p>
                <h1 className="text-3xl font-black">検証用LP</h1>
              </div>
            </div>

            <div className="p-8">
              <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5 mb-8">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                  <h2 className="text-[11px] font-black text-emerald-700 uppercase tracking-widest">紹介セッションを検知</h2>
                </div>
                <p className="text-xs text-emerald-900 font-bold mb-1">
                  紹介コード: <span className="font-mono">{referralId || "未検知"}</span>
                </p>
                <div className="text-[10px] text-emerald-600 flex gap-4 mt-2 border-t border-emerald-100 pt-2">
                  <span>店舗: {referralId?.split('_')[0] || "---"}</span>
                  <span>スタッフ: {referralId?.split('_')[1] || "---"}</span>
                </div>
              </div>

              <div className="space-y-4 mb-8">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Gift className="w-5 h-5 text-indigo-500" /> 紹介限定プラン
                </h3>
                <p className="text-sm text-gray-500 leading-relaxed">
                  紹介経由でアクセスされたため、自動的に「特別インセンティブ」の対象となります。
                </p>
              </div>

              <button 
                onClick={handlePurchase}
                disabled={loading || !referralId}
                className="w-full py-4 bg-gray-900 hover:bg-black text-white rounded-2xl font-bold text-lg shadow-lg transition-all flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-50"
              >
                {loading ? <RefreshCw className="w-6 h-6 animate-spin" /> : <ShoppingCart className="w-6 h-6" />}
                テスト注文を確定する
              </button>
              
              {status && <p className="text-center mt-4 text-[10px] font-bold text-indigo-500 animate-pulse">{status}</p>}
            </div>
          </div>
        </div>
      ) : (
        <div className="w-full max-w-md animate-in zoom-in-95 duration-500">
          <div className="bg-white rounded-[2.5rem] shadow-2xl border border-emerald-100 p-8 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-emerald-500" />
            
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 mb-6 ring-8 ring-emerald-50">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <h2 className="text-2xl font-black text-gray-900 mb-2">成果が記録されました！</h2>
            <p className="text-sm text-gray-500 mb-8 leading-relaxed">
              Supabaseへのデータ保存、および<br/>
              Make.comへの通知が完了しました。
            </p>

            <div className="space-y-3 mb-8">
              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl border border-gray-100 text-left">
                <Database className="w-5 h-5 text-indigo-500" />
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Database Status</p>
                  <p className="text-xs font-bold text-gray-700">referrals テーブルへ新規挿入済み</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl border border-gray-100 text-left">
                <Zap className="w-5 h-5 text-amber-500" />
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Webhook Status</p>
                  <p className="text-xs font-bold text-gray-700">Make へ JSON データを送信済み</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <button 
                onClick={() => router.push('/dashboard')}
                className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-100"
              >
                ダッシュボードで成果を確認 <ArrowRight className="w-5 h-5" />
              </button>
              <button 
                onClick={() => window.location.reload()}
                className="text-xs text-gray-400 font-bold hover:text-gray-600 transition"
              >
                もう一度テストする
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 開発者用ショートカットトレイ */}
      <footer className="mt-12 flex flex-col items-center gap-4">
        <div className="flex items-center gap-4 bg-white px-6 py-3 rounded-full shadow-sm border border-gray-100">
          <a href="/admin" className="text-[10px] font-bold text-gray-400 hover:text-indigo-600 flex items-center gap-1 transition">
            <ExternalLink className="w-3 h-3" /> ADMIN
          </a>
          <div className="w-px h-3 bg-gray-200" />
          <a href="/verify" className="text-[10px] font-bold text-gray-400 hover:text-indigo-600 flex items-center gap-1 transition">
            <ExternalLink className="w-3 h-3" /> OWNER VERIFY
          </a>
        </div>
        <p className="text-[9px] text-gray-400 font-medium tracking-widest uppercase">
          Duacel Referral System Debug Mode
        </p>
      </footer>
    </main>
  )
}