'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { 
  CheckSquare, CreditCard, Settings, AlertTriangle, 
  CheckCircle2, X, AlertCircle, RefreshCw, Loader2 
} from 'lucide-react'

// ==========================================
// 1. 定数・型定義
// ==========================================
const STATUS_OPTIONS = [
  { value: 'pending', label: '仮計上', color: 'text-amber-700', bgColor: 'bg-amber-100', border: 'border-amber-200' },
  { value: 'confirmed', label: '報酬確定', color: 'text-emerald-700', bgColor: 'bg-emerald-100', border: 'border-emerald-200' },
  { value: 'issued', label: 'ギフト発行済', color: 'text-blue-700', bgColor: 'bg-blue-100', border: 'border-blue-200' },
  { value: 'cancel', label: 'キャンセル', color: 'text-red-700', bgColor: 'bg-red-100', border: 'border-red-200' },
]

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
  const [isProcessing, setIsProcessing] = useState(false)

  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isAllSelected, setIsAllSelected] = useState(false)

  const [isRefModalOpen, setIsRefModalOpen] = useState(false)
  const [editingRef, setEditingRef] = useState<any>(null)
  
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
    const { error } = await supabase.from('point_transactions').delete().eq('referral_id', referralId)
    if (error) console.error("ポイント削除エラー:", error)
  }

  const issuePoints = async (referral: any, currentShops: any[], currentRanks: any[]) => {
    const { data: existing } = await supabase.from('point_transactions').select('id').eq('referral_id', referral.id).limit(1)
    if (existing && existing.length > 0) return

    const { data: pastTxs } = await supabase.from('point_transactions').select('metadata').eq('shop_id', referral.shop_id)

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
    
    setIsProcessing(true)
    const { error } = await supabase.from('referrals').update({ status: 'confirmed' }).in('id', selectedIds)
    if (error) { alert('エラーが発生しました'); setIsProcessing(false); return; }
    
    const targets = referrals.filter(r => selectedIds.includes(r.id))
    for (const target of targets) {
      if (target.status !== 'confirmed') { 
        await issuePoints(target, shops, ranks)
      }
    }
    
    setSelectedIds([])
    setIsAllSelected(false)
    await fetchData()
    setIsProcessing(false)
  }

  const handleRefModalSave = async (updatedRef: any) => {
    const originalRef = referrals.find(r => r.id === updatedRef.id)
    
    if (originalRef?.status === updatedRef.status && originalRef?.cancel_reason === updatedRef.cancel_reason) {
      setIsRefModalOpen(false)
      return
    }

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

    setIsProcessing(true)
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
    setIsProcessing(false)
  }

  const handlePaymentComplete = async (shopId: string) => {
    if (!confirm('支払いを完了（ギフト発行済）にしますか？\n成果一覧のステータスも「発行済」に更新されます。')) return
    setIsProcessing(true)

    try {
      const { data: targetTxs, error: fetchError } = await supabase.from('point_transactions').select('referral_id').eq('shop_id', shopId).eq('status', 'confirmed')
      if (fetchError || !targetTxs || targetTxs.length === 0) {
        alert('支払い対象のデータが見つかりませんでした。')
        setIsProcessing(false); return;
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
      setIsProcessing(false)
    }
  }

  const handleRankChange = (id: string, field: string, value: string | number) => {
    setEditingRanks(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r))
  }
  
  const handleRuleChange = (id: string, field: string, value: string | number) => {
    setEditingRules(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r))
  }

  const handleSaveAllSettings = async () => {
    if (!confirm('マスタ設定を変更しますか？')) return
    setIsProcessing(true)
    for (const rank of editingRanks) { await supabase.from('shop_ranks').update({ label: rank.label, reward_points: rank.reward_points }).eq('id', rank.id) }
    for (const rule of editingRules) { await supabase.from('reward_rules').update({ label: rule.label, base_points: rule.base_points }).eq('id', rule.id) }
    await fetchData()
    setIsProcessing(false)
    alert('すべての設定を保存しました！')
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="w-10 h-10 animate-spin text-indigo-600" /></div>

  return (
    // ★ フルワイド (max-w-full) の管理画面レイアウト
    <main className="min-h-screen bg-slate-50 font-sans text-slate-800 p-4 md:p-8">
      
      {/* ヘッダー */}
      <header className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">HQ システム管理</h1>
          <button onClick={fetchData} className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm">
            <RefreshCw className="w-4 h-4" /> データを更新
          </button>
        </div>
        
        {/* タブナビゲーション */}
        <div className="flex gap-2 border-b border-slate-200 pb-px">
          {[
            { id: 'referrals', label: '成果承認', icon: <CheckSquare className="w-4 h-4" /> },
            { id: 'payments', label: '支払い管理', icon: <CreditCard className="w-4 h-4" /> },
            { id: 'settings', label: 'マスタ設定', icon: <Settings className="w-4 h-4" /> },
          ].map(tab => (
            <button 
              key={tab.id} 
              onClick={() => setActiveTab(tab.id as any)} 
              className={`flex items-center gap-2 px-6 py-3 font-bold text-sm rounded-t-xl transition-colors border-b-2 ${
                activeTab === tab.id 
                  ? 'bg-white text-indigo-700 border-indigo-600 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]' 
                  : 'text-slate-500 border-transparent hover:bg-slate-100 hover:text-slate-700'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      </header>

      {/* =========================================
          タブ: Referrals (成果承認)
      ========================================= */}
      {activeTab === 'referrals' && (
        <div className="animate-in fade-in duration-300">
          
          {/* バルクアクションバー */}
          <div className={`p-4 rounded-xl border mb-6 flex items-center justify-between transition-all ${selectedIds.length > 0 ? 'bg-slate-900 border-slate-800 shadow-lg' : 'bg-white border-slate-200 shadow-sm'}`}>
            <div className="flex items-center gap-4">
              <span className={`text-sm font-bold ${selectedIds.length > 0 ? 'text-white' : 'text-slate-500'}`}>一括操作 ({selectedIds.length}件選択中)</span>
              {selectedIds.length > 0 && <span className="text-xs text-slate-400">※仮計上のデータのみ選択可能</span>}
            </div>
            <button 
              onClick={handleBulkConfirm} 
              disabled={selectedIds.length === 0 || isProcessing} 
              className={`px-6 py-2 rounded-lg font-bold text-sm transition-all flex items-center gap-2 ${
                selectedIds.length > 0 
                  ? 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-md active:scale-95' 
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}
            >
              {isProcessing && selectedIds.length > 0 ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              選択項目を「報酬確定」にする
            </button>
          </div>

          {/* フルワイド・データテーブル */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider border-b border-slate-200">
                  <th className="p-4 w-12 text-center">
                    <input type="checkbox" checked={isAllSelected} onChange={handleToggleAll} disabled={referrals.filter(r => r.status === 'pending').length === 0} className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                  </th>
                  <th className="p-4">日時 / 店舗ID</th>
                  <th className="p-4">店舗・チーム名</th>
                  <th className="p-4">受注番号</th>
                  <th className="p-4 text-right">獲得予定Pt</th>
                  <th className="p-4 text-center">ステータス</th>
                  <th className="p-4 text-center">操作</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-slate-100">
                {referrals.map(ref => {
                  const shop = shops.find(s => String(s.id) === String(ref.shop_id));
                  const rank = ranks.find(r => String(r.id) === String(shop?.rank_id));
                  const status = STATUS_OPTIONS.find(s => s.value === ref.status) || STATUS_OPTIONS[0];
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
                    <tr key={ref.id} className={`hover:bg-slate-50 transition-colors ${isIssued ? 'bg-slate-50/50' : isCanceled ? 'bg-red-50/30' : ''}`}>
                      <td className="p-4 text-center">
                        <input type="checkbox" disabled={!isCheckable} checked={selectedIds.includes(ref.id)} onChange={() => handleToggleSelect(ref.id)} className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50" />
                      </td>
                      <td className="p-4">
                        <div className="text-xs text-slate-400 font-mono mb-1">{new Date(ref.created_at).toLocaleString('ja-JP')}</div>
                        <div className={`font-bold font-mono ${isIssued || isCanceled ? 'text-slate-400' : 'text-indigo-600'}`}>{ref.shop_id}</div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`font-bold ${isIssued || isCanceled ? 'text-slate-400' : 'text-slate-800'}`}>{shop?.name || '不明'}</span>
                          {!isCanceled && (
                            <span className={`text-[10px] px-2 py-0.5 rounded font-bold border ${isFirstTime ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'} ${isIssued ? 'opacity-50' : ''}`}>
                              {isFirstTime ? '初紹介！' : `${successCount}件目`}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400">{rank?.label || '未設定'}ランク</div>
                      </td>
                      <td className={`p-4 font-mono ${isIssued || isCanceled ? 'text-slate-400' : 'text-slate-700'}`}>
                        {ref.order_number}
                      </td>
                      <td className="p-4 text-right">
                        <div className={`font-black tabular-nums text-lg ${isIssued || isCanceled ? 'text-slate-400' : bonusPt > 0 ? 'text-emerald-600' : 'text-slate-800'}`}>
                          {totalPt.toLocaleString()} <span className="text-xs font-normal">pt</span>
                        </div>
                        {isFirstTime && bonusPt > 0 && !isIssued && !isCanceled && (
                          <div className="text-[10px] text-emerald-600 font-bold">※初回ボーナス込</div>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold border ${status.bgColor} ${status.color} ${status.border} ${isIssued || isCanceled ? 'opacity-60' : ''}`}>
                            {status.label}
                          </span>
                          {isCanceled && ref.cancel_reason && (
                            <span className="text-[10px] text-red-500 font-bold max-w-[120px] truncate" title={ref.cancel_reason}>{ref.cancel_reason}</span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        {isIssued ? (
                          <span className="text-xs font-bold text-slate-400 flex items-center justify-center gap-1"><CheckCircle2 className="w-4 h-4"/> 処理済</span>
                        ) : isCanceled ? (
                          <span className="text-xs font-bold text-red-400 flex items-center justify-center gap-1"><X className="w-4 h-4"/> 取消済</span>
                        ) : (
                          <button onClick={() => { setEditingRef(ref); setIsRefModalOpen(true); }} className="px-4 py-1.5 bg-white border border-slate-200 text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-50 hover:text-indigo-600 transition-colors shadow-sm active:scale-95">
                            詳細・編集
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {referrals.length === 0 && <div className="p-8 text-center text-slate-400 font-bold">データがありません</div>}
          </div>
        </div>
      )}

      {/* =========================================
          タブ: Payments (支払い管理)
      ========================================= */}
      {activeTab === 'payments' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto animate-in fade-in duration-300">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider border-b border-slate-200">
                <th className="p-4">店舗名</th>
                <th className="p-4 text-center">ステータス</th>
                <th className="p-4 text-center">紹介件数</th>
                <th className="p-4 text-right">累計報酬額</th>
                <th className="p-4 text-right">未払い額</th>
                <th className="p-4 text-right">支払い済額</th>
                <th className="p-4 text-center">操作</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-slate-100">
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

                return (
                  <tr key={shop.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 font-bold text-slate-800">{shop.name}</td>
                    <td className="p-4 text-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold border ${isAllPaid ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-emerald-100 text-emerald-700 border-emerald-200'}`}>
                        {isAllPaid ? '発行・精算済' : '報酬確定(未払)'}
                      </span>
                    </td>
                    <td className="p-4 text-center font-bold text-slate-600">{uniqueReferralCount} <span className="text-xs font-normal">件</span></td>
                    <td className="p-4 text-right">
                      <div className="font-bold text-slate-800 tabular-nums">{totalAmount.toLocaleString()} pt</div>
                      {hasBonus && <div className="text-[10px] text-emerald-600 font-bold">（初回ボーナス込）</div>}
                    </td>
                    <td className={`p-4 text-right font-black tabular-nums ${!isAllPaid ? 'text-rose-600' : 'text-slate-400'}`}>
                      {unpaidTotal.toLocaleString()} pt
                    </td>
                    <td className="p-4 text-right font-bold text-slate-500 tabular-nums">
                      {paidTotal.toLocaleString()} pt
                    </td>
                    <td className="p-4 text-center">
                      {!isAllPaid ? (
                        <button 
                          onClick={() => handlePaymentComplete(shop.id)} 
                          disabled={isProcessing}
                          className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg shadow-sm transition-all active:scale-95 flex items-center justify-center gap-1 mx-auto disabled:opacity-50"
                        >
                          {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                          支払完了にする
                        </button>
                      ) : (
                        <span className="text-xs font-bold text-slate-400 flex items-center justify-center gap-1">
                          <CheckCircle2 className="w-4 h-4" /> 処理完了
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* =========================================
          タブ: Settings (マスタ設定)
      ========================================= */}
      {activeTab === 'settings' && (
        <div className="animate-in fade-in duration-300 max-w-6xl">
          
          <h3 className="text-lg font-black text-slate-800 mb-4 border-l-4 border-indigo-500 pl-3">ランク別ポイント設定</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {editingRanks.map(rank => (
              <div key={rank.id} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                <div className="mb-4">
                  <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">ランク名</label>
                  <input type="text" value={rank.label} onChange={(e) => handleRankChange(rank.id, 'label', e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">報酬ポイント (pt)</label>
                  <input type="number" value={rank.reward_points} onChange={(e) => handleRankChange(rank.id, 'reward_points', Number(e.target.value))} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg font-black text-indigo-600 focus:ring-2 focus:ring-indigo-500 outline-none transition-all tabular-nums" />
                </div>
              </div>
            ))}
          </div>

          <h3 className="text-lg font-black text-slate-800 mb-4 border-l-4 border-amber-500 pl-3">特別報酬ルール (初回ボーナス等)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
            {editingRules.map(rule => (
              <div key={rule.id} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-amber-100 text-amber-700 text-[10px] font-black px-3 py-1 rounded-bl-lg">ID: {rule.id}</div>
                <div className="mb-4 mt-2">
                  <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">ルールの名前</label>
                  <input type="text" value={rule.label} onChange={(e) => handleRuleChange(rule.id, 'label', e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-800 focus:ring-2 focus:ring-amber-500 outline-none transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">追加付与ポイント (pt)</label>
                  <input type="number" value={rule.base_points} onChange={(e) => handleRuleChange(rule.id, 'base_points', Number(e.target.value))} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg font-black text-amber-600 focus:ring-2 focus:ring-amber-500 outline-none transition-all tabular-nums" />
                </div>
              </div>
            ))}
          </div>
          
          <div className="flex justify-end pt-6 border-t border-slate-200">
            <button 
              onClick={handleSaveAllSettings} 
              disabled={isProcessing}
              className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Settings className="w-5 h-5" />}
              すべてのマスタ設定を保存する
            </button>
          </div>
        </div>
      )}

      {/* =========================================
          モーダル: ステータス詳細・編集
      ========================================= */}
      {isRefModalOpen && editingRef && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-lg font-black text-slate-900">ステータス更新</h3>
                <p className="text-xs font-mono text-slate-500 mt-1">受注番号: {editingRef.order_number}</p>
              </div>
              <button onClick={() => setIsRefModalOpen(false)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="space-y-5 mb-8">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2">ステータス</label>
                <select 
                  value={editingRef.status} 
                  onChange={(e) => setEditingRef({...editingRef, status: e.target.value})} 
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  {STATUS_OPTIONS.filter(opt => opt.value !== 'issued').map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {/* キャンセル事由（ステータスがキャンセルの時だけ表示） */}
              {editingRef.status === 'cancel' && (
                <div className="animate-in slide-in-from-top-2 duration-200">
                  <label className="flex items-center gap-1.5 text-xs font-bold text-red-600 mb-2">
                    <AlertTriangle className="w-4 h-4" /> キャンセル事由 (必須)
                  </label>
                  <select
                    value={editingRef.cancel_reason || ''}
                    onChange={(e) => setEditingRef({...editingRef, cancel_reason: e.target.value})}
                    className="w-full px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm font-bold text-red-700 focus:ring-2 focus:ring-red-500 outline-none"
                  >
                    <option value="">事由を選択してください</option>
                    {CANCEL_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              )}

              {/* 警告メッセージ */}
              {editingRef.status === 'cancel' && (
                 <div className="bg-red-50 p-4 rounded-xl border border-red-100 flex gap-3 items-start">
                   <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                   <p className="text-xs font-bold text-red-700 leading-relaxed">
                     キャンセルを実行すると、紐づく獲得予定ポイントはすべて無効（0pt）になります。この操作は元に戻せません。
                   </p>
                 </div>
              )}
            </div>

            <div className="flex gap-3 justify-end">
              <button onClick={() => setIsRefModalOpen(false)} className="px-5 py-2.5 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors">キャンセル</button>
              <button 
                onClick={() => handleRefModalSave(editingRef)} 
                disabled={isProcessing}
                className="px-5 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all active:scale-95 shadow-md flex items-center gap-2 disabled:opacity-50"
              >
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : '更新して保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}