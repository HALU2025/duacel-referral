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
  ToggleRight, ToggleLeft, User, UserPlus, ChevronRight
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
    { id: 1, name: 'Duacel スカルプセラム (業務用)', price: 8800, ptPrice: 8000, icon: <Sparkles className="w-6 h-6 text-[#999999]" /> },
    { id: 2, name: '専用導入機器 (Proモデル)', price: 45000, ptPrice: 42000, icon: <ShieldCheck className="w-6 h-6 text-[#999999]" /> },
    { id: 3, name: '店販用パンフレット (100部)', price: 2000, ptPrice: 2000, icon: <BookOpen className="w-6 h-6 text-[#999999]" /> },
  ]

  const getPatternFromRatios = (ind: number, team: number, owner: number) => {
    const match = POLICY_PATTERNS.find(p => p.ratios && p.ratios.individual === ind && p.ratios.team === team && p.ratios.owner === owner)
    return match ? match.id : 'custom'
  }

  const formatDateYMD = (isoString: string) => {
    const d = new Date(isoString);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}/${m}/${day}`;
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

    const ownerStaff = staffList.find(s => s.email === shopData.owner_email);
    const isOwnerEligible = ownerStaff?.is_team_pool_eligible !== false;

    const enrichedReferrals = reversedLogs.map((log, index) => {
      staffCounters[log.staff_id] = (staffCounters[log.staff_id] || 0) + 1;
      const refTxs = pointLogs.filter(tx => tx.referral_id === log.id && (tx.status === 'confirmed' || tx.status === 'paid'));
      
      const isOldest = index === 0;
      const isFirstTime = log.status !== 'cancel' && (refTxs.length > 0 ? refTxs.some(tx => tx.metadata?.is_bonus) : (!shopHasBonusTx && isOldest));
      const basePoints = currentRewardPoints + (isFirstTime && firstBonusEnabled ? firstBonusPoints : 0);
      
      const indRatio = log.snapshot_ratio_individual ?? currentRatios.individual;
      const teamRatio = log.snapshot_ratio_team ?? currentRatios.team;
      const ownerRatio = log.snapshot_ratio_owner ?? currentRatios.owner;

      const totalIndPart = Math.floor(basePoints * (indRatio / 100));
      const totalTeamPool = Math.floor(basePoints * (teamRatio / 100));
      const teamPartPerPerson = totalTeamPool / eligibleStaffCount;
      const ownerPart = Math.floor(basePoints * (ownerRatio / 100));

      const isOwnerAction = ownerStaff?.id === log.staff_id;
      const ownerEarnedPoints = Math.floor((isOwnerAction ? totalIndPart : 0) + (isOwnerEligible ? teamPartPerPerson : 0) + ownerPart);
      
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
        ownerPart
      }
    });

    const staffAddLogs = activeStaffs.filter(s => s.email !== shopData.owner_email).map(s => ({
      id: `staff_add_${s.id}`,
      type: 'staff_added',
      created_at: s.created_at || new Date().toISOString(),
      staffName: s.name,
      status: 'info' 
    }));

    const combinedFeed = [...enrichedReferrals, ...staffAddLogs].sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    setReferralHistory(combinedFeed);

    const staffsWithFinance = staffList.map(s => {
      const isEligible = s.is_team_pool_eligible !== false;
      let pendingPts = 0;
      let unpaidToStaffPts = 0;
      let count = 0;

      enrichedReferrals.forEach(r => {
        if (r.status === 'cancel') return;
        const isMine = r.staff_id === s.id;
        if (isMine) count++;

        const myInd = isMine ? r.totalIndPart : 0;
        const myTeam = isEligible ? (r.totalTeamPool / eligibleStaffCount) : 0;
        const myTotal = Math.floor(myInd + myTeam);

        if (r.status === 'pending') {
          pendingPts += myTotal;
        } else if (r.status === 'issued' && !r.is_staff_rewarded) {
          unpaidToStaffPts += myTotal;
        }
      });

      const isOwner = s.email === shopData.owner_email;
      return { ...s, count, pendingPts, unpaidToStaffPts, hasUnpaid: unpaidToStaffPts > 0, isOwner }
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

  useEffect(() => {
    if (!shop?.id) return;
    const channel = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'referrals', filter: `shop_id=eq.${shop.id}` }, () => loadData(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'point_transactions', filter: `shop_id=eq.${shop.id}` }, () => loadData(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'staffs', filter: `shop_id=eq.${shop.id}` }, () => loadData(true))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
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
            className={`flex items-center gap-3 p-4 border transition-all duration-200 outline-none ${selectedPattern === pattern.id ? 'bg-[#f5f2e6] border-[#1a1a1a]' : 'bg-[#fffef2] border-[#e6e2d3]'}`}
          >
            <div className={`flex-1 flex flex-col justify-center text-left ${selectedPattern === pattern.id ? 'text-[#1a1a1a]' : 'text-[#666666]'}`}>
              <div className="flex items-center gap-2 mb-1">
                <span>{pattern.icon}</span>
                <h4 className="text-sm font-bold">{pattern.label}</h4>
              </div>
              <p className="text-[11px] opacity-80">{pattern.desc}</p>
            </div>
            {selectedPattern === pattern.id && <CheckCircle2 className="w-5 h-5 text-[#1a1a1a] shrink-0" />}
          </button>
        ))}
      </div>

      <AnimatePresence>
        {selectedPattern === 'custom' && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="p-5 bg-[#f5f2e6] border border-[#e6e2d3] space-y-6 overflow-hidden">
            <div>
              <div className="flex justify-between items-end mb-2">
                <label className="text-[11px] text-[#666666]">本人へ還元</label>
                <span className="text-lg font-mono text-[#1a1a1a]">{ratios.individual}%</span>
              </div>
              <input type="range" min="0" max="100" step="5" value={ratios.individual} onChange={(e) => handleSliderChange('individual', parseInt(e.target.value))} className="w-full h-1.5 bg-[#e6e2d3] appearance-none accent-[#1a1a1a]" />
            </div>
            <div>
              <div className="flex justify-between items-end mb-2">
                <label className="text-[11px] text-[#666666]">チーム分配</label>
                <span className="text-lg font-mono text-[#1a1a1a]">{ratios.team}%</span>
              </div>
              <input type="range" min="0" max="100" step="5" value={ratios.team} onChange={(e) => handleSliderChange('team', parseInt(e.target.value))} className="w-full h-1.5 bg-[#e6e2d3] appearance-none accent-[#1a1a1a]" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="p-5 bg-[#fffef2] border border-[#e6e2d3] flex flex-col gap-3">
        <p className="text-[11px] text-[#666666]">変更後の分配シミュレーション</p>
        <div className="flex h-2.5 w-full overflow-hidden bg-[#e6e2d3]">
          <div style={{width: `${ratios.individual}%`}} className="bg-[#1a1a1a] transition-all duration-300" />
          <div style={{width: `${ratios.team}%`}} className="bg-[#666666] transition-all duration-300" />
          <div style={{width: `${ratios.owner}%`}} className="bg-[#999999] transition-all duration-300" />
        </div>
        <div className="flex justify-between text-[11px] mt-1 text-[#666666]">
          <span className="flex items-center gap-1"><User className="w-3 h-3"/> 本人 {ratios.individual}%</span>
          <span className="flex items-center gap-1"><Handshake className="w-3 h-3"/> チーム {ratios.team}%</span>
          <span className="flex items-center gap-1"><Store className="w-3 h-3"/> 店舗 {ratios.owner}%</span>
        </div>
      </div>
    </div>
  )

  if (loading) return <div className="fixed inset-0 flex items-center justify-center bg-[#fffef2]"><Loader2 className="w-8 h-8 animate-spin text-[#1a1a1a]" /></div>
  if (!shop) return <div className="fixed inset-0 flex items-center justify-center bg-[#fffef2] text-[#666666] text-base">店舗情報が見つかりません。</div>

  return (
    <div className="fixed inset-0 bg-[#fffef2] flex justify-center font-sans text-[#333333] overflow-hidden selection:bg-[#e6e2d3] selection:text-[#333333]">
      <div className="w-full max-w-md bg-[#fffef2] h-full relative border-x border-[#e6e2d3] flex flex-col overflow-hidden">
        
        <header className="px-6 pt-safe-top pb-4 pt-6 flex items-start justify-between border-b border-[#e6e2d3] bg-[#fffef2]/90 backdrop-blur-md z-20 shrink-0">
          <div className="flex flex-col items-start gap-2">
            <h1 className="text-base text-[#1a1a1a] font-bold">{shop.name}</h1>
            {category?.label && (
              <span className="px-2 py-1 text-[11px] border border-[#e6e2d3] bg-[#f5f2e6] text-[#666666] tracking-wider flex items-center gap-1">
                <Crown className="w-3 h-3"/> {category.label}
              </span>
            )}
          </div>
          <div className="flex flex-col items-end gap-2 text-right">
            <div className="flex items-baseline gap-1">
              <span className="text-[11px] text-[#999999] tracking-wider font-inter">OWNER:</span>
              <h1 className="text-base text-[#1a1a1a]">{ownerStaff?.name || '読込中'}</h1>
            </div>
            <button onClick={handleLogout} className="p-1 text-[#999999] hover:text-[#333333] transition-colors active:scale-[0.98]">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto pb-6 bg-[#fffef2]">
          
          {/* =========================================
              📊 STATS (ホーム)
          ========================================= */}
          {activeTab === 'stats' && (
            <div className="p-6 animate-in fade-in duration-300 space-y-8">
              
              {ownerStaff?.secret_token && (
                <button 
                  onClick={() => window.open(`/m/${ownerStaff.secret_token}`, '_blank')} 
                  className="w-full py-4 bg-[#1a1a1a] text-[#fffef2] text-sm tracking-widest active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
                >
                  <QrCode className="w-5 h-5"/> マイページ（QR表示）を開く
                </button>
              )}

              {/* 店舗全体のポイントサマリー */}
              <div className="bg-[#f5f2e6] border border-[#e6e2d3] p-6 relative overflow-hidden">
                <p className="text-sm text-[#666666] mb-3 tracking-wider">店舗全体の累計総発生額</p>
                <p className="text-3xl font-mono font-black tracking-tight mb-6 text-[#1a1a1a]">{summary.storeTotalGenerated?.toLocaleString() || 0}<span className="text-base ml-1 text-[#999999] font-sans">pt</span></p>
                
                <div className="grid grid-cols-3 gap-4 pt-5 border-t border-[#e6e2d3]">
                  <div>
                    <p className="text-[11px] text-[#666666] mb-1 flex items-center gap-1"><User className="w-3 h-3"/> 本人還元</p>
                    <p className="text-base font-mono text-[#333333]">{summary.storeTotalIndividual?.toLocaleString() || 0}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-[#666666] mb-1 flex items-center gap-1"><Handshake className="w-3 h-3"/> チーム</p>
                    <p className="text-base font-mono text-[#333333]">{summary.storeTotalTeam?.toLocaleString() || 0}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-[#333333] font-bold mb-1 flex items-center gap-1"><Store className="w-3 h-3"/> 店舗留保</p>
                    <p className="text-base font-mono font-bold text-[#1a1a1a]">{summary.storeTotalOwner?.toLocaleString() || 0}</p>
                  </div>
                </div>
              </div>

              <div className="bg-[#fffef2] p-5 border border-[#e6e2d3]">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-bold text-[#1a1a1a] flex items-center gap-1.5"><Percent className="w-4 h-4 text-[#999999]" /> 現在の分配ポリシー</h3>
                  <button onClick={() => setIsPolicyModalOpen(true)} className="text-[11px] text-[#333333] border border-[#e6e2d3] bg-[#f5f2e6] px-3 py-1 hover:bg-[#e6e2d3] transition">変更する</button>
                </div>
                <div className="flex h-2 w-full bg-[#e6e2d3] mb-3">
                  <div style={{width: `${ratios.individual}%`}} className="bg-[#1a1a1a]" />
                  <div style={{width: `${ratios.team}%`}} className="bg-[#666666]" />
                  <div style={{width: `${ratios.owner}%`}} className="bg-[#999999]" />
                </div>
                <div className="flex justify-between text-[11px] text-[#666666]">
                  <span className="flex items-center gap-1"><User className="w-3 h-3"/> 本人 {ratios.individual}%</span>
                  <span className="flex items-center gap-1"><Handshake className="w-3 h-3"/> チーム {ratios.team}%</span>
                  <span className="flex items-center gap-1"><Store className="w-3 h-3"/> 店舗 {ratios.owner}%</span>
                </div>
              </div>

              <div className="pt-2">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-sm font-bold text-[#1a1a1a] flex items-center gap-1.5"><ClipboardList className="w-4 h-4 text-[#999999]" /> アクション・フィード</h2>
                  <div className="flex gap-2">
                    <button onClick={() => setFilterStatus('')} className={`px-3 py-1 text-[11px] border transition-all ${filterStatus === '' ? 'bg-[#333333] text-[#fffef2] border-[#333333]' : 'bg-[#fffef2] text-[#666666] border-[#e6e2d3]'}`}>すべて</button>
                    <button onClick={() => setFilterStatus('pending')} className={`px-3 py-1 text-[11px] border transition-all ${filterStatus === 'pending' ? 'bg-[#333333] text-[#fffef2] border-[#333333]' : 'bg-[#fffef2] text-[#666666] border-[#e6e2d3]'}`}>仮計上</button>
                  </div>
                </div>

                <div className="space-y-0">
                  {filteredHistory.slice(0, visibleCount).map((item) => {
                    if (item.type === 'staff_added') {
                      return (
                        <div key={item.id} className="w-full text-left bg-transparent border-b border-[#e6e2d3] first:border-t py-4 flex flex-col">
                          <div className="flex justify-between items-start mb-2">
                            <p className="text-[11px] text-[#666666] flex items-center gap-1.5"><UserPlus className="w-4 h-4 text-[#999999]"/> メンバー追加</p>
                            <span className="text-[11px] text-[#999999] tabular-nums leading-none">{formatDateYMD(item.created_at)}</span>
                          </div>
                          <p className="text-sm text-[#333333] leading-relaxed"><span className="font-bold">{item.staffName}</span> さんが登録されました。</p>
                        </div>
                      )
                    }

                    const isPending = item.status === 'pending';
                    const isCanceled = item.status === 'cancel';
                    const customerName = item.customer_name || '匿名のお客様';
                    const isRecurring = item.recurring_count > 1;

                    return (
                      <div key={item.id} className="w-full text-left bg-transparent border-b border-[#e6e2d3] first:border-t py-4">
                        <div className="flex items-start gap-3">
                          <div className="w-[72px] shrink-0 flex flex-col gap-1.5 pt-1">
                            <span className="text-xs text-[#999999] tabular-nums leading-none">{formatDateYMD(item.created_at)}</span>
                            {isPending ? (
                              <span className="text-[11px] bg-[#a24343] text-[#fffef2] border border-[#a24343] px-1 py-1 text-center leading-none">仮計上</span>
                            ) : isCanceled ? (
                              <span className="text-[11px] bg-[#dddddd] text-[#616161] border border-[#cbcbcb] px-1 py-1 text-center leading-none">無効</span>
                            ) : (
                              <span className="text-[11px] bg-[#577859] text-[#fffef2] border border-[#577859] px-1 py-1 text-center leading-none">報酬確定</span>
                            )}
                          </div>
                          <div className="flex-1 flex flex-col">
                            <p className={`text-sm text-[#333333] mb-1 leading-snug ${isCanceled ? 'line-through text-[#999999]' : ''}`}>
                              {customerName} <span className="text-[#999999] text-sm">[{isRecurring ? `定期${item.recurring_count}` : '初回'}]</span>
                            </p>
                            <p className="text-sm text-[#666666] mb-3">担当: {item.staffName}</p>
                            
                            <div className="flex items-end justify-between">
                              <p className="text-[11px] text-[#999999] mb-1">総発生ポイント</p>
                              <p className={`text-lg font-sans tabular-nums ${isCanceled ? 'line-through text-[#999999]' : 'text-[#1a1a1a]'}`}>
                                {item.totalGenerated.toLocaleString()} <span className="text-[11px] text-[#999999]">pt</span>
                              </p>
                            </div>
                            
                            {!isPending && !isCanceled && (
                              <div className="pt-3 mt-3 border-t border-[#e6e2d3]">
                                <div className="flex justify-between text-[11px] text-[#666666] mb-1.5">
                                  <span>本人還元 ({item.snapshot_ratio_individual}%)</span>
                                  <span className="tabular-nums">+{item.totalIndPart.toLocaleString()}pt</span>
                                </div>
                                <div className="flex justify-between text-[11px] text-[#666666] mb-1.5">
                                  <span>チーム分配 ({item.snapshot_ratio_team}%)</span>
                                  <span className="tabular-nums">+{item.totalTeamPool.toLocaleString()}pt</span>
                                </div>
                                <div className="flex justify-between text-[11px] text-[#333333] font-bold">
                                  <span>店舗留保 ({item.snapshot_ratio_owner}%)</span>
                                  <span className="tabular-nums">+{item.ownerPart.toLocaleString()}pt</span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  {filteredHistory.length === 0 && <div className="text-center py-10 text-[#999999] text-sm">データがありません</div>}
                </div>
                
                {filteredHistory.length > visibleCount && (
                  <div className="text-center mt-6">
                    <button onClick={() => setVisibleCount(v => v + 20)} className="w-full py-4 bg-[#f5f2e6] border border-[#e6e2d3] text-[#333333] text-[11px] font-medium active:scale-[0.98] transition">
                      さらに読み込む
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* =========================================
              👥 STAFF (メンバー)
          ========================================= */}
          {activeTab === 'staff' && (
            <div className="p-6 max-w-md mx-auto animate-in fade-in duration-300 space-y-8">
              
              <div className="w-full">
                <h2 className="text-sm font-bold flex items-center gap-1.5 mb-4 text-[#1a1a1a]"><UserPlus className="w-4 h-4 text-[#999999]" /> メンバー招待</h2>
                <div className="grid grid-cols-2 gap-4">
                  <button onClick={() => setIsQRModalOpen(true)} className="bg-[#fffef2] p-5 border border-[#e6e2d3] flex flex-col items-center justify-center gap-3 hover:bg-[#f5f2e6] transition-all active:scale-[0.98]">
                    <QrCode className="w-6 h-6 text-[#333333]" strokeWidth={1.5} />
                    <span className="text-[11px] text-[#666666]">QRで招待</span>
                  </button>
                  <button onClick={() => window.location.href = `mailto:?subject=${encodeURIComponent(shop?.name + 'からの招待')}&body=${encodeURIComponent(inviteText)}`} className="bg-[#fffef2] p-5 border border-[#e6e2d3] flex flex-col items-center justify-center gap-3 hover:bg-[#f5f2e6] transition-all active:scale-[0.98]">
                    <Mail className="w-6 h-6 text-[#333333]" strokeWidth={1.5} />
                    <span className="text-[11px] text-[#666666]">メールで招待</span>
                  </button>
                  <button onClick={() => window.open(`https://line.me/R/msg/text/?${encodeURIComponent(inviteText)}`, '_blank')} className="bg-[#fffef2] p-5 border border-[#e6e2d3] flex flex-col items-center justify-center gap-3 hover:bg-[#f5f2e6] transition-all active:scale-[0.98]">
                    <MessageCircle className="w-6 h-6 text-[#333333]" strokeWidth={1.5} />
                    <span className="text-[11px] text-[#666666]">LINEで招待</span>
                  </button>
                  <button onClick={() => handleCopy(inviteUrl)} className={`bg-[#fffef2] p-5 border flex flex-col items-center justify-center gap-3 transition-all active:scale-[0.98] ${copied ? 'border-[#333333] bg-[#f5f2e6]' : 'border-[#e6e2d3] hover:bg-[#f5f2e6]'}`}>
                    {copied ? <CheckCircle2 className="w-6 h-6 text-[#333333]" strokeWidth={1.5} /> : <Copy className="w-6 h-6 text-[#333333]" strokeWidth={1.5} />}
                    <span className={`text-[11px] ${copied ? 'text-[#1a1a1a]' : 'text-[#666666]'}`}>{copied ? 'コピー完了' : 'URLをコピー'}</span>
                  </button>
                </div>
              </div>

              <div className="w-full pt-4">
                <h2 className="text-sm font-bold flex items-center gap-1.5 mb-4 text-[#1a1a1a]"><Users className="w-4 h-4 text-[#999999]" /> メンバー実績</h2>
                <div className="space-y-0">
                  {staffs.filter(s => !s.is_deleted).sort((a, b) => b.count - a.count).map(s => {
                    const isEligible = s.is_team_pool_eligible !== false;
                    return (
                      <div key={s.id} className="bg-transparent border-b border-[#e6e2d3] first:border-t py-4 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-none bg-[#f5f2e6] flex items-center justify-center text-[#333333] text-sm">
                            {s.name.charAt(0)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-medium text-sm text-[#1a1a1a]">{s.name}</h3>
                              {s.isOwner && <span className="px-1.5 py-0.5 border border-[#e6e2d3] bg-[#fffef2] text-[#999999] text-[11px] uppercase tracking-wider">Owner</span>}
                              {isEligible && <span className="px-1.5 py-0.5 border border-[#e6e2d3] bg-[#f5f2e6] text-[#666666] text-[11px] uppercase tracking-wider flex items-center gap-1"><Handshake className="w-2.5 h-2.5"/> Team</span>}
                            </div>
                            <p className="text-[11px] text-[#666666]">獲得: <span className="tabular-nums font-mono">{s.count}</span> 件</p>
                          </div>
                        </div>
                        <button onClick={() => setDetailStaff(s)} className="p-3 text-[#999999] hover:text-[#333333] transition"><Settings className="w-5 h-5" strokeWidth={1.5} /></button>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* =========================================
              ⚙️ SETTINGS (設定)
          ========================================= */}
          {activeTab === 'settings' && (
            <div className="p-6 max-w-md mx-auto space-y-6 animate-in fade-in duration-300">
              <h2 className="text-sm font-bold flex items-center gap-1.5 mb-6 text-[#1a1a1a]"><ShieldCheck className="w-4 h-4 text-[#999999]" /> アカウント設定</h2>

              <div className="bg-[#fffef2] p-6 border border-[#e6e2d3] space-y-4">
                <h3 className="text-xs font-bold text-[#333333] flex items-center gap-1.5 uppercase tracking-wider"><Mail className="w-4 h-4 text-[#999999]"/> Email</h3>
                <p className="text-sm text-[#666666] mb-3">{authEmail}</p>
                <input type="email" placeholder="新しいメールアドレス" value={newOwnerEmail} onChange={e => setNewOwnerEmail(e.target.value)} className="w-full px-4 py-3 bg-[#f5f2e6] border-none text-[#333333] text-sm outline-none focus:ring-1 focus:ring-[#333333]" />
                <button onClick={handleUpdateEmail} disabled={!newOwnerEmail || isUpdatingAuth} className="w-full py-4 bg-[#1a1a1a] text-[#fffef2] text-[11px] uppercase tracking-widest disabled:opacity-50 active:scale-[0.98] transition">変更確認メールを送信</button>
              </div>

              <div className="bg-[#fffef2] p-6 border border-[#e6e2d3] space-y-4">
                <h3 className="text-xs font-bold text-[#333333] flex items-center gap-1.5 uppercase tracking-wider"><Key className="w-4 h-4 text-[#999999]"/> Password</h3>
                <input type="password" placeholder="新しいパスワード（6文字以上）" value={newOwnerPassword} onChange={e => setNewOwnerPassword(e.target.value)} className="w-full px-4 py-3 bg-[#f5f2e6] border-none text-[#333333] text-sm outline-none focus:ring-1 focus:ring-[#333333]" />
                <button onClick={handleUpdatePassword} disabled={!newOwnerPassword || isUpdatingAuth} className="w-full py-4 bg-[#1a1a1a] text-[#fffef2] text-[11px] uppercase tracking-widest disabled:opacity-50 active:scale-[0.98] transition">パスワードを変更</button>
              </div>

              {authMessage && (
                <div className={`p-4 text-sm flex items-start gap-2 whitespace-pre-wrap ${authMessage.type === 'success' ? 'bg-[#f4f8f4] text-[#2d5a2d]' : 'bg-[#fcf0f0] text-[#8a3c3c]'}`}>
                  {authMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <Ban className="w-4 h-4 shrink-0" />} {authMessage.text}
                </div>
              )}
            </div>
          )}
        </main>

        {/* ★ ボトムナビゲーション */}
        <nav className="bg-[#1a1a1a] px-2 py-4 flex justify-between items-center z-50 pb-safe relative shrink-0">
          {[
            { id: 'stats', icon: <LayoutDashboard className="w-6 h-6" strokeWidth={1.5} />, label: 'HOME' },
            { id: 'staff', icon: <Users className="w-6 h-6" strokeWidth={1.5} />, label: 'MEMBER' },
            { id: 'info', icon: <BookOpen className="w-6 h-6" strokeWidth={1.5} />, label: 'GUIDE' },
            { id: 'shop', icon: <Store className="w-6 h-6" strokeWidth={1.5} />, label: 'SHOP' },
            { id: 'settings', icon: <Settings className="w-6 h-6" strokeWidth={1.5} />, label: 'SETTING' },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex flex-col items-center justify-center flex-1 gap-1.5 transition-colors ${activeTab === tab.id ? 'text-[#fffef2]' : 'text-[#666666] hover:text-[#999999]'}`}>
              {tab.icon}
              <span className="text-[11px] tracking-wider">{tab.label}</span>
            </button>
          ))}
        </nav>

        {/* モーダル群 */}
        <AnimatePresence>
          {isPolicyModalOpen && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[100] bg-[#1a1a1a]/60 backdrop-blur-sm flex items-center justify-center p-4">
              <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }} className="bg-[#fffef2] p-8 w-full max-w-md mx-auto relative overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.2)]">
                <button onClick={() => setIsPolicyModalOpen(false)} className="absolute top-4 right-4 p-3 text-[#999999] hover:text-[#333333]"><X className="w-6 h-6" strokeWidth={1.5} /></button>
                <h3 className="text-base text-[#1a1a1a] mb-6 flex items-center gap-1.5"><Percent className="w-5 h-5 text-[#999999]" /> 分配ポリシーの変更</h3>
                {policyEditorJSX}
                <button onClick={handleSavePolicy} disabled={isSavingPolicy} className="w-full py-5 bg-[#1a1a1a] text-[#fffef2] text-sm uppercase tracking-widest transition-all active:scale-[0.98] flex justify-center items-center gap-2">
                  {isSavingPolicy ? <Loader2 className="w-5 h-5 animate-spin mx-auto"/> : "設定を保存する"}
                </button>
              </motion.div>
            </motion.div>
          )}

          {isQRModalOpen && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[100] bg-[#1a1a1a]/60 backdrop-blur-sm flex flex-col justify-end p-4 sm:p-6">
              <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'tween', duration: 0.3 }} className="bg-[#fffef2] p-8 w-full max-w-md mx-auto relative overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.2)] flex flex-col items-center">
                <div className="w-full flex justify-between items-center mb-8">
                  <h3 className="text-base text-[#1a1a1a]">QRコードで招待</h3>
                  <button onClick={() => setIsQRModalOpen(false)} className="p-2 text-[#999999] hover:text-[#333333] -mr-2"><X className="w-6 h-6" strokeWidth={1.5} /></button>
                </div>
                <div className="p-6 bg-white border border-[#e6e2d3] mb-6">
                  <QRCodeCanvas value={inviteUrl} size={200} level="H" fgColor="#1a1a1a" />
                </div>
                <p className="text-[11px] text-[#666666] text-center leading-relaxed">
                  スタッフのスマートフォンでカメラを開き、<br/>このQRコードを読み込んでもらってください。
                </p>
                <button onClick={() => setIsQRModalOpen(false)} className="mt-8 w-full py-4 bg-[#f5f2e6] text-[#333333] text-sm font-bold transition-all active:scale-[0.98]">閉じる</button>
              </motion.div>
            </motion.div>
          )}

          {detailStaff && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[100] bg-[#1a1a1a]/60 backdrop-blur-sm flex flex-col justify-end p-4 sm:p-6">
              <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'tween', duration: 0.3 }} className="bg-[#fffef2] p-8 w-full max-w-md mx-auto relative overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.2)]">
                <div className="flex justify-between items-center mb-8">
                  <h3 className="text-lg text-[#1a1a1a]">{detailStaff.name}</h3>
                  <button onClick={() => setDetailStaff(null)} className="p-2 text-[#999999] hover:text-[#333333] -mr-2"><X className="w-6 h-6" strokeWidth={1.5} /></button>
                </div>
                
                <div className="mb-8 bg-[#f5f2e6] p-5 border border-[#e6e2d3] flex items-center justify-between">
                  <div>
                    <h4 className="text-sm text-[#1a1a1a] mb-1">チーム分配の対象にする</h4>
                    <p className="text-[11px] text-[#666666]">店舗のチーム売上から分配を受け取る権利</p>
                  </div>
                  <button onClick={handleToggleTeamEligibility} className="transition-transform active:scale-90 ml-4">
                    {detailStaff.is_team_pool_eligible !== false ? (
                      <ToggleRight className="w-10 h-10 text-[#333333]" strokeWidth={1.5} />
                    ) : (
                      <ToggleLeft className="w-10 h-10 text-[#999999]" strokeWidth={1.5} />
                    )}
                  </button>
                </div>

                <div className="flex justify-center mb-8">
                  <div className="p-4 bg-white border border-[#e6e2d3]">
                    <QRCodeCanvas value={`${typeof window !== 'undefined' ? window.location.origin : ''}/welcome/${detailStaff.referral_code || ''}`} size={140} level="H" fgColor="#1a1a1a" />
                  </div>
                </div>

                <div className="space-y-3 mb-8">
                  <button onClick={() => handleCopy(`${typeof window !== 'undefined' ? window.location.origin : ''}/welcome/${detailStaff.referral_code || ''}`)} className="w-full py-4 bg-[#f5f2e6] text-[#333333] text-[11px] tracking-widest uppercase flex items-center justify-center gap-2 active:scale-[0.98] transition">
                    <LinkIcon className="w-4 h-4 text-[#999999]" /> 接客用URLをコピー
                  </button>
                  <button onClick={() => handleCopy(`${typeof window !== 'undefined' ? window.location.origin : ''}/m/${detailStaff.secret_token}`)} className="w-full py-4 bg-[#f5f2e6] text-[#333333] text-[11px] tracking-widest uppercase flex items-center justify-center gap-2 active:scale-[0.98] transition">
                    <Edit2 className="w-4 h-4 text-[#999999]" /> マイページURLをコピー
                  </button>
                </div>

                {!detailStaff.isOwner && (
                  <button onClick={() => handleDeleteStaff(detailStaff.id, detailStaff.name)} className="w-full py-4 border border-[#fcf0f0] text-[#8a3c3c] text-sm flex items-center justify-center gap-2 hover:bg-[#fcf0f0] transition">
                    <Trash2 className="w-4 h-4" /> アカウントを削除
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