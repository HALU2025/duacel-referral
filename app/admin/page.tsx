'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function AdminDashboard() {
  const [referrals, setReferrals] = useState<any[]>([])
  const [shops, setShops] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all') // フィルタ状態

  const fetchData = async () => {
    setLoading(true)
    const { data: refData } = await supabase
      .from('referrals')
      .select('*')
      .order('created_at', { ascending: false })
    
    const { data: shopData } = await supabase.from('shops').select('*')

    if (refData) setReferrals(refData)
    if (shopData) setShops(shopData)
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [])

  // ステータスを更新する関数
  const updateStatus = async (id: string, newStatus: string) => {
    const { error } = await supabase
      .from('referrals')
      .update({ status: newStatus })
      .eq('id', id)
    
    if (error) {
      alert('更新に失敗しました')
    } else {
      fetchData() // データを再取得して画面を更新
    }
  }

  const getShopCount = (id: string) => {
    return referrals.filter(r => String(r.shop_id) === String(id)).length
  }

  // フィルタリングされた紹介データ
  const filteredReferrals = referrals.filter(r => {
    if (filter === 'all') return true
    return r.status === filter
  })

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>データを集計中...</div>

  return (
    <main style={{ padding: '40px', maxWidth: '1200px', margin: '0 auto', fontFamily: 'sans-serif', backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      <header style={{ marginBottom: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ color: '#1e293b', fontSize: '28px', margin: 0 }}>Duacel システム管理</h1>
          <p style={{ color: '#64748b', margin: '5px 0 0' }}>リファラル承認およびギフト発行管理</p>
        </div>
        <button onClick={fetchData} style={{ padding: '8px 16px', backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: 'pointer' }}>最新に更新</button>
      </header>

      {/* サマリー */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '40px' }}>
        <div style={{ padding: '20px', backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>総紹介</p>
          <p style={{ fontSize: '24px', fontWeight: 'bold', margin: '5px 0' }}>{referrals.length}</p>
        </div>
        <div style={{ padding: '20px', backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderLeft: '4px solid #f59e0b' }}>
          <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>承認待ち(Pending)</p>
          <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#f59e0b', margin: '5px 0' }}>{referrals.filter(r => r.status === 'pending').length}</p>
        </div>
        <div style={{ padding: '20px', backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderLeft: '4px solid #10b981' }}>
          <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>確定済み(Confirmed)</p>
          <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#10b981', margin: '5px 0' }}>{referrals.filter(r => r.status === 'confirmed').length}</p>
        </div>
        <div style={{ padding: '20px', backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>提携サロン</p>
          <p style={{ fontSize: '24px', fontWeight: 'bold', margin: '5px 0' }}>{shops.length}</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '30px' }}>
        {/* 左：店舗リスト */}
        <section style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h2 style={{ fontSize: '16px', marginBottom: '15px' }}>店舗別実績</h2>
          {shops.map(shop => (
            <div key={shop.id} style={{ padding: '10px 0', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
              <span>{shop.name}</span>
              <span style={{ fontWeight: 'bold' }}>{getShopCount(shop.id)}</span>
            </div>
          ))}
        </section>

        {/* 右：紹介ログと承認操作 */}
        <section style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '16px', margin: 0 }}>成果承認ログ</h2>
            <select 
              value={filter} 
              onChange={(e) => setFilter(e.target.value)}
              style={{ padding: '5px', borderRadius: '4px', border: '1px solid #e2e8f0' }}
            >
              <option value="all">すべて表示</option>
              <option value="pending">仮計上のみ</option>
              <option value="confirmed">確定のみ</option>
            </select>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ textAlign: 'left', color: '#64748b', borderBottom: '2px solid #f1f5f9' }}>
                <th style={{ padding: '12px' }}>日時</th>
                <th style={{ padding: '12px' }}>店舗 / 受注番号</th>
                <th style={{ padding: '12px' }}>ステータス</th>
                <th style={{ padding: '12px', textAlign: 'right' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredReferrals.map(ref => (
                <tr key={ref.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '12px', color: '#94a3b8' }}>
                    {new Date(ref.created_at).toLocaleString('ja-JP')}
                  </td>
                  <td style={{ padding: '12px' }}>
                    <div style={{ fontWeight: 'bold' }}>{ref.shop_id}</div>
                    <div style={{ color: '#64748b', fontSize: '11px' }}>{ref.order_number}</div>
                  </td>
                  <td style={{ padding: '12px' }}>
                    <span style={{ 
                      padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 'bold',
                      backgroundColor: ref.status === 'pending' ? '#fef3c7' : '#d1fae5',
                      color: ref.status === 'pending' ? '#92400e' : '#065f46'
                    }}>
                      {ref.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px', textAlign: 'right' }}>
                    {ref.status === 'pending' && (
                      <button 
                        onClick={() => updateStatus(ref.id, 'confirmed')}
                        style={{ padding: '4px 12px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}
                      >
                        承認(2回目受取済)
                      </button>
                    )}
                    {ref.status === 'confirmed' && (
                      <button 
                        onClick={() => updateStatus(ref.id, 'issued')}
                        style={{ padding: '4px 12px', backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}
                      >
                        ギフト発行完了
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  )
}