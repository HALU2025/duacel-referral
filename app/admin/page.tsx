'use client'

import { useEffect, useState, useMemo, ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { 
  RefreshCw, Loader2, Search, Filter, AlertTriangle, X, Plus, Link as LinkIcon,
  BarChart3, Users, Gift, Settings, ChevronDown, Trash2,
  Building, LogOut, Shield, Edit2, CheckCircle2, Copy 
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { createAdminUserAction } from '@/app/actions/admin'
import { clearAdminSessionCookie } from '@/app/actions/admin-auth'

// ==========================================
// 1. 定数・型定義
// ==========================================
type TabType = 'referrals' | 'redemptions' | 'users' | 'settings' | 'admins';

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

const PAGE_TITLES: Record<TabType, { label: string, icon: ReactNode }> = {
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
  const [activeTab, setActiveTab] = useState<TabType>('referrals')
  
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

  const [redeemFilters, setRedeemFilters] = useState({ staff_name: '', shop_name: '', status: '', date_start: '', date_end: '' })
  const [filteredRedemptions, setFilteredRedemptions] = useState<any[]>([])
  const [isRedeemFilterOpen, setIsRedeemFilterOpen] = useState(false)

  const [shopFilters, setShopFilters] = useState({ shop_name: '', invite_token: '', category_id: '' })
  const [filteredShops, setFilteredShops] = useState<any[]>([])
  const [isShopFilterOpen, setIsShopFilterOpen] = useState(false)

  // モーダル・UI用 (成果)
  const [isRefModalOpen, setIsRefModalOpen] = useState(false)
  const [editingRef, setEditingRef] = useState<any>(null)
  const [isRefEditMode, setIsRefEditMode] = useState(false)

  // モーダル・UI用 (交換)
  const [isRedeemModalOpen, setIsRedeemModalOpen] = useState(false)
  const [editingRedeem, setEditingRedeem] = useState<any>(null)
  const [isRedeemEditMode, setIsRedeemEditMode] = useState(false)

  // モーダル・UI用 (店舗)
  const [isShopModalOpen, setIsShopModalOpen] = useState(false)
  const [editingShop, setEditingShop] = useState<any>(null)
  const [isShopEditMode, setIsShopEditMode] = useState(false)
  const [expandedShopId, setExpandedShopId] = useState<string | null>(null)

  // モーダル・UI用 (ポイントカテゴリ)
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<any>(null)
  const [isCategoryEditMode, setIsCategoryEditMode] = useState(false)

  // その他設定用
  const [showAddAdminForm, setShowAddAdminForm] = useState(false)
  const [showPasswordForm, setShowPasswordForm] = useState(false)
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
    if (s.data) { setShops(s.data); setFilteredShops(s.data); }
    if (st.data) setStaffs(st.data)
    if (cat.data) { 
      const safeCategories = cat.data.map(c => ({
        ...c,
        recurring_rules: c.recurring_rules || []
      }))
      setCategories(safeCategories); 
    }
    if (tx.data) setPointTransactions(tx.data)
    if (ex.data) { setRedemptions(ex.data); setFilteredRedemptions(ex.data); }
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
  // 高速化：ポイント計算の事前処理
  // ==========================================
  const oldestRefMap = useMemo(() => {
    const map = new Map<string, string>();
    const validRefs = [...referrals].filter(r => r.status !== 'cancel').sort((a,b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    validRefs.forEach(r => {
      if (!map.has(r.shop_id)) map.set(r.shop_id, r.id);
    });
    return map;
  }, [referrals]);

  const getShopByShopId = (shopId: string) => shops.find(s => s.id === shopId)
  const getStaffName = (staffId: string) => staffs.find(s => s.id === staffId)?.name || '不明'

  const getReferralPoints = (ref: any) => {
    if (ref.status === 'cancel') return 0;

    const shop = getShopByShopId(ref.shop_id);
    const category = categories.find(r => r.id === shop?.category_id);
    if (!category) return 0;

    const standardPt = Number(category.reward_points) || 0;
    let bonusPt = 0;

    const rules = category.recurring_rules || [];
    const matchedRule = rules.find((r: any) => Number(r.count) === Number(ref.recurring_count));
    if (matchedRule) {
      bonusPt = Number(matchedRule.points);
    }

    return standardPt + bonusPt;
  }

  // ==========================================
  // フィルター処理
  // ==========================================
  const handleRefFilter = () => {
    let result = [...referrals]
    if (refFilters.order_number) result = result.filter(r => r.order_number?.includes(refFilters.order_number))
    if (refFilters.customer_number) result = result.filter(r => r.customer_name?.includes(refFilters.customer_number))
    if (refFilters.shop_number) {
      const targetShop = shops.find(s => String(s.invite_token) === refFilters.shop_number) 
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

  const handleRedeemFilter = () => {
    let result = [...redemptions]
    if (redeemFilters.staff_name) {
      const matchedStaffIds = staffs.filter(s => s.name.includes(redeemFilters.staff_name)).map(s => s.id)
      result = result.filter(r => matchedStaffIds.includes(r.staff_id))
    }
    if (redeemFilters.shop_name) {
      const matchedShopIds = shops.filter(s => s.name.includes(redeemFilters.shop_name)).map(s => s.id)
      result = result.filter(r => matchedShopIds.includes(r.shop_id))
    }
    if (redeemFilters.status) result = result.filter(r => r.status === redeemFilters.status)
    if (redeemFilters.date_start) {
      const start = new Date(redeemFilters.date_start).getTime()
      result = result.filter(r => new Date(r.created_at).getTime() >= start)
    }
    if (redeemFilters.date_end) {
      const end = new Date(redeemFilters.date_end).getTime() + 86400000 
      result = result.filter(r => new Date(r.created_at).getTime() <= end)
    }
    setFilteredRedemptions(result)
    setIsRedeemFilterOpen(false)
  }

  const handleClearRedeemFilters = () => {
    setRedeemFilters({ staff_name: '', shop_name: '', status: '', date_start: '', date_end: '' })
    setFilteredRedemptions(redemptions)
  }

  const handleShopFilter = () => {
    let result = [...shops]
    if (shopFilters.shop_name) result = result.filter(s => s.name?.includes(shopFilters.shop_name))
    if (shopFilters.invite_token) result = result.filter(s => s.invite_token?.includes(shopFilters.invite_token))
    if (shopFilters.category_id) result = result.filter(s => s.category_id === shopFilters.category_id)
    setFilteredShops(result)
    setIsShopFilterOpen(false)
  }

  const handleClearShopFilters = () => {
    setShopFilters({ shop_name: '', invite_token: '', category_id: '' })
    setFilteredShops(shops)
  }

  // ==========================================
  // 保存・更新処理
  // ==========================================
  const issuePoints = async (referral: any, currentShops: any[], currentCategories: any[]) => {
    const { data: existing } = await supabase.from('point_transactions').select('id').eq('referral_id', referral.id).limit(1)
    if (existing && existing.length > 0) return

    const shop = currentShops.find(s => s.id === referral.shop_id)
    const category = currentCategories.find(c => c.id === shop?.category_id) || currentCategories[0]

    const standardPoints = Number(category?.reward_points) || 0
    
    const rules = category?.recurring_rules || [];
    const matchedRule = rules.find((r: any) => Number(r.count) === Number(referral.recurring_count));
    const bonusPt = matchedRule ? Number(matchedRule.points) : 0;

    const transactions = []
    
    transactions.push({
      shop_id: referral.shop_id, referral_id: referral.id,
      points: standardPoints, reason: `紹介報酬 (基本)`, status: 'confirmed',
      metadata: { order_number: referral.order_number }
    })

    if (bonusPt > 0) {
      transactions.push({
        shop_id: referral.shop_id, referral_id: referral.id,
        points: bonusPt, reason: `${referral.recurring_count}回目 ボーナス`, status: 'confirmed',
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
    if (updatedRef.status === 'cancel' && !updatedRef.cancel_reason) { alert('キャンセル事由を選択してください。'); return; }

    setIsProcessing(true)

    await supabase.from('referrals').update({ 
      status: updatedRef.status,
      cancel_reason: updatedRef.status === 'cancel' ? updatedRef.cancel_reason : null,
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

  const handleRedeemModalSave = async (updatedReq: any) => {
    setIsProcessing(true)
    await supabase.from('reward_exchanges').update({
      status: updatedReq.status,
      gift_url: updatedReq.gift_url || null
    }).eq('id', updatedReq.id)

    setIsRedeemModalOpen(false)
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

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newAdminPassword.length < 6) { alert('パスワードは6文字以上にしてください。'); return; }
    setIsAddingAdmin(true)
    const res = await createAdminUserAction(newAdminEmail, newAdminPassword)
    setIsAddingAdmin(false)
    if (res.success) {
      alert('管理者を登録しました。')
      setNewAdminEmail(''); setNewAdminPassword(''); setShowAddAdminForm(false); fetchData()
    } else {
      alert('登録エラー: ' + res.error)
    }
  }

  const handleDeleteAdmin = async (id: string, email: string) => {
    if (id === currentUserId) { alert('自分自身は削除できません。'); return; }
    if (!confirm(`【警告】\n${email} の管理者権限を削除しますか？`)) return;
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
    if (error) alert('変更失敗: ' + error.message)
    else { alert('パスワードを変更しました。'); setNewPassword(''); setShowPasswordForm(false); }
  }

  // ==========================================
  // 新・ポイントカテゴリ設定ハンドラー (モーダル型)
  // ==========================================
  const openNewCategoryModal = () => {
    setEditingCategory({
      id: `new_${Date.now()}`,
      label: '新規カテゴリ',
      description: '',
      reward_points: 0,
      signup_bonus_enabled: false,
      signup_bonus_points: 0,
      recurring_rules: [],
      isNew: true
    });
    setIsCategoryEditMode(true);
    setIsCategoryModalOpen(true);
  }

  const handleCategoryFieldChange = (field: string, value: any) => {
    setEditingCategory((prev: any) => ({ ...prev, [field]: value }))
  }

  const handleRuleChangeSingle = (ruleIndex: number, field: 'count' | 'points', value: string) => {
    setEditingCategory((prev: any) => {
      const newRules = [...(prev.recurring_rules || [])];
      newRules[ruleIndex] = { ...newRules[ruleIndex], [field]: Number(value) };
      return { ...prev, recurring_rules: newRules };
    })
  }

  const handleAddRuleSingle = () => {
    setEditingCategory((prev: any) => {
      const newRules = [...(prev.recurring_rules || []), { count: 1, points: 0 }];
      return { ...prev, recurring_rules: newRules };
    })
  }

  const handleRemoveRuleSingle = (ruleIndex: number) => {
    setEditingCategory((prev: any) => {
      const newRules = [...(prev.recurring_rules || [])];
      newRules.splice(ruleIndex, 1);
      return { ...prev, recurring_rules: newRules };
    })
  }

  const handleCategoryModalSave = async () => {
    if (!editingCategory.label) { alert('カテゴリ名を入力してください。'); return; }
    
    setIsProcessing(true)
    const dataToSave = {
      label: editingCategory.label, 
      description: editingCategory.description || '',
      reward_points: editingCategory.reward_points || 0,
      signup_bonus_enabled: editingCategory.signup_bonus_enabled || false, 
      signup_bonus_points: editingCategory.signup_bonus_points || 0,
      recurring_rules: editingCategory.recurring_rules || [],
      // 旧仕様のカラムがある場合の保険
      first_bonus_enabled: false,
      first_bonus_points: 0,
      recurring_bonus_enabled: false,
      recurring_bonus_points: 0
    }

    if (editingCategory.isNew) { 
      const { error } = await supabase.from('shop_categories').insert(dataToSave) 
      if(error) alert("作成エラー: " + error.message)
    } else { 
      const { error } = await supabase.from('shop_categories').update(dataToSave).eq('id', editingCategory.id) 
      if(error) alert("更新エラー: " + error.message)
    }
    
    await fetchData()
    setIsProcessing(false)
    setIsCategoryModalOpen(false)
  }


  if (authError) return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-red-600 text-sm font-bold">{authError}</div>
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-900 text-sm"><Loader2 className="w-6 h-6 animate-spin"/></div>

  // --- サマリー計算 ---
  const activeRefFilterCount = Object.values(refFilters).filter(val => val !== '').length
  const totalFilteredPoints = filteredReferrals.reduce((sum, r) => sum + getReferralPoints(r), 0)

  const activeRedeemFilterCount = Object.values(redeemFilters).filter(val => val !== '').length
  const totalFilteredRedeemedPoints = filteredRedemptions.reduce((sum, r) => sum + Number(r.points_consumed), 0)

  const activeShopFilterCount = Object.values(shopFilters).filter(val => val !== '').length
  const totalFilteredMembers = filteredShops.reduce((sum, shop) => sum + staffs.filter(s => s.shop_id === shop.id && !s.is_deleted).length, 0)

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
          {(Object.keys(PAGE_TITLES) as TabType[]).map((id) => (
            <button 
              key={id} 
              onClick={() => setActiveTab(id)} 
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${activeTab === id ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}
            >
              {PAGE_TITLES[id].icon} {PAGE_TITLES[id].label}
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
        
        <div className="mb-8 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-gray-900">
              {PAGE_TITLES[activeTab].icon}
            </span>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">{PAGE_TITLES[activeTab].label}</h1>
          </div>
          {isProcessing && <span className="flex items-center gap-2 text-sm text-blue-600 font-bold bg-blue-50 px-3 py-1 rounded-full"><Loader2 className="w-4 h-4 animate-spin"/> 処理中...</span>}
        </div>

        {/* 成果一覧 */}
        {activeTab === 'referrals' && (
          <div>
            <div className="bg-white border border-gray-200 rounded-xl mb-12 shadow-sm overflow-hidden transition-all">
              <button onClick={() => setIsRefFilterOpen(!isRefFilterOpen)} className="w-full px-5 py-4 flex items-center justify-between bg-white hover:bg-gray-50 transition-colors text-sm font-bold text-gray-900 text-left">
                <span className="flex items-center gap-2"><Filter className="w-4 h-4" /> 検索・絞り込み</span>
                {activeRefFilterCount > 0 && <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs">{activeRefFilterCount}件適用中</span>}
              </button>
              
              {isRefFilterOpen && (
                <div className="p-5 border-t border-gray-200 bg-white">
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4 text-sm font-normal">
                    <div><label className="block text-gray-500 mb-1.5">受注番号</label><input type="text" value={refFilters.order_number} onChange={(e) => setRefFilters({...refFilters, order_number: e.target.value})} className="w-full border border-gray-300 px-3 py-2 outline-none rounded-lg focus:ring-2 focus:ring-blue-100" /></div>
                    <div><label className="block text-gray-500 mb-1.5">顧客名</label><input type="text" value={refFilters.customer_number} onChange={(e) => setRefFilters({...refFilters, customer_number: e.target.value})} className="w-full border border-gray-300 px-3 py-2 outline-none rounded-lg focus:ring-2 focus:ring-blue-100" /></div>
                    <div><label className="block text-gray-500 mb-1.5">店舗コード</label><input type="text" placeholder="例: A1B2C3" value={refFilters.shop_number} onChange={(e) => setRefFilters({...refFilters, shop_number: e.target.value})} className="w-full border border-gray-300 px-3 py-2 outline-none rounded-lg focus:ring-2 focus:ring-blue-100" /></div>
                    <div>
                      <label className="block text-gray-500 mb-1.5">ステータス</label>
                      <select value={refFilters.status} onChange={(e) => setRefFilters({...refFilters, status: e.target.value})} className="w-full border border-gray-300 px-3 py-2 outline-none bg-white rounded-lg focus:ring-2 focus:ring-blue-100">
                        <option value="">すべて</option>
                        {REF_STATUS_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <div className="w-1/2"><label className="block text-gray-500 mb-1.5">From</label><input type="date" value={refFilters.date_start} onChange={(e) => setRefFilters({...refFilters, date_start: e.target.value})} className="w-full border border-gray-300 px-2 py-2 outline-none rounded-lg focus:ring-2 focus:ring-blue-100" /></div>
                      <div className="w-1/2"><label className="block text-gray-500 mb-1.5">To</label><input type="date" value={refFilters.date_end} onChange={(e) => setRefFilters({...refFilters, date_end: e.target.value})} className="w-full border border-gray-300 px-2 py-2 outline-none rounded-lg focus:ring-2 focus:ring-blue-100" /></div>
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end pt-4 border-t border-gray-100">
                    <button onClick={handleClearRefFilters} className="px-5 py-2 text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">クリア</button>
                    <button onClick={handleRefFilter} className="px-5 py-2 text-sm font-bold text-white bg-gray-900 hover:bg-black rounded-lg flex items-center gap-2 transition-colors"><Search className="w-4 h-4"/> 検索する</button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center mb-4 px-1">
              <div className="text-sm font-bold text-gray-900">検索結果 {filteredReferrals.length} 件該当しました</div>
              <div className="text-sm font-bold text-gray-900">総獲得ポイント {totalFilteredPoints.toLocaleString()} pt</div>
            </div>
            <hr className="mb-6 border-gray-300" />

            <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto shadow-sm">
              <table className="w-full text-left border-collapse whitespace-nowrap">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-gray-900 text-sm tracking-wider">
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
                <tbody className="divide-y divide-gray-100 text-sm text-gray-900 font-normal">
                  {filteredReferrals.map(ref => {
                    const shop = getShopByShopId(ref.shop_id);
                    const staff = staffs.find(s => s.id === ref.staff_id);
                    const status = REF_STATUS_OPTIONS.find(s => s.value === ref.status) || REF_STATUS_OPTIONS[0];
                    const isDead = ref.status === 'cancel' || ref.status === 'issued';
                    const totalPt = getReferralPoints(ref);

                    return (
                      <tr key={ref.id} className={`transition-colors ${isDead ? 'bg-gray-50/50 opacity-75' : 'hover:bg-gray-50'}`}>
                        <td className="p-4 whitespace-nowrap">{new Date(ref.created_at).toLocaleString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                        <td className="p-4 whitespace-nowrap font-mono">{ref.order_number}</td>
                        <td className="p-4 whitespace-nowrap">
                          <span className={`px-2.5 py-1 rounded-md text-xs border ${status.bgColor} ${status.color} ${status.border} font-bold inline-flex items-center justify-center min-w-[70px]`}>
                            {status.label}
                          </span>
                        </td>
                        <td className="p-4 whitespace-nowrap">{shop?.name || '不明'}</td>
                        <td className="p-4 whitespace-nowrap font-mono">{shop?.invite_token || '-'}</td>
                        <td className="p-4 whitespace-nowrap">
                          {staff?.name || '不明'} {ref.customer_name ? `/ ${ref.customer_name} 様 (${ref.recurring_count > 1 ? `定期${ref.recurring_count}回目` : '初回'})` : ''}
                        </td>
                        <td className="p-4 whitespace-nowrap font-bold font-mono">{totalPt.toLocaleString()}</td>
                        <td className="p-4 text-right whitespace-nowrap">
                          <button onClick={() => { setEditingRef({...ref, total_points: totalPt}); setIsRefEditMode(false); setIsRefModalOpen(true); }} className="text-gray-900 border border-gray-300 hover:bg-gray-100 font-bold text-xs px-3 py-1.5 rounded-lg transition-colors shadow-sm">
                            詳細
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {filteredReferrals.length === 0 && <div className="p-10 text-center text-gray-500 font-bold">条件に一致する成果がありません</div>}
            </div>
          </div>
        )}

        {/* ポイント交換管理 */}
        {activeTab === 'redemptions' && (
          <div>
            <div className="bg-white border border-gray-200 rounded-xl mb-12 shadow-sm overflow-hidden transition-all">
              <button onClick={() => setIsRedeemFilterOpen(!isRedeemFilterOpen)} className="w-full px-5 py-4 flex items-center justify-between bg-white hover:bg-gray-50 transition-colors text-sm font-bold text-gray-900 text-left">
                <span className="flex items-center gap-2"><Filter className="w-4 h-4" /> 検索・絞り込み</span>
                {activeRedeemFilterCount > 0 && <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs">{activeRedeemFilterCount}件適用中</span>}
              </button>
              
              {isRedeemFilterOpen && (
                <div className="p-5 border-t border-gray-200 bg-white">
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4 text-sm font-normal">
                    <div><label className="block text-gray-500 mb-1.5">スタッフ名</label><input type="text" value={redeemFilters.staff_name} onChange={(e) => setRedeemFilters({...redeemFilters, staff_name: e.target.value})} className="w-full border border-gray-300 px-3 py-2 outline-none rounded-lg focus:ring-2 focus:ring-blue-100" /></div>
                    <div><label className="block text-gray-500 mb-1.5">店舗名</label><input type="text" value={redeemFilters.shop_name} onChange={(e) => setRedeemFilters({...redeemFilters, shop_name: e.target.value})} className="w-full border border-gray-300 px-3 py-2 outline-none rounded-lg focus:ring-2 focus:ring-blue-100" /></div>
                    <div>
                      <label className="block text-gray-500 mb-1.5">ステータス</label>
                      <select value={redeemFilters.status} onChange={(e) => setRedeemFilters({...redeemFilters, status: e.target.value})} className="w-full border border-gray-300 px-3 py-2 outline-none bg-white rounded-lg focus:ring-2 focus:ring-blue-100">
                        <option value="">すべて</option>
                        {REDEEM_STATUS_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                      </select>
                    </div>
                    <div className="flex gap-2 col-span-2">
                      <div className="w-1/2"><label className="block text-gray-500 mb-1.5">From</label><input type="date" value={redeemFilters.date_start} onChange={(e) => setRedeemFilters({...redeemFilters, date_start: e.target.value})} className="w-full border border-gray-300 px-2 py-2 outline-none rounded-lg focus:ring-2 focus:ring-blue-100" /></div>
                      <div className="w-1/2"><label className="block text-gray-500 mb-1.5">To</label><input type="date" value={redeemFilters.date_end} onChange={(e) => setRedeemFilters({...redeemFilters, date_end: e.target.value})} className="w-full border border-gray-300 px-2 py-2 outline-none rounded-lg focus:ring-2 focus:ring-blue-100" /></div>
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end pt-4 border-t border-gray-100">
                    <button onClick={handleClearRedeemFilters} className="px-5 py-2 text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">クリア</button>
                    <button onClick={handleRedeemFilter} className="px-5 py-2 text-sm font-bold text-white bg-gray-900 hover:bg-black rounded-lg flex items-center gap-2 transition-colors"><Search className="w-4 h-4"/> 検索する</button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center mb-4 px-1">
              <div className="text-sm font-bold text-gray-900">検索結果 {filteredRedemptions.length} 件該当しました</div>
              <div className="text-sm font-bold text-gray-900">総交換ポイント {totalFilteredRedeemedPoints.toLocaleString()} pt</div>
            </div>
            <hr className="mb-6 border-gray-300" />

            <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto shadow-sm">
              <table className="w-full text-left border-collapse whitespace-nowrap">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-gray-900 text-sm tracking-wider">
                    <th className="p-4 font-bold whitespace-nowrap">申請日時</th>
                    <th className="p-4 font-bold whitespace-nowrap">ステータス</th>
                    <th className="p-4 font-bold whitespace-nowrap">申請スタッフ</th>
                    <th className="p-4 font-bold whitespace-nowrap">店舗名</th>
                    <th className="p-4 font-bold whitespace-nowrap">交換Pt</th>
                    <th className="p-4 font-bold whitespace-nowrap text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm text-gray-900 font-normal">
                  {filteredRedemptions.map(req => {
                    const staff = staffs.find(s => s.id === req.staff_id);
                    const shop = shops.find(s => s.id === req.shop_id);
                    const status = REDEEM_STATUS_OPTIONS.find(s => s.value === req.status) || REDEEM_STATUS_OPTIONS[3];

                    return (
                      <tr key={req.id} className="hover:bg-gray-50 transition-colors">
                        <td className="p-4 whitespace-nowrap">{new Date(req.created_at).toLocaleString('ja-JP')}</td>
                        <td className="p-4 whitespace-nowrap">
                          <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${status.bgColor} ${status.color}`}>
                            {status.label}
                          </span>
                        </td>
                        <td className="p-4 whitespace-nowrap">{staff?.name || '不明'}</td>
                        <td className="p-4 whitespace-nowrap">{shop?.name || '不明'}</td>
                        <td className="p-4 whitespace-nowrap font-bold font-mono">{Number(req.points_consumed).toLocaleString()}</td>
                        <td className="p-4 text-right whitespace-nowrap">
                          <button onClick={() => { setEditingRedeem(req); setIsRedeemEditMode(false); setIsRedeemModalOpen(true); }} className="text-gray-900 border border-gray-300 hover:bg-gray-100 font-bold text-xs px-3 py-1.5 rounded-lg transition-colors shadow-sm">
                            詳細
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {filteredRedemptions.length === 0 && <div className="p-10 text-center text-gray-500 font-bold">ポイント交換履歴がありません</div>}
            </div>
          </div>
        )}

        {/* ユーザー・店舗管理 */}
        {activeTab === 'users' && (
          <div>
            <div className="bg-white border border-gray-200 rounded-xl mb-12 shadow-sm overflow-hidden transition-all">
              <button onClick={() => setIsShopFilterOpen(!isShopFilterOpen)} className="w-full px-5 py-4 flex items-center justify-between bg-white hover:bg-gray-50 transition-colors text-sm font-bold text-gray-900 text-left">
                <span className="flex items-center gap-2"><Filter className="w-4 h-4" /> 検索・絞り込み</span>
                {activeShopFilterCount > 0 && <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs">{activeShopFilterCount}件適用中</span>}
              </button>
              
              {isShopFilterOpen && (
                <div className="p-5 border-t border-gray-200 bg-white">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4 text-sm font-normal">
                    <div><label className="block text-gray-500 mb-1.5">店舗名</label><input type="text" value={shopFilters.shop_name} onChange={(e) => setShopFilters({...shopFilters, shop_name: e.target.value})} className="w-full border border-gray-300 px-3 py-2 outline-none rounded-lg focus:ring-2 focus:ring-blue-100" /></div>
                    <div><label className="block text-gray-500 mb-1.5">店舗コード</label><input type="text" placeholder="例: A1B2C3" value={shopFilters.invite_token} onChange={(e) => setShopFilters({...shopFilters, invite_token: e.target.value})} className="w-full border border-gray-300 px-3 py-2 outline-none rounded-lg focus:ring-2 focus:ring-blue-100" /></div>
                    <div>
                      <label className="block text-gray-500 mb-1.5">カテゴリ</label>
                      <select value={shopFilters.category_id} onChange={(e) => setShopFilters({...shopFilters, category_id: e.target.value})} className="w-full border border-gray-300 px-3 py-2 outline-none bg-white rounded-lg focus:ring-2 focus:ring-blue-100">
                        <option value="">すべて</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end pt-4 border-t border-gray-100">
                    <button onClick={handleClearShopFilters} className="px-5 py-2 text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">クリア</button>
                    <button onClick={handleShopFilter} className="px-5 py-2 text-sm font-bold text-white bg-gray-900 hover:bg-black rounded-lg flex items-center gap-2 transition-colors"><Search className="w-4 h-4"/> 検索する</button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center mb-4 px-1">
              <div className="text-sm font-bold text-gray-900">検索結果 {filteredShops.length} 店舗該当しました</div>
              <div className="text-sm font-bold text-gray-900">所属メンバー合計 {totalFilteredMembers} 名</div>
            </div>
            <hr className="mb-6 border-gray-300" />

            <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto shadow-sm">
              <table className="w-full text-left border-collapse whitespace-nowrap">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-gray-900 text-sm tracking-wider">
                    <th className="p-4 font-bold whitespace-nowrap">店舗名</th>
                    <th className="p-4 font-bold whitespace-nowrap">店舗コード</th>
                    <th className="p-4 font-bold whitespace-nowrap">カテゴリ</th>
                    <th className="p-4 font-bold whitespace-nowrap">オーナー名</th>
                    <th className="p-4 font-bold whitespace-nowrap">メンバー数</th>
                    <th className="p-4 font-bold whitespace-nowrap">総獲得Pt</th>
                    <th className="p-4 font-bold whitespace-nowrap">総交換Pt</th>
                    <th className="p-4 font-bold whitespace-nowrap text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm text-gray-900 font-normal">
                  {filteredShops.map(shop => {
                    const shopStaffs = staffs.filter(s => s.shop_id === shop.id && !s.is_deleted)
                    const owner = shopStaffs.find(s => s.role === 'owner')
                    const category = categories.find(c => c.id === shop.category_id)
                    
                    const shopReferrals = referrals.filter(r => r.shop_id === shop.id)
                    const shopEarned = shopReferrals.reduce((sum, r) => sum + getReferralPoints(r), 0)
                    
                    const shopRedeems = redemptions.filter(r => r.shop_id === shop.id && r.status === 'completed')
                    const shopRedeemed = shopRedeems.reduce((sum, r) => sum + Number(r.points_consumed), 0)

                    return (
                      <tr key={shop.id} className="hover:bg-gray-50 transition-colors">
                        <td className="p-4 whitespace-nowrap">{shop.name}</td>
                        <td className="p-4 whitespace-nowrap font-mono">{shop.invite_token}</td>
                        <td className="p-4 whitespace-nowrap">{category?.label || '未設定'}</td>
                        <td className="p-4 whitespace-nowrap">{owner?.name || shop.owner_email}</td>
                        <td className="p-4 whitespace-nowrap font-mono">{shopStaffs.length}</td>
                        <td className="p-4 whitespace-nowrap font-mono font-bold text-emerald-600">{shopEarned.toLocaleString()}</td>
                        <td className="p-4 whitespace-nowrap font-mono font-bold text-blue-600">{shopRedeemed.toLocaleString()}</td>
                        <td className="p-4 text-right whitespace-nowrap">
                          <button onClick={() => { setEditingShop(shop); setIsShopEditMode(false); setIsShopModalOpen(true); }} className="text-gray-900 border border-gray-300 hover:bg-gray-100 font-bold text-xs px-3 py-1.5 rounded-lg transition-colors shadow-sm">
                            詳細
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {filteredShops.length === 0 && <div className="p-10 text-center text-gray-500 font-bold">条件に一致する店舗がありません</div>}
            </div>
          </div>
        )}

        {/* ポイント設定 */}
        {activeTab === 'settings' && (
          <div>
            <div className="flex justify-between items-center mb-4 px-1">
              <div className="text-sm font-bold text-gray-900">登録カテゴリ数: {categories.length}件</div>
              <button onClick={openNewCategoryModal} className="flex items-center gap-1 text-sm font-bold bg-gray-900 text-white hover:bg-black px-4 py-2 rounded-lg transition-colors">
                <Plus className="w-4 h-4"/> 新規作成
              </button>
            </div>
            <hr className="mb-6 border-gray-300" />

            <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto shadow-sm">
              <table className="w-full text-left border-collapse whitespace-nowrap">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-gray-900 text-sm tracking-wider">
                    <th className="p-4 font-bold whitespace-nowrap">カテゴリ名 / 説明</th>
                    <th className="p-4 font-bold whitespace-nowrap">基本報酬</th>
                    <th className="p-4 font-bold whitespace-nowrap">登録ボーナス</th>
                    <th className="p-4 font-bold whitespace-nowrap">回数別ボーナス</th>
                    <th className="p-4 font-bold whitespace-nowrap text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm text-gray-900 font-normal">
                  {categories.map(cat => (
                    <tr key={cat.id} className="hover:bg-gray-50 transition-colors">
                      <td className="p-4 whitespace-nowrap">
                        <div className="font-bold text-gray-900">{cat.label}</div>
                        {cat.description && <div className="text-xs text-gray-500 mt-1">{cat.description}</div>}
                      </td>
                      <td className="p-4 whitespace-nowrap font-mono font-bold">{Number(cat.reward_points).toLocaleString()} pt</td>
                      <td className="p-4 whitespace-nowrap font-mono">
                        {cat.signup_bonus_enabled ? `+${Number(cat.signup_bonus_points).toLocaleString()} pt` : <span className="text-gray-400 font-sans text-xs">設定なし</span>}
                      </td>
                      <td className="p-4 whitespace-nowrap">
                        {cat.recurring_rules && cat.recurring_rules.length > 0 ? (
                          <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-bold border border-blue-200">設定あり ({cat.recurring_rules.length}件)</span>
                        ) : (
                          <span className="text-gray-400 text-xs">設定なし</span>
                        )}
                      </td>
                      <td className="p-4 text-right whitespace-nowrap">
                        <button onClick={() => { setEditingCategory(JSON.parse(JSON.stringify(cat))); setIsCategoryEditMode(false); setIsCategoryModalOpen(true); }} className="text-gray-900 border border-gray-300 hover:bg-gray-100 font-bold text-xs px-3 py-1.5 rounded-lg transition-colors shadow-sm">
                          詳細
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {categories.length === 0 && <div className="p-10 text-center text-gray-500 font-bold">カテゴリが登録されていません</div>}
            </div>
          </div>
        )}

        {/* Admins */}
        {activeTab === 'admins' && (
          <div className="space-y-6">
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm w-full md:w-2/3">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-base font-bold text-gray-900">システム管理者一覧</h3>
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

      {/* --- 成果 Detail モーダル --- */}
      {isRefModalOpen && editingRef && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl p-6 w-full max-w-xl shadow-2xl my-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-gray-900">成果情報 Detail</h3>
              <div className="flex items-center gap-2">
                {!isRefEditMode && (
                  <button onClick={() => setIsRefEditMode(true)} className="flex items-center gap-1 text-sm font-bold text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded transition-colors">
                    <Edit2 className="w-4 h-4"/> 編集
                  </button>
                )}
                <button onClick={() => setIsRefModalOpen(false)} className="text-gray-400 hover:bg-gray-100 p-2 rounded-full transition-colors"><X className="w-5 h-5" /></button>
              </div>
            </div>
            
            <div className="bg-gray-50 border border-gray-200 p-5 rounded-xl text-sm mb-6 space-y-4 text-gray-900 font-normal">
              <div className="grid grid-cols-3 gap-3 items-center border-b border-gray-200 pb-2">
                <label className="text-gray-500 text-sm font-bold">発生日時</label>
                <div className="col-span-2 text-gray-900 text-sm font-mono">{new Date(editingRef.created_at).toLocaleString('ja-JP')}</div>
              </div>

              <div className="grid grid-cols-3 gap-3 items-center border-b border-gray-200 pb-2">
                <label className="text-gray-500 text-sm font-bold">受注番号</label>
                <div className="col-span-2 text-gray-900 text-sm font-mono">{editingRef.order_number || '-'}</div>
              </div>

              <div className="grid grid-cols-3 gap-3 items-center border-b border-gray-200 pb-2">
                <label className="text-gray-500 text-sm font-bold">顧客名 / 回数</label>
                <div className="col-span-2 text-gray-900 text-sm">
                  {editingRef.customer_name || '不明'} 
                  <span className="ml-2 px-2 py-0.5 bg-gray-200 rounded text-xs">{editingRef.recurring_count || 1}回目</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 items-center border-b border-gray-200 pb-2">
                <label className="text-gray-500 text-sm font-bold">店舗名 / コード</label>
                <div className="col-span-2 text-gray-900 text-sm">
                  {getShopByShopId(editingRef.shop_id)?.name || '不明'} 
                  <span className="ml-2 font-mono text-gray-400">{getShopByShopId(editingRef.shop_id)?.invite_token}</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 items-center border-b border-gray-200 pb-2">
                <label className="text-gray-500 text-sm font-bold">担当スタッフ</label>
                <div className="col-span-2 text-gray-900 text-sm">
                  {getStaffName(editingRef.staff_id)}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 items-start border-b border-gray-200 pb-2">
                <label className="text-gray-500 text-sm font-bold">紹介URL</label>
                <div className="col-span-2">
                  <div className="flex items-center gap-2 text-gray-900 text-xs break-all bg-white p-2 border border-gray-200 rounded font-mono">
                    <span>https://duacel.net/welcome/ref_{staffs.find(s => s.id === editingRef.staff_id)?.referral_code}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 items-center border-b border-gray-200 pb-2">
                <label className="text-gray-500 text-sm font-bold">獲得ポイント</label>
                <div className="col-span-2 text-gray-900 text-sm font-mono font-bold">
                  {isRefEditMode ? (
                    <input 
                      type="number"
                      className="border border-gray-300 p-2 rounded w-full outline-none focus:ring-2 focus:ring-blue-100 bg-white" 
                      value={editingRef.total_points || 0} 
                      onChange={(e) => setEditingRef({...editingRef, total_points: Number(e.target.value)})} 
                    />
                  ) : (
                    <span>{Number(editingRef.total_points).toLocaleString()} pt</span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 items-center">
                <label className="text-gray-500 text-sm font-bold">ステータス</label>
                <div className="col-span-2 text-gray-900 text-sm font-bold">
                  {isRefEditMode ? (
                    <select 
                      value={editingRef.status} 
                      onChange={(e) => setEditingRef({...editingRef, status: e.target.value, cancel_reason: e.target.value !== 'cancel' ? '' : editingRef.cancel_reason})} 
                      className="w-full border border-gray-300 rounded-lg p-2 outline-none bg-white focus:ring-2 focus:ring-blue-100"
                    >
                      <option value="pending">仮計上</option>
                      <option value="confirmed">報酬確定</option>
                      <option value="cancel">キャンセル (没収)</option>
                    </select>
                  ) : (
                    <span>{REF_STATUS_OPTIONS.find(o => o.value === editingRef.status)?.label}</span>
                  )}
                </div>
              </div>

              {isRefEditMode && editingRef.status === 'cancel' && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                  <label className="flex items-center gap-1 text-sm text-red-600 font-bold mb-2 mt-2"><AlertTriangle className="w-4 h-4"/>キャンセル事由</label>
                  <select value={editingRef.cancel_reason || ''} onChange={(e) => setEditingRef({...editingRef, cancel_reason: e.target.value})} className="w-full border border-red-300 bg-red-50 p-2 text-sm font-bold text-red-800 outline-none rounded-lg">
                    <option value="">選択してください</option>
                    {CANCEL_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </motion.div>
              )}
            </div>

            {isRefEditMode ? (
              <div className="flex gap-3 justify-end">
                <button onClick={() => setIsRefEditMode(false)} className="px-5 py-2 font-bold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">キャンセル</button>
                <button onClick={() => handleRefModalSave(editingRef)} disabled={isProcessing} className="px-5 py-2 bg-gray-900 text-white font-bold rounded-lg hover:bg-black disabled:opacity-50 transition-colors flex items-center gap-2">
                  {isProcessing && <Loader2 className="w-4 h-4 animate-spin"/>} 保存
                </button>
              </div>
            ) : (
              <div className="flex gap-3 justify-end">
                <button onClick={() => setIsRefModalOpen(false)} className="px-5 py-2 font-bold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">閉じる</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- ポイント交換 Detail モーダル --- */}
      {isRedeemModalOpen && editingRedeem && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl p-6 w-full max-w-xl shadow-2xl my-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-gray-900">ポイント交換 Detail</h3>
              <div className="flex items-center gap-2">
                {!isRedeemEditMode && (
                  <button onClick={() => setIsRedeemEditMode(true)} className="flex items-center gap-1 text-sm font-bold text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded transition-colors">
                    <Edit2 className="w-4 h-4"/> 編集
                  </button>
                )}
                <button onClick={() => setIsRedeemModalOpen(false)} className="text-gray-400 hover:bg-gray-100 p-2 rounded-full transition-colors"><X className="w-5 h-5" /></button>
              </div>
            </div>
            
            <div className="bg-gray-50 border border-gray-200 p-5 rounded-xl text-sm mb-6 space-y-4 text-gray-900 font-normal">
              <div className="grid grid-cols-3 gap-3 items-center border-b border-gray-200 pb-2">
                <label className="text-gray-500 text-sm font-bold">申請日時</label>
                <div className="col-span-2 text-gray-900 text-sm font-mono">{new Date(editingRedeem.created_at).toLocaleString('ja-JP')}</div>
              </div>

              <div className="grid grid-cols-3 gap-3 items-center border-b border-gray-200 pb-2">
                <label className="text-gray-500 text-sm font-bold">店舗 / スタッフ</label>
                <div className="col-span-2 text-gray-900 text-sm">
                  {getShopByShopId(editingRedeem.shop_id)?.name || '不明'} / {getStaffName(editingRedeem.staff_id)}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 items-center border-b border-gray-200 pb-2">
                <label className="text-gray-500 text-sm font-bold">交換ポイント</label>
                <div className="col-span-2 text-gray-900 text-sm font-mono font-bold">{Number(editingRedeem.points_consumed).toLocaleString()} pt</div>
              </div>

              <div className="grid grid-cols-3 gap-3 items-start border-b border-gray-200 pb-2">
                <label className="text-gray-500 text-sm font-bold">ギフトURL</label>
                <div className="col-span-2 text-gray-900 text-sm break-all">
                  {isRedeemEditMode ? (
                    <input type="text" value={editingRedeem.gift_url || ''} onChange={(e) => setEditingRedeem({...editingRedeem, gift_url: e.target.value})} className="w-full border border-gray-300 rounded p-2 outline-none focus:ring-2 focus:ring-blue-100 bg-white font-mono text-xs" placeholder="https://" />
                  ) : (
                    editingRedeem.gift_url ? (
                      <a href={editingRedeem.gift_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{editingRedeem.gift_url}</a>
                    ) : '未発行'
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 items-center border-b border-gray-200 pb-2">
                <label className="text-gray-500 text-sm font-bold">ステータス</label>
                <div className="col-span-2 text-gray-900 text-sm font-bold">
                  {isRedeemEditMode ? (
                    <select value={editingRedeem.status} onChange={(e) => setEditingRedeem({...editingRedeem, status: e.target.value})} className="w-full border border-gray-300 rounded-lg p-2 outline-none bg-white focus:ring-2 focus:ring-blue-100">
                      {REDEEM_STATUS_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>
                  ) : (
                    <span>{REDEEM_STATUS_OPTIONS.find(o => o.value === editingRedeem.status)?.label}</span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 items-start">
                <label className="text-gray-500 text-sm font-bold">エラーログ</label>
                <div className="col-span-2 text-gray-500 text-xs font-mono bg-white p-2 border border-gray-200 rounded h-24 overflow-y-auto whitespace-pre-wrap">
                  {editingRedeem.error_details ? JSON.stringify(editingRedeem.error_details, null, 2) : 'なし'}
                </div>
              </div>
            </div>

            {isRedeemEditMode ? (
              <div className="flex gap-3 justify-end">
                <button onClick={() => setIsRedeemEditMode(false)} className="px-5 py-2 font-bold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">キャンセル</button>
                <button onClick={() => handleRedeemModalSave(editingRedeem)} disabled={isProcessing} className="px-5 py-2 bg-gray-900 text-white font-bold rounded-lg hover:bg-black disabled:opacity-50 transition-colors flex items-center gap-2">
                  {isProcessing && <Loader2 className="w-4 h-4 animate-spin"/>} 保存
                </button>
              </div>
            ) : (
              <div className="flex gap-3 justify-end">
                <button onClick={() => setIsRedeemModalOpen(false)} className="px-5 py-2 font-bold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">閉じる</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- 店舗 Detail モーダル --- */}
      {isShopModalOpen && editingShop && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl p-6 w-full max-w-xl shadow-2xl my-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-gray-900">店舗情報 Detail</h3>
              <div className="flex items-center gap-2">
                {!isShopEditMode && (
                  <button onClick={() => setIsShopEditMode(true)} className="flex items-center gap-1 text-sm font-bold text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded transition-colors">
                    <Edit2 className="w-4 h-4"/> 編集
                  </button>
                )}
                <button onClick={() => setIsShopModalOpen(false)} className="text-gray-400 hover:bg-gray-100 p-2 rounded-full transition-colors"><X className="w-5 h-5" /></button>
              </div>
            </div>
            
            <div className="bg-gray-50 border border-gray-200 p-5 rounded-xl text-sm mb-6 space-y-4 text-gray-900 font-normal">
              <div className="grid grid-cols-3 gap-3 items-center border-b border-gray-200 pb-2">
                <label className="text-gray-500 text-sm font-bold">店舗名</label>
                <div className="col-span-2 text-gray-900 text-sm font-bold">
                  {isShopEditMode ? (
                    <input type="text" value={editingShop.name} onChange={(e) => setEditingShop({...editingShop, name: e.target.value})} className="w-full border border-gray-300 rounded p-2 outline-none focus:ring-2 focus:ring-blue-100 bg-white" />
                  ) : (
                    editingShop.name
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 items-center border-b border-gray-200 pb-2">
                <label className="text-gray-500 text-sm font-bold">店舗コード (URL共通)</label>
                <div className="col-span-2 text-gray-900 text-sm font-mono">
                  {editingShop.invite_token}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 items-center border-b border-gray-200 pb-2">
                <label className="text-gray-500 text-sm font-bold">電話番号</label>
                <div className="col-span-2 text-gray-900 text-sm">
                  {isShopEditMode ? (
                    <input type="tel" value={editingShop.phone || ''} onChange={(e) => setEditingShop({...editingShop, phone: e.target.value})} className="w-full border border-gray-300 rounded p-2 outline-none focus:ring-2 focus:ring-blue-100 bg-white" />
                  ) : (
                    editingShop.phone || '未登録'
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 items-center border-b border-gray-200 pb-2">
                <label className="text-gray-500 text-sm font-bold">カテゴリ</label>
                <div className="col-span-2 text-gray-900 text-sm">
                  {isShopEditMode ? (
                    <select value={editingShop.category_id || ''} onChange={(e) => setEditingShop({...editingShop, category_id: e.target.value})} className="w-full border border-gray-300 rounded p-2 outline-none bg-white focus:ring-2 focus:ring-blue-100">
                      <option value="">未設定</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                  ) : (
                    categories.find(c => c.id === editingShop.category_id)?.label || '未設定'
                  )}
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-3 items-start">
                <label className="text-gray-500 text-sm font-bold">所属メンバー</label>
                <div className="col-span-2 space-y-2 max-h-40 overflow-y-auto">
                  {staffs.filter(s => s.shop_id === editingShop.id && !s.is_deleted).map(staff => (
                    <div key={staff.id} className="p-2 border border-gray-200 bg-white rounded flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-gray-900">{staff.name}</span>
                        {staff.role === 'owner' && <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-bold">オーナー</span>}
                      </div>
                      <span className="text-xs text-gray-500 font-mono">ref_{staff.referral_code}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {isShopEditMode ? (
              <div className="flex gap-3 justify-end">
                <button onClick={() => setIsShopEditMode(false)} className="px-5 py-2 font-bold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">キャンセル</button>
                <button onClick={() => handleShopModalSave(editingShop)} disabled={isProcessing} className="px-5 py-2 bg-gray-900 text-white font-bold rounded-lg hover:bg-black disabled:opacity-50 transition-colors flex items-center gap-2">
                  {isProcessing && <Loader2 className="w-4 h-4 animate-spin"/>} 保存
                </button>
              </div>
            ) : (
              <div className="flex gap-3 justify-end">
                <button onClick={() => setIsShopModalOpen(false)} className="px-5 py-2 font-bold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">閉じる</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- ポイントカテゴリ Detail モーダル --- */}
      {isCategoryModalOpen && editingCategory && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl shadow-2xl my-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-gray-900">カテゴリ情報 Detail</h3>
              <div className="flex items-center gap-2">
                {!isCategoryEditMode && (
                  <button onClick={() => setIsCategoryEditMode(true)} className="flex items-center gap-1 text-sm font-bold text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded transition-colors">
                    <Edit2 className="w-4 h-4"/> 編集
                  </button>
                )}
                <button onClick={() => setIsCategoryModalOpen(false)} className="text-gray-400 hover:bg-gray-100 p-2 rounded-full transition-colors"><X className="w-5 h-5" /></button>
              </div>
            </div>
            
            <div className="bg-gray-50 border border-gray-200 p-5 rounded-xl text-sm mb-6 space-y-4 text-gray-900 font-normal">
              
              <div className="grid grid-cols-3 gap-3 items-center border-b border-gray-200 pb-2">
                <label className="text-gray-500 text-sm font-bold">カテゴリ名</label>
                <div className="col-span-2 text-gray-900 text-sm font-bold">
                  {isCategoryEditMode ? (
                    <input type="text" value={editingCategory.label} onChange={(e) => handleCategoryFieldChange('label', e.target.value)} className="w-full border border-gray-300 rounded p-2 outline-none focus:ring-2 focus:ring-blue-100 bg-white" placeholder="例: 通常サロン" />
                  ) : (
                    editingCategory.label
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 items-center border-b border-gray-200 pb-2">
                <label className="text-gray-500 text-sm font-bold">説明</label>
                <div className="col-span-2 text-gray-900 text-sm">
                  {isCategoryEditMode ? (
                    <input type="text" value={editingCategory.description || ''} onChange={(e) => handleCategoryFieldChange('description', e.target.value)} className="w-full border border-gray-300 rounded p-2 outline-none focus:ring-2 focus:ring-blue-100 bg-white" placeholder="説明を入力 (任意)" />
                  ) : (
                    editingCategory.description || 'なし'
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 items-center border-b border-gray-200 pb-2">
                <label className="text-gray-500 text-sm font-bold">基本報酬</label>
                <div className="col-span-2 text-gray-900 text-sm font-mono">
                  {isCategoryEditMode ? (
                    <div className="flex items-center gap-2">
                      <input type="number" value={editingCategory.reward_points} onChange={(e) => handleCategoryFieldChange('reward_points', Number(e.target.value))} className="w-32 border border-gray-300 rounded p-2 outline-none focus:ring-2 focus:ring-blue-100 bg-white" />
                      <span className="font-bold">pt</span>
                    </div>
                  ) : (
                    <span className="font-bold">{Number(editingCategory.reward_points).toLocaleString()} pt</span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 items-center border-b border-gray-200 pb-2">
                <label className="text-gray-500 text-sm font-bold">登録ボーナス</label>
                <div className="col-span-2 text-gray-900 text-sm font-mono">
                  {isCategoryEditMode ? (
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-1 font-bold">
                        <input type="checkbox" checked={editingCategory.signup_bonus_enabled} onChange={(e) => handleCategoryFieldChange('signup_bonus_enabled', e.target.checked)} className="w-4 h-4 rounded border-gray-300" />
                        あり
                      </label>
                      <div className="flex items-center gap-2">
                        <input type="number" disabled={!editingCategory.signup_bonus_enabled} value={editingCategory.signup_bonus_points || 0} onChange={(e) => handleCategoryFieldChange('signup_bonus_points', Number(e.target.value))} className="w-32 border border-gray-300 rounded p-2 outline-none focus:ring-2 focus:ring-blue-100 bg-white disabled:bg-gray-100" />
                        <span className="font-bold">pt</span>
                      </div>
                    </div>
                  ) : (
                    <span className="font-bold">{editingCategory.signup_bonus_enabled ? `+${Number(editingCategory.signup_bonus_points).toLocaleString()} pt` : <span className="text-gray-400 font-sans text-xs">設定なし</span>}</span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 items-start">
                <label className="text-gray-500 text-sm font-bold">回数別ボーナス</label>
                <div className="col-span-2">
                  {isCategoryEditMode ? (
                    <div className="bg-white border border-gray-200 p-3 rounded-lg">
                      <div className="space-y-2 mb-3">
                        {editingCategory.recurring_rules && editingCategory.recurring_rules.length > 0 ? (
                          editingCategory.recurring_rules.map((rule:any, idx:number) => (
                            <div key={idx} className="flex items-center gap-2">
                              <input type="number" min="1" value={rule.count} onChange={(e) => handleRuleChangeSingle(idx, 'count', e.target.value)} className="w-16 border border-gray-300 rounded px-2 py-1.5 text-sm font-mono text-center outline-none focus:ring-2 focus:ring-blue-100" />
                              <span className="text-xs font-bold text-gray-600 whitespace-nowrap">回目 :</span>
                              <input type="number" min="0" value={rule.points} onChange={(e) => handleRuleChangeSingle(idx, 'points', e.target.value)} className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-sm font-mono outline-none focus:ring-2 focus:ring-blue-100" />
                              <span className="text-xs font-bold text-gray-600">pt</span>
                              <button onClick={() => handleRemoveRuleSingle(idx)} className="p-1 text-gray-400 hover:text-red-500 transition-colors ml-1">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ))
                        ) : (
                          <p className="text-xs text-gray-400">設定されていません</p>
                        )}
                      </div>
                      <button onClick={handleAddRuleSingle} className="flex items-center justify-center w-full gap-1 py-2 border border-dashed border-blue-300 rounded text-xs font-bold text-blue-600 hover:bg-blue-50 transition-colors">
                        <Plus className="w-3 h-3" /> ルールを追加
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {editingCategory.recurring_rules && editingCategory.recurring_rules.length > 0 ? (
                        editingCategory.recurring_rules.sort((a:any, b:any) => a.count - b.count).map((rule:any, idx:number) => (
                          <div key={idx} className="flex items-center gap-4 bg-white px-3 py-2 border border-gray-200 rounded">
                            <span className="text-sm font-bold text-gray-700 w-16">{rule.count} 回目</span>
                            <span className="text-sm font-bold text-blue-600 font-mono">+{Number(rule.points).toLocaleString()} pt</span>
                          </div>
                        ))
                      ) : (
                        <span className="text-gray-400 text-xs">設定なし</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {isCategoryEditMode ? (
              <div className="flex gap-3 justify-end">
                <button onClick={() => setIsCategoryEditMode(false)} className="px-5 py-2 font-bold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">キャンセル</button>
                <button onClick={() => handleCategoryModalSave()} disabled={isProcessing} className="px-5 py-2 bg-gray-900 text-white font-bold rounded-lg hover:bg-black disabled:opacity-50 transition-colors flex items-center gap-2">
                  {isProcessing && <Loader2 className="w-4 h-4 animate-spin"/>} 保存
                </button>
              </div>
            ) : (
              <div className="flex gap-3 justify-end">
                <button onClick={() => setIsCategoryModalOpen(false)} className="px-5 py-2 font-bold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">閉じる</button>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  )
}