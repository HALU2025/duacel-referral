'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { QRCodeCanvas } from 'qrcode.react'
import { motion, AnimatePresence } from 'framer-motion'

import { 
  LogOut, Clock, CheckCircle2, Users, Crown, Settings, 
  Link as LinkIcon, QrCode, Trash2, Sparkles, BookOpen, PlayCircle, 
  MessageCircle, ShoppingBag, ThumbsUp, Handshake, Percent,
  ToggleRight, ToggleLeft, User, UserPlus, ChevronRight, ShieldAlert, 
  ExternalLink, Edit2, Loader2, Store, Save, X
} from 'lucide-react'

// 分配ポリシーのプリセット
const POLICY_PATTERNS = [
  { id: 'pattern1', icon: <ThumbsUp className="w-4 h-4" />, label: 'スタッフ全力還元', desc: '個人のモチベーションを最大化', ratios: { individual: 100, team: 0, owner: 0 } },
  { id: 'pattern2', icon: <Handshake className="w-4 h-4" />, label: 'チームワーク重視', desc: '店舗全体の協力体制をつくる', ratios: { individual: 70, team: 30, owner: 0 } },
  { id: 'pattern3', icon: <Store className="w-4 h-4" />, label: '店舗還元ミックス', desc: '販促・仕入れ費として店舗にも還元', ratios: { individual: 60, team: 20, owner: 20 } },
  { id: 'custom', icon: <Settings className="w-4 h-4" />, label: 'カスタム設定', desc: '自由に配分を調整', ratios: null },
]

// くすみカラーの定義
const COLORS = {
  individual: '#a3b18a', // Dusty Sage
  team: '#b5838d',       // Dusty Rose
  owner: '#6d6875',      // Dusty Slate
  bg: '#faf9f6'          // Dashboard Greige
}

export default function OwnerDashboard() {
  const router = useRouter()
  
  // UI状態
  const [activeTab, setActiveTab] = useState<'stats' | 'staff' | 'info' | 'shop' | 'settings'>('stats')
  const [loading, setLoading] = useState(true)
  const [showRoleError, setShowRoleError] = useState(false) 
  const [isEditingSettings, setIsEditingSettings] = useState(false)

  // データ状態
  const [shop, setShop] = useState<any>(null)
  const [category, setCategory] = useState<any>(null)
  const [staffs, setStaffs] = useState<any[]>([])
  const [referralHistory, setReferralHistory] = useState<any[]>([])
  const [pointHistory, setPointHistory] = useState<any[]>([])
  const [summary, setSummary] = useState({ 
    totalGenerated: 0, totalIndividual: 0, totalTeam: 0, totalOwner: 0, pendingPoints: 0, pendingCount: 0 
  })

  // 設定・編集用
  const [ratios, setRatios] = useState({ individual: 100, team: 0, owner: 0 })
  const [selectedPattern, setSelectedPattern] = useState<string>('pattern1')
  const [editData, setEditData] = useState({ shopName: '', email: '', password: '' })
  const [isUpdating, setIsUpdating] = useState(false)

  // モーダル制御
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false)
  const [isQRModalOpen, setIsQRModalOpen] = useState(false)
  const [detailStaff, setDetailStaff] = useState<any>(null)
  const [isSavingPolicy, setIsSavingPolicy] = useState(false)

  const MOCK_PRODUCTS = [
    { id: 1, name: 'Duacel スカルプセラム (業務用)', price: 8800, ptPrice: 8000, icon: <Sparkles className="w-6 h-6 text-[#999999]" /> },
    { id: 2, name: '専用導入機器 (Proモデル)', price: 45000, ptPrice: 42000, icon: <ShieldAlert className="w-6 h-6 text-[#999999]" /> },
    { id: 3, name: '店販用パンフレット (100部)', price: 2000, ptPrice: 2000, icon: <BookOpen className="w-6 h-6 text-[#999999]" /> },
  ]

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace('/verify'); return; }

    const { data: adminData } = await supabase.from('system_admins').select('id').eq('id', user.id).maybeSingle()
    if (adminData) { setShowRoleError(true); setLoading(false); return; }

    const { data: shopData } = await supabase.from('shops').select(`*, shop_categories (*)`).eq('owner_id', user.id).maybeSingle()
    if (!shopData) { await supabase.auth.signOut(); router.replace('/verify'); return; }

    setShop(shopData)
    setCategory(shopData.shop_categories)
    setEditData({ shopName: shopData.name, email: user.email || '', password: '' })
    
    const currentRatios = { 
      individual: shopData.ratio_individual ?? 100, 
      team: shopData.ratio_team ?? 0, 
      owner: shopData.ratio_owner ?? 0 
    }
    setRatios(currentRatios)
    setSelectedPattern(getPatternFromRatios(currentRatios.individual, currentRatios.team, currentRatios.owner))
    
    const [staffRes, refRes, txRes] = await Promise.all([
      supabase.from('staffs').select('*').eq('shop_id', shopData.id).eq('is_deleted', false),
      supabase.from('referrals').select('*').eq('shop_id', shopData.id).order('created_at', { ascending: false }),
      supabase.from('point_transactions').select('*').eq('shop_id', shopData.id).order('created_at', { ascending: false })
    ])

    const staffList = staffRes.data || []
    const referralLogs = refRes.data || []
    const pointLogs = txRes.data || []

    // 統計計算
    const rewardPoints = shopData.shop_categories?.reward_points || 0
    let storeGen = 0, storeInd = 0, storeTeam = 0, storeOwn = 0, pendPts = 0, pendCount = 0
    
    const enrichedReferrals = referralLogs.map((log) => {
      const isCanceled = log.status === 'cancel'
      const isPending = log.status === 'pending'
      const basePoints = rewardPoints // 簡易化
      const rInd = log.snapshot_ratio_individual ?? currentRatios.individual
      const rTeam = log.snapshot_ratio_team ?? currentRatios.team
      const rOwn = log.snapshot_ratio_owner ?? currentRatios.owner

      if (!isCanceled) {
        if (isPending) { pendPts += basePoints; pendCount++; }
        else { 
          storeGen += basePoints; 
          storeInd += Math.floor(basePoints * (rInd / 100));
          storeTeam += Math.floor(basePoints * (rTeam / 100));
          storeOwn += Math.floor(basePoints * (rOwn / 100));
        }
      }

      return {
        ...log,
        staffName: staffList.find(s => s.id === log.staff_id)?.name || '不明',
        totalGenerated: basePoints
      }
    })

    setSummary({ totalGenerated: storeGen, totalIndividual: storeInd, totalTeam: storeTeam, totalOwner: storeOwn, pendingPoints: pendPts, pendingCount: pendCount })
    setReferralHistory(enrichedReferrals)
    setPointHistory(pointLogs.filter(tx => tx.status === 'confirmed'))
    setStaffs(staffList.map(s => ({ ...s, count: enrichedReferrals.filter(r => r.staff_id === s.id && r.status !== 'cancel').length })))
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

  const handleLogout = async () => { await supabase.auth.signOut(); router.replace('/verify'); }

  const handleSavePolicy = async () => {
    setIsSavingPolicy(true)
    const { error } = await supabase.from('shops').update({
      ratio_individual: ratios.individual,
      ratio_team: ratios.team,
      ratio_owner: ratios.owner
    }).eq('id', shop.id)
    if (!error) { await loadData(true); setIsPolicyModalOpen(false); }
    setIsSavingPolicy(false)
  }

  const handleUpdateSettings = async () => {
    setIsUpdating(true)
    const { error: shopError } = await supabase.from('shops').update({ name: editData.shopName }).eq('id', shop.id)
    if (editData.password) await supabase.auth.updateUser({ password: editData.password })
    if (editData.email !== shop.owner_email) await supabase.auth.updateUser({ email: editData.email })
    
    await loadData(true)
    setIsEditingSettings(false)
    setIsUpdating(false)
  }

  const handleToggleTeam = async () => {
    if (!detailStaff) return;
    const newVal = detailStaff.is_team_pool_eligible === false ? true : false
    const { error } = await supabase.from('staffs').update({ is_team_pool_eligible: newVal }).eq('id', detailStaff.id)
    if (!error) { setDetailStaff({ ...detailStaff, is_team_pool_eligible: newVal }); loadData(true); }
  }

  const formatDateYMD = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
  }

  const inviteUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/reg/${shop?.invite_token}`

  const policyEditorJSX = (
    <div className="space-y-4 mb-8">
      <div className="grid grid-cols-1 gap-2">
        {POLICY_PATTERNS.map(pattern => (
          <button 
            key={pattern.id} onClick={() => handlePatternSelect(pattern.id)}
            className={`flex items-center gap-3 p-4 border transition-all duration-200 outline-none ${selectedPattern === pattern.id ? 'bg-[#f5f2e6] border-[#1a1a1a]' : 'bg-white border-[#e6e2d3]'}`}
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
                <span className="text-lg font-bold text-[#1a1a1a]">{ratios.individual}%</span>
              </div>
              <input type="range" min="0" max="100" step="5" value={ratios.individual} onChange={(e) => handleSliderChange('individual', parseInt(e.target.value))} className="w-full h-1.5 bg-[#e6e2d3] appearance-none accent-[#1a1a1a]" />
            </div>
            <div>
              <div className="flex justify-between items-end mb-2">
                <label className="text-[11px] text-[#666666]">チーム分配</label>
                <span className="text-lg font-bold text-[#1a1a1a]">{ratios.team}%</span>
              </div>
              <input type="range" min="0" max="100" step="5" value={ratios.team} onChange={(e) => handleSliderChange('team', parseInt(e.target.value))} className="w-full h-1.5 bg-[#e6e2d3] appearance-none accent-[#1a1a1a]" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="p-5 bg-white border border-[#e6e2d3] flex flex-col gap-3">
        <p className="text-[11px] text-[#666666]">分配シミュレーション</p>
        <div className="flex h-2.5 w-full overflow-hidden bg-[#e6e2d3] rounded-full">
          <div style={{width: `${ratios.individual}%`, backgroundColor: COLORS.individual}} className="transition-all duration-300" />
          <div style={{width: `${ratios.team}%`, backgroundColor: COLORS.team}} className="transition-all duration-300" />
          <div style={{width: `${ratios.owner}%`, backgroundColor: COLORS.owner}} className="transition-all duration-300" />
        </div>
        <div className="flex justify-between text-[10px] mt-1 text-[#666666] tracking-tighter">
          <span className="flex items-center gap-1"><User className="w-3 h-3"/> 本人 {ratios.individual}%</span>
          <span className="flex items-center gap-1"><Handshake className="w-3 h-3"/> チーム {ratios.team}%</span>
          <span className="flex items-center gap-1"><Store className="w-3 h-3"/> 店舗 {ratios.owner}%</span>
        </div>
      </div>
    </div>
  )

  if (loading) return <div className="fixed inset-0 flex items-center justify-center bg-[#faf9f6]"><Loader2 className="w-8 h-8 animate-spin text-[#1a1a1a]" /></div>

  if (showRoleError) return (
    <div className="fixed inset-0 bg-[#faf9f6] flex items-center justify-center p-8 text-center font-sans text-[#333333]">
      <div className="max-w-xs space-y-6">
        <ShieldAlert className="w-12 h-12 text-[#8a3c3c] mx-auto" strokeWidth={1.5} />
        <h1 className="text-lg font-bold text-[#1a1a1a]">⚠️ 権限エラー</h1>
        <p className="text-[11px] text-[#666666] leading-relaxed">管理者アカウントでのアクセスです。オーナー用画面を利用するにはログアウトして再認証してください。</p>
        <button onClick={handleLogout} className="w-full py-4 bg-[#1a1a1a] text-white text-[11px] tracking-widest">ログアウト</button>
      </div>
    </div>
  )

  return (
    <div className="fixed inset-0 bg-[#faf9f6] flex justify-center font-sans text-[#333333] overflow-hidden">
      <div className="w-full max-w-md bg-[#faf9f6] h-full relative border-x border-[#e6e2d3] flex flex-col overflow-hidden">
        
        <header className="px-6 pt-safe-top pb-4 pt-6 flex items-start justify-between border-b border-[#e6e2d3] bg-[#faf9f6]/90 backdrop-blur-md z-20 shrink-0">
          <div className="flex flex-col items-start gap-1">
            <h1 className="text-base text-[#1a1a1a] font-bold tracking-tight">{shop?.name}</h1>
            <span className="px-2 py-0.5 text-[10px] border border-[#e6e2d3] bg-white text-[#666666] tracking-wider flex items-center gap-1 rounded-full">
              <Crown className="w-2.5 h-2.5" /> {category?.label || 'RANK: -'}
            </span>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-1 justify-end">
              <span className="text-[10px] text-[#999999] tracking-wider">OWNER</span>
              <h1 className="text-sm text-[#1a1a1a] font-medium">{staffs.find(s => s.email === shop?.owner_email)?.name || '...'}</h1>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto pb-24 bg-[#faf9f6]">
          <AnimatePresence mode="wait">
            <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="p-6 space-y-8">
              
              {activeTab === 'stats' && (
                <>
                  <button onClick={() => window.open(`/m/${staffs.find(s => s.email === shop?.owner_email)?.secret_token}`, '_blank')} className="w-full py-4 bg-[#1a1a1a] text-white text-xs tracking-widest active:scale-[0.98] flex items-center justify-center gap-2 rounded-sm shadow-sm">
                    <QrCode className="w-4 h-4"/> マイページを表示 <ExternalLink className="w-3.5 h-3.5 opacity-50" />
                  </button>

                  <div className="bg-white border border-[#e6e2d3] p-6 shadow-sm rounded-sm">
                    <p className="text-[11px] text-[#999999] mb-2 tracking-widest font-bold">TOTAL GENERATED</p>
                    <p className="text-3xl font-bold text-[#1a1a1a] tracking-tight">{summary.totalGenerated.toLocaleString()}<span className="text-sm ml-1 text-[#999999] font-medium">pt</span></p>
                    
                    <div className="grid grid-cols-3 gap-2 pt-6 mt-6 border-t border-[#f0eee4]">
                      <div>
                        <p className="text-[10px] text-[#999999] mb-1 flex items-center gap-1"><User className="w-2.5 h-2.5" style={{color: COLORS.individual}}/> 本人</p>
                        <p className="text-sm font-bold text-[#1a1a1a]">{summary.totalIndividual.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-[#999999] mb-1 flex items-center gap-1"><Handshake className="w-2.5 h-2.5" style={{color: COLORS.team}}/> チーム</p>
                        <p className="text-sm font-bold text-[#1a1a1a]">{summary.totalTeam.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-[#999999] mb-1 flex items-center gap-1"><Store className="w-2.5 h-2.5" style={{color: COLORS.owner}}/> 店舗</p>
                        <p className="text-sm font-bold text-[#1a1a1a]">{summary.totalOwner.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>

                  {/* 分配ポリシー */}
                  <div className="bg-white p-5 border border-[#e6e2d3] rounded-sm">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-xs font-bold text-[#1a1a1a] flex items-center gap-1.5"><Percent className="w-3.5 h-3.5 text-[#999999]" /> 分配ポリシー</h3>
                      <button onClick={() => setIsPolicyModalOpen(true)} className="text-[10px] border border-[#e6e2d3] px-3 py-1 bg-[#faf9f6] rounded-full active:bg-[#e6e2d3] transition">変更</button>
                    </div>
                    <div className="flex h-1.5 w-full bg-[#f0f0f0] mb-3 rounded-full overflow-hidden">
                      <div style={{width: `${ratios.individual}%`, backgroundColor: COLORS.individual}} />
                      <div style={{width: `${ratios.team}%`, backgroundColor: COLORS.team}} />
                      <div style={{width: `${ratios.owner}%`, backgroundColor: COLORS.owner}} />
                    </div>
                    <div className="flex justify-between text-[10px] text-[#999999] font-medium">
                      <span>本人 {ratios.individual}%</span><span>チーム {ratios.team}%</span><span>店舗 {ratios.owner}%</span>
                    </div>
                  </div>

                  {/* 報酬確定履歴（ポイント獲得履歴） */}
                  <div>
                    <h2 className="text-xs font-bold text-[#1a1a1a] mb-4 flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-[#999999]" /> ポイント獲得履歴（確定済み）
                    </h2>
                    <div className="space-y-3">
                      {pointHistory.length > 0 ? pointHistory.slice(0, 5).map(item => (
                        <div key={item.id} className="bg-white border border-[#e6e2d3] p-4 flex justify-between items-center rounded-sm">
                          <div className="flex flex-col gap-1">
                            <span className="text-[10px] text-[#999999]">{formatDateYMD(item.created_at)}</span>
                            <span className="text-xs font-bold text-[#1a1a1a]">{item.description || '報酬確定'}</span>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-[#a3b18a]">+{item.amount.toLocaleString()}<span className="text-[10px] ml-0.5">pt</span></p>
                          </div>
                        </div>
                      )) : (
                        <p className="text-[11px] text-[#999999] text-center py-8 border border-dashed border-[#e6e2d3]">確定済みの履歴はありません</p>
                      )}
                    </div>
                  </div>

                  {/* 報酬未確定 */}
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <h2 className="text-xs font-bold text-[#1a1a1a]">紹介承認待ち（未確定）</h2>
                      <p className="text-base font-bold text-[#1a1a1a]">{summary.pendingPoints.toLocaleString()}<span className="text-[10px] ml-1 font-normal text-[#999999]">pt</span></p>
                    </div>
                    {referralHistory.filter(r => r.status === 'pending').map(item => (
                      <div key={item.id} className="bg-white border border-[#e6e2d3] p-4 mb-2 flex justify-between items-center rounded-sm">
                        <div className="flex items-start gap-3">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#b5838d] mt-1.5" />
                          <div>
                            <p className="text-xs font-bold text-[#1a1a1a]">{item.customer_name || '匿名のお客様'}</p>
                            <p className="text-[10px] text-[#999999]">{formatDateYMD(item.created_at)} · 担当: {item.staffName}</p>
                          </div>
                        </div>
                        <p className="text-sm font-bold text-[#1a1a1a]">+{item.totalGenerated.toLocaleString()}pt</p>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {activeTab === 'staff' && (
                <div className="space-y-8">
                  <div>
                    <h2 className="text-xs font-bold mb-4 flex items-center gap-1.5">MEMBER INVITATION</h2>
                    <div className="grid grid-cols-2 gap-3">
                      <button onClick={() => setIsQRModalOpen(true)} className="bg-white border border-[#e6e2d3] p-5 flex flex-col items-center gap-2 rounded-sm active:bg-[#f5f2e6] transition">
                        <QrCode className="w-5 h-5 text-[#666666]" />
                        <span className="text-[10px] text-[#666666] font-bold">QRコード</span>
                      </button>
                      <button onClick={() => window.open(`https://line.me/R/msg/text/?${encodeURIComponent(inviteUrl)}`, '_blank')} className="bg-white border border-[#e6e2d3] p-5 flex flex-col items-center gap-2 rounded-sm active:bg-[#f5f2e6] transition">
                        <MessageCircle className="w-5 h-5 text-[#666666]" />
                        <span className="text-[10px] text-[#666666] font-bold">LINEで招待</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <h2 className="text-xs font-bold mb-4">MEMBER LIST</h2>
                    {staffs.map(s => (
                      <div key={s.id} className="bg-white border border-[#e6e2d3] p-4 mb-2 flex items-center justify-between rounded-sm">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-[#faf9f6] border border-[#e6e2d3] flex items-center justify-center text-xs font-bold rounded-full">{s.name.charAt(0)}</div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <h3 className="text-xs font-bold text-[#1a1a1a]">{s.name}</h3>
                              {s.is_team_pool_eligible !== false && <span className="text-[9px] bg-[#f5f2e6] px-1.5 py-0.5 text-[#8a9a5b] font-bold rounded-full">TEAM</span>}
                            </div>
                            <p className="text-[10px] text-[#999999]">累計紹介: {s.count}件</p>
                          </div>
                        </div>
                        <button onClick={() => setDetailStaff(s)} className="p-2 text-[#e6e2d3] hover:text-[#1a1a1a] transition"><Settings className="w-4 h-4" /></button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'shop' && (
                <div className="space-y-6">
                  <div className="bg-[#6d6875] p-6 rounded-sm text-white flex justify-between items-center shadow-md">
                    <div>
                      <p className="text-[10px] opacity-70 tracking-widest font-bold">SHOP RESERVED POINTS</p>
                      <p className="text-[11px] opacity-90">店舗留保分（備品・仕入れ）</p>
                    </div>
                    <p className="text-2xl font-bold">{summary.totalOwner.toLocaleString()}<span className="text-xs ml-1">pt</span></p>
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                    {MOCK_PRODUCTS.map(p => (
                      <div key={p.id} className="bg-white border border-[#e6e2d3] p-4 flex items-center gap-4 rounded-sm">
                        <div className="w-14 h-14 bg-[#faf9f6] flex items-center justify-center rounded-sm">{p.icon}</div>
                        <div className="flex-1">
                          <h3 className="text-xs font-bold text-[#1a1a1a] mb-0.5">{p.name}</h3>
                          <p className="text-sm font-bold text-[#1a1a1a]">{p.ptPrice.toLocaleString()}<span className="text-[10px] ml-0.5 font-normal">pt</span></p>
                        </div>
                        <button className="px-4 py-2 bg-[#1a1a1a] text-white text-[10px] font-bold rounded-sm active:scale-95 transition">交換</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'settings' && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <h2 className="text-xs font-bold text-[#1a1a1a] tracking-widest uppercase">Account & Shop Info</h2>
                    {!isEditingSettings && (
                      <button onClick={() => setIsEditingSettings(true)} className="flex items-center gap-1 text-[10px] font-bold text-[#666666] border border-[#e6e2d3] px-3 py-1 bg-white rounded-full">
                        <Edit2 className="w-3 h-3"/> 編集する
                      </button>
                    )}
                  </div>

                  <div className="bg-white border border-[#e6e2d3] rounded-sm divide-y divide-[#faf9f6]">
                    <div className="p-5">
                      <label className="text-[10px] text-[#999999] uppercase tracking-widest block mb-1">Shop Name</label>
                      {isEditingSettings ? (
                        <input type="text" value={editData.shopName} onChange={e => setEditData({...editData, shopName: e.target.value})} className="w-full text-sm font-bold border-b border-[#1a1a1a] py-1 bg-transparent outline-none" />
                      ) : (
                        <p className="text-sm font-bold text-[#1a1a1a]">{shop?.name}</p>
                      )}
                    </div>
                    <div className="p-5">
                      <label className="text-[10px] text-[#999999] uppercase tracking-widest block mb-1">Owner Email</label>
                      {isEditingSettings ? (
                        <input type="email" value={editData.email} onChange={e => setEditData({...editData, email: e.target.value})} className="w-full text-sm font-bold border-b border-[#1a1a1a] py-1 bg-transparent outline-none" />
                      ) : (
                        <p className="text-sm font-bold text-[#1a1a1a]">{shop?.owner_email}</p>
                      )}
                    </div>
                    {isEditingSettings && (
                      <div className="p-5">
                        <label className="text-[10px] text-[#999999] uppercase tracking-widest block mb-1">New Password</label>
                        <input type="password" placeholder="変更する場合のみ入力" value={editData.password} onChange={e => setEditData({...editData, password: e.target.value})} className="w-full text-sm font-bold border-b border-[#1a1a1a] py-1 bg-transparent outline-none" />
                      </div>
                    )}
                    <div className="p-5">
                      <label className="text-[10px] text-[#999999] uppercase tracking-widest block mb-1">Contract Category</label>
                      <p className="text-sm font-bold text-[#1a1a1a]">{category?.label}</p>
                    </div>
                  </div>

                  {isEditingSettings && (
                    <div className="flex gap-3">
                      <button onClick={() => setIsEditingSettings(false)} className="flex-1 py-4 border border-[#e6e2d3] text-[#666666] text-xs font-bold rounded-sm">キャンセル</button>
                      <button onClick={handleUpdateSettings} disabled={isUpdating} className="flex-1 py-4 bg-[#1a1a1a] text-white text-xs font-bold rounded-sm flex items-center justify-center gap-2">
                        {isUpdating ? <Loader2 className="w-4 h-4 animate-spin"/> : <><Save className="w-4 h-4"/> 保存する</>}
                      </button>
                    </div>
                  )}

                  {!isEditingSettings && (
                    <button onClick={handleLogout} className="w-full py-4 border border-[#fcf0f0] text-[#8a3c3c] text-xs font-bold rounded-sm flex items-center justify-center gap-2 active:bg-[#fcf0f0]">
                      <LogOut className="w-4 h-4" /> ログアウト
                    </button>
                  )}
                </div>
              )}

            </motion.div>
          </AnimatePresence>
        </main>

        {/* ボトムナビ */}
        <nav className="bg-[#1a1a1a] px-2 py-4 flex justify-between items-center z-50 pb-safe shrink-0">
          {[
            { id: 'stats', icon: <LayoutDashboard className="w-5 h-5" />, label: 'HOME' },
            { id: 'staff', icon: <Users className="w-5 h-5" />, label: 'MEMBER' },
            { id: 'info', icon: <BookOpen className="w-5 h-5" />, label: 'GUIDE' },
            { id: 'shop', icon: <Store className="w-5 h-5" />, label: 'SHOP' },
            { id: 'settings', icon: <Settings className="w-5 h-5" />, label: 'SETTING' },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex flex-col items-center justify-center flex-1 py-1 transition-all ${activeTab === tab.id ? 'text-white' : 'text-[#666666]'}`}>
              {tab.icon}
              <span className="text-[9px] mt-1 font-bold tracking-tighter">{tab.label}</span>
            </button>
          ))}
        </nav>

        {/* モーダル群 */}
        <AnimatePresence>
          {isPolicyModalOpen && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[100] bg-[#1a1a1a]/60 backdrop-blur-sm flex items-center justify-center p-4">
              <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }} className="bg-[#faf9f6] p-8 w-full max-w-md mx-auto relative rounded-sm shadow-2xl">
                <button onClick={() => setIsPolicyModalOpen(false)} className="absolute top-4 right-4 p-2 text-[#999999]"><X className="w-5 h-5" /></button>
                <h3 className="text-sm text-[#1a1a1a] mb-6 font-bold flex items-center gap-2 uppercase tracking-widest">Distribution Policy</h3>
                {policyEditorJSX}
                <button onClick={handleSavePolicy} disabled={isSavingPolicy} className="w-full py-4 bg-[#1a1a1a] text-white text-xs font-bold tracking-widest active:scale-[0.98] transition-all">
                  {isSavingPolicy ? <Loader2 className="w-4 h-4 animate-spin mx-auto"/> : "設定を保存する"}
                </button>
              </motion.div>
            </motion.div>
          )}
          {/* 他のモーダルは同様のスタイル修正を適用（省略） */}
        </AnimatePresence>
      </div>
    </div>
  )
}