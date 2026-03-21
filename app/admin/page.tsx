'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

// ==========================================
// 1. 定数・型定義 (Constants & Types)
// ==========================================
const STATUS_OPTIONS = [
  { value: 'pending', label: '仮計上', color: '#92400e', bgColor: '#fef3c7' },
  { value: 'confirmed', label: '報酬確定', color: '#065f46', bgColor: '#d1fae5' },
  { value: 'issued', label: 'ギフト発行済', color: '#1e40af', bgColor: '#dbeafe' },
  { value: 'cancel', label: 'キャンセル', color: '#991b1b', bgColor: '#fee2e2' },
]

export default function AdminDashboard() {
  // ==========================================
  // 2. ステート管理 (State Management)
  // ==========================================
  const [activeTab, setActiveTab] = useState<'referrals' | 'payments' | 'settings'>('referrals')
  const [referrals, setReferrals] = useState<any[]>([])
  const [shops, setShops] = useState<any[]>([])
  const [ranks, setRanks] = useState<any[]>([])
  const [pointTransactions, setPointTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  // チェックボックスの状態管理
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isAllSelected, setIsAllSelected] = useState(false)

  // モーダル・編集用ステート
  const [isRefModalOpen, setIsRefModalOpen] = useState(false)
  const [editingRef, setEditingRef] = useState<any>(null)
  const [isShopModalOpen, setIsShopModalOpen] = useState(false)
  const [editingShop, setEditingShop] = useState<any>(null)
  const [bulkValue, setBulkValue] = useState('')

  // マスタ設定の編集用ステート
  const [editingRanks, setEditingRanks] = useState<any[]>([])

  // ==========================================
  // 3. データ取得ロジック (Data Fetching)
  // ==========================================
  const fetchData = async () => {
    const [r, s, rk, tx] = await Promise.all([
      supabase.from('referrals').select('*').order('created_at', { ascending: false }),
      supabase.from('shops').select('*'),
      supabase.from('shop_ranks').select('*').order('reward_points', { ascending: true }),
      supabase.from('point_transactions').select('*')
    ])
    
    if (r.data) setReferrals(r.data)
    if (s.data) setShops(s.data)
    if (tx.data) setPointTransactions(tx.data)
    if (rk.data) {
      setRanks(rk.data)
      setEditingRanks(rk.data) // 編集用のステートにも初期値をセット
    }
  }

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      await fetchData()
      setLoading(false)
    }
    init()
  }, [])

  // ==========================================
  // 4. ポイント・報酬連動ロジック (Business Logic)
  // ==========================================
  
  /** ポイント発行：ステータスが「報酬確定」になった際に実行 */
  const issuePoints = async (referral: any, currentShops: any[], currentRanks: any[]) => {
    const shop = currentShops.find(s => String(s.id) === String(referral.shop_id))
    const rank = currentRanks.find(r => String(r.id) === String(shop?.rank_id))
    
    // ランク設定がない場合の基本ポイント（これがないと0円扱いで表示が消えます）
    const rewardPoints = rank?.reward_points || 5000

    const { data: existing } = await supabase.from('point_transactions').select('id').eq('referral_id', referral.id).maybeSingle()
    if (existing) return

    await supabase.from('point_transactions').insert([{
      shop_id: referral.shop_id,
      referral_id: referral.id,
      points: rewardPoints,
      reason: `${rank?.label || '通常'}報酬`,
      status: 'confirmed',
      metadata: { order_number: referral.order_number }
    }])
  }

  /** ポイント削除：「報酬確定」から別のステータスに戻した際に実行 */
  const removePoints = async (referralId: string) => {
    await supabase.from('point_transactions')
      .delete()
      .eq('referral_id', referralId)
      .eq('status', 'confirmed') // paid(支払済)のものは消さない安全策
  }

  // ==========================================
  // 5. アクションハンドラー (Event Handlers)
  // ==========================================

  /** 全選択チェックボックスの切り替え */
  const handleToggleAll = () => {
    if (isAllSelected) {
      setSelectedIds([])
      setIsAllSelected(false)
    } else {
      setSelectedIds(referrals.map(r => r.id))
      setIsAllSelected(true)
    }
  }

  /** 個別チェックボックスの切り替え */
  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
      setIsAllSelected(next.length === referrals.length && referrals.length > 0)
      return next
    })
  }

  /** 一括ステータス更新 */
  const handleBulkExecute = async () => {
    if (!bulkValue || selectedIds.length === 0) return
    if (!confirm(`${selectedIds.length}件を一括更新しますか？`)) return

    const { error } = await supabase.from('referrals').update({ status: bulkValue }).in('id', selectedIds)
    if (error) {
      alert('エラーが発生しました')
      return
    }
    
    const targets = referrals.filter(r => selectedIds.includes(r.id))
    
    for (const target of targets) {
      if (bulkValue === 'confirmed') {
        await issuePoints(target, shops, ranks)
      } else {
        await removePoints(target.id)
      }
    }
    
    // 実行後もチェック状態（selectedIds）は維持する
    await fetchData()
    setBulkValue('')
  }

  /** 個別成果保存（モーダル） */
  const handleRefModalSave = async (updatedRef: any) => {
    const originalRef = referrals.find(r => r.id === updatedRef.id)
    await supabase.from('referrals').update({ status: updatedRef.status }).eq('id', updatedRef.id)
    
    if (updatedRef.status === 'confirmed' && originalRef?.status !== 'confirmed') {
      await issuePoints(updatedRef, shops, ranks)
    } else if (updatedRef.status !== 'confirmed' && originalRef?.status === 'confirmed') {
      await removePoints(updatedRef.id)
    }
    
    setIsRefModalOpen(false)
    await fetchData()
  }

  /** 支払い完了処理 */
  const handlePaymentComplete = async (shopId: string) => {
    if (!confirm('支払いを完了にしますか？')) return
    await supabase.from('point_transactions').update({ status: 'paid' }).eq('shop_id', shopId).eq('status', 'confirmed')
    await fetchData()
  }

  /** 店舗情報編集保存 */
  const handleShopSave = async (shop: any) => {
    await supabase.from('shops').update({ email: shop.email, rank_id: shop.rank_id }).eq('id', shop.id)
    setIsShopModalOpen(false)
    await fetchData()
  }

  /** ランク設定の入力ハンドラー */
  const handleRankChange = (id: string, field: string, value: string | number) => {
    setEditingRanks(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r))
  }

  /** ランク設定の一括保存 */
  const handleSaveAllRanks = async () => {
    if (!confirm('マスタ設定を変更しますか？')) return
    setLoading(true)
    for (const rank of editingRanks) {
      await supabase.from('shop_ranks').update({ 
        label: rank.label, 
        reward_points: rank.reward_points 
      }).eq('id', rank.id)
    }
    await fetchData()
    setLoading(false)
    alert('マスタ設定を保存しました！')
  }

  // ==========================================
  // 6. UIレンダリング (View)
  // ==========================================
  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>読み込み中...</div>

  return (
    <main style={{ padding: '20px', width: '100%', boxSizing: 'border-box', backgroundColor: '#f8fafc', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      
      {/* 6-1. ヘッダー / タブ切り替え */}
      <header style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 'bold' }}>管理システム</h1>
        <div style={{ display: 'flex', gap: '10px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
          {['referrals', 'payments', 'settings'].map((t) => (
            <button key={t} onClick={() => setActiveTab(t as any)} style={{ padding: '10px 20px', borderRadius: '6px', border: 'none', backgroundColor: activeTab === t ? '#1e293b' : 'transparent', color: activeTab === t ? '#fff' : '#64748b', cursor: 'pointer', fontWeight: 'bold', transition: '0.2s' }}>
              {t === 'referrals' ? '成果承認' : t === 'payments' ? '支払い管理' : 'マスタ設定'}
            </button>
          ))}
        </div>
      </header>

      {/* 6-2. 成果承認タブ (Referral Management) */}
      {activeTab === 'referrals' && (
        <>
          <div style={{ backgroundColor: selectedIds.length > 0 ? '#1e293b' : '#fff', color: selectedIds.length > 0 ? '#fff' : '#64748b', padding: '12px 20px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '15px', transition: '0.2s' }}>
            <div style={{ fontSize: '13px', fontWeight: 'bold' }}>一括操作 ({selectedIds.length}件):</div>
            <select disabled={selectedIds.length === 0} value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} style={{ padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1', backgroundColor: '#fff', color: '#333' }}>
              <option value="">新ステータスを選択</option>
              {/* ギフト発行済(issued)を選択肢から除外 */}
              {STATUS_OPTIONS.filter(o => o.value !== 'issued').map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <button onClick={handleBulkExecute} disabled={!bulkValue} style={{ padding: '6px 16px', borderRadius: '4px', border: 'none', backgroundColor: bulkValue ? '#3b82f6' : '#475569', color: '#fff', cursor: 'pointer' }}>実行</button>
          </div>

          <div style={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#64748b', fontSize: '11px' }}>
                  <th style={{ padding: '15px 20px', width: '40px' }}>
                    <input type="checkbox" checked={isAllSelected} onChange={handleToggleAll} />
                  </th>
                  <th style={{ padding: '15px' }}>日時 / 店舗ID</th>
                  <th style={{ padding: '15px' }}>店舗名 (クリックで編集)</th>
                  <th style={{ padding: '15px' }}>受注番号</th>
                  <th style={{ padding: '15px' }}>獲得Pt</th>
                  <th style={{ padding: '15px' }}>ステータス</th>
                  <th style={{ padding: '15px' }}>操作</th>
                </tr>
              </thead>
              <tbody style={{ fontSize: '13px' }}>
                {referrals.map(ref => {
                  const shop = shops.find(s => String(s.id) === String(ref.shop_id));
                  const rank = ranks.find(r => String(r.id) === String(shop?.rank_id));
                  const status = STATUS_OPTIONS.find(s => s.value === ref.status);
                  return (
                    <tr key={ref.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '15px 20px' }}>
                        <input type="checkbox" checked={selectedIds.includes(ref.id)} onChange={() => handleToggleSelect(ref.id)} />
                      </td>
                      <td style={{ padding: '15px' }}>
                        <div style={{ fontSize: '11px', color: '#94a3b8' }}>{new Date(ref.created_at).toLocaleString('ja-JP')}</div>
                        <div style={{ color: '#6366f1', fontWeight: 'bold' }}>ID: {ref.shop_id}</div>
                      </td>
                      <td style={{ padding: '15px' }}>
                        <button onClick={() => { setEditingShop(shop); setIsShopModalOpen(true); }} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', textDecoration: 'underline' }}>
                          <div style={{ fontWeight: 'bold', color: '#1e293b' }}>{shop?.name || '不明な店舗'}</div>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>{rank?.label}</div>
                        </button>
                      </td>
                      <td style={{ padding: '15px' }}>{ref.order_number}</td>
                      <td style={{ padding: '15px' }}>{(rank?.reward_points || 5000).toLocaleString()} pt</td>
                      <td style={{ padding: '15px' }}><span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold', backgroundColor: status?.bgColor, color: status?.color }}>{status?.label}</span></td>
                      <td style={{ padding: '15px' }}><button onClick={() => { setEditingRef(ref); setIsRefModalOpen(true); }} style={{ padding: '5px 12px', borderRadius: '4px', border: '1px solid #cbd5e1', cursor: 'pointer', backgroundColor: '#fff' }}>詳細</button></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* 6-3. 支払い管理タブ (Payment Management) */}
      {activeTab === 'payments' && (
        <div style={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#64748b', fontSize: '12px' }}>
                <th style={{ padding: '15px' }}>店舗名</th>
                <th style={{ padding: '15px' }}>ステータス</th>
                <th style={{ padding: '15px' }}>件数</th>
                <th style={{ padding: '15px' }}>累計報酬額</th>
                <th style={{ padding: '15px' }}>未払い額</th>
                <th style={{ padding: '15px' }}>支払い済み額</th>
                <th style={{ padding: '15px', textAlign: 'center' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {shops.map(shop => {
                const shopTxs = pointTransactions.filter(tx => String(tx.shop_id) === String(shop.id));
                if (shopTxs.length === 0) return null; // 1度も発生していない店舗は出さない

                const unpaidTxs = shopTxs.filter(tx => tx.status === 'confirmed');
                const paidTxs = shopTxs.filter(tx => tx.status === 'paid');

                const unpaidTotal = unpaidTxs.reduce((sum, tx) => sum + (Number(tx.points) || 0), 0);
                const paidTotal = paidTxs.reduce((sum, tx) => sum + (Number(tx.points) || 0), 0);
                const totalAmount = unpaidTotal + paidTotal;

                const isAllPaid = unpaidTotal === 0;
                const statusLabel = isAllPaid ? 'ギフト発行済' : '報酬確定';
                const statusColor = isAllPaid ? '#1e40af' : '#065f46';
                const statusBg = isAllPaid ? '#dbeafe' : '#d1fae5';

                return (
                  <tr key={shop.id} style={{ borderBottom: '1px solid #f1f5f9', fontSize: '13px' }}>
                    <td style={{ padding: '15px' }}><b>{shop.name}</b></td>
                    <td style={{ padding: '15px' }}>
                      <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold', backgroundColor: statusBg, color: statusColor }}>
                        {statusLabel}
                      </span>
                    </td>
                    <td style={{ padding: '15px' }}>{shopTxs.length} 件</td>
                    <td style={{ padding: '15px', fontWeight: 'bold' }}>{totalAmount.toLocaleString()} pt</td>
                    <td style={{ padding: '15px', fontWeight: 'bold', color: !isAllPaid ? '#e11d48' : '#64748b' }}>
                      {unpaidTotal.toLocaleString()} pt
                    </td>
                    <td style={{ padding: '15px', color: '#64748b' }}>{paidTotal.toLocaleString()} pt</td>
                    <td style={{ padding: '15px', textAlign: 'center' }}>
                      {!isAllPaid ? (
                        <button 
                          onClick={() => handlePaymentComplete(shop.id)} 
                          style={{ padding: '8px 16px', backgroundColor: '#059669', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}
                        >
                          支払完了にする
                        </button>
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: '12px', fontWeight: 'bold' }}>処理完了</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 6-4. マスタ設定タブ (Settings) */}
      {activeTab === 'settings' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '20px' }}>
            {editingRanks.map(rank => (
              <div key={rank.id} style={{ backgroundColor: '#fff', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '5px' }}>ランク名</label>
                  <input type="text" value={rank.label} onChange={(e) => handleRankChange(rank.id, 'label', e.target.value)} style={{ width: '100%', padding: '10px', fontSize: '16px', fontWeight: 'bold', borderRadius: '4px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '5px' }}>1件あたりの報酬ポイント</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <input type="number" value={rank.reward_points} onChange={(e) => handleRankChange(rank.id, 'reward_points', Number(e.target.value))} style={{ flex: 1, padding: '10px', fontSize: '16px', borderRadius: '4px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
                    <span style={{ fontWeight: 'bold' }}>pt</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={handleSaveAllRanks} style={{ padding: '12px 30px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '16px' }}>
              変更を保存する
            </button>
          </div>
        </div>
      )}

      {/* 6-5. モーダル群 (Dialogs) */}
      
      {/* 店舗編集モーダル */}
      {isShopModalOpen && editingShop && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 200 }}>
          <div style={{ backgroundColor: '#fff', padding: '25px', borderRadius: '12px', width: '450px' }}>
            <h3 style={{ marginTop: 0 }}>店舗詳細設定</h3>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ fontSize: '12px', display: 'block', marginBottom: '5px' }}>メール</label>
              <input type="email" value={editingShop.email} onChange={(e) => setEditingShop({...editingShop, email: e.target.value})} style={{ width: '100%', padding: '8px', boxSizing: 'border-box', border: '1px solid #cbd5e1', borderRadius: '4px' }} />
            </div>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ fontSize: '12px', display: 'block', marginBottom: '5px' }}>ランク</label>
              <select value={editingShop.rank_id} onChange={(e) => setEditingShop({...editingShop, rank_id: e.target.value})} style={{ width: '100%', padding: '8px', backgroundColor: '#fff', color: '#333', border: '1px solid #cbd5e1', borderRadius: '4px' }}>
                {ranks.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setIsShopModalOpen(false)} style={{ padding: '8px 16px', border: 'none', backgroundColor: '#f1f5f9', borderRadius: '4px', cursor: 'pointer' }}>閉じる</button>
              <button onClick={() => handleShopSave(editingShop)} style={{ padding: '8px 16px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>保存</button>
            </div>
          </div>
        </div>
      )}

      {/* 成果ステータス更新モーダル */}
      {isRefModalOpen && editingRef && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 200 }}>
          <div style={{ backgroundColor: '#fff', padding: '25px', borderRadius: '12px', width: '400px' }}>
            <h3 style={{ marginTop: 0 }}>ステータス更新</h3>
            <p style={{ fontSize: '13px', color: '#64748b' }}>受注番号: {editingRef.order_number}</p>
            <select value={editingRef.status} onChange={(e) => setEditingRef({...editingRef, status: e.target.value})} style={{ width: '100%', padding: '10px', margin: '20px 0', borderRadius: '4px', border: '1px solid #cbd5e1', backgroundColor: '#fff', color: '#333' }}>
              {/* ギフト発行済(issued)を除外。ただし現在の状態がissuedなら残す */}
              {STATUS_OPTIONS.filter(opt => opt.value !== 'issued' || opt.value === editingRef.status).map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setIsRefModalOpen(false)} style={{ padding: '8px 16px', border: 'none', backgroundColor: '#f1f5f9', borderRadius: '4px', cursor: 'pointer' }}>キャンセル</button>
              <button onClick={() => handleRefModalSave(editingRef)} style={{ padding: '8px 16px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>更新</button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}