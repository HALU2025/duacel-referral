'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { 
  RefreshCw, Loader2, Search, Filter, AlertTriangle, X, Plus, Download, Link as LinkIcon,
  LayoutDashboard, Users, Store, Gift, Settings, ChevronRight, ChevronDown,
  Building, User, Info, LogOut // ★ LogOutアイコンを追加
} from 'lucide-react'
import { motion } from 'framer-motion'

// ==========================================
// 1. 定数・型定義
// ==========================================
const REF_STATUS_OPTIONS = [
  { value: 'pending', label: '仮計上', bgColor: 'bg-amber-100', color: 'text-amber-800', border: 'border-amber-200' },
  { value: 'confirmed', label: '報酬確定', bgColor: 'bg-emerald-100', color: 'text-emerald-800', border: 'border-emerald-200' },
  { value: 'issued', label: '分配済', bgColor: 'bg-blue-100', color: 'text-blue-800', border: 'border-blue-200' },
  { value: 'cancel', label: 'キャンセル', bgColor: 'bg-gray-100', color: 'text-gray-600', border: 'border-gray-200' },
]

const REDEEM_STATUS_OPTIONS = [
  { value: 'processing', label: '処理中', bgColor: 'bg-amber-100', color: 'text-amber-800' },
  { value: 'completed', label: '交換完了', bgColor: 'bg-emerald-100', color: 'text-emerald-800' },
  { value: 'failed_retryable', label: '再送待ち', bgColor: 'bg-red-100', color: 'text-red-800' },
  { value: 'failed_fatal', label: 'エラー', bgColor: 'bg-gray-200', color: 'text-gray-700' },
]

const CANCEL_REASONS = [
  'お客様都合によるキャンセル・返品',
  'いたずら・不正な申し込み',
  '重複登録・対象外の申し込み',
  '条件未達による否認',
  'その他'
]

const PAGE_TITLES: Record<string, string> = {
  home: 'ダッシュボード',
  referrals: '成果一覧',
  redemptions: 'ポイント交換管理',
  users: 'ユーザー・店舗管理',
  settings: 'マスタ設定'
}

export default function AdminDashboard() {
  const router = useRouter()

  // ==========================================
  // 2. ステート管理
  // ==========================================
  const [activeTab, setActiveTab] = useState<'home' | 'referrals' | 'redemptions' | 'users' | 'settings'>('home')
  
  // データステート
  const [referrals, setReferrals] = useState<any[]>([])
  const [redemptions, setRedemptions] = useState<any[]>([])
  const [shops, setShops] = useState<any[]>([])
  const [staffs, setStaffs] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [pointTransactions, setPointTransactions] = useState<any[]>([])
  
  const [loading, setLoading] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  const [authError, setAuthError] = useState('')

  // 検索・フィルター用
  const [refFilters, setRefFilters] = useState({ order_number: '', customer_number: '', shop_number: '', status: '', date_start: '', date_end: '' })
  const [filteredReferrals, setFilteredReferrals] = useState<any[]>([])
  const [isRefFilterOpen, setIsRefFilterOpen] = useState(false)

  // モーダル・UI用
  const [isRefModalOpen, setIsRefModalOpen] = useState(false)
  const [editingRef, setEditingRef] = useState<any>(null)
  
  const [isShopModalOpen, setIsShopModalOpen] = useState(false)
  const [editingShop, setEditingShop] = useState<any>(null)
  
  const [editingCategories, setEditingCategories] = useState<any[]>([])
  const [expandedShopId, setExpandedShopId] = useState<string | null>(null) 

  // サマリー用
  const summary = useMemo(() => {
    return {
      totalPointsIssued: pointTransactions.reduce((sum, tx) => sum + (Number(tx.points) || 0), 0),
      totalRedeemed: redemptions.filter(r => r.status === 'completed').reduce((sum, r) => sum + (Number(r.points_consumed) || 0), 0),
      activeShops: shops.length,
      activeStaffs: staffs.filter(s => !s.is_deleted).length,
      pendingReferrals: referrals.filter(r => r.status === 'pending').length
    }
  }, [pointTransactions, redemptions, shops, staffs, referrals])

  // ==========================================
  // 3. データ取得・認証ロジック (★ここをVIPルーム仕様に改修)
  // ==========================================
  const fetchData = async () => {
    setLoading(true)
    
    // 1. ログインしているかチェック
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { 
      router.replace('/admin-login') 
      return 
    }

    // 2. VIPルーム（system_adminsテーブル）に存在するか厳格にチェック
    const { data: adminData, error: adminError } = await supabase
      .from('system_admins')
      .select('id')
      .eq('id', user.id)
      .maybeSingle()

    if (!adminData) {
      // 一般ユーザーが迷い込んだ場合は強制ログアウトして追い出す
      await supabase.auth.signOut()
      setAuthError('管理者権限がありません。')
      router.replace('/admin-login')
      return
    }

    // 3. 認証OKならデータを取得
    const [r, s, st, cat, tx, ex] = await Promise.all([
      supabase.from('referrals').select('*').order('created_at', { ascending: false }).limit(2000),
      supabase.from('shops').select('*').order('created_at', { ascending: false }),
      supabase.from('staffs').select('*').order('created_at', { ascending: true }),
      supabase.from('shop_categories').select('*').order('reward_points', { ascending: true }),
      supabase.from('point_transactions').select('*').order('created_at', { ascending: true }),
      supabase.from('reward_exchanges').select('*').order('created_at', { ascending: false })
    ])
    
    if (r.data) { setReferrals(r.data); setFilteredReferrals(r.data); }
    if (s.data) setShops(s.data)
    if (st.data) setStaffs(st.data)
    if (cat.data) { setCategories(cat.data); setEditingCategories(cat.data); }
    if (tx.data) setPointTransactions(tx.data)
    if (ex.data) setRedemptions(ex.data)
    
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  // ★ログアウト処理を追加
  const handleLogout = async () => {
    if (!confirm('ログアウトしますか？')) return
    await supabase.auth.signOut()
    router.replace('/admin-login')
  }

  // ==========================================
  // ヘルパー＆フィルター
  // ==========================================
  const getShopOwnerName = (shopId: string) => {
    const owner = staffs.find(staff => staff.shop_id === shopId && staff.email === shops.find(s => s.id === shopId)?.owner_email)
    return owner ? owner.name : '不明'
  }

  const getShopByShopId = (shopId: string) => shops.find(s => s.id === shopId)

  const openShopEditModal = (shopId: string) => {
    const targetShop = getShopByShopId(shopId)
    if (targetShop) { setEditingShop(targetShop); setIsShopModalOpen(true); }
  }

  const handleRefFilter = () => {
    let result = [...referrals]
    if (refFilters.order_number) result = result.filter(r => r.order_number?.includes(refFilters.order_number))
    if (refFilters.customer_number) result = result.filter(r => r.customer_name?.includes(refFilters.customer_number))
    if (refFilters.shop_number) {
      const targetShop = shops.find(s => String(s.shop_number) === refFilters.shop_number)
      if (targetShop) result = result.filter(r => r.shop_id === targetShop.id)
      else result = []
    }
    if (refFilters.status) result = result.filter(r => r.status === refFilters.status)
    if (refFilters.date_start) {
      const start = new Date(refFilters.date_start).getTime()
      result = result.filter(r => new Date(r.created_at).getTime() >= start)
    }
    if (refFilters.date_end) {
      const end = new Date(refFilters.date_end).getTime() + 86400000 
      result = result.filter(r => new Date(r.created_at).getTime() <= end)
    }
    setFilteredReferrals(result)
    setIsRefFilterOpen(false)
  }

  const handleClearRefFilters = () => {
    setRefFilters({ order_number: '', customer_number: '', shop_number: '', status: '', date_start: '', date_end: '' })
    setFilteredReferrals(referrals)
  }

  const handleCopyUrl = (token: string, type: 'staff' | 'invite') => {
    const url = type === 'staff' ? `${window.location.origin}/m/${token}` : `${window.location.origin}/reg/${token}`
    navigator.clipboard.writeText(url)
    alert(`URLをコピーしました。\n${url}`)
  }

  // ==========================================
  // アクションハンドラー
  // ==========================================
  const issuePoints = async (referral: any, currentShops: any[], currentCategories: any[]) => {
    const { data: existing } = await supabase.from('point_transactions').select('id').eq('referral_id', referral.id).limit(1)
    if (existing && existing.length > 0) return

    const { data: pastTxs } = await supabase.from('point_transactions').select('metadata').eq('shop_id', referral.shop_id)
    const hasReceivedBonus = pastTxs?.some(tx => tx.metadata?.is_bonus === true) || false
    const isFirstTime = !hasReceivedBonus

    const shop = currentShops.find(s => s.id === referral.shop_id)
    const category = currentCategories.find(c => c.id === shop?.category_id) || currentCategories[0]

    const standardPoints = Number(category?.reward_points) || 0
    const transactions = []
    
    transactions.push({
      shop_id: referral.shop_id, referral_id: referral.id,
      points: standardPoints, reason: `紹介報酬`, status: 'confirmed',
      metadata: { order_number: referral.order_number }
    })

    if (isFirstTime && category?.first_bonus_enabled) {
      transactions.push({
        shop_id: referral.shop_id, referral_id: referral.id,
        points: Number(category.first_bonus_points) || 0, reason: '初回ボーナス', status: 'confirmed',
        metadata: { order_number: referral.order_number, is_bonus: true }
      })
    }

    await supabase.from('point_transactions').insert(transactions)
  }

  const removePoints = async (referralId: string) => {
    await supabase.from('point_transactions').delete().eq('referral_id', referralId)
  }

  const handleRefModalSave = async (updatedRef: any) => {
    const originalRef = referrals.find(r => r.id === updatedRef.id)
    if (originalRef?.status === updatedRef.status && originalRef?.cancel_reason === updatedRef.cancel_reason) {
      setIsRefModalOpen(false); return;
    }

    if (originalRef?.status === 'cancel') { alert('キャンセル済みのデータは変更できません。'); return; }
    if (originalRef?.status === 'issued') { alert('分配済のデータは変更できません。'); return; }
    if (originalRef?.status === 'confirmed' && updatedRef.status === 'pending') { alert('確定済みのデータを仮計上に戻すことはできません。'); return; }
    if (updatedRef.status === 'cancel' && !updatedRef.cancel_reason) { alert('キャンセル事由を選択してください。'); return; }

    if (updatedRef.status === 'cancel') {
      const msg = originalRef?.status === 'confirmed'
        ? "【⚠️ 重大警告】\nこのデータはすでに「報酬確定」されています。\nキャンセルを実行すると、ユーザーへ付与済みのポイントが没収（マイナス処理）されます。\n\n本当にキャンセルしてよろしいですか？"
        : "【⚠️ 警告】\nこのデータをキャンセル（無効化）します。\n一度キャンセルすると、今後一切ステータスを戻すことはできません。\n\n本当にキャンセルしてよろしいですか？";
      if (!confirm(msg)) return;
    }

    setIsProcessing(true)
    await supabase.from('referrals').update({ 
      status: updatedRef.status,
      cancel_reason: updatedRef.status === 'cancel' ? updatedRef.cancel_reason : null 
    }).eq('id', updatedRef.id)
    
    if (updatedRef.status === 'confirmed' && originalRef?.status !== 'confirmed') {
      await issuePoints(updatedRef, shops, categories)
    } else if (updatedRef.status !== 'confirmed' && originalRef?.status === 'confirmed') {
      await removePoints(updatedRef.id)
    } else if (updatedRef.status === 'issued' && originalRef?.status === 'confirmed') {
      await supabase.from('point_transactions').update({ status: 'paid' }).eq('referral_id', updatedRef.id).eq('status', 'confirmed')
    }
    
    setIsRefModalOpen(false)
    await fetchData()
    setIsProcessing(false)
  }

  const handleShopModalSave = async (updatedShop: any) => {
    setIsProcessing(true)
    const { error } = await supabase.from('shops').update({
      name: updatedShop.name, phone: updatedShop.phone, category_id: updatedShop.category_id || null
    }).eq('id', updatedShop.id)

    if (error) alert('更新失敗: ' + error.message)
    else { setIsShopModalOpen(false); await fetchData(); }
    setIsProcessing(false)
  }

  const handleCategoryChange = (id: string, field: string, value: any) => {
    setEditingCategories(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c))
  }
  
  const handleAddCategory = () => {
    if (editingCategories.length >= 5) { alert('カテゴリは最大5つまで設定できます。'); return; }
    setEditingCategories([...editingCategories, {
      id: `new_${Date.now()}`, label: '新規カテゴリ', reward_points: 0,
      first_bonus_enabled: false, first_bonus_points: 0, signup_bonus_enabled: false, signup_bonus_points: 0,
      recurring_bonus_enabled: false, recurring_bonus_points: 0,
      isNew: true
    }])
  }

  const handleSaveAllSettings = async () => {
    if (!confirm('カテゴリ設定を保存しますか？')) return
    setIsProcessing(true)
    for (const cat of editingCategories) {
      const dataToSave = {
        label: cat.label,
        reward_points: cat.reward_points,
        first_bonus_enabled: cat.first_bonus_enabled || false,
        first_bonus_points: cat.first_bonus_points || 0,
        signup_bonus_enabled: cat.signup_bonus_enabled || false,
        signup_bonus_points: cat.signup_bonus_points || 0,
        recurring_bonus_enabled: cat.recurring_bonus_enabled || false,
        recurring_bonus_points: cat.recurring_bonus_points || 0
      }
      if (cat.isNew) { await supabase.from('shop_categories').insert(dataToSave) } 
      else { await supabase.from('shop_categories').update(dataToSave).eq('id', cat.id) }
    }
    await fetchData()
    setIsProcessing(false)
    alert('設定を保存しました。')
  }

  if (authError) return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-red-600 text-sm font-bold">{authError}</div>
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-900 text-sm"><Loader2 className="w-6 h-6 animate-spin"/></div>

  const activeFilterCountVal = Object.values(refFilters).filter(val => val !== '').length

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans flex flex-col md:flex-row">
      
      {/* =========================================
          サイドナビゲーション (デスクトップ) / ヘッダー (モバイル)
      ========================================= */}
      <aside className="w-full md:w-64 bg-white border-r border-gray-200 shadow-sm md:min-h-screen flex flex-col shrink-0">
        <div className="px-6 py-4 flex items-center gap-3 border-b border-gray-200">
          <img src="/logo-duacel.svg" alt="Duacel" className="h-6 w-auto" onError={(e) => e.currentTarget.style.display = 'none'} />
          <span className="text-base font-bold tracking-wider text-gray-900">HQ Admin</span>
        </div>
        
        <nav className="flex md:flex-col gap-1 p-4 overflow-x-auto md:overflow-x-visible">
          {[
            { id: 'home', icon: <LayoutDashboard className="w-4 h-4"/>, label: PAGE_TITLES.home },
            { id: 'referrals', icon: <Store className="w-4 h-4"/>, label: PAGE_TITLES.referrals },
            { id: 'redemptions', icon: <Gift className="w-4 h-4"/>, label: PAGE_TITLES.redemptions },
            { id: 'users', icon: <Users className="w-4 h-4"/>, label: PAGE_TITLES.users },
            { id: 'settings', icon: <Settings className="w-4 h-4"/>, label: PAGE_TITLES.settings },
          ].map((tab) => (
            <button 
              key={tab.id} 
              onClick={() => setActiveTab(tab.id as any)} 
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${activeTab === tab.id ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </nav>
        
        {/* ★ここにログアウトボタンを追加 */}
        <div className="mt-auto p-4 border-t border-gray-200 flex flex-col gap-2">
          <button onClick={fetchData} className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-lg transition-colors">
            <RefreshCw className="w-4 h-4" /> 再読み込み
          </button>
          <button onClick={handleLogout} className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-500 font-bold hover:bg-red-50 rounded-lg transition-colors">
            <LogOut className="w-4 h-4" /> ログアウト
          </button>
        </div>
      </aside>

      {/* メインコンテンツ */}
      <div className="flex-1 p-4 md:p-8 overflow-x-auto w-full">
        <div className="mb-6 flex justify-between items-center">
          <h1 className="text-2xl font-black text-gray-900">{PAGE_TITLES[activeTab]}</h1>
          {isProcessing && <span className="flex items-center gap-2 text-sm text-blue-600 font-bold bg-blue-50 px-3 py-1 rounded-full"><Loader2 className="w-4 h-4 animate-spin"/> 処理中...</span>}
        </div>

        {/* =========================================
            タブ: Home (ダッシュボード)
        ========================================= */}
        {activeTab === 'home' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <p className="text-sm font-bold text-gray-500 mb-2">総発行ポイント (負債)</p>
                <p className="text-3xl font-black font-mono text-gray-900">{summary.totalPointsIssued.toLocaleString()}</p>
              </div>
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <p className="text-sm font-bold text-gray-500 mb-2">総交換額 (出費)</p>
                <p className="text-3xl font-black font-mono text-blue-600">{summary.totalRedeemed.toLocaleString()}<span className="text-sm font-sans text-gray-400 ml-1">円</span></p>
              </div>
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <p className="text-sm font-bold text-gray-500 mb-2">アクティブ店舗 / スタッフ</p>
                <p className="text-2xl font-black font-mono text-gray-900">{summary.activeShops} <span className="text-sm font-sans text-gray-400 font-normal">/ {summary.activeStaffs} 人</span></p>
              </div>
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm border-l-4 border-l-amber-400">
                <p className="text-sm font-bold text-gray-500 mb-2">仮計上 (未確定) 成果</p>
                <p className="text-3xl font-black font-mono text-amber-600">{summary.pendingReferrals}<span className="text-sm font-sans text-gray-400 ml-1">件</span></p>
              </div>
            </div>
            
            <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5"/>
              <div>
                <h4 className="text-sm font-bold text-blue-900 mb-1">システム運用について</h4>
                <p className="text-xs text-blue-800 leading-relaxed">
                  基本的にはecforceとのAPI連携により、成果の「仮計上」「確定（ポイント付与）」は自動で行われます。<br/>
                  管理者が手動でステータスを変更するのは、イレギュラーなキャンセル対応やエラー時の補填時のみに留めてください。
                </p>
              </div>
            </div>
          </div>
        )}

        {/* =========================================
            タブ: Referrals (成果承認)
        ========================================= */}
        {activeTab === 'referrals' && (
          <div>
            <div className="bg-white border border-gray-200 rounded-xl mb-6 shadow-sm overflow-hidden transition-all">
              <button onClick={() => setIsRefFilterOpen(!isRefFilterOpen)} className="w-full px-5 py-4 flex items-center justify-between bg-white hover:bg-gray-50 transition-colors text-sm font-bold text-gray-700 text-left">
                <span className="flex items-center gap-2"><Filter className="w-4 h-4" /> 検索・絞り込み</span>
                {activeFilterCountVal > 0 && <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs">{activeFilterCountVal}件適用中</span>}
              </button>
              
              {isRefFilterOpen && (
                <div className="p-5 border-t border-gray-200 bg-white">
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4 text-sm font-medium">
                    <div><label className="block text-gray-500 mb-1.5">受注番号</label><input type="text" value={refFilters.order_number} onChange={(e) => setRefFilters({...refFilters, order_number: e.target.value})} className="w-full border border-gray-300 px-3 py-2 outline-none rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-400" /></div>
                    <div><label className="block text-gray-500 mb-1.5">顧客名</label><input type="text" value={refFilters.customer_number} onChange={(e) => setRefFilters({...refFilters, customer_number: e.target.value})} className="w-full border border-gray-300 px-3 py-2 outline-none rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-400" /></div>
                    <div><label className="block text-gray-500 mb-1.5">店舗番号</label><input type="text" placeholder="例: 12" value={refFilters.shop_number} onChange={(e) => setRefFilters({...refFilters, shop_number: e.target.value})} className="w-full border border-gray-300 px-3 py-2 outline-none rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-400" /></div>
                    <div>
                      <label className="block text-gray-500 mb-1.5">ステータス</label>
                      <select value={refFilters.status} onChange={(e) => setRefFilters({...refFilters, status: e.target.value})} className="w-full border border-gray-300 px-3 py-2 outline-none bg-white rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-400">
                        <option value="">すべて</option>
                        {REF_STATUS_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <div className="w-1/2"><label className="block text-gray-500 mb-1.5">From</label><input type="date" value={refFilters.date_start} onChange={(e) => setRefFilters({...refFilters, date_start: e.target.value})} className="w-full border border-gray-300 px-2 py-2 outline-none rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-400" /></div>
                      <div className="w-1/2"><label className="block text-gray-500 mb-1.5">To</label><input type="date" value={refFilters.date_end} onChange={(e) => setRefFilters({...refFilters, date_end: e.target.value})} className="w-full border border-gray-300 px-2 py-2 outline-none rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-400" /></div>
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end pt-4 border-t border-gray-100">
                    <button onClick={handleClearRefFilters} className="px-5 py-2 text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">クリア</button>
                    <button onClick={handleRefFilter} className="px-5 py-2 text-sm font-bold text-white bg-gray-900 hover:bg-black rounded-lg flex items-center gap-2 transition-colors"><Search className="w-4 h-4"/> 検索する</button>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto shadow-sm">
              <table className="w-full text-left border-collapse whitespace-nowrap">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 text-xs tracking-wider uppercase">
                    <th className="p-4 font-bold">受注番号</th>
                    <th className="p-4 font-bold">ステータス</th>
                    <th className="p-4 font-bold">店舗情報</th>
                    <th className="p-4 font-bold">担当スタッフ</th>
                    <th className="p-4 font-bold">獲得Pt</th>
                    <th className="p-4 font-bold">発生日時</th>
                    <th className="p-4 font-bold text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm text-gray-800 font-medium">
                  {filteredReferrals.map(ref => {
                    const shop = getShopByShopId(ref.shop_id);
                    const staff = staffs.find(s => s.id === ref.staff_id);
                    const status = REF_STATUS_OPTIONS.find(s => s.value === ref.status) || REF_STATUS_OPTIONS[0];
                    const isDead = ref.status === 'cancel' || ref.status === 'issued';
                    
                    // ポイント計算
                    const refTxs = pointTransactions.filter(tx => tx.referral_id === ref.id);
                    const isOldest = referrals.filter(r => r.shop_id === ref.shop_id && r.status !== 'cancel').sort((a,b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0]?.id === ref.id;
                    const isFirstTime = ref.status !== 'cancel' && (refTxs.length > 0 ? refTxs.some(tx => tx.metadata?.is_bonus) : isOldest);
                    const category = categories.find(r => r.id === shop?.category_id);
                    const standardPt = Number(category?.reward_points) || 0;
                    const bonusPt = (isFirstTime && category?.first_bonus_enabled) ? Number(category.first_bonus_points) : 0;
                    const totalPt = ref.status === 'cancel' ? 0 : (refTxs.length > 0 ? refTxs.reduce((sum, tx) => sum + Number(tx.points), 0) : standardPt + bonusPt);

                    return (
                      <tr key={ref.id} className={`transition-colors ${isDead ? 'bg-gray-50/50 opacity-75' : 'hover:bg-blue-50/30'}`}>
                        <td className="p-4 font-mono">{ref.order_number}</td>
                        <td className="p-4">
                          <span className={`px-2.5 py-1 rounded-md text-xs border ${status.bgColor} ${status.color} ${status.border} font-bold inline-flex items-center justify-center min-w-[70px]`}>
                            {status.label}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="flex flex-col">
                            <span>{shop?.name || '不明'}</span>
                            <span className="text-xs text-gray-400 font-mono">No.{shop?.shop_number}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex flex-col">
                            <span>{staff?.name || '不明'}</span>
                            <span className="text-xs text-gray-400">{ref.customer_name ? `${ref.customer_name} 様の${ref.recurring_count > 1 ? '定期' : '初回'}` : ''}</span>
                          </div>
                        </td>
                        <td className="p-4 font-mono font-bold">{totalPt.toLocaleString()}</td>
                        <td className="p-4 font-mono text-gray-500 text-xs">{new Date(ref.created_at).toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                        <td className="p-4 text-right">
                          <button onClick={() => { setEditingRef(ref); setIsRefModalOpen(true); }} className="text-blue-600 hover:text-blue-800 font-bold text-xs bg-blue-50 px-3 py-1.5 rounded-lg transition-colors">
                            詳細・編集
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {filteredReferrals.length === 0 && <div className="p-10 text-center text-gray-400 font-bold">条件に一致する成果がありません</div>}
            </div>
          </div>
        )}

        {/* =========================================
            タブ: Redemptions (ポイント交換管理)
        ========================================= */}
        {activeTab === 'redemptions' && (
          <div>
            <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto shadow-sm">
              <table className="w-full text-left border-collapse whitespace-nowrap">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 text-xs tracking-wider uppercase">
                    <th className="p-4 font-bold">申請日時</th>
                    <th className="p-4 font-bold">ステータス</th>
                    <th className="p-4 font-bold">申請スタッフ</th>
                    <th className="p-4 font-bold">交換Pt</th>
                    <th className="p-4 font-bold">ギフトURL</th>
                    <th className="p-4 font-bold text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm text-gray-800 font-medium">
                  {redemptions.map(req => {
                    const staff = staffs.find(s => s.id === req.staff_id);
                    const shop = shops.find(s => s.id === req.shop_id);
                    const status = REDEEM_STATUS_OPTIONS.find(s => s.value === req.status) || REDEEM_STATUS_OPTIONS[3];

                    return (
                      <tr key={req.id} className="hover:bg-gray-50 transition-colors">
                        <td className="p-4 font-mono text-gray-500 text-xs">{new Date(req.created_at).toLocaleString('ja-JP')}</td>
                        <td className="p-4">
                          <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${status.bgColor} ${status.color}`}>
                            {status.label}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="flex flex-col">
                            <span>{staff?.name || '不明'}</span>
                            <span className="text-xs text-gray-400">{shop?.name || '不明'}</span>
                          </div>
                        </td>
                        <td className="p-4 font-mono font-bold">{Number(req.points_consumed).toLocaleString()}</td>
                        <td className="p-4">
                          {req.gift_url ? (
                            <a href={req.gift_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1 text-xs">
                              URLを開く <LinkIcon className="w-3 h-3"/>
                            </a>
                          ) : <span className="text-gray-400 text-xs">-</span>}
                        </td>
                        <td className="p-4 text-right">
                          <button onClick={() => alert(JSON.stringify(req.error_details || 'エラー詳細はありません', null, 2))} className="text-gray-500 hover:text-gray-900 text-xs font-bold">
                            ログ確認
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {redemptions.length === 0 && <div className="p-10 text-center text-gray-400 font-bold">ポイント交換履歴がありません</div>}
            </div>
          </div>
        )}

        {/* =========================================
            タブ: Users (店舗・スタッフ管理)
        ========================================= */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            <div className="flex justify-between items-end mb-4">
              <p className="text-sm text-gray-500 font-bold">登録されている店舗と、そこに所属するメンバーを管理します。</p>
            </div>

            {shops.map(shop => {
              const shopStaffs = staffs.filter(s => s.shop_id === shop.id && !s.is_deleted)
              const isExpanded = expandedShopId === shop.id
              const category = categories.find(c => c.id === shop.category_id)

              return (
                <div key={shop.id} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                  <div 
                    onClick={() => setExpandedShopId(isExpanded ? null : shop.id)}
                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center shrink-0">
                        <Building className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-black text-gray-900 text-base flex items-center gap-2">
                          {shop.name} <span className="text-xs font-mono text-gray-400 font-medium">No.{shop.shop_number}</span>
                        </h3>
                        <p className="text-xs text-gray-500 mt-1 font-medium">
                          オーナー: {shop.owner_email} / 所属: {shopStaffs.length}名 / {category?.label || 'カテゴリ未設定'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <button 
                        onClick={(e) => { e.stopPropagation(); openShopEditModal(shop.id); }} 
                        className="text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        店舗を編集
                      </button>
                      <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-gray-100 bg-gray-50/50 p-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {shopStaffs.map(staff => (
                          <div key={staff.id} className="bg-white p-4 border border-gray-200 rounded-lg flex flex-col gap-3 shadow-sm">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 bg-gray-100 text-gray-600 rounded-full flex items-center justify-center text-xs font-bold">
                                  {staff.name.charAt(0)}
                                </div>
                                <div>
                                  <p className="text-sm font-bold text-gray-900">{staff.name}</p>
                                  <p className="text-[10px] text-gray-500 font-mono">{staff.email}</p>
                                </div>
                              </div>
                              {staff.email === shop.owner_email && <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded">オーナー</span>}
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => handleCopyUrl(staff.secret_token, 'staff')} className="flex-1 py-1.5 bg-gray-50 border border-gray-200 text-gray-700 text-xs font-bold rounded flex items-center justify-center gap-1.5 hover:bg-gray-100 transition-colors">
                                <LinkIcon className="w-3 h-3" /> マイページURL
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 flex justify-end">
                        <button onClick={() => handleCopyUrl(shop.invite_token, 'invite')} className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1">
                          <LinkIcon className="w-3 h-3" /> この店舗のスタッフ招待URLをコピー
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* =========================================
            タブ: Settings (マスタ設定)
        ========================================= */}
        {activeTab === 'settings' && (
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm w-full overflow-x-auto">
            <div className="mb-6">
              <h3 className="text-base font-black text-gray-900 mb-1">カテゴリ別ポイント設定</h3>
              <p className="text-xs text-gray-500 font-medium">店舗の属性ごとに、通常報酬・初回・定期継続ボーナスを設定します。</p>
            </div>
            
            <div className="space-y-6">
              {editingCategories.map(cat => (
                <div key={cat.id} className="border border-gray-200 rounded-xl p-4 bg-gray-50/50">
                  <div className="mb-4 pb-4 border-b border-gray-200 flex items-center gap-4">
                    <input type="text" value={cat.label} onChange={(e) => handleCategoryChange(cat.id, 'label', e.target.value)} className="w-1/3 border border-gray-300 rounded-lg px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400" placeholder="カテゴリ名" />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-2">通常報酬（ベース）</label>
                      <div className="flex items-center gap-2">
                        <input type="number" value={cat.reward_points} onChange={(e) => handleCategoryChange(cat.id, 'reward_points', Number(e.target.value))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none tabular-nums font-mono focus:ring-2 focus:ring-blue-100" />
                        <span className="text-xs text-gray-500 font-bold">pt</span>
                      </div>
                    </div>
                    
                    <div>
                      <label className="flex items-center gap-2 text-xs font-bold text-gray-700 mb-2">
                        <input type="checkbox" checked={cat.first_bonus_enabled} onChange={(e) => handleCategoryChange(cat.id, 'first_bonus_enabled', e.target.checked)} className="w-3.5 h-3.5" />
                        初回ボーナス
                      </label>
                      <div className="flex items-center gap-2">
                        <input type="number" disabled={!cat.first_bonus_enabled} value={cat.first_bonus_points || 0} onChange={(e) => handleCategoryChange(cat.id, 'first_bonus_points', Number(e.target.value))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none tabular-nums font-mono disabled:bg-gray-100 disabled:text-gray-400 focus:ring-2 focus:ring-blue-100" />
                        <span className="text-xs text-gray-500 font-bold">pt</span>
                      </div>
                    </div>

                    <div>
                      <label className="flex items-center gap-2 text-xs font-bold text-gray-700 mb-2">
                        <input type="checkbox" checked={cat.recurring_bonus_enabled} onChange={(e) => handleCategoryChange(cat.id, 'recurring_bonus_enabled', e.target.checked)} className="w-3.5 h-3.5" />
                        定期ボーナス (2回目以降)
                      </label>
                      <div className="flex items-center gap-2">
                        <input type="number" disabled={!cat.recurring_bonus_enabled} value={cat.recurring_bonus_points || 0} onChange={(e) => handleCategoryChange(cat.id, 'recurring_bonus_points', Number(e.target.value))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none tabular-nums font-mono disabled:bg-gray-100 disabled:text-gray-400 focus:ring-2 focus:ring-blue-100" />
                        <span className="text-xs text-gray-500 font-bold">pt</span>
                      </div>
                    </div>

                    <div>
                      <label className="flex items-center gap-2 text-xs font-bold text-gray-700 mb-2">
                        <input type="checkbox" checked={cat.signup_bonus_enabled} onChange={(e) => handleCategoryChange(cat.id, 'signup_bonus_enabled', e.target.checked)} className="w-3.5 h-3.5" />
                        登録ボーナス
                      </label>
                      <div className="flex items-center gap-2">
                        <input type="number" disabled={!cat.signup_bonus_enabled} value={cat.signup_bonus_points || 0} onChange={(e) => handleCategoryChange(cat.id, 'signup_bonus_points', Number(e.target.value))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none tabular-nums font-mono disabled:bg-gray-100 disabled:text-gray-400 focus:ring-2 focus:ring-blue-100" />
                        <span className="text-xs text-gray-500 font-bold">pt</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center mt-6 pt-6 border-t border-gray-200">
              <button onClick={handleAddCategory} className="flex items-center gap-1 text-sm font-bold text-gray-600 hover:text-gray-900 bg-gray-100 px-4 py-2 rounded-lg transition-colors"><Plus className="w-4 h-4"/>カテゴリ追加</button>
              <button onClick={handleSaveAllSettings} disabled={isProcessing} className="bg-gray-900 text-white text-sm font-bold px-8 py-3 rounded-lg hover:bg-black transition-colors flex items-center gap-2 disabled:opacity-50">
                {isProcessing && <Loader2 className="w-4 h-4 animate-spin"/>} 設定を保存する
              </button>
            </div>
          </div>
        )}
      </div>

      {/* =========================================
          モーダル
      ========================================= */}
      {isRefModalOpen && editingRef && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-black text-gray-900">詳細情報・ステータス更新</h3>
              <button onClick={() => setIsRefModalOpen(false)} className="text-gray-400 hover:bg-gray-100 p-2 rounded-full transition-colors"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="bg-gray-50 border border-gray-200 p-5 rounded-xl text-sm mb-6 space-y-3 text-gray-700 font-medium">
              <div className="grid grid-cols-3 gap-2"><div className="text-gray-500">受注番号</div><div className="col-span-2 font-mono">{editingRef.order_number}</div></div>
              <div className="grid grid-cols-3 gap-2"><div className="text-gray-500">顧客情報</div><div className="col-span-2">{editingRef.customer_name || '不明'} <span className="text-xs text-gray-400 ml-1">({editingRef.recurring_count > 1 ? `定期${editingRef.recurring_count}回目` : '初回'})</span></div></div>
              <div className="grid grid-cols-3 gap-2"><div className="text-gray-500">店舗</div><div className="col-span-2">No.{getShopByShopId(editingRef.shop_id)?.shop_number} {getShopByShopId(editingRef.shop_id)?.name || '不明'}</div></div>
              <div className="grid grid-cols-3 gap-2"><div className="text-gray-500">発生日時</div><div className="col-span-2 font-mono text-gray-500">{new Date(editingRef.created_at).toLocaleString('ja-JP')}</div></div>
            </div>

            <div className="space-y-4 mb-8">
              {editingRef.status === 'cancel' || editingRef.status === 'issued' ? (
                <div className="bg-gray-100 border border-gray-300 rounded-xl p-4 text-sm text-gray-600 font-bold text-center">
                  {editingRef.status === 'cancel' ? 'キャンセル済（変更不可）' : '分配済（変更不可）'}
                </div>
              ) : (
                <div>
                  <label className="block text-sm text-gray-700 mb-2 font-bold">強制ステータス更新 (サポート用)</label>
                  <select value={editingRef.status} onChange={(e) => setEditingRef({...editingRef, status: e.target.value, cancel_reason: e.target.value !== 'cancel' ? '' : editingRef.cancel_reason})} className="w-full border border-gray-300 rounded-lg p-3 text-sm font-bold outline-none bg-white focus:ring-2 focus:ring-blue-100">
                    <option value="pending">仮計上</option>
                    <option value="confirmed">報酬確定</option>
                    <option value="cancel">キャンセル (没収)</option>
                  </select>
                </div>
              )}

              {editingRef.status === 'cancel' && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                  <label className="flex items-center gap-1 text-sm text-red-600 font-bold mb-2 mt-4"><AlertTriangle className="w-4 h-4"/>キャンセル事由</label>
                  <select value={editingRef.cancel_reason || ''} onChange={(e) => setEditingRef({...editingRef, cancel_reason: e.target.value})} className="w-full border border-red-300 bg-red-50 p-3 text-sm font-bold text-red-800 outline-none rounded-lg">
                    <option value="">選択してください</option>
                    {CANCEL_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </motion.div>
              )}
            </div>

            <div className="flex gap-3 justify-end">
              <button onClick={() => setIsRefModalOpen(false)} className="px-5 py-2.5 font-bold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">閉じる</button>
              {editingRef.status !== 'cancel' && editingRef.status !== 'issued' && (
                <button onClick={() => handleRefModalSave(editingRef)} disabled={isProcessing} className="px-5 py-2.5 bg-gray-900 text-white font-bold rounded-lg hover:bg-black disabled:opacity-50 transition-colors flex items-center gap-2">
                  {isProcessing && <Loader2 className="w-4 h-4 animate-spin"/>} 更新を保存
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {isShopModalOpen && editingShop && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-black text-gray-900 mb-6">店舗情報の編集 (No.{editingShop.shop_number})</h3>
            <div className="space-y-4 mb-8 text-sm font-medium">
              <div><label className="block text-gray-500 mb-1.5">店舗名</label><input type="text" value={editingShop.name} onChange={(e) => setEditingShop({...editingShop, name: e.target.value})} className="w-full border border-gray-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-blue-100 font-bold" /></div>
              <div><label className="block text-gray-500 mb-1.5">電話番号</label><input type="tel" value={editingShop.phone || ''} onChange={(e) => setEditingShop({...editingShop, phone: e.target.value})} className="w-full border border-gray-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-blue-100 font-bold" /></div>
              <div>
                <label className="block text-gray-500 mb-1.5">設定カテゴリ</label>
                <select value={editingShop.category_id || ''} onChange={(e) => setEditingShop({...editingShop, category_id: e.target.value})} className="w-full border border-gray-300 rounded-lg p-3 outline-none bg-white focus:ring-2 focus:ring-blue-100 font-bold">
                  <option value="">未設定</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setIsShopModalOpen(false)} className="px-5 py-2.5 font-bold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">キャンセル</button>
              <button onClick={() => handleShopModalSave(editingShop)} disabled={isProcessing} className="px-5 py-2.5 bg-gray-900 text-white font-bold rounded-lg hover:bg-black transition-colors disabled:opacity-50">保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}