'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { QRCodeCanvas } from 'qrcode.react'
import { motion, AnimatePresence } from 'framer-motion'

import { 
  LogOut, Clock, CheckCircle2, Wallet, Users, Crown, Settings, 
  Link as LinkIcon, QrCode, Trash2, Coins, Smartphone, ClipboardList, 
  X, Ban, Trophy, Calendar, LayoutDashboard, Share, Edit2, Loader2, 
  Mail, Key, ShieldCheck, Store, BookOpen, Sparkles, PlayCircle, 
  MessageCircle, Info, Copy, ShoppingBag, ThumbsUp, Handshake, Percent,
  ToggleRight, ToggleLeft, User, UserPlus
} from 'lucide-react'

const POLICY_PATTERNS = [
  { id: 'pattern1', icon: <ThumbsUp className="w-4 h-4" />, label: 'スタッフ全力還元', desc: '個人のモチベーションを最大化', ratios: { individual: 100, team: 0, owner: 0 } },
  { id: 'pattern2', icon: <Handshake className="w-4 h-4" />, label: 'チームワーク重視', desc: '店舗全体の協力体制をつくる', ratios: { individual: 70, team: 30, owner: 0 } },
  { id: 'pattern3', icon: <Store className="w-4 h-4" />, label: '店舗還元ミックス', desc: '販促・仕入れ費として店舗にも還元', ratios: { individual: 60, team: 20, owner: 20 } },
  { id: 'custom', icon: <Settings className="w-4 h-4" />, label: 'カスタム設定', desc: 'スライダーで自由に配分を調整', ratios: null },
]

export default function OwnerDashboard() {
  const [activeTab, setActiveTab] = useState<'stats' | 'staff' | 'info' | 'shop' | 'settings'>('stats')

  const [shop, setShop] = useState<any>(null)
  const [category, setCategory] = useState<any>(null)
  const [staffs, setStaffs] = useState<any[]>([])
  const [referralHistory, setReferralHistory] = useState<any[]>([])
 
  const [ratios, setRatios] = useState({ individual: 100, team: 0, owner: 0 })
  const [selectedPattern, setSelectedPattern] = useState<string>('pattern1')
  const [isSavingPolicy, setIsSavingPolicy] = useState(false)
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false)

  const [filterStatus, setFilterStatus] = useState('') 
  const [visibleCount, setVisibleCount] = useState(20) 

  // ★ 追加：QRコード表示用モーダル
  const [isQRModalOpen, setIsQRModalOpen] = useState(false)
  
  const [detailStaff, setDetailStaff] = useState<any>(null)
  const [copied, setCopied] = useState(false)

  const [summary, setSummary] = useState({ 
    totalEarned: 0, thisMonthEarned: 0, pendingPoints: 0, confirmedPoints: 0, issuedPoints: 0, rewardedPoints: 0, canceledPoints: 0,
    storeTotalGenerated: 0, storeTotalIndividual: 0, storeTotalTeam: 0, storeTotalOwner: 0, pendingCount: 0
  })
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  const [authEmail, setAuthEmail] = useState('')
  const [newOwnerEmail, setNewOwnerEmail] = useState('')
  const [newOwnerPassword, setNewOwnerPassword] = useState('')
  const [isUpdatingAuth, setIsUpdatingAuth] = useState(false)
  const [authMessage, setAuthMessage] = useState<{type: 'success' | 'error', text: string} | null>(null)

  const MOCK_PRODUCTS = [
    { id: 1, name: 'Duacel スカルプセラム (業務用)', price: 8800, ptPrice: 8000, icon: <Sparkles className="w-6 h-6 text-gray-400" /> },
    { id: 2, name: '専用導入機器 (Proモデル)', price: 45000, ptPrice: 42000, icon: <ShieldCheck className="w-6 h-6 text-gray-400" /> },
    { id: 3, name: '店販用パンフレット (100部)', price: 2000, ptPrice: 2000, icon: <BookOpen className="w-6 h-6 text-gray-400" /> },
  ]

  const getPatternFromRatios = (ind: number, team: number, owner: number) => {
    const match = POLICY_PATTERNS.find(p => p.ratios && p.ratios.individual === ind && p.ratios.team === team && p.ratios.owner === owner)
    return match ? match.id : 'custom'
  }

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return; }

    setAuthEmail(user.email || '')

    const { data: shopData } = await supabase.from('shops').select(`*, shop_categories (*), ratio_individual, ratio_team, ratio_owner`).eq('owner_id', user.id).maybeSingle()
    if (!shopData) { if (!silent) setLoading(false); return; }
    
    setShop(shopData)
    setCategory(shopData.shop_categories)
    
    const currentRatios = { individual: shopData.ratio_individual ?? 100, team: shopData.ratio_team ?? 0, owner: shopData.ratio_owner ?? 0 }
    setRatios(currentRatios)
    setSelectedPattern(getPatternFromRatios(currentRatios.individual, currentRatios.team, currentRatios.owner))

    const currentRewardPoints = shopData.shop_categories?.reward_points || 0
    const firstBonusEnabled = shopData.shop_categories?.first_bonus_enabled || false
    const firstBonusPoints = shopData.shop_categories?.first_bonus_points || 0

    const [staffRes, refRes, txRes] = await Promise.all([
      supabase.from('staffs').select('*').eq('shop_id', shopData.id),
      supabase.from('referrals').select('*').eq('shop_id', shopData.id).order('created_at', { ascending: false }),
      supabase.from('point_transactions').select('*').eq('shop_id', shopData.id)
    ])

    const staffList = staffRes.data || []
    const referralLogs = refRes.data || []
    const pointLogs = txRes.data || []

    const activeStaffs = staffList.filter(s => !s.is_deleted);
    const eligibleStaffCount = activeStaffs.filter(s => s.is_team_pool_eligible !== false).length || 1;

    const reversedLogs = [...referralLogs].reverse();
    const staffCounters: Record<string, number> = {};
    const shopHasBonusTx = pointLogs.some(tx => tx.metadata?.is_bonus === true);

    const enrichedReferrals = reversedLogs.map((log, index) => {
      staffCounters[log.staff_id] = (staffCounters[log.staff_id] || 0) + 1;
      const refTxs = pointLogs.filter(tx => tx.referral_id === log.id && (tx.status === 'confirmed' || tx.status === 'paid'));
      
      const isOldest = index === 0;
      const isFirstTime = log.status !== 'cancel' && (refTxs.length > 0 ? refTxs.some(tx => tx.metadata?.is_bonus) : (!shopHasBonusTx && isOldest));
      const basePoints = currentRewardPoints + (isFirstTime && firstBonusEnabled ? firstBonusPoints : 0);
      
      const indRatio = currentRatios.individual;
      const teamRatio = currentRatios.team;
      const ownerRatio = currentRatios.owner;

      const totalIndPart = Math.floor(basePoints * (indRatio / 100));
      const totalTeamPool = Math.floor(basePoints * (teamRatio / 100));
      const teamPartPerPerson = totalTeamPool / eligibleStaffCount;
      const ownerPart = Math.floor(basePoints * (ownerRatio / 100));

      const isOwnerAction = staffList.find(s => s.id === log.staff_id)?.email === shopData.owner_email;
      const ownerEarnedPoints = isOwnerAction ? Math.floor(totalIndPart + teamPartPerPerson + ownerPart) : Math.floor(teamPartPerPerson + ownerPart);
      
      const totalPointsInTx = refTxs.reduce((sum, tx) => sum + (Number(tx.points) || 0), 0);
      const hasBonus = refTxs.some(tx => tx.metadata?.is_bonus === true);

      return { 
        ...log, 
        type: 'referral', 
        staffName: staffList.find(s => s.id === log.staff_id)?.name || '不明', 
        staffNthCount: staffCounters[log.staff_id], 
        totalGenerated: basePoints,
        ownerPoints: ownerEarnedPoints,
        snapshot_ratio_individual: indRatio,
        snapshot_ratio_team: teamRatio,
        snapshot_ratio_owner: ownerRatio,
        totalIndPart,
        totalTeamPool,
        ownerPart,
        hasBonus 
      }
    });

    const staffAddLogs = staffList.filter(s => s.email !== shopData.owner_email).map(s => ({
      id: `staff_add_${s.id}`,
      type: 'staff_added',
      created_at: s.created_at,
      staffName: s.name,
      status: 'info' 
    }));

    const combinedFeed = [...enrichedReferrals, ...staffAddLogs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setReferralHistory(combinedFeed);

    const staffsWithFinance = staffList.map(s => {
      const staffRefs = enrichedReferrals.filter(r => r.staff_id === s.id);
      const pendingPts = staffRefs.filter(r => r.status === 'pending').reduce((sum, r) => sum + r.ownerPoints, 0);
      const unpaidToStaffPts = staffRefs.filter(r => r.status === 'issued' && !r.is_staff_rewarded).reduce((sum, r) => sum + r.totalIndPart, 0);
      const isOwner = s.email === shopData.owner_email;
      return { ...s, count: staffRefs.filter(r => r.status !== 'cancel').length, pendingPts, unpaidToStaffPts, hasUnpaid: unpaidToStaffPts > 0, isOwner }
    })
    setStaffs(staffsWithFinance)

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const validRefs = enrichedReferrals.filter(r => r.status !== 'cancel');
    const earnedRefs = validRefs.filter(r => r.status === 'issued' || r.is_staff_rewarded || r.status === 'confirmed');
    const pendingRefs = validRefs.filter(r => r.status === 'pending');

    setSummary({
      totalEarned: earnedRefs.reduce((sum, r) => sum + r.ownerPoints, 0),
      thisMonthEarned: earnedRefs.filter(r => { const d = new Date(r.created_at); return d.getMonth() === currentMonth && d.getFullYear() === currentYear; }).reduce((sum, r) => sum + r.ownerPoints, 0),
      pendingPoints: pendingRefs.reduce((sum, r) => sum + r.totalGenerated, 0),
      confirmedPoints: earnedRefs.reduce((sum, r) => sum + r.ownerPart, 0), 
      issuedPoints: 0, rewardedPoints: 0, canceledPoints: 0,
      storeTotalGenerated: earnedRefs.reduce((sum, r) => sum + r.totalGenerated, 0),
      storeTotalIndividual: earnedRefs.reduce((sum, r) => sum + r.totalIndPart, 0),
      storeTotalTeam: earnedRefs.reduce((sum, r) => sum + r.totalTeamPool, 0),
      storeTotalOwner: earnedRefs.reduce((sum, r) => sum + r.ownerPart, 0),
      pendingCount: pendingRefs.length
    })
    
    if (!silent) setLoading(false)
  }

  const handlePatternSelect = (id: string) => {
    setSelectedPattern(id)
    const pattern = POLICY_PATTERNS.find(p => p.id === id)
    if (pattern && pattern.ratios) setRatios(pattern.ratios)
  }

  const handleSliderChange = (key: 'individual' | 'team', value: number) => {
    setSelectedPattern('custom')
    setRatios(prev => {
      let nextInd = key === 'individual' ? value : prev.individual;
      let nextTeam = key === 'team' ? value : prev.team;
      if (nextInd + nextTeam > 100) { if (key === 'individual') nextTeam = 100 - nextInd; else nextInd = 100 - nextTeam; }
      return { individual: nextInd, team: nextTeam, owner: 100 - (nextInd + nextTeam) }
    });
  };

  const handleSavePolicy = async () => {
    setIsSavingPolicy(true);
    const { error } = await supabase.from('shops').update({ ratio_individual: ratios.individual, ratio_team: ratios.team, ratio_owner: ratios.owner }).eq('id', shop.id);
    if (error) alert('保存に失敗しました'); else { alert('報酬ポリシーを更新しました！'); await loadData(true); }
    setIsSavingPolicy(false); setIsPolicyModalOpen(false);
  };

  const handleDeleteStaff = async (staffId: string, staffName: string) => {
    if (!confirm(`スタッフ「${staffName}」を非表示にしますか？`)) return
    await supabase.from('staffs').update({ is_deleted: true }).eq('id', staffId)
    setDetailStaff(null); await loadData(true)
  }

  const handleToggleTeamEligibility = async () => {
    if (!detailStaff) return;
    const currentVal = detailStaff.is_team_pool_eligible !== false;
    const newVal = !currentVal;
    setDetailStaff({ ...detailStaff, is_team_pool_eligible: newVal });
    const { error } = await supabase.from('staffs').update({ is_team_pool_eligible: newVal }).eq('id', detailStaff.id);
    if (!error) {
      await loadData(true); 
    } else {
      alert('設定の変更に失敗しました。');
      setDetailStaff({ ...detailStaff, is_team_pool_eligible: currentVal });
    }
  }

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleUpdateEmail = async () => {
    if (!newOwnerEmail) return
    setIsUpdatingAuth(true); setAuthMessage(null)
    const { error } = await supabase.auth.updateUser({ email: newOwnerEmail })
    if (error) setAuthMessage({ type: 'error', text: '変更に失敗: ' + error.message })
    else { setAuthMessage({ type: 'success', text: '確認メールを送信しました。' }); setNewOwnerEmail('') }
    setIsUpdatingAuth(false)
  }

  const handleUpdatePassword = async () => {
    if (newOwnerPassword.length < 6) { setAuthMessage({ type: 'error', text: '6文字以上で入力してください。' }); return }
    setIsUpdatingAuth(true); setAuthMessage(null)
    const { error } = await supabase.auth.updateUser({ password: newOwnerPassword })
    if (error) setAuthMessage({ type: 'error', text: '変更に失敗: ' + error.message })
    else { setAuthMessage({ type: 'success', text: '変更を完了しました。' }); setNewOwnerPassword('') }
    setIsUpdatingAuth(false)
  }

  const handleLogout = () => {
    supabase.auth.signOut().then(() => router.push('/login'))
  }

  useEffect(() => { loadData() }, [router])

  // ★ リアルタイム監視設定 (Supabase Realtime)
  useEffect(() => {
    if (!shop?.id) return;

    const channel = supabase
      .channel('dashboard-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'referrals', filter: `shop_id=eq.${shop.id}` },
        () => {
          console.log('🔄 Dashboard: referrals updated - reloading data...');
          loadData(true);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'point_transactions', filter: `shop_id=eq.${shop.id}` },
        () => {
          console.log('🔄 Dashboard: point_transactions updated - reloading data...');
          loadData(true);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'staffs', filter: `shop_id=eq.${shop.id}` },
        () => {
          console.log('🔄 Dashboard: staffs updated - reloading data...');
          loadData(true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [shop?.id]);

  const filteredHistory = useMemo(() => {
    return referralHistory.filter(item => {
      if (filterStatus === '') return true;
      if (item.type === 'staff_added' && filterStatus !== '') return false;
      return item.status === filterStatus;
    })
  }, [referralHistory, filterStatus])

  const pendingReferrals = useMemo(() => {
    return referralHistory.filter(r => r.type === 'referral' && r.status === 'pending')
  }, [referralHistory])
  
  const ownerStaff = staffs.find(s => s.isOwner);
  const inviteUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/reg/${shop?.invite_token}`;
  const inviteText = `【${shop?.name || '店舗'}】Duacel紹介システムへの招待です。以下のURLからスタッフ登録を完了してください。\n\n${inviteUrl}`;

  const policyEditorJSX = (
    <div className="space-y-4 mb-8">
      <div className="grid grid-cols-1 gap-2">
        {POLICY_PATTERNS.map(pattern => (
          <button 
            key={pattern.id} onClick={() => handlePatternSelect(pattern.id)}
            className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all duration-200 outline-none ${selectedPattern === pattern.id ? 'bg-gray-900 border-gray-900 text-white' : 'bg-white border-gray-200 text-gray-700 hover:border-gray-400'}`}
          >
            <div className={`flex-1 flex flex-col justify-center ${selectedPattern === pattern.id ? 'text-white' : 'text-gray-900'}`}>
              <div className="flex items-center gap-2 mb-0.5">
                <span className={selectedPattern === pattern.id ? 'text-white' : 'text-gray-400'}>{pattern.icon}</span>
                <h4 className="text-sm font-semibold">{pattern.label}</h4>
              </div>
              <p className={`text-[10px] ${selectedPattern === pattern.id ? 'text-gray-300' : 'text-gray-500'}`}>{pattern.desc}</p>
            </div>
            {selectedPattern === pattern.id && <CheckCircle2 className="w-4 h-4 text-white shrink-0" />}
          </button>
        ))}
      </div>

      <AnimatePresence>
        {selectedPattern === 'custom' && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-4 overflow-hidden">
            <div>
              <div className="flex justify-between items-end mb-2">
                <label className="text-xs font-semibold text-gray-700">本人へ還元</label>
                <span className="text-lg font-mono text-gray-900">{ratios.individual}%</span>
              </div>
              <input type="range" min="0" max="100" step="5" value={ratios.individual} onChange={(e) => handleSliderChange('individual', parseInt(e.target.value))} className="w-full h-1.5 bg-gray-200 rounded-full appearance-none accent-gray-900" />
            </div>
            <div>
              <div className="flex justify-between items-end mb-2">
                <label className="text-xs font-semibold text-gray-700">チーム分配</label>
                <span className="text-lg font-mono text-gray-900">{ratios.team}%</span>
              </div>
              <input type="range" min="0" max="100" step="5" value={ratios.team} onChange={(e) => handleSliderChange('team', parseInt(e.target.value))} className="w-full h-1.5 bg-gray-200 rounded-full appearance-none accent-gray-900" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="p-4 bg-gray-100 rounded-xl border border-gray-200 flex flex-col gap-2">
        <p className="text-[10px] font-bold text-gray-500">変更後の分配シミュレーション</p>
        <div className="flex h-2 w-full rounded-full overflow-hidden bg-gray-300">
          <div style={{width: `${ratios.individual}%`}} className="bg-gray-900 transition-all duration-300" />
          <div style={{width: `${ratios.team}%`}} className="bg-gray-500 transition-all duration-300" />
          <div style={{width: `${ratios.owner}%`}} className="bg-gray-300 transition-all duration-300" />
        </div>
        <div className="flex justify-between text-[10px] font-semibold mt-1 text-gray-600">
          <span className="flex items-center gap-1"><User className="w-2.5 h-2.5"/> 本人 {ratios.individual}%</span>
          <span className="flex items-center gap-1"><Handshake className="w-2.5 h-2.5"/> チーム {ratios.team}%</span>
          <span className="flex items-center gap-1"><Store className="w-2.5 h-2.5"/> 店舗 {ratios.owner}%</span>
        </div>
      </div>
    </div>
  )

  if (loading) return <div className="fixed inset-0 flex items-center justify-center bg-white"><Loader2 className="w-6 h-6 animate-spin text-gray-900" /></div>
  if (!shop) return <div className="fixed inset-0 flex items-center justify-center bg-white text-gray-500 text-sm">店舗情報が見つかりません。</div>

  return (
    <div className="fixed inset-0 bg-gray-100 flex justify-center font-sans text-gray-900">
      <div className="w-full max-w-md bg-white h-full relative shadow-2xl flex flex-col overflow-hidden">
        
        <header className="px-5 pt-safe-top pb-4 flex items-center justify-between border-b border-gray-100 bg-white/90 backdrop-blur-md z-20 shadow-sm">
          <div>
            <p className="text-[9px] font-bold text-indigo-600 tracking-wider mb-1">Duacel紹介システム管理画面</p>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black text-gray-900">{shop.name}</h1>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-700 flex items-center gap-1"><Crown className="w-2.5 h-2.5"/> {category?.label || '未設定'}</span>
            </div>
            <p className="text-[10px] font-semibold text-gray-500 mt-1 flex items-center gap-1"><ShieldCheck className="w-3 h-3"/> 管理者: {ownerStaff?.name || '読込中'}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <button onClick={handleLogout} className="p-2 text-gray-400 hover:text-gray-900 transition-colors bg-gray-50 hover:bg-gray-100 rounded-full active:scale-95">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto pb-6 bg-gray-50/30">
          
          {/* =========================================
              📊 STATS (ホーム)
          ========================================= */}
          {activeTab === 'stats' && (
            <div className="p-5 animate-in fade-in duration-300 space-y-6">
              
              {ownerStaff?.secret_token && (
                <button 
                  onClick={() => window.open(`/m/${ownerStaff.secret_token}`, '_blank')} 
                  className="w-full p-5 bg-gradient-to-r from-gray-900 to-gray-800 text-white rounded-2xl shadow-md flex items-center justify-between active:scale-95 transition-transform"
                >
                  <div className="text-left">
                    <h2 className="text-sm font-bold flex items-center gap-2"><QrCode className="w-4 h-4"/> マイページを開く</h2>
                    <p className="text-[10px] text-gray-300 mt-1 leading-tight">お客様にお見せするQRコードや<br/>あなた個人の実績はこちらから確認できます</p>
                  </div>
                  <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center shrink-0">
                    <LinkIcon className="w-4 h-4 text-white" />
                  </div>
                </button>
              )}

              {/* Pickup News (仮計上アラート詳細版) */}
              {pendingReferrals.length > 0 && (
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="bg-white p-1.5 rounded-full shadow-sm shrink-0">
                      <Sparkles className="w-4 h-4 text-amber-500" />
                    </div>
                    <h3 className="text-xs font-bold text-amber-900">
                      🎉 {pendingReferrals.length}件の新しい購入（仮計上）が発生しました！
                    </h3>
                  </div>
                  
                  <div className="space-y-2 mb-3">
                    {pendingReferrals.slice(0, 3).map((item) => (
                      <div key={item.id} className="bg-white/80 p-3 rounded-xl border border-amber-100 shadow-sm">
                        <div className="flex justify-between items-start mb-1.5">
                          <p className="text-[10px] font-bold text-gray-900">{item.customer_name || '匿名のお客様'} <span className="font-normal text-gray-500 text-[9px] ml-1">の{item.recurring_count > 1 ? `定期${item.recurring_count}回目` : '初回購入'}</span></p>
                          <span className="text-[8px] text-gray-500">
                            {new Date(item.created_at).toLocaleDateString('ja-JP')} {new Date(item.created_at).toLocaleTimeString('ja-JP', {hour:'2-digit', minute:'2-digit'})}
                          </span>
                        </div>
                        <div className="flex items-end justify-between">
                          <p className="text-[9px] font-semibold text-amber-700 bg-amber-100/50 px-1.5 py-0.5 rounded flex items-center gap-1">
                            <User className="w-2.5 h-2.5" /> 紹介者: {item.staffName}
                          </p>
                          <p className="text-xs font-mono font-bold text-amber-600">
                            予定: +{item.totalGenerated.toLocaleString()}<span className="text-[9px] font-sans ml-0.5">pt</span>
                          </p>
                        </div>
                      </div>
                    ))}
                    {pendingReferrals.length > 3 && (
                      <p className="text-[10px] text-center text-amber-600 font-semibold pt-1">
                        他 {pendingReferrals.length - 3} 件の仮計上があります
                      </p>
                    )}
                  </div>

                  <p className="text-[10px] text-amber-800/80 leading-relaxed font-medium">
                    <Info className="w-3 h-3 inline mr-1 -mt-0.5" />
                    現在はお届け待ちです。お客様へのお届けが完了すると、自動的にポイントが確定し、スタッフと店舗へ分配されます。
                  </p>
                </div>
              )}

              {/* 店舗全体のポイントサマリー */}
              <div className="bg-gray-900 text-white p-5 rounded-2xl shadow-sm relative overflow-hidden">
                <div className="absolute right-0 top-0 p-4 opacity-5"><Wallet className="w-32 h-32 text-white -mt-4 -mr-4" /></div>
                <div className="relative z-10">
                  <p className="text-[10px] font-bold text-gray-400 mb-1">店舗全体の累計総発生額</p>
                  <p className="text-3xl font-mono font-black tracking-tight mb-5">{summary.storeTotalGenerated?.toLocaleString() || 0}<span className="text-xs ml-1 text-gray-400 font-sans">pt</span></p>
                  
                  <div className="grid grid-cols-3 gap-3 pt-4 border-t border-gray-800">
                    <div>
                      <p className="text-[9px] font-bold text-gray-400 mb-0.5 flex items-center gap-1"><User className="w-3 h-3"/> 本人還元</p>
                      <p className="text-sm font-mono font-bold text-gray-200">{summary.storeTotalIndividual?.toLocaleString() || 0}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-gray-400 mb-0.5 flex items-center gap-1"><Handshake className="w-3 h-3"/> チーム分配</p>
                      <p className="text-sm font-mono font-bold text-gray-200">{summary.storeTotalTeam?.toLocaleString() || 0}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-indigo-300 mb-0.5 flex items-center gap-1"><Store className="w-3 h-3"/> 店舗留保</p>
                      <p className="text-sm font-mono font-bold text-indigo-400">{summary.storeTotalOwner?.toLocaleString() || 0}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-xs font-bold text-gray-900 flex items-center gap-1.5"><Percent className="w-4 h-4 text-gray-400" /> 現在の分配ポリシー</h3>
                  <button onClick={() => setIsPolicyModalOpen(true)} className="text-[10px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded-md transition">変更する</button>
                </div>
                <div className="flex h-1.5 w-full rounded-full overflow-hidden bg-gray-100 mb-2">
                  <div style={{width: `${ratios.individual}%`}} className="bg-gray-900" />
                  <div style={{width: `${ratios.team}%`}} className="bg-gray-400" />
                  <div style={{width: `${ratios.owner}%`}} className="bg-gray-200" />
                </div>
                <div className="flex justify-between text-[9px] font-semibold text-gray-500">
                  <span className="flex items-center gap-1"><User className="w-2.5 h-2.5"/> 本人 {ratios.individual}%</span>
                  <span className="flex items-center gap-1"><Handshake className="w-2.5 h-2.5"/> チーム {ratios.team}%</span>
                  <span className="flex items-center gap-1"><Store className="w-2.5 h-2.5"/> 店舗 {ratios.owner}%</span>
                </div>
              </div>

              <div className="pt-2">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-sm font-bold flex items-center gap-2"><ClipboardList className="w-4 h-4 text-gray-400" /> アクション・フィード</h2>
                  <div className="flex gap-1 bg-gray-200/50 p-1 rounded-lg">
                    <button onClick={() => setFilterStatus('')} className={`px-2 py-1 text-[10px] font-semibold rounded-md transition-all ${filterStatus === '' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>すべて</button>
                    <button onClick={() => setFilterStatus('pending')} className={`px-2 py-1 text-[10px] font-semibold rounded-md transition-all ${filterStatus === 'pending' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>仮計上</button>
                  </div>
                </div>

                <div className="space-y-3">
                  {filteredHistory.slice(0, visibleCount).map((item) => {
                    if (item.type === 'staff_added') {
                      return (
                        <div key={item.id} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm w-full">
                          <div className="flex justify-between items-start mb-1">
                            <p className="text-[10px] font-bold text-gray-900 flex items-center gap-1.5"><UserPlus className="w-3 h-3 text-blue-500"/> 【メンバー追加】</p>
                            <span className="text-[8px] text-gray-400 whitespace-nowrap ml-2">
                              {new Date(item.created_at).toLocaleDateString('ja-JP', {month:'short', day:'numeric'})}
                            </span>
                          </div>
                          <p className="text-[11px] font-bold text-gray-700 leading-relaxed"><span className="text-gray-900">{item.staffName}</span> さんがシステムに登録されました。</p>
                        </div>
                      )
                    }

                    const isPending = item.status === 'pending';
                    const customerName = item.customer_name || '匿名のお客様';
                    const isRecurring = item.recurring_count > 1;

                    return (
                      <div key={item.id} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm w-full hover:border-gray-300 transition-colors">
                        <div className="flex justify-between items-start mb-1.5">
                          <p className="text-[10px] font-bold text-gray-900 flex items-center gap-1">
                            {isPending ? <Clock className="w-3 h-3 text-amber-500"/> : item.status === 'cancel' ? <Ban className="w-3 h-3 text-red-500"/> : <CheckCircle2 className="w-3 h-3 text-emerald-500"/>}
                            {isPending ? '【仮計上】' : item.status === 'cancel' ? '【無効】' : '【自動分配完了】'}
                            {customerName}の{isRecurring ? `定期${item.recurring_count}回目お届け` : '初回購入'}
                          </p>
                          <span className="text-[8px] text-gray-400 whitespace-nowrap ml-2">
                            {new Date(item.created_at).toLocaleDateString('ja-JP', {month:'short', day:'numeric'})}
                          </span>
                        </div>
                        
                        <div className="flex items-center justify-between mb-3 mt-2">
                          <span className="text-[9px] font-semibold text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded flex items-center gap-1">
                            <User className="w-2.5 h-2.5" /> 紹介者: {item.staffName}
                          </span>
                          <p className={`text-sm font-mono font-bold ${item.status === 'cancel' ? 'line-through text-gray-300' : 'text-gray-900'}`}>
                            総発生: +{item.totalGenerated.toLocaleString()} <span className="text-[9px] font-sans text-gray-500">pt</span>
                          </p>
                        </div>
                        
                        {!isPending && item.status !== 'cancel' ? (
                          <div className="pt-3 mt-3 border-t border-gray-100/80">
                            <div className="flex justify-between text-[10px] mb-1.5">
                              <span className="text-gray-500 flex items-center gap-1"><User className="w-3 h-3"/> 本人還元 ({item.snapshot_ratio_individual}%)</span>
                              <span className="font-mono text-gray-700">+{item.totalIndPart.toLocaleString()}pt</span>
                            </div>
                            <div className="flex justify-between text-[10px] mb-1.5">
                              <span className="text-gray-500 flex items-center gap-1"><Handshake className="w-3 h-3"/> チーム分配 ({item.snapshot_ratio_team}%)</span>
                              <span className="font-mono text-gray-700">+{item.totalTeamPool.toLocaleString()}pt</span>
                            </div>
                            <div className="flex justify-between text-[10px]">
                              <span className="text-gray-500 flex items-center gap-1"><Store className="w-3 h-3"/> 店舗留保 ({item.snapshot_ratio_owner}%)</span>
                              <span className="font-mono font-bold text-indigo-600">+{item.ownerPart.toLocaleString()}pt</span>
                            </div>
                          </div>
                        ) : isPending ? (
                          <p className="text-[9px] text-gray-400 bg-gray-50 p-2 rounded-lg border border-gray-100 mt-2">
                            お届け完了後に {item.snapshot_ratio_individual} : {item.snapshot_ratio_team} : {item.snapshot_ratio_owner} の比率で自動分配されます。
                          </p>
                        ) : null}
                      </div>
                    )
                  })}
                  {filteredHistory.length === 0 && <div className="text-center py-10 text-gray-400 text-xs">データがありません</div>}
                </div>
                
                {filteredHistory.length > visibleCount && (
                  <div className="text-center mt-4">
                    <button onClick={() => setVisibleCount(v => v + 20)} className="px-4 py-2 bg-white border border-gray-200 text-gray-500 text-[10px] font-bold rounded-full hover:bg-gray-50 transition shadow-sm">
                      さらに読み込む
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* =========================================
              🛒 SHOP (仕入れ)
          ========================================= */}
          {activeTab === 'shop' && (
            <div className="p-5 animate-in fade-in duration-300">
              <div className="flex justify-between items-end mb-6">
                <div>
                  <h2 className="text-sm font-bold flex items-center gap-1.5"><Store className="w-4 h-4 text-gray-400" /> 仕入れ・交換</h2>
                  <p className="text-[10px] text-gray-500 mt-1">店舗ポイントで商材をお得に仕入れ</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-gray-400 mb-0.5">利用可能</p>
                  <p className="text-xl font-mono leading-none">{summary.confirmedPoints.toLocaleString()}<span className="text-xs ml-0.5 font-sans text-gray-500">pt</span></p>
                </div>
              </div>

              <div className="space-y-3">
                {MOCK_PRODUCTS.map(product => {
                  const canBuyWithPoint = summary.confirmedPoints >= product.ptPrice;
                  return (
                    <div key={product.id} className="bg-white p-3 rounded-xl border border-gray-100 flex items-center gap-4 hover:border-gray-300 transition-colors">
                      <div className="w-16 h-16 rounded-lg bg-gray-50 flex items-center justify-center shrink-0 border border-gray-100">
                        {product.icon}
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xs font-semibold leading-snug mb-2 text-gray-800">{product.name}</h3>
                        <div className="flex items-end justify-between">
                          <div>
                            <p className="text-[10px] text-gray-400 line-through">通常: ¥{product.price.toLocaleString()}</p>
                            <p className="text-sm font-mono flex items-baseline gap-1">
                              {product.ptPrice.toLocaleString()}<span className="text-[9px] font-sans text-gray-500">pt</span>
                            </p>
                          </div>
                          <button className={`px-4 py-1.5 rounded-md text-[10px] font-bold transition-all ${canBuyWithPoint ? 'bg-gray-900 text-white hover:bg-gray-800' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                            {canBuyWithPoint ? 'ポイント交換' : '通常購入'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* =========================================
              👥 STAFF (メンバー)
          ========================================= */}
          {activeTab === 'staff' && (
            <div className="p-5 flex flex-col items-center max-w-sm mx-auto animate-in fade-in duration-300">
              
              <div className="w-full mb-8">
                <h2 className="text-sm font-bold flex items-center gap-1.5 mb-3"><UserPlus className="w-4 h-4 text-gray-400" /> メンバー招待</h2>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setIsQRModalOpen(true)} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center gap-2 hover:border-gray-300 transition-all active:scale-95">
                    <div className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center text-gray-700"><QrCode className="w-5 h-5" /></div>
                    <span className="text-[10px] font-bold text-gray-700">QRで招待</span>
                  </button>
                  <button onClick={() => window.location.href = `mailto:?subject=${encodeURIComponent(shop?.name + 'からの招待')}&body=${encodeURIComponent(inviteText)}`} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center gap-2 hover:border-gray-300 transition-all active:scale-95">
                    <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center text-blue-600"><Mail className="w-5 h-5" /></div>
                    <span className="text-[10px] font-bold text-gray-700">メールで招待</span>
                  </button>
                  <button onClick={() => window.open(`https://line.me/R/msg/text/?${encodeURIComponent(inviteText)}`, '_blank')} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center gap-2 hover:border-gray-300 transition-all active:scale-95">
                    <div className="w-10 h-10 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600"><MessageCircle className="w-5 h-5" /></div>
                    <span className="text-[10px] font-bold text-gray-700">LINEで招待</span>
                  </button>
                  <button onClick={() => handleCopy(inviteUrl)} className={`bg-white p-4 rounded-2xl border shadow-sm flex flex-col items-center justify-center gap-2 transition-all active:scale-95 ${copied ? 'border-indigo-200 bg-indigo-50' : 'border-gray-100 hover:border-gray-300'}`}>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${copied ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-50 text-gray-700'}`}>
                      {copied ? <CheckCircle2 className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                    </div>
                    <span className={`text-[10px] font-bold ${copied ? 'text-indigo-700' : 'text-gray-700'}`}>{copied ? 'コピー完了' : 'URLをコピー'}</span>
                  </button>
                </div>
              </div>

              <div className="w-full">
                <div className="flex justify-between items-end mb-4">
                  <h2 className="text-sm font-bold flex items-center gap-1.5"><Users className="w-4 h-4 text-gray-400" /> メンバー実績</h2>
                </div>
                <div className="space-y-2">
                  {staffs.filter(s => !s.is_deleted).sort((a, b) => b.count - a.count).map(s => {
                    const isEligible = s.is_team_pool_eligible !== false;
                    return (
                      <div key={s.id} className="bg-white rounded-xl border border-gray-100 p-3 flex items-center justify-between hover:border-gray-300 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 font-semibold text-xs border border-gray-200">
                            {s.name.charAt(0)}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <h3 className="font-semibold text-xs text-gray-900">{s.name}</h3>
                              {s.isOwner && <Crown className="w-3 h-3 text-gray-400" />}
                              {isEligible && <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded text-[8px] font-bold flex items-center gap-0.5"><Handshake className="w-2.5 h-2.5"/> チーム対象</span>}
                            </div>
                            <p className="text-[9px] text-gray-500 mt-0.5">獲得: {s.count}件</p>
                          </div>
                        </div>
                        <button onClick={() => setDetailStaff(s)} className="p-2 text-gray-400 hover:text-gray-900 transition"><Settings className="w-4 h-4" /></button>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* =========================================
              📖 INFO (情報)
          ========================================= */}
          {activeTab === 'info' && (
            <div className="p-5 max-w-md mx-auto animate-in fade-in duration-300">
              <div className="mb-6">
                <h2 className="text-sm font-bold flex items-center gap-1.5"><BookOpen className="w-4 h-4 text-gray-400" /> ドキュメント</h2>
                <p className="text-[10px] text-gray-500 mt-1">運用マニュアルやトークスクリプト</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { icon: <LayoutDashboard className="w-5 h-5"/>, title: '使い方ガイド', desc: 'システムの基本操作' },
                  { icon: <ShoppingBag className="w-5 h-5"/>, title: '製品カタログ', desc: '成分・効果の詳細' },
                  { icon: <MessageCircle className="w-5 h-5"/>, title: 'トーク集', desc: 'お客様への声かけ例' },
                  { icon: <PlayCircle className="w-5 h-5"/>, title: '施術動画', desc: '機器の正しい使い方' },
                ].map((item, i) => (
                  <button key={i} className="bg-white p-4 rounded-2xl border border-gray-100 text-left hover:border-gray-300 transition-all flex flex-col justify-between aspect-square active:scale-95">
                    <div className="w-8 h-8 bg-gray-50 text-gray-600 rounded-md flex items-center justify-center mb-3">{item.icon}</div>
                    <div>
                      <h3 className="text-xs font-semibold text-gray-900 mb-1">{item.title}</h3>
                      <p className="text-[9px] text-gray-500 leading-tight">{item.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* =========================================
              ⚙️ SETTINGS (設定)
          ========================================= */}
          {activeTab === 'settings' && (
            <div className="p-5 space-y-4 animate-in fade-in duration-300">
              <div className="mb-6">
                <h2 className="text-sm font-bold flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-gray-400" /> アカウント設定</h2>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-gray-100 space-y-3">
                <h3 className="text-xs font-semibold flex items-center gap-1.5"><Mail className="w-4 h-4 text-gray-400"/> メールアドレス</h3>
                <p className="text-[10px] text-gray-500 mb-2">{authEmail}</p>
                <input type="email" placeholder="新しいメールアドレス" value={newOwnerEmail} onChange={e => setNewOwnerEmail(e.target.value)} className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-xs outline-none focus:border-gray-400 transition" />
                <button onClick={handleUpdateEmail} disabled={!newOwnerEmail || isUpdatingAuth} className="w-full py-2.5 bg-gray-900 text-white text-xs font-semibold rounded-lg disabled:opacity-50">変更確認メールを送信</button>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-gray-100 space-y-3">
                <h3 className="text-xs font-semibold flex items-center gap-1.5"><Key className="w-4 h-4 text-gray-400"/> パスワード</h3>
                <input type="password" placeholder="新しいパスワード（6文字以上）" value={newOwnerPassword} onChange={e => setNewOwnerPassword(e.target.value)} className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-xs outline-none focus:border-gray-400 transition" />
                <button onClick={handleUpdatePassword} disabled={!newOwnerPassword || isUpdatingAuth} className="w-full py-2.5 bg-gray-900 text-white text-xs font-semibold rounded-lg disabled:opacity-50">パスワードを変更</button>
              </div>

              {authMessage && (
                <div className={`p-3 rounded-lg text-[10px] font-semibold flex items-start gap-1.5 ${authMessage.type === 'success' ? 'bg-gray-100 text-gray-800' : 'bg-red-50 text-red-600'}`}>
                  {authMessage.type === 'success' ? <CheckCircle2 className="w-3 h-3 shrink-0" /> : <Ban className="w-3 h-3 shrink-0" />} {authMessage.text}
                </div>
              )}
            </div>
          )}
        </main>

        {/* ★ ボトムナビゲーション (ダークテーマ) */}
        <nav className="bg-gray-900 border-t border-gray-800 px-1 py-1 flex justify-between items-center z-50 pb-safe shrink-0">
          {[
            { id: 'stats', icon: <LayoutDashboard className="w-5 h-5" />, label: 'Home' },
            { id: 'staff', icon: <Users className="w-5 h-5" />, label: 'Member' },
            { id: 'info', icon: <BookOpen className="w-5 h-5" />, label: 'Guide' },
            { id: 'shop', icon: <Store className="w-5 h-5" />, label: 'Shop' },
            { id: 'settings', icon: <Settings className="w-5 h-5" />, label: 'Setting' },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex flex-col items-center justify-center flex-1 py-2 gap-1 transition-colors ${activeTab === tab.id ? 'text-white' : 'text-gray-400 hover:text-gray-200'}`}>
              <div className={`transition-transform duration-200 ${activeTab === tab.id ? 'scale-110' : 'scale-100'}`}>{tab.icon}</div>
              <span className="text-[8px] font-semibold tracking-wide">{tab.label}</span>
            </button>
          ))}
        </nav>

        {/* モーダル群 */}
        <AnimatePresence>
          {isPolicyModalOpen && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[100] bg-gray-900/40 backdrop-blur-sm flex items-center justify-center p-4">
              <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }} className="bg-white rounded-3xl p-6 w-full shadow-2xl relative max-h-[90vh] overflow-y-auto">
                <button onClick={() => setIsPolicyModalOpen(false)} className="absolute top-4 right-4 p-2 text-gray-400 hover:bg-gray-100 rounded-full"><X className="w-4 h-4" /></button>
                <h3 className="text-sm font-bold text-gray-900 mb-6 flex items-center gap-1.5"><Percent className="w-4 h-4 text-gray-400" /> 分配ポリシーの変更</h3>
                {policyEditorJSX}
                <button onClick={handleSavePolicy} disabled={isSavingPolicy} className="w-full py-3.5 bg-gray-900 text-white text-xs font-semibold rounded-xl active:scale-95 transition">
                  {isSavingPolicy ? <Loader2 className="w-4 h-4 animate-spin mx-auto"/> : "設定を保存する"}
                </button>
              </motion.div>
            </motion.div>
          )}

          {/* ★ QRコード表示用モーダル */}
          {isQRModalOpen && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[100] bg-gray-900/40 backdrop-blur-sm flex flex-col justify-end">
              <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} className="bg-white rounded-t-3xl p-8 w-full shadow-2xl pb-safe max-h-[90vh] overflow-y-auto flex flex-col items-center">
                <div className="w-full flex justify-between items-center mb-6">
                  <h3 className="text-sm font-bold text-gray-900">QRコードで招待</h3>
                  <button onClick={() => setIsQRModalOpen(false)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-full"><X className="w-4 h-4" /></button>
                </div>
                <div className="p-4 bg-white rounded-2xl shadow-sm border border-gray-100 mb-6">
                  <QRCodeCanvas value={inviteUrl} size={200} level="H" fgColor="#111827" />
                </div>
                <p className="text-[10px] font-medium text-gray-500 text-center leading-relaxed">
                  スタッフのスマートフォンでカメラを開き、<br/>このQRコードを読み込んでもらってください。
                </p>
                <button onClick={() => setIsQRModalOpen(false)} className="mt-8 w-full py-3.5 bg-gray-100 text-gray-900 font-bold text-xs rounded-xl hover:bg-gray-200 transition">閉じる</button>
              </motion.div>
            </motion.div>
          )}

          {detailStaff && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[100] bg-gray-900/40 backdrop-blur-sm flex flex-col justify-end">
              <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} className="bg-white rounded-t-3xl p-6 w-full shadow-2xl pb-safe">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-sm font-bold text-gray-900">{detailStaff.name}</h3>
                  <button onClick={() => setDetailStaff(null)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-full"><X className="w-4 h-4" /></button>
                </div>
                
                <div className="mb-6 bg-gray-50 p-4 rounded-xl border border-gray-100 flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-gray-900">チーム分配の対象にする</h4>
                    <p className="text-[9px] text-gray-500 mt-0.5">店舗のチーム売上から分配を受け取る権利</p>
                  </div>
                  <button onClick={handleToggleTeamEligibility} className="transition-transform active:scale-90">
                    {detailStaff.is_team_pool_eligible !== false ? (
                      <ToggleRight className="w-8 h-8 text-emerald-500" />
                    ) : (
                      <ToggleLeft className="w-8 h-8 text-gray-300" />
                    )}
                  </button>
                </div>

                <div className="flex justify-center mb-6">
                  <div className="p-3 bg-white rounded-2xl border border-gray-100 shadow-sm">
                    <QRCodeCanvas value={`${typeof window !== 'undefined' ? window.location.origin : ''}/welcome/${(detailStaff.referral_code || '').toLowerCase()}`} size={120} level="H" fgColor="#111827" />
                  </div>
                </div>

                <div className="space-y-2 mb-6">
                  <button onClick={() => handleCopy(`${typeof window !== 'undefined' ? window.location.origin : ''}/welcome/${(detailStaff.referral_code || '').toLowerCase()}`)} className="w-full py-3 bg-gray-50 text-gray-800 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 active:scale-95 transition">
                    <LinkIcon className="w-3.5 h-3.5 text-gray-400" /> 接客用URLをコピー
                  </button>
                  <button onClick={() => handleCopy(`${typeof window !== 'undefined' ? window.location.origin : ''}/m/${detailStaff.secret_token}`)} className="w-full py-3 bg-gray-50 text-gray-800 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 active:scale-95 transition">
                    <Edit2 className="w-3.5 h-3.5 text-gray-400" /> マイページURLをコピー
                  </button>
                </div>

                {!detailStaff.isOwner && (
                  <button onClick={() => handleDeleteStaff(detailStaff.id, detailStaff.name)} className="w-full py-3 border border-red-100 text-red-500 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 hover:bg-red-50 transition">
                    <Trash2 className="w-3.5 h-3.5" /> アカウントを削除
                  </button>
                )}
              </motion.div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  )
}