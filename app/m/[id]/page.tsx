'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation' // ★ useRouterを追加
import { QRCodeCanvas } from 'qrcode.react'
import { motion, AnimatePresence } from 'framer-motion'

import { 
  QrCode, Copy, MessageCircle, Wallet, Gift, Clock, History, 
  Settings, Mail, User, CheckCircle2, ShieldCheck, Loader2, Ban, 
  Edit2, Lock, X, Smartphone, Crown, LayoutDashboard, ChevronRight // ★ アイコン追加
} from 'lucide-react'

const getGradient = (name: string) => {
  const colors = [
    'from-indigo-500 to-purple-500', 'from-emerald-400 to-cyan-500', 
    'from-rose-400 to-orange-400', 'from-blue-500 to-indigo-500'
  ];
  const index = name.length % colors.length;
  return colors[index];
}

export default function MemberMagicPage() {
  const params = useParams()
  const magicToken = params.id as string 
  const router = useRouter() // ★ 追加

  const [activeTab, setActiveTab] = useState<'qr' | 'wallet' | 'settings'>('qr')
  const [loading, setLoading] = useState(true)

  const [staff, setStaff] = useState<any>(null)
  const [shop, setShop] = useState<any>(null)
  const [history, setHistory] = useState<any[]>([])
  const [summary, setSummary] = useState({ total: 0, pending: 0, paid: 0 })

  const [copied, setCopied] = useState(false)

  const [isEditMode, setIsEditMode] = useState(false)
  const [showPinModal, setShowPinModal] = useState(false)
  const [pin, setPin] = useState(['', '', '', '']) 
  const [pinError, setPinError] = useState(false)
  const pinInputRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)]

  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const referralUrl = staff ? `${typeof window !== 'undefined' ? window.location.origin : ''}/welcome/${staff.referral_code}` : ''
  
  // ★ 追加：このユーザーがオーナーかどうかを判定
  const isOwner = shop?.owner_email === staff?.email

  useEffect(() => {
    const fetchMemberData = async () => {
      const { data: staffData, error } = await supabase.from('staffs').select('*').eq('secret_token', magicToken).single()
      if (error || !staffData) { setLoading(false); return; }

      const { data: shopData } = await supabase.from('shops').select('*').eq('id', staffData.shop_id).single()

      const [refRes, txRes] = await Promise.all([
        supabase.from('referrals').select('*').eq('staff_id', staffData.id).order('created_at', { ascending: false }),
        supabase.from('point_transactions').select('*').eq('shop_id', staffData.shop_id)
      ])

      const referrals = refRes.data || []
      const pointLogs = txRes.data || []

      const enriched = referrals.map(r => {
        const txs = pointLogs.filter(tx => tx.referral_id === r.id)
        const totalPt = txs.reduce((sum, tx) => sum + (Number(tx.points) || 0), 0)
        return { ...r, totalPt }
      })

      setStaff(staffData)
      setEditName(staffData.name)
      setEditEmail(staffData.email)
      setShop(shopData)
      setHistory(enriched)

      setSummary({ 
        total: enriched.filter(r => r.is_staff_rewarded || r.status === 'issued').reduce((sum, r) => sum + r.totalPt, 0), 
        pending: enriched.filter(r => r.status === 'pending' || r.status === 'confirmed').length, 
        paid: enriched.filter(r => r.is_staff_rewarded).reduce((sum, r) => sum + r.totalPt, 0) 
      })
      setLoading(false)
    }

    if (magicToken) fetchMemberData()
  }, [magicToken])

  const handleCopy = () => {
    navigator.clipboard.writeText(referralUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handlePinChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return; 
    
    const newPin = [...pin]
    newPin[index] = value.slice(-1) 
    setPin(newPin)
    setPinError(false)

    if (value && index < 3) {
      pinInputRefs[index + 1].current?.focus()
    }

    if (index === 3 && value) {
      const enteredPin = newPin.join('')
      
      if (!staff.security_pin || enteredPin === staff.security_pin) { 
        setTimeout(() => {
          setShowPinModal(false)
          setIsEditMode(true)
          setPin(['', '', '', ''])
        }, 300)
      } else {
        setPinError(true)
        setTimeout(() => setPin(['', '', '', '']), 500) 
        pinInputRefs[0].current?.focus()
      }
    }
  }

  const handlePinKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      pinInputRefs[index - 1].current?.focus()
    }
  }

  const handleSaveProfile = async () => {
    setIsSaving(true)
    await supabase.from('staffs').update({ name: editName, email: editEmail }).eq('id', staff.id)
    setStaff({ ...staff, name: editName, email: editEmail })
    setIsSaving(false)
    setIsEditMode(false) 
  }

  if (loading) return <div className="fixed inset-0 flex items-center justify-center bg-gray-50"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>
  if (!staff) return <div className="fixed inset-0 flex items-center justify-center bg-gray-50 text-gray-500">ページが見つかりません。</div>

  return (
    <div className="fixed inset-0 bg-gray-50 flex flex-col font-sans text-gray-800 overflow-hidden selection:bg-indigo-100 selection:text-indigo-900">
      
      <header className="bg-white px-6 pt-safe-top pb-4 border-b border-gray-100 flex items-center justify-between shadow-sm z-20">
        <div className="flex items-center gap-3 mt-4">
          <div className={`w-10 h-10 rounded-full bg-gradient-to-tr ${getGradient(staff.name)} flex items-center justify-center text-white font-bold text-lg shadow-sm border-2 border-white ring-2 ring-gray-50`}>
            {staff.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{shop?.name}</p>
            <h1 className="text-sm font-extrabold text-gray-900">{staff.name} <span className="text-xs font-medium text-gray-500">の専用ページ</span></h1>
          </div>
        </div>
      </header>

      <main className="flex-1 relative overflow-hidden bg-gray-50/50">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="absolute inset-0 overflow-y-auto pb-32 pt-6 px-6 -webkit-overflow-scrolling-touch"
          >
            
            {/* 📱 TAB 1: QRコード */}
            {activeTab === 'qr' && (
              <div className="flex flex-col items-center max-w-sm mx-auto h-full">
                 <div className="w-full bg-white p-8 rounded-[2.5rem] shadow-xl border border-gray-100 flex flex-col items-center relative overflow-hidden mb-6">
                  
                  {/* ★ 変更点1: 注意書き削除 & パディング(p-6)・サイズ(190)調整で角の欠けを防止 */}
                  <div className="p-6 bg-white rounded-[2rem] shadow-lg border-4 border-indigo-50/80 mb-6 flex items-center justify-center">
                    <QRCodeCanvas value={referralUrl} size={190} level={"H"} fgColor="#1e1b4b" />
                  </div>
                  
                  <p className="text-base font-mono font-black text-gray-800 tracking-wider bg-gray-50 px-6 py-2 rounded-xl border border-gray-100">
                    {staff.referral_code}
                  </p>
                </div>
                <div className="w-full space-y-3">
                  <button onClick={handleCopy} className={`w-full py-4 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 active:scale-95 shadow-sm ${copied ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'}`}>
                    {copied ? <CheckCircle2 className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                    {copied ? 'URLをコピーしました！' : '紹介用URLをコピー'}
                  </button>
                </div>
              </div>
            )}

            {/* 📊 TAB 2: ウォレット */}
            {activeTab === 'wallet' && (
               <div className="max-w-md mx-auto space-y-6">
                 {/* サマリーカード */}
                 <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 text-white p-6 rounded-[2rem] shadow-xl shadow-indigo-200 relative overflow-hidden">
                   <div className="absolute top-0 right-0 p-4 opacity-10"><Wallet className="w-24 h-24" /></div>
                   <p className="text-[11px] font-bold opacity-80 mb-1 flex items-center gap-1"><Gift className="w-4 h-4"/> 累計獲得ポイント</p>
                   <p className="text-4xl font-black tabular-nums tracking-tight mb-4">{summary.total.toLocaleString()}<span className="text-sm ml-1 font-medium opacity-80">pt</span></p>

                   <div className="flex gap-6 border-t border-white/20 pt-4">
                     <div>
                       <p className="text-[10px] opacity-80 mb-0.5">確定・発行待ち</p>
                       <p className="text-lg font-bold tabular-nums">{summary.pending} <span className="text-[10px] font-normal">件</span></p>
                     </div>
                     <div>
                       <p className="text-[10px] opacity-80 mb-0.5">清算済</p>
                       <p className="text-lg font-bold tabular-nums">{summary.paid.toLocaleString()} <span className="text-[10px] font-normal">pt</span></p>
                     </div>
                   </div>
                 </div>

                 {/* 履歴リスト */}
                 <div>
                   <h3 className="text-sm font-extrabold text-gray-900 mb-4 flex items-center gap-2">
                     <History className="w-5 h-5 text-indigo-500" /> アクション履歴
                   </h3>
                   <div className="space-y-3">
                     {history.length === 0 ? (
                       <div className="bg-white rounded-2xl p-8 text-center border border-gray-100 shadow-sm">
                         <MessageCircle className="w-8 h-8 text-gray-300 mx-auto mb-3" />
                         <p className="text-sm font-bold text-gray-500">まだ紹介実績がありません</p>
                         <p className="text-xs text-gray-400 mt-1">QRコードをお客様に提示しましょう！</p>
                       </div>
                     ) : (
                       history.map((item, i) => {
                         const isCanceled = item.status === 'cancel';
                         const isPaid = item.is_staff_rewarded;
                         return (
                           <motion.div initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} transition={{ delay: i*0.05 }} key={item.id} className={`bg-white p-4 rounded-2xl border flex items-center justify-between shadow-sm ${isCanceled ? 'border-red-100 bg-red-50/30' : 'border-gray-100'}`}>
                              <div>
                                <p className="text-[10px] font-bold text-gray-400 mb-1">{new Date(item.created_at).toLocaleDateString('ja-JP')} {new Date(item.created_at).toLocaleTimeString('ja-JP', {hour:'2-digit', minute:'2-digit'})}</p>
                                <div className="flex items-center gap-2">
                                  {isCanceled ? (
                                    <span className="text-[10px] font-bold bg-red-100 text-red-600 px-2 py-0.5 rounded-full border border-red-200">キャンセル</span>
                                  ) : isPaid ? (
                                    <span className="text-[10px] font-bold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full border border-gray-200">清算済</span>
                                  ) : item.status === 'confirmed' ? (
                                    <span className="text-[10px] font-bold bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full border border-emerald-200">確定</span>
                                  ) : item.status === 'issued' ? (
                                    <span className="text-[10px] font-bold bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full border border-blue-200">発行済(未清算)</span>
                                  ) : (
                                    <span className="text-[10px] font-bold bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full border border-amber-200">仮計上</span>
                                  )}
                                  <span className="text-xs font-bold text-gray-700">ID: {item.order_number || '---'}</span>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className={`text-lg font-black tabular-nums ${isCanceled ? 'text-gray-400 line-through' : isPaid ? 'text-gray-400' : 'text-indigo-600'}`}>
                                  +{item.totalPt.toLocaleString()}<span className="text-[10px] ml-0.5">pt</span>
                                </p>
                              </div>
                           </motion.div>
                         )
                       })
                     )}
                   </div>
                 </div>
               </div>
            )}

            {/* ⚙️ TAB 3: 設定 */}
            {activeTab === 'settings' && (
              <div className="max-w-md mx-auto">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
                    <Settings className="w-5 h-5 text-indigo-500" /> アカウント情報
                  </h2>
                  
                  {!isEditMode ? (
                    <button 
                      onClick={() => setShowPinModal(true)} 
                      className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-full text-xs font-bold shadow-sm flex items-center gap-1.5 hover:bg-gray-50 transition-all active:scale-95"
                    >
                      <Lock className="w-3 h-3 text-gray-400" /> 編集する
                    </button>
                  ) : (
                    <button 
                      onClick={() => { setIsEditMode(false); setEditName(staff.name); setEditEmail(staff.email); }} 
                      className="px-4 py-2 bg-gray-100 text-gray-500 rounded-full text-xs font-bold hover:bg-gray-200 transition-all"
                    >
                      キャンセル
                    </button>
                  )}
                </div>

                <div className="bg-white rounded-[2rem] shadow-xl shadow-gray-200/40 border border-gray-100 overflow-hidden">
                  
                  {/* アバター表示領域 */}
                  <div className="p-6 border-b border-gray-50 flex items-center gap-4 bg-gray-50/50">
                    <div className={`w-16 h-16 rounded-full bg-gradient-to-tr ${getGradient(staff.name)} flex items-center justify-center text-white font-black text-2xl shadow-inner border-4 border-white`}>
                      {staff.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-lg font-black text-gray-900">{staff.name}</p>
                      <p className="text-xs text-gray-400 font-medium mt-0.5">ID: {staff.referral_code}</p>
                    </div>
                  </div>

                  {/* 情報エリア */}
                  <div className="p-6 space-y-6">
                    <div>
                      <label className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 mb-2 uppercase tracking-wider">
                        <User className="w-3.5 h-3.5" /> 表示名
                      </label>
                      {!isEditMode ? (
                        <p className="text-base font-bold text-gray-800 px-1">{staff.name}</p>
                      ) : (
                        <input 
                          type="text" value={editName} onChange={e => setEditName(e.target.value)}
                          className="w-full bg-indigo-50/50 border border-indigo-100 rounded-xl px-4 py-3 text-sm font-bold text-indigo-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                        />
                      )}
                    </div>

                    <div className="h-px bg-gray-100" />

                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <label className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                          <Mail className="w-3.5 h-3.5" /> メールアドレス
                        </label>
                        {isEditMode && <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded flex items-center gap-1"><ShieldCheck className="w-3 h-3"/> 安全な接続</span>}
                      </div>
                      
                      {!isEditMode ? (
                        <p className="text-sm font-medium text-gray-600 px-1">{staff.email}</p>
                      ) : (
                        <input 
                          type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)}
                          className="w-full bg-indigo-50/50 border border-indigo-100 rounded-xl px-4 py-3 text-sm font-medium text-indigo-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                        />
                      )}
                    </div>
                  </div>

                  {/* 保存ボタン */}
                  <AnimatePresence>
                    {isEditMode && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        className="p-6 pt-0 border-t border-gray-50 bg-gray-50/30"
                      >
                        <button 
                          onClick={handleSaveProfile} disabled={isSaving || (editName === staff.name && editEmail === staff.email)}
                          className="w-full mt-6 py-4 bg-indigo-600 text-white rounded-xl text-sm font-bold disabled:opacity-50 transition-all shadow-lg active:scale-95 flex justify-center items-center gap-2"
                        >
                          {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : '変更を保存する'}
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                
                {!isEditMode && (
                  <p className="text-[10px] text-gray-400 text-center mt-6 mb-2">
                    セキュリティのため、情報の変更には<br/>登録時に設定した4桁のPINコードが必要です。
                  </p>
                )}

                {/* ★ 変更点3: オーナー専用メニュー */}
                {isOwner && !isEditMode && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-8 bg-indigo-50 border border-indigo-100 rounded-[2rem] p-6 shadow-sm">
                    <h3 className="text-xs font-black text-indigo-800 mb-4 flex items-center gap-2">
                      <Crown className="w-4 h-4 text-amber-500" /> オーナー専用メニュー
                    </h3>
                    <div className="space-y-3">
                      <button 
                        onClick={() => router.push('/dashboard')}
                        className="w-full py-4 bg-white text-indigo-700 font-bold rounded-xl shadow-sm flex items-center justify-between px-5 active:scale-95 transition-all hover:bg-gray-50 border border-indigo-100/50"
                      >
                        <span className="flex items-center gap-2"><LayoutDashboard className="w-4 h-4"/> 管理ダッシュボードを開く</span>
                        <ChevronRight className="w-4 h-4 text-indigo-300" />
                      </button>
                    </div>
                  </motion.div>
                )}

              </div>
            )}
            
          </motion.div>
        </AnimatePresence>
      </main>

      {/* --- PIN入力モーダル --- */}
      <AnimatePresence>
        {showPinModal && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              className="bg-white rounded-[2rem] p-8 w-full max-w-sm shadow-2xl relative overflow-hidden"
            >
              <button onClick={() => { setShowPinModal(false); setPin(['','','','']); setPinError(false); }} className="absolute top-4 right-4 p-2 text-gray-400 hover:bg-gray-100 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
              
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-indigo-100">
                  <Lock className="w-8 h-8 text-indigo-600" />
                </div>
                <h3 className="text-xl font-black text-gray-900 mb-2">セキュリティロック</h3>
                <p className="text-xs text-gray-500">アカウント情報を編集するには、<br/>4桁のPINコードを入力してください。</p>
              </div>

              <div className={`flex justify-center gap-3 mb-8 ${pinError ? 'animate-[shake_0.5s_ease-in-out]' : ''}`}>
                {pin.map((digit, index) => (
                  <input
                    key={index}
                    ref={pinInputRefs[index]}
                    type="password"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handlePinChange(index, e.target.value)}
                    onKeyDown={(e) => handlePinKeyDown(index, e)}
                    className={`w-14 h-16 text-center text-2xl font-black rounded-xl border-2 outline-none transition-all ${
                      pinError ? 'border-red-400 bg-red-50 text-red-600' : 
                      digit ? 'border-indigo-600 bg-indigo-50 text-indigo-900' : 'border-gray-200 bg-white focus:border-indigo-400 focus:bg-indigo-50/30'
                    }`}
                  />
                ))}
              </div>
              
              {pinError && <p className="text-center text-xs font-bold text-red-500 -mt-4 mb-4">PINコードが間違っています</p>}
              
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <nav className="bg-white border-t border-gray-100 px-6 py-2 flex justify-between items-center z-50 pb-safe shadow-[0_-10px_40px_rgba(0,0,0,0.03)] relative">
        <button onClick={() => setActiveTab('wallet')} className={`flex flex-col items-center gap-1 flex-1 py-2 transition-colors ${activeTab === 'wallet' ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}>
          <Wallet className={`w-6 h-6 transition-transform ${activeTab === 'wallet' ? 'scale-110' : ''}`} />
          <span className="text-[10px] font-bold">実績</span>
        </button>
        <div className="relative -mt-8 px-2">
          <button onClick={() => setActiveTab('qr')} className={`p-4 rounded-full shadow-xl border-4 border-gray-50 transition-all active:scale-95 ${activeTab === 'qr' ? 'bg-indigo-600 text-white shadow-indigo-200' : 'bg-gray-900 text-white'}`}>
            <QrCode className="w-7 h-7" />
          </button>
        </div>
        <button onClick={() => setActiveTab('settings')} className={`flex flex-col items-center gap-1 flex-1 py-2 transition-colors ${activeTab === 'settings' ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}>
          <Settings className={`w-6 h-6 transition-transform ${activeTab === 'settings' ? 'scale-110' : ''}`} />
          <span className="text-[10px] font-bold">設定</span>
        </button>
      </nav>
      
    </div>
  )
}