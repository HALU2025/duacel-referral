'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { QRCodeCanvas } from 'qrcode.react'
import { motion, AnimatePresence } from 'framer-motion'

import { 
  LogOut, Clock, CheckCircle2, Wallet, Users, Plus, Crown, Settings, 
  Link as LinkIcon, QrCode, Trash2, Coins, Smartphone, ClipboardList, 
  X, Ban, Trophy, Calendar, LayoutDashboard, Share, Edit2, Loader2, 
  Mail, Key, ShieldCheck, Store, BookOpen, Sparkles, PlayCircle, 
  MessageCircle, Info, Copy, ShoppingBag, ThumbsUp, Handshake, Percent
} from 'lucide-react'

const generateSecureToken = () => {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

const POLICY_PATTERNS = [
  { id: 'pattern1', icon: <ThumbsUp className="w-4 h-4" />, label: 'スタッフ全力還元', desc: '個人のモチベーションを最大化', ratios: { individual: 100, team: 0, owner: 0 } },
  { id: 'pattern2', icon: <Handshake className="w-4 h-4" />, label: 'チームワーク重視', desc: '店舗全体の協力体制をつくる', ratios: { individual: 70, team: 30, owner: 0 } },
  { id: 'pattern3', icon: <Store className="w-4 h-4" />, label: '店舗還元ミックス', desc: '販促・仕入れ費として店舗にも還元', ratios: { individual: 60, team: 20, owner: 20 } },
  { id: 'custom', icon: <Settings className="w-4 h-4" />, label: 'カスタム設定', desc: 'スライダーで自由に配分を調整', ratios: null },
]

export default function OwnerDashboard() {
  const [activeTab, setActiveTab] = useState<'stats' | 'shop' | 'staff' | 'info' | 'settings'>('stats')

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

  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false)
  const [staffModalStep, setStaffModalStep] = useState<'policy' | 'info'>('info') 
  const [newStaffName, setNewStaffName] = useState('')
  const [newStaffEmail, setNewStaffEmail] = useState('')
  
  const [detailStaff, setDetailStaff] = useState<any>(null)
  const [copied, setCopied] = useState(false)

  const [summary, setSummary] = useState({ totalEarned: 0, thisMonthEarned: 0, pendingPoints: 0, confirmedPoints: 0, issuedPoints: 0, rewardedPoints: 0, canceledPoints: 0 })
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

  const loadData = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return; }

    setAuthEmail(user.email || '')

    const { data: shopData } = await supabase.from('shops').select(`*, shop_categories (*), ratio_individual, ratio_team, ratio_owner`).eq('owner_id', user.id).maybeSingle()
    if (!shopData) { setLoading(false); return; }
    
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
    const staffCount = activeStaffs.length || 1;

    const reversedLogs = [...referralLogs].reverse();
    const staffCounters: Record<string, number> = {};
    const shopHasBonusTx = pointLogs.some(tx => tx.metadata?.is_bonus === true);

    const enrichedReferrals = reversedLogs.map((log, index) => {
      staffCounters[log.staff_id] = (staffCounters[log.staff_id] || 0) + 1;
      const refTxs = pointLogs.filter(tx => tx.referral_id === log.id && (tx.status === 'confirmed' || tx.status === 'paid'));
      
      const isOldest = index === 0;
      const isFirstTime = log.status !== 'cancel' && (refTxs.length > 0 ? refTxs.some(tx => tx.metadata?.is_bonus) : (!shopHasBonusTx && isOldest));
      const basePoints = currentRewardPoints + (isFirstTime && firstBonusEnabled ? firstBonusPoints : 0);
      
      // ★ スナップショットがあればそれを優先、なければ現在の比率を使う
      const indRatio = log.snapshot_ratio_individual ?? currentRatios.individual;
      const teamRatio = log.snapshot_ratio_team ?? currentRatios.team;
      const ownerRatio = log.snapshot_ratio_owner ?? currentRatios.owner;

      const indPart = basePoints * (indRatio / 100);
      const teamPart = (basePoints * (teamRatio / 100)) / staffCount;
      const ownerPart = basePoints * (ownerRatio / 100);

      // オーナーが貰えるポイント（店舗留保 ＋ 自分が紹介した場合は個人の取り分も）
      const isOwnerAction = staffList.find(s => s.id === log.staff_id)?.email === shopData.owner_email;
      const ownerEarnedPoints = isOwnerAction ? Math.floor(indPart + teamPart + ownerPart) : Math.floor(teamPart + ownerPart);
      
      const totalPointsInTx = refTxs.reduce((sum, tx) => sum + (Number(tx.points) || 0), 0);
      const hasBonus = refTxs.some(tx => tx.metadata?.is_bonus === true);

      return { 
        ...log, 
        staffName: staffList.find(s => s.id === log.staff_id)?.name || '不明', 
        staffNthCount: staffCounters[log.staff_id], 
        totalGenerated: basePoints, // 発生した総額
        ownerPoints: ownerEarnedPoints, // 店舗に入った額
        hasBonus 
      }
    }).reverse();

    setReferralHistory(enrichedReferrals)

    const staffsWithFinance = staffList.map(s => {
      const staffRefs = enrichedReferrals.filter(r => r.staff_id === s.id);
      const pendingPts = staffRefs.filter(r => r.status === 'pending').reduce((sum, r) => sum + r.ownerPoints, 0); // オーナー視点での計算
      const unpaidToStaffPts = staffRefs.filter(r => r.status === 'issued' && !r.is_staff_rewarded).reduce((sum, r) => sum + r.totalPoints, 0);
      const isOwner = s.email === shopData.owner_email;
      return { ...s, count: staffRefs.filter(r => r.status !== 'cancel').length, pendingPts, unpaidToStaffPts, hasUnpaid: unpaidToStaffPts > 0, isOwner }
    })
    setStaffs(staffsWithFinance)

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const validRefs = enrichedReferrals.filter(r => r.status !== 'cancel');
    const earnedRefs = validRefs.filter(r => r.status === 'issued' || r.is_staff_rewarded || r.status === 'confirmed');

    setSummary({
      totalEarned: earnedRefs.reduce((sum, r) => sum + r.ownerPoints, 0), // オーナーの総獲得
      thisMonthEarned: earnedRefs.filter(r => { const d = new Date(r.created_at); return d.getMonth() === currentMonth && d.getFullYear() === currentYear; }).reduce((sum, r) => sum + r.ownerPoints, 0),
      pendingPoints: validRefs.filter(r => r.status === 'pending').reduce((sum, r) => sum + r.totalGenerated, 0), // パイプラインは総額
      confirmedPoints: validRefs.filter(r => r.status === 'confirmed' || r.status === 'issued').reduce((sum, r) => sum + r.ownerPoints, 0), // ウォレット残高
      issuedPoints: 0, rewardedPoints: 0, canceledPoints: 0
    })
    
    setLoading(false)
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
    if (error) alert('保存に失敗しました'); else { alert('報酬ポリシーを更新しました！'); await loadData(); }
    setIsSavingPolicy(false); setIsPolicyModalOpen(false);
  };

  const handleOpenAddStaff = () => {
    const isFirstStaffAdd = staffs.filter(s => !s.isOwner && !s.is_deleted).length === 0;
    if (isFirstStaffAdd) setStaffModalStep('policy')
    else setStaffModalStep('info')
    setIsStaffModalOpen(true)
  }

  const handleNextStepInWizard = async () => {
    setIsSavingPolicy(true);
    await supabase.from('shops').update({ ratio_individual: ratios.individual, ratio_team: ratios.team, ratio_owner: ratios.owner }).eq('id', shop.id);
    await loadData()
    setIsSavingPolicy(false);
    setStaffModalStep('info')
  }

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newStaffName.trim() || !newStaffEmail.trim()) return alert('名前とメールアドレスを入力してください。');
    const { data: allStaffs } = await supabase.from('staffs').select('id').eq('shop_id', shop.id)
    const maxNum = (allStaffs || []).reduce((max, s) => {
      const num = parseInt(s.id.replace('m', ''), 10)
      return !isNaN(num) && num > max ? num : max
    }, 0)
    const nextStaffId = `m${(maxNum + 1).toString().padStart(2, '0')}`
    const secureToken = generateSecureToken()
    const { error } = await supabase.from('staffs').insert([{ id: nextStaffId, shop_id: shop.id, name: newStaffName, email: newStaffEmail, referral_code: `${shop.id}_${nextStaffId}`, secret_token: secureToken, is_deleted: false }])
    if (error) { alert(`追加に失敗しました。\n${error.message}`); return; }
    setNewStaffName(''); setNewStaffEmail(''); setIsStaffModalOpen(false); await loadData();
  }

  const handleDeleteStaff = async (staffId: string, staffName: string) => {
    if (!confirm(`スタッフ「${staffName}」を非表示にしますか？`)) return
    await supabase.from('staffs').update({ is_deleted: true }).eq('id', staffId)
    setDetailStaff(null); await loadData()
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

  useEffect(() => { loadData() }, [router])

  const filteredHistory = useMemo(() => {
    return referralHistory.filter(item => {
      if (filterStatus === '') return true;
      return item.status === filterStatus;
    })
  }, [referralHistory, filterStatus])
  
  const ownerStaff = staffs.find(s => s.isOwner);

  // ★ ランクの自動計算（モック）
  const shopRank = summary.totalEarned >= 100000 ? 'Platinum Partner' : summary.totalEarned >= 30000 ? 'Gold Partner' : 'Standard Partner'
  const rankColor = summary.totalEarned >= 100000 ? 'text-slate-700 bg-slate-100' : summary.totalEarned >= 30000 ? 'text-amber-700 bg-amber-100' : 'text-gray-600 bg-gray-100'

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
        <p className="text-[10px] font-bold text-gray-500">分配シミュレーション</p>
        <div className="flex h-2 w-full rounded-full overflow-hidden bg-gray-300">
          <div style={{width: `${ratios.individual}%`}} className="bg-gray-900 transition-all duration-300" />
          <div style={{width: `${ratios.team}%`}} className="bg-gray-500 transition-all duration-300" />
          <div style={{width: `${ratios.owner}%`}} className="bg-gray-300 transition-all duration-300" />
        </div>
        <div className="flex justify-between text-[10px] font-semibold mt-1 text-gray-600">
          <span>本人 {ratios.individual}%</span>
          <span>チーム {ratios.team}%</span>
          <span>店舗 {ratios.owner}%</span>
        </div>
      </div>
    </div>
  )

  if (loading) return <div className="fixed inset-0 flex items-center justify-center bg-white"><Loader2 className="w-6 h-6 animate-spin text-gray-900" /></div>
  if (!shop) return <div className="fixed inset-0 flex items-center justify-center bg-white text-gray-500 text-sm">店舗情報が見つかりません。</div>

  return (
    <div className="fixed inset-0 bg-gray-100 flex justify-center font-sans text-gray-900">
      <div className="w-full max-w-md bg-white h-full relative shadow-2xl flex flex-col overflow-hidden">
        
        {/* トップヘッダー（メニューバー） */}
        <header className="px-5 pt-safe-top pb-3 flex justify-between items-end border-b border-gray-100 bg-white/80 backdrop-blur-md z-20">
          <div className="flex items-center gap-3">
            <div>
              <p className="text-[10px] font-semibold text-gray-400 tracking-wider">HQ DASHBOARD</p>
              <h1 className="text-sm font-bold text-gray-900">{shop.name}</h1>
            </div>
            {/* ★ ランクバッジ復活 */}
            <span className={`px-2 py-0.5 rounded-sm text-[9px] font-bold mt-3 ${rankColor}`}>👑 {shopRank}</span>
          </div>
          {/* ★ 手動追加ボタンをヘッダーに配置 */}
          {activeTab === 'staff' && (
            <button onClick={handleOpenAddStaff} className="text-[10px] font-bold px-3 py-1.5 bg-gray-900 text-white rounded-md hover:bg-gray-800 transition active:scale-95 flex items-center gap-1">
              <Plus className="w-3 h-3" /> 手動追加
            </button>
          )}
          {/* ★ 接客マイページリンク復活（Statsタブの時のみ表示などお好みで。ここではホーム時表示） */}
          {activeTab === 'stats' && ownerStaff?.secret_token && (
            <button onClick={() => window.open(`/welcome/${ownerStaff.referral_code}`, '_blank')} className="text-[10px] font-bold text-gray-500 hover:text-gray-900 transition flex items-center gap-1 mt-3">
              接客ページへ <LinkIcon className="w-3 h-3" />
            </button>
          )}
        </header>

        <main className="flex-1 overflow-y-auto pb-6 bg-gray-50/30">
          
          {/* =========================================
              📊 STATS (ホーム: 自動分配のUI)
          ========================================= */}
          {activeTab === 'stats' && (
            <div className="p-5 animate-in fade-in duration-300 space-y-6">
              
              {/* 2つの箱：現在の資産 と 未来の資産 */}
              <div className="space-y-3">
                <div className="bg-gray-900 text-white p-5 rounded-2xl shadow-sm relative overflow-hidden">
                  <div className="absolute right-0 top-0 p-4 opacity-10"><Wallet className="w-16 h-16" /></div>
                  <p className="text-[10px] font-medium text-gray-400 mb-1">💰 仕入れに使える店舗ポイント</p>
                  <p className="text-3xl font-mono tracking-tight">{summary.confirmedPoints.toLocaleString()}<span className="text-xs ml-1 text-gray-400 font-sans">pt</span></p>
                </div>
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-medium text-gray-500 mb-0.5">🚀 確定待ちのパイプライン (店舗総額)</p>
                    <p className="text-lg font-mono tracking-tight text-gray-800">{summary.pendingPoints.toLocaleString()}<span className="text-[10px] ml-1 text-gray-400 font-sans">pt</span></p>
                  </div>
                  <Clock className="w-6 h-6 text-gray-300" />
                </div>
              </div>

              {/* ★ タイムライン型アクションフィード */}
              <div className="pt-2">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-sm font-bold flex items-center gap-2"><ClipboardList className="w-4 h-4 text-gray-400" /> アクション・フィード</h2>
                  <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
                    <button onClick={() => setFilterStatus('')} className={`px-2 py-1 text-[10px] font-semibold rounded-md transition-all ${filterStatus === '' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>すべて</button>
                    <button onClick={() => setFilterStatus('pending')} className={`px-2 py-1 text-[10px] font-semibold rounded-md transition-all ${filterStatus === 'pending' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>仮計上</button>
                  </div>
                </div>

                <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-gray-200 before:to-transparent">
                  {filteredHistory.slice(0, visibleCount).map((item, i) => {
                    const isPending = item.status === 'pending';
                    const dotColor = isPending ? 'bg-amber-400 border-amber-100' : item.status === 'cancel' ? 'bg-red-400 border-red-100' : 'bg-emerald-400 border-emerald-100';
                    const customerName = item.customer_name || '匿名のお客様';
                    const isRecurring = item.recurring_count > 1;

                    return (
                      <div key={item.id} className="relative flex items-start justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                        {/* タイムラインのドット */}
                        <div className={`flex items-center justify-center w-3 h-3 rounded-full border-2 bg-white ${dotColor} absolute left-5 -translate-x-1/2 translate-y-1.5 shadow-sm ring-4 ring-gray-50`}></div>
                        
                        <div className="bg-white p-3.5 rounded-xl border border-gray-100 shadow-sm w-[calc(100%-3rem)] ml-10 hover:border-gray-300 transition-colors">
                          <div className="flex justify-between items-start mb-1.5">
                            <p className="text-[10px] font-bold text-gray-900">
                              {isPending ? '🟡 【仮計上】' : item.status === 'cancel' ? '🔴 【無効】' : '🟢 【自動分配完了】'}
                              {customerName}の{isRecurring ? `定期${item.recurring_count}回目お届け` : '初回購入'}
                            </p>
                            <span className="text-[8px] text-gray-400 whitespace-nowrap ml-2">
                              {new Date(item.created_at).toLocaleDateString('ja-JP', {month:'short', day:'numeric'})}
                            </span>
                          </div>
                          
                          <p className="text-[9px] text-gray-500 mb-2">紹介者: {item.staffName} / 総発生: {item.totalGenerated.toLocaleString()}pt</p>
                          
                          {!isPending && item.status !== 'cancel' ? (
                            <div className="p-2 bg-gray-50 rounded-lg flex justify-between items-center border border-gray-100">
                              <span className="text-[10px] font-semibold text-gray-600">店舗にチャージ</span>
                              <span className="text-sm font-mono text-gray-900">+{item.ownerPoints.toLocaleString()} <span className="text-[9px] font-sans text-gray-500">pt</span></span>
                            </div>
                          ) : isPending ? (
                            <p className="text-[9px] text-gray-400 bg-gray-50 p-2 rounded-lg border border-gray-100">お届け完了後に自動でポイントが分配されます。</p>
                          ) : null}
                        </div>
                      </div>
                    )
                  })}
                  {filteredHistory.length === 0 && <div className="text-center py-10 text-gray-400 text-xs relative z-10">データがありません</div>}
                </div>
                
                {filteredHistory.length > visibleCount && (
                  <div className="text-center mt-4 relative z-10">
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
              <div className="w-full bg-white p-8 rounded-3xl border border-gray-100 flex flex-col items-center mb-6">
                <div className="p-4 bg-white rounded-2xl shadow-sm border border-gray-100 mb-4">
                  <QRCodeCanvas value={`${typeof window !== 'undefined' ? window.location.origin : ''}/reg/${shop?.invite_token}`} size={160} level="H" fgColor="#111827" />
                </div>
                <p className="text-[10px] font-medium text-gray-500 text-center">スタッフにQRを読み込ませて<br/>登録を完了させてください</p>
                <button onClick={() => handleCopy(`${typeof window !== 'undefined' ? window.location.origin : ''}/reg/${shop?.invite_token}`)} className={`mt-6 w-full py-3 rounded-xl font-semibold text-xs transition-all flex items-center justify-center gap-2 ${copied ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'}`}>
                  {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'コピー完了' : '招待用URLをコピー'}
                </button>
              </div>

              <div className="w-full">
                <div className="flex justify-between items-end mb-4">
                  <h2 className="text-sm font-bold flex items-center gap-1.5"><Users className="w-4 h-4 text-gray-400" /> メンバー実績</h2>
                </div>
                <div className="space-y-2">
                  {staffs.filter(s => !s.is_deleted).sort((a, b) => b.count - a.count).map(s => (
                    <div key={s.id} className="bg-white rounded-xl border border-gray-100 p-3 flex items-center justify-between hover:border-gray-300 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 font-semibold text-xs border border-gray-200">
                          {s.name.charAt(0)}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <h3 className="font-semibold text-xs text-gray-900">{s.name}</h3>
                            {s.isOwner && <Crown className="w-3 h-3 text-gray-400" />}
                          </div>
                          <p className="text-[9px] text-gray-500 mt-0.5">獲得: {s.count}件</p>
                        </div>
                      </div>
                      <button onClick={() => setDetailStaff(s)} className="p-2 text-gray-400 hover:text-gray-900 transition"><Settings className="w-4 h-4" /></button>
                    </div>
                  ))}
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

              <button onClick={() => supabase.auth.signOut().then(() => router.push('/login'))} className="w-full py-3 mt-4 bg-white border border-gray-200 text-gray-600 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 hover:bg-gray-50">
                <LogOut className="w-4 h-4" /> ログアウト
              </button>
            </div>
          )}
        </main>

        {/* ボトムナビゲーション */}
        <nav className="bg-white border-t border-gray-200 px-1 py-1 flex justify-between items-center z-50 pb-safe shrink-0">
          {[
            { id: 'stats', icon: <LayoutDashboard className="w-5 h-5" />, label: 'Home' },
            { id: 'shop', icon: <Store className="w-5 h-5" />, label: 'Shop' },
            { id: 'staff', icon: <QrCode className="w-6 h-6" />, label: 'QR', special: true },
            { id: 'info', icon: <BookOpen className="w-5 h-5" />, label: 'Guide' },
            { id: 'settings', icon: <Settings className="w-5 h-5" />, label: 'Config' },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex flex-col items-center justify-center flex-1 py-2 gap-1 transition-colors ${activeTab === tab.id ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}>
              {tab.special ? (
                <div className={`p-3 rounded-full transition-all ${activeTab === tab.id ? 'bg-gray-900 text-white scale-110 shadow-md' : 'bg-gray-100 text-gray-600'}`}>{tab.icon}</div>
              ) : (
                <>
                  <div className={`transition-transform duration-200 ${activeTab === tab.id ? 'scale-110' : 'scale-100'}`}>{tab.icon}</div>
                  <span className="text-[8px] font-semibold tracking-wide">{tab.label}</span>
                </>
              )}
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

          {isStaffModalOpen && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[100] bg-gray-900/40 backdrop-blur-sm flex flex-col justify-end">
              <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} className="bg-white rounded-t-3xl p-6 w-full shadow-2xl pb-safe max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-sm font-bold text-gray-900">{staffModalStep === 'policy' ? '初期設定 (1/2)' : 'メンバー手動追加'}</h3>
                  <button onClick={() => setIsStaffModalOpen(false)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-full"><X className="w-4 h-4" /></button>
                </div>

                {staffModalStep === 'policy' ? (
                  <motion.div key="policy" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
                    <p className="text-[10px] text-gray-500 mb-6">メンバーを追加する前に、紹介ポイントの<strong className="text-gray-900">分配ルール</strong>を決めましょう。（後からいつでも変更できます）</p>
                    {policyEditorJSX}
                    <button onClick={handleNextStepInWizard} disabled={isSavingPolicy} className="w-full py-3.5 bg-gray-900 text-white text-xs font-semibold rounded-xl transition flex items-center justify-center">
                      {isSavingPolicy ? <Loader2 className="w-4 h-4 animate-spin" /> : '次へ進む'}
                    </button>
                  </motion.div>
                ) : (
                  <motion.div key="info" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
                    <form onSubmit={handleAddStaff} className="space-y-4 mb-2">
                      <div>
                        <label className="text-[10px] font-semibold text-gray-500 mb-1 block">お名前</label>
                        <input required placeholder="山田 太郎" value={newStaffName} onChange={e => setNewStaffName(e.target.value)} className="w-full px-3 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:border-gray-400 outline-none transition-colors" />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-gray-500 mb-1 block">メールアドレス</label>
                        <input required type="email" placeholder="example@email.com" value={newStaffEmail} onChange={e => setNewStaffEmail(e.target.value)} className="w-full px-3 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:border-gray-400 outline-none transition-colors" />
                      </div>
                      <button type="submit" className="w-full mt-2 py-3.5 bg-gray-900 text-white text-xs font-semibold rounded-xl transition">メンバーを追加</button>
                    </form>
                  </motion.div>
                )}
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
                
                <div className="flex justify-center mb-6">
                  <div className="p-3 bg-white rounded-2xl border border-gray-100 shadow-sm">
                    <QRCodeCanvas value={`${typeof window !== 'undefined' ? window.location.origin : ''}/welcome/${detailStaff.referral_code}`} size={120} level="H" fgColor="#111827" />
                  </div>
                </div>

                <div className="space-y-2 mb-6">
                  <button onClick={() => handleCopy(`${typeof window !== 'undefined' ? window.location.origin : ''}/welcome/${detailStaff.referral_code}`)} className="w-full py-3 bg-gray-50 text-gray-800 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 active:scale-95 transition">
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