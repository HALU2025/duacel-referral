'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function OwnerDashboard() {
  const [shop, setShop] = useState<any>(null)
  const [staffs, setStaffs] = useState<any[]>([])
  const [totalReferrals, setTotalReferrals] = useState(0)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const fetchOwnerData = async () => {
      // 1. 現在ログインしているユーザーを取得
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      // 2. shopsテーブルから、このユーザーがオーナーである店舗を検索
      const { data: shopData, error: shopError } = await supabase
        .from('shops')
        .select('*')
        .eq('owner_id', user.id)
        .single()

      if (shopError || !shopData) {
        console.error('店舗情報の取得に失敗しました', shopError)
        setLoading(false)
        return
      }
      setShop(shopData)

      // 3. 店舗全体の総紹介数を取得
      const { count } = await supabase
        .from('referral_logs')
        .select('*', { count: 'exact', head: true })
        .eq('shop_id', shopData.id)
      
      setTotalReferrals(count || 0)

      // 4. 所属スタッフ一覧と、それぞれの紹介数を取得
      // staffsテーブルにreferral_logsを結合してカウントを取得する（簡易版）
      const { data: staffData } = await supabase
        .from('staffs')
        .select(`
          id,
          name,
          referral_logs(count)
        `)
        .eq('shop_id', shopData.id)

      if (staffData) {
        // countデータを扱いやすい形に整形
        const formattedStaffs = staffData.map((s: any) => ({
          id: s.id,
          name: s.name,
          count: s.referral_logs[0]?.count || 0
        }))
        setStaffs(formattedStaffs)
      }

      setLoading(false)
    }

    fetchOwnerData()
  }, [router])

  if (loading) return <div className="p-8">読み込み中...</div>
  if (!shop) return <div className="p-8">店舗情報が見つかりません。</div>

  return (
    <div className="p-8 max-w-4xl mx-auto bg-gray-50 min-h-screen">
      <header className="flex justify-between items-center border-b pb-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{shop.name} 経営ダッシュボード</h1>
          <p className="text-sm text-gray-500">店舗ID: {shop.id}</p>
        </div>
        <button 
          onClick={() => supabase.auth.signOut().then(() => router.push('/login'))}
          className="text-sm px-4 py-2 bg-white border rounded shadow-sm hover:bg-gray-50 transition"
        >
          ログアウト
        </button>
      </header>

      {/* サマリーカード */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <p className="text-sm font-medium text-gray-500 mb-1">総紹介件数（累計）</p>
          <p className="text-4xl font-bold text-blue-600">{totalReferrals}<span className="text-lg ml-1 text-gray-400">件</span></p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <p className="text-sm font-medium text-gray-500 mb-1">登録スタッフ数</p>
          <p className="text-4xl font-bold text-gray-800">{staffs.length}<span className="text-lg ml-1 text-gray-400">名</span></p>
        </div>
      </div>

      {/* スタッフ別実績テーブル */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-8">
        <div className="p-4 border-b bg-gray-50">
          <h2 className="font-bold text-gray-700">スタッフ別実績</h2>
        </div>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-gray-400 border-b">
              <th className="p-4 font-medium">氏名</th>
              <th className="p-4 font-medium text-right">紹介数</th>
            </tr>
          </thead>
          <tbody>
            {staffs.length > 0 ? (
              staffs.sort((a, b) => b.count - a.count).map(s => (
                <tr key={s.id} className="border-b last:border-0 hover:bg-gray-50 transition">
                  <td className="p-4 font-medium text-gray-700">{s.name}</td>
                  <td className="p-4 text-right">
                    <span className="inline-block bg-blue-50 text-blue-700 px-3 py-1 rounded-full font-bold">
                      {s.count} 件
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={2} className="p-8 text-center text-gray-400">スタッフが登録されていません</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* オーナーメニュー */}
      <div className="bg-indigo-900 p-6 rounded-xl shadow-lg text-white">
        <h2 className="font-bold mb-4 flex items-center">
          <span className="mr-2">🛠️</span> オーナー専用ツール
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <button className="bg-white/10 hover:bg-white/20 p-3 rounded-lg transition text-left border border-white/10">
            QRコードダウンロード
          </button>
          <button className="bg-white/10 hover:bg-white/20 p-3 rounded-lg transition text-left border border-white/10">
            紹介用バナー素材
          </button>
          <button className="bg-white/10 hover:bg-white/20 p-3 rounded-lg transition text-left border border-white/10">
            報酬レポート (CSV)
          </button>
        </div>
      </div>
    </div>
  )
}