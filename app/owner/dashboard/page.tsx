'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { QRCodeCanvas } from 'qrcode.react'

import { 
  RefreshCw, LogOut, Clock, CheckCircle2, Wallet, 
  CheckCheck, Users, Plus, Crown, Settings, Link as LinkIcon, 
  QrCode, Trash2, Coins, Smartphone, ClipboardList, X, Ban, Trophy, Calendar
} from 'lucide-react'

const STATUS_MAP: any = {
  pending: { label: '仮計上', color: 'bg-amber-50 text-amber-700 border-amber-100', icon: <Clock className="w-3 h-3" /> },
  confirmed: { label: '確定(未入金)', color: 'bg-emerald-50 text-emerald-700 border-emerald-100', icon: <CheckCircle2 className="w-3 h-3" /> },
  issued: { label: 'ギフト受取済', color: 'bg-blue-50 text-blue-700 border-blue-100', icon: <Wallet className="w-3 h-3" /> },
  cancel: { label: 'キャンセル', color: 'bg-red-50 text-red-600 border-red-100', icon: <Ban className="w-3 h-3" /> },
}

export default function OwnerDashboard() {
  const [shop, setShop] = useState<any>(null)
  const [rank, setRank] = useState<any>(null)
  const [staffs, setStaffs] = useState<any[]>([])
  const [referralHistory, setReferralHistory] = useState<any[]>([])
  
  // ★ デフォルトは「すべて」ではなく、空文字（全表示）
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

    const { data: shopData } = await supabase.from('shops').select(`*, shop_ranks (*)`).eq('owner_id', user.id).maybeSingle()
    if (!shopData) { setLoading(false); return; }
    
    setShop(shopData)
    setRank(shopData.shop_ranks)
    const rewardPoints = shopData.shop_ranks?.reward_points || 5000

    const [staffRes, refRes, txRes] = await Promise.all([
      supabase.from('staffs').select('id, name, email, is_deleted').eq('shop_id', shopData.id),
      supabase.from('referrals').select('*').eq('shop_id', shopData.id).order('created_at', { ascending: false }),
      supabase.from('point_transactions').select('*').eq('shop_id', shopData.id)
    ])

    const staffList = staffRes.data || []
    const referralLogs = refRes.data || []
    const pointLogs = txRes.data || []

    const reversedLogs = [...referralLogs].reverse();
    const staffCounters: Record<string, number> = {};

    const enrichedReferrals = reversedLogs.map(log => {
      staffCounters[log.staff_id] = (staffCounters[log.staff_id] || 0) + 1;
      const refTxs = pointLogs.filter(tx => tx.referral_id === log.id && (tx.status === 'confirmed' || tx.status === 'paid'));
      const totalPoints = refTxs.reduce((sum, tx) => sum + (Number(tx.points) || 0), 0);
      const hasBonus = refTxs.some(tx => tx.metadata?.is_bonus === true);

      return {
        ...log,
        staffName: staffList.find(s => s.id === log.staff_id)?.name || '不明',
        staffNthCount: staffCounters[log.staff_id],
        totalPoints: log.status === 'pending' ? rewardPoints : totalPoints,
        hasBonus
      }
    }).reverse();

    setReferralHistory(enrichedReferrals)

    const staffsWithFinance = staffList.map(s => {
      const staffRefs = enrichedReferrals.filter(r => r.staff_id === s.id);
      const pendingPts = staffRefs.filter(r => r.status === 'pending').reduce((sum, r) => sum + r.totalPoints, 0);
      const unpaidToStaffPts = staffRefs.filter(r => r.status === 'issued' && !r.is_staff_rewarded).reduce((sum, r) => sum + r.totalPoints, 0);
      const pendingFromAdminPts = staffRefs.filter(r => r.status === 'confirmed').reduce((sum, r) => sum + r.totalPoints, 0);
      const paidToStaffPts = staffRefs.filter(r => r.is_staff_rewarded).reduce((sum, r) => sum + r.totalPoints, 0);
      const isOwner = s.email === shopData.owner_email;

      return {
        ...s,
        count: staffRefs.filter(r => r.status !== 'cancel').length,
        pendingPts, unpaidToStaffPts, pendingFromAdminPts, paidToStaffPts,
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

  useEffect(() => { loadData() }, [router])

  const handlePayStaff = async (staffId: string, staffName: string, amount: number) => {
    if (!confirm(`【精算確認】\n\n${staffName} さんに ${amount.toLocaleString()} pt 分の還元を行いましたか？\n\n「OK」を押すと「還元済」に移動します。`)) return
    const { error } = await supabase.from('referrals').update({ is_staff_rewarded: true }).eq('staff_id', staffId).eq('status', 'issued').eq('is_staff_rewarded', false)
    if (error) { alert('精算処理に失敗しました。'); return; }
    alert(`${staffName} さんの精算処理が完了しました！`);
    await loadData()
  }

  const handleAddStaff = async () => {
    if (!newStaffName.trim() || !newStaffEmail.trim()) return alert('名前とメールアドレスの両方を入力してください。');
    const maxNum = staffs.reduce((max, s) => {
      const num = parseInt(s.id.replace('ST', ''), 10)
      return !isNaN(num) && num > max ? num : max
    }, 0)
    const nextStaffId = `ST${(maxNum + 1).toString().padStart(3, '0')}`
    
    const { error } = await supabase.from('staffs').insert([{ 
      id: nextStaffId, shop_id: shop.id, name: newStaffName, email: newStaffEmail, referral_code: `${shop.id}_${nextStaffId}`, is_deleted: false 
    }])
    if (error) { alert('スタッフの追加に失敗しました。'); return; }
    setNewStaffName(''); setNewStaffEmail(''); setIsStaffModalOpen(false);
    await loadData()
  }

  const handleDeleteStaff = async (staffId: string, staffName: string) => {
    if (!confirm(`スタッフ「${staffName}」を非表示にしますか？\n※過去の履歴は残ります。`)) return
    const { error } = await supabase.from('staffs').update({ is_deleted: true }).eq('id', staffId)
    if (error) { alert('非表示処理に失敗しました。'); return; }
    await loadData()
  }

  const handleUpdateStaffInfo = async () => {
    if (!editName.trim() || !editEmail.trim()) return alert('名前とメールアドレスを入力してください。')
    const { error } = await supabase.from('staffs').update({ name: editName, email: editEmail }).eq('id', detailStaff.id)
    if (error) { alert('更新に失敗しました。'); return; }

    if (detailStaff.isOwner) {
      await supabase.from('shops').update({ owner_email: editEmail }).eq('id', shop.id)
    }
    alert('スタッフ情報を更新しました！')
    setDetailStaff(null); await loadData()
  }

  const handleUpdatePassword = async () => {
    if (newPassword.length < 6) return alert('パスワードは6文字以上で入力してください。')
    if (!confirm('パスワードを変更します。よろしいですか？')) return
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) { alert('パスワード変更に失敗しました: ' + error.message) } 
    else { alert('パスワードを変更しました！'); setNewPassword('') }
  }

  const openDetailModal = (staff: any) => {
    setDetailStaff(staff); setEditName(staff.name); setEditEmail(staff.email); setNewPassword(''); setDetailTab('history')
  }

  const handleCopyUrl = (staffId: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/?r=${shop.id}_${staffId}`)
    alert('紹介用URLをコピーしました！')
  }

  // ★ 履歴のフィルタリング（サマリークリック連動）
  const filteredHistory = useMemo(() => {
    return referralHistory.filter(item => {
      // is_staff_rewarded が true のものは、実質的に「清算済(rewarded)」ステータスとして扱うためのロジック
      const effectiveStatus = item.is_staff_rewarded ? 'rewarded' : item.status;
      
      if (filterStatus === '') return true; // すべて表示
      return effectiveStatus === filterStatus;
    })
  }, [referralHistory, filterStatus])
  
  const displayedHistory = filteredHistory.slice(0, visibleCount)

  if (loading) return <div className="p-12 text-center text-gray-500 text-sm flex items-center justify-center gap-2"><RefreshCw className="w-4 h-4 animate-spin" /> データを読み込み中...</div>
  if (!shop) return <div className="p-12 text-center text-red-500">店舗情報が見つかりません。</div>

  const rewardPoints = rank?.reward_points || 5000

  return (
    <div className="p-6 md:p-10 max-w-screen-2xl mx-auto bg-gray-50 min-h-screen text-gray-800 relative">
      
      {/* 1. ヘッダー (累計・月次獲得額を統合！) */}
      <header className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 border-b border-gray-200 pb-6 mb-8 bg-white p-6 rounded-2xl shadow-sm">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-gray-900">{shop.name}</h1>
            {rank && <span className="px-3 py-1 bg-indigo-100 text-indigo-800 text-xs font-bold rounded-full">{rank.label}会員</span>}
          </div>
          <p className="text-xs text-gray-400 font-mono">Shop ID: {shop.id}</p>
        </div>
        
        {/* 獲得報酬サマリーをヘッダーに配置 */}
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
              <p className="text-[10px] font-bold text-gray-500">今月 ({new Date().getMonth() + 1}月) の獲得</p>
              <p className="text-xl font-bold text-gray-700 tabular-nums leading-none mt-1">{summary.thisMonthEarned.toLocaleString()}<span className="text-xs ml-1 font-normal text-gray-400">pt</span></p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={loadData} className="text-sm text-gray-500 hover:text-gray-800 transition flex items-center gap-1"><RefreshCw className="w-4 h-4" /> 更新</button>
          <button onClick={() => supabase.auth.signOut().then(() => router.push('/login'))} className="text-sm px-4 py-2 bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-gray-50 transition font-medium flex items-center gap-2"><LogOut className="w-4 h-4 text-gray-400" /> ログアウト</button>
        </div>
      </header>

      {/* 2. メイン１：紹介アクション履歴 ＆ インタラクティブサマリー (フルワイド) */}
      <div className="mb-12">
        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2"><ClipboardList className="w-5 h-5" /> 紹介アクション明細</h2>
        
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          
          {/* テーブル上部のサマリー兼フィルタータブ */}
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
              <p className="text-[10px] font-bold text-blue-600 mb-1 flex items-center gap-1"><Wallet className="w-3 h-3" /> 清算待ち(受取済)</p>
              <p className="text-lg font-extrabold text-blue-700 tabular-nums">{summary.issuedPoints.toLocaleString()}<span className="text-[10px] ml-1 font-normal">pt</span></p>
            </button>
            <button onClick={() => setFilterStatus('rewarded')} className={`flex-1 min-w-[120px] p-3 rounded-xl border text-left transition-all ${filterStatus === 'rewarded' ? 'bg-gray-100 border-gray-300 shadow-sm ring-1 ring-gray-200' : 'border-transparent hover:bg-gray-100/50'}`}>
              <p className="text-[10px] font-bold text-gray-500 mb-1 flex items-center gap-1"><CheckCheck className="w-3 h-3" /> スタッフ清算済</p>
              <p className="text-lg font-extrabold text-gray-700 tabular-nums">{summary.rewardedPoints.toLocaleString()}<span className="text-[10px] ml-1 font-normal">pt</span></p>
            </button>
          </div>

          {/* 履歴テーブル */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 text-gray-400 text-[11px] uppercase border-b border-gray-200">
                  <th className="p-4 font-bold">日時 / 紹介回数</th>
                  <th className="p-4 font-bold">スタッフ</th>
                  <th className="p-4 font-bold text-right">獲得Pt</th>
                  <th className="p-4 font-bold text-center">ステータス</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {displayedHistory.map(item => {
                  const status = STATUS_MAP[item.status] || { label: item.status, color: 'bg-gray-100', icon: null };
                  return (
                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                      <td className="p-4">
                        <p className="text-[11px] text-gray-500 font-mono">{new Date(item.created_at).toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                        <p className="text-[10px] text-indigo-600 font-bold mt-0.5">{item.staffNthCount}回目の紹介</p>
                      </td>
                      <td className="p-4 font-bold text-gray-800 text-sm">{item.staffName}</td>
                      <td className="p-4 text-right">
                        <p className="font-extrabold text-gray-900 text-sm">+{item.totalPoints.toLocaleString()} <span className="text-[10px] font-normal text-gray-400">pt</span></p>
                        {item.hasBonus && <p className="text-[9px] text-emerald-600 font-bold">(初回ボーナス)</p>}
                      </td>
                      <td className="p-4 text-center">
                        {item.is_staff_rewarded ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-gray-100 text-gray-500 border border-gray-200">
                            <CheckCheck className="w-3 h-3" /> 清算済
                          </span>
                        ) : (
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${status.color}`}>
                            {status.icon} {status.label}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {filteredHistory.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-16 text-center text-gray-400 text-sm">該当する履歴がありません</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {filteredHistory.length > visibleCount && (
            <div className="p-4 bg-gray-50 border-t border-gray-100 text-center">
              <button onClick={() => setVisibleCount(prev => prev + 20)} className="px-6 py-2 bg-white border border-gray-200 rounded-lg text-xs font-bold text-gray-600 hover:bg-gray-100 transition shadow-sm">
                さらに表示する
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 3. メイン２：スタッフ精算＆管理パネル (フルワイドグリッド) */}
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
            <div key={s.id} className={`bg-white border rounded-2xl shadow-sm overflow-hidden transition-all flex flex-col ${s.hasUnpaid ? 'border-blue-400 ring-1 ring-blue-400 shadow-blue-100' : s.isOwner ? 'border-indigo-300 ring-1 ring-indigo-100' : 'border-gray-200'}`}>
              
              <div className={`p-4 border-b flex justify-between items-center ${s.isOwner ? 'bg-indigo-50 border-indigo-100' : 'bg-gray-50/50 border-gray-100'}`}>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-gray-900 text-lg">{s.name}</h3>
                    {s.isOwner && <span className="bg-indigo-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm flex items-center gap-1"><Crown className="w-3 h-3" /> オーナー</span>}
                  </div>
                  <p className="text-[10px] text-gray-500 font-bold mt-1">累計紹介: {s.count}件</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openDetailModal(s)} className="p-2 border border-gray-200 text-gray-600 rounded bg-white hover:bg-gray-50 transition" title="詳細/設定"><Settings className="w-4 h-4" /></button>
                  <button onClick={() => handleCopyUrl(s.id)} className="p-2 border border-gray-200 text-gray-600 rounded bg-white hover:bg-gray-50 transition" title="URLコピー"><LinkIcon className="w-4 h-4" /></button>
                  <button onClick={() => { setSelectedStaff(s); setIsQrModalOpen(true); }} className="p-2 border border-gray-200 text-gray-600 rounded bg-white hover:bg-gray-50 transition" title="QR表示"><QrCode className="w-4 h-4" /></button>
                  {!s.isOwner && <button onClick={() => handleDeleteStaff(s.id, s.name)} className="p-2 border border-red-100 text-red-400 rounded bg-white hover:bg-red-50 transition" title="非表示"><Trash2 className="w-4 h-4" /></button>}
                </div>
              </div>

              <div className="p-4 flex flex-col flex-1">
                <div className={`flex justify-between items-center p-3 rounded-xl border mb-3 ${s.hasUnpaid ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-100'}`}>
                  <div>
                    <p className={`text-[10px] font-bold mb-0.5 flex items-center gap-1 ${s.hasUnpaid ? 'text-blue-700' : 'text-gray-500'}`}>
                      <Coins className="w-3 h-3" /> {s.hasUnpaid ? '今すぐ清算できる金額' : '清算待ち（現在なし）'}
                    </p>
                    <p className={`text-xl font-extrabold tabular-nums ${s.hasUnpaid ? 'text-blue-700' : 'text-gray-400'}`}>{s.unpaidToStaffPts.toLocaleString()}<span className="text-xs ml-1 font-bold">pt</span></p>
                  </div>
                  <button onClick={() => handlePayStaff(s.id, s.name, s.unpaidToStaffPts)} disabled={!s.hasUnpaid} className={`px-4 py-2 rounded-lg text-xs font-bold shadow-sm transition ${s.hasUnpaid ? 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>
                    {s.hasUnpaid ? '清算済にする' : '清算完了'}
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-auto">
                  <div className="bg-amber-50 p-2 rounded-lg border border-amber-100 text-center"><p className="text-[9px] font-bold text-amber-600 mb-1 flex items-center justify-center gap-0.5"><Clock className="w-3 h-3" /> 1. 仮計上</p><p className="text-xs font-bold text-amber-800">{s.pendingPts.toLocaleString()}</p></div>
                  <div className="bg-emerald-50 p-2 rounded-lg border border-emerald-100 text-center"><p className="text-[9px] font-bold text-emerald-600 mb-1 flex items-center justify-center gap-0.5"><CheckCircle2 className="w-3 h-3" /> 2. 確定済</p><p className="text-xs font-bold text-emerald-800">{s.pendingFromAdminPts.toLocaleString()}</p></div>
                  <div className="bg-gray-50 p-2 rounded-lg border border-gray-100 text-center"><p className="text-[9px] font-bold text-gray-400 mb-1 flex items-center justify-center gap-0.5"><CheckCheck className="w-3 h-3" /> 4. 清算済</p><p className="text-xs font-bold text-gray-600">{s.paidToStaffPts.toLocaleString()}</p></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* =========================================
          モーダル群 (Dialogs) 
      ========================================= */}

      {/* 1. スタッフ詳細＆設定モーダル */}
      {detailStaff && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm p-4" onClick={() => setDetailStaff(null)}>
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <div className="bg-gray-50 border-b border-gray-200">
              <div className="p-5 pb-4 flex justify-between items-center">
                <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">{detailStaff.name} <span className="text-sm font-normal text-gray-500">の詳細</span></h3>
                <button onClick={() => setDetailStaff(null)} className="text-gray-400 hover:text-gray-600 text-xl font-bold"><X className="w-5 h-5" /></button>
              </div>
              <div className="flex px-5 gap-6">
                <button onClick={() => setDetailTab('history')} className={`pb-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-1 ${detailTab === 'history' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-400 hover:text-gray-600'}`}><ClipboardList className="w-4 h-4" /> 紹介履歴</button>
                <button onClick={() => setDetailTab('settings')} className={`pb-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-1 ${detailTab === 'settings' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-400 hover:text-gray-600'}`}><Settings className="w-4 h-4" /> 登録情報</button>
              </div>
            </div>

            <div className="overflow-y-auto p-6 bg-white flex-1">
              {detailTab === 'history' && (
                <div className="space-y-3">
                  {referralHistory.filter(r => r.staff_id === detailStaff.id).map(item => {
                    const status = STATUS_MAP[item.status] || { label: item.status, color: 'bg-gray-100' }
                    return (
                      <div key={item.id} className="flex justify-between items-center p-3 border border-gray-100 rounded-lg hover:bg-gray-50">
                        <div>
                          <p className="text-[10px] text-gray-400 mb-0.5">{new Date(item.created_at).toLocaleDateString()} <span className="ml-2 text-indigo-600 font-bold">{item.staffNthCount}回目</span></p>
                          <div className="flex items-center gap-2">
                            {item.is_staff_rewarded ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-500 border border-gray-200 flex items-center gap-1"><CheckCheck className="w-3 h-3" /> 清算済</span>
                            ) : (
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${status.color} flex items-center gap-1`}>{status.icon} {status.label}</span>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-extrabold text-gray-900 text-sm">+{item.totalPoints.toLocaleString()} pt</p>
                          {item.hasBonus && <p className="text-[9px] text-emerald-600 font-bold">(初回ボーナス)</p>}
                        </div>
                      </div>
                    )
                  })}
                  {referralHistory.filter(r => r.staff_id === detailStaff.id).length === 0 && <p className="text-center text-sm text-gray-400 py-10">履歴がありません</p>}
                </div>
              )}

              {detailTab === 'settings' && (
                <div className="space-y-6">
                  <div className="bg-gray-50 p-5 rounded-xl border border-gray-100 space-y-4">
                    <h4 className="text-sm font-bold text-gray-700">基本情報の変更</h4>
                    <div>
                      <label className="block text-[11px] font-bold text-gray-500 mb-1">お名前</label>
                      <input type="text" value={editName} onChange={e => setEditName(e.target.value)} className="w-full border border-gray-300 rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-gray-500 mb-1">メールアドレス</label>
                      <input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} className="w-full border border-gray-300 rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                    <div className="text-right">
                      <button onClick={handleUpdateStaffInfo} className="px-4 py-2 bg-gray-900 text-white rounded text-xs font-bold hover:bg-gray-800 flex items-center justify-center w-full sm:w-auto sm:inline-flex gap-1">情報を保存する</button>
                    </div>
                  </div>

                  {detailStaff.isOwner && (
                    <div className="bg-red-50 p-5 rounded-xl border border-red-100 space-y-4">
                      <h4 className="text-sm font-bold text-red-700">セキュリティ (オーナー専用)</h4>
                      <div>
                        <label className="block text-[11px] font-bold text-red-500 mb-1">新しいパスワード (6文字以上)</label>
                        <input type="password" placeholder="変更する場合のみ入力" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full border border-red-200 rounded p-2 text-sm focus:ring-2 focus:ring-red-400 outline-none" />
                        <p className="text-[10px] text-red-400 mt-1">※このパスワードはダッシュボードへのログインに使用します。</p>
                      </div>
                      <div className="text-right">
                        <button onClick={handleUpdatePassword} disabled={!newPassword || newPassword.length < 6} className="px-4 py-2 bg-red-600 text-white rounded text-xs font-bold hover:bg-red-700 disabled:opacity-50 flex items-center justify-center w-full sm:w-auto sm:inline-flex gap-1">パスワードを変更する</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. スタッフ追加モーダル */}
      {isStaffModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2"><Plus className="w-5 h-5" /> 新しいスタッフを追加</h3>
            <div className="space-y-4 mb-6">
              <div><label className="block text-[10px] font-bold text-gray-500 mb-1">お名前</label><input type="text" value={newStaffName} onChange={e => setNewStaffName(e.target.value)} className="w-full border border-gray-300 rounded-lg p-3 text-sm" autoFocus /></div>
              <div><label className="block text-[10px] font-bold text-gray-500 mb-1">メールアドレス (必須)</label><input type="email" value={newStaffEmail} onChange={e => setNewStaffEmail(e.target.value)} className="w-full border border-gray-300 rounded-lg p-3 text-sm" /></div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setIsStaffModalOpen(false)} className="flex-1 py-2.5 bg-gray-100 text-gray-600 rounded-lg font-bold text-sm">キャンセル</button>
              <button onClick={handleAddStaff} disabled={!newStaffName.trim() || !newStaffEmail.trim()} className="flex-1 py-2.5 bg-gray-900 text-white rounded-lg font-bold text-sm disabled:opacity-50">追加する</button>
            </div>
          </div>
        </div>
      )}

      {/* 3. QR表示モーダル */}
      {isQrModalOpen && selectedStaff && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm p-4" onClick={() => setIsQrModalOpen(false)}>
          <div className="bg-white rounded-2xl p-8 w-full max-w-sm shadow-xl text-center" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-gray-900 mb-1">{selectedStaff.name} さんの紹介QR</h3>
            <div className="bg-white p-4 inline-block border-2 border-gray-100 rounded-xl shadow-sm my-6">
              <QRCodeCanvas value={`${window.location.origin}/?r=${shop.id}_${selectedStaff.id}`} size={200} level={"H"} />
            </div>
            <button onClick={() => handleCopyUrl(selectedStaff.id)} className="w-full py-3 bg-gray-100 text-gray-800 font-bold text-sm rounded-lg mb-3 flex items-center justify-center gap-2"><LinkIcon className="w-4 h-4" /> URLをコピーする</button>
            <button onClick={() => setIsQrModalOpen(false)} className="text-sm text-gray-400 underline py-2">閉じる</button>
          </div>
        </div>
      )}

      {/* 4. スタッフ招待QRモーダル */}
      {isInviteModalOpen && shop && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm p-4" onClick={() => setIsInviteModalOpen(false)}>
          <div className="bg-white rounded-2xl p-8 w-full max-w-sm shadow-xl text-center" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-indigo-700 mb-1 flex items-center justify-center gap-2"><Smartphone className="w-6 h-6" /> スタッフ招待用QR</h3>
            <div className="bg-white p-4 inline-block border-2 border-indigo-100 rounded-xl shadow-sm my-6">
              <QRCodeCanvas value={`${window.location.origin}/reg/${shop.id}`} size={200} level={"H"} fgColor="#4338ca" />
            </div>
            <button onClick={() => setIsInviteModalOpen(false)} className="w-full py-3 bg-indigo-50 border border-indigo-100 text-indigo-700 font-bold text-sm rounded-lg hover:bg-indigo-100 transition">閉じる</button>
          </div>
        </div>
      )}

    </div>
  )
}