'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion' 

import { 
  Loader2, ChevronDown, ChevronUp, User, 
  Check, Sparkles, ExternalLink, Store, ArrowRight
} from 'lucide-react'

const DEFAULT_AVATAR = '/avatars/default.png'

export default function CustomerCatalogPage() {
  const params = useParams()
  const token = params.token as string 
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [shop, setShop] = useState<any>(null)
  const [staffList, setStaffList] = useState<any[]>([])
  
  // selectedStaff が null の場合は「店舗公式（担当なし）」として扱う
  const [selectedStaff, setSelectedStaff] = useState<any>(null)
  const [isStaffListOpen, setIsStaffListOpen] = useState(false)

  useEffect(() => {
    const fetchShopAndStaff = async () => {
      if (!token) return

      const { data: shopData, error: shopError } = await supabase
        .from('shops')
        .select('*')
        .eq('invite_token', token)
        .maybeSingle()

      if (shopError) console.error('Supabase Error (Shop):', shopError)

      if (shopData) {
        setShop(shopData)

        // オーナーも含めて全員取得
        const { data: staffs, error: staffError } = await supabase
          .from('staffs')
          .select('*')
          .eq('shop_id', shopData.id)
          .eq('is_deleted', false)
          .order('role', { ascending: false }) // オーナーを上に

        if (staffError) console.error('Supabase Error (Staffs):', staffError)

        if (staffs) {
          setStaffList(staffs)
        }
      }
      setLoading(false)
    }
    fetchShopAndStaff()
  }, [token])

  // 次のページへエスコートする処理
  const handleProceedToStore = () => {
    // 担当者が選ばれていなければ、店舗公式コード (shop_〇〇) を使う
    const targetCode = selectedStaff 
      ? selectedStaff.referral_code 
      : `shop_${shop.id}`
      
    router.push(`/welcome/${targetCode}`)
  }

  if (loading) {
    return <div className="fixed inset-0 flex items-center justify-center bg-[#fffef2]"><Loader2 className="w-8 h-8 animate-spin text-[#1a1a1a]" /></div>
  }

  // 店舗未登録（未開拓QR）の場合
  if (!shop) {
    return (
      <div className="fixed inset-0 bg-[#fffef2] flex justify-center font-sans text-[#333333] overflow-hidden">
        <div className="w-full max-w-md h-full flex flex-col items-center justify-center p-8 text-center border-x border-[#e6e2d3]">
          <h1 className="text-2xl font-serif tracking-[0.2em] text-[#1a1a1a] mb-8">Duacel.</h1>
          <div className="w-16 h-16 bg-[#f5f2e6] rounded-full flex items-center justify-center mb-6">
            <Sparkles className="w-8 h-8 text-[#d4cfbf]" />
          </div>
          <h2 className="text-lg font-bold text-[#1a1a1a] mb-4">Coming Soon</h2>
          <p className="text-sm text-[#999999] leading-relaxed">
            現在、こちらの店舗のオンラインカタログを<br/>準備中です。
          </p>
          <p className="text-xs text-[#999999] mt-4">
            詳細は店舗スタッフにお尋ねください。
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-[#f5f2e6] flex justify-center font-sans text-[#333333] overflow-hidden selection:bg-[#e6e2d3]">
      <div className="w-full max-w-md bg-[#fffef2] h-full flex flex-col relative shadow-sm border-x border-[#e6e2d3]">
        
        {/* メインコンテンツ（ここだけがスクロールする） */}
        <main className="flex-1 overflow-y-auto -webkit-overflow-scrolling-touch">
          
          <section className="relative w-full aspect-[4/5] bg-[#e6e2d3] overflow-hidden">
            <img 
              src="/product-hero.jpg" 
              alt="Duacel Scalp Serum" 
              className="w-full h-full object-cover"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-[#fffef2]" />
            <div className="absolute top-12 left-0 right-0 text-center">
              <h1 className="text-3xl font-serif tracking-[0.3em] text-white drop-shadow-md">Duacel.</h1>
            </div>
          </section>

          <section className="px-8 -mt-12 relative z-10 text-center">
            <div className="bg-white p-8 border border-[#e6e2d3] shadow-sm rounded-sm">
              <p className="text-[10px] font-bold text-[#999999] tracking-[0.2em] uppercase mb-2">Exclusive Partner</p>
              <h2 className="text-xl font-bold text-[#1a1a1a] mb-4">{shop.name}</h2>
              <div className="w-8 h-[1px] bg-[#1a1a1a] mx-auto mb-6" />
              <h3 className="text-sm font-bold text-[#1a1a1a] mb-3">サロン専売 スカルプセラム</h3>
              <p className="text-xs text-[#666666] leading-relaxed">
                ヒト幹細胞培養液を高配合した、次世代のスカルプケア。<br/>
                サロン帰りの仕上がりを、ご自宅でも。
              </p>
            </div>
          </section>

          <section className="px-8 mt-10 pb-12">
            <div className="border border-[#e6e2d3] rounded-sm overflow-hidden bg-white">
              <button 
                onClick={() => setIsStaffListOpen(!isStaffListOpen)}
                className="w-full p-5 flex items-center justify-between hover:bg-[#faf9f6] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <User className="w-4 h-4 text-[#999999]" />
                  <span className="text-xs font-bold tracking-wider">
                    {selectedStaff 
                      ? `担当：${selectedStaff.name}` 
                      : "担当スタッフを選択（任意）"}
                  </span>
                </div>
                {isStaffListOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              <AnimatePresence>
                {isStaffListOpen && (
                  <motion.div 
                    key="staff-dropdown-menu"
                    initial={{ height: 0, opacity: 0 }} 
                    animate={{ height: 'auto', opacity: 1 }} 
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden border-t border-[#e6e2d3]"
                  >
                    <div className="p-4 bg-[#faf9f6] space-y-2 max-h-64 overflow-y-auto">
                      
                      {/* 店舗公式（担当なし・デフォルト） */}
                      <button 
                        onClick={() => { setSelectedStaff(null); setIsStaffListOpen(false); }}
                        className={`w-full p-4 flex items-center justify-between rounded-sm border transition-all ${!selectedStaff ? 'bg-white border-[#1a1a1a] shadow-sm' : 'bg-transparent border-transparent'}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-[#e6e2d3] flex items-center justify-center shrink-0">
                            <Store className="w-5 h-5 text-white" />
                          </div>
                          <div className="text-left">
                            <p className="text-xs font-bold text-[#1a1a1a]">{shop.name} 公式</p>
                            <p className="text-[9px] text-[#999999]">特定の担当者がいない場合はこちら</p>
                          </div>
                        </div>
                        {!selectedStaff && <Check className="w-4 h-4 text-[#1a1a1a]" />}
                      </button>

                      {/* スタッフ一覧（オーナーも全員表示） */}
                      {staffList.map(staff => (
                        <button 
                          key={staff.id}
                          onClick={() => { setSelectedStaff(staff); setIsStaffListOpen(false); }}
                          className={`w-full p-4 flex items-center justify-between rounded-sm border transition-all ${selectedStaff?.id === staff.id ? 'bg-white border-[#1a1a1a] shadow-sm' : 'bg-transparent border-transparent'}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full overflow-hidden bg-[#e6e2d3] shrink-0 border border-[#e6e2d3]">
                              {staff.avatar_url ? (
                                <img src={staff.avatar_url} alt={staff.name} className="w-full h-full object-cover" />
                              ) : (
                                <img src={DEFAULT_AVATAR} alt="avatar" className="w-full h-full object-cover opacity-60" />
                              )}
                            </div>
                            <div className="text-left">
                              <p className="text-xs font-bold text-[#1a1a1a] flex items-center gap-2">
                                {staff.name}
                                {staff.role === 'owner' && <span className="text-[8px] bg-[#f5f2e6] text-[#666666] px-1.5 py-0.5 rounded-sm">OWNER</span>}
                              </p>
                              <p className="text-[9px] text-[#999999]">このスタッフからの紹介で進む</p>
                            </div>
                          </div>
                          {selectedStaff?.id === staff.id && <Check className="w-4 h-4 text-[#1a1a1a]" />}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </section>

        </main>

        {/* フッター（エスコートボタン） */}
        <div className="shrink-0 p-6 bg-white/90 backdrop-blur-md border-t border-[#e6e2d3] z-50 pb-safe">
          <button 
            onClick={handleProceedToStore}
            className="w-full py-5 bg-[#1a1a1a] text-[#fffef2] font-bold text-sm tracking-widest flex items-center justify-center gap-3 active:scale-[0.98] transition-all shadow-xl"
          >
            公式オンラインストアへ進む
            <ArrowRight className="w-4 h-4" />
          </button>
          
          <p className="text-center text-[10px] text-[#999999] mt-4 tracking-wider flex items-center justify-center gap-1">
             <ExternalLink className="w-3 h-3" /> 限定特典付きの専用ページへ移動します
          </p>
        </div>

      </div>
    </div>
  )
}