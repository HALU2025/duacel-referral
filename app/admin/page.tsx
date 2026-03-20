'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function AdminDashboard() {
  const [referrals, setReferrals] = useState<any[]>([])
  const [shops, setShops] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      // 1. 紹介実績と店舗情報を取得
      const { data: refData } = await supabase
        .from('referrals')
        .select('*')
        .order('created_at', { ascending: false })
      
      const { data: shopData } = await supabase
        .from('shops')
        .select('*')

      if (refData) setReferrals(refData)
      if (shopData) setShops(shopData)
      setLoading(false)
    }
    fetchData()
  }, [])

  // 店舗ごとの件数を集計するロジック
  const getShopCount = (id: string) => {
  // referrals の中にある shop_id が、表示しようとしている店舗IDと一致するか確認
  return referrals.filter(r => String(r.shop_id) === String(id)).length
}

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>データを集計中...</div>

  return (
    <main style={{ padding: '40px', maxWidth: '1000px', margin: '0 auto', fontFamily: 'sans-serif', backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      <header style={{ marginBottom: '30px' }}>
        <h1 style={{ color: '#1e293b', fontSize: '28px' }}>Duacel 経営ダッシュボード</h1>
        <p style={{ color: '#64748b' }}>リファラルプログラムの稼働状況をリアルタイムで監視します。</p>
      </header>

      {/* --- 全体サマリー --- */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '40px' }}>
        <div style={{ padding: '20px', backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>総紹介件数</p>
          <p style={{ fontSize: '32px', fontWeight: 'bold', color: '#2563eb', margin: '5px 0' }}>{referrals.length} <span style={{ fontSize: '16px' }}>件</span></p>
        </div>
        <div style={{ padding: '20px', backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>提携サロン数</p>
          <p style={{ fontSize: '32px', fontWeight: 'bold', color: '#1e293b', margin: '5px 0' }}>{shops.length} <span style={{ fontSize: '16px' }}>店</span></p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
        {/* --- 左側：店舗別パフォーマンス --- */}
        <section style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h2 style={{ fontSize: '18px', marginBottom: '20px', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>店舗別実績</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', color: '#64748b', fontSize: '13px' }}>
                <th style={{ padding: '10px' }}>店舗名</th>
                <th style={{ padding: '10px', textAlign: 'right' }}>紹介数</th>
              </tr>
            </thead>
            <tbody>
              {shops.map(shop => (
                <tr key={shop.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '12px', fontSize: '14px' }}>{shop.name} <br/><small style={{ color: '#94a3b8' }}>{shop.id}</small></td>
                  <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold' }}>{getShopCount(shop.id)} 件</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* --- 右側：最新の紹介ログ --- */}
        <section style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h2 style={{ fontSize: '18px', marginBottom: '20px', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>最新の成果ログ</h2>
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {/* 右側：最新の成果ログの表示部分を以下に差し替え */}
{referrals.map(ref => (
  <div key={ref.id} style={{ padding: '12px', borderBottom: '1px solid #f8fafc', fontSize: '13px' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
      <span style={{ fontWeight: 'bold', color: '#2563eb' }}>
        {/* 紹介コードを表示 */}
        {ref.referral_code || '不明なコード'}
      </span>
      <span style={{ color: '#94a3b8' }}>
        {new Date(ref.created_at).toLocaleString('ja-JP')}
      </span>
    </div>
    <div style={{ color: '#64748b' }}>
      店舗ID: {ref.shop_id || '未紐付け'} / 注文ID: {ref.order_id || 'テスト注文'}
    </div>
  </div>
))}
          </div>
        </section>
      </div>
    </main>
  )
}