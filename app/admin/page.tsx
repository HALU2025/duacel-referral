'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { 
  RefreshCw, Loader2, Search, Filter, AlertTriangle, X, Plus, Download, Link as LinkIcon
} from 'lucide-react'

// ==========================================
// 1. 定数・型定義
// ==========================================
const STATUS_OPTIONS = [
  { value: 'pending', label: '仮計上', bgColor: 'bg-amber-100', color: 'text-amber-800', border: 'border-amber-200' },
  { value: 'confirmed', label: '報酬確定', bgColor: 'bg-emerald-100', color: 'text-emerald-800', border: 'border-emerald-200' },
  { value: 'issued', label: '発行済', bgColor: 'bg-blue-100', color: 'text-blue-800', border: 'border-blue-200' },
  { value: 'cancel', label: 'キャンセル', bgColor: 'bg-gray-100', color: 'text-gray-600', border: 'border-gray-200' },
]

const CANCEL_REASONS = [
  'お客様都合によるキャンセル・返品',
  'いたずら・不正な申し込み',
  '重複登録・対象外の申し込み',
  '条件未達による否認',
  'その他'
]

const initialFilterState = {
  order_number: '', customer_number: '', shop_number: '',
  status: '', date_start: '', date_end: ''
}

const PAGE_TITLES: Record<string, string> = {
  referrals: '成果承認',
  payments: '支払管理',
  shops: '店舗管理',
  settings: 'マスタ設定'
}

export default function AdminDashboard() {
  const router = useRouter()

  // ==========================================
  // 2. ステート管理
  // ==========================================
  const [activeTab, setActiveTab] = useState<'referrals' | 'payments' | 'shops' | 'settings'>('referrals')
  const [referrals, setReferrals] = useState<any[]>([])
  const [shops, setShops] = useState<any[]>([])
  const [staffs, setStaffs] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [pointTransactions, setPointTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  const [authError, setAuthError] = useState('')

  const [filters, setFilters] = useState(initialFilterState)
  const [filteredReferrals, setFilteredReferrals] = useState<any[]>([])
  const [isFilterOpen, setIsFilterOpen] = useState(false)

  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isAllSelected, setIsAllSelected] = useState(false)

  const [isRefModalOpen, setIsRefModalOpen] = useState(false)
  const [editingRef, setEditingRef] = useState<any>(null)
  
  const [isShopModalOpen, setIsShopModalOpen] = useState(false)
  const [editingShop, setEditingShop] = useState<any>(null)
  
  const [editingCategories, setEditingCategories] = useState<any[]>([])

  const activeFilterCount = Object.values(filters).filter(val => val !== '').length

  // ==========================================
  // 3. データ取得・認証ロジック
  // ==========================================
  const fetchData = async () => {
    setLoading(true)
    
    // ★ セキュリティガード: 管理者権限チェック
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return; }

    const adminEmails = process.env.NEXT_PUBLIC_ADMIN_EMAILS
    if (adminEmails && !adminEmails.split(',').includes(user.email || '')) {
      setAuthError('管理者権限がありません。')
      router.push('/dashboard')
      return
    }

    // ★ パフォーマンスガード: referralsにlimitを設定（将来的にAPI経由のページネーションへ移行推奨）
    const [r, s, st, cat, tx] = await Promise.all([
      supabase.from('referrals').select('*').order('created_at', { ascending: false }).limit(2000),
      supabase.from('shops').select('*').order('created_at', { ascending: false }),
      supabase.from('staffs').select('*').order('created_at', { ascending: true }),
      supabase.from('shop_categories').select('*').order('reward_points', { ascending: true }),
      supabase.from('point_transactions').select('*').order('created_at', { ascending: true })
    ])
    
    if (r.data) { setReferrals(r.data); setFilteredReferrals(r.data); }
    if (s.data) setShops(s.data)
    if (st.data) setStaffs(st.data)
    if (tx.data) setPointTransactions(tx.data)
    if (cat.data) {
      setCategories(cat.data)
      setEditingCategories(cat.data)
    }
    
    setSelectedIds([])
    setIsAllSelected(false)
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [])

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

  const handleFilter = () => {
    let result = [...referrals]
    if (filters.order_number) result = result.filter(r => r.order_number?.includes(filters.order_number))
    if (filters.customer_number) result = result.filter(r => r.customer_name?.includes(filters.customer_number)) // 顧客名またはID
    if (filters.shop_number) {
      const targetShop = shops.find(s => String(s.shop_number) === filters.shop_number)
      if (targetShop) result = result.filter(r => r.shop_id === targetShop.id)
      else result = []
    }
    if (filters.status) result = result.filter(r => r.status === filters.status)
    if (filters.date_start) {
      const start = new Date(filters.date_start).getTime()
      result = result.filter(r => new Date(r.created_at).getTime() >= start)
    }
    if (filters.date_end) {
      const end = new Date(filters.date_end).getTime() + 86400000 
      result = result.filter(r => new Date(r.created_at).getTime() <= end)
    }
    setFilteredReferrals(result)
    setSelectedIds([])
    setIsAllSelected(false)
    setIsFilterOpen(false)
  }

  const handleClearFilters = () => {
    setFilters(initialFilterState)
    setFilteredReferrals(referrals)
    setSelectedIds([])
    setIsAllSelected(false)
  }

  const exportPaymentsCSV = () => {
    const headers = ['店舗番号', '店舗名', '紹介件数', '累計報酬額(pt)', '未払い額(pt)', '支払い済額(pt)']
    const rows = shops.map(shop => {
      const validTxs = pointTransactions.filter(tx => tx.shop_id === shop.id && referrals.find(r => r.id === tx.referral_id)?.status !== 'cancel');
      if (validTxs.length === 0) return null;
      const uniqueReferralCount = new Set(validTxs.map(tx => tx.referral_id)).size;
      const unpaidTotal = validTxs.filter(tx => tx.status === 'confirmed').reduce((sum, tx) => sum + (Number(tx.points) || 0), 0);
      const paidTotal = validTxs.filter(tx => tx.status === 'paid').reduce((sum, tx) => sum + (Number(tx.points) || 0), 0);
      return [shop.shop_number, shop.name, uniqueReferralCount, unpaidTotal + paidTotal, unpaidTotal, paidTotal]
    }).filter(Boolean) as (string | number)[][]

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' }) // Excel文字化け防止のBOM
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `payments_export_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // ==========================================
  // アクションハンドラー (マニュアル介入用)
  // ==========================================
  const handleToggleAll = () => {
    if (isAllSelected) {
      setSelectedIds([])
      setIsAllSelected(false)
    } else {
      const selectableIds = filteredReferrals.filter(r => r.status === 'pending').map(r => r.id)
      setSelectedIds(selectableIds)
      setIsAllSelected(selectableIds.length > 0)
    }
  }

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
      const selectableCount = filteredReferrals.filter(r => r.status === 'pending').length
      setIsAllSelected(next.length === selectableCount && selectableCount > 0)
      return next
    })
  }

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

  const handleBulkConfirm = async () => {
    if (selectedIds.length === 0) return
    if (!confirm(`選択した ${selectedIds.length} 件を「報酬確定」にしますか？\n※通常はシステムが自動処理します。手動での実行は例外的な対応時のみ推奨されます。`)) return
    
    setIsProcessing(true)
    const { error } = await supabase.from('referrals').update({ status: 'confirmed' }).in('id', selectedIds)
    if (error) { alert('エラーが発生しました'); setIsProcessing(false); return; }
    
    const targets = referrals.filter(r => selectedIds.includes(r.id))
    for (const target of targets) {
      if (target.status !== 'confirmed') await issuePoints(target, shops, categories)
    }
    
    await fetchData()
    setIsProcessing(false)
  }

  const handleRefModalSave = async (updatedRef: any) => {
    const originalRef = referrals.find(r => r.id === updatedRef.id)
    if (originalRef?.status === updatedRef.status && originalRef?.cancel_reason === updatedRef.cancel_reason) {
      setIsRefModalOpen(false); return;
    }

    if (originalRef?.status === 'cancel') { alert('キャンセル済みのデータは変更できません。'); return; }
    if (originalRef?.status === 'issued') { alert('発行済のデータは変更できません。'); return; }
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

  const handlePaymentComplete = async (shopId: string) => {
    if (!confirm('この店舗の未払いを「発行済」にしますか？')) return
    setIsProcessing(true)
    try {
      const { data: targetTxs } = await supabase.from('point_transactions').select('referral_id').eq('shop_id', shopId).eq('status', 'confirmed')
      if (!targetTxs || targetTxs.length === 0) { setIsProcessing(false); return; }

      const targetRefIds = Array.from(new Set(targetTxs.map(tx => tx.referral_id)))
      await supabase.from('point_transactions').update({ status: 'paid' }).eq('shop_id', shopId).eq('status', 'confirmed')
      await supabase.from('referrals').update({ status: 'issued' }).in('id', targetRefIds)
      await fetchData()
    } catch (err) { console.error(err) } finally { setIsProcessing(false) }
  }

  const handleCategoryChange = (id: string, field: string, value: any) => {
    setEditingCategories(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c))
  }
  
  const handleAddCategory = () => {
    if (editingCategories.length >= 5) {
      alert('カテゴリは最大5つまで設定できます。')
      return
    }
    setEditingCategories([...editingCategories, {
      id: `new_${Date.now()}`,
      label: '新規カテゴリ',
      reward_points: 0,
      first_bonus_enabled: false,
      first_bonus_points: 0,
      signup_bonus_enabled: false,
      signup_bonus_points: 0,
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
        signup_bonus_points: cat.signup_bonus_points || 0
      }
      if (cat.isNew) {
        await supabase.from('shop_categories').insert(dataToSave)
      } else {
        await supabase.from('shop_categories').update(dataToSave).eq('id', cat.id)
      }
    }
    await fetchData()
    setIsProcessing(false)
    alert('設定を保存しました。')
  }

  const handleManualUrlIssue = (staffId: string) => {
    const staff = staffs.find(s => s.id === staffId)
    if (!staff) return
    const url = `${window.location.origin}/m/${staff.secret_token}`
    navigator.clipboard.writeText(url)
    alert(`マイページURLをコピーしました。\nURL: ${url}\nユーザーへ直接連絡してください。`)
  }

  if (authError) return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-red-600 text-sm font-bold">{authError}</div>
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-900 text-sm"><Loader2 className="w-6 h-6 animate-spin"/></div>

  const originalRefForModal = editingRef ? referrals.find(r => r.id === editingRef.id) : null
  const isEditingLocked = originalRefForModal?.status === 'cancel' || originalRefForModal?.status === 'issued'
  const editingShopData = editingRef ? getShopByShopId(editingRef.shop_id) : null
  const editingOwnerName = editingRef ? getShopOwnerName(editingRef.shop_id) : '不明'
  const editingConfirmedTx = editingRef ? pointTransactions.find(tx => tx.referral_id === editingRef.id) : null

  let availableStatusOptions = STATUS_OPTIONS
  if (originalRefForModal?.status === 'pending') {
    availableStatusOptions = STATUS_OPTIONS.filter(opt => ['pending', 'confirmed', 'cancel'].includes(opt.value))
  } else if (originalRefForModal?.status === 'confirmed') {
    availableStatusOptions = STATUS_OPTIONS.filter(opt => ['confirmed', 'issued', 'cancel'].includes(opt.value))
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans flex flex-col">
      
      {/* =========================================
          ヘッダー
      ========================================= */}
      <header className="bg-white border-b border-gray-200 shadow-sm relative z-20">
        <div className="px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <img src="/logo-duacel.svg" alt="Duacel Logo" className="h-6 w-auto" onError={(e) => e.currentTarget.style.display = 'none'} />
            <span className="text-lg font-bold tracking-wider pl-3 border-l border-gray-300 text-gray-900">HQ管理システム</span>
          </div>
          <button onClick={fetchData} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors">
            <RefreshCw className="w-4 h-4" /> 再読み込み
          </button>
        </div>
        
        {/* タブナビゲーション */}
        <div className="px-6 flex gap-8 text-sm font-bold text-gray-500">
          {['referrals', 'payments', 'shops', 'settings'].map((key) => (
            <button 
              key={key} 
              onClick={() => setActiveTab(key as any)} 
              className={`py-3 transition-colors relative ${activeTab === key ? 'text-blue-600' : 'hover:text-gray-900'}`}
            >
              {PAGE_TITLES[key]}
              {activeTab === key && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600" />}
            </button>
          ))}
        </div>
      </header>

      {/* メインコンテンツ */}
      <div className="flex-1 p-6 overflow-x-auto w-full">
        <h1 className="text-[18px] font-bold text-gray-900 mb-6">{PAGE_TITLES[activeTab]}</h1>

        {/* =========================================
            タブ: Referrals (成果承認)
        ========================================= */}
        {activeTab === 'referrals' && (
          <div>
            <div className="bg-white border border-gray-200 rounded-[4px] mb-4 shadow-[0_0_20px_rgba(0,0,0,0.05)] overflow-hidden transition-all">
              <button onClick={() => setIsFilterOpen(!isFilterOpen)} className="w-full px-4 py-3 flex items-center gap-2 bg-white hover:bg-gray-50 transition-colors text-sm text-gray-700 text-left">
                <Filter className="w-4 h-4" /> 検索・絞り込み
                {activeFilterCount > 0 && <span className="ml-2 text-blue-600 font-bold">({activeFilterCount})</span>}
              </button>
              
              {isFilterOpen && (
                <div className="p-4 border-t border-gray-200 bg-white">
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4 text-sm">
                    <div><label className="block text-left text-gray-600 mb-1">受注番号</label><input type="text" value={filters.order_number} onChange={(e) => setFilters({...filters, order_number: e.target.value})} className="w-full border border-gray-300 px-3 py-1.5 outline-none rounded-[4px]" /></div>
                    <div><label className="block text-left text-gray-600 mb-1">顧客名/番号</label><input type="text" value={filters.customer_number} onChange={(e) => setFilters({...filters, customer_number: e.target.value})} className="w-full border border-gray-300 px-3 py-1.5 outline-none rounded-[4px]" /></div>
                    <div><label className="block text-left text-gray-600 mb-1">店舗番号</label><input type="text" placeholder="例: 12" value={filters.shop_number} onChange={(e) => setFilters({...filters, shop_number: e.target.value})} className="w-full border border-gray-300 px-3 py-1.5 outline-none rounded-[4px]" /></div>
                    <div>
                      <label className="block text-left text-gray-600 mb-1">ステータス</label>
                      <select value={filters.status} onChange={(e) => setFilters({...filters, status: e.target.value})} className="w-full border border-gray-300 px-3 py-1.5 outline-none bg-white rounded-[4px]">
                        <option value="">すべて</option>
                        {STATUS_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <div className="w-1/2"><label className="block text-left text-gray-600 mb-1">From</label><input type="date" value={filters.date_start} onChange={(e) => setFilters({...filters, date_start: e.target.value})} className="w-full border border-gray-300 px-2 py-1.5 outline-none rounded-[4px]" /></div>
                      <div className="w-1/2"><label className="block text-left text-gray-600 mb-1">To</label><input type="date" value={filters.date_end} onChange={(e) => setFilters({...filters, date_end: e.target.value})} className="w-full border border-gray-300 px-2 py-1.5 outline-none rounded-[4px]" /></div>
                    </div>
                  </div>
                  <div className="flex gap-2 justify-start pt-3 border-t border-gray-100">
                    <button onClick={handleFilter} className="px-4 py-1.5 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-[4px] flex items-center gap-1"><Search className="w-4 h-4"/>検索する</button>
                    <button onClick={handleClearFilters} className="px-4 py-1.5 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-[4px]">クリア</button>
                  </div>
                </div>
              )}
            </div>

            <div className={`p-3 border rounded-[4px] mb-4 flex items-center gap-4 transition-all duration-200 ${selectedIds.length > 0 ? 'bg-blue-50 border-blue-200 opacity-100 shadow-[0_0_20px_rgba(0,0,0,0.05)]' : 'opacity-0 h-0 p-0 mb-0 overflow-hidden border-transparent'}`}>
              <span className="text-sm font-bold text-blue-800">{selectedIds.length}件選択中</span>
              <button onClick={handleBulkConfirm} disabled={isProcessing} className="px-4 py-1.5 bg-blue-600 text-white text-sm font-bold rounded-[4px] hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
                {isProcessing && <Loader2 className="w-4 h-4 animate-spin" />}
                選択項目を「報酬確定」にする
              </button>
            </div>

            <div className="bg-white border border-gray-200 rounded-[4px] overflow-x-auto shadow-[0_0_20px_rgba(0,0,0,0.05)]">
              <table className="w-full text-left border-collapse whitespace-nowrap">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 text-xs">
                    <th className="p-3 w-10 text-left font-bold"><input type="checkbox" checked={isAllSelected} onChange={handleToggleAll} disabled={filteredReferrals.filter(r => r.status === 'pending').length === 0} /></th>
                    <th className="p-3 text-left font-bold">受注番号</th>
                    <th className="p-3 text-left font-bold">ステータス</th>
                    <th className="p-3 text-left font-bold">店舗番号・名前</th>
                    <th className="p-3 text-left font-bold">担当スタッフ</th>
                    <th className="p-3 text-left font-bold">日時</th>
                    <th className="p-3 text-left font-bold">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 text-sm text-gray-900">
                  {filteredReferrals.map(ref => {
                    const shop = getShopByShopId(ref.shop_id);
                    const staff = staffs.find(s => s.id === ref.staff_id);
                    const status = STATUS_OPTIONS.find(s => s.value === ref.status) || STATUS_OPTIONS[0];
                    const isDead = ref.status === 'cancel' || ref.status === 'issued';

                    return (
                      <tr key={ref.id} className={`transition-colors ${isDead ? 'bg-gray-50/80 opacity-70' : 'hover:bg-gray-50'}`}>
                        <td className="p-3 text-left"><input type="checkbox" disabled={ref.status !== 'pending'} checked={selectedIds.includes(ref.id)} onChange={() => handleToggleSelect(ref.id)} /></td>
                        <td className="p-3 text-left font-normal tabular-nums">{ref.order_number}</td>
                        <td className="p-3 text-left font-normal">
                          <span className={`px-2 py-0.5 rounded-[4px] text-xs border ${status.bgColor} ${status.color} ${status.border} inline-block min-w-[70px] text-center`}>
                            {status.label}
                          </span>
                        </td>
                        <td className="p-3 text-left font-normal">
                          {shop?.shop_number ? `No.${shop.shop_number} ` : ''} {shop?.name || '不明'}
                        </td>
                        <td className="p-3 text-left font-normal text-gray-600">{staff?.name || '不明'}</td>
                        <td className="p-3 text-left font-normal tabular-nums text-gray-600">{new Date(ref.created_at).toLocaleString('ja-JP')}</td>
                        <td className="p-3 text-left font-normal">
                          <button onClick={() => { setEditingRef(ref); setIsRefModalOpen(true); }} className={`text-sm ${isDead ? 'text-gray-500 underline' : 'text-blue-600 hover:underline'}`}>
                            {isDead ? '詳細を見る' : '詳細・編集'}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {filteredReferrals.length === 0 && <div className="p-8 text-center text-gray-400 text-sm">データがありません</div>}
            </div>
          </div>
        )}

        {/* =========================================
            タブ: Payments (支払管理)
        ========================================= */}
        {activeTab === 'payments' && (
          <div>
            <div className="flex justify-end mb-4">
              <button onClick={exportPaymentsCSV} className="flex items-center gap-2 bg-gray-800 text-white px-4 py-2 text-sm font-bold rounded-[4px] hover:bg-gray-700 transition">
                <Download className="w-4 h-4" /> CSVで明細をダウンロード
              </button>
            </div>
            <div className="bg-white border border-gray-200 rounded-[4px] overflow-x-auto shadow-[0_0_20px_rgba(0,0,0,0.05)]">
              <table className="w-full text-left border-collapse whitespace-nowrap text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 text-xs">
                    <th className="p-3 text-left font-bold">店舗番号</th>
                    <th className="p-3 text-left font-bold">店舗名</th>
                    <th className="p-3 text-left font-bold text-right">紹介件数</th>
                    <th className="p-3 text-left font-bold text-right">累計報酬額</th>
                    <th className="p-3 text-left font-bold text-right">未払い額</th>
                    <th className="p-3 text-left font-bold text-right">支払い済額</th>
                    <th className="p-3 text-left font-bold text-center">ステータス</th>
                    <th className="p-3 text-left font-bold text-center">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 text-gray-900">
                  {shops.map(shop => {
                    const validTxs = pointTransactions.filter(tx => tx.shop_id === shop.id && referrals.find(r => r.id === tx.referral_id)?.status !== 'cancel');
                    if (validTxs.length === 0) return null;

                    const uniqueReferralCount = new Set(validTxs.map(tx => tx.referral_id)).size;
                    const unpaidTotal = validTxs.filter(tx => tx.status === 'confirmed').reduce((sum, tx) => sum + (Number(tx.points) || 0), 0);
                    const paidTotal = validTxs.filter(tx => tx.status === 'paid').reduce((sum, tx) => sum + (Number(tx.points) || 0), 0);
                    const isAllPaid = unpaidTotal === 0;

                    return (
                      <tr key={shop.id} className={`transition-colors ${isAllPaid ? 'bg-gray-50/80 opacity-70' : 'hover:bg-gray-50'}`}>
                        <td className="p-3 text-left font-normal tabular-nums">{shop.shop_number}</td>
                        <td className="p-3 text-left font-normal">{shop.name}</td>
                        <td className="p-3 text-left font-normal tabular-nums text-right">{uniqueReferralCount}</td>
                        <td className="p-3 text-left font-normal tabular-nums text-right">{unpaidTotal + paidTotal}</td>
                        <td className="p-3 text-left font-normal text-red-600 tabular-nums font-bold text-right">{unpaidTotal}</td>
                        <td className="p-3 text-left font-normal tabular-nums text-gray-600 text-right">{paidTotal}</td>
                        <td className="p-3 text-left font-normal text-center">
                          <span className={`px-2 py-0.5 rounded-[4px] text-xs border ${isAllPaid ? 'bg-gray-100 text-gray-600 border-gray-200' : 'bg-red-50 text-red-700 border-red-200'} inline-block min-w-[70px] text-center`}>
                            {isAllPaid ? '精算済' : '未払いあり'}
                          </span>
                        </td>
                        <td className="p-3 text-left font-normal text-center">
                          {!isAllPaid && <button onClick={() => handlePaymentComplete(shop.id)} className="text-blue-600 hover:underline">支払完了にする</button>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* =========================================
            タブ: Shops (店舗管理)
        ========================================= */}
        {activeTab === 'shops' && (
          <div className="bg-white border border-gray-200 rounded-[4px] overflow-x-auto shadow-[0_0_20px_rgba(0,0,0,0.05)]">
            <table className="w-full text-left border-collapse whitespace-nowrap text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 text-xs">
                  <th className="p-3 text-left font-bold">店舗番号</th>
                  <th className="p-3 text-left font-bold">店舗名</th>
                  <th className="p-3 text-left font-bold">オーナー名</th>
                  <th className="p-3 text-left font-bold">オーナーEmail</th>
                  <th className="p-3 text-left font-bold">電話番号</th>
                  <th className="p-3 text-left font-bold">設定カテゴリ</th>
                  <th className="p-3 text-left font-bold">登録日</th>
                  <th className="p-3 text-left font-bold">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-gray-900">
                {shops.map(shop => {
                  const ownerName = getShopOwnerName(shop.id);
                  const category = categories.find(r => r.id === shop.category_id);
                  return (
                    <tr key={shop.id} className="hover:bg-gray-50">
                      <td className="p-3 text-left font-normal text-blue-600 hover:underline cursor-pointer tabular-nums" onClick={() => openShopEditModal(shop.id)}>{shop.shop_number}</td>
                      <td className="p-3 text-left font-normal text-blue-600 hover:underline cursor-pointer" onClick={() => openShopEditModal(shop.id)}>{shop.name}</td>
                      <td className="p-3 text-left font-normal">{ownerName}</td>
                      <td className="p-3 text-left font-normal text-gray-600">{shop.owner_email}</td>
                      <td className="p-3 text-left font-normal tabular-nums">{shop.phone || '-'}</td>
                      <td className="p-3 text-left font-normal">{category?.label || '未設定'}</td>
                      <td className="p-3 text-left font-normal tabular-nums text-gray-600">{new Date(shop.created_at).toLocaleDateString('ja-JP')}</td>
                      <td className="p-3 text-left font-normal">
                        <button onClick={() => openShopEditModal(shop.id)} className="text-blue-600 hover:underline">編集</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* =========================================
            タブ: Settings (マスタ設定)
        ========================================= */}
        {activeTab === 'settings' && (
          <div className="bg-white border border-gray-200 rounded-[4px] p-6 shadow-[0_0_20px_rgba(0,0,0,0.05)] w-full overflow-x-auto">
            <div className="flex justify-between items-end mb-4">
              <div>
                <h3 className="text-sm font-bold text-gray-900 mb-1">カテゴリ別ポイント設定</h3>
                <p className="text-xs text-gray-500">店舗の属性（カテゴリ）ごとに、通常報酬と各種ボーナスを設定します。</p>
              </div>
            </div>
            
            <table className="w-full min-w-[800px] text-left border-collapse border border-gray-200 mb-4 text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 text-xs">
                  <th className="p-3 text-left font-bold min-w-[150px]">カテゴリ名</th>
                  <th className="p-3 text-left font-bold w-32">通常報酬</th>
                  <th className="p-3 text-left font-bold min-w-[200px]">初回ボーナス設定</th>
                  <th className="p-3 text-left font-bold min-w-[200px]">登録ボーナス設定</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {editingCategories.map(cat => (
                  <tr key={cat.id} className="hover:bg-gray-50">
                    <td className="p-3 text-left">
                      <input type="text" value={cat.label} onChange={(e) => handleCategoryChange(cat.id, 'label', e.target.value)} className="w-full border border-gray-300 rounded-[4px] px-2 py-1.5 outline-none focus:border-blue-500" placeholder="カテゴリ名" />
                    </td>
                    <td className="p-3 text-left">
                      <div className="flex items-center gap-1">
                        <input type="number" value={cat.reward_points} onChange={(e) => handleCategoryChange(cat.id, 'reward_points', Number(e.target.value))} className="w-full border border-gray-300 rounded-[4px] px-2 py-1.5 outline-none tabular-nums text-right focus:border-blue-500" />
                        <span className="text-xs text-gray-500">pt</span>
                      </div>
                    </td>
                    <td className="p-3 text-left bg-blue-50/10">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => handleCategoryChange(cat.id, 'first_bonus_enabled', !cat.first_bonus_enabled)}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${cat.first_bonus_enabled ? 'bg-blue-600' : 'bg-gray-200'}`}
                        >
                          <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${cat.first_bonus_enabled ? 'translate-x-4' : 'translate-x-0'}`} />
                        </button>
                        <div className="flex items-center gap-1 flex-1">
                          <input type="number" disabled={!cat.first_bonus_enabled} value={cat.first_bonus_points || 0} onChange={(e) => handleCategoryChange(cat.id, 'first_bonus_points', Number(e.target.value))} className="w-full border border-gray-300 rounded-[4px] px-2 py-1.5 outline-none tabular-nums text-right disabled:bg-gray-100 disabled:text-gray-400 focus:border-blue-500" />
                          <span className="text-xs text-gray-500">pt</span>
                        </div>
                      </div>
                    </td>
                    <td className="p-3 text-left bg-emerald-50/10">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => handleCategoryChange(cat.id, 'signup_bonus_enabled', !cat.signup_bonus_enabled)}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${cat.signup_bonus_enabled ? 'bg-emerald-600' : 'bg-gray-200'}`}
                        >
                          <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${cat.signup_bonus_enabled ? 'translate-x-4' : 'translate-x-0'}`} />
                        </button>
                        <div className="flex items-center gap-1 flex-1">
                          <input type="number" disabled={!cat.signup_bonus_enabled} value={cat.signup_bonus_points || 0} onChange={(e) => handleCategoryChange(cat.id, 'signup_bonus_points', Number(e.target.value))} className="w-full border border-gray-300 rounded-[4px] px-2 py-1.5 outline-none tabular-nums text-right disabled:bg-gray-100 disabled:text-gray-400 focus:border-emerald-500" />
                          <span className="text-xs text-gray-500">pt</span>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-between items-center pt-2">
              <button onClick={handleAddCategory} className="flex items-center gap-1 text-sm text-blue-600 hover:underline"><Plus className="w-4 h-4"/>新しいカテゴリを追加</button>
              <button onClick={handleSaveAllSettings} className="bg-blue-600 text-white text-sm px-8 py-2.5 rounded-[4px] hover:bg-blue-700 transition-colors flex items-center gap-2">
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
        <div className="fixed inset-0 bg-gray-900/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[4px] p-6 w-full max-w-lg border border-gray-200 shadow-[0_0_20px_rgba(0,0,0,0.1)]">
            <div className="flex justify-between items-center mb-4 border-b border-gray-200 pb-2">
              <h3 className="text-base font-bold text-gray-900">詳細情報・ステータス更新</h3>
              <button onClick={() => setIsRefModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="bg-gray-50 border border-gray-200 p-4 rounded-[4px] text-sm mb-6 space-y-2 text-gray-700">
              <div className="grid grid-cols-3 gap-2"><div className="text-gray-500 font-bold">受注番号</div><div className="col-span-2 tabular-nums">{editingRef.order_number}</div></div>
              <div className="grid grid-cols-3 gap-2"><div className="text-gray-500 font-bold">顧客名</div><div className="col-span-2 tabular-nums">{editingRef.customer_name || '未取得'}</div></div>
              <div className="grid grid-cols-3 gap-2"><div className="text-gray-500 font-bold">店舗</div><div className="col-span-2">No.{editingShopData?.shop_number} {editingShopData?.name || '不明'}</div></div>
              <div className="grid grid-cols-3 gap-2"><div className="text-gray-500 font-bold">担当スタッフ</div><div className="col-span-2">{staffs.find(s => s.id === editingRef.staff_id)?.name || '不明'}</div></div>
              <div className="grid grid-cols-3 gap-2"><div className="text-gray-500 font-bold">発生日時</div><div className="col-span-2 tabular-nums">{new Date(editingRef.created_at).toLocaleString('ja-JP')}</div></div>
              {editingConfirmedTx && (
                <div className="grid grid-cols-3 gap-2"><div className="text-gray-500 font-bold">確定日時</div><div className="col-span-2 tabular-nums">{new Date(editingConfirmedTx.created_at).toLocaleString('ja-JP')}</div></div>
              )}
            </div>

            {/* URL手動発行のアクションボタン */}
            {editingRef.status === 'confirmed' && (
              <div className="mb-6 bg-blue-50 border border-blue-100 rounded-[4px] p-3">
                <p className="text-xs text-blue-800 font-bold mb-2">サポート対応（手動URL発行）</p>
                <button 
                  onClick={() => {
                     const targetStaff = staffs.find(s => s.id === editingRef.staff_id)
                     if (targetStaff && targetStaff.secret_token) {
                       const url = `${window.location.origin}/m/${targetStaff.secret_token}`
                       navigator.clipboard.writeText(url)
                       alert(`該当スタッフのマイページURLをコピーしました。\n${url}\n\nこのURLをユーザーへ直接送信してください。`)
                     } else {
                       alert('スタッフのトークンが見つかりません。')
                     }
                  }}
                  className="px-3 py-1.5 bg-white border border-blue-200 text-blue-600 text-xs font-bold rounded shadow-sm hover:bg-blue-100 flex items-center gap-1.5"
                >
                  <LinkIcon className="w-3 h-3"/> スタッフのマイページURLをコピー
                </button>
              </div>
            )}

            <div className="space-y-4 mb-6">
              {isEditingLocked ? (
                <div className="bg-gray-100 border border-gray-300 rounded-[4px] p-3 text-sm text-gray-600 font-bold">
                  {originalRefForModal?.status === 'cancel' ? 'キャンセル済（変更不可）' : '発行済（変更不可）'}
                </div>
              ) : (
                <div>
                  <label className="block text-sm text-gray-700 mb-1 font-bold">ステータス更新</label>
                  <select value={editingRef.status} onChange={(e) => setEditingRef({...editingRef, status: e.target.value, cancel_reason: e.target.value !== 'cancel' ? '' : editingRef.cancel_reason})} className="w-full border border-gray-300 rounded-[4px] p-2 text-sm outline-none bg-white focus:border-blue-500">
                    {availableStatusOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                </div>
              )}

              {!isEditingLocked && editingRef.status === 'cancel' && (
                <div>
                  <label className="flex items-center gap-1 text-sm text-red-600 font-bold mb-1"><AlertTriangle className="w-4 h-4"/>キャンセル事由</label>
                  <select value={editingRef.cancel_reason || ''} onChange={(e) => setEditingRef({...editingRef, cancel_reason: e.target.value})} className="w-full border border-red-300 bg-red-50 p-2 text-sm text-red-800 outline-none rounded-[4px] focus:border-red-500">
                    <option value="">選択してください</option>
                    {CANCEL_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              )}
              
              {!isEditingLocked && originalRefForModal?.status === 'confirmed' && editingRef.status === 'cancel' && (
                <div className="bg-red-50 border border-red-200 p-3 mt-3 rounded-[4px]">
                  <p className="text-red-700 text-xs font-bold flex items-center gap-1"><AlertTriangle className="w-4 h-4"/>重大な警告</p>
                  <p className="text-red-600 text-xs mt-1">すでにユーザーへ付与済みのポイントを没収します。この操作は二度と元に戻せません。</p>
                </div>
              )}
            </div>

            <div className="flex gap-2 justify-end">
              <button onClick={() => setIsRefModalOpen(false)} className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-[4px] hover:bg-gray-50">キャンセル</button>
              {!isEditingLocked && (
                <button onClick={() => handleRefModalSave(editingRef)} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-[4px] hover:bg-blue-700">更新して保存</button>
              )}
            </div>
          </div>
        </div>
      )}

      {isShopModalOpen && editingShop && (
        <div className="fixed inset-0 bg-gray-900/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[4px] p-6 w-full max-w-md border border-gray-200 shadow-[0_0_20px_rgba(0,0,0,0.1)]">
            <h3 className="text-base font-bold text-gray-900 mb-4 border-b border-gray-200 pb-2">店舗情報の編集 (No. {editingShop.shop_number})</h3>
            <div className="space-y-4 mb-6 text-sm">
              <div><label className="block text-gray-700 font-bold mb-1">店舗名</label><input type="text" value={editingShop.name} onChange={(e) => setEditingShop({...editingShop, name: e.target.value})} className="w-full border border-gray-300 rounded-[4px] p-2 outline-none focus:border-blue-500" /></div>
              <div><label className="block text-gray-700 font-bold mb-1">電話番号</label><input type="tel" value={editingShop.phone || ''} onChange={(e) => setEditingShop({...editingShop, phone: e.target.value})} className="w-full border border-gray-300 rounded-[4px] p-2 outline-none focus:border-blue-500" /></div>
              <div>
                <label className="block text-gray-700 font-bold mb-1">設定カテゴリ</label>
                <select value={editingShop.category_id || ''} onChange={(e) => setEditingShop({...editingShop, category_id: e.target.value})} className="w-full border border-gray-300 rounded-[4px] p-2 outline-none bg-white focus:border-blue-500">
                  <option value="">未設定</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2 justify-end text-sm">
              <button onClick={() => setIsShopModalOpen(false)} className="px-4 py-2 border border-gray-300 rounded-[4px] text-gray-700 hover:bg-gray-50">キャンセル</button>
              <button onClick={() => handleShopModalSave(editingShop)} className="px-4 py-2 bg-blue-600 text-white rounded-[4px] hover:bg-blue-700">保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}