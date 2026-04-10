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
  ToggleRight, ToggleLeft, User, UserPlus, ChevronRight, ShieldAlert, ExternalLink
} from 'lucide-react'

// 分配ポリシーのプリセット
const POLICY_PATTERNS = [
  { id: 'pattern1', icon: <ThumbsUp className="w-4 h-4" />, label: 'スタッフ全力還元', desc: '個人のモチベーションを最大化', ratios: { individual: 100, team: 0, owner: 0 } },
  { id: 'pattern2', icon: <Handshake className="w-4 h-4" />, label: 'チームワーク重視', desc: '店舗全体の協力体制をつくる', ratios: { individual: 70, team: 30, owner: 0 } },
  { id: 'pattern3', icon: <Store className="w-4 h-4" />, label: '店舗還元ミックス', desc: '販促・仕入れ費として店舗にも還元', ratios: { individual: 60, team: 20, owner: 20 } },
  { id: 'custom', icon: <Settings className="w-4 h-4" />, label: 'カスタム設定', desc: '自由に配分を調整', ratios: null },
]

export default function OwnerDashboard() {
  const router = useRouter()
  
  // UI状態
  const [activeTab, setActiveTab] = useState<'stats' | 'staff' | 'info' | 'shop' | 'settings'>('stats')
  const [loading, setLoading] = useState(true)
  const [isUnlocked, setIsUnlocked] = useState(false)
  const [showRoleError, setShowRoleError] = useState(false) 

  // データ状態
  const [shop, setShop] = useState<any>(null)
  const [category, setCategory] = useState<any>(null)
  const [staffs, setStaffs] = useState<any[]>([])
  const [referralHistory, setReferralHistory] = useState<any[]>([])
  const [summary, setSummary] = useState({ 
    totalGenerated: 0, totalIndividual: 0, totalTeam: 0, totalOwner: 0, pendingPoints: 0, pendingCount: 0 
  })

  // 設定・編集用
  const [ratios, setRatios] = useState({ individual: 100, team: 0, owner: 0 })
  const [selectedPattern, setSelectedPattern] = useState<string>('pattern1')
  const [authEmail, setAuthEmail] = useState('')
  const [newOwnerEmail, setNewOwnerEmail] = useState('')
  const [newOwnerPassword, setNewOwnerPassword] = useState('')
  const [isUpdatingAuth, setIsUpdatingAuth] = useState(false)
  const [authMessage, setAuthMessage] = useState<{type: 'success' | 'error', text: string} | null>(null)

  // モーダル制御
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false)
  const [isQRModalOpen, setIsQRModalOpen] = useState(false)
  const [detailStaff, setDetailStaff] = useState<any>(null)
  const [isSavingPolicy, setIsSavingPolicy] = useState(false)
  const [copied, setCopied] = useState(false)

  const MOCK_PRODUCTS = [
    { id: 1, name: 'Duacel スカルプセラム (業務用)', price: 8800, ptPrice: 8000, icon: <Sparkles className="w-6 h-6 text-[#999999]" /> },
    { id: 2, name: '専用導入機器 (Proモデル)', price: 45000, ptPrice: 42000, icon: <ShieldCheck className="w-6 h-6 text-[#999999]" /> },
    { id: 3, name: '店販用パンフレット (100部)', price: 2000, ptPrice: 2000, icon: <BookOpen className="w-6 h-6 text-[#999999]" /> },
  ]

  // データ読み込みロジック
  const loadData = async (silent = false) => {
    if (!silent) setLoading(true)
    
    // 1. ユーザーチェック
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace('/verify'); return; }

    // 2. ★ 権限チェック：Adminセッションが残っていないか？
    const { data: adminData } = await supabase.from('system_admins').select('id').eq('id', user.id).maybeSingle()
    if (adminData) {
      setShowRoleError(true)
      setLoading(false)
      return
    }

    // 3. 店舗取得
    const { data: shopData } = await supabase.from('shops').select(`*, shop_categories (*)`).eq('owner_id', user.id).maybeSingle()
    if (!shopData) {
      // ユーザーはいるが店がない（不整合）場合はログアウトさせて再認証へ
      await supabase.auth.signOut()
      router.replace('/verify')
      return
    }

    setShop(shopData)
    setCategory(shopData.shop_categories)
    setAuthEmail(user.email || '')
    
    const currentRatios = { 
      individual: shopData.ratio_individual ?? 100, 
      team: shopData.ratio_team ?? 0, 
      owner: shopData.ratio_owner ?? 0 
    }
    setRatios(currentRatios)
    setSelectedPattern(getPatternFromRatios(currentRatios.individual, currentRatios.team, currentRatios.owner))
    
    // 4. スタッフ・成果・取引データの取得
    const [staffRes, refRes, txRes] = await Promise.all([
      supabase.from('staffs').select('*').eq('shop_id', shopData.id).eq('is_deleted', false),
      supabase.from('referrals').select('*').eq('shop_id', shopData.id).order('created_at', { ascending: false }),
      supabase.from('point_transactions').select('*').eq('shop_id', shopData.id)
    ])

    const staffList = staffRes.data || []
    const referralLogs = refRes.data || []
    const pointLogs = txRes.data || []
    const eligibleStaffCount = staffList.filter(s => s.is_team_pool_eligible !== false).length || 1

    // 5. 統計・履歴の加工
    const rewardPoints = shopData.shop_categories?.reward_points || 0
    const firstBonusEnabled = shopData.shop_categories?.first_bonus_enabled || false
    const firstBonusPoints = shopData.shop_categories?.first_bonus_points || 0
    const shopHasBonusTx = pointLogs.some(tx => tx.metadata?.is_bonus === true)

    let storeGen = 0, storeInd = 0, storeTeam = 0, storeOwn = 0, pendPts = 0, pendCount = 0
    
    const enrichedReferrals = referralLogs.map((log, index) => {
      const isCanceled = log.status === 'cancel'
      const isPending = log.status === 'pending'
      
      const isOldest = index === referralLogs.length - 1
      const refTxs = pointLogs.filter(tx => tx.referral_id === log.id && (tx.status === 'confirmed' || tx.status === 'paid'))
      const isFirstTime = !isCanceled && (refTxs.length > 0 ? refTxs.some(tx => tx.metadata?.is_bonus) : (!shopHasBonusTx && isOldest))
      
      const basePoints = rewardPoints + (isFirstTime && firstBonusEnabled ? firstBonusPoints : 0)
      
      const rInd = log.snapshot_ratio_individual ?? currentRatios.individual
      const rTeam = log.snapshot_ratio_team ?? currentRatios.team
      const rOwn = log.snapshot_ratio_owner ?? currentRatios.owner

      const indPart = Math.floor(basePoints * (rInd / 100))
      const teamPart = Math.floor(basePoints * (rTeam / 100))
      const ownPart = Math.floor(basePoints * (rOwn / 100))

      if (!isCanceled) {
        if (isPending) {
          pendPts += basePoints
          pendCount++
        } else {
          storeGen += basePoints
          storeInd += indPart
          storeTeam += teamPart
          storeOwn += ownPart
        }
      }

      return {
        ...log,
        staffName: staffList.find(s => s.id === log.staff_id)?.name || '不明',
        totalGenerated: basePoints,
        indPart, teamPart, ownPart,
        rInd, rTeam, rOwn
      }
    })

    setSummary({
      totalGenerated: storeGen,
      totalIndividual: storeInd,
      totalTeam: storeTeam,
      totalOwner: storeOwn,
      pendingPoints: pendPts,
      pendingCount: pendCount
    })

    setReferralHistory(enrichedReferrals)
    setStaffs(staffList.map(s => ({
      ...s,
      count: enrichedReferrals.filter(r => r.staff_id === s.id && r.status !== 'cancel').length
    })))

    if (!silent) setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  const getPatternFromRatios = (ind: number, team: number, owner: number) => {
    const match = POLICY_PATTERNS.find(p => p.ratios && p.ratios.individual === ind && p.ratios.team === team && p.ratios.owner === owner)
    return match ? match.id : 'custom'
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

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.replace('/verify')
  }

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  const handleSavePolicy = async () => {
    setIsSavingPolicy(true)
    const { error } = await supabase.from('shops').update({
      ratio_individual: ratios.individual,
      ratio_team: ratios.team,
      ratio_owner: ratios.owner
    }).eq('id', shop.id)
    
    if (error) alert('保存に失敗しました')
    else { alert('ポリシーを更新しました'); await loadData(true); setIsPolicyModalOpen(false); }
    setIsSavingPolicy(false)
  }

  const handleUpdateAuth = async (type: 'email' | 'password') => {
    setIsUpdatingAuth(true); setAuthMessage(null)
    const val = type === 'email' ? newOwnerEmail : newOwnerPassword
    const { error } = await supabase.auth.updateUser(type === 'email' ? { email: val } : { password: val })
    if (error) setAuthMessage({ type: 'error', text: error.message })
    else {
      setAuthMessage({ type: 'success', text: type === 'email' ? '確認メールを送信しました。' : '更新しました。' })
      if (type === 'email') setNewOwnerEmail(''); else setNewOwnerPassword('');
    }
    setIsUpdatingAuth(false)
  }

  const handleToggleTeam = async () => {
    if (!detailStaff) return;
    const newVal = detailStaff.is_team_pool_eligible === false ? true : false
    const { error } = await supabase.from('staffs').update({ is_team_pool_eligible: newVal }).eq('id', detailStaff.id)
    if (!error) {
      setDetailStaff({ ...detailStaff, is_team_pool_eligible: newVal })
      loadData(true)
    }
  }

  const handleDeleteStaff = async (staffId: string, staffName: string) => {
    if (!confirm(`スタッフ「${staffName}」を非表示にしますか？`)) return
    await supabase.from('staffs').update({ is_deleted: true }).eq('id', staffId)
    setDetailStaff(null); await loadData(true)
  }

  const formatDateYMD = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
  }

  const inviteUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/reg/${shop?.invite_token}`
  const inviteText = `【${shop?.name}】紹介パートナー登録URLです。\n${inviteUrl}`

  // ★ 削除してしまっていた policyEditorJSX 変数を復元
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

  // ==========================================
  // レンダー
  // ==========================================
  
  if (loading) return <div className="fixed inset-0 flex items-center justify-center bg-[#fffef2]"><Loader2 className="w-8 h-8 animate-spin text-[#1a1a1a]" /></div>

  // ★ 権限エラー画面 (Adminが来た時)
  if (showRoleError) return (
    <div className="fixed inset-0 bg-[#fffef2] flex items-center justify-center p-8 text-center font-sans text-[#333333]">
      <div className="max-w-xs space-y-6">
        <ShieldAlert className="w-12 h-12 text-[#8a3c3c] mx-auto" strokeWidth={1.5} />
        <h1 className="text-lg font-bold text-[#1a1a1a]">⚠️ 権限エラー</h1>
        <p className="text-[11px] text-[#666666] leading-relaxed">
          現在、システム管理者（Admin）としてログインしています。<br/><br/>
          店舗オーナー用の画面にアクセスするには、一度ログアウトして電話番号でご本人確認をやり直してください。
        </p>
        <button onClick={handleLogout} className="w-full py-4 bg-[#1a1a1a] text-[#fffef2] text-[11px] tracking-widest active:scale-[0.98] transition-all">
          ログアウトして認証画面へ
        </button>
      </div>
    </div>
  )

  return (
    <div className="fixed inset-0 bg-[#fffef2] flex justify-center font-sans text-[#333333] overflow-hidden selection:bg-[#e6e2d3] selection:text-[#333333]">
      <div className="w-full max-w-md bg-[#fffef2] h-full relative border-x border-[#e6e2d3] flex flex-col overflow-hidden">
        
        <header className="px-6 pt-safe-top pb-4 pt-6 flex items-start justify-between border-b border-[#e6e2d3] bg-[#fffef2]/90 backdrop-blur-md z-20 shrink-0">
          <div className="flex flex-col items-start gap-2">
            <h1 className="text-base text-[#1a1a1a] font-bold">{shop?.name}</h1>
            <span className="px-2 py-1 text-[11px] border border-[#e6e2d3] bg-[#f5f2e6] text-[#666666] tracking-wider flex items-center gap-1">
              <Crown className="w-3 h-3" /> {category?.label || 'RANK: -'}
            </span>
          </div>
          <div className="flex flex-col items-end gap-2 text-right">
            <div className="flex items-baseline gap-1">
              <span className="text-[11px] text-[#999999] tracking-wider font-inter">OWNER:</span>
              <h1 className="text-base text-[#1a1a1a]">{staffs.find(s => s.email === shop?.owner_email)?.name || '...'}</h1>
            </div>
            <button onClick={handleLogout} className="p-1 text-[#999999] hover:text-[#333333] transition-colors active:scale-[0.98]">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto pb-6 bg-[#fffef2]">
          <AnimatePresence mode="wait">
            <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="p-6 space-y-8">
              
              {/* ================= stats ================= */}
              {activeTab === 'stats' && (
                <>
                  <button onClick={() => window.open(`/m/${staffs.find(s => s.email === shop?.owner_email)?.secret_token}`, '_blank')} className="w-full py-4 bg-[#1a1a1a] text-[#fffef2] text-sm tracking-widest active:scale-[0.98] flex items-center justify-center gap-2">
                    <QrCode className="w-5 h-5"/> マイページ（QR表示）を開く <ExternalLink className="w-4 h-4 opacity-50" />
                  </button>

                  <div className="bg-[#f5f2e6] border border-[#e6e2d3] p-6 shadow-[0_0_20px_rgba(0,0,0,0.03)]">
                    <p className="text-sm text-[#666666] mb-3 tracking-wider">店舗全体の累計総発生額</p>
                    <p className="text-3xl font-mono font-black text-[#1a1a1a]">{summary.totalGenerated.toLocaleString()}<span className="text-sm ml-1 text-[#999999] font-sans font-medium">pt</span></p>
                    
                    <div className="grid grid-cols-3 gap-4 pt-6 mt-6 border-t border-[#e6e2d3]">
                      <div><p className="text-[11px] text-[#666666] mb-1 flex items-center gap-1"><User className="w-3 h-3"/> 本人</p><p className="text-base font-mono text-[#1a1a1a]">{summary.totalIndividual.toLocaleString()}</p></div>
                      <div><p className="text-[11px] text-[#666666] mb-1 flex items-center gap-1"><Handshake className="w-3 h-3"/> チーム</p><p className="text-base font-mono text-[#1a1a1a]">{summary.totalTeam.toLocaleString()}</p></div>
                      <div><p className="text-[11px] text-[#333333] font-bold mb-1 flex items-center gap-1"><Store className="w-3 h-3"/> 店舗留保</p><p className="text-base font-mono font-bold text-[#1a1a1a]">{summary.totalOwner.toLocaleString()}</p></div>
                    </div>
                  </div>

                  <div className="bg-[#fffef2] p-5 border border-[#e6e2d3]">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-sm font-bold text-[#1a1a1a] flex items-center gap-1.5"><Percent className="w-4 h-4 text-[#999999]" /> 分配ポリシー</h3>
                      <button onClick={() => setIsPolicyModalOpen(true)} className="text-[11px] border border-[#e6e2d3] px-3 py-1 bg-[#f5f2e6] hover:bg-[#e6e2d3] transition">変更</button>
                    </div>
                    <div className="flex h-2 w-full bg-[#e6e2d3] mb-3">
                      <div style={{width: `${ratios.individual}%`}} className="bg-[#1a1a1a]" /><div style={{width: `${ratios.team}%`}} className="bg-[#666666]" /><div style={{width: `${ratios.owner}%`}} className="bg-[#999999]" />
                    </div>
                    <div className="flex justify-between text-[11px] text-[#666666]">
                      <span>本人 {ratios.individual}%</span><span>チーム {ratios.team}%</span><span>店舗 {ratios.owner}%</span>
                    </div>
                  </div>

                  <div className="space-y-0">
                    <div className="flex justify-between items-center mb-4">
                      <h2 className="text-sm font-bold text-[#1a1a1a]">紹介履歴（報酬未確定）</h2>
                      <p className="text-lg font-sans tabular-nums text-[#333333]">{summary.pendingPoints.toLocaleString()}<span className="text-[11px] ml-1 text-[#999999]">pt</span></p>
                    </div>
                    <p className="text-[11px] text-[#666666] mb-4">商品のお届け完了後に報酬が確定します。</p>
                    {referralHistory.filter(r => r.status === 'pending').map(item => (
                      <div key={item.id} className="w-full border-b border-[#e6e2d3] first:border-t py-4 flex justify-between items-center">
                        <div className="flex items-start gap-3 flex-1">
                          <div className="w-[72px] shrink-0 flex flex-col gap-1.5 pt-1">
                            <span className="text-xs text-[#999999] tabular-nums leading-none">{formatDateYMD(item.created_at)}</span>
                            <span className="text-[11px] bg-[#a24343] text-[#fffef2] px-1 py-1 text-center leading-none">仮計上</span>
                          </div>
                          <div className="flex-1 flex flex-col">
                            <p className="text-sm text-[#1a1a1a] mb-1">{item.customer_name || '匿名のお客様'} <span className="text-[#999999] text-[11px]">[{item.recurring_count > 1 ? `定期${item.recurring_count}` : '初回'}]</span></p>
                            <p className="text-sm text-[#666666]">担当: {item.staffName}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-[11px] text-[#999999] mb-1">獲得予定</p>
                          <p className="text-lg font-sans tabular-nums text-[#1a1a1a]">{item.totalGenerated.toLocaleString()}<span className="text-[11px] ml-1">pt</span></p>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* ================= staff ================= */}
              {activeTab === 'staff' && (
                <div className="space-y-8">
                  <div>
                    <h2 className="text-sm font-bold mb-4 flex items-center gap-1.5"><UserPlus className="w-4 h-4 text-[#999999]" /> メンバー招待</h2>
                    <div className="grid grid-cols-2 gap-4">
                      <button onClick={() => setIsQRModalOpen(true)} className="bg-[#f5f2e6] border border-[#e6e2d3] p-5 flex flex-col items-center justify-center gap-3 active:scale-[0.98] transition">
                        <QrCode className="w-6 h-6 text-[#1a1a1a]" strokeWidth={1.5} />
                        <span className="text-[11px] text-[#666666]">QRで招待</span>
                      </button>
                      <button onClick={() => window.open(`https://line.me/R/msg/text/?${encodeURIComponent(inviteText)}`, '_blank')} className="bg-[#f5f2e6] border border-[#e6e2d3] p-5 flex flex-col items-center justify-center gap-3 active:scale-[0.98] transition">
                        <MessageCircle className="w-6 h-6 text-[#1a1a1a]" strokeWidth={1.5} />
                        <span className="text-[11px] text-[#666666]">LINEで招待</span>
                      </button>
                    </div>
                  </div>

                  <div className="pt-4">
                    <h2 className="text-sm font-bold mb-4 flex items-center gap-1.5"><Users className="w-4 h-4 text-[#999999]" /> メンバー実績一覧</h2>
                    {staffs.map(s => (
                      <div key={s.id} className="border-b border-[#e6e2d3] first:border-t py-5 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-[#f5f2e6] flex items-center justify-center text-[#1a1a1a] font-bold">{s.name.charAt(0)}</div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="text-sm font-bold text-[#1a1a1a]">{s.name}</h3>
                              {s.email === shop?.owner_email && <span className="text-[11px] border border-[#e6e2d3] bg-[#fffef2] px-1 text-[#999999]">OWNER</span>}
                              {s.is_team_pool_eligible !== false && <span className="text-[11px] border border-[#e6e2d3] bg-[#f5f2e6] px-1 text-[#666666]">TEAM</span>}
                            </div>
                            <p className="text-[11px] text-[#666666]">累計紹介数: <span className="font-mono text-[#1a1a1a]">{s.count}</span> 件</p>
                          </div>
                        </div>
                        <button onClick={() => setDetailStaff(s)} className="p-2 text-[#999999] hover:text-[#1a1a1a] transition"><Settings className="w-5 h-5" /></button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ================= shop ================= */}
              {activeTab === 'shop' && (
                <div className="space-y-8">
                  <div className="bg-[#f5f2e6] p-6 border border-[#e6e2d3] flex justify-between items-end">
                    <div><p className="text-[11px] text-[#666666] mb-1 uppercase tracking-widest">Available Points</p><p className="text-xs text-[#999999]">店舗留保ポイント（仕入れ用）</p></div>
                    <p className="text-3xl font-mono text-[#1a1a1a]">{summary.totalOwner.toLocaleString()}<span className="text-sm ml-1">pt</span></p>
                  </div>
                  <div className="space-y-4">
                    {MOCK_PRODUCTS.map(p => (
                      <div key={p.id} className="p-5 border border-[#e6e2d3] flex items-center gap-5 hover:bg-[#f5f2e6] transition-colors">
                        <div className="w-16 h-16 bg-[#f5f2e6] flex items-center justify-center border border-[#e6e2d3]">{p.icon}</div>
                        <div className="flex-1">
                          <h3 className="text-sm font-bold text-[#1a1a1a] mb-1">{p.name}</h3>
                          <div className="flex justify-between items-end">
                            <div><p className="text-[11px] text-[#999999] line-through">¥{p.price.toLocaleString()}</p><p className="text-base font-mono text-[#1a1a1a]">{p.ptPrice.toLocaleString()}pt</p></div>
                            <button className="px-5 py-2 bg-[#1a1a1a] text-[#fffef2] text-[11px] font-bold tracking-widest active:scale-95 transition">ポイント交換</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ================= info ================= */}
              {activeTab === 'info' && (
                <div className="space-y-4">
                  <h2 className="text-sm font-bold text-[#1a1a1a] mb-6">ドキュメント・資料</h2>
                  {[
                    { icon: <LayoutDashboard className="w-5 h-5"/>, title: 'システム運用マニュアル', desc: 'スタッフ招待や報酬確定の流れ' },
                    { icon: <ShoppingBag className="w-5 h-5"/>, title: 'プロダクト・リーフレット', desc: '販促用画像・PDFデータ' },
                    { icon: <MessageCircle className="w-5 h-5"/>, title: 'カウンセリングガイド', desc: 'お客様への声掛けとクロージング' },
                    { icon: <PlayCircle className="w-5 h-5"/>, title: '導入講習動画', desc: '機器の正しい操作方法' },
                  ].map((item, i) => (
                    <button key={i} className="w-full text-left bg-transparent border-b border-[#e6e2d3] first:border-t py-5 flex items-center justify-between active:bg-[#f5f2e6] transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="text-[#333333]">{item.icon}</div>
                        <div><h3 className="text-sm font-bold text-[#1a1a1a] mb-0.5">{item.title}</h3><p className="text-[11px] text-[#999999]">{item.desc}</p></div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-[#e6e2d3]" />
                    </button>
                  ))}
                </div>
              )}

              {/* ================= settings ================= */}
              {activeTab === 'settings' && (
                <div className="space-y-8">
                  <h2 className="text-sm font-bold text-[#1a1a1a]">アカウント管理</h2>
                  <div className="bg-[#fffef2] border border-[#e6e2d3] p-6 space-y-6">
                    <div>
                      <label className="block text-[11px] text-[#999999] mb-3 uppercase tracking-widest">Login Email</label>
                      <p className="text-sm text-[#666666] mb-4">{authEmail}</p>
                      <input type="email" placeholder="新しいメールアドレス" value={newOwnerEmail} onChange={e => setNewOwnerEmail(e.target.value)} className="w-full px-4 py-4 bg-[#f5f2e6] border-none text-sm outline-none focus:ring-1 focus:ring-[#1a1a1a] mb-3" />
                      <button onClick={() => handleUpdateAuth('email')} className="w-full py-4 bg-[#1a1a1a] text-[#fffef2] text-[11px] font-bold tracking-widest uppercase active:scale-[0.98] transition">変更確認メールを送信</button>
                    </div>
                    <div className="pt-6 border-t border-[#e6e2d3]">
                      <label className="block text-[11px] text-[#999999] mb-3 uppercase tracking-widest">New Password</label>
                      <input type="password" placeholder="6文字以上の新しいパスワード" value={newOwnerPassword} onChange={e => setNewOwnerPassword(e.target.value)} className="w-full px-4 py-4 bg-[#f5f2e6] border-none text-sm outline-none focus:ring-1 focus:ring-[#1a1a1a] mb-3" />
                      <button onClick={() => handleUpdateAuth('password')} className="w-full py-4 bg-[#1a1a1a] text-[#fffef2] text-[11px] font-bold tracking-widest uppercase active:scale-[0.98] transition">パスワードを更新</button>
                    </div>
                    {authMessage && <div className={`p-4 text-[11px] ${authMessage.type === 'success' ? 'bg-[#f4f8f4] text-[#2d5a2d]' : 'bg-[#fcf0f0] text-[#8a3c3c]'}`}>{authMessage.text}</div>}
                  </div>
                  <button onClick={handleLogout} className="w-full py-4 border border-[#e6e2d3] text-[#666666] text-sm hover:bg-[#fcf0f0] hover:text-[#8a3c3c] hover:border-[#fcf0f0] transition-colors flex items-center justify-center gap-2">
                    <LogOut className="w-4 h-4" /> ログアウト
                  </button>
                </div>
              )}

            </motion.div>
          </AnimatePresence>
        </main>

        {/* ボトムナビ */}
        <nav className="bg-[#1a1a1a] px-2 py-4 flex justify-between items-center z-50 pb-safe relative shrink-0">
          {[
            { id: 'stats', icon: <LayoutDashboard className="w-6 h-6" strokeWidth={1.5} />, label: 'HOME' },
            { id: 'staff', icon: <Users className="w-6 h-6" strokeWidth={1.5} />, label: 'MEMBER' },
            { id: 'info', icon: <BookOpen className="w-6 h-6" strokeWidth={1.5} />, label: 'GUIDE' },
            { id: 'shop', icon: <Store className="w-6 h-6" strokeWidth={1.5} />, label: 'SHOP' },
            { id: 'settings', icon: <Settings className="w-6 h-6" strokeWidth={1.5} />, label: 'SETTING' },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex flex-col items-center justify-center flex-1 py-2 gap-1 transition-colors ${activeTab === tab.id ? 'text-[#fffef2]' : 'text-[#666666] hover:text-[#999999]'}`}>
              <div className={`transition-transform duration-200 ${activeTab === tab.id ? 'scale-110' : 'scale-100'}`}>{tab.icon}</div>
              <span className="text-[11px] tracking-wider">{tab.label}</span>
            </button>
          ))}
        </nav>

        {/* モーダル群 */}
        <AnimatePresence>
          {/* 分配ポリシーモーダル */}
          {isPolicyModalOpen && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[100] bg-[#1a1a1a]/60 backdrop-blur-sm flex items-center justify-center p-4">
              <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }} className="bg-[#fffef2] p-8 w-full max-w-md mx-auto relative overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.2)]">
                <button onClick={() => setIsPolicyModalOpen(false)} className="absolute top-4 right-4 p-3 text-[#999999] hover:text-[#333333]"><X className="w-6 h-6" strokeWidth={1.5} /></button>
                <h3 className="text-base text-[#1a1a1a] mb-6 font-bold flex items-center gap-2"><Percent className="w-5 h-5" /> 分配ポリシーの変更</h3>
                {policyEditorJSX}
                <button onClick={handleSavePolicy} disabled={isSavingPolicy} className="w-full py-5 bg-[#1a1a1a] text-[#fffef2] text-sm uppercase tracking-widest font-bold active:scale-[0.98] transition-all flex justify-center items-center gap-2">
                  {isSavingPolicy ? <Loader2 className="w-5 h-5 animate-spin mx-auto"/> : "設定を保存する"}
                </button>
              </motion.div>
            </motion.div>
          )}

          {/* QR招待モーダル */}
          {isQRModalOpen && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[100] bg-[#1a1a1a]/60 backdrop-blur-sm flex flex-col justify-end p-4 sm:p-6">
              <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'tween', duration: 0.3 }} className="bg-[#fffef2] p-8 w-full max-w-md mx-auto relative shadow-[0_0_40px_rgba(0,0,0,0.2)] flex flex-col items-center">
                <div className="w-full flex justify-between items-center mb-8">
                  <h3 className="text-base text-[#1a1a1a] font-bold">QRコードで招待</h3>
                  <button onClick={() => setIsQRModalOpen(false)} className="p-2 text-[#999999] hover:text-[#333333] -mr-2"><X className="w-6 h-6" strokeWidth={1.5} /></button>
                </div>
                <div className="p-6 bg-white border border-[#e6e2d3] mb-6">
                  <QRCodeCanvas value={inviteUrl} size={200} level="H" fgColor="#1a1a1a" />
                </div>
                <p className="text-[11px] text-[#666666] text-center leading-relaxed mb-8">
                  スタッフのカメラで読み取ると、<br/>紹介パートナー登録画面が開きます。
                </p>
                <button onClick={() => setIsQRModalOpen(false)} className="w-full py-4 bg-[#f5f2e6] text-[#333333] text-sm font-bold transition-all active:scale-[0.98]">閉じる</button>
              </motion.div>
            </motion.div>
          )}

          {/* スタッフ詳細モーダル */}
          {detailStaff && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[100] bg-[#1a1a1a]/60 backdrop-blur-sm flex flex-col justify-end p-4 sm:p-6">
              <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'tween', duration: 0.3 }} className="bg-[#fffef2] p-8 w-full max-w-md mx-auto relative shadow-[0_0_40px_rgba(0,0,0,0.2)]">
                <div className="flex justify-between items-center mb-8">
                  <h3 className="text-lg text-[#1a1a1a] font-bold">{detailStaff.name}</h3>
                  <button onClick={() => setDetailStaff(null)} className="p-2 text-[#999999] hover:text-[#333333] -mr-2"><X className="w-6 h-6" strokeWidth={1.5} /></button>
                </div>
                
                <div className="mb-8 bg-[#f5f2e6] p-5 border border-[#e6e2d3] flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-[#1a1a1a] mb-1">チーム分配の対象にする</h4>
                    <p className="text-[11px] text-[#666666]">店舗のチーム売上から分配を受け取る</p>
                  </div>
                  <button onClick={handleToggleTeam} className="transition-transform active:scale-90 ml-4">
                    {detailStaff.is_team_pool_eligible !== false ? (
                      <ToggleRight className="w-10 h-10 text-[#1a1a1a]" strokeWidth={1.5} />
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
                  <button onClick={() => handleCopy(`${typeof window !== 'undefined' ? window.location.origin : ''}/welcome/${detailStaff.referral_code || ''}`)} className="w-full py-4 bg-[#f5f2e6] text-[#333333] text-[11px] tracking-widest uppercase flex items-center justify-center gap-2 active:scale-[0.98] transition font-bold">
                    <LinkIcon className="w-4 h-4 text-[#999999]" /> 接客用URLをコピー
                  </button>
                  <button onClick={() => handleCopy(`${typeof window !== 'undefined' ? window.location.origin : ''}/m/${detailStaff.secret_token}`)} className="w-full py-4 bg-[#f5f2e6] text-[#333333] text-[11px] tracking-widest uppercase flex items-center justify-center gap-2 active:scale-[0.98] transition font-bold">
                    <Edit2 className="w-4 h-4 text-[#999999]" /> マイページURLをコピー
                  </button>
                </div>

                {!detailStaff.isOwner && (
                  <button onClick={() => handleDeleteStaff(detailStaff.id, detailStaff.name)} className="w-full py-4 border border-[#fcf0f0] text-[#8a3c3c] text-[11px] uppercase font-bold tracking-widest flex items-center justify-center gap-2 hover:bg-[#fcf0f0] transition">
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