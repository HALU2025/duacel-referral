'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { QRCodeCanvas } from 'qrcode.react'

import { 
  RefreshCw, LogOut, Clock, CheckCircle2, Wallet, 
  CheckCheck, Users, Plus, Crown, Settings, Link as LinkIcon, 
  QrCode, Trash2, Coins, Smartphone, ClipboardList, X, Ban, Trophy, Calendar, Info, Save, Key, UserCircle, LayoutDashboard
} from 'lucide-react'

// ★ 前のステップで作成したBottomNavを読み込みます
import { BottomNav } from '@/components/BottomNav'

const generateSecureToken = () => {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

const STATUS_MAP: any = {
  pending: { label: '仮計上', color: 'bg-amber-50 text-amber-700 border-amber-100', icon: <Clock className="w-3 h-3" /> },
  confirmed: { label: '確定(未入金)', color: 'bg-emerald-50 text-emerald-700 border-emerald-100', icon: <CheckCircle2 className="w-3 h-3" /> },
  issued: { label: '清算待ち', color: 'bg-blue-50 text-blue-700 border-blue-100', icon: <Wallet className="w-3 h-3" /> },
  cancel: { label: 'キャンセル', color: 'bg-red-50 text-red-600 border-red-100', icon: <Ban className="w-3 h-3" /> },
}

export default function OwnerDashboard() {
  // ★ アプリ化のためのタブ管理ステート
  const [activeTab, setActiveTab] = useState('stats')

  const [shop, setShop] = useState<any>(null)
  const [rank, setRank] = useState<any>(null)
  const [staffs, setStaffs] = useState<any[]>([])
  const [referralHistory, setReferralHistory] = useState<any[]>([])
 
  const [ratios, setRatios] = useState({ individual: 100, team: 0, owner: 0 })
  const [isSavingPolicy, setIsSavingPolicy] = useState(false)
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false)

  const [filterStatus, setFilterStatus] = useState('') 
  const [visibleCount, setVisibleCount] = useState(15) 

  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false)
  const [newStaffName, setNewStaffName] = useState('')
  const [newStaffEmail, setNewStaffEmail] = useState('')
  
  const [isQrModalOpen, setIsQrModalOpen] = useState(false)
  const [selectedStaff, setSelectedStaff] = useState<any>(null)
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false)

  const [detailStaff, setDetailStaff] = useState<any>(null)
  const [detailTab, setDetailTab] = useState<'history' | 'settings'>('history')
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')

  const [summary, setSummary] = useState({
    totalEarned: 0,
    thisMonthEarned: 0,
    pendingPoints: 0,
    confirmedPoints: 0,
    issuedPoints: 0,
    rewardedPoints: 0,
    canceledPoints: 0,
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
      supabase.from('staffs').select('id, name, email, is_deleted, secret_token, referral_code').eq('shop_id', shopData.id),
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
        isOwner,
        secret_token: s.secret_token,
        referral_code: s.referral_code
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
      return {
        individual: nextInd,
        team: nextTeam,
        owner: 100 - (nextInd + nextTeam)
      }
    });
  };

  const handleSavePolicy = async () => {
    setIsSavingPolicy(true);
    const { error } = await supabase
      .from('shops')
      .update({
        ratio_individual: ratios.individual,
        ratio_team: ratios.team,
        ratio_owner: ratios.owner
      })
      .eq('id', shop.id);

    if (error) alert('保存に失敗しました');
    else { alert('報酬ポリシーを更新しました！'); await loadData(); }
    setIsSavingPolicy(false);
  };

  useEffect(() => { loadData() }, [router])

  const handlePayStaff = async (staffId: string, staffName: string, amount: number) => {
    if (!confirm(`【精算確認】\n\n${staffName} さんに ${amount.toLocaleString()} pt 分の還元を行いましたか？`)) return
    const { error } = await supabase.from('referrals').update({ is_staff_rewarded: true }).eq('staff_id', staffId).eq('status', 'issued').eq('is_staff_rewarded', false)
    if (error) { alert('精算処理に失敗しました。'); return; }
    alert(`${staffName} さんの精算処理が完了しました！`);
    await loadData()
  }

  const handleAddStaff = async () => {
    if (!newStaffName.trim() || !newStaffEmail.trim()) return alert('名前とメールアドレスを入力してください。');
    if (!shop?.id) return alert('店舗情報が読み込めていません。');

    const maxNum = staffs.reduce((max, s) => {
      const num = parseInt(s.id.replace('ST', ''), 10)
      return !isNaN(num) && num > max ? num : max
    }, 0)
    const nextStaffId = `ST${(maxNum + 1).toString().padStart(3, '0')}`
    const secureToken = generateSecureToken()

    const { error } = await supabase.from('staffs').insert([{ 
      id: nextStaffId, 
      shop_id: shop.id, 
      name: newStaffName, 
      email: newStaffEmail, 
      referral_code: `${shop.id}_${nextStaffId}`, 
      secret_token: secureToken,
      is_deleted: false 
    }])

    if (error) { alert(`追加に失敗しました。\n理由: ${error.message}`); return; }
    
    setNewStaffName(''); setNewStaffEmail(''); setIsStaffModalOpen(false);
    await loadData();
  }

  const handleDeleteStaff = async (staffId: string, staffName: string) => {
    if (!confirm(`スタッフ「${staffName}」を非表示にしますか？`)) return
    const { error } = await supabase.from('staffs').update({ is_deleted: true }).eq('id', staffId)
    if (error) { alert('非表示処理に失敗しました。'); return; }
    await loadData()
  }

  const handleCopyUrl = (staff: any) => {
    if (!staff?.referral_code) return;
    navigator.clipboard.writeText(`${window.location.origin}/welcome/${staff.referral_code}`)
    alert('紹介用URLをコピーしました！')
  }

  const filteredHistory = useMemo(() => {
    return referralHistory.filter(item => {
      const effectiveStatus = item.is_staff_rewarded ? 'rewarded' : item.status;
      if (filterStatus === '') return true;
      return effectiveStatus === filterStatus;
    })
  }, [referralHistory, filterStatus])
  
  const displayedHistory = filteredHistory.slice(0, visibleCount)

  const ownerStaff = staffs.find(s => s.isOwner);

  if (loading) return <div className="p-12 text-center text-gray-500 text-sm flex items-center justify-center gap-2"><RefreshCw className="w-4 h-4 animate-spin" /> データを読み込み中...</div>
  if (!shop) return <div className="p-12 text-center text-red-500">店舗情報が見つかりません。</div>

  return (
    // ★ pb-24 を追加して、スマホでボトムナビが被らないようにします
    <div className="p-6 md:p-10 max-w-screen-2xl mx-auto bg-gray-50 min-h-screen text-gray-800 relative pb-24 md:pb-10">
      
      {/* =========================================
          タブ: Stats (状況) または Me (マイ) の時に表示
          ※ PC(md:block)の時は常に表示されます
      ========================================= */}
      <div className={`md:block ${['stats', 'me'].includes(activeTab) ? 'block' : 'hidden'}`}>
        <header className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 border-b border-gray-200 pb-6 mb-8 bg-white p-6 rounded-2xl shadow-sm">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-gray-900">{shop.name}</h1>
              {rank && <span className="px-3 py-1 bg-indigo-100 text-indigo-800 text-xs font-bold rounded-full">{rank.label}会員</span>}
            </div>
            <p className="text-xs text-gray-400 font-mono">Shop ID: {shop.id}</p>
            
            {ownerStaff?.secret_token && (
              <button 
                onClick={() => window.open(`/m/${ownerStaff.secret_token}`, '_blank')}
                className="mt-3 text-xs px-3 py-1.5 bg-indigo-50 text-indigo-700 font-bold rounded-lg border border-indigo-100 hover:bg-indigo-100 transition flex items-center gap-1 w-max"
              >
                <Smartphone className="w-3 h-3" /> 接客用マイページを開く
              </button>
            )}
          </div>
          
          <div className="flex flex-wrap items-center gap-4 xl:gap-8 bg-gray-50 p-3 rounded-xl border border-gray-100">
            <div className="flex items-center gap-3 pr-4 xl:pr-8 border-r border-gray-200">
              <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg"><Trophy className="w-6 h-6" /></div>
              <div>
                <p className="text-[10px] font-bold text-gray-500">累計 獲得報酬</p>
                <p className="text-2xl font-extrabold text-indigo-700 tabular-nums leading-none mt-1">{summary.totalEarned.toLocaleString()}<span className="text-xs ml-1 font-normal text-gray-500">pt</span></p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white text-gray-400 border border-gray-200 rounded-lg"><Calendar className="w-5 h-5" /></div>
              <div>
                <p className="text-[10px] font-bold text-gray-500">今月 の獲得</p>
                <p className="text-xl font-bold text-gray-700 tabular-nums leading-none mt-1">{summary.thisMonthEarned.toLocaleString()}<span className="text-xs ml-1 font-normal text-gray-400">pt</span></p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={loadData} className="text-sm text-gray-500 hover:text-gray-800 transition flex items-center gap-1"><RefreshCw className="w-4 h-4" /> 更新</button>
            <button onClick={() => supabase.auth.signOut().then(() => router.push('/login'))} className="text-sm px-4 py-2 bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-gray-50 transition font-medium flex items-center gap-2"><LogOut className="w-4 h-4 text-gray-400" /> ログアウト</button>
          </div>
        </header>

        {/* ポリシーサマリー表示 */}
        <section className="mb-8 p-5 bg-white rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-50 rounded-xl">
              <Coins className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-gray-900">報酬分配ポリシー</h4>
              <div className="flex items-center gap-3 mt-1">
                <div className="flex h-1.5 w-24 rounded-full overflow-hidden bg-gray-100">
                  <div style={{width: `${ratios.individual}%`}} className="bg-indigo-500" />
                  <div style={{width: `${ratios.team}%`}} className="bg-emerald-400" />
                  <div style={{width: `${ratios.owner}%`}} className="bg-gray-200" />
                </div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">
                  本人{ratios.individual} / チーム{ratios.team} / 管理者{ratios.owner}
                </p>
              </div>
            </div>
          </div>
          <button onClick={() => setIsPolicyModalOpen(true)} className="px-4 py-2 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition">設定を変更</button>
        </section>
      </div>

      {/* =========================================
          タブ: History (明細) の時に表示
      ========================================= */}
      <div className={`md:block ${activeTab === 'history' ? 'block' : 'hidden'}`}>
        <div className="mb-12">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2"><ClipboardList className="w-5 h-5" /> 紹介アクション明細</h2>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gray-50/50 border-b border-gray-200 p-2 flex flex-wrap gap-2">
              <button onClick={() => setFilterStatus('')} className={`flex-1 min-w-[120px] p-3 rounded-xl border text-left transition-all ${filterStatus === '' ? 'bg-white border-gray-300 shadow-sm ring-1 ring-gray-200' : 'border-transparent hover:bg-gray-100'}`}>
                <p className="text-[10px] font-bold text-gray-500 mb-1">すべて表示</p>
                <p className="text-lg font-bold text-gray-700 tabular-nums">{referralHistory.length}<span className="text-[10px] ml-1 font-normal">件</span></p>
              </button>
              <button onClick={() => setFilterStatus('pending')} className={`flex-1 min-w-[120px] p-3 rounded-xl border text-left transition-all ${filterStatus === 'pending' ? 'bg-amber-50 border-amber-300 shadow-sm ring-1 ring-amber-200' : 'border-transparent hover:bg-amber-50/50'}`}>
                <p className="text-[10px] font-bold text-amber-600 mb-1 flex items-center gap-1"><Clock className="w-3 h-3" /> 仮計上</p>
                <p className="text-lg font-extrabold text-amber-700 tabular-nums">{summary.pendingPoints.toLocaleString()}<span className="text-[10px] ml-1 font-normal">pt</span></p>
              </button>
              <button onClick={() => setFilterStatus('confirmed')} className={`flex-1 min-w-[120px] p-3 rounded-xl border text-left transition-all ${filterStatus === 'confirmed' ? 'bg-emerald-50 border-emerald-300 shadow-sm ring-1 ring-emerald-200' : 'border-transparent hover:bg-emerald-50/50'}`}>
                <p className="text-[10px] font-bold text-emerald-600 mb-1 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> 確定済</p>
                <p className="text-lg font-extrabold text-emerald-700 tabular-nums">{summary.confirmedPoints.toLocaleString()}<span className="text-[10px] ml-1 font-normal">pt</span></p>
              </button>
              <button onClick={() => setFilterStatus('issued')} className={`flex-1 min-w-[120px] p-3 rounded-xl border text-left transition-all ${filterStatus === 'issued' ? 'bg-blue-50 border-blue-300 shadow-sm ring-1 ring-blue-200' : 'border-transparent hover:bg-blue-50/50'}`}>
                <p className="text-[10px] font-bold text-blue-600 mb-1 flex items-center gap-1"><Wallet className="w-3 h-3" /> 清算待ち</p>
                <p className="text-lg font-extrabold text-blue-700 tabular-nums">{summary.issuedPoints.toLocaleString()}<span className="text-[10px] ml-1 font-normal">pt</span></p>
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-gray-400 text-[11px] uppercase border-b border-gray-200">
                    <th className="p-4 font-bold">日時</th>
                    <th className="p-4 font-bold">スタッフ</th>
                    <th className="p-4 font-bold text-right">獲得Pt</th>
                    <th className="p-4 font-bold text-center">ステータス</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {displayedHistory.map(item => {
                    const status = STATUS_MAP[item.status] || { label: item.status, color: 'bg-gray-100', icon: null };
                    return (
                      <tr key={item.id} className={`hover:bg-gray-50 transition-colors ${item.status === 'cancel' ? 'opacity-60 bg-red-50/30' : ''}`}>
                        <td className="p-4">
                          <p className="text-[11px] text-gray-500 font-mono">{new Date(item.created_at).toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                        </td>
                        <td className="p-4 font-bold text-gray-800 text-sm">{item.staffName}</td>
                        <td className="p-4 text-right">
                          <p className="font-extrabold text-gray-900 text-sm">+{item.totalPoints.toLocaleString()} <span className="text-[10px] font-normal text-gray-400">pt</span></p>
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex flex-col items-center justify-center gap-1">
                            {item.is_staff_rewarded ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-gray-100 text-gray-500 border border-gray-200">
                                <CheckCheck className="w-3 h-3" /> 清算済
                              </span>
                            ) : (
                              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${status.color}`}>
                                {status.icon} {status.label}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================
          タブ: Staff (管理) の時に表示
      ========================================= */}
      <div className={`md:block ${activeTab === 'staff' ? 'block' : 'hidden'}`}>
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row justify-between items-end mb-4 gap-4">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Users className="w-5 h-5" /> スタッフ別 精算・管理</h2>
            <div className="flex gap-2">
              <button onClick={() => setIsInviteModalOpen(true)} className="text-xs px-4 py-2 bg-white border border-indigo-200 text-indigo-700 font-bold rounded-lg shadow-sm hover:bg-indigo-50 transition flex items-center gap-1">
                <QrCode className="w-3 h-3" /> 招待QR
              </button>
              <button onClick={() => setIsStaffModalOpen(true)} className="text-xs px-4 py-2 bg-gray-900 text-white font-bold rounded-lg shadow-sm hover:bg-gray-800 transition flex items-center gap-1">
                <Plus className="w-3 h-3" /> 新規追加
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {staffs.filter(s => !s.is_deleted).sort((a, b) => (b.hasUnpaid === a.hasUnpaid ? b.count - a.count : b.hasUnpaid ? 1 : -1)).map((s) => (
              <div key={s.id} className={`bg-white border rounded-2xl shadow-sm overflow-hidden flex flex-col ${s.hasUnpaid ? 'border-blue-400 ring-1 ring-blue-400 shadow-blue-100' : s.isOwner ? 'border-indigo-300 ring-1 ring-indigo-100' : 'border-gray-200'}`}>
                <div className={`p-4 border-b flex justify-between items-center ${s.isOwner ? 'bg-indigo-50 border-indigo-100' : 'bg-gray-50/50 border-gray-100'}`}>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-gray-900 text-lg">{s.name}</h3>
                      {s.isOwner && <span className="bg-indigo-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm flex items-center gap-1"><Crown className="w-3 h-3" /> 代表・管理者</span>}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => { setDetailStaff(s); setDetailTab('settings'); }} className="p-2 border border-gray-200 text-gray-600 rounded bg-white hover:bg-gray-50 transition"><Settings className="w-4 h-4" /></button>
                    <button onClick={() => handleCopyUrl(s)} className="p-2 border border-gray-200 text-gray-600 rounded bg-white hover:bg-gray-50 transition"><LinkIcon className="w-4 h-4" /></button>
                    <button onClick={() => { setSelectedStaff(s); setIsQrModalOpen(true); }} className="p-2 border border-gray-200 text-gray-600 rounded bg-white hover:bg-gray-50 transition"><QrCode className="w-4 h-4" /></button>
                  </div>
                </div>
                <div className="p-4 flex flex-col flex-1">
                  <div className={`flex justify-between items-center p-3 rounded-xl border mb-3 ${s.hasUnpaid ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-100'}`}>
                    <div>
                      <p className={`text-[10px] font-bold mb-0.5 ${s.hasUnpaid ? 'text-blue-700' : 'text-gray-500'}`}>
                        <Coins className="w-3 h-3 inline mr-1" /> {s.hasUnpaid ? '精算できる金額' : '清算待ち（現在なし）'}
                      </p>
                      <p className={`text-xl font-extrabold tabular-nums ${s.hasUnpaid ? 'text-blue-700' : 'text-gray-400'}`}>{s.unpaidToStaffPts.toLocaleString()}<span className="text-xs ml-1 font-bold">pt</span></p>
                    </div>
                    <button onClick={() => handlePayStaff(s.id, s.name, s.unpaidToStaffPts)} disabled={!s.hasUnpaid} className={`px-4 py-2 rounded-lg text-xs font-bold transition ${s.hasUnpaid ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>
                      清算済にする
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* =========================================
          タブ: QR (全画面QRモード)
          ※スマホの時だけ全画面で覆いかぶさります
      ========================================= */}
      {activeTab === 'qr' && (
        <div className="fixed inset-0 bg-indigo-600 z-[60] flex flex-col items-center justify-center p-6 text-white md:hidden animate-in fade-in duration-200">
          <h2 className="text-2xl font-black mb-2">紹介用QRコード</h2>
          <p className="text-sm font-medium mb-8 opacity-90">お客様にこの画面をスキャンしてもらってください</p>
          
          <div className="bg-white p-8 rounded-[2rem] shadow-2xl relative">
            {/* 装飾用の光彩 */}
            <div className="absolute inset-0 bg-gradient-to-tr from-indigo-100 to-white rounded-[2rem] opacity-50 pointer-events-none" />
            
            <div className="relative z-10">
              {ownerStaff?.referral_code ? (
                <QRCodeCanvas 
                  value={`${window.location.origin}/welcome/${ownerStaff.referral_code}`} 
                  size={240} 
                  level="H" // エラー訂正レベル高（ロゴ等を重ねやすくする設定）
                  className="mx-auto"
                />
              ) : (
                <div className="w-[240px] h-[240px] bg-gray-50 flex flex-col items-center justify-center text-gray-400 rounded-xl border-2 border-dashed border-gray-200">
                  <RefreshCw className="w-8 h-8 animate-spin mb-2" />
                  <span className="text-sm font-bold">QR読込中...</span>
                </div>
              )}
            </div>
          </div>
          
          <p className="mt-8 text-sm font-mono bg-black/20 px-4 py-2 rounded-full border border-white/10">
            ID: {ownerStaff?.referral_code}
          </p>
          
          <button 
            onClick={() => setActiveTab('stats')} 
            className="mt-12 px-10 py-4 bg-white text-indigo-600 rounded-full font-bold shadow-xl active:scale-95 transition-transform flex items-center gap-2"
          >
            <X className="w-5 h-5" /> 閉じる
          </button>
        </div>
      )}

      {/* =========================================
          モーダル群 (既存のまま)
      ========================================= */}
      {isPolicyModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70] backdrop-blur-sm p-4" onClick={() => setIsPolicyModalOpen(false)}>
          <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl relative" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-8">
              <div>
                <h3 className="text-xl font-extrabold text-gray-900">分配ポリシーの設定</h3>
                <p className="text-xs text-gray-400 mt-1">報酬100%の行き先を決定します</p>
              </div>
              <button onClick={() => setIsPolicyModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <X className="w-6 h-6 text-gray-400" />
              </button>
            </div>

            <div className="space-y-10">
              {/* スライダー1：本人 */}
              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-indigo-500" /> 紹介した本人への還元
                  </label>
                  <span className="text-2xl font-black text-indigo-600 tabular-nums">{ratios.individual}<span className="text-xs ml-1">%</span></span>
                </div>
                <input 
                  type="range" min="0" max="100" step="5"
                  value={ratios.individual}
                  onChange={(e) => handleSliderChange('individual', parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
              </div>

              {/* スライダー2：チーム */}
              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-400" /> チーム全員での分配
                  </label>
                  <span className="text-2xl font-black text-emerald-500 tabular-nums">{ratios.team}<span className="text-xs ml-1">%</span></span>
                </div>
                <input 
                  type="range" min="0" max="100" step="5"
                  value={ratios.team}
                  onChange={(e) => handleSliderChange('team', parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                />
              </div>

              {/* 自動計算：管理者留保分 */}
              <div className="p-4 bg-gray-50 rounded-2xl flex justify-between items-center border border-gray-100">
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">管理者・店舗 留保分</span>
                  <p className="text-[9px] text-gray-400 italic mt-0.5">※管理加算やB2B EC原資など</p>
                </div>
                <span className="text-lg font-bold text-indigo-600 tabular-nums">{ratios.owner}%</span>
              </div>

              {/* 3カラムシミュレーション */}
              <div className="bg-gray-900 rounded-2xl p-6 text-white shadow-xl">
                <p className="text-[10px] font-bold text-indigo-300 mb-4 tracking-widest uppercase">Simulation (報酬が5,000ptの場合)</p>
                <div className="grid grid-cols-3 gap-4">
                   <div className="space-y-1">
                     <p className="text-[9px] text-gray-400 font-bold border-b border-gray-800 pb-1">紹介した本人</p>
                     <p className="text-lg font-black text-white">
                       {Math.floor(5000 * ratios.individual / 100 + (5000 * ratios.team / 100 / (staffs.filter(s => !s.is_deleted).length || 1))).toLocaleString()}
                       <span className="text-[10px] ml-0.5 text-gray-500">pt</span>
                     </p>
                   </div>
                   <div className="space-y-1 border-x border-gray-800 px-3">
                     <p className="text-[9px] text-gray-400 font-bold border-b border-gray-800 pb-1">他メンバー</p>
                     <p className="text-lg font-black text-emerald-400">
                       {Math.floor(5000 * ratios.team / 100 / (staffs.filter(s => !s.is_deleted).length || 1)).toLocaleString()}
                       <span className="text-[10px] ml-0.5 text-emerald-900">pt</span>
                     </p>
                   </div>
                   <div className="space-y-1">
                     <p className="text-[9px] text-indigo-300 font-bold border-b border-gray-800 pb-1">管理者加算</p>
                     <p className="text-lg font-black text-indigo-400">
                       {Math.floor(5000 * ratios.owner / 100).toLocaleString()}
                       <span className="text-[10px] ml-0.5 text-indigo-900">pt</span>
                     </p>
                   </div>
                </div>
              </div>

              <button 
                onClick={handleSavePolicy} 
                disabled={isSavingPolicy}
                className="w-full py-4 bg-indigo-600 text-white font-bold rounded-2xl shadow-lg hover:bg-indigo-700 transition disabled:opacity-50"
              >
                {isSavingPolicy ? "保存中..." : "この設定で確定する"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ボトムナビゲーションを配置 */}
      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  )
}