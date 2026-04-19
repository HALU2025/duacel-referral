'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { 
  RefreshCw, Loader2, Search, Filter, AlertTriangle, X, Plus, Download, Link as LinkIcon,
  BarChart3, Users, Store, Gift, Settings, ChevronRight, ChevronDown,
  Building, User, Info, LogOut, Shield, Edit2, CheckCircle2, Copy 
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { createAdminUserAction } from '@/app/actions/admin'
import { clearAdminSessionCookie } from '@/app/actions/admin-auth'

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

// ダッシュボード(home)を廃止し、アイコンを統一
const PAGE_TITLES: Record<string, { label: string, icon: any }> = {
  referrals: { label: '成果一覧', icon: <BarChart3 className="w-5 h-5" /> },
  redemptions: { label: 'ポイント交換管理', icon: <Gift className="w-5 h-5" /> },
  users: { label: 'ユーザー・店舗管理', icon: <Users className="w-5 h-5" /> },
  settings: { label: 'ポイント設定', icon: <Settings className="w-5 h-5" /> },
  admins: { label: '管理者設定', icon: <Shield className="w-5 h-5" /> }
}

export default function AdminDashboard() {
  const router = useRouter()

  // ==========================================
  // 2. ステート管理
  // ==========================================
  const [activeTab, setActiveTab] = useState<'referrals' | 'redemptions' | 'users' | 'settings' | 'admins'>('referrals')
  
  const [referrals, setReferrals] = useState<any[]>([])
  const [redemptions, setRedemptions] = useState<any[]>([])
  const [shops, setShops] = useState<any[]>([])
  const [staffs, setStaffs] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [pointTransactions, setPointTransactions] = useState<any[]>([])
  const [systemAdmins, setSystemAdmins] = useState<any[]>([]) 
  
  const [loading, setLoading] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  const [authError, setAuthError] = useState('')
  const [currentUserId, setCurrentUserId] = useState('')

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

  // 編集モードのトグル用ステート
  const [isEditingSettings, setIsEditingSettings] = useState(false)
  const [showAddAdminForm, setShowAddAdminForm] = useState(false)
  const [showPasswordForm, setShowPasswordForm] = useState(false)

  // 管理者設定用ステート
  const [newAdminEmail, setNewAdminEmail] = useState('')
  const [newAdminPassword, setNewAdminPassword] = useState('')
  const [isAddingAdmin, setIsAddingAdmin] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false)

  // ==========================================
  // 3. データ取得・認証
  // ==========================================
  const fetchData = async () => {
    setLoading(true)
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace('/admin-login'); return; }

    const { data: adminData } = await supabase.from('system_admins').select('id').eq('id', user.id).maybeSingle()
    if (!adminData) {
      await supabase.auth.signOut()
      router.replace('/admin-login')
      return
    }

    setCurrentUserId(user.id)

    const [r, s, st, cat, tx, ex, sys] = await Promise.all([
      supabase.from('referrals').select('*').order('created_at', { ascending: false }).limit(2000),
      supabase.from('shops').select('*').order('created_at', { ascending: false }),
      supabase.from('staffs').select('*').order('created_at', { ascending: true }),
      supabase.from('shop_categories').select('*').order('reward_points', { ascending: true }),
      supabase.from('point_transactions').select('*').order('created_at', { ascending: true }),
      supabase.from('reward_exchanges').select('*').order('created_at', { ascending: false }),
      supabase.from('system_admins').select('*').order('created_at', { ascending: true }) 
    ])
    
    if (r.data) { setReferrals(r.data); setFilteredReferrals(r.data); }
    if (s.data) setShops(s.data)
    if (st.data) setStaffs(st.data)
    if (cat.data) { 
      setCategories(cat.data); 
      setEditingCategories(cat.data);
    }
    if (tx.data) setPointTransactions(tx.data)
    if (ex.data) setRedemptions(ex.data)
    if (sys.data) setSystemAdmins(sys.data)
    
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  const handleLogout = async () => {
    if (!confirm('ログアウトしますか？')) return
    await supabase.auth.signOut()
    await clearAdminSessionCookie()
    router.replace('/admin-login')
  }

  // ==========================================
  // ヘルパー関数
  // ==========================================
  const getShopByShopId = (shopId: string) => shops.find(s => s.id === shopId)

  const getReferralPoints = (ref: any) => {
    const shop = getShopByShopId(ref.shop_id);
    const refTxs = pointTransactions.filter(tx => tx.referral_id === ref.id);
    const isOldest = referrals.filter(r => r.shop_id === ref.shop_id && r.status !== 'cancel').sort((a,b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0]?.id === ref.id;
    const isFirstTime = ref.status !== 'cancel' && (refTxs.length > 0 ? refTxs.some(tx => tx.metadata?.is_bonus) : isOldest);
    const category = categories.find(r => r.id === shop?.category_id);
    const standardPt = Number(category?.reward_points) || 0;
    const bonusPt = (isFirstTime && category?.first_bonus_enabled) ? Number(category.first_bonus_points) : 0;
    return ref.status === 'cancel' ? 0 : (refTxs.length > 0 ? refTxs.reduce((sum: number, tx: any) => sum + Number(tx.points), 0) : standardPt + bonusPt);
  }

  // ==========================================
  // アクションハンドラー
  // ==========================================
  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newAdminPassword.length < 6) { alert('パスワードは6文字以上にしてください。'); return; }
    
    setIsAddingAdmin(true)
    const res = await createAdminUserAction(newAdminEmail, newAdminPassword)
    setIsAddingAdmin(false)

    if (res.success) {
      alert('管理者を登録しました。')
      setNewAdminEmail('')
      setNewAdminPassword('')
      setShowAddAdminForm(false)
      fetchData()
    } else {
      alert('登録エラー: ' + res.error)
    }
  }

  const handleDeleteAdmin = async (id: string, email: string) => {
    if (id === currentUserId) { alert('自分自身は削除できません。'); return; }
    if (!confirm(`【警告】\n${email} の管理者権限を削除しますか？\n二度とログインできなくなります。`)) return;
    
    setIsProcessing(true)
    const { error } = await supabase.from('system_admins').delete().eq('id', id)
    setIsProcessing(false)
    
    if (error) alert('削除エラー: ' + error.message)
    else fetchData()
  }

  const handleUpdatePassword = async () => {
    if (newPassword.length < 6) { alert('パスワードは6文字以上にしてください。'); return; }
    setIsUpdatingPassword(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setIsUpdatingPassword(false)
    
    if (error) alert('パスワードの変更に失敗しました: ' + error.message)
    else { 
      alert('自分のパスワードを変更しました。次回から新しいパスワードでログインしてください。'); 
      setNewPassword(''); 
      setShowPasswordForm(false);
    }
  }

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
    
    if (originalRef?.status === 'cancel') { alert('キャンセル済みのデータは変更できません。'); return; }
    if (originalRef?.status === 'issued') { alert('分配済のデータは変更できません。'); return; }
    if (originalRef?.status === 'confirmed' && updatedRef.status === 'pending') { alert('確定済みのデータを仮計上に戻すことはできません。'); return; }
    if (updatedRef.status === 'cancel' && !updatedRef.cancel_reason) { alert('キャンセル事由を選択してください。'); return; }

    if (updatedRef.status === 'cancel' && originalRef?.status !== 'cancel') {
      const msg = originalRef?.status === 'confirmed'
        ? "【⚠️ 重大警告】\nこのデータはすでに「報酬確定」されています。\nキャンセルを実行すると、ユーザーへ付与済みのポイントが没収（マイナス処理）されます。\n\n本当にキャンセルしてよろしいですか？"
        : "【⚠️ 警告】\nこのデータをキャンセル（無効化）します。\n一度キャンセルすると、今後一切ステータスを戻すことはできません。\n\n本当にキャンセルしてよろしいですか？";
      if (!confirm(msg)) return;
    }

    setIsProcessing(true)

    // ステータス更新
    await supabase.from('referrals').update({ 
      status: updatedRef.status,
      cancel_reason: updatedRef.status === 'cancel' ? updatedRef.cancel_reason : null,
    }).eq('id', updatedRef.id)

    // 手動でポイント数が変更された場合（編集モードでの更新）
    // （※本来はトランザクションテーブルのポイントを更新しますが、要望に基づき簡易的に対応）
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
  
  const handleCancelSettings = () => {
    if (!confirm('編集内容を破棄してよろしいですか？')) return;
    setEditingCategories([...categories]);
    setIsEditingSettings(false); 
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
    setIsEditingSettings(false)
    alert('設定を保存しました。')
  }

  if (authError) return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-red-600 text-sm font-bold">{authError}</div>
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-900 text-sm"><Loader2 className="w-6 h-6 animate-spin"/></div>

  const activeFilterCountVal = Object.values(refFilters).filter(val => val !== '').length
  const totalFilteredPoints = filteredReferrals.reduce((sum, r) => sum + getReferralPoints(r), 0)

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans flex flex-col md:flex-row">
      
      {/* =========================================
          サイドナビゲーション
      ========================================= */}
      <aside className="w-full md:w-64 bg-white border-r border-gray-200 shadow-sm md:min-h-screen flex flex-col shrink-0">
        <div className="px-6 py-4 flex items-center gap-3 border-b border-gray-200">
          <img src="/logo-duacel.svg" alt="Duacel" className="h-6 w-auto" onError={(e) => e.currentTarget.style.display = 'none'} />
          <span className="text-base font-bold tracking-wider text-gray-900">Duacel Pro</span>
        </div>
        
        <nav className="flex md:flex-col gap-1 p-4 overflow-x-auto md:overflow-x-visible">
          {Object.entries(PAGE_TITLES).map(([id, item]) => (
            <button 
              key={id} 
              onClick={() => setActiveTab(id as any)} 
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${activeTab === id ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}
            >
              {item.icon} {item.label}
            </button>
          ))}
        </nav>
        
        <div className="mt-auto p-4 border-t border-gray-200 flex flex-col gap-2">
          <button onClick={fetchData} className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-lg transition-colors">
            <RefreshCw className="w-4 h-4" /> 再読み込み
          </button>
          <button onClick={handleLogout} className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-500 font-bold hover:bg-red-50 rounded-lg transition-colors">
            <LogOut className="w-4 h-4" /> ログアウト
          </button>
        </div>
      </aside>

      {/* =========================================
          メインコンテンツ
      ========================================= */}
      <div className="flex-1 p-4 md:p-8 overflow-x-auto w-full">
        
        <div className="mb-6 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <span className="text-gray-900 p-2 bg-white border border-gray-200 rounded-lg shadow-sm">
              {PAGE_TITLES[activeTab].icon}
            </span>
            <h1 className="text-xl font-black text-gray-900 tracking-tight">{PAGE_TITLES[activeTab].label}</h1>
          </div>
          {isProcessing && <span className="flex items-center gap-2 text-sm text-blue-600 font-bold bg-blue-50 px-3 py-1 rounded-full"><Loader2 className="w-4 h-4 animate-spin"/> 処理中...</span>}
        </div>

        {/* 成果一覧 (UI/レイアウト改修) */}
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

            {/* 一覧上部のサマリーエリア */}
            <div className="flex justify-between items-center mb-2 px-1">
              <div className="text-sm font-bold text-black">検索結果 {filteredReferrals.length} 件該当しました</div>
              <div className="text-sm font-bold text-black">総獲得ポイント {totalFilteredPoints.toLocaleString()} pt</div>
            </div>
            <hr className="mb-4 border-gray-300" />

            {/* テーブル */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto shadow-sm">
              <table className="w-full text-left border-collapse whitespace-nowrap">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-black text-sm tracking-wider">
                    <th className="p-4 font-bold whitespace-nowrap">発生日時</th>
                    <th className="p-4 font-bold whitespace-nowrap">受注番号</th>
                    <th className="p-4 font-bold whitespace-nowrap">ステータス</th>
                    <th className="p-4 font-bold whitespace-nowrap">店舗名</th>
                    <th className="p-4 font-bold whitespace-nowrap">店舗コード</th>
                    <th className="p-4 font-bold whitespace-nowrap">担当スタッフ・顧客情報</th>
                    <th className="p-4 font-bold whitespace-nowrap">獲得Pt</th>
                    <th className="p-4 font-bold whitespace-nowrap text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm text-black font-medium">
                  {filteredReferrals.map(ref => {
                    const shop = getShopByShopId(ref.shop_id);
                    const staff = staffs.find(s => s.id === ref.staff_id);
                    const status = REF_STATUS_OPTIONS.find(s => s.value === ref.status) || REF_STATUS_OPTIONS[0];
                    const isDead = ref.status === 'cancel' || ref.status === 'issued';
                    
                    const totalPt = getReferralPoints(ref);

                    return (
                      <tr key={ref.id} className={`transition-colors ${isDead ? 'bg-gray-50/50 opacity-75' : 'hover:bg-blue-50/30'}`}>
                        <td className="p-4 whitespace-nowrap text-black">{new Date(ref.created_at).toLocaleString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                        <td className="p-4 whitespace-nowrap text-black">{ref.order_number}</td>
                        <td className="p-4 whitespace-nowrap">
                          <span className={`px-2.5 py-1 rounded-md text-sm border ${status.bgColor} ${status.color} ${status.border} font-bold inline-flex items-center justify-center min-w-[70px]`}>
                            {status.label}
                          </span>
                        </td>
                        <td className="p-4 whitespace-nowrap text-black">{shop?.name || '不明'}</td>
                        <td className="p-4 whitespace-nowrap text-black">{shop?.shop_number || '-'}</td>
                        <td className="p-4 whitespace-nowrap text-black">
                          {staff?.name || '不明'} {ref.customer_name ? `/ ${ref.customer_name} 様 (${ref.recurring_count > 1 ? `定期${ref.recurring_count}回目` : '初回'})` : ''}
                        </td>
                        <td className="p-4 whitespace-nowrap text-black font-bold">{totalPt.toLocaleString()}</td>
                        <td className="p-4 text-right whitespace-nowrap">
                          <button onClick={() => { setEditingRef({...ref, total_points: totalPt}); setIsRefModalOpen(true); }} className="text-blue-600 hover:text-blue-800 font-bold text-sm bg-blue-50 px-3 py-1.5 rounded-lg transition-colors">
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

        {/* Redemptions */}
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

        {/* Users */}
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

        {/* Settings */}
        {activeTab === 'settings' && (
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm w-full overflow-x-auto relative">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-base font-black text-gray-900 mb-1">カテゴリ別ポイント設定</h3>
                <p className="text-xs text-gray-500 font-medium">店舗の属性ごとに、通常報酬・初回・定期継続ボーナスを設定します。</p>
              </div>
              {!isEditingSettings && (
                <button onClick={() => setIsEditingSettings(true)} className="flex items-center gap-2 bg-blue-50 text-blue-700 hover:bg-blue-100 px-4 py-2 rounded-lg text-sm font-bold transition-colors">
                  <Edit2 className="w-4 h-4"/> 編集する
                </button>
              )}
            </div>

            {!isEditingSettings ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {categories.map(cat => (
                  <div key={cat.id} className="border border-gray-200 rounded-xl p-5 bg-gray-50/50 flex flex-col gap-4">
                    <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                      <span className="font-black text-gray-900 text-lg">{cat.label}</span>
                      <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded font-bold">基本 {cat.reward_points} pt</span>
                    </div>
                    <div className="space-y-2 text-sm font-medium text-gray-600">
                      <div className="flex justify-between items-center">
                        <span>初回ボーナス</span>
                        {cat.first_bonus_enabled ? <span className="font-mono font-bold text-gray-900">+{cat.first_bonus_points} pt</span> : <span className="text-gray-400">-</span>}
                      </div>
                      <div className="flex justify-between items-center">
                        <span>定期ボーナス</span>
                        {cat.recurring_bonus_enabled ? <span className="font-mono font-bold text-gray-900">+{cat.recurring_bonus_points} pt</span> : <span className="text-gray-400">-</span>}
                      </div>
                      <div className="flex justify-between items-center">
                        <span>登録ボーナス</span>
                        {cat.signup_bonus_enabled ? <span className="font-mono font-bold text-gray-900">+{cat.signup_bonus_points} pt</span> : <span className="text-gray-400">-</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                {editingCategories.map(cat => (
                  <div key={cat.id} className="border-2 border-blue-100 rounded-xl p-4 bg-white shadow-sm">
                    <div className="mb-4 pb-4 border-b border-gray-100 flex items-center gap-4">
                      <input type="text" value={cat.label} onChange={(e) => handleCategoryChange(cat.id, 'label', e.target.value)} className="w-1/3 border border-gray-300 rounded-lg px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent" placeholder="カテゴリ名" />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-2">通常報酬（ベース）</label>
                        <div className="flex items-center gap-2">
                          <input type="number" value={cat.reward_points} onChange={(e) => handleCategoryChange(cat.id, 'reward_points', Number(e.target.value))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none tabular-nums font-mono focus:ring-2 focus:ring-blue-400 focus:border-transparent" />
                          <span className="text-xs text-gray-500 font-bold">pt</span>
                        </div>
                      </div>
                      
                      <div>
                        <label className="flex items-center gap-2 text-xs font-bold text-gray-700 mb-2">
                          <input type="checkbox" checked={cat.first_bonus_enabled} onChange={(e) => handleCategoryChange(cat.id, 'first_bonus_enabled', e.target.checked)} className="w-3.5 h-3.5" />
                          初回ボーナス
                        </label>
                        <div className="flex items-center gap-2">
                          <input type="number" disabled={!cat.first_bonus_enabled} value={cat.first_bonus_points || 0} onChange={(e) => handleCategoryChange(cat.id, 'first_bonus_points', Number(e.target.value))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none tabular-nums font-mono disabled:bg-gray-100 disabled:text-gray-400 focus:ring-2 focus:ring-blue-400 focus:border-transparent" />
                          <span className="text-xs text-gray-500 font-bold">pt</span>
                        </div>
                      </div>

                      <div>
                        <label className="flex items-center gap-2 text-xs font-bold text-gray-700 mb-2">
                          <input type="checkbox" checked={cat.recurring_bonus_enabled} onChange={(e) => handleCategoryChange(cat.id, 'recurring_bonus_enabled', e.target.checked)} className="w-3.5 h-3.5" />
                          定期ボーナス (2回目以降)
                        </label>
                        <div className="flex items-center gap-2">
                          <input type="number" disabled={!cat.recurring_bonus_enabled} value={cat.recurring_bonus_points || 0} onChange={(e) => handleCategoryChange(cat.id, 'recurring_bonus_points', Number(e.target.value))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none tabular-nums font-mono disabled:bg-gray-100 disabled:text-gray-400 focus:ring-2 focus:ring-blue-400 focus:border-transparent" />
                          <span className="text-xs text-gray-500 font-bold">pt</span>
                        </div>
                      </div>

                      <div>
                        <label className="flex items-center gap-2 text-xs font-bold text-gray-700 mb-2">
                          <input type="checkbox" checked={cat.signup_bonus_enabled} onChange={(e) => handleCategoryChange(cat.id, 'signup_bonus_enabled', e.target.checked)} className="w-3.5 h-3.5" />
                          登録ボーナス
                        </label>
                        <div className="flex items-center gap-2">
                          <input type="number" disabled={!cat.signup_bonus_enabled} value={cat.signup_bonus_points || 0} onChange={(e) => handleCategoryChange(cat.id, 'signup_bonus_points', Number(e.target.value))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none tabular-nums font-mono disabled:bg-gray-100 disabled:text-gray-400 focus:ring-2 focus:ring-blue-400 focus:border-transparent" />
                          <span className="text-xs text-gray-500 font-bold">pt</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                
                <div className="flex justify-between items-center mt-6 pt-6 border-t border-gray-200">
                  <button onClick={handleAddCategory} className="flex items-center gap-1 text-sm font-bold text-gray-600 hover:text-gray-900 bg-gray-100 px-4 py-2 rounded-lg transition-colors"><Plus className="w-4 h-4"/>カテゴリ追加</button>
                  <div className="flex items-center gap-3">
                    <button onClick={handleCancelSettings} className="px-6 py-3 rounded-lg text-sm font-bold text-gray-600 hover:bg-gray-100 transition-colors">キャンセル</button>
                    <button onClick={handleSaveAllSettings} disabled={isProcessing} className="bg-gray-900 text-white text-sm font-bold px-8 py-3 rounded-lg hover:bg-black transition-colors flex items-center gap-2 disabled:opacity-50">
                      {isProcessing ? <Loader2 className="w-4 h-4 animate-spin"/> : <CheckCircle2 className="w-4 h-4"/>} 保存して終了
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        )}

        {/* Admins */}
        {activeTab === 'admins' && (
          <div className="space-y-6">
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm w-full md:w-2/3">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-base font-black text-gray-900">システム管理者一覧</h3>
                <div className="flex gap-2">
                  <button onClick={() => setShowPasswordForm(!showPasswordForm)} className="text-xs font-bold bg-gray-100 text-gray-600 hover:bg-gray-200 px-3 py-2 rounded-lg transition-colors">
                    自分のパスワード変更
                  </button>
                  <button onClick={() => setShowAddAdminForm(!showAddAdminForm)} className="flex items-center gap-1 text-xs font-bold bg-gray-900 text-white hover:bg-black px-3 py-2 rounded-lg transition-colors">
                    <Plus className="w-3 h-3"/> 新規追加
                  </button>
                </div>
              </div>

              <AnimatePresence>
                {showPasswordForm && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mb-6">
                    <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                      <p className="text-sm font-bold mb-3 text-gray-700">新しいパスワード (6文字以上)</p>
                      <div className="flex gap-2">
                        <input type="password" required minLength={6} placeholder="••••••••" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="flex-1 border border-gray-300 rounded-lg p-2.5 text-sm font-mono outline-none focus:ring-2 focus:ring-blue-100" />
                        <button onClick={handleUpdatePassword} disabled={isUpdatingPassword || newPassword.length < 6} className="bg-blue-600 text-white font-bold text-sm px-4 rounded-lg hover:bg-blue-500 transition-colors disabled:opacity-50">
                          {isUpdatingPassword ? <Loader2 className="w-4 h-4 animate-spin"/> : '更新'}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {showAddAdminForm && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mb-6">
                    <form onSubmit={handleAddAdmin} className="p-4 bg-blue-50/50 border border-blue-100 rounded-lg space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">メールアドレス</label>
                        <input type="email" placeholder="admin@duacel.net" required value={newAdminEmail} onChange={e => setNewAdminEmail(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-100 bg-white" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">初期パスワード (6文字以上)</label>
                        <input type="text" placeholder="password123" required minLength={6} value={newAdminPassword} onChange={e => setNewAdminPassword(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2.5 text-sm font-mono outline-none focus:ring-2 focus:ring-blue-100 bg-white" />
                      </div>
                      <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => setShowAddAdminForm(false)} className="px-4 py-2 text-sm font-bold text-gray-600 hover:bg-blue-100 rounded-lg transition-colors">キャンセル</button>
                        <button type="submit" disabled={isAddingAdmin || !newAdminEmail || newAdminPassword.length < 6} className="bg-blue-600 text-white font-bold text-sm px-6 py-2 rounded-lg hover:bg-blue-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                          {isAddingAdmin ? <Loader2 className="w-4 h-4 animate-spin"/> : '登録する'}
                        </button>
                      </div>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="space-y-3">
                {systemAdmins.map(admin => (
                  <div key={admin.id} className="flex items-center justify-between p-3 border border-gray-100 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                    <div>
                      <p className="text-sm font-bold text-gray-900 flex items-center gap-2">
                        {admin.email}
                        {admin.id === currentUserId && <span className="bg-blue-100 text-blue-800 text-[10px] px-2 py-0.5 rounded uppercase tracking-wider font-bold">You</span>}
                      </p>
                      <p className="text-xs text-gray-500 font-mono mt-0.5">登録: {new Date(admin.created_at).toLocaleString('ja-JP')}</p>
                    </div>
                    {admin.id !== currentUserId && (
                      <button onClick={() => handleDeleteAdmin(admin.id, admin.email)} className="text-xs font-bold text-red-500 hover:bg-red-50 border border-transparent hover:border-red-100 px-3 py-1.5 rounded-lg transition-all">
                        削除
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>

      {/* =========================================
          モーダル類
      ========================================= */}
      {/* 詳細情報・成果編集モーダル */}
      {isRefModalOpen && editingRef && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl p-6 w-full max-w-xl shadow-2xl my-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-black text-gray-900">詳細情報・成果編集</h3>
              <button onClick={() => setIsRefModalOpen(false)} className="text-gray-400 hover:bg-gray-100 p-2 rounded-full transition-colors"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="bg-gray-50 border border-gray-200 p-5 rounded-xl text-sm mb-6 space-y-4 text-black font-medium">
              
              <div className="grid grid-cols-3 gap-3 items-center border-b border-gray-200 pb-2">
                <label className="text-gray-500 text-sm font-bold">発生日時</label>
                <div className="col-span-2 text-black text-sm font-mono">{new Date(editingRef.created_at).toLocaleString('ja-JP')}</div>
              </div>

              <div className="grid grid-cols-3 gap-3 items-center border-b border-gray-200 pb-2">
                <label className="text-gray-500 text-sm font-bold">受注番号</label>
                <div className="col-span-2 text-black text-sm font-mono">{editingRef.order_number || '-'}</div>
              </div>

              <div className="grid grid-cols-3 gap-3 items-center border-b border-gray-200 pb-2">
                <label className="text-gray-500 text-sm font-bold">顧客名 / 回数</label>
                <div className="col-span-2 text-black text-sm">
                  {editingRef.customer_name || '不明'} 
                  <span className="ml-2 px-2 py-0.5 bg-gray-200 rounded text-xs">{editingRef.recurring_count || 1}回目</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 items-center border-b border-gray-200 pb-2">
                <label className="text-gray-500 text-sm font-bold">店舗名 / コード</label>
                <div className="col-span-2 text-black text-sm">
                  {getShopByShopId(editingRef.shop_id)?.name || '不明'} 
                  <span className="ml-2 font-mono text-gray-400">No.{getShopByShopId(editingRef.shop_id)?.shop_number}</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 items-center border-b border-gray-200 pb-2">
                <label className="text-gray-500 text-sm font-bold">担当スタッフ</label>
                <div className="col-span-2 text-black text-sm">
                  {staffs.find(s => s.id === editingRef.staff_id)?.name || '不明'}
                </div>
              </div>

              {/* 紹介URL (読取専用) */}
              <div className="grid grid-cols-3 gap-3 items-start border-b border-gray-200 pb-2">
                <label className="text-gray-500 text-sm font-bold">紹介URL</label>
                <div className="col-span-2">
                  <div className="flex items-center gap-2 text-blue-600 text-xs break-all bg-white p-2 border border-gray-200 rounded">
                    <span>https://duacel.net/welcome/ref_{staffs.find(s => s.id === editingRef.staff_id)?.referral_code}</span>
                    <button onClick={() => {
                      navigator.clipboard.writeText(`https://duacel.net/welcome/ref_${staffs.find(s => s.id === editingRef.staff_id)?.referral_code}`);
                      alert('URLをコピーしました');
                    }} className="shrink-0 text-gray-400 hover:text-blue-600"><Copy className="w-3 h-3"/></button>
                  </div>
                </div>
              </div>

              {/* 編集可能: 獲得ポイント */}
              <div className="grid grid-cols-3 gap-3 items-center">
                <label className="text-black text-sm font-bold">獲得ポイント</label>
                <div className="col-span-2 flex items-center gap-2">
                  <input 
                    type="number"
                    className="border border-gray-300 p-2 rounded w-full text-black text-sm font-mono outline-none focus:ring-2 focus:ring-blue-100 bg-white" 
                    value={editingRef.total_points || 0} 
                    onChange={(e) => setEditingRef({...editingRef, total_points: Number(e.target.value)})} 
                  />
                  <span className="text-black text-sm">pt</span>
                </div>
              </div>

            </div>

            {/* 編集可能: ステータス更新 */}
            <div className="space-y-4 mb-8">
              {editingRef.status === 'cancel' || editingRef.status === 'issued' ? (
                <div className="bg-gray-100 border border-gray-300 rounded-xl p-4 text-sm text-gray-600 font-bold text-center">
                  {editingRef.status === 'cancel' ? 'キャンセル済（ステータス変更不可）' : '分配済（ステータス変更不可）'}
                </div>
              ) : (
                <div>
                  <label className="block text-sm text-black mb-2 font-bold">ステータス更新</label>
                  <select 
                    value={editingRef.status} 
                    onChange={(e) => setEditingRef({...editingRef, status: e.target.value, cancel_reason: e.target.value !== 'cancel' ? '' : editingRef.cancel_reason})} 
                    className="w-full border border-gray-300 rounded-lg p-3 text-sm font-bold outline-none bg-white focus:ring-2 focus:ring-blue-100"
                  >
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
              <button onClick={() => handleRefModalSave(editingRef)} disabled={isProcessing} className="px-5 py-2.5 bg-gray-900 text-white font-bold rounded-lg hover:bg-black disabled:opacity-50 transition-colors flex items-center gap-2">
                {isProcessing && <Loader2 className="w-4 h-4 animate-spin"/>} 更新を保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 店舗情報の編集モーダル */}
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