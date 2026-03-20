'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function AdminDashboard() {
  const [referrals, setReferrals] = useState<any[]>([])
  const [shops, setShops] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState<string[]>([]) // チェックボックス管理

  const fetchData = async () => {
    setLoading(true)
    // 紹介実績の取得
    const { data: refData } = await supabase
      .from('referrals')
      .select('*')
      .order('created_at', { ascending: false })
    
    // 店舗情報の取得
    const { data: shopData } = await supabase.from('shops').select('*')

    if (refData) setReferrals(refData)
    if (shopData) setShops(shopData)
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [])

  // ステータス表示設定
  const STATUS_CONFIG: { [key: string]: { label: string; color: string; bgColor: string } } = {
    pending: { label: '仮計上', color: '#92400e', bgColor: '#fef3c7' },
    confirmed: { label: '報酬確定', color: '#065f46', bgColor: '#d1fae5' },
    issued: { label: 'ギフト発行済', color: '#1e40af', bgColor: '#dbeafe' },
    cancel: { label: 'キャンセル', color: '#991b1b', bgColor: '#fee2e2' },
  }

  // 単一更新
  const updateStatus = async (id: string, newStatus: string) => {
    const { error } = await supabase.from('referrals').update({ status: newStatus }).eq('id', id)
    if (error) alert('更新に失敗しました')
    else fetchData()
  }

  // 一括更新
  const handleBulkUpdate = async (newStatus: string) => {
    if (selectedIds.length === 0) return
    const { error } = await supabase.from('referrals').update({ status: newStatus }).in('id', selectedIds)
    if (error) {
      alert('一括更新に失敗しました')
    } else {
      setSelectedIds([])
      fetchData()
    }
  }

  // チェックボックス操作
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
  }

  const toggleSelectAll = () => {
    if (selectedIds.length === referrals.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(referrals.map(r => r.id))
    }
  }

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>データを集計中...</div>

  return (
    <main style={{ padding: '40px', maxWidth: '1400px', margin: '0 auto', fontFamily: 'sans-serif', backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      <header style={{ marginBottom: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 style={{ color: '#1e293b', fontSize: '28px', margin: 0 }}>Duacel 管理者ダッシュボード</h1>
          <p style={{ color: '#64748b', margin: '5px 0 0' }}>成果の承認・一括ステータス管理</p>
        </div>
        <button onClick={fetchData} style={{ padding: '10px 20px', backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>最新に更新</button>
      </header>

      {/* --- 一括操作バー (選択中のみ表示) --- */}
      <div style={{ 
        position: 'sticky', top: '20px', zIndex: 10, marginBottom: '20px', padding: '15px 25px', 
        backgroundColor: '#1e293b', borderRadius: '12px', display: selectedIds.length > 0 ? 'flex' : 'none', 
        justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', color: '#fff'
      }}>
        <div><span style={{ fontWeight: 'bold', fontSize: '18px', color: '#38bdf8' }}>{selectedIds.length}</span> 件を選択中</div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => handleBulkUpdate('confirmed')} style={{ padding: '8px 16px', backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>一括で報酬確定</button>
          <button onClick={() => handleBulkUpdate('issued')} style={{ padding: '8px 16px', backgroundColor: '#3b82f6', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>一括でギフト発行済</button>
          <button onClick={() => handleBulkUpdate('cancel')} style={{ padding: '8px 16px', backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>一括キャンセル</button>
        </div>
      </div>

      {/* --- メインテーブル --- */}
      <section style={{ backgroundColor: '#fff', padding: '0', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
          <thead>
            <tr style={{ textAlign: 'left', backgroundColor: '#f1f5f9', color: '#64748b' }}>
              <th style={{ padding: '15px 20px', width: '40px' }}>
                <input type="checkbox" checked={selectedIds.length === referrals.length && referrals.length > 0} onChange={toggleSelectAll} style={{ cursor: 'pointer' }} />
              </th>
              <th style={{ padding: '15px' }}>発生日時</th>
              <th style={{ padding: '15px' }}>店舗名 / ID</th>
              <th style={{ padding: '15px' }}>受注番号 / コード</th>
              <th style={{ padding: '15px' }}>現在のステータス</th>
              <th style={{ padding: '15px', textAlign: 'right' }}>個別操作</th>
            </tr>
          </thead>
          <tbody>
            {referrals.map(ref => {
              const shop = shops.find(s => String(s.id) === String(ref.shop_id));
              const status = STATUS_CONFIG[ref.status] || { label: ref.status, color: '#64748b', bgColor: '#f1f5f9' };
              const isSelected = selectedIds.includes(ref.id);

              return (
                <tr key={ref.id} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: isSelected ? '#f0f9ff' : 'transparent' }}>
                  <td style={{ padding: '15px 20px' }}>
                    <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(ref.id)} style={{ cursor: 'pointer' }} />
                  </td>
                  <td style={{ padding: '15px', color: '#94a3b8', fontSize: '12px' }}>
                    {new Date(ref.created_at).toLocaleString('ja-JP')}
                  </td>
                  <td style={{ padding: '15px' }}>
                    <div style={{ fontWeight: 'bold', color: '#1e293b' }}>{shop?.name || '不明な店舗'}</div>
                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>ID: {ref.shop_id}</div>
                  </td>
                  <td style={{ padding: '15px' }}>
                    <div style={{ fontWeight: 'bold', color: '#475569' }}>{ref.order_number}</div>
                    <div style={{ fontSize: '11px', color: '#6366f1' }}>Code: {ref.referral_code}</div>
                  </td>
                  <td style={{ padding: '15px' }}>
                    <span style={{ 
                      padding: '4px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold', border: `1px solid ${status.color}`,
                      backgroundColor: status.bgColor, color: status.color
                    }}>
                      {status.label}
                    </span>
                  </td>
                  <td style={{ padding: '15px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '5px', justifyContent: 'flex-end' }}>
                      {ref.status === 'pending' && (
                        <button onClick={() => updateStatus(ref.id, 'confirmed')} style={{ padding: '4px 8px', fontSize: '11px', backgroundColor: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd', borderRadius: '4px', cursor: 'pointer' }}>確定</button>
                      )}
                      {(ref.status === 'confirmed' || ref.status === 'pending') && (
                        <button onClick={() => updateStatus(ref.id, 'issued')} style={{ padding: '4px 8px', fontSize: '11px', backgroundColor: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0', borderRadius: '4px', cursor: 'pointer' }}>発行完了</button>
                      )}
                      {ref.status !== 'cancel' && (
                        <button onClick={() => updateStatus(ref.id, 'cancel')} style={{ padding: '4px 8px', fontSize: '11px', backgroundColor: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: '4px', cursor: 'pointer' }}>却下</button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {referrals.length === 0 && (
          <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>紹介実績がまだありません。</div>
        )}
      </section>
    </main>
  )
}