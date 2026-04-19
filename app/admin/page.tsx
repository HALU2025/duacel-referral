'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { 
  RefreshCw, Loader2, Search, Filter, AlertTriangle, X, Plus, Download, Link as LinkIcon,
  BarChart3, Users, Store, Gift, Settings, ChevronRight, ChevronDown,
  Building, User, Info, LogOut, Shield, Edit2, CheckCircle2, Copy 
} from 'lucide-react'
// ... (中略: 他のインポートや定数は以前のコードを維持)

// アイコンを成果らしい BarChart3 に統一
const PAGE_TITLES: Record<string, { label: string, icon: any }> = {
  referrals: { label: '成果一覧', icon: <BarChart3 className="w-5 h-5" /> },
  redemptions: { label: 'ポイント交換管理', icon: <Gift className="w-4 h-4" /> },
  users: { label: 'ユーザー・店舗管理', icon: <Users className="w-4 h-4" /> },
  settings: { label: 'ポイント設定', icon: <Settings className="w-4 h-4" /> },
  admins: { label: '管理者設定', icon: <Shield className="w-4 h-4" /> }
}

export default function AdminDashboard() {
  // ... (中略: ステート管理やデータ取得ロジックは維持)

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans flex flex-col md:flex-row">
      
      {/* サイドナビゲーション */}
      <aside className="w-full md:w-64 bg-white border-r border-gray-200 shadow-sm md:min-h-screen flex flex-col shrink-0">
        <div className="px-6 py-4 flex items-center gap-3 border-b border-gray-200">
          <img src="/logo-duacel.svg" alt="Duacel" className="h-6 w-auto" onError={(e) => e.currentTarget.style.display = 'none'} />
          <span className="text-base font-bold tracking-wider text-gray-900">Duacel Pro</span>
        </div>
        
        <nav className="flex md:flex-col gap-1 p-4 overflow-x-auto md:overflow-x-visible">
          {Object.entries(PAGE_TITLES).map(([id, item]) => (
            <button 
              key={id} 
              onClick={() => setActiveTab(id as any)} 
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${activeTab === id ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}
            >
              {item.icon} {item.label}
            </button>
          ))}
        </nav>
        {/* ... (ログアウトボタン等は維持) */}
      </aside>

      {/* メインコンテンツ */}
      <div className="flex-1 p-4 md:p-8 overflow-x-auto w-full">
        <div className="mb-6 flex justify-between items-center">
          {/* タイトルを20px相当(text-xl)に設定しアイコンを配置 */}
          <div className="flex items-center gap-2">
            <span className="text-gray-900">{PAGE_TITLES[activeTab].icon}</span>
            <h1 className="text-xl font-black text-gray-900">{PAGE_TITLES[activeTab].label}</h1>
          </div>
          {isProcessing && <span className="flex items-center gap-2 text-sm text-blue-600 font-bold bg-blue-50 px-3 py-1 rounded-full"><Loader2 className="w-4 h-4 animate-spin"/> 処理中...</span>}
        </div>

        {/* 成果一覧タブ */}
        {activeTab === 'referrals' && (
          <div>
            {/* 検索フィルター (維持) */}
            {/* ... */}

            {/* 一覧上部のサマリー */}
            <div className="flex justify-between items-center mb-2 px-1">
              <div className="text-sm font-bold text-black">検索結果 {filteredReferrals.length} 件該当しました</div>
              <div className="text-sm font-bold text-black">総獲得ポイント {totalFilteredPoints.toLocaleString()} pt</div>
            </div>
            <hr className="mb-4 border-gray-300" />

            <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto shadow-sm">
              <table className="w-full text-left border-collapse whitespace-nowrap">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-black text-sm tracking-wider">
                    <th className="p-4 font-bold">発生日時</th>
                    <th className="p-4 font-bold">受注番号</th>
                    <th className="p-4 font-bold">ステータス</th>
                    <th className="p-4 font-bold">店舗名</th>
                    <th className="p-4 font-bold">店舗コード</th>
                    <th className="p-4 font-bold">担当スタッフ・顧客情報</th>
                    <th className="p-4 font-bold">獲得Pt</th>
                    <th className="p-4 font-bold text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm text-black font-medium">
                  {filteredReferrals.map(ref => {
                    const shop = getShopByShopId(ref.shop_id);
                    const staff = staffs.find(s => s.id === ref.staff_id);
                    const status = REF_STATUS_OPTIONS.find(s => s.value === ref.status) || REF_STATUS_OPTIONS[0];
                    const totalPt = getReferralPoints(ref);

                    return (
                      <tr key={ref.id} className="hover:bg-blue-50/30 transition-colors">
                        <td className="p-4">{new Date(ref.created_at).toLocaleString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                        <td className="p-4">{ref.order_number}</td>
                        <td className="p-4">
                          <span className={`px-2.5 py-1 rounded-md text-sm border ${status.bgColor} ${status.color} ${status.border} font-bold inline-flex items-center justify-center min-w-[70px]`}>
                            {status.label}
                          </span>
                        </td>
                        <td className="p-4">{shop?.name || '不明'}</td>
                        <td className="p-4 font-mono">{shop?.shop_number || '-'}</td>
                        <td className="p-4">
                          {staff?.name || '不明'} {ref.customer_name ? `/ ${ref.customer_name} 様 (${ref.recurring_count > 1 ? `定期${ref.recurring_count}回目` : '初回'})` : ''}
                        </td>
                        <td className="p-4 font-bold">{totalPt.toLocaleString()}</td>
                        <td className="p-4 text-right">
                          <button onClick={() => { setEditingRef({...ref, total_points: totalPt}); setIsRefModalOpen(true); }} className="text-blue-600 hover:text-blue-800 font-bold text-sm bg-blue-50 px-3 py-1.5 rounded-lg transition-colors">
                            詳細・編集
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ... (他のタブの内容は維持) */}
      </div>

      {/* 詳細情報・全項目編集モーダル */}
      {isRefModalOpen && editingRef && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl p-6 w-full max-w-xl shadow-2xl my-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-black text-gray-900">詳細情報・成果編集</h3>
              <button onClick={() => setIsRefModalOpen(false)} className="text-gray-400 hover:bg-gray-100 p-2 rounded-full transition-colors"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="bg-gray-50 border border-gray-200 p-5 rounded-xl text-sm mb-6 space-y-4 text-black font-medium">
              
              <div className="grid grid-cols-3 gap-3 items-center border-b border-gray-200 pb-2">
                <label className="text-gray-500 text-sm font-bold">発生日時</label>
                <div className="col-span-2 text-black text-sm font-mono">{new Date(editingRef.created_at).toLocaleString('ja-JP')}</div>
              </div>

              <div className="grid grid-cols-3 gap-3 items-center border-b border-gray-200 pb-2">
                <label className="text-gray-500 text-sm font-bold">受注番号</label>
                <div className="col-span-2 text-black text-sm font-mono">{editingRef.order_number || '-'}</div>
              </div>

              <div className="grid grid-cols-3 gap-3 items-center border-b border-gray-200 pb-2">
                <label className="text-gray-500 text-sm font-bold">顧客名 / 回数</label>
                <div className="col-span-2 text-black text-sm">
                  {editingRef.customer_name || '不明'} 
                  <span className="ml-2 px-2 py-0.5 bg-gray-200 rounded text-xs">{editingRef.recurring_count || 1}回目</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 items-center border-b border-gray-200 pb-2">
                <label className="text-gray-500 text-sm font-bold">店舗名 / コード</label>
                <div className="col-span-2 text-black text-sm">
                  {getShopByShopId(editingRef.shop_id)?.name || '不明'} 
                  <span className="ml-2 font-mono text-gray-400">No.{getShopByShopId(editingRef.shop_id)?.shop_number}</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 items-center border-b border-gray-200 pb-2">
                <label className="text-gray-500 text-sm font-bold">担当スタッフ</label>
                <div className="col-span-2 text-black text-sm">
                  {staffs.find(s => s.id === editingRef.staff_id)?.name || '不明'}
                </div>
              </div>

              {/* 追加: 紹介URL (読取専用) */}
              <div className="grid grid-cols-3 gap-3 items-start border-b border-gray-200 pb-2">
                <label className="text-gray-500 text-sm font-bold">紹介URL</label>
                <div className="col-span-2">
                  <div className="flex items-center gap-2 text-blue-600 text-xs break-all bg-white p-2 border border-gray-200 rounded">
                    <span>https://duacel.net/welcome/ref_{staffs.find(s => s.id === editingRef.staff_id)?.referral_code}</span>
                    <button onClick={() => {
                      navigator.clipboard.writeText(`https://duacel.net/welcome/ref_${staffs.find(s => s.id === editingRef.staff_id)?.referral_code}`);
                      alert('URLをコピーしました');
                    }} className="shrink-0 text-gray-400 hover:text-blue-600"><Copy className="w-3 h-3"/></button>
                  </div>
                </div>
              </div>

              {/* 編集可能: 獲得ポイント */}
              <div className="grid grid-cols-3 gap-3 items-center">
                <label className="text-black text-sm font-bold">獲得ポイント</label>
                <div className="col-span-2 flex items-center gap-2">
                  <input 
                    type="number"
                    className="border border-gray-300 p-2 rounded w-full text-black text-sm font-mono outline-none focus:ring-2 focus:ring-blue-100 bg-white" 
                    value={editingRef.total_points || 0} 
                    onChange={(e) => setEditingRef({...editingRef, total_points: Number(e.target.value)})} 
                  />
                  <span className="text-black text-sm">pt</span>
                </div>
              </div>

            </div>

            {/* 編集可能: ステータス更新 */}
            <div className="space-y-4 mb-8">
              <div>
                <label className="block text-sm text-black mb-2 font-bold">ステータス更新</label>
                <select 
                  value={editingRef.status} 
                  onChange={(e) => setEditingRef({...editingRef, status: e.target.value})} 
                  className="w-full border border-gray-300 rounded-lg p-3 text-sm font-bold outline-none bg-white focus:ring-2 focus:ring-blue-100"
                >
                  <option value="pending">仮計上</option>
                  <option value="confirmed">報酬確定</option>
                  <option value="cancel">キャンセル (没収)</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <button onClick={() => setIsRefModalOpen(false)} className="px-5 py-2.5 font-bold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">閉じる</button>
              <button onClick={() => handleRefModalSave(editingRef)} disabled={isProcessing} className="px-5 py-2.5 bg-gray-900 text-white font-bold rounded-lg hover:bg-black disabled:opacity-50 transition-colors flex items-center gap-2">
                {isProcessing && <Loader2 className="w-4 h-4 animate-spin"/>} 更新を保存
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* ... (店舗編集モーダル等は維持) */}
    </div>
  )
}