'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

// ==========================================
// 1. 定数・型定義
// ==========================================
const STATUS_OPTIONS = [
  { value: 'pending', label: '仮計上', color: '#92400e', bgColor: '#fef3c7' },
  { value: 'confirmed', label: '報酬確定', color: '#065f46', bgColor: '#d1fae5' },
  { value: 'issued', label: 'ギフト発行済', color: '#1e40af', bgColor: '#dbeafe' },
  { value: 'cancel', label: 'キャンセル', color: '#991b1b', bgColor: '#fee2e2' },
]

// ★ 追加：キャンセル事由の選択肢
const CANCEL_REASONS = [
  'お客様都合によるキャンセル・返品',
  'いたずら・不正な申し込み',
  '重複登録・対象外の申し込み',
  '条件未達による否認',
  'その他'
]

export default function AdminDashboard() {
  // ==========================================
  // 2. ステート管理
  // ==========================================
  const [activeTab, setActiveTab] = useState<'referrals' | 'payments' | 'settings'>('referrals')
  const [referrals, setReferrals] = useState<any[]>([])
  const [shops, setShops] = useState<any[]>([])
  const [ranks, setRanks] = useState<any[]>([])
  const [pointTransactions, setPointTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isAllSelected, setIsAllSelected] = useState(false)

  const [isRefModalOpen, setIsRefModalOpen] = useState(false)
  const [editingRef, setEditingRef] = useState<any>(null)
  const [isShopModalOpen, setIsShopModalOpen] = useState(false)
  const [editingShop, setEditingShop] = useState<any>(null)

  const [editingRanks, setEditingRanks] = useState<any[]>([])
  const [rewardRules, setRewardRules] = useState<any[]>([])
  const [editingRules, setEditingRules] = useState<any[]>([])

  // ==========================================
  // 3. データ取得ロジック
  // ==========================================
  const fetchData = async () => {
    const [r, s, rk, tx, rr] = await Promise.all([
      supabase.from('referrals').select('*').order('created_at', { ascending: false }),
      supabase.from('shops').select('*'),
      supabase.from('shop_ranks').select('*').order('reward_points', { ascending: true }),
      supabase.from('point_transactions').select('*'),
      supabase.from('reward_rules').select('*')
    ])
    
    if (r.data) setReferrals(r.data)
    if (s.data) setShops(s.data)
    if (tx.data) setPointTransactions(tx.data)
    if (rk.data) {
      setRanks(rk.data)
      setEditingRanks(rk.data)
    }
    if (rr.data) {
      setRewardRules(rr.data)
      setEditingRules(rr.data)
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
  // 4. ポイント・報酬連動ロジック
  // ==========================================
  const removePoints = async (referralId: string) => {
    const { error } = await supabase.from('point_transactions')
      .delete()
      .eq('referral_id', referralId)
    if (error) console.error("ポイント削除エラー:", error)
  }

  const issuePoints = async (referral: any, currentShops: any[], currentRanks: any[]) => {
    const { data: existing } = await supabase.from('point_transactions').select('id').eq('referral_id', referral.id).limit(1)
    if (existing && existing.length > 0) return

    const { data: pastTxs } = await supabase
      .from('point_transactions')
      .select('metadata')
      .eq('shop_id', referral.shop_id)

    const hasReceivedBonus = pastTxs?.some(tx => tx.metadata?.is_bonus === true) || false;
    const isFirstTime = !hasReceivedBonus;

    const shop = currentShops.find(s => String(s.id) === String(referral.shop_id))
    const rank = currentRanks.find(r => String(r.id) === String(shop?.rank_id))
    const standardPoints = Number(rank?.reward_points) || 5000

    const transactions = []
    transactions.push({
      shop_id: referral.shop_id,
      referral_id: referral.id,
      points: standardPoints,
      reason: `${rank?.label || '通常'}報酬`,
      status: 'confirmed',
      metadata: { order_number: referral.order_number }
    })

    if (isFirstTime) {
      const firstRule = rewardRules.find(r => r.id === 'first_bonus')
      if (firstRule) {
        transactions.push({
          shop_id: referral.shop_id,
          referral_id: referral.id,
          points: Number(firstRule.base_points),
          reason: firstRule.label,
          status: 'confirmed',
          metadata: { order_number: referral.order_number, is_bonus: true }
        })
      }
    }

    await supabase.from('point_transactions').insert(transactions)

    if (isFirstTime) {
      await supabase.from('referrals').update({ reward_rule_id: 'first_bonus' }).eq('id', referral.id)
    }
  }

  // ==========================================
  // 5. アクションハンドラー
  // ==========================================

  const handleToggleAll = () => {
    if (isAllSelected) {
      setSelectedIds([])
      setIsAllSelected(false)
    } else {
      const selectableIds = referrals.filter(r => r.status === 'pending').map(r => r.id)
      setSelectedIds(selectableIds)
      setIsAllSelected(selectableIds.length > 0)
    }
  }

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
      const selectableCount = referrals.filter(r => r.status === 'pending').length
      setIsAllSelected(next.length === selectableCount && selectableCount > 0)
      return next
    })
  }

  const handleBulkConfirm = async () => {
    if (selectedIds.length === 0) return
    if (!confirm(`選択した ${selectedIds.length} 件の紹介を「報酬確定」にしますか？`)) return

    const { error } = await supabase.from('referrals').update({ status: 'confirmed' }).in('id', selectedIds)
    if (error) { alert('エラーが発生しました'); return; }
    
    const targets = referrals.filter(r => selectedIds.includes(r.id))
    for (const target of targets) {
      if (target.status !== 'confirmed') { 
        await issuePoints(target, shops, ranks)
      }
    }
    
    setSelectedIds([])
    setIsAllSelected(false)
    await fetchData()
  }

  const handleRefModalSave = async (updatedRef: any) => {
    const originalRef = referrals.find(r => r.id === updatedRef.id)
    
    // 変更がない場合はそのまま閉じる
    if (originalRef?.status === updatedRef.status && originalRef?.cancel_reason === updatedRef.cancel_reason) {
      setIsRefModalOpen(false)
      return
    }

    // ★追加：キャンセルの場合は事由の選択を必須にする
    if (updatedRef.status === 'cancel' && !updatedRef.cancel_reason) {
      alert('キャンセル事由を選択してください。')
      return
    }

    if (updatedRef.status === 'cancel' && originalRef?.status !== 'cancel') {
      const msg = originalRef?.status === 'confirmed'
        ? "【⚠️ 重大警告】\nこのデータはすでに「報酬確定」されています。\nキャンセルすると、計算済みの報酬ポイントがすべて削除され、二度と元に戻すことはできません。\n\n本当にキャンセルしてよろしいですか？"
        : "【⚠️ 警告】\nこのデータをキャンセル（無効化）します。\n一度キャンセルすると、今後一切ステータスを戻すことはできません。\n\n本当にキャンセルしてよろしいですか？";
      if (!confirm(msg)) return;
    } else if (originalRef?.status === 'confirmed' && updatedRef.status === 'pending') {
      const msg = "【⚠️ 警告】\nこのデータはすでに「報酬確定」されています。\n「仮計上」に戻すと、現在付与されている報酬ポイントがいったん削除されます。\n\n本当に仮計上に戻しますか？";
      if (!confirm(msg)) return;
    }

    // ★修正：キャンセル事由もDBに保存する（キャンセル以外になったらnullでクリアする）
    await supabase.from('referrals').update({ 
      status: updatedRef.status,
      cancel_reason: updatedRef.status === 'cancel' ? updatedRef.cancel_reason : null 
    }).eq('id', updatedRef.id)
    
    if (updatedRef.status === 'confirmed' && originalRef?.status !== 'confirmed') {
      await issuePoints(updatedRef, shops, ranks)
    } else if (updatedRef.status !== 'confirmed' && originalRef?.status === 'confirmed') {
      await removePoints(updatedRef.id)
    }
    
    setIsRefModalOpen(false)
    await fetchData()
  }

  const handlePaymentComplete = async (shopId: string) => {
    if (!confirm('支払いを完了（ギフト発行済）にしますか？\n成果一覧のステータスも「発行済」に更新されます。')) return
    setLoading(true)

    try {
      const { data: targetTxs, error: fetchError } = await supabase.from('point_transactions').select('referral_id').eq('shop_id', shopId).eq('status', 'confirmed')
      if (fetchError || !targetTxs || targetTxs.length === 0) {
        alert('支払い対象のデータが見つかりませんでした。')
        setLoading(false); return;
      }

      const targetRefIds = Array.from(new Set(targetTxs.map(tx => tx.referral_id)))
      const { error: txUpdateError } = await supabase.from('point_transactions').update({ status: 'paid' }).eq('shop_id', shopId).eq('status', 'confirmed')
      if (txUpdateError) throw txUpdateError

      const { error: refUpdateError } = await supabase.from('referrals').update({ status: 'issued' }).in('id', targetRefIds)
      if (refUpdateError) throw refUpdateError

      await fetchData()
      alert('支払い処理が完了し、すべてのステータスを更新しました！')
    } catch (err) {
      console.error('支払い処理エラー:', err)
      alert('エラーが発生しました。詳細はコンソールを確認してください。')
    } finally {
      setLoading(false)
    }
  }

  const handleShopSave = async (shop: any) => {
    await supabase.from('shops').update({ email: shop.email, rank_id: shop.rank_id }).eq('id', shop.id)
    setIsShopModalOpen(false)
    await fetchData()
  }

  const handleRankChange = (id: string, field: string, value: string | number) => {
    setEditingRanks(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r))
  }
  const handleRuleChange = (id: string, field: string, value: string | number) => {
    setEditingRules(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r))
  }

  const handleSaveAllSettings = async () => {
    if (!confirm('マスタ設定を変更しますか？')) return
    setLoading(true)
    for (const rank of editingRanks) { await supabase.from('shop_ranks').update({ label: rank.label, reward_points: rank.reward_points }).eq('id', rank.id) }
    for (const rule of editingRules) { await supabase.from('reward_rules').update({ label: rule.label, base_points: rule.base_points }).eq('id', rule.id) }
    await fetchData()
    setLoading(false)
    alert('すべての設定を保存しました！')
  }

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>読み込み中...</div>

  return (
    <main style={{ padding: '20px', width: '100%', boxSizing: 'border-box', backgroundColor: '#f8fafc', minHeight: '100vh', fontFamily: 'sans-serif' }}>
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

      {activeTab === 'referrals' && (
        <>
          <div style={{ backgroundColor: selectedIds.length > 0 ? '#1e293b' : '#fff', color: selectedIds.length > 0 ? '#fff' : '#64748b', padding: '12px 20px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '15px', transition: '0.2s' }}>
            <div style={{ fontSize: '13px', fontWeight: 'bold' }}>一括操作 ({selectedIds.length}件):</div>
            <button onClick={handleBulkConfirm} disabled={selectedIds.length === 0} style={{ padding: '8px 20px', borderRadius: '6px', border: 'none', backgroundColor: selectedIds.length > 0 ? '#10b981' : '#475569', color: '#fff', cursor: selectedIds.length > 0 ? 'pointer' : 'not-allowed', fontWeight: 'bold', fontSize: '13px', transition: '0.2s' }}>
              チェックした項目を「報酬確定」にする
            </button>
            <span style={{ fontSize: '11px', opacity: 0.7 }}>※仮計上のデータのみ選択可能です</span>
          </div>

          <div style={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#64748b', fontSize: '11px' }}>
                  <th style={{ padding: '15px 20px', width: '40px' }}><input type="checkbox" checked={isAllSelected} onChange={handleToggleAll} disabled={referrals.filter(r => r.status === 'pending').length === 0}/></th>
                  <th style={{ padding: '15px' }}>日時 / 店舗ID</th>
                  <th style={{ padding: '15px' }}>店舗名</th>
                  <th style={{ padding: '15px' }}>受注番号</th>
                  <th style={{ padding: '15px' }}>獲得予定Pt</th>
                  <th style={{ padding: '15px' }}>ステータス</th>
                  <th style={{ padding: '15px', textAlign: 'center' }}>操作</th>
                </tr>
              </thead>
              <tbody style={{ fontSize: '13px' }}>
                {referrals.map(ref => {
                  const shop = shops.find(s => String(s.id) === String(ref.shop_id));
                  const rank = ranks.find(r => String(r.id) === String(shop?.rank_id));
                  const status = STATUS_OPTIONS.find(s => s.value === ref.status);
                  const isIssued = ref.status === 'issued';
                  const isCanceled = ref.status === 'cancel'; 
                  const isCheckable = ref.status === 'pending';

                  const refTxs = pointTransactions.filter(tx => tx.referral_id === ref.id);
                  const hasTxs = refTxs.length > 0;
                  const hasBonusTx = refTxs.some(tx => tx.metadata?.is_bonus === true);

                  const shopHasBonusTx = pointTransactions.some(tx => String(tx.shop_id) === String(ref.shop_id) && tx.metadata?.is_bonus === true);

                  const shopValidRefs = referrals
                    .filter(r => String(r.shop_id) === String(ref.shop_id) && r.status !== 'cancel')
                    .sort((a,b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
                  
                  const isOldest = shopValidRefs.length > 0 && shopValidRefs[0].id === ref.id;
                  const successCount = shopValidRefs.findIndex(r => r.id === ref.id) + 1;

                  const isFirstTime = isCanceled ? false : (hasTxs ? hasBonusTx : (!shopHasBonusTx && isOldest));

                  const firstRule = rewardRules.find(r => r.id === 'first_bonus');
                  const standardPt = Number(rank?.reward_points) || 5000;
                  const bonusPt = (isFirstTime && firstRule) ? Number(firstRule.base_points) : 0;
                  const totalPt = isCanceled ? 0 : (hasTxs ? refTxs.reduce((sum, tx) => sum + Number(tx.points), 0) : standardPt + bonusPt);

                  return (
                    <tr key={ref.id} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: isIssued ? '#fcfcfc' : isCanceled ? '#fef2f2' : 'transparent' }}>
                      <td style={{ padding: '15px 20px' }}>
                        <input type="checkbox" disabled={!isCheckable} checked={selectedIds.includes(ref.id)} onChange={() => handleToggleSelect(ref.id)} />
                      </td>
                      <td style={{ padding: '15px' }}>
                        <div style={{ fontSize: '11px', color: '#94a3b8' }}>{new Date(ref.created_at).toLocaleString('ja-JP')}</div>
                        <div style={{ color: isIssued || isCanceled ? '#94a3b8' : '#6366f1', fontWeight: 'bold' }}>ID: {ref.shop_id}</div>
                      </td>
                      <td style={{ padding: '15px' }}>
                        <button onClick={() => { if(!isIssued && !isCanceled) { setEditingShop(shop); setIsShopModalOpen(true); } }} style={{ background: 'none', border: 'none', padding: 0, cursor: (isIssued || isCanceled) ? 'default' : 'pointer', textAlign: 'left' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            <span style={{ fontWeight: 'bold', color: isIssued || isCanceled ? '#94a3b8' : '#1e293b', fontSize: '14px' }}>{shop?.name || '不明'}</span>
                            {!isCanceled && (
                              <span style={{ fontSize: '10px', backgroundColor: isFirstTime ? '#d1fae5' : '#f1f5f9', color: isFirstTime ? '#065f46' : '#64748b', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold', border: isFirstTime ? '1px solid #a7f3d0' : '1px solid #e2e8f0', opacity: isIssued ? 0.5 : 1 }}>
                                {isFirstTime ? '初紹介！' : `${successCount} 件目`}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '11px', color: '#94a3b8' }}>{rank?.label || '未設定'}ランク</div>
                        </button>
                      </td>
                      <td style={{ padding: '15px', color: isIssued || isCanceled ? '#94a3b8' : '#333' }}>{ref.order_number}</td>
                      <td style={{ padding: '15px' }}>
                        <div style={{ fontWeight: 'bold', fontSize: '16px', color: isIssued || isCanceled ? '#94a3b8' : (bonusPt > 0 ? '#059669' : '#1e293b') }}>
                          {totalPt.toLocaleString()} pt
                        </div>
                        {isFirstTime && bonusPt > 0 && !isIssued && !isCanceled && (
                          <div style={{ fontSize: '10px', color: '#059669', fontWeight: 'bold', marginTop: '2px' }}>※初回ボーナス込</div>
                        )}
                      </td>
                      <td style={{ padding: '15px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
                          <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold', backgroundColor: status?.bgColor, color: status?.color, opacity: isIssued || isCanceled ? 0.6 : 1 }}>
                            {status?.label}
                          </span>
                          {/* ★ Admin側でもキャンセル事由をチラ見せ */}
                          {isCanceled && ref.cancel_reason && (
                            <span style={{ fontSize: '10px', color: '#ef4444', fontWeight: 'bold' }}>{ref.cancel_reason}</span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '15px', textAlign: 'center' }}>
                        {isIssued ? (
                          <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 'bold' }}>✅ 処理済</span>
                        ) : isCanceled ? (
                          <span style={{ fontSize: '11px', color: '#ef4444', fontWeight: 'bold' }}>🚫 キャンセル済</span>
                        ) : (
                          <button onClick={() => { setEditingRef(ref); setIsRefModalOpen(true); }} style={{ padding: '5px 12px', borderRadius: '4px', border: '1px solid #cbd5e1', cursor: 'pointer', backgroundColor: '#fff', fontSize: '12px', fontWeight: 'bold' }}>詳細</button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* 支払い管理、マスタ設定タブは省略せずにそのまま保持 */}
      {activeTab === 'payments' && (
        <div style={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#64748b', fontSize: '12px' }}>
                <th style={{ padding: '15px' }}>店舗名</th>
                <th style={{ padding: '15px' }}>ステータス</th>
                <th style={{ padding: '15px' }}>紹介件数</th>
                <th style={{ padding: '15px' }}>累計報酬額</th>
                <th style={{ padding: '15px' }}>未払い額</th>
                <th style={{ padding: '15px' }}>支払い済み額</th>
                <th style={{ padding: '15px', textAlign: 'center' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {shops.map(shop => {
                const validTxs = pointTransactions.filter(tx => {
                  const ref = referrals.find(r => r.id === tx.referral_id);
                  return String(tx.shop_id) === String(shop.id) && ref && ref.status !== 'cancel';
                });
                if (validTxs.length === 0) return null;

                const uniqueReferralCount = new Set(validTxs.map(tx => tx.referral_id)).size;
                const hasBonus = validTxs.some(tx => tx.metadata?.is_bonus === true);

                const unpaidTxs = validTxs.filter(tx => tx.status === 'confirmed');
                const paidTxs = validTxs.filter(tx => tx.status === 'paid');

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
                    <td style={{ padding: '15px' }}><span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold', backgroundColor: statusBg, color: statusColor }}>{statusLabel}</span></td>
                    <td style={{ padding: '15px' }}><span style={{ fontWeight: 'bold' }}>{uniqueReferralCount}</span> 件</td>
                    <td style={{ padding: '15px' }}>
                      <div style={{ fontWeight: 'bold' }}>{totalAmount.toLocaleString()} pt</div>
                      {hasBonus && <div style={{ fontSize: '10px', color: '#059669', fontWeight: 'bold' }}>（初回ボーナス込）</div>}
                    </td>
                    <td style={{ padding: '15px', fontWeight: 'bold', color: !isAllPaid ? '#e11d48' : '#64748b' }}>{unpaidTotal.toLocaleString()} pt</td>
                    <td style={{ padding: '15px', color: '#64748b' }}>{paidTotal.toLocaleString()} pt</td>
                    <td style={{ padding: '15px', textAlign: 'center' }}>
                      {!isAllPaid ? (
                        <button onClick={() => handlePaymentComplete(shop.id)} style={{ padding: '8px 16px', backgroundColor: '#059669', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>支払完了にする</button>
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

      {activeTab === 'settings' && (
        <div>
          <h3 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '15px' }}>ランク別ポイント設定</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '40px' }}>
            {editingRanks.map(rank => (
              <div key={rank.id} style={{ backgroundColor: '#fff', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '5px' }}>ランク名</label>
                  <input type="text" value={rank.label} onChange={(e) => handleRankChange(rank.id, 'label', e.target.value)} style={{ width: '100%', padding: '10px', fontSize: '16px', fontWeight: 'bold', borderRadius: '4px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '5px' }}>報酬ポイント</label>
                  <input type="number" value={rank.reward_points} onChange={(e) => handleRankChange(rank.id, 'reward_points', Number(e.target.value))} style={{ width: '100%', padding: '10px', fontSize: '16px', borderRadius: '4px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
                </div>
              </div>
            ))}
          </div>
          <h3 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '15px', borderTop: '1px solid #e2e8f0', paddingTop: '30px' }}>特別報酬ルール (初回ボーナス等)</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '40px' }}>
            {editingRules.map(rule => (
              <div key={rule.id} style={{ backgroundColor: '#fff', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ fontSize: '10px', color: '#6366f1', fontWeight: 'bold' }}>ID: {rule.id}</label>
                  <label style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '5px', marginTop: '5px' }}>報酬の名前</label>
                  <input type="text" value={rule.label} onChange={(e) => handleRuleChange(rule.id, 'label', e.target.value)} style={{ width: '100%', padding: '10px', fontSize: '14px', fontWeight: 'bold', borderRadius: '4px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '5px' }}>設定ポイント</label>
                  <input type="number" value={rule.base_points} onChange={(e) => handleRuleChange(rule.id, 'base_points', Number(e.target.value))} style={{ width: '100%', padding: '10px', fontSize: '16px', borderRadius: '4px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={handleSaveAllSettings} style={{ padding: '12px 30px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '16px' }}>設定をすべて保存する</button>
          </div>
        </div>
      )}

      {/* ステータス更新モーダル */}
      {isRefModalOpen && editingRef && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 200 }}>
          <div style={{ backgroundColor: '#fff', padding: '25px', borderRadius: '12px', width: '400px' }}>
            <h3 style={{ marginTop: 0 }}>ステータス更新</h3>
            <p style={{ fontSize: '13px', color: '#64748b' }}>受注番号: {editingRef.order_number}</p>
            
            <div style={{ margin: '20px 0' }}>
              <label style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>ステータス</label>
              <select value={editingRef.status} onChange={(e) => setEditingRef({...editingRef, status: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #cbd5e1', backgroundColor: '#fff', color: '#333' }}>
                {STATUS_OPTIONS.filter(opt => opt.value !== 'issued').map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* ★ キャンセルを選んだときだけ「キャンセル事由」のドロップダウンを表示 */}
            {editingRef.status === 'cancel' && (
              <div style={{ marginBottom: '25px' }}>
                <label style={{ fontSize: '12px', color: '#991b1b', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>キャンセル事由 (必須)</label>
                <select
                  value={editingRef.cancel_reason || ''}
                  onChange={(e) => setEditingRef({...editingRef, cancel_reason: e.target.value})}
                  style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #fca5a5', backgroundColor: '#fef2f2', color: '#991b1b', outline: 'none' }}
                >
                  <option value="">事由を選択してください</option>
                  {CANCEL_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setIsRefModalOpen(false)} style={{ padding: '8px 16px', border: 'none', backgroundColor: '#f1f5f9', borderRadius: '4px', cursor: 'pointer' }}>閉じる</button>
              <button onClick={() => handleRefModalSave(editingRef)} style={{ padding: '8px 16px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>更新して保存</button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}