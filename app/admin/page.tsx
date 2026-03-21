'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function AdminDashboard() {
  const [referrals, setReferrals] = useState<any[]>([])
  const [shops, setShops] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bulkStatus, setBulkStatus] = useState('') // 一括操作用

  const fetchData = async () => {
    setLoading(true)
    const { data: refData } = await supabase.from('referrals').select('*').order('created_at', { ascending: false })
    const { data: shopData } = await supabase.from('shops').select('*')
    if (refData) setReferrals(refData)
    if (shopData) setShops(shopData)
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  const STATUS_OPTIONS = [
    { value: 'pending', label: '仮計上', color: '#92400e', bgColor: '#fef3c7' },
    { value: 'confirmed', label: '報酬確定', color: '#065f46', bgColor: '#d1fae5' },
    { value: 'issued', label: 'ギフト発行済', color: '#1e40af', bgColor: '#dbeafe' },
    { value: 'cancel', label: 'キャンセル', color: '#991b1b', bgColor: '#fee2e2' },
  ]

  // ポイント発行用の共通ロジック
  const issuePoints = async (referral: any) => {
    const rewardPoints = 5000 // スモールスタート用固定値
    const { error } = await supabase.from('point_transactions').insert([{
      shop_id: referral.shop_id,
      referral_id: referral.id,
      points: rewardPoints,
      reason: '商品A紹介報酬',
      status: 'confirmed',
      metadata: { order_number: referral.order_number }
    }])
    if (error) console.error('ポイント発行失敗:', error)
  }

  // 個別更新
  const updateStatus = async (id: string, newStatus: string) => {
    // 1. 対象データを取得
    const target = referrals.find(r => r.id === id)
    if (!target) return

    // 2. ステータス更新
    const { error } = await supabase.from('referrals').update({ status: newStatus }).eq('id', id)
    
    if (!error) {
      // 3. 報酬確定になった場合のみポイント発行
      if (newStatus === 'confirmed') {
        await issuePoints(target)
      }
      fetchData()
    } else {
      alert('更新に失敗しました')
    }
  }

  // 一括更新
  const handleBulkExecute = async () => {
    if (!bulkStatus) return alert('変更後のステータスを選択してください')
    if (selectedIds.length === 0) return alert('対象を選択してください')
    
    const label = STATUS_OPTIONS.find(s => s.value === bulkStatus)?.label
    if (!confirm(`${selectedIds.length}件を「${label}」に一括変更しますか？`)) return

    // ステータス一括更新
    const { error } = await supabase.from('referrals').update({ status: bulkStatus }).in('id', selectedIds)
    
    if (!error) {
      // 報酬確定への一括変更だった場合、各件に対してポイント発行処理を行う
      if (bulkStatus === 'confirmed') {
        const targetReferrals = referrals.filter(r => selectedIds.includes(r.id))
        // 並列でポイント発行（件数が多い場合は制限が必要ですが、まずはこれで）
        await Promise.all(targetReferrals.map(r => issuePoints(r)))
      }
      
      setSelectedIds([])
      setBulkStatus('')
      fetchData()
    } else {
      alert('一括更新に失敗しました')
    }
  }

  const toggleSelectAll = () => {
    setSelectedIds(selectedIds.length === referrals.length ? [] : referrals.map(r => r.id))
  }

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>集計中...</div>

  return (
    <main style={{ padding: '20px 40px', maxWidth: '1600px', margin: '0 auto', fontFamily: 'sans-serif', backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      <header style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>Duacel 成果管理システム</h1>
        </div>
        <button onClick={fetchData} style={{ padding: '8px 16px', backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer' }}>最新に更新</button>
      </header>

      {/* 一括操作パネル */}
      <div style={{ 
        backgroundColor: '#fff', padding: '15px 20px', borderRadius: '12px', border: '1px solid #e2e8f0', 
        marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '20px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
      }}>
        <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#64748b' }}>ラベル：一括操作</div>
        <select 
          value={bulkStatus} 
          onChange={(e) => setBulkStatus(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', backgroundColor: selectedIds.length > 0 ? '#fff' : '#f1f5f9' }}
          disabled={selectedIds.length === 0}
        >
          <option value="">変更なし</option>
          {STATUS_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
        <button 
          onClick={handleBulkExecute}
          disabled={selectedIds.length === 0 || !bulkStatus}
          style={{ 
            padding: '8px 24px', borderRadius: '6px', border: 'none', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer',
            backgroundColor: (selectedIds.length > 0 && bulkStatus) ? '#2563eb' : '#cbd5e1',
            color: '#fff', transition: '0.2s'
          }}
        >
          実行する ({selectedIds.length}件)
        </button>
        {selectedIds.length > 0 && (
          <button onClick={() => setSelectedIds([])} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '12px', cursor: 'pointer' }}>選択を解除</button>
        )}
      </div>

      {/* 詳細テーブル */}
      <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#64748b', fontSize: '12px' }}>
              <th style={{ padding: '15px 20px', width: '50px' }}>
                <input type="checkbox" checked={selectedIds.length === referrals.length && referrals.length > 0} onChange={toggleSelectAll} />
              </th>
              <th style={{ padding: '15px', width: '160px' }}>発生日時</th>
              <th style={{ padding: '15px', width: '200px' }}>店舗名</th>
              <th style={{ padding: '15px', width: '180px' }}>受注番号</th>
              <th style={{ padding: '15px', width: '150px' }}>紹介コード</th>
              <th style={{ padding: '15px', width: '180px' }}>ステータス（個別変更）</th>
            </tr>
          </thead>
          <tbody style={{ fontSize: '14px' }}>
            {referrals.map(ref => {
              const shop = shops.find(s => String(s.id) === String(ref.shop_id));
              const currentStatus = STATUS_OPTIONS.find(opt => opt.value === ref.status);
              
              return (
                <tr key={ref.id} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: selectedIds.includes(ref.id) ? '#f0f9ff' : 'transparent' }}>
                  <td style={{ padding: '15px 20px' }}>
                    <input 
                      type="checkbox" 
                      checked={selectedIds.includes(ref.id)} 
                      onChange={() => setSelectedIds(prev => prev.includes(ref.id) ? prev.filter(i => i !== ref.id) : [...prev, ref.id])} 
                    />
                  </td>
                  <td style={{ padding: '15px', color: '#94a3b8', fontSize: '12px' }}>
                    {new Date(ref.created_at).toLocaleString('ja-JP')}
                  </td>
                  <td style={{ padding: '15px', fontWeight: 'bold' }}>{shop?.name || <span style={{color: '#ccc'}}>未紐付け</span>}</td>
                  <td style={{ padding: '15px', fontFamily: 'monospace' }}>{ref.order_number}</td>
                  <td style={{ padding: '15px', color: '#6366f1', fontSize: '12px' }}>{ref.referral_code}</td>
                  <td style={{ padding: '15px' }}>
                    <select 
                      value={ref.status} 
                      onChange={(e) => updateStatus(ref.id, e.target.value)}
                      style={{ 
                        padding: '4px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer',
                        backgroundColor: currentStatus?.bgColor || '#f1f5f9',
                        color: currentStatus?.color || '#64748b',
                        border: `1px solid ${currentStatus?.color || '#cbd5e1'}`
                      }}
                    >
                      {STATUS_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </main>
  )
}