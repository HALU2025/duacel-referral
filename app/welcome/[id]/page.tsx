'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Sparkles, CheckCircle2, Clock, Loader2, ShoppingBag, 
  ChevronRight, Gift, ShieldCheck, Repeat, Box, Code, 
  ArrowRight, User, Info, ArrowDownCircle
} from 'lucide-react'

const getGradient = (name: string) => {
  const colors = ['from-indigo-500 to-purple-500', 'from-emerald-400 to-cyan-500', 'from-rose-400 to-orange-400', 'from-blue-500 to-indigo-500'];
  return colors[name.length % colors.length];
}

export default function WelcomeTestPage() {
  const params = useParams()
  const referralCode = params.id as string
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [shop, setShop] = useState<any>(null)
  const [staff, setStaff] = useState<any>(null)
  const [category, setCategory] = useState<any>(null)
  
  // テスト用の履歴データとシミュレーションステート
  const [testLogs, setTestLogs] = useState<any[]>([])
  const [isSimulating, setIsSimulating] = useState(false)
  const [showDevTools, setShowDevTools] = useState(true) // テストツールを表示するかどうか

  const loadData = async () => {
    setLoading(true)
    
    // 1. スタッフと店舗情報の取得
    const { data: staffData } = await supabase.from('staffs').select('*').eq('referral_code', referralCode).single()
    if (!staffData) { setLoading(false); return; }
    
    const { data: shopData } = await supabase.from('shops').select('*, shop_categories(*)').eq('id', staffData.shop_id).single()
    if (!shopData) { setLoading(false); return; }

    setStaff(staffData)
    setShop(shopData)
    setCategory(shopData.shop_categories)

    // 2. このスタッフの紹介履歴（テストログ）を取得
    const { data: logs } = await supabase
      .from('referrals')
      .select('*')
      .eq('staff_id', staffData.id)
      .order('created_at', { ascending: false })
      .limit(15)

    setTestLogs(logs || [])
    setLoading(false)
  }

  useEffect(() => { if (referralCode) loadData() }, [referralCode])

  // ==========================================
  // 🧪 テストアクション 1: CV（新規購入）のシミュレート
  // ==========================================
  const handleSimulateCV = async () => {
    setIsSimulating(true)
    const orderNum = `SUB-${Math.floor(1000 + Math.random() * 9000)}`
    const customerName = `ゲスト ${Math.floor(100 + Math.random() * 900)}様`

    const indRatio = shop.ratio_individual ?? 100
    const teamRatio = shop.ratio_team ?? 0
    const ownerRatio = shop.ratio_owner ?? 0

    const { error } = await supabase.from('referrals').insert([{
      shop_id: shop.id,
      staff_id: staff.id,
      status: 'pending', // 初回は仮計上（配達前）
      order_number: orderNum,
      customer_name: customerName,
      recurring_count: 1, // 定期1回目
      snapshot_ratio_individual: indRatio,
      snapshot_ratio_team: teamRatio,
      snapshot_ratio_owner: ownerRatio
    }])

    if (!error) {
      await loadData()
      alert('【テスト】購入が完了し、ダッシュボードに「仮計上」としてデータが飛びました！\n下部のテストツールから「お届け完了」をシミュレートしてください。')
    }
    setIsSimulating(false)
  }

  // ==========================================
  // 🧪 テストアクション 2: 1回目お届け完了（API受信）
  // ==========================================
  const handle1stDelivery = async (referralId: string) => {
    setIsSimulating(true)
    const { error } = await supabase
      .from('referrals')
      .update({ status: 'confirmed' }) // 確定に変更（ウォレットに入る）
      .eq('id', referralId)

    if (!error) await loadData()
    setIsSimulating(false)
  }

  // ==========================================
  // 🧪 テストアクション 3: 2回目以降のお届け完了（即確定API受信）
  // ==========================================
  const handleRecurringDelivery = async (originalLog: any) => {
    setIsSimulating(true)
    const orderNum = `REC-${Math.floor(1000 + Math.random() * 9000)}`
    
    // スナップショット比率を引き継いで、新しい「確定」レコードを作る
    const { error } = await supabase.from('referrals').insert([{
      shop_id: shop.id,
      staff_id: staff.id,
      status: 'confirmed', // 2回目以降は即確定
      order_number: orderNum,
      customer_name: originalLog.customer_name,
      recurring_count: originalLog.recurring_count + 1, // カウントアップ
      snapshot_ratio_individual: originalLog.snapshot_ratio_individual,
      snapshot_ratio_team: originalLog.snapshot_ratio_team,
      snapshot_ratio_owner: originalLog.snapshot_ratio_owner
    }])

    if (!error) await loadData()
    setIsSimulating(false)
  }

  if (loading) return <div className="fixed inset-0 flex items-center justify-center bg-gray-100"><Loader2 className="w-6 h-6 animate-spin text-gray-900" /></div>
  if (!staff || !shop) return <div className="fixed inset-0 flex items-center justify-center bg-gray-100 text-gray-500 text-sm font-semibold">ページが見つかりません。</div>

  const basePoints = category?.reward_points || 0

  return (
    <div className="min-h-screen bg-gray-100 flex justify-center font-sans text-gray-900 pb-20">
      <div className="w-full max-w-md bg-white min-h-screen relative shadow-2xl flex flex-col overflow-hidden">
        
        {/* ==========================================
            💎 お客様向けUI (Customer Facing)
        ========================================== */}
        <header className="px-5 pt-safe-top pb-3 flex justify-between items-center border-b border-gray-100 bg-white/80 backdrop-blur-md sticky top-0 z-20">
          <div>
            <p className="text-[10px] font-semibold text-gray-400 tracking-wider">OFFICIAL PARTNER</p>
            <h1 className="text-sm font-bold text-gray-900">{shop.name}</h1>
          </div>
          <div className="px-2 py-1 bg-gray-50 rounded text-[9px] font-semibold text-gray-500 border border-gray-200">
            招待専用
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          {/* Hero Profile */}
          <div className="p-6 flex flex-col items-center text-center border-b border-gray-50 bg-gray-50/30">
            <div className={`w-20 h-20 rounded-full bg-gradient-to-tr ${getGradient(staff.name)} flex items-center justify-center text-white font-bold text-3xl shadow-md border-4 border-white mb-4`}>
              {staff.name.charAt(0)}
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-1">{staff.name} <span className="text-xs font-medium text-gray-500">からの招待</span></h2>
            <p className="text-xs text-gray-500 leading-relaxed max-w-[280px]">
              このページからご購入いただくと、特別な特典が適用されます。サロン品質のケアをご自宅でぜひ体験してください。
            </p>
          </div>

          {/* Product (Subscription) Card */}
          <div className="p-5">
            <div className="bg-gray-900 rounded-3xl p-6 text-white relative overflow-hidden shadow-lg">
              <div className="absolute right-0 top-0 p-4 opacity-10">
                <Sparkles className="w-24 h-24" />
              </div>
              
              <div className="relative z-10">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/20 rounded-md text-[10px] font-semibold mb-4 backdrop-blur-sm">
                  <Repeat className="w-3 h-3" /> 定期コース
                </div>
                <h3 className="text-xl font-bold mb-2">Duacel プレミアムケア<br/>毎月お届けコース</h3>
                <p className="text-xs text-gray-300 mb-6 leading-relaxed">
                  専用美容液とケアアイテムを毎月お届けします。いつでも解約・スキップが可能です。
                </p>

                <div className="flex items-end justify-between mb-6">
                  <div>
                    <p className="text-[10px] text-gray-400 line-through">通常単発: ¥12,000</p>
                    <p className="text-2xl font-mono">¥8,800<span className="text-xs font-sans text-gray-300 ml-1">/月 (税込)</span></p>
                  </div>
                </div>

                <button 
                  onClick={handleSimulateCV} 
                  disabled={isSimulating}
                  className="w-full py-4 bg-white text-gray-900 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 shadow-sm"
                >
                  {isSimulating ? <Loader2 className="w-5 h-5 animate-spin" /> : <><ShoppingBag className="w-4 h-4" /> このコースを申し込む</>}
                </button>
              </div>
            </div>

            <div className="mt-4 p-4 bg-gray-50 rounded-2xl flex items-start gap-3 border border-gray-100">
              <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0" />
              <div>
                <p className="text-xs font-bold text-gray-900 mb-0.5">安心のお約束</p>
                <p className="text-[10px] text-gray-500 leading-relaxed">ご解約はお届け予定日の10日前までマイページから可能です。回数縛りはありません。</p>
              </div>
            </div>
          </div>

          {/* ==========================================
              ⚙️ 開発者向け: API受信シミュレーター
          ========================================== */}
          <div className="mt-8 border-t-2 border-dashed border-gray-200 bg-gray-50 pb-10">
            <div className="p-5 flex items-center justify-between cursor-pointer" onClick={() => setShowDevTools(!showDevTools)}>
              <div className="flex items-center gap-2">
                <Code className="w-5 h-5 text-indigo-500" />
                <h3 className="text-sm font-bold text-gray-900">API受信テスト (開発ツール)</h3>
              </div>
              <ArrowDownCircle className={`w-5 h-5 text-gray-400 transition-transform ${showDevTools ? 'rotate-180' : ''}`} />
            </div>

            <AnimatePresence>
              {showDevTools && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="px-5 space-y-3 overflow-hidden">
                  <p className="text-[10px] text-gray-500 font-semibold mb-4 leading-relaxed">
                    上の「申し込む」ボタンを押すと、この一覧にCV履歴が追加されます。<br/>
                    下のボタンから、ecforce（カート）から「発送完了Webhook」が届いた状態をシミュレートできます。
                  </p>

                  {testLogs.length === 0 ? (
                    <div className="text-center py-8 bg-white rounded-2xl border border-gray-200">
                      <p className="text-[10px] font-semibold text-gray-400">データがありません。<br/>上の購入ボタンを押してください。</p>
                    </div>
                  ) : (
                    testLogs.map((log) => {
                      const isPending = log.status === 'pending'
                      const isConfirmed = log.status === 'confirmed' || log.status === 'issued'
                      
                      // 当時の還元率を使って、このスタッフがもらえる（もらう予定の）額を計算
                      const indRatio = log.snapshot_ratio_individual ?? 100
                      const staffExpectedPoints = Math.floor(basePoints * (indRatio / 100))

                      return (
                        <div key={log.id} className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex flex-col gap-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="flex items-center gap-1.5 mb-1">
                                {isPending ? (
                                  <span className="px-1.5 py-0.5 bg-amber-50 text-amber-600 text-[9px] font-bold rounded border border-amber-100 flex items-center gap-1"><Clock className="w-2.5 h-2.5"/> 仮計上</span>
                                ) : (
                                  <span className="px-1.5 py-0.5 bg-gray-900 text-white text-[9px] font-bold rounded flex items-center gap-1"><CheckCircle2 className="w-2.5 h-2.5"/> 確定済</span>
                                )}
                                <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">定期 {log.recurring_count}回目</span>
                              </div>
                              <p className="text-xs font-bold text-gray-900">{log.customer_name}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-[9px] text-gray-400 font-semibold mb-0.5">担当枠: +{staffExpectedPoints}pt</p>
                              <p className="text-[8px] text-gray-400">{new Date(log.created_at).toLocaleDateString('ja-JP')} {new Date(log.created_at).toLocaleTimeString('ja-JP', {hour:'2-digit', minute:'2-digit'})}</p>
                            </div>
                          </div>

                          <div className="flex gap-2">
                            {/* 1回目の仮計上データに対する「お届け完了」ボタン */}
                            {isPending && log.recurring_count === 1 && (
                              <button 
                                onClick={() => handle1stDelivery(log.id)} disabled={isSimulating}
                                className="flex-1 py-2 bg-indigo-600 text-white text-[10px] font-bold rounded-lg flex items-center justify-center gap-1.5 hover:bg-indigo-700 transition active:scale-95 disabled:opacity-50"
                              >
                                <Box className="w-3.5 h-3.5" /> 初回お届け完了を受信
                              </button>
                            )}

                            {/* 確定済みデータに対する「次のお届け完了（継続）」ボタン */}
                            {isConfirmed && (
                              <button 
                                onClick={() => handleRecurringDelivery(log)} disabled={isSimulating}
                                className="flex-1 py-2 bg-white border border-gray-300 text-gray-700 text-[10px] font-bold rounded-lg flex items-center justify-center gap-1.5 hover:bg-gray-50 transition active:scale-95 disabled:opacity-50"
                              >
                                <Repeat className="w-3.5 h-3.5" /> 次の月のお届けを受信
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  )
}