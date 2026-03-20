'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function OwnerDashboard() {
  const [shop, setShop] = useState<any>(null)
  const [staffs, setStaffs] = useState<any[]>([])
  const [history, setHistory] = useState<any[]>([])
  const [totalReferrals, setTotalReferrals] = useState(0)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  const TABLE_NAME = 'referrals'

  useEffect(() => {
    const fetchOwnerData = async () => {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return; }

      // 1. 店舗情報
      const { data: shopData } = await supabase
        .from('shops').select('*').eq('owner_id', user.id).maybeSingle()
      if (!shopData) { setLoading(false); return; }
      setShop(shopData)

      // 2. スタッフ一覧 & 紹介数
      const { data: staffList } = await supabase
        .from('staffs').select('*').eq('shop_id', shopData.id)

      if (staffList) {
        const formattedStaffs = await Promise.all(staffList.map(async (s: any) => {
          const { count } = await supabase
            .from(TABLE_NAME).select('*', { count: 'exact', head: true }).eq('staff_id', s.id)
          return { id: s.id, name: s.name, count: count || 0 }
        }))
        setStaffs(formattedStaffs)
        setTotalReferrals(formattedStaffs.reduce((sum, s) => sum + s.count, 0))

        // 3. 最新の紹介履歴を取得（注文番号やステータスを含む）
        const { data: referralLogs } = await supabase
          .from(TABLE_NAME)
          .select('id, created_at, order_number, status, staff_id, incentive_status')
          .eq('shop_id', shopData.id)
          .order('created_at', { ascending: false })
          .limit(10)

        if (referralLogs) {
          const historyWithNames = referralLogs.map(log => ({
            ...log,
            staffName: staffList.find(s => s.id === log.staff_id)?.name || '不明'
          }))
          setHistory(historyWithNames)
        }
      }
      setLoading(false)
    }
    fetchOwnerData()
  }, [router])

  if (loading) return <div className="p-8">読み込み中...</div>
  if (!shop) return <div className="p-8">店舗情報が見つかりません。</div>

  return (
    <div className="p-8 max-w-6xl mx-auto bg-gray-50 min-h-screen">
      <header className="flex justify-between items-center border-b pb-6 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{shop.name} 経営ダッシュボード</h1>
          <p className="text-sm text-gray-500 font-mono text-indigo-600">Shop ID: {shop.id}</p>
        </div>
        <button onClick={() => supabase.auth.signOut().then(() => router.push('/login'))}
          className="text-sm px-4 py-2 bg-white border rounded shadow-sm hover:bg-red-50 hover:text-red-600 transition">
          ログアウト
        </button>
      </header>

      {/* サマリー */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <p className="text-sm font-medium text-gray-500 mb-1">総紹介件数（累計）</p>
          <p className="text-4xl font-bold text-blue-600">{totalReferrals}<span className="text-lg ml-1 text-gray-400 font-normal">件</span></p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <p className="text-sm font-medium text-gray-500 mb-1">登録スタッフ数</p>
          <p className="text-4xl font-bold text-gray-800">{staffs.length}<span className="text-lg ml-1 text-gray-400 font-normal">名</span></p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* 左：スタッフ実績 */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 border-b bg-gray-50 font-bold text-gray-700">スタッフ別実績</div>
            <table className="w-full text-sm text-left">
              <tbody className="divide-y">
                {staffs.sort((a, b) => b.count - a.count).map(s => (
                  <tr key={s.id} className="hover:bg-gray-50 transition">
                    <td className="p-4">
                      <p className="font-bold text-gray-700">{s.name}</p>
                      <p className="text-[10px] text-gray-400 font-mono tracking-tighter">({s.id})</p>
                    </td>
                    <td className="p-4 text-right">
                      <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full font-bold">{s.count} 件</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 右：紹介履歴 */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 border-b bg-gray-50 font-bold text-gray-700 flex justify-between">
              <span>最新の紹介履歴</span>
              <span className="text-xs font-normal text-gray-400">直近10件</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50/50 text-gray-400 text-[11px] uppercase tracking-wider">
                  <tr>
                    <th className="p-4 font-medium border-b">日時</th>
                    <th className="p-4 font-medium border-b">スタッフ</th>
                    <th className="p-4 font-medium border-b">受注番号</th>
                    <th className="p-4 font-medium border-b">状態</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-gray-600">
                  {history.map(item => (
                    <tr key={item.id} className="hover:bg-gray-50 transition">
                      <td className="p-4 text-xs">
                        {new Date(item.created_at).toLocaleString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="p-4 font-medium text-gray-800">{item.staffName}</td>
                      <td className="p-4 text-xs font-mono">{item.order_number}</td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded text-[10px] font-bold ${
                          item.status === 'pending' ? 'bg-gray-100 text-gray-500' : 
                          item.status === 'confirmed' ? 'bg-green-100 text-green-700' : 'bg-red-50 text-red-500'
                        }`}>
                          {item.status === 'pending' ? '仮計上' : item.status === 'confirmed' ? '確定' : 'キャンセル'}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {history.length === 0 && (
                    <tr><td colSpan={4} className="p-8 text-center text-gray-400">履歴がまだありません</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* オーナーメニュー */}
      <div className="mt-8 bg-indigo-900 p-6 rounded-xl shadow-lg text-white">
        <h2 className="font-bold mb-4 flex items-center">
          <span className="mr-2 text-xl">🛠️</span> オーナー専用ツール
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <button className="bg-white/10 hover:bg-white/20 p-3 rounded-lg transition text-left border border-white/10">QRコードダウンロード</button>
          <button className="bg-white/10 hover:bg-white/20 p-3 rounded-lg transition text-left border border-white/10">紹介用バナー素材</button>
          <button className="bg-white/10 hover:bg-white/20 p-3 rounded-lg transition text-left border border-white/10">報酬レポート (CSV)</button>
        </div>
      </div>
    </div>
  )
}