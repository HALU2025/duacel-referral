'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function OwnerDashboard() {
  const [shop, setShop] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const fetchOwnerData = async () => {
      // 1. 現在ログインしているユーザーを取得
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        // ログインしてなければログイン画面へ強制送還
        router.push('/login')
        return
      }

      // 2. shopsテーブルから、このユーザーがオーナーである店舗を検索
      const { data: shopData, error } = await supabase
        .from('shops')
        .select('*')
        .eq('owner_id', user.id)
        .single() // 1店舗のみ取得

      if (error || !shopData) {
        console.error('店舗情報の取得に失敗しました', error)
      } else {
        setShop(shopData)
      }
      setLoading(false)
    }

    fetchOwnerData()
  }, [router])

  if (loading) return <div className="p-8">読み込み中...</div>

  if (!shop) return <div className="p-8">店舗情報が見つかりません。管理者にお問い合わせください。</div>

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <header className="flex justify-between items-center border-b pb-4 mb-8">
        <h1 className="text-2xl font-bold">{shop.name} 経営ダッシュボード</h1>
        <button 
          onClick={() => supabase.auth.signOut().then(() => router.push('/login'))}
          className="text-sm text-gray-500 hover:underline"
        >
          ログアウト
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow border">
          <p className="text-sm text-gray-500">店舗ID</p>
          <p className="text-xl font-mono">{shop.id}</p>
        </div>
        {/* ここに紹介数などを追加していく */}
      </div>

      <div className="bg-blue-50 p-6 rounded-lg border border-blue-100">
        <h2 className="font-bold mb-2">オーナー専用メニュー</h2>
        <ul className="list-disc list-inside text-blue-800 space-y-1">
          <li>スタッフ別紹介実績の確認</li>
          <li>店舗用QRコードのダウンロード</li>
          <li>報酬振り込み情報の確認</li>
        </ul>
      </div>
    </div>
  )
}