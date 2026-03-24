'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { QRCodeCanvas } from 'qrcode.react'

import { 
  RefreshCw, LogOut, Clock, CheckCircle2, Wallet, 
  CheckCheck, Users, Plus, Crown, Settings, Link as LinkIcon, 
  QrCode, Trash2, Coins, Smartphone, ClipboardList, X, Ban, Trophy, Calendar, Info, Save, Key, User
} from 'lucide-react'

// ★ ランダムトークン生成関数
const generateSecureToken = () => {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

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
 
  // ★ 分配比率用のステート
  const [ratios, setRatios] = useState({ individual: 100, team: 0, owner: 0 })
  const [isSavingPolicy, setIsSavingPolicy] = useState(false)
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false);

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

    // ★ 修正ポイント：アクティブなスタッフ数（管理者含む）を正確にカウント
    const activeStaffs = staffList.filter(s => !s.is_deleted);
    const staffCount = activeStaffs.length || 1;

    const reversedLogs = [...referralLogs].reverse();
    const staffCounters: Record<string, number> = {};

    const enrichedReferrals = reversedLogs.map(log => {
      staffCounters[log.staff_id] = (staffCounters[log.staff_id] || 0) + 1;
      const refTxs = pointLogs.filter(tx => tx.referral_id === log.id && (tx.status === 'confirmed' || tx.status === 'paid'));
      
      const basePoints = currentRewardPoints;
      
      // ★ 分配ロジックの再定義
      const indPart = basePoints * (ratios.individual / 100);
      const teamPart = (basePoints * (ratios.team / 100)) / staffCount;
      const ownerPart = basePoints * (ratios.owner / 100);

      // 紹介したのが管理者本人かどうか判定
      const isOwnerAction = staffList.find(s => s.id === log.staff_id)?.email === shopData.owner_email;

      // 管理者なら「個人+チーム+管理者枠」、メンバーなら「個人+チーム」
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

    // スタッフ別集計（ここでも activeStaffs をベースに）
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

  // ★ ポリシー比率を更新する関数
  const handleSliderChange = (key: 'individual' | 'team', value: number) => {
    setRatios(prev => {
      let nextInd = key === 'individual' ? value : prev.individual;
      let nextTeam = key === 'team' ? value : prev.team;

      // 合計が100を超えないように調整（店舗分がマイナスにならないように）
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

    if (error) {
      alert('保存に失敗しました');
    } else {
      alert('報酬ポリシーを更新しました！');
      await loadData();
    }
    setIsSavingPolicy(false);
  };

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
  
  // デバッグ用：現在取得できている shop の状態を確認
  console.log("Current shop state:", shop);

  if (!shop?.id) {
    alert('店舗情報が読み込めていません。一度リロードしてください。');
    return;
  }

  const maxNum = staffs.reduce((max, s) => {
    const num = parseInt(s.id.replace('ST', ''), 10)
    return !isNaN(num) && num > max ? num : max
  }, 0)
  const nextStaffId = `ST${(maxNum + 1).toString().padStart(3, '0')}`
  const secureToken = generateSecureToken()

  // 実行するデータを一旦変数に置く（デバッグしやすくするため）
  const insertData = { 
    id: nextStaffId, 
    shop_id: shop.id, 
    name: newStaffName, 
    email: newStaffEmail, 
    referral_code: `${shop.id}_${nextStaffId}`, 
    secret_token: secureToken,
    is_deleted: false 
  };

  console.log("Attempting to insert:", insertData);

  const { error } = await supabase.from('staffs').insert([insertData])

  if (error) { 
    // ★ エラーの詳細をしっかり出す
    console.error("Supabase Insert Error Detail:", {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint
    });
    alert(`追加に失敗しました。\n理由: ${error.message}\nエラーコード: ${error.code}`);
    return; 
  }
  
  setNewStaffName(''); 
  setNewStaffEmail(''); 
  setIsStaffModalOpen(false);
  await loadData();
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
    <div className="p-6 md:p-10 max-w-screen-2xl mx-auto bg-gray-50 min-h-screen text-gray-800 relative">
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
              <Smartphone className="w-3 h-3" /> 接客用マイページ（自身のQR）を開く
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

{/* 修正：メイン画面のポリシー表示エリア（ヘッダーのすぐ下など） */}
<section className="mb-8 p-5 bg-white rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
  <div className="flex items-center gap-4">
    <div className="p-3 bg-indigo-50 rounded-xl">
      <Coins className="w-5 h-5 text-indigo-600" />
    </div>
    <div>
      <h4 className="text-sm font-bold text-gray-900">報酬分配ポリシー</h4>
      <div className="flex items-center gap-3 mt-1">
        {/* 小さな3色バー */}
        <div className="flex h-1.5 w-24 rounded-full overflow-hidden bg-gray-100">
          <div style={{width: `${ratios.individual}%`}} className="bg-indigo-500" />
          <div style={{width: `${ratios.team}%`}} className="bg-emerald-400" />
          <div style={{width: `${ratios.owner}%`}} className="bg-gray-200" />
        </div>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">
          本人{ratios.individual} / チーム{ratios.team} / 店舗{ratios.owner}
        </p>
      </div>
    </div>
  </div>

  <button 
    onClick={() => setIsPolicyModalOpen(true)} // モーダルを開く
    className="px-4 py-2 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition"
  >
    設定を変更
  </button>
</section>

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
            <button onClick={() => setFilterStatus('rewarded')} className={`flex-1 min-w-[120px] p-3 rounded-xl border text-left transition-all ${filterStatus === 'rewarded' ? 'bg-gray-100 border-gray-300 shadow-sm ring-1 ring-gray-200' : 'border-transparent hover:bg-gray-100/50'}`}>
              <p className="text-[10px] font-bold text-gray-500 mb-1 flex items-center gap-1"><CheckCheck className="w-3 h-3" /> 清算済</p>
              <p className="text-lg font-extrabold text-gray-700 tabular-nums">{summary.rewardedPoints.toLocaleString()}<span className="text-[10px] ml-1 font-normal">pt</span></p>
            </button>
          </div>

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
                    <tr key={item.id} className={`hover:bg-gray-50 transition-colors ${item.status === 'cancel' ? 'opacity-60 bg-red-50/30' : ''}`}>
                      <td className="p-4">
                        <p className="text-[11px] text-gray-500 font-mono">{new Date(item.created_at).toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                        <p className="text-[10px] text-indigo-600 font-bold mt-0.5">{item.staffNthCount}回目の紹介</p>
                      </td>
                      <td className="p-4 font-bold text-gray-800 text-sm">{item.staffName}</td>
                      <td className="p-4 text-right">
                        {item.status === 'cancel' ? (
                          <p className="font-extrabold text-gray-400 text-sm line-through">0 pt</p>
                        ) : (
                          <>
                            <p className="font-extrabold text-gray-900 text-sm">+{item.totalPoints.toLocaleString()} <span className="text-[10px] font-normal text-gray-400">pt</span></p>
                            {item.hasBonus && <p className="text-[9px] text-emerald-600 font-bold">(初回ボーナス)</p>}
                          </>
                        )}
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
                    {s.isOwner && <span className="bg-indigo-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm flex items-center gap-1"><Crown className="w-3 h-3" /> 代表・管理者</span>}
                  </div>
                  <p className="text-[10px] text-gray-500 font-bold mt-1">累計紹介: {s.count}件</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openDetailModal(s)} className="p-2 border border-gray-200 text-gray-600 rounded bg-white hover:bg-gray-50 transition" title="詳細/設定"><Settings className="w-4 h-4" /></button>
                  <button onClick={() => handleCopyUrl(s)} className="p-2 border border-gray-200 text-gray-600 rounded bg-white hover:bg-gray-50 transition" title="URLコピー"><LinkIcon className="w-4 h-4" /></button>
                  <button onClick={() => { setSelectedStaff(s); setIsQrModalOpen(true); }} className="p-2 border border-gray-200 text-gray-600 rounded bg-white hover:bg-gray-50 transition" title="QR表示"><QrCode className="w-4 h-4" /></button>





                </div>
              </div>

              <div className="p-4 flex flex-col flex-1">
                <div className={`flex justify-between items-center p-3 rounded-xl border mb-3 ${s.hasUnpaid ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-100'}`}>
                  <div>
                    <p className={`text-[10px] font-bold mb-0.5 flex items-center gap-1 ${s.hasUnpaid ? 'text-blue-700' : 'text-gray-500'}`}>
                      <Coins className="w-3 h-3" /> {s.hasUnpaid ? '今すぐ精算できる金額' : '清算待ち（現在なし）'}
                    </p>
                    <p className={`text-xl font-extrabold tabular-nums ${s.hasUnpaid ? 'text-blue-700' : 'text-gray-400'}`}>{s.unpaidToStaffPts.toLocaleString()}<span className="text-xs ml-1 font-bold">pt</span></p>
                  </div>
                  <button onClick={() => handlePayStaff(s.id, s.name, s.unpaidToStaffPts)} disabled={!s.hasUnpaid} className={`px-4 py-2 rounded-lg text-xs font-bold shadow-sm transition ${s.hasUnpaid ? 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>
                    {s.hasUnpaid ? '清算済にする' : '清算完了'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      	{/* モーダル群 */}


{/* ポリシー変更モーダル（完成版） */}
{isPolicyModalOpen && (
  <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm p-4" onClick={() => setIsPolicyModalOpen(false)}>
    <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl relative" onClick={e => e.stopPropagation()}>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h3 className="text-xl font-extrabold text-gray-900">分配ポリシーの設定</h3>
          <p className="text-xs text-gray-400 mt-1">報酬100%の行き先を決定します</p>
        </div>
        <button onClick={() => setIsPolicyModalOpen(false)}><X className="w-6 h-6 text-gray-400" /></button>
      </div>

      <div className="space-y-10">
        {/* スライダー群（本人・チーム）は既存のものを使用 */}
        
        {/* 管理者・店舗分（自動計算） */}
        <div className="p-4 bg-gray-50 rounded-2xl flex justify-between items-center border border-gray-100">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">管理者・店舗 留保分</span>
            <p className="text-[9px] text-gray-400 italic mt-0.5">※管理加算やB2B EC原資など</p>
          </div>
          <span className="text-lg font-bold text-indigo-600 tabular-nums">{ratios.owner}%</span>
        </div>

        {/* 3カラムシミュレーション */}
        <div className="bg-gray-900 rounded-2xl p-6 text-white shadow-xl">
          <p className="text-[10px] font-bold text-indigo-300 mb-4 tracking-widest uppercase">Simulation (報酬 5,000pt の場合)</p>
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

{/* ★ 修正：スタッフ詳細・設定モーダル（中身を完全復元） */}
      {detailStaff && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm p-4" onClick={() => setDetailStaff(null)}>
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-xl overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <div className="p-6 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">{detailStaff.name}</h3>
                <p className="text-xs text-gray-400 mt-1">スタッフID: {detailStaff.id}</p>
              </div>
              <button onClick={() => setDetailStaff(null)} className="text-gray-400 hover:text-gray-600"><X className="w-6 h-6" /></button>
            </div>
            
            <div className="flex border-b bg-white">
              <button onClick={() => setDetailTab('history')} className={`flex-1 py-4 text-sm font-bold border-b-2 transition ${detailTab === 'history' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-400'}`}>基本情報</button>
              <button onClick={() => setDetailTab('settings')} className={`flex-1 py-4 text-sm font-bold border-b-2 transition ${detailTab === 'settings' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-400'}`}>詳細設定</button>
            </div>

<div className="p-6 overflow-y-auto space-y-8"> {/* 距離を少し広めに設定 */}
  {detailTab === 'history' ? (
    <>
      {/* 基本情報フォーム */}
      <div className="space-y-4">
        <div>
          <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">お名前</label>
          <input type="text" value={editName} onChange={e => setEditName(e.target.value)} className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-100 transition outline-none" />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">メールアドレス</label>
          <input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-100 transition outline-none" />
        </div>
      </div>

      <button onClick={handleUpdateStaffInfo} className="w-full py-3.5 bg-gray-900 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 hover:bg-gray-800 transition shadow-lg shadow-gray-200">
        <Save className="w-4 h-4" /> 情報を更新する
      </button>

      {/* ★ オーナー以外の場合のみ「危険な操作」を表示 */}
      {!detailStaff.isOwner && (
        <div className="pt-8 mt-4 border-t border-gray-100">
          <p className="text-[10px] font-bold text-red-400 uppercase mb-3 tracking-widest">Danger Zone / 危険な操作</p>
          <button 
            onClick={() => {
              handleDeleteStaff(detailStaff.id, detailStaff.name);
              setDetailStaff(null); // 削除したらダイアログを閉じる
            }} 
            className="flex items-center gap-2 text-red-500 text-sm font-bold hover:bg-red-50 px-4 py-2 rounded-lg transition"
          >
            <Trash2 className="w-4 h-4" /> このスタッフを非表示にする
          </button>
        </div>
      )}
    </>
  ) : (
    <>
      {/* パスワード変更画面 */}
      <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 flex gap-3 mb-2">
        <Info className="w-5 h-5 text-amber-600 shrink-0" />
        <p className="text-xs text-amber-700 leading-relaxed font-medium">
          パスワードを変更すると、このスタッフは次回から新しいパスワードでのログインが必要になります。
        </p>
      </div>
      
      <div className="space-y-4">
        <div>
          <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">新しいパスワード (6文字以上)</label>
          <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-amber-100 transition outline-none" placeholder="••••••" />
        </div>
        <button onClick={handleUpdatePassword} className="w-full py-3.5 bg-white border-2 border-gray-900 text-gray-900 font-bold rounded-xl text-sm flex items-center justify-center gap-2 hover:bg-gray-50 transition">
          <Key className="w-4 h-4" /> パスワードを変更する
        </button>
      </div>
    </>
  )}
</div>
          </div>
        </div>
      )}
      {isStaffModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl text-center">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center justify-center gap-2"><Plus className="w-5 h-5" /> 新しいスタッフを追加</h3>
            <div className="space-y-4 mb-6 text-left">
              <div><label className="block text-[10px] font-bold text-gray-500 mb-1">お名前</label><input type="text" value={newStaffName} onChange={e => setNewStaffName(e.target.value)} className="w-full border border-gray-300 rounded-lg p-3 text-sm" autoFocus /></div>
              <div><label className="block text-[10px] font-bold text-gray-500 mb-1">メールアドレス (必須)</label><input type="email" value={newStaffEmail} onChange={e => setNewStaffEmail(e.target.value)} className="w-full border border-gray-300 rounded-lg p-3 text-sm" /></div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setIsStaffModalOpen(false)} className="flex-1 py-2.5 bg-gray-100 text-gray-600 rounded-lg font-bold text-sm">キャンセル</button>
              <button onClick={handleAddStaff} className="flex-1 py-2.5 bg-gray-900 text-white rounded-lg font-bold text-sm">追加する</button>
            </div>
          </div>
        </div>
      )}

      {isQrModalOpen && selectedStaff && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm p-4" onClick={() => setIsQrModalOpen(false)}>
          <div className="bg-white rounded-2xl p-8 w-full max-w-sm shadow-xl text-center" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-gray-900 mb-1">{selectedStaff.name} さんの紹介QR</h3>
            <div className="bg-white p-4 inline-block border-2 border-gray-100 rounded-xl shadow-sm my-6">
              <QRCodeCanvas value={`${window.location.origin}/welcome/${selectedStaff?.referral_code}`} size={200} level={"H"} />
            </div>
            <button onClick={() => handleCopyUrl(selectedStaff)} className="w-full py-3 bg-gray-100 text-gray-800 font-bold text-sm rounded-lg mb-3 flex items-center justify-center gap-2"><LinkIcon className="w-4 h-4" /> URLをコピーする</button>
            <button onClick={() => setIsQrModalOpen(false)} className="text-sm text-gray-400 underline py-2">閉じる</button>
          </div>
        </div>
      )}

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