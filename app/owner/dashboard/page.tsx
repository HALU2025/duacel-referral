'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

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
  const [searchOrder, setSearchOrder] = useState('')
  const [visibleCount, setVisibleCount] = useState(15) 

  const [summary, setSummary] = useState({
    totalCount: 0,
    unpaidPoints: 0,
    unpaidCount: 0,
    paidPointsTotal: 0,
    paidCount: 0,
  })
  
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const fetchOwnerData = async () => {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return; }

      const { data: shopData } = await supabase
        .from('shops').select(`*, shop_ranks (*)`).eq('owner_id', user.id).maybeSingle()
      
      if (!shopData) { setLoading(false); return; }
      setShop(shopData)
      setRank(shopData.shop_ranks)

      const { data: staffList } = await supabase.from('staffs').select('id, name').eq('shop_id', shopData.id)
      const { data: referralLogs } = await supabase.from('referrals').select('*').eq('shop_id', shopData.id).order('created_at', { ascending: false })
      const { data: pointLogs } = await supabase.from('point_transactions').select('*').eq('shop_id', shopData.id).order('created_at', { ascending: false })

      if (referralLogs && staffList) {
        const historyWithNames = referralLogs.map(log => ({
          ...log,
          staffName: staffList.find(s => s.id === log.staff_id)?.name || '不明'
        }))
        setReferralHistory(historyWithNames)

        // スタッフランキング用集計
        const staffsWithCounts = staffList.map(s => ({
          ...s,
          count: referralLogs.filter(r => r.staff_id === s.id).length
        }))
        setStaffs(staffsWithCounts)
      }

      if (pointLogs) {
        const paidLogs = pointLogs.filter(tx => tx.status === 'paid')
        setIssuedHistory(paidLogs)
        const unpaidTxs = pointLogs.filter(tx => tx.status === 'confirmed')
        const unpaidPoints = unpaidTxs.reduce((sum, tx) => sum + (Number(tx.points) || 0), 0)
        const paidPointsTotal = paidLogs.reduce((sum, tx) => sum + (Number(tx.points) || 0), 0)

        setSummary({
          totalCount: referralLogs?.length || 0,
          unpaidPoints: unpaidPoints,
          unpaidCount: unpaidTxs.length,
          paidPointsTotal: paidPointsTotal,
          paidCount: paidLogs.length,
        })
      }
      setLoading(false)
    }
    fetchOwnerData()
  }, [router])

  // --- フィルタリングロジック ---
  const filteredHistory = useMemo(() => {
    return referralHistory.filter(item => {
      const matchStaff = filterStaff === '' || item.staff_id === filterStaff
      const matchStatus = filterStatus === '' || item.status === filterStatus
      const matchOrder = searchOrder === '' || item.order_number?.toLowerCase().includes(searchOrder.toLowerCase())
      return matchStaff && matchStatus && matchOrder
    })
  }, [referralHistory, filterStaff, filterStatus, searchOrder])

  const displayedHistory = filteredHistory.slice(0, visibleCount)

  if (loading) return <div className="p-12 text-center text-gray-500 text-sm">データを読み込み中...</div>
  if (!shop) return <div className="p-12 text-center text-red-500">店舗情報が見つかりません。</div>

  const rewardPoints = rank?.reward_points || 5000

  return (
    <div className="p-6 md:p-10 max-w-screen-2xl mx-auto bg-gray-50 min-h-screen text-gray-800">
      
      {/* 1. ヘッダー */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold">{shop.name}</h1>
            {rank && (
              <span className="px-3 py-1 bg-indigo-100 text-indigo-800 text-xs font-bold rounded-full border border-indigo-200 shadow-inner">
                {rank.label}会員 (1件: {rewardPoints.toLocaleString()} pt)
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 font-mono">Shop ID: {shop.id}</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => window.location.reload()} className="text-sm text-gray-500 hover:text-gray-800 transition">🔄 更新</button>
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
          <p className="text-sm font-medium text-gray-500 mb-2">累計ギフト発行額 <span className="ml-2 text-xs text-blue-600 bg-blue-50 px-2 rounded-full">{summary.paidCount}回</span></p>
          <p className="text-5xl font-extrabold text-gray-900 tabular-nums">{summary.paidPointsTotal.toLocaleString()}<span className="text-xl ml-1 text-gray-400 font-bold">pt</span></p>
        </div>
        <div className="bg-white p-7 rounded-2xl shadow-sm border border-gray-100 ring-1 ring-black/5">
          <p className="text-sm font-medium text-gray-500 mb-2">総紹介件数</p>
          <p className="text-5xl font-extrabold text-gray-900 tabular-nums">{summary.totalCount}<span className="text-xl ml-1 text-gray-400 font-bold">件</span></p>
        </div>
        <div className="bg-white p-7 rounded-2xl shadow-sm border border-gray-100 ring-1 ring-black/5">
          <p className="text-sm font-medium text-gray-500 mb-2">登録スタッフ</p>
          <p className="text-5xl font-extrabold text-gray-900 tabular-nums">{staffs.length}<span className="text-xl ml-1 text-gray-400 font-bold">名</span></p>
        </div>
      </div>

      {/* 3. メインコンテンツ */}
      <div className="grid grid-cols-1 xl:grid-cols-6 gap-8">
        
        {/* 左：紹介履歴（検索機能付き） */}
        <div className="xl:col-span-4 space-y-4">
          
          {/* 🔍 検索・フィルターバー */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[140px]">
              <label className="text-[10px] font-bold text-gray-400 block mb-1">スタッフ</label>
              <select value={filterStaff} onChange={(e) => {setFilterStaff(e.target.value); setVisibleCount(15)}} className="w-full p-2 bg-gray-50 border border-gray-200 rounded text-sm outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">全員表示</option>
                {staffs.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
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
            <div className="flex-[2] min-w-[200px]">
              <label className="text-[10px] font-bold text-gray-400 block mb-1">受注番号検索</label>
              <input type="text" placeholder="番号を入力..." value={searchOrder} onChange={(e) => {setSearchOrder(e.target.value); setVisibleCount(15)}} className="w-full p-2 bg-gray-50 border border-gray-200 rounded text-sm outline-none focus:ring-2 focus:ring-blue-500 font-mono" />
            </div>
            <button onClick={() => {setFilterStaff(''); setFilterStatus(''); setSearchOrder('')}} className="px-4 py-2 text-xs text-gray-400 hover:text-blue-600 transition underline">リセット</button>
          </div>

          {/* 履歴テーブル */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
              <h3 className="font-bold text-gray-900">紹介履歴</h3>
              <span className="text-xs font-normal bg-gray-200 text-gray-600 px-3 py-1 rounded-full">該当 {filteredHistory.length} 件</span>
            </div>
            <div className="max-h-[600px] overflow-y-auto">
              <table className="w-full text-sm text-left sticky-header">
                <thead className="bg-gray-100/80 text-gray-500 text-[11px] uppercase tracking-wider sticky top-0 z-10 backdrop-blur-sm shadow-sm">
                  <tr>
                    <th className="p-4 font-semibold">日時 / 受注番号</th>
                    <th className="p-4 font-semibold">スタッフ</th>
                    <th className="p-4 font-semibold text-right">獲得Pt</th>
                    <th className="p-4 font-semibold text-center">ステータス</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-600">
                  {displayedHistory.map(item => {
                    const status = STATUS_MAP[item.status] || { label: item.status, color: 'bg-gray-100' };
                    const pt = item.status !== 'cancel' ? rewardPoints : 0;
                    return (
                      <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="p-4">
                          <p className="text-[10px] text-gray-400 tabular-nums">{new Date(item.created_at).toLocaleString()}</p>
                          <p className="font-mono text-gray-900 font-bold">{item.order_number}</p>
                        </td>
                        <td className="p-4 font-medium text-gray-800">{item.staffName}</td>
                        <td className="p-4 text-right font-bold tabular-nums text-gray-900">
                          {pt > 0 ? `+${pt.toLocaleString()}` : '0'} <span className="text-[10px] text-gray-400 font-normal">pt</span>
                        </td>
                        <td className="p-4 text-center">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${status.color}`}>
                            {status.label}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              
              {/* もっと見るボタン */}
              {filteredHistory.length > visibleCount && (
                <div className="p-6 text-center bg-gray-50/50 border-t">
                  <button onClick={() => setVisibleCount(prev => prev + 20)} className="px-8 py-2 bg-white border border-gray-200 rounded-full text-sm font-bold shadow-sm hover:bg-gray-50 transition-all active:scale-95">
                    さらに20件表示（残り {filteredHistory.length - visibleCount} 件）
                  </button>
                </div>
              )}

              {filteredHistory.length === 0 && (
                <div className="py-24 text-center text-gray-400 text-sm">該当するデータがありません</div>
              )}
            </div>
          </div>
        </div>

        {/* 右：サイドパネル */}
        <div className="xl:col-span-2 space-y-8">
          
          {/* ギフト発行履歴 */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
              <h3 className="font-bold text-gray-900">🎁 ギフト発行履歴</h3>
            </div>
            <div className="max-h-[250px] overflow-y-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-400 text-[10px] uppercase">
                  <tr><th className="p-3">発行日</th><th className="p-3 text-right">発行額</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {issuedHistory.map(tx => (
                    <tr key={tx.id} className="hover:bg-gray-50/50">
                      <td className="p-3 text-xs text-gray-500 tabular-nums">{new Date(tx.created_at).toLocaleDateString()}</td>
                      <td className="p-3 text-right font-bold text-blue-700">{(Number(tx.points) || 0).toLocaleString()} <span className="text-[10px] font-normal text-gray-400">pt</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {issuedHistory.length === 0 && <div className="p-8 text-center text-gray-400 text-xs">履歴なし</div>}
            </div>
          </div>

          {/* ランキング */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-5 border-b border-gray-100 bg-gray-50/50">
              <h3 className="font-bold text-gray-900">🏆 スタッフランキング</h3>
            </div>
            <div className="max-h-[300px] overflow-y-auto p-2">
              {staffs.sort((a, b) => b.count - a.count).map((s, index) => (
                <div key={s.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50">
                  <div className="flex items-center gap-3">
                    <span className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${index < 3 ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500'}`}>{index + 1}</span>
                    <span className="font-semibold text-gray-800 text-sm">{s.name}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-extrabold text-blue-600 tabular-nums">{s.count}</p>
                    <p className="text-[10px] text-gray-400">紹介件数</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* フッター */}
      <footer className="mt-12 pt-8 border-t border-gray-100 text-center">
        <button className="text-sm px-6 py-3 bg-gray-900 text-white rounded-xl shadow-lg hover:bg-gray-800 transition font-bold">店頭用QRコードを表示</button>
      </footer>
    </div>
  )
}