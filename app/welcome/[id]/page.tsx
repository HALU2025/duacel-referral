'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { motion } from 'framer-motion'
import { 
  ArrowRight, Loader2, Sparkles, Gift, 
  TestTube, CheckCircle2, AlertTriangle 
} from 'lucide-react'

export default function WelcomePage() {
  const params = useParams()
  const referralCode = params.id as string
  
  const [shop, setShop] = useState<any>(null)
  const [staff, setStaff] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // テストコンバージョン用ステート
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success?: boolean, message: string } | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      // 紹介コード（S0001_m01）からスタッフを検索
      const { data: staffData } = await supabase.from('staffs').select('*').eq('referral_code', referralCode).maybeSingle()
      
      if (staffData) {
        setStaff(staffData)
        // スタッフが所属する店舗を検索
        const { data: shopData } = await supabase.from('shops').select('*').eq('id', staffData.shop_id).maybeSingle()
        if (shopData) setShop(shopData)
      }
      setLoading(false)
    }
    if (referralCode) fetchData()
  }, [referralCode])

  // ==========================================
  // ★ 開発者用：テストコンバージョン発生ロジック
  // ==========================================
  const handleTestConversion = async () => {
    setIsTesting(true)
    setTestResult(null)

    // ecforceから送られてくるようなランダムなテストデータを生成
    const mockOrderNumber = `TEST_${Math.floor(Math.random() * 100000000)}`
    const mockCustomerNumber = `CUST_${Math.floor(Math.random() * 10000)}`

    try {
      // 実際にecforceが叩くのと同じAPI（自作のWebhook）に対して、GETリクエストを投げる
      const response = await fetch(`/api/webhooks/ecforce?r=${referralCode}&order_number=${mockOrderNumber}&customer_id=${mockCustomerNumber}`)
      
      if (response.ok) {
        setTestResult({ 
          success: true, 
          message: `🎉 成果発生成功！\n受注番号: ${mockOrderNumber}` 
        })
      } else {
        const errorText = await response.text()
        setTestResult({ 
          success: false, 
          message: `❌ エラー: ${response.status} ${errorText}` 
        })
      }
    } catch (error: any) {
      setTestResult({ 
        success: false, 
        message: `❌ 通信エラー: ${error.message}` 
      })
    } finally {
      setIsTesting(false)
    }
  }

  if (loading) return <div className="min-h-[100dvh] flex items-center justify-center bg-gray-50"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>
  if (!staff || !shop) return <div className="min-h-[100dvh] flex items-center justify-center bg-gray-50 text-gray-500 font-bold">無効な紹介リンクです。</div>

  // 本番のLPへのURL
  const lpUrl = `https://duacel.com/lp?u=rf&r=${referralCode}`

  return (
    <div className="min-h-[100dvh] bg-gray-50 flex flex-col justify-center items-center p-4 font-sans text-gray-800">
      
      {/* 📱 本番用：お客様に見せるUI */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm bg-white rounded-[2rem] shadow-2xl overflow-hidden border border-gray-100 relative mb-8"
      >
        <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-indigo-50 to-white" />
        
        <div className="relative pt-12 pb-8 px-8 flex flex-col items-center text-center">
          <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-xl border-4 border-white mb-6 relative">
            <Gift className="w-10 h-10 text-indigo-600" />
            <Sparkles className="w-5 h-5 text-yellow-400 absolute -top-2 -right-2 animate-pulse" />
          </div>
          
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2">Duacel Special Offer</p>
          <h1 className="text-2xl font-black text-gray-900 leading-tight mb-2">
            特別招待リンクが<br/>適用されました
          </h1>
          
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-2 mt-4 mb-8 inline-block">
            <p className="text-xs font-bold text-indigo-800">
              招待元: {shop.name}
            </p>
          </div>

          {/* ★ 本番用ボタン（実LPへ飛ぶ） */}
          <a 
            href={lpUrl}
            className="w-full py-4 bg-gray-900 hover:bg-gray-800 text-white rounded-xl font-bold text-sm shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            限定ページへ進む <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </motion.div>

      {/* 🛠️ 開発・テスト用：シークレットメニュー */}
      <div className="w-full max-w-sm bg-gray-100 border border-gray-200 border-dashed rounded-2xl p-5">
        <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-wider flex items-center gap-1.5 mb-4">
          <TestTube className="w-3.5 h-3.5" /> Developer Tools
        </h3>
        
        <div className="space-y-3">
          <p className="text-xs text-gray-500 font-bold">
            ※ボタンを押すと、この紹介コード（{referralCode}）で「ecforceから購入通知が来た」という擬似データをシステムに送信します。
          </p>

          <button 
            onClick={handleTestConversion}
            disabled={isTesting}
            className="w-full py-3 bg-white border border-gray-300 text-gray-700 rounded-xl font-bold text-xs shadow-sm hover:bg-gray-50 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <TestTube className="w-4 h-4" />}
            テスト成果を発生させる
          </button>

          {/* テスト結果の表示 */}
          {testResult && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
              className={`p-3 rounded-xl text-xs font-bold whitespace-pre-wrap flex items-start gap-2 ${testResult.success ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-600 border border-red-100'}`}
            >
              {testResult.success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
              {testResult.message}
            </motion.div>
          )}
        </div>
      </div>

    </div>
  )
}