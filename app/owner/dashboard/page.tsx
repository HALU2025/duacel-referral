'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function OwnerDashboard() {
  const [shop, setShop] = useState<any>(null)
  const [staffs, setStaffs] = useState<any[]>([])
  const [history, setHistory] = useState<any[]>([])
  const [totalReferrals, setTotalReferrals] = useState(0)
  const [confirmedCount, setConfirmedCount] = useState(0) // 確定済みカウント追加
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  const TABLE_NAME = 'referrals'

  useEffect(() => {
    const fetchOwnerData = async () => {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return; }

      const { data: shopData } = await supabase
        .from('shops').select('*').eq('owner_id', user.id).maybeSingle()
      if (!shopData) { setLoading(false); return; }
      setShop(shopData)

      const { data: staffList } = await supabase
        .from('staffs').select('*').eq('shop_id', shopData.id)

      if (staffList) {
        // スタッフ別集計
        const formattedStaffs = await Promise.all(staffList.map(async (s: any) => {
          const { count } = await supabase
            .from(TABLE_NAME).select('*', { count: 'exact', head: true }).eq('staff_id', s.id)
          return { id: s.id, name: s.name, count: count || 0 }
        }))
        setStaffs(formattedStaffs)
        setTotalReferrals(formattedStaffs.reduce((sum, s) => sum + s.count, 0))

        // 全履歴取得 (limitを外して最新順)
        const { data: referralLogs } = await supabase
          .from(TABLE_NAME)
          .select('id, created_at, order_number, status, staff_id, incentive_status')
          .eq('shop_id', shopData.id)
          .order('created_at', { ascending: false })

        if (referralLogs) {
          const historyWithNames = referralLogs.map(log => ({
            ...log,
            staffName: staffList.find(s => s.id === log.staff_id)?.name || '不明'
          }))
          setHistory(historyWithNames)
          
          // 確定済み（confirmed）の件数をカウント
          const confirmed = referralLogs.filter(log => log.status === 'confirmed' || log.status === 'issued').length
          setConfirmedCount(confirmed)
        }
      }
      setLoading(false)
    }
    fetchOwnerData()
  }, [router])

  if (loading) return <div className="p-8 text-center">データを読み込み中...</div>
  if (!shop) return <div className="p-8">店舗情報が見つかりません。</div>

  return (
    <div className="p-8 max-w-7xl mx-auto bg-gray-50 min-h-screen">
      <header className="flex justify-between items-end border-b pb-6 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{shop.name} 経営ダッシュボード</h1>
          <p className="text-sm text-gray-500 font-mono">Shop ID: {shop.id}</p>
        </div>
        <div className="flex gap-4">
          <button onClick={() => window.location.reload()} className="text-xs text-gray-400 hover:text-gray-600">表示を更新</button>
          <button onClick={() => supabase.auth.signOut().then(() => router.push('/login'))}
            className="text-sm px-4 py-2 bg-white border rounded shadow-sm hover:bg-gray-50 transition">
            ログアウト
          </button>
        </div>
      </header>

      {/* サマリーカード：3列に変更 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-blue-500">
          <p className="text-sm font-medium text-gray-500 mb-1">総紹介件数（仮計上含む）</p>
          <p className="text-4xl font-bold text-gray-800">{totalReferrals}<span className="text-lg ml-1 text-gray-400 font-normal">件</span></p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-green-500">
          <p className="text-sm font-medium text-gray-500 mb-1">報酬確定済み</p>
          <p className="text-4xl font-bold text-green-600">{confirmedCount}<span className="text-lg ml-1 text-gray-400 font-normal">件</span></p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-indigo-500">
          <p className="text-sm font-medium text-gray-500 mb-1">登録スタッフ</p>
          <p className="text-4xl font-bold text-gray-800">{staffs.length}<span className="text-lg ml-1 text-gray-400 font-normal">名</span></p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* 左：スタッフ実績 (1/4幅) */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden sticky top-8">
            <div className="p-4 border-b bg-gray-50 font-bold text-gray-700">スタッフ別実績</div>
            <div className="max-h-[600px] overflow-y-auto">
              <table className="w-full text-sm text-left">
                <tbody className="divide-y text-gray-600">
                  {staffs.sort((a, b) => b.count - a.count).map(s => (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="p-4">
                        <p className="font-bold text-gray-700">{s.name}</p>
                        <p className="text-[10px] text-gray-400 font-mono">({s.id})</p>
                      </td>
                      <td className="p-4 text-right">
                        <span className="font-bold text-blue-600">{s.count}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* 右：紹介履歴 (3/4幅) */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 border-b bg-gray-50 font-bold text-gray-700 flex justify-between items-center">
              <span>全紹介履歴</span>
              <span className="text-xs font-normal bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">合計 {history.length} 件</span>
            </div>
            {/* スクロール可能なエリア */}
            <div className="max-h-[600px] overflow-y-auto">
              <table className="w-full text-sm text-left sticky-header">
                <thead className="bg-gray-50 text-gray-400 text-[11px] uppercase tracking-wider sticky top-0 z-10 shadow-sm">
                  <tr>
                    <th className="p-4 font-medium">日時</th>
                    <th className="p-4 font-medium">スタッフ</th>
                    <th className="p-4 font-medium">受注番号</th>
                    <th className="p-4 font-medium">ステータス</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-gray-600">
                  {history.map(item => (
                    <tr key={item.id} className="hover:bg-gray-50 transition">
                      <td className="p-4 text-xs whitespace-nowrap">
                        {new Date(item.created_at).toLocaleString('ja-JP', { 
                          year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' 
                        })}
                      </td>
                      <td className="p-4 font-medium text-gray-800">{item.staffName}</td>
                      <td className="p-4 text-xs font-mono">{item.order_number}</td>
                      <td className="p-4">
  <span className={`px-2 py-1 rounded text-[10px] font-bold ${
    item.status === 'pending' ? 'bg-amber-50 text-amber-600 border border-amber-100' : 
    (item.status === 'confirmed' || item.status === 'issued') ? 'bg-green-50 text-green-700 border border-green-100' : 
    'bg-red-50 text-red-500'
  }`}>
    {item.status === 'pending' ? '仮計上' : 
     item.status === 'confirmed' ? '報酬確定' : 
     item.status === 'issued' ? 'ギフト発行済' : 'キャンセル'}
  </span>
</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {history.length === 0 && (
                <div className="p-20 text-center text-gray-400">紹介データがまだありません</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ツールメニュー */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        <button className="flex items-center justify-center gap-2 p-4 bg-indigo-900 text-white rounded-xl hover:bg-indigo-800 transition shadow-lg">
          <span className="text-lg">📊</span> 報酬レポートをDL (CSV)
        </button>
        <button className="flex items-center justify-center gap-2 p-4 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition shadow-sm">
          <span>🖼️</span> 販促素材・バナー
        </button>
        <button className="flex items-center justify-center gap-2 p-4 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition shadow-sm">
          <span>📱</span> 店頭用QRを表示
        </button>
      </div>
    </div>
  )
}