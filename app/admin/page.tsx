'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function AdminDashboard() {
  const [referrals, setReferrals] = useState<any[]>([])
  const [shops, setShops] = useState<any[]>([])
  const [ranks, setRanks] = useState<any[]>([]) // ランクマスタ用
  const [loading, setLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bulkStatus, setBulkStatus] = useState('')

  const fetchData = async () => {
    setLoading(true)
    const { data: refData } = await supabase.from('referrals').select('*').order('created_at', { ascending: false })
    const { data: shopData } = await supabase.from('shops').select('*').order('id', { ascending: true })
    const { data: rankData } = await supabase.from('shop_ranks').select('*')

    if (refData) setReferrals(refData)
    if (shopData) setShops(shopData)
    if (rankData) setRanks(rankData)
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  const STATUS_OPTIONS = [
    { value: 'pending', label: '仮計上', color: '#92400e', bgColor: '#fef3c7' },
    { value: 'confirmed', label: '報酬確定', color: '#065f46', bgColor: '#d1fae5' },
    { value: 'issued', label: 'ギフト発行済', color: '#1e40af', bgColor: '#dbeafe' },
    { value: 'cancel', label: 'キャンセル', color: '#991b1b', bgColor: '#fee2e2' },
  ]

  // 店舗のランクを更新する
  const updateShopRank = async (shopId: string, newRankId: string) => {
    const { error } = await supabase.from('shops').update({ rank_id: newRankId }).eq('id', shopId)
    if (!error) fetchData()
    else alert('ランク更新に失敗しました')
  }

  // 【重要】ポイント発行ロジック：ランク連動型
  const issuePoints = async (referral: any) => {
    // 1. 店舗の現在のランク報酬額を取得
    const shop = shops.find(s => String(s.id) === String(referral.shop_id))
    const rank = ranks.find(r => r.id === shop?.rank_id)
    
    // ランクが見つからない場合はデフォルト（マスタのstandard）か、安全策として5000
    const rewardPoints = rank?.reward_points || 5000 

    const { error } = await supabase.from('point_transactions').insert([{
      shop_id: referral.shop_id,
      referral_id: referral.id,
      points: rewardPoints,
      reason: `${rank?.label || '通常'}報酬`,
      status: 'confirmed',
      metadata: { order_number: referral.order_number, rank_at_time: rank?.id }
    }])
    if (error) console.error('ポイント発行失敗:', error)
  }

  const updateStatus = async (id: string, newStatus: string) => {
    const target = referrals.find(r => r.id === id)
    if (!target) return
    const { error } = await supabase.from('referrals').update({ status: newStatus }).eq('id', id)
    if (!error) {
      if (newStatus === 'confirmed') await issuePoints(target)
      fetchData()
    }
  }

  const handleBulkExecute = async () => {
    if (!bulkStatus || selectedIds.length === 0) return
    if (!confirm(`${selectedIds.length}件を一括変更しますか？`)) return

    const { error } = await supabase.from('referrals').update({ status: bulkStatus }).in('id', selectedIds)
    if (!error) {
      if (bulkStatus === 'confirmed') {
        const targetReferrals = referrals.filter(r => selectedIds.includes(r.id))
        await Promise.all(targetReferrals.map(r => issuePoints(r)))
      }
      setSelectedIds([])
      setBulkStatus('')
      fetchData()
    }
  }

  const toggleSelectAll = () => {
    setSelectedIds(selectedIds.length === referrals.length ? [] : referrals.map(r => r.id))
  }

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>読み込み中...</div>

  return (
    <main style={{ padding: '20px 40px', maxWidth: '1600px', margin: '0 auto', fontFamily: 'sans-serif', backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      <header style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>Duacel 成果管理システム</h1>
        <button onClick={fetchData} style={{ padding: '8px 16px', backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer' }}>最新に更新</button>
      </header>

      {/* --- 店舗別ランク・累計実績管理 --- */}
      <section style={{ marginBottom: '40px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '10px', color: '#475569' }}>店舗別ランク・実績管理</h2>
        <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#64748b', fontSize: '12px' }}>
                <th style={{ padding: '12px 15px', width: '80px' }}>店舗ID</th>
                <th style={{ padding: '12px 15px' }}>店舗名</th>
                <th style={{ padding: '12px 15px', width: '220px' }}>報酬ランク</th>
                <th style={{ padding: '12px 15px', width: '120px' }}>累計紹介</th>
                <th style={{ padding: '12px 15px', width: '120px' }}>確定済み</th>
              </tr>
            </thead>
            <tbody style={{ fontSize: '13px' }}>
              {shops.map(shop => {
                const shopRefs = referrals.filter(r => String(r.shop_id) === String(shop.id));
                return (
                  <tr key={shop.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 15px', fontFamily: 'monospace', color: '#94a3b8' }}>{shop.id}</td>
                    <td style={{ padding: '12px 15px', fontWeight: 'bold' }}>{shop.name}</td>
                    <td style={{ padding: '12px 15px' }}>
                      <select 
                        value={shop.rank_id || 'standard'} 
                        onChange={(e) => updateShopRank(shop.id, e.target.value)}
                        style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                      >
                        {ranks.map(rank => (
                          <option key={rank.id} value={rank.id}>{rank.label} ({rank.reward_points}pt)</option>
                        ))}
                      </select>
                    </td>
                    <td style={{ padding: '12px 15px' }}>{shopRefs.length} 件</td>
                    <td style={{ padding: '12px 15px', color: '#059669', fontWeight: 'bold' }}>
                      {shopRefs.filter(r => r.status === 'confirmed' || r.status === 'issued').length} 件
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* --- 一括操作パネル --- */}
      <div style={{ backgroundColor: '#fff', padding: '15px 20px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '20px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
        <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#64748b' }}>ラベル：一括操作</div>
        <select value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)} style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }} disabled={selectedIds.length === 0}>
          <option value="">変更なし</option>
          {STATUS_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
        <button onClick={handleBulkExecute} disabled={selectedIds.length === 0 || !bulkStatus} style={{ padding: '8px 24px', borderRadius: '6px', border: 'none', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer', backgroundColor: (selectedIds.length > 0 && bulkStatus) ? '#2563eb' : '#cbd5e1', color: '#fff' }}>
          実行する ({selectedIds.length}件)
        </button>
      </div>

      {/* --- 詳細テーブル --- */}
      <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#64748b', fontSize: '12px' }}>
              <th style={{ padding: '15px 20px', width: '50px' }}><input type="checkbox" checked={selectedIds.length === referrals.length && referrals.length > 0} onChange={toggleSelectAll} /></th>
              <th style={{ padding: '15px', width: '160px' }}>発生日時</th>
              <th style={{ padding: '15px', width: '200px' }}>店舗名</th>
              <th style={{ padding: '15px', width: '180px' }}>受注番号</th>
              <th style={{ padding: '15px', width: '150px' }}>紹介コード</th>
              <th style={{ padding: '15px', width: '180px' }}>ステータス（個別）</th>
            </tr>
          </thead>
          <tbody style={{ fontSize: '14px' }}>
            {referrals.map(ref => {
              const shop = shops.find(s => String(s.id) === String(ref.shop_id));
              const currentStatus = STATUS_OPTIONS.find(opt => opt.value === ref.status);
              return (
                <tr key={ref.id} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: selectedIds.includes(ref.id) ? '#f0f9ff' : 'transparent' }}>
                  <td style={{ padding: '15px 20px' }}><input type="checkbox" checked={selectedIds.includes(ref.id)} onChange={() => setSelectedIds(prev => prev.includes(ref.id) ? prev.filter(i => i !== ref.id) : [...prev, ref.id])} /></td>
                  <td style={{ padding: '15px', color: '#94a3b8', fontSize: '12px' }}>{new Date(ref.created_at).toLocaleString('ja-JP')}</td>
                  <td style={{ padding: '15px', fontWeight: 'bold' }}>{shop?.name || <span style={{color: '#ccc'}}>未紐付け</span>}</td>
                  <td style={{ padding: '15px', fontFamily: 'monospace' }}>{ref.order_number}</td>
                  <td style={{ padding: '15px', color: '#6366f1', fontSize: '12px' }}>{ref.referral_code}</td>
                  <td style={{ padding: '15px' }}>
                    <select value={ref.status} onChange={(e) => updateStatus(ref.id, e.target.value)} style={{ padding: '4px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', backgroundColor: currentStatus?.bgColor, color: currentStatus?.color, border: `1px solid ${currentStatus?.color}` }}>
                      {STATUS_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
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