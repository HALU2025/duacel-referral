'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion' 

import { 
  Loader2, ShoppingBag, ChevronDown, ChevronUp, User, 
  Check, Star, Sparkles, MapPin, ExternalLink
} from 'lucide-react'

const DEFAULT_AVATAR = '/avatars/default.png'

export default function CustomerCatalogPage() {
  const params = useParams()
  const token = params.token as string 
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [shop, setShop] = useState<any>(null)
  const [staffList, setStaffList] = useState<any[]>([])
  const [ownerStaff, setOwnerStaff] = useState<any>(null)
  
  const [selectedStaff, setSelectedStaff] = useState<any>(null)
  const [isStaffListOpen, setIsStaffListOpen] = useState(false)

  useEffect(() => {
    const fetchShopAndStaff = async () => {
      if (!token) return

      // 1. 店舗情報を取得
      const { data: shopData } = await supabase
        .from('shops')
        .select('*')
        .eq('invite_token', token)
        .maybeSingle()

      if (shopData) {
        setShop(shopData)

        // 2. スタッフ一覧を取得
        const { data: staffs } = await supabase
          .from('staffs')
          .select('*')
          .eq('shop_id', shopData.id)
          .eq('is_deleted', false)
          .order('role', { ascending: false }) // Ownerを先頭に

        if (staffs) {
          setStaffList(staffs)
          // オーナーを特定（デフォルトの紹介者とする）
          const owner = staffs.find(s => s.role === 'owner')
          setOwnerStaff(owner)
          setSelectedStaff(owner) // 初期値は店舗（オーナー）
        }
      }
      setLoading(false)
    }
    fetchShopAndStaff()
  }, [token])

  // 購入ページへリダイレクト
  const handlePurchase = () => {
    if (!selectedStaff) return
    // 各自の紹介コード（ref_xxxx）を使ってウェルカムページへ
    router.push(`/welcome/${selectedStaff.referral_code}`)
  }

  if (loading) {
    return <div className="fixed inset-0 flex items-center justify-center bg-[#fffef2]"><Loader2 className="w-8 h-8 animate-spin text-[#1a1a1a]" /></div>
  }

  // 店舗がまだ登録されていない（未開拓QR）場合
  if (!shop) {
    return (
      <div className="fixed inset-0 bg-[#fffef2] flex flex-col items-center justify-center p-8 text-center">
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
    )
  }

  return (
    <div className="min-h-[100dvh] bg-[#fffef2] text-[#333333] font-sans pb-32">
      
      {/* ヒーローエリア: 商品イメージ */}
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

      {/* サロン・商品説明エリア */}
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

      {/* スタッフ選択エリア（オプショナル） */}
      <section className="px-8 mt-10">
        <div className="border border-[#e6e2d3] rounded-sm overflow-hidden bg-white">
          <button 
            onClick={() => setIsStaffListOpen(!isStaffListOpen)}
            className="w-full p-5 flex items-center justify-between hover:bg-[#faf9f6] transition-colors"
          >
            <div className="flex items-center gap-3">
              <User className="w-4 h-4 text-[#999999]" />
              <span className="text-xs font-bold tracking-wider">
                {selectedStaff?.id === ownerStaff?.id 
                  ? "担当スタッフを選択（任意）" 
                  : `担当：${selectedStaff?.name}`}
              </span>
            </div>
            {isStaffListOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          <AnimatePresence>
            {isStaffListOpen && (
              <motion.div 
                initial={{ height: 0 }} 
                animate={{ height: 'auto' }} 
                exit={{ height: 0 }}
                className="overflow-hidden border-t border-[#e6e2d3]"
              >
                <div className="p-4 bg-[#faf9f6] space-y-2 max-h-64 overflow-y-auto">
                  {/* 店舗公式（デフォルト） */}
                  <button 
                    onClick={() => { setSelectedStaff(ownerStaff); setIsStaffListOpen(false); }}
                    className={`w-full p-4 flex items-center justify-between rounded-sm border transition-all ${selectedStaff?.id === ownerStaff?.id ? 'bg-white border-[#1a1a1a] shadow-sm' : 'bg-transparent border-transparent'}`}
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
                    {selectedStaff?.id === ownerStaff?.id && <Check className="w-4 h-4 text-[#1a1a1a]" />}
                  </button>

                  {/* スタッフ一覧 */}
                  {staffList.filter(s => s.role !== 'owner').map(staff => (
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
                          <p className="text-xs font-bold text-[#1a1a1a]">{staff.name}</p>
                          <p className="text-[9px] text-[#999999]">このスタッフの紹介で購入する</p>
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

      {/* フッター購入ボタン (Sticky) */}
      <div className="fixed bottom-0 left-0 right-0 p-6 bg-white/80 backdrop-blur-md border-t border-[#e6e2d3] z-50 pb-safe">
        <div className="max-w-md mx-auto">
          <button 
            onClick={handlePurchase}
            className="w-full py-5 bg-[#1a1a1a] text-[#fffef2] font-bold text-sm tracking-[0.2em] flex items-center justify-center gap-3 active:scale-[0.98] transition-all shadow-xl"
          >
            <ShoppingBag className="w-5 h-5" />
            商品を購入する
          </button>
          
          <p className="text-center text-[10px] text-[#999999] mt-4 tracking-wider flex items-center justify-center gap-1">
             <ExternalLink className="w-3 h-3" /> 公式オンラインストアへ移動します
          </p>
        </div>
      </div>

    </div>
  )
}