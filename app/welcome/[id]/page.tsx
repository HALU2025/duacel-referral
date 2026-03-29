'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import { 
  Gift, ArrowRight, Store, User, 
  CheckCircle2, Sparkles, Loader2, ShieldCheck 
} from 'lucide-react'

export default function WelcomeBridgePage() {
  const params = useParams()
  const referralId = params.id as string // 例: S001_ST001
  const router = useRouter()

  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [redirecting, setRedirecting] = useState(false)

  // ==========================================
  // ★ 検証用の飛び先URL（後でecforceのLPに変更してください）
  // ==========================================
  const DESTINATION_URL = "https://duacel.com/lp?u=rf"

  useEffect(() => {
    const fetchReferrer = async () => {
      // 1. 公開用の紹介コードからスタッフと店舗情報を取得
      const { data: staff, error } = await supabase
        .from('staffs')
        .select(`
          name,
          shops (
            name
          )
        `)
        .eq('referral_code', referralId)
        .single()

      if (staff) {
        setData(staff)
      }
      
      // 2. 「特典適用中...」のワクワク感を出すためのあえての待機時間（1.5秒）
      setTimeout(() => setLoading(false), 1500)
    }

    if (referralId) fetchReferrer()
  }, [referralId])

  const handleProceed = () => {
    setRedirecting(true)
    
    // すでに ?u=rf が付いているので、&r=S001_ST001 の形で結合する
    const finalUrl = `${DESTINATION_URL}&r=${referralId}`
    
    setTimeout(() => {
      // 現在のタブのままLPへ遷移させる
      window.location.href = finalUrl
    }, 800)
  }

  // A. 読み込み中（特典計算演出）
  if (loading) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-white p-6">
        <div className="relative mb-8">
          <Loader2 className="w-12 h-12 animate-spin text-indigo-600" />
          <Sparkles className="absolute -top-2 -right-2 text-amber-400 animate-pulse" />
        </div>
        <h2 className="text-lg font-bold text-gray-900 tracking-tighter">紹介特典を照合しています...</h2>
        <p className="text-[10px] text-gray-400 mt-2 uppercase tracking-widest font-medium">Validating your special offer</p>
      </div>
    )
  }

  // B. 紹介者が見つからなかった場合（エラー防止）
  if (!data) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-gray-50 p-6 text-center">
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-200">
          <p className="text-sm text-gray-500 mb-6 leading-relaxed">
            ご紹介情報の有効期限が切れているか、<br/>URLが正しくありません。
          </p>
          <button onClick={() => router.push('/')} className="text-indigo-600 font-bold text-sm hover:underline">
            トップページへ戻る
          </button>
        </div>
      </div>
    )
  }

  // C. メインのおもてなし画面
  return (
    <main className="min-h-[100dvh] bg-gradient-to-b from-indigo-50 via-white to-white font-sans text-gray-800 flex flex-col items-center justify-center p-6">
      
      <div className="w-full max-w-sm bg-white rounded-[2.5rem] shadow-2xl shadow-indigo-100 border border-indigo-50 p-8 text-center relative overflow-hidden animate-in fade-in zoom-in-95 duration-500">
        
        {/* 上部の装飾ライン */}
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
        
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-amber-50 text-amber-500 mb-6 ring-8 ring-amber-50/50">
          <Gift className="w-10 h-10" />
        </div>

        <h1 className="text-xl font-extrabold text-gray-900 mb-2 leading-tight">
          特別なご紹介特典が<br/>適用されました
        </h1>
        
        <div className="bg-gray-50 rounded-2xl p-4 mb-8 border border-gray-100">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Store className="w-3 h-3 text-indigo-500" />
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{data.shops?.name}</p>
          </div>
          <div className="flex items-center justify-center gap-1.5">
            <div className="w-6 h-6 bg-indigo-100 rounded-full flex items-center justify-center">
              <User className="w-3.5 h-3.5 text-indigo-600" />
            </div>
            <p className="text-base font-extrabold text-gray-900">
              {data.name} <span className="text-xs font-normal text-gray-500">様からの紹介</span>
            </p>
          </div>
        </div>

        <div className="space-y-4 mb-8 text-left">
          <div className="flex items-start gap-3">
            <div className="mt-1 bg-emerald-100 rounded-full p-0.5"><CheckCircle2 className="w-3 h-3 text-emerald-600" /></div>
            <p className="text-xs font-bold text-gray-600">このページ限定の特別価格で購入可能です</p>
          </div>
          <div className="flex items-start gap-3">
            <div className="mt-1 bg-emerald-100 rounded-full p-0.5"><CheckCircle2 className="w-3 h-3 text-emerald-600" /></div>
            <p className="text-xs font-bold text-gray-600">優先カスタマーサポートが付帯します</p>
          </div>
        </div>

        <button 
          onClick={handleProceed}
          disabled={redirecting}
          className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-lg transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 group overflow-hidden relative"
        >
          {redirecting ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : (
            <>
              限定ページへ進む
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </>
          )}
          <div className="absolute top-0 -left-[100%] w-[50%] h-full bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-[-25deg] group-hover:left-[150%] transition-all duration-1000" />
        </button>

        <div className="mt-6 flex items-center justify-center gap-1.5 text-gray-400">
          <ShieldCheck className="w-3 h-3" />
          <span className="text-[9px] font-bold uppercase tracking-widest">Verified Official Referral</span>
        </div>
      </div>

      <p className="mt-8 text-[10px] text-gray-400 max-w-[240px] text-center leading-relaxed">
        このページは正式な紹介プログラムに基づいて<br/>
        Duacelシステムにより自動生成されています。
      </p>
    </main>
  )
}