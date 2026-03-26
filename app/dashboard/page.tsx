'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { QRCodeCanvas } from 'qrcode.react'
import { motion, AnimatePresence } from 'framer-motion'

import { 
  RefreshCw, LogOut, Clock, CheckCircle2, Wallet, 
  CheckCheck, Users, Plus, Crown, Settings, Link as LinkIcon, 
  QrCode, Trash2, Coins, Smartphone, ClipboardList, X, Ban, Trophy, Calendar, LayoutDashboard, Share, Edit2, Loader2
} from 'lucide-react'

const generateSecureToken = () => {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

const STATUS_MAP: any = {
  pending: { label: '仮計上', color: 'bg-amber-50 text-amber-700 border-amber-100', icon: <Clock className="w-3 h-3" /> },
  confirmed: { label: '確定', color: 'bg-emerald-50 text-emerald-700 border-emerald-100', icon: <CheckCircle2 className="w-3 h-3" /> },
  issued: { label: '清算待ち', color: 'bg-blue-50 text-blue-700 border-blue-100', icon: <Wallet className="w-3 h-3" /> },
  cancel: { label: 'キャンセル', color: 'bg-red-50 text-red-600 border-red-100', icon: <Ban className="w-3 h-3" /> },
}

export default function OwnerDashboard() {
  const [activeTab, setActiveTab] = useState<'stats' | 'history' | 'staff'>('stats')

  const [shop, setShop] = useState<any>(null)
  const [rank, setRank] = useState<any>(null)
  const [staffs, setStaffs] = useState<any[]>([])
  const [referralHistory, setReferralHistory] = useState<any[]>([])
 
  const [ratios, setRatios] = useState({ individual: 100, team: 0, owner: 0 })
  const [isSavingPolicy, setIsSavingPolicy] = useState(false)
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false)

  const [filterStatus, setFilterStatus] = useState('') 
  const [visibleCount, setVisibleCount] = useState(20) 

  // モーダル管理ステート
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false)
  const [newStaffName, setNewStaffName] = useState('')
  const [newStaffEmail, setNewStaffEmail] = useState('')
  
  const [isQrModalOpen, setIsQrModalOpen] = useState(false)
  const [selectedStaff, setSelectedStaff] = useState<any>(null)
  
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false)

  const [detailStaff, setDetailStaff] = useState<any>(null)

  const [summary, setSummary] = useState({
    totalEarned: 0, thisMonthEarned: 0, pendingPoints: 0, confirmedPoints: 0, issuedPoints: 0, rewardedPoints: 0, canceledPoints: 0,
  })
  
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  const loadData = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return; }

    const { data: shopData } = await supabase
      .from('shops')
      .select(`*, shop_ranks (*), ratio_individual, ratio_team, ratio_owner`)
      .eq('owner_id', user.id)
      .maybeSingle()

    if (!shopData) { setLoading(false); return; }
    
    setShop(shopData)
    setRank(shopData.shop_ranks)
    
    setRatios({
      individual: shopData.ratio_individual ?? 100,
      team: shopData.ratio_team ?? 0,
      owner: shopData.ratio_owner ?? 0
    })

    const currentRewardPoints = shopData.shop_ranks?.reward_points || 5000

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

    const enrichedReferrals = reversedLogs.map(log => {
      staffCounters[log.staff_id] = (staffCounters[log.staff_id] || 0) + 1;
      const refTxs = pointLogs.filter(tx => tx.referral_id === log.id && (tx.status === 'confirmed' || tx.status === 'paid'));
      
      const basePoints = currentRewardPoints;
      const indPart = basePoints * (ratios.individual / 100);
      const teamPart = (basePoints * (ratios.team / 100)) / staffCount;
      const ownerPart = basePoints * (ratios.owner / 100);

      const isOwnerAction = staffList.find(s => s.id === log.staff_id)?.email === shopData.owner_email;

      const calculatedPoints = isOwnerAction 
        ? Math.floor(indPart + teamPart + ownerPart) 
        : Math.floor(indPart + teamPart);

      const totalPointsInTx = refTxs.reduce((sum, tx) => sum + (Number(tx.points) || 0), 0);
      const hasBonus = refTxs.some(tx => tx.metadata?.is_bonus === true);

      return {
        ...log,
        staffName: staffList.find(s => s.id === log.staff_id)?.name || '不明',
        staffNthCount: staffCounters[log.staff_id],
        totalPoints: log.status === 'pending' ? calculatedPoints : totalPointsInTx,
        hasBonus
      }
    }).reverse();

    setReferralHistory(enrichedReferrals)

    const staffsWithFinance = staffList.map(s => {
      const staffRefs = enrichedReferrals.filter(r => r.staff_id === s.id);
      const pendingPts = staffRefs.filter(r => r.status === 'pending').reduce((sum, r) => sum + r.totalPoints, 0);
      const unpaidToStaffPts = staffRefs.filter(r => r.status === 'issued' && !r.is_staff_rewarded).reduce((sum, r) => sum + r.totalPoints, 0);
      const isOwner = s.email === shopData.owner_email;

      return {
        ...s,
        count: staffRefs.filter(r => r.status !== 'cancel').length,
        pendingPts, unpaidToStaffPts,
        hasUnpaid: unpaidToStaffPts > 0,
        isOwner
      }
    })
    setStaffs(staffsWithFinance)

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const validRefs = enrichedReferrals.filter(r => r.status !== 'cancel');
    const earnedRefs = validRefs.filter(r => r.status === 'issued' || r.is_staff_rewarded);

    setSummary({
      totalEarned: earnedRefs.reduce((sum, r) => sum + r.totalPoints, 0),
      thisMonthEarned: earnedRefs.filter(r => {
        const d = new Date(r.created_at);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      }).reduce((sum, r) => sum + r.totalPoints, 0),
      pendingPoints: validRefs.filter(r => r.status === 'pending').reduce((sum, r) => sum + r.totalPoints, 0),
      confirmedPoints: validRefs.filter(r => r.status === 'confirmed').reduce((sum, r) => sum + r.totalPoints, 0),
      issuedPoints: validRefs.filter(r => r.status === 'issued' && !r.is_staff_rewarded).reduce((sum, r) => sum + r.totalPoints, 0),
      rewardedPoints: validRefs.filter(r => r.is_staff_rewarded).reduce((sum, r) => sum + r.totalPoints, 0),
      canceledPoints: enrichedReferrals.filter(r => r.status === 'cancel').reduce((sum, r) => sum + r.totalPoints, 0),
    })
    
    setLoading(false)
  }

  const handleSliderChange = (key: 'individual' | 'team', value: number) => {
    setRatios(prev => {
      let nextInd = key === 'individual' ? value : prev.individual;
      let nextTeam = key === 'team' ? value : prev.team;
      if (nextInd + nextTeam > 100) {
        if (key === 'individual') nextTeam = 100 - nextInd;
        else nextInd = 100 - nextTeam;
      }
      return { individual: nextInd, team: nextTeam, owner: 100 - (nextInd + nextTeam) }
    });
  };

  const handleSavePolicy = async () => {
    setIsSavingPolicy(true);
    const { error } = await supabase.from('shops').update({
      ratio_individual: ratios.individual, ratio_team: ratios.team, ratio_owner: ratios.owner
    }).eq('id', shop.id);

    if (error) alert('保存に失敗しました');
    else { alert('報酬ポリシーを更新しました！'); await loadData(); }
    setIsSavingPolicy(false);
    setIsPolicyModalOpen(false);
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newStaffName.trim() || !newStaffEmail.trim()) return alert('名前とメールアドレスを入力してください。');
    
    const maxNum = staffs.reduce((max, s) => {
      const num = parseInt(s.id.replace('ST', ''), 10)
      return !isNaN(num) && num > max ? num : max
    }, 0)
    const nextStaffId = `ST${(maxNum + 1).toString().padStart(3, '0')}`
    const secureToken = generateSecureToken()

    const { error } = await supabase.from('staffs').insert([{ 
      id: nextStaffId, shop_id: shop.id, name: newStaffName, email: newStaffEmail, 
      referral_code: `${shop.id}_${nextStaffId}`, secret_token: secureToken, is_deleted: false 
    }])

    if (error) { alert(`追加に失敗しました。\n${error.message}`); return; }
    
    setNewStaffName(''); setNewStaffEmail(''); setIsStaffModalOpen(false);
    await loadData();
  }

  const handleDeleteStaff = async (staffId: string, staffName: string) => {
    if (!confirm(`スタッフ「${staffName}」を非表示にしますか？`)) return
    await supabase.from('staffs').update({ is_deleted: true }).eq('id', staffId)
    setDetailStaff(null)
    await loadData()
  }

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    alert('URLをコピーしました！')
  }

  useEffect(() => { loadData() }, [router])

  const filteredHistory = useMemo(() => {
    return referralHistory.filter(item => {
      const effectiveStatus = item.is_staff_rewarded ? 'rewarded' : item.status;
      if (filterStatus === '') return true;
      return effectiveStatus === filterStatus;
    })
  }, [referralHistory, filterStatus])
  
  const ownerStaff = staffs.find(s => s.isOwner);

  if (loading) return <div className="fixed inset-0 flex items-center justify-center bg-gray-100"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>
  if (!shop) return <div className="fixed inset-0 flex items-center justify-center bg-gray-100 text-red-500">店舗情報が見つかりません。</div>

  return (
    // ★ 変更点: 外側のラッパーを fixed inset-0 にして画面スクロールを完全にロック
    <div className="fixed inset-0 bg-gray-200 flex justify-center font-sans text-gray-800">
      {/* ★ 変更点: h-full と overflow-hidden を追加し、メインエリアだけスクロールさせる */}
      <div className="w-full max-w-md bg-gray-50 h-full relative shadow-2xl flex flex-col overflow-hidden">
        
        {/* メインコンテンツエリア（ここだけスクロール可能） */}
        <main className="flex-1 overflow-y-auto pb-6 pt-safe-top">
          
          {/* =========================================
              タブ: Stats (ホーム)
          ========================================= */}
          {activeTab === 'stats' && (
            <div className="p-5 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              
              {/* ヘッダーカード */}
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full blur-3xl -mr-10 -mt-10" />
                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h1 className="text-xl font-black text-gray-900 tracking-tight">{shop.name}</h1>
                        {rank && <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 text-[10px] font-bold rounded-full">{rank.label}</span>}
                      </div>
                      <p className="text-[10px] text-gray-400 font-mono">ID: {shop.id}</p>
                    </div>
                    <button onClick={() => supabase.auth.signOut().then(() => router.push('/login'))} className="p-2 bg-gray-50 text-gray-400 rounded-full hover:bg-gray-100 transition">
                      <LogOut className="w-4 h-4" />
                    </button>
                  </div>
                  
                  {ownerStaff?.secret_token && (
                    <button onClick={() => window.open(`/m/${ownerStaff.secret_token}`, '_blank')} className="w-full mt-2 py-3 bg-gray-900 text-white text-xs font-bold rounded-xl shadow-md hover:bg-gray-800 transition flex items-center justify-center gap-2 active:scale-95">
                      <Smartphone className="w-4 h-4" /> 接客用マイページを開く
                    </button>
                  )}
                </div>
              </div>

              {/* サマリーウィジェット */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-indigo-600 text-white p-5 rounded-3xl shadow-lg shadow-indigo-200">
                  <p className="text-[10px] font-bold opacity-80 mb-1 flex items-center gap-1"><Trophy className="w-3 h-3"/> 累計獲得報酬</p>
                  <p className="text-2xl font-black tabular-nums tracking-tight">{summary.totalEarned.toLocaleString()}<span className="text-[10px] ml-1 font-medium opacity-80">pt</span></p>
                </div>
                <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100">
                  <p className="text-[10px] font-bold text-gray-500 mb-1 flex items-center gap-1"><Calendar className="w-3 h-3 text-emerald-500"/> 今月の獲得</p>
                  <p className="text-2xl font-black text-gray-800 tabular-nums tracking-tight">{summary.thisMonthEarned.toLocaleString()}<span className="text-[10px] ml-1 font-medium text-gray-400">pt</span></p>
                </div>
              </div>

              {/* ポリシーサマリー */}
              <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-xs font-bold text-gray-900 flex items-center gap-1"><Coins className="w-4 h-4 text-amber-500" /> 報酬分配ポリシー</h3>
                  <button onClick={() => setIsPolicyModalOpen(true)} className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-full">変更</button>
                </div>
                <div className="flex h-2.5 w-full rounded-full overflow-hidden bg-gray-100 mb-2">
                  <div style={{width: `${ratios.individual}%`}} className="bg-indigo-500" />
                  <div style={{width: `${ratios.team}%`}} className="bg-emerald-400" />
                  <div style={{width: `${ratios.owner}%`}} className="bg-gray-300" />
                </div>
                <div className="flex justify-between text-[9px] font-bold text-gray-500">
                  <span className="text-indigo-600">本人 {ratios.individual}%</span>
                  <span className="text-emerald-600">チーム {ratios.team}%</span>
                  <span className="text-gray-500">店舗 {ratios.owner}%</span>
                </div>
              </div>

            </div>
          )}

          {/* =========================================
              タブ: History (明細)
          ========================================= */}
          {activeTab === 'history' && (
            <div className="p-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <h2 className="text-lg font-black text-gray-900 mb-4 flex items-center gap-2"><ClipboardList className="w-5 h-5 text-indigo-500" /> アクション明細</h2>
              
              <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide -mx-5 px-5">
                {[
                  { id: '', label: 'すべて', count: referralHistory.length, color: 'bg-white text-gray-700 border-gray-200' },
                  { id: 'pending', label: '仮計上', count: summary.pendingPoints, color: 'bg-amber-50 text-amber-700 border-amber-200' },
                  { id: 'confirmed', label: '確定', count: summary.confirmedPoints, color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
                  { id: 'issued', label: '清算待ち', count: summary.issuedPoints, color: 'bg-blue-50 text-blue-700 border-blue-200' },
                ].map(f => (
                  <button key={f.id} onClick={() => setFilterStatus(f.id)} className={`flex-shrink-0 px-4 py-2.5 rounded-2xl border text-left min-w-[100px] transition-all ${filterStatus === f.id ? 'ring-2 ring-indigo-500 shadow-md ' + f.color : 'bg-white border-gray-100 text-gray-500 hover:bg-gray-50'}`}>
                    <p className="text-[10px] font-bold mb-0.5">{f.label}</p>
                    <p className="text-sm font-black tabular-nums">{f.id === '' ? f.count : f.count.toLocaleString()}<span className="text-[9px] font-normal ml-0.5">{f.id === '' ? '件' : 'pt'}</span></p>
                  </button>
                ))}
              </div>

              <div className="space-y-3">
                {filteredHistory.slice(0, visibleCount).map(item => {
                  const status = STATUS_MAP[item.status] || { label: item.status, color: 'bg-gray-100 border-gray-200 text-gray-500' };
                  const isPaid = item.is_staff_rewarded;
                  return (
                    <div key={item.id} className={`bg-white p-4 rounded-2xl border shadow-sm flex items-center justify-between ${item.status === 'cancel' ? 'border-red-100 bg-red-50/30 opacity-75' : 'border-gray-100'}`}>
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 mb-1">{new Date(item.created_at).toLocaleDateString('ja-JP')} {new Date(item.created_at).toLocaleTimeString('ja-JP', {hour:'2-digit', minute:'2-digit'})}</p>
                        <p className="text-sm font-bold text-gray-800 mb-1">{item.staffName}</p>
                        <div className="flex items-center gap-1.5">
                          {isPaid ? (
                            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200 flex items-center gap-1"><CheckCheck className="w-3 h-3"/> 清算済</span>
                          ) : (
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${status.color}`}>{status.icon} {status.label}</span>
                          )}
                          <span className="text-[9px] font-bold text-gray-400">ID:{item.order_number || '---'}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-lg font-black tabular-nums ${item.status === 'cancel' ? 'line-through text-gray-300' : 'text-indigo-600'}`}>
                          +{item.totalPoints.toLocaleString()}<span className="text-[10px] ml-0.5">pt</span>
                        </p>
                      </div>
                    </div>
                  )
                })}
                {filteredHistory.length > visibleCount && (
                  <button onClick={() => setVisibleCount(v => v + 20)} className="w-full py-3 bg-white border border-gray-200 text-gray-500 text-xs font-bold rounded-xl hover:bg-gray-50 transition">
                    さらに表示する
                  </button>
                )}
                {filteredHistory.length === 0 && (
                  <div className="text-center py-10 text-gray-400 text-xs font-bold">該当するデータがありません</div>
                )}
              </div>
            </div>
          )}

          {/* =========================================
              タブ: Staff (スタッフ管理)
          ========================================= */}
          {activeTab === 'staff' && (
            <div className="p-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex justify-between items-end mb-4">
                <h2 className="text-lg font-black text-gray-900 flex items-center gap-2"><Users className="w-5 h-5 text-indigo-500" /> メンバー</h2>
                <div className="flex gap-2">
                  <button onClick={() => setIsInviteModalOpen(true)} className="p-2 bg-indigo-50 text-indigo-600 rounded-full hover:bg-indigo-100 transition"><QrCode className="w-4 h-4" /></button>
                  <button onClick={() => setIsStaffModalOpen(true)} className="p-2 bg-gray-900 text-white rounded-full hover:bg-gray-800 transition shadow-md"><Plus className="w-4 h-4" /></button>
                </div>
              </div>

              <div className="space-y-3">
                {staffs.filter(s => !s.is_deleted).sort((a, b) => b.count - a.count).map(s => (
                  <div key={s.id} className={`bg-white rounded-2xl border shadow-sm p-4 flex items-center justify-between ${s.isOwner ? 'border-indigo-200 bg-indigo-50/10' : 'border-gray-100'}`}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-gray-200 to-gray-300 flex items-center justify-center text-white font-bold shadow-inner">
                        {s.name.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <h3 className="font-bold text-gray-900 text-sm">{s.name}</h3>
                          {s.isOwner && <Crown className="w-3 h-3 text-amber-500" />}
                        </div>
                        <p className="text-[10px] text-gray-500 flex gap-2">
                          <span>獲得: {s.count}件</span>
                          <span className={s.hasUnpaid ? 'text-blue-600 font-bold' : ''}>未清算: {s.unpaidToStaffPts.toLocaleString()}pt</span>
                        </p>
                      </div>
                    </div>
                    <button onClick={() => setDetailStaff(s)} className="p-2 text-gray-400 hover:text-gray-600 bg-gray-50 rounded-full transition">
                      <Settings className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

        </main>

        {/* =========================================
            ボトムナビゲーション
        ========================================= */}
        <nav className="bg-white border-t border-gray-100 flex justify-around items-center px-2 pb-safe z-40 shadow-[0_-10px_40px_rgba(0,0,0,0.04)] shrink-0">
          {[
            { id: 'stats', icon: <LayoutDashboard className="w-6 h-6" />, label: 'ホーム' },
            { id: 'history', icon: <ClipboardList className="w-6 h-6" />, label: '明細' },
            { id: 'staff', icon: <Users className="w-6 h-6" />, label: 'メンバー' },
          ].map(tab => (
            <button 
              key={tab.id} onClick={() => setActiveTab(tab.id as any)}
              className={`flex flex-col items-center justify-center w-full py-3 gap-1 transition-colors ${activeTab === tab.id ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <div className={`transition-transform duration-200 ${activeTab === tab.id ? 'scale-110' : 'scale-100'}`}>
                {tab.icon}
              </div>
              <span className="text-[9px] font-bold">{tab.label}</span>
            </button>
          ))}
        </nav>

        {/* =========================================
            モーダル群 (AnimatePresenceで管理)
        ========================================= */}
        <AnimatePresence>
          
          {/* 1. ポリシー設定モーダル */}
          {isPolicyModalOpen && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4">
              <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} className="bg-white rounded-[2rem] p-6 w-full shadow-2xl relative">
                <button onClick={() => setIsPolicyModalOpen(false)} className="absolute top-4 right-4 p-2 text-gray-400 hover:bg-gray-100 rounded-full"><X className="w-5 h-5" /></button>
                <h3 className="text-lg font-black text-gray-900 mb-6">分配ポリシーの設定</h3>
                
                <div className="space-y-6 mb-8">
                  <div>
                    <div className="flex justify-between items-end mb-2">
                      <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-indigo-500" /> 本人へ還元</label>
                      <span className="text-xl font-black text-indigo-600 tabular-nums">{ratios.individual}%</span>
                    </div>
                    <input type="range" min="0" max="100" step="5" value={ratios.individual} onChange={(e) => handleSliderChange('individual', parseInt(e.target.value))} className="w-full h-2 bg-gray-100 rounded-lg appearance-none accent-indigo-600" />
                  </div>
                  <div>
                    <div className="flex justify-between items-end mb-2">
                      <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-400" /> チーム分配</label>
                      <span className="text-xl font-black text-emerald-500 tabular-nums">{ratios.team}%</span>
                    </div>
                    <input type="range" min="0" max="100" step="5" value={ratios.team} onChange={(e) => handleSliderChange('team', parseInt(e.target.value))} className="w-full h-2 bg-gray-100 rounded-lg appearance-none accent-emerald-400" />
                  </div>
                  <div className="p-4 bg-gray-50 rounded-xl flex justify-between items-center border border-gray-100">
                    <span className="text-[10px] font-bold text-gray-500">店舗 留保分 (自動計算)</span>
                    <span className="text-lg font-bold text-gray-900">{ratios.owner}%</span>
                  </div>
                </div>
                <button onClick={handleSavePolicy} disabled={isSavingPolicy} className="w-full py-4 bg-indigo-600 text-white font-bold rounded-xl shadow-lg active:scale-95 transition">
                  {isSavingPolicy ? "保存中..." : "この設定で確定する"}
                </button>
              </motion.div>
            </motion.div>
          )}

          {/* 2. スタッフ追加モーダル */}
          {isStaffModalOpen && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50 bg-gray-900/60 backdrop-blur-sm flex flex-col justify-end">
              <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} className="bg-white rounded-t-[2rem] p-6 w-full shadow-2xl">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-black text-gray-900">メンバーの直接追加</h3>
                  <button onClick={() => setIsStaffModalOpen(false)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-full"><X className="w-5 h-5" /></button>
                </div>
                <form onSubmit={handleAddStaff} className="space-y-4 mb-6">
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 mb-1 block">お名前</label>
                    <input required placeholder="山田 太郎" value={newStaffName} onChange={e => setNewStaffName(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 mb-1 block">メールアドレス</label>
                    <input required type="email" placeholder="example@email.com" value={newStaffEmail} onChange={e => setNewStaffEmail(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                  </div>
                  <button type="submit" className="w-full mt-4 py-4 bg-gray-900 text-white font-bold rounded-xl shadow-lg active:scale-95 transition">追加する</button>
                </form>
              </motion.div>
            </motion.div>
          )}

          {/* 3. 店舗招待QRモーダル (invite_tokenを使用) */}
          {isInviteModalOpen && shop?.invite_token && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50 bg-indigo-600/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-white">
              <h2 className="text-2xl font-black mb-2">メンバー招待QR</h2>
              <p className="text-xs font-medium mb-8 opacity-80 text-center">スタッフにこのQRを読み込んでもらい、<br/>登録を完了させてください。</p>
              
              <div className="bg-white p-6 rounded-[2rem] shadow-2xl relative mb-8">
                <QRCodeCanvas value={`${window.location.origin}/reg/${shop.invite_token}`} size={200} level="H" fgColor="#1e1b4b" />
              </div>
              
              <button onClick={() => handleCopy(`${window.location.origin}/reg/${shop.invite_token}`)} className="w-full max-w-xs py-4 bg-white/10 border border-white/20 text-white rounded-xl font-bold shadow-lg active:scale-95 transition flex items-center justify-center gap-2 mb-4">
                <Share className="w-4 h-4" /> 招待URLをコピーする
              </button>

              <button onClick={() => setIsInviteModalOpen(false)} className="w-full max-w-xs py-4 bg-white text-indigo-600 rounded-xl font-bold shadow-lg active:scale-95 transition">
                閉じる
              </button>
            </motion.div>
          )}

          {/* 4. スタッフ詳細＆QRモーダル */}
          {detailStaff && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50 bg-gray-900/60 backdrop-blur-sm flex flex-col justify-end">
              <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} className="bg-white rounded-t-[2rem] p-6 w-full shadow-2xl pb-safe">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-black text-gray-900">{detailStaff.name} の情報</h3>
                  <button onClick={() => setDetailStaff(null)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-full"><X className="w-5 h-5" /></button>
                </div>
                
                <div className="flex justify-center mb-6">
                  <div className="p-3 bg-white rounded-[1.5rem] shadow-md border border-gray-100">
                    <QRCodeCanvas value={`${window.location.origin}/welcome/${detailStaff.referral_code}`} size={140} level="H" fgColor="#1e1b4b" />
                  </div>
                </div>

                <div className="space-y-3 mb-6">
                  <button onClick={() => handleCopy(`${window.location.origin}/welcome/${detailStaff.referral_code}`)} className="w-full py-3 bg-indigo-50 text-indigo-600 font-bold rounded-xl flex items-center justify-center gap-2 active:scale-95 transition">
                    <LinkIcon className="w-4 h-4" /> 接客用URLをコピー
                  </button>
                  <button onClick={() => handleCopy(`${window.location.origin}/m/${detailStaff.secret_token}`)} className="w-full py-3 bg-gray-50 text-gray-700 font-bold rounded-xl flex items-center justify-center gap-2 active:scale-95 transition">
                    <Edit2 className="w-4 h-4" /> 本人のマイページURLをコピー
                  </button>
                </div>

                {!detailStaff.isOwner && (
                  <button onClick={() => handleDeleteStaff(detailStaff.id, detailStaff.name)} className="w-full py-3 border border-red-100 text-red-500 font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-red-50 transition mt-4">
                    <Trash2 className="w-4 h-4" /> このメンバーを削除
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