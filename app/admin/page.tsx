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

// ★ 追加：報酬ルールのマスタデータ保持用
const [rewardRules, setRewardRules] = useState<any[]>([])
const [editingRules, setEditingRules] = useState<any[]>([]) // 編集中の値保持用

// ==========================================
// 3. データ取得ロジック (Data Fetching)
// ==========================================
const fetchData = async () => {
  const [r, s, rk, tx, rr] = await Promise.all([
    supabase.from('referrals').select('*').order('created_at', { ascending: false }),
    supabase.from('shops').select('*'),
    supabase.from('shop_ranks').select('*').order('reward_points', { ascending: true }),
    supabase.from('point_transactions').select('*'),
    supabase.from('reward_rules').select('*') // ★追加
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
    setEditingRules(rr.data) // ★追加
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
  
  /** ポイント削除（確定以外にステータスを変えた時に実行） */
  const removePoints = async (referralId: string) => {
    await supabase.from('point_transactions')
      .delete()
      .eq('referral_id', referralId)
      .eq('status', 'confirmed') 
  }

  /** ポイント発行：お店単位の初回判定を行う（重複を除外してカウント） */
  const issuePoints = async (referral: any, currentShops: any[], currentRanks: any[]) => {
    // 1. このお店(shop_id)の「過去の支払い履歴」を取得
    const { data: pastTxs } = await supabase
      .from('point_transactions')
      .select('referral_id')
      .eq('shop_id', referral.shop_id)
      .in('status', ['confirmed', 'paid'])

    // 2. 【重要】紹介ID(referral_id)の重複を除いて「何件の紹介が成功したか」を数える
    // (1件の紹介で通常+ボーナスの2行あっても、Setを使うことで「1件」と数えられます)
    const uniqueReferralCount = new Set(pastTxs?.map(t => t.referral_id)).size;

    // 3. すでに他の紹介が1件でもあれば、今回の分は「初回」ではない
    // ※もし「自分自身」がすでに登録されていたらそれはカウントから除外すべきですが、
    //   この関数は「登録前」に走るため、このままでOKです。
    const isFirstTime = (uniqueReferralCount === 0);

    const shop = currentShops.find(s => String(s.id) === String(referral.shop_id))
    const rank = currentRanks.find(r => String(r.id) === String(shop?.rank_id))
    const standardPoints = Number(rank?.reward_points) || 5000

    // 重複発行チェック
    const { data: existing } = await supabase.from('point_transactions').select('id').eq('referral_id', referral.id).maybeSingle()
    if (existing) return

    const transactions = []
    // A. 通常報酬
    transactions.push({
      shop_id: referral.shop_id,
      referral_id: referral.id,
      points: standardPoints,
      reason: `${rank?.label || '通常'}報酬`,
      status: 'confirmed',
      metadata: { order_number: referral.order_number }
    })

    // B. 初回ボーナス
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
  // 5. アクションハンドラー (Event Handlers)
  // ==========================================

/** 全選択チェックボックスの切り替え：発行済(issued)は除外する */
  const handleToggleAll = () => {
    if (isAllSelected) {
      setSelectedIds([])
      setIsAllSelected(false)
    } else {
      // 発行済(issued)以外のIDだけを抽出
      const selectableIds = referrals
        .filter(r => r.status !== 'issued')
        .map(r => r.id)
      
      setSelectedIds(selectableIds)
      setIsAllSelected(selectableIds.length > 0)
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

/** 支払い完了処理：取引履歴を paid にし、成果ステータスを issued に更新する */
  const handlePaymentComplete = async (shopId: string) => {
    // 1. 確認
    if (!confirm('支払いを完了（ギフト発行済）にしますか？\n成果一覧のステータスも「発行済」に更新されます。')) return
    
    setLoading(true)

    try {
      // 2. 現在「報酬確定(confirmed)」状態の取引データを取得して、関連する紹介IDを特定する
      const { data: targetTxs, error: fetchError } = await supabase
        .from('point_transactions')
        .select('referral_id')
        .eq('shop_id', shopId)
        .eq('status', 'confirmed')

      if (fetchError || !targetTxs || targetTxs.length === 0) {
        alert('支払い対象のデータが見つかりませんでした。')
        setLoading(false)
        return
      }

      // 紹介IDを重複なしで抽出（初回ボーナスで2行ある場合も1つにまとめる）
      const targetRefIds = Array.from(new Set(targetTxs.map(tx => tx.referral_id)))

      // 3. 取引データ（ポイント明細）を「支払済(paid)」に更新
      const { error: txUpdateError } = await supabase
        .from('point_transactions')
        .update({ status: 'paid' })
        .eq('shop_id', shopId)
        .eq('status', 'confirmed')

      if (txUpdateError) throw txUpdateError

      // 4. 紹介データ（成果本体）を「ギフト発行済(issued)」に更新
      const { error: refUpdateError } = await supabase
        .from('referrals')
        .update({ status: 'issued' })
        .in('id', targetRefIds)

      if (refUpdateError) throw refUpdateError

      // 5. 最新状態を再取得
      await fetchData()
      alert('支払い処理が完了し、すべてのステータスを更新しました！')

    } catch (err) {
      console.error('支払い処理エラー:', err)
      alert('エラーが発生しました。詳細はコンソールを確認してください。')
    } finally {
      setLoading(false)
    }
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


/** 報酬ルールの入力ハンドラー */
const handleRuleChange = (id: string, field: string, value: string | number) => {
  setEditingRules(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r))
}

/** すべての設定（ランク＋ルール）を一括保存 */
const handleSaveAllSettings = async () => {
  if (!confirm('マスタ設定を変更しますか？')) return
  setLoading(true)

  // 1. ランク設定の更新
  for (const rank of editingRanks) {
    await supabase.from('shop_ranks').update({ 
      label: rank.label, reward_points: rank.reward_points 
    }).eq('id', rank.id)
  }

  // 2. 報酬ルール(first_bonus, product_a等)の更新
  for (const rule of editingRules) {
    await supabase.from('reward_rules').update({
      label: rule.label, base_points: rule.base_points
    }).eq('id', rule.id)
  }

  await fetchData()
  setLoading(false)
  alert('すべての設定を保存しました！')
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
          {/* --- A. 一括操作バー --- */}
          <div style={{ backgroundColor: selectedIds.length > 0 ? '#1e293b' : '#fff', color: selectedIds.length > 0 ? '#fff' : '#64748b', padding: '12px 20px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '15px', transition: '0.2s' }}>
            <div style={{ fontSize: '13px', fontWeight: 'bold' }}>一括操作 ({selectedIds.length}件):</div>
            <select 
              disabled={selectedIds.length === 0} 
              value={bulkValue} 
              onChange={(e) => setBulkValue(e.target.value)} 
              style={{ padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1', backgroundColor: '#fff', color: '#333' }}
            >
              <option value="">新ステータスを選択</option>
              {/* ギフト発行済(issued)は一括操作では選ばせない（支払い管理タブでのみ実行可能） */}
              {STATUS_OPTIONS.filter(o => o.value !== 'issued').map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <button 
              onClick={handleBulkExecute} 
              disabled={!bulkValue} 
              style={{ padding: '6px 16px', borderRadius: '4px', border: 'none', backgroundColor: bulkValue ? '#3b82f6' : '#475569', color: '#fff', cursor: 'pointer', fontWeight: 'bold' }}
            >
              実行
            </button>
          </div>

          {/* --- B. 成果一覧テーブル --- */}
          <div style={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#64748b', fontSize: '11px' }}>
                  <th style={{ padding: '15px 20px', width: '40px' }}>
                    <input type="checkbox" checked={isAllSelected} onChange={handleToggleAll} />
                  </th>
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
                  
                  // 発行済（支払い完了）フラグ
                  const isIssued = ref.status === 'issued';

                  // 1. 【件数計算】紹介IDの重複を除いて「何件目の紹介か」を特定
                  const uniqueRefIds = new Set(
                    pointTransactions
                      .filter(tx => String(tx.shop_id) === String(ref.shop_id) && (tx.status === 'confirmed' || tx.status === 'paid'))
                      .map(tx => tx.referral_id)
                  );
                  
                  // 2. 【初回判定】
                  const successCount = uniqueRefIds.size;
                  const isAlreadyInHistory = uniqueRefIds.has(ref.id);
                  const isFirstTime = isAlreadyInHistory ? (successCount <= 1) : (successCount === 0);

                  // 3. 【ポイント計算】
                  const firstRule = rewardRules.find(r => r.id === 'first_bonus');
                  const standardPt = Number(rank?.reward_points) || 5000;
                  const bonusPt = (isFirstTime && firstRule) ? Number(firstRule.base_points) : 0;
                  const totalPt = standardPt + bonusPt;

                  return (
                    <tr key={ref.id} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: isIssued ? '#fcfcfc' : 'transparent' }}>
                      <td style={{ padding: '15px 20px' }}>
                        <input 
                          type="checkbox" 
                          disabled={isIssued}
                          checked={selectedIds.includes(ref.id)} 
                          onChange={() => handleToggleSelect(ref.id)} 
                        />
                      </td>
                      <td style={{ padding: '15px' }}>
                        <div style={{ fontSize: '11px', color: '#94a3b8' }}>{new Date(ref.created_at).toLocaleString('ja-JP')}</div>
                        <div style={{ color: isIssued ? '#94a3b8' : '#6366f1', fontWeight: 'bold' }}>ID: {ref.shop_id}</div>
                      </td>
                      <td style={{ padding: '15px' }}>
                        <button 
                          onClick={() => { if(!isIssued) { setEditingShop(shop); setIsShopModalOpen(true); } }} 
                          style={{ background: 'none', border: 'none', padding: 0, cursor: isIssued ? 'default' : 'pointer', textAlign: 'left' }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            <span style={{ fontWeight: 'bold', color: isIssued ? '#94a3b8' : '#1e293b', fontSize: '14px' }}>{shop?.name || '不明'}</span>
                            <span style={{ 
                              fontSize: '10px', 
                              backgroundColor: isFirstTime ? '#d1fae5' : '#f1f5f9', 
                              color: isFirstTime ? '#065f46' : '#64748b', 
                              padding: '2px 8px', 
                              borderRadius: '4px', 
                              fontWeight: 'bold',
                              border: isFirstTime ? '1px solid #a7f3d0' : '1px solid #e2e8f0',
                              opacity: isIssued ? 0.5 : 1
                            }}>
                              {isFirstTime ? '初紹介！' : `累計 ${successCount} 件`}
                            </span>
                          </div>
                          <div style={{ fontSize: '11px', color: '#94a3b8' }}>{rank?.label || '未設定'}ランク</div>
                        </button>
                      </td>
                      <td style={{ padding: '15px', color: isIssued ? '#94a3b8' : '#333' }}>{ref.order_number}</td>
                      <td style={{ padding: '15px' }}>
                        <div style={{ fontWeight: 'bold', fontSize: '16px', color: isIssued ? '#94a3b8' : (bonusPt > 0 ? '#059669' : '#1e293b') }}>
                          {totalPt.toLocaleString()} pt
                        </div>
                        {isFirstTime && bonusPt > 0 && !isIssued && (
                          <div style={{ fontSize: '10px', color: '#059669', fontWeight: 'bold', marginTop: '2px' }}>
                            ※初回ボーナス込
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '15px' }}>
                        <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold', backgroundColor: status?.bgColor, color: status?.color, opacity: isIssued ? 0.6 : 1 }}>
                          {status?.label}
                        </span>
                      </td>
                      <td style={{ padding: '15px', textAlign: 'center' }}>
                        {isIssued ? (
                          <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 'bold' }}>✅ 処理済</span>
                        ) : (
                          <button 
                            onClick={() => { setEditingRef(ref); setIsRefModalOpen(true); }} 
                            style={{ padding: '5px 12px', borderRadius: '4px', border: '1px solid #cbd5e1', cursor: 'pointer', backgroundColor: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                          >
                            詳細
                          </button>
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
{/* 6-3. 支払い管理タブ (Payment Management) */}
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
                const shopTxs = pointTransactions.filter(tx => String(tx.shop_id) === String(shop.id));
                if (shopTxs.length === 0) return null;

                const uniqueReferralCount = new Set(shopTxs.map(tx => tx.referral_id)).size;
                const hasBonus = shopTxs.some(tx => tx.metadata?.is_bonus === true);

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
                    <td style={{ padding: '15px' }}>
                      <span style={{ fontWeight: 'bold' }}>{uniqueReferralCount}</span> 件
                    </td>
                    <td style={{ padding: '15px' }}>
                      <div style={{ fontWeight: 'bold' }}>{totalAmount.toLocaleString()} pt</div>
                      {hasBonus && (
                        <div style={{ fontSize: '10px', color: '#059669', fontWeight: 'bold' }}>
                          （初回ボーナス込）
                        </div>
                      )}
                    </td>
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
    {/* A. ランク設定セクション */}
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

    {/* B. 特別報酬ルールセクション (★追加) */}
    <h3 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '15px', borderTop: '1px solid #e2e8f0', paddingTop: '30px' }}>特別報酬ルール (初回ボーナス等)</h3>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '40px' }}>
      {editingRules.map(rule => (
        <div key={rule.id} style={{ backgroundColor: '#fff', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ fontSize: '10px', color: '#6366f1', fontWeight: 'bold' }}>ID: {rule.id}</label>
            <label style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '5px', marginTop: '5px' }}>報酬の名前（オーナー画面に出ます）</label>
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
      <button onClick={handleSaveAllSettings} style={{ padding: '12px 30px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '16px' }}>
        設定をすべて保存する
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