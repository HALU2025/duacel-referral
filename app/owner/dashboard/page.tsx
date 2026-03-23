'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { QRCodeCanvas } from 'qrcode.react' // QRコード表示用に追加

// 定数：ステータスの表示設定
const STATUS_MAP: any = {
  pending: { label: '仮計上', color: 'bg-amber-50 text-amber-700 border-amber-100' },
  confirmed: { label: '報酬確定', color: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
  issued: { label: 'ギフト発行済', color: 'bg-blue-50 text-blue-700 border-blue-100' },
  cancel: { label: 'キャンセル', color: 'bg-red-50 text-red-600 border-red-100' },
}

export default function OwnerDashboard() {
  const [shop, setShop] = useState<any>(null)
  const [rank, setRank] = useState<any>(null)
  const [staffs, setStaffs] = useState<any[]>([])
  const [referralHistory, setReferralHistory] = useState<any[]>([])
  const [issuedHistory, setIssuedHistory] = useState<any[]>([])
  
  // 検索・表示用ステート
  const [filterStaff, setFilterStaff] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [visibleCount, setVisibleCount] = useState(15) 

  // ★ スタッフ管理モーダル用ステート
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false)
  const [newStaffName, setNewStaffName] = useState('')
  const [isQrModalOpen, setIsQrModalOpen] = useState(false)
  const [selectedStaff, setSelectedStaff] = useState<any>(null)
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false) // スタッフ自己登録用QR

  const [summary, setSummary] = useState({
    totalCount: 0,
    unpaidPoints: 0,
    unpaidCount: 0,
    paidPointsTotal: 0,
    paidCount: 0,
  })
  
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  // --- データ取得ロジック（再利用できるように関数化） ---
  const loadData = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return; }

    const { data: shopData } = await supabase
      .from('shops').select(`*, shop_ranks (*)`).eq('owner_id', user.id).maybeSingle()
    
    if (!shopData) { setLoading(false); return; }
    setShop(shopData)
    setRank(shopData.shop_ranks)

    // is_deleted フラグも含めて取得
    const { data: staffList } = await supabase.from('staffs').select('id, name, is_deleted').eq('shop_id', shopData.id)
    const { data: referralLogs } = await supabase.from('referrals').select('*').eq('shop_id', shopData.id).order('created_at', { ascending: false })
    const { data: pointLogs } = await supabase.from('point_transactions').select('*').eq('shop_id', shopData.id)

    if (referralLogs && staffList && pointLogs) {
      const reversedLogs = [...referralLogs].reverse();
      const staffCounters: Record<string, number> = {};

      const enrichedReferrals = reversedLogs.map(log => {
        staffCounters[log.staff_id] = (staffCounters[log.staff_id] || 0) + 1;
        const nthCount = staffCounters[log.staff_id];

        const refTxs = pointLogs.filter(tx => tx.referral_id === log.id && (tx.status === 'confirmed' || tx.status === 'paid'));
        const totalPoints = refTxs.reduce((sum, tx) => sum + (Number(tx.points) || 0), 0);
        const hasBonus = refTxs.some(tx => tx.metadata?.is_bonus === true);

        return {
          ...log,
          staffName: staffList.find(s => s.id === log.staff_id)?.name || '不明',
          staffNthCount: nthCount,
          totalPoints: totalPoints,
          hasBonus: hasBonus
        }
      }).reverse();

      setReferralHistory(enrichedReferrals)
      setIssuedHistory(enrichedReferrals.filter(r => r.status === 'issued'))

      // スタッフ一覧用（削除済みも含めて全件集計するが、画面表示時にフィルターする）
      const staffsWithCounts = staffList.map(s => ({
        ...s,
        count: referralLogs.filter(r => r.staff_id === s.id && r.status !== 'cancel').length
      }))
      setStaffs(staffsWithCounts)

      const unpaidTxs = pointLogs.filter(tx => tx.status === 'confirmed')
      const paidTxs = pointLogs.filter(tx => tx.status === 'paid')

      setSummary({
        totalCount: referralLogs.length,
        unpaidPoints: unpaidTxs.reduce((sum, tx) => sum + (Number(tx.points) || 0), 0),
        unpaidCount: new Set(unpaidTxs.map(tx => tx.referral_id)).size,
        paidPointsTotal: paidTxs.reduce((sum, tx) => sum + (Number(tx.points) || 0), 0),
        paidCount: new Set(paidTxs.map(tx => tx.referral_id)).size,
      })
    }
    setLoading(false)
  }

  useEffect(() => { loadData() }, [router])

  // --- スタッフ管理アクション ---
  
  const handleAddStaff = async () => {
    if (!newStaffName.trim()) return
    const { error } = await supabase.from('staffs').insert([{ 
      shop_id: shop.id, 
      name: newStaffName, 
      is_deleted: false 
    }])
    if (error) { alert('スタッフの追加に失敗しました。'); return; }
    
    setNewStaffName('')
    setIsStaffModalOpen(false)
    await loadData() // データ再取得
  }

  const handleDeleteStaff = async (staffId: string, staffName: string) => {
    if (!confirm(`スタッフ「${staffName}」をリストから削除しますか？\n※過去の紹介履歴はそのまま残ります。`)) return
    
    const { error } = await supabase.from('staffs').update({ is_deleted: true }).eq('id', staffId)
    if (error) { alert('削除に失敗しました。'); return; }
    
    await loadData()
  }

  const handleCopyUrl = (staffId: string) => {
    const url = `${window.location.origin}/r/${staffId}`
    navigator.clipboard.writeText(url)
    alert('紹介用URLをコピーしました！\nLINE等で送信できます。')
  }

  const openQrModal = (staff: any) => {
    setSelectedStaff(staff)
    setIsQrModalOpen(true)
  }

  // --- フィルタリングロジック ---
  const filteredHistory = useMemo(() => {
    return referralHistory.filter(item => {
      const matchStaff = filterStaff === '' || item.staff_id === filterStaff
      const matchStatus = filterStatus === '' || item.status === filterStatus
      return matchStaff && matchStatus
    })
  }, [referralHistory, filterStaff, filterStatus])

  const displayedHistory = filteredHistory.slice(0, visibleCount)

  if (loading) return <div className="p-12 text-center text-gray-500 text-sm">データを読み込み中...</div>
  if (!shop) return <div className="p-12 text-center text-red-500">店舗情報が見つかりません。</div>

  const rewardPoints = rank?.reward_points || 5000

  return (
    <div className="p-6 md:p-10 max-w-screen-2xl mx-auto bg-gray-50 min-h-screen text-gray-800 relative">
      
      {/* 1. ヘッダー */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold">{shop.name}</h1>
            {rank && (
              <span className="px-3 py-1 bg-indigo-100 text-indigo-800 text-xs font-bold rounded-full border border-indigo-200 shadow-inner">
                {rank.label}会員 (基本: {rewardPoints.toLocaleString()} pt)
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 font-mono">Shop ID: {shop.id}</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={loadData} className="text-sm text-gray-500 hover:text-gray-800 transition">🔄 更新</button>
          <button onClick={() => supabase.auth.signOut().then(() => router.push('/login'))}
            className="text-sm px-5 py-2.5 bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-gray-50 transition font-medium">
            ログアウト
          </button>
        </div>
      </header>

      {/* 2. サマリーカード */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6 mb-10">
        <div className="bg-white p-7 rounded-2xl shadow-sm border border-gray-100 ring-1 ring-black/5">
          <p className="text-sm font-medium text-gray-500 mb-2">現在の未払報酬 (確定済) <span className="ml-2 text-xs text-emerald-600 bg-emerald-50 px-2 rounded-full">{summary.unpaidCount}件</span></p>
          <p className="text-5xl font-extrabold text-emerald-600 tabular-nums">{summary.unpaidPoints.toLocaleString()}<span className="text-xl ml-1 text-gray-400 font-bold">pt</span></p>
        </div>
        <div className="bg-white p-7 rounded-2xl shadow-sm border border-gray-100 ring-1 ring-black/5">
          <p className="text-sm font-medium text-gray-500 mb-2">累計ギフト発行実績 <span className="ml-2 text-xs text-blue-600 bg-blue-50 px-2 rounded-full">{summary.paidCount}件</span></p>
          <p className="text-5xl font-extrabold text-gray-900 tabular-nums">{summary.paidPointsTotal.toLocaleString()}<span className="text-xl ml-1 text-gray-400 font-bold">pt</span></p>
        </div>
        <div className="bg-white p-7 rounded-2xl shadow-sm border border-gray-100 ring-1 ring-black/5">
          <p className="text-sm font-medium text-gray-500 mb-2">総紹介件数</p>
          <p className="text-5xl font-extrabold text-gray-900 tabular-nums">{summary.totalCount}<span className="text-xl ml-1 text-gray-400 font-bold">件</span></p>
        </div>
        <div className="bg-white p-7 rounded-2xl shadow-sm border border-gray-100 ring-1 ring-black/5">
          <p className="text-sm font-medium text-gray-500 mb-2">アクティブスタッフ</p>
          <p className="text-5xl font-extrabold text-gray-900 tabular-nums">{staffs.filter(s => !s.is_deleted).length}<span className="text-xl ml-1 text-gray-400 font-bold">名</span></p>
        </div>
      </div>

      {/* 3. メインコンテンツ */}
      <div className="grid grid-cols-1 xl:grid-cols-6 gap-8">
        
        {/* 左：紹介履歴（変更なし） */}
        <div className="xl:col-span-4 space-y-4">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[140px]">
              <label className="text-[10px] font-bold text-gray-400 block mb-1">スタッフ</label>
              <select value={filterStaff} onChange={(e) => {setFilterStaff(e.target.value); setVisibleCount(15)}} className="w-full p-2 bg-gray-50 border border-gray-200 rounded text-sm outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">全員表示</option>
                {/* 検索ドロップダウンには過去スタッフも含めるか、アクティブだけに絞るか。今回は全員表示にしておきます */}
                {staffs.map(s => <option key={s.id} value={s.id}>{s.name} {s.is_deleted ? '(退職)' : ''}</option>)}
              </select>
            </div>
            <div className="flex-1 min-w-[140px]">
              <label className="text-[10px] font-bold text-gray-400 block mb-1">ステータス</label>
              <select value={filterStatus} onChange={(e) => {setFilterStatus(e.target.value); setVisibleCount(15)}} className="w-full p-2 bg-gray-50 border border-gray-200 rounded text-sm outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">すべての状態</option>
                <option value="pending">仮計上</option>
                <option value="confirmed">報酬確定</option>
                <option value="issued">ギフト発行済</option>
                <option value="cancel">キャンセル</option>
              </select>
            </div>
            <button onClick={() => {setFilterStaff(''); setFilterStatus('')}} className="px-4 py-2 text-xs text-gray-400 hover:text-blue-600 transition underline">リセット</button>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
              <h3 className="font-bold text-gray-900">紹介履歴</h3>
              <span className="text-xs font-normal bg-gray-200 text-gray-600 px-3 py-1 rounded-full">該当 {filteredHistory.length} 件</span>
            </div>
            <div className="max-h-[600px] overflow-y-auto">
              <table className="w-full text-sm text-left sticky-header">
                <thead className="bg-gray-100/80 text-gray-500 text-[11px] uppercase tracking-wider sticky top-0 z-10 backdrop-blur-sm shadow-sm">
                  <tr>
                    <th className="p-4 font-semibold">日時 / 紹介回数</th>
                    <th className="p-4 font-semibold">スタッフ</th>
                    <th className="p-4 font-semibold text-right">獲得Pt</th>
                    <th className="p-4 font-semibold text-center">ステータス</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-600">
                  {displayedHistory.map(item => {
                    const status = STATUS_MAP[item.status] || { label: item.status, color: 'bg-gray-100' };
                    const displayPt = item.status === 'pending' ? rewardPoints : item.totalPoints;
                    return (
                      <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="p-4">
                          <p className="text-[10px] text-gray-400 tabular-nums">{new Date(item.created_at).toLocaleString()}</p>
                          <p className="text-indigo-600 font-bold text-xs mt-1">{item.staffNthCount} 回目の紹介</p>
                        </td>
                        <td className="p-4 font-medium text-gray-800">{item.staffName}</td>
                        <td className="p-4 text-right">
                          <div className="font-bold tabular-nums text-gray-900">
                            {displayPt > 0 ? `+${displayPt.toLocaleString()}` : '0'} <span className="text-[10px] text-gray-400 font-normal">pt</span>
                          </div>
                          {item.hasBonus && <div className="text-[10px] text-emerald-600 font-bold mt-1">(+初回ボーナス)</div>}
                        </td>
                        <td className="p-4 text-center">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${status.color}`}>{status.label}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {filteredHistory.length > visibleCount && (
                <div className="p-6 text-center bg-gray-50/50 border-t">
                  <button onClick={() => setVisibleCount(prev => prev + 20)} className="px-8 py-2 bg-white border border-gray-200 rounded-full text-sm font-bold shadow-sm hover:bg-gray-50 transition-all active:scale-95">
                    さらに20件表示（残り {filteredHistory.length - visibleCount} 件）
                  </button>
                </div>
              )}
              {filteredHistory.length === 0 && <div className="py-24 text-center text-gray-400 text-sm">該当するデータがありません</div>}
            </div>
          </div>
        </div>

        {/* 右：サイドパネル */}
        <div className="xl:col-span-2 space-y-8">
          
          {/* ★ 【NEW】スタッフ一覧＆管理パネル */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-full max-h-[600px]">
            <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
              <h3 className="font-bold text-gray-900">👥 スタッフ一覧 (専用URL)</h3>
              <button onClick={() => setIsStaffModalOpen(true)} className="text-[11px] px-3 py-1.5 bg-blue-600 text-white font-bold rounded hover:bg-blue-700 transition shadow-sm">
                ＋ 追加
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {/* is_deleted: false のスタッフのみを表示し、件数順でソート */}
              {staffs.filter(s => !s.is_deleted).sort((a, b) => b.count - a.count).map((s, index) => (
                <div key={s.id} className="bg-white border border-gray-100 p-3 rounded-xl shadow-sm hover:border-gray-300 transition-colors">
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold ${index < 3 ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
                        {index + 1}
                      </span>
                      <span className="font-bold text-gray-800 text-sm">{s.name}</span>
                    </div>
                    <div className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                      {s.count}件
                    </div>
                  </div>
                  
                  {/* アクションボタン群 */}
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => handleCopyUrl(s.id)} className="flex-1 text-[11px] py-1.5 border border-gray-200 text-gray-600 rounded bg-gray-50 hover:bg-gray-100 font-medium transition">
                      🔗 URLコピー
                    </button>
                    <button onClick={() => openQrModal(s)} className="flex-1 text-[11px] py-1.5 border border-gray-200 text-gray-600 rounded bg-gray-50 hover:bg-gray-100 font-medium transition">
                      📱 QR表示
                    </button>
                    {/* 削除ボタン（ゴミ箱アイコン） */}
                    <button onClick={() => handleDeleteStaff(s.id, s.name)} className="px-2 border border-red-100 text-red-500 rounded bg-red-50 hover:bg-red-100 transition" title="スタッフを非表示にする">
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
              {staffs.filter(s => !s.is_deleted).length === 0 && (
                <div className="p-8 text-center text-gray-400 text-xs">アクティブなスタッフがいません</div>
              )}
            </div>

            {/* スタッフの自己登録を促すボタン */}
            <div className="p-4 border-t border-gray-100 bg-gray-50">
              <button onClick={() => setIsInviteModalOpen(true)} className="w-full py-2 text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-lg hover:bg-indigo-100 transition">
                📲 スタッフ招待用QRコードを表示
              </button>
            </div>
          </div>

        </div>
      </div>
      
      {/* =========================================
          モーダル群 (Dialogs) 
      ========================================= */}

      {/* 1. スタッフ追加モーダル */}
      {isStaffModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 mb-4">新しいスタッフを追加</h3>
            <p className="text-xs text-gray-500 mb-4">名前を入力するだけで、専用の紹介URLが即座に発行されます。</p>
            <input 
              type="text" 
              placeholder="例: 山田 花子" 
              value={newStaffName} 
              onChange={(e) => setNewStaffName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none mb-6"
              autoFocus
            />
            <div className="flex gap-3">
              <button onClick={() => setIsStaffModalOpen(false)} className="flex-1 py-2.5 bg-gray-100 text-gray-600 rounded-lg font-bold text-sm hover:bg-gray-200 transition">キャンセル</button>
              <button onClick={handleAddStaff} disabled={!newStaffName.trim()} className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg font-bold text-sm hover:bg-blue-700 transition disabled:opacity-50">追加する</button>
            </div>
          </div>
        </div>
      )}

      {/* 2. スタッフ専用QR表示モーダル */}
      {isQrModalOpen && selectedStaff && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm p-4" onClick={() => setIsQrModalOpen(false)}>
          <div className="bg-white rounded-2xl p-8 w-full max-w-sm shadow-xl text-center" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-gray-900 mb-1">{selectedStaff.name} さんの紹介QR</h3>
            <p className="text-xs text-gray-500 mb-6">お客様にこの画面を読み取ってもらってください</p>
            
            <div className="bg-white p-4 inline-block border-2 border-gray-100 rounded-xl shadow-sm mb-6">
              <QRCodeCanvas value={`${window.location.origin}/r/${selectedStaff.id}`} size={200} level={"H"} />
            </div>
            
            <button onClick={() => handleCopyUrl(selectedStaff.id)} className="w-full py-3 bg-gray-100 text-gray-800 font-bold text-sm rounded-lg hover:bg-gray-200 transition mb-3">
              🔗 URLをコピーする
            </button>
            <button onClick={() => setIsQrModalOpen(false)} className="text-sm text-gray-400 underline py-2">閉じる</button>
          </div>
        </div>
      )}

      {/* 3. スタッフ招待（自己登録）用QRモーダル */}
      {isInviteModalOpen && shop && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm p-4" onClick={() => setIsInviteModalOpen(false)}>
          <div className="bg-white rounded-2xl p-8 w-full max-w-sm shadow-xl text-center" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-indigo-700 mb-1">スタッフ招待QRコード</h3>
            <p className="text-xs text-gray-500 mb-6">従業員のスマホで読み取ってもらうと、自分で登録手続きができます。</p>
            
            <div className="bg-white p-4 inline-block border-2 border-indigo-100 rounded-xl shadow-sm mb-6">
              <QRCodeCanvas value={`${window.location.origin}/reg/${shop.id}`} size={200} level={"H"} fgColor="#4338ca" />
            </div>
            
            <button onClick={() => setIsInviteModalOpen(false)} className="w-full py-3 bg-indigo-50 border border-indigo-100 text-indigo-700 font-bold text-sm rounded-lg hover:bg-indigo-100 transition">
              閉じる
            </button>
          </div>
        </div>
      )}

    </div>
  )
}