'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import { QRCodeCanvas } from 'qrcode.react'
import { motion, AnimatePresence } from 'framer-motion' 

import { 
  QrCode, Copy, MessageCircle, Wallet, Gift, Clock, History, 
  Settings, Mail, User, CheckCircle2, Ban, CheckCheck, ChevronRight, 
  Share, UserPlus, LayoutDashboard, Crown, Edit2, Loader2, Link as LinkIcon, 
  Trash2, Store, CreditCard, Send, LogOut, Info, ShoppingBag, BookOpen, 
  Sparkles, PlayCircle, ShieldCheck, X, Lock, JapaneseYen, Percent,
  Handshake, ClipboardList, Users
} from 'lucide-react'

const getGradient = (name: string) => {
  const colors = ['from-indigo-500 to-purple-500', 'from-emerald-400 to-cyan-500', 'from-rose-400 to-orange-400', 'from-blue-500 to-indigo-500'];
  return colors[name.length % colors.length];
}

const generateSecureToken = () => {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export default function MemberMagicPage() {
  const params = useParams()
  const magicToken = params.id as string 
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  
  // ★ ページ全体のロック・セッション管理
  const [isUnlocked, setIsUnlocked] = useState(false)
  const [pin, setPin] = useState(['', '', '', '']) 
  const [pinError, setPinError] = useState(false)
  const pinInputRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)]

  const MAX_ATTEMPTS = 5
  const LOCKOUT_MINUTES = 15
  const [attemptsLeft, setAttemptsLeft] = useState(MAX_ATTEMPTS)
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null)

  const [isForgotPinOpen, setIsForgotPinOpen] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [isResetting, setIsResetting] = useState(false)
  const [resetResult, setResetResult] = useState<{success?: boolean, message: string} | null>(null)

  // ★ メインコンテンツ用ステート (5つのタブ)
  const [activeTab, setActiveTab] = useState<'stats' | 'qr' | 'info' | 'shop' | 'settings'>('stats')
  const [staff, setStaff] = useState<any>(null)
  const [shop, setShop] = useState<any>(null)
  const [history, setHistory] = useState<any[]>([])
  const [summary, setSummary] = useState({ total: 0, pending: 0, confirmed: 0, paid: 0 })

  const [copied, setCopied] = useState(false)
  const [isInviteQrOpen, setIsInviteQrOpen] = useState(false) 
  
  // プロフィール・PIN編集用ステート
  const [isEditMode, setIsEditMode] = useState(false) 
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [currentPinInput, setCurrentPinInput] = useState('') 
  const [newPinInput, setNewPinInput] = useState('')         
  const [profileError, setProfileError] = useState('')       
  const [isSaving, setIsSaving] = useState(false)

  // ★ えらべるPay交換用ステート
  const [isExchangeModalOpen, setIsExchangeModalOpen] = useState(false)
  const [exchangeType, setExchangeType] = useState<'all' | 'custom'>('all')
  const [exchangeAmount, setExchangeAmount] = useState('')
  const [isExchanging, setIsExchanging] = useState(false)

  // ★ SHOP（仕入れ）用ダミーデータ
  const MOCK_PRODUCTS = [
    { id: 1, name: 'Duacel スカルプセラム (店販用)', price: 8800, ptPrice: 8000, icon: <Sparkles className="w-6 h-6 text-gray-400" /> },
    { id: 2, name: '専用導入機器 (Proモデル)', price: 45000, ptPrice: 42000, icon: <ShieldCheck className="w-6 h-6 text-gray-400" /> },
    { id: 3, name: '店販用パンフレット (100部セット)', price: 2000, ptPrice: 2000, icon: <BookOpen className="w-6 h-6 text-gray-400" /> },
  ]

  const referralUrl = staff ? `${typeof window !== 'undefined' ? window.location.origin : ''}/welcome/${staff.referral_code}` : ''
  const isOwner = shop?.owner_email === staff?.email

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const locked = localStorage.getItem(`duacel_lockout_${magicToken}`)
      if (locked && parseInt(locked) > Date.now()) {
        setLockoutUntil(parseInt(locked))
      } else if (locked) {
        localStorage.removeItem(`duacel_lockout_${magicToken}`)
        setAttemptsLeft(MAX_ATTEMPTS)
      }
      if (sessionStorage.getItem(`duacel_auth_${magicToken}`) === 'true') {
        setIsUnlocked(true)
      }
    }
  }, [magicToken])

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true)
    const { data: staffData, error } = await supabase.from('staffs').select('*').eq('secret_token', magicToken).single()
    if (error || !staffData) { if(!silent) setLoading(false); return; }

    const { data: shopData } = await supabase.from('shops').select('*, shop_categories(*)').eq('id', staffData.shop_id).single()

    const [refRes, txRes, staffCountRes] = await Promise.all([
      supabase.from('referrals').select('*').eq('shop_id', staffData.shop_id).order('created_at', { ascending: true }),
      supabase.from('point_transactions').select('*').eq('shop_id', staffData.shop_id), 
      supabase.from('staffs').select('id', { count: 'exact' }).eq('shop_id', staffData.shop_id).eq('is_deleted', false)
    ])

    const allReferrals = refRes.data || []
    const pointLogs = txRes.data || []
    const activeStaffCount = staffCountRes.count || 1

    const category = shopData.shop_categories;
    const basePointsDefault = category?.reward_points || 0;
    const firstBonusEnabled = category?.first_bonus_enabled || false;
    const firstBonusPoints = category?.first_bonus_points || 0;

    const shopHasBonusTx = pointLogs.some(tx => tx.metadata?.is_bonus === true);
    const myReferrals: any[] = [];
    let sTotal = 0; let sPending = 0; let sConfirmed = 0; let sPaid = 0;

    const isMeEligible = staffData.is_team_pool_eligible !== false;

    allReferrals.forEach((r, index) => {
      const isMine = r.staff_id === staffData.id;
      const refTxs = pointLogs.filter(tx => tx.referral_id === r.id && (tx.status === 'confirmed' || tx.status === 'paid'));
      const isCanceled = r.status === 'cancel';
      const isOldest = index === 0;
      const isFirstTime = !isCanceled && (refTxs.length > 0 ? refTxs.some(tx => tx.metadata?.is_bonus) : (!shopHasBonusTx && isOldest));
      const basePoints = basePointsDefault + (isFirstTime && firstBonusEnabled ? firstBonusPoints : 0);

      const isOwnerAction = shopData.owner_email === staffData.email;
      let myEarnedPoints = 0;
      
      const actualTxPoints = refTxs.reduce((sum, tx) => sum + (Number(tx.points) || 0), 0);
      const totalBase = r.status === 'pending' ? basePoints : actualTxPoints;

      // ★ スナップショット比率を利用（なければ現在の店舗設定）
      const ratioInd = r.snapshot_ratio_individual ?? (shopData.ratio_individual ?? 100);
      const ratioTeam = r.snapshot_ratio_team ?? (shopData.ratio_team ?? 0);
      const ratioOwner = r.snapshot_ratio_owner ?? (shopData.ratio_owner ?? 0);

      const indPart = isMine ? totalBase * (ratioInd / 100) : 0;
      const teamPart = isMeEligible ? (totalBase * (ratioTeam / 100)) / activeStaffCount : 0;
      const ownerPart = isOwnerAction ? totalBase * (ratioOwner / 100) : 0;
      myEarnedPoints = Math.floor(indPart + teamPart + ownerPart);

      if (myEarnedPoints > 0) {
        // ★ バグ修正：足りていなかった内訳用の変数（totalGeneratedなど）を一緒に配列にプッシュする
        myReferrals.push({ 
          ...r, 
          totalPt: isCanceled ? 0 : myEarnedPoints, 
          myIndPart: isCanceled ? 0 : Math.floor(indPart),
          myTeamPart: isCanceled ? 0 : Math.floor(teamPart),
          totalGenerated: totalBase,
          snapshot_ratio_individual: ratioInd,
          snapshot_ratio_team: ratioTeam,
          snapshot_ratio_owner: ratioOwner,
          isMine, 
          hasBonus: isFirstTime && firstBonusEnabled && isMine 
        });

        if (!isCanceled) {
          if (r.is_staff_rewarded || r.status === 'issued') {
            sTotal += myEarnedPoints;
            if (r.is_staff_rewarded) sPaid += myEarnedPoints;
            if (!r.is_staff_rewarded && r.status === 'issued') sConfirmed += myEarnedPoints;
          }
          if (r.status === 'pending' || r.status === 'confirmed') {
            if (r.status === 'confirmed') sConfirmed += myEarnedPoints; else sPending += myEarnedPoints; 
          }
        }
      }
    });

    setStaff(staffData)
    setEditName(staffData.name)
    setEditEmail(staffData.email)
    setShop(shopData)
    setHistory(myReferrals.reverse()) // 新しい順にする
    setSummary({ total: sTotal + sConfirmed, pending: sPending, confirmed: sConfirmed, paid: sPaid })
    if(!silent) setLoading(false)
  }

  useEffect(() => { if (magicToken) loadData() }, [magicToken])

  const handleCopy = (url: string, type: 'referral' | 'invite' | 'gift' = 'referral') => {
    navigator.clipboard.writeText(url)
    if (type === 'referral') { setCopied(true); setTimeout(() => setCopied(false), 2000) }
    else { alert(type === 'gift' ? 'ギフトURLをコピーしました！' : '招待用URLをコピーしました！') }
  }

  // ★ PIN関連の処理
  const handlePinChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return; 
    const newPin = [...pin]; newPin[index] = value.slice(-1); setPin(newPin); setPinError(false);

    if (value && index < 3) pinInputRefs[index + 1].current?.focus()
    if (index === 3 && value) {
      const enteredPin = newPin.join('')
      if (!staff.security_pin || enteredPin === staff.security_pin) { 
        sessionStorage.setItem(`duacel_auth_${magicToken}`, 'true')
        setAttemptsLeft(MAX_ATTEMPTS)
        setTimeout(() => setIsUnlocked(true), 300)
      } else {
        const newAttempts = attemptsLeft - 1; setAttemptsLeft(newAttempts)
        if (newAttempts <= 0) {
          const unlockTime = Date.now() + LOCKOUT_MINUTES * 60 * 1000
          setLockoutUntil(unlockTime); localStorage.setItem(`duacel_lockout_${magicToken}`, unlockTime.toString())
        } else {
          setPinError(true); setTimeout(() => setPin(['', '', '', '']), 500); pinInputRefs[0].current?.focus()
        }
      }
    }
  }

  const handlePinKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !pin[index] && index > 0) pinInputRefs[index - 1].current?.focus()
  }

  const handleManualLock = () => {
    sessionStorage.removeItem(`duacel_auth_${magicToken}`)
    setIsUnlocked(false); setActiveTab('qr'); setPin(['', '', '', ''])
  }

  const handleForgotPin = async (e: React.FormEvent) => {
    e.preventDefault(); setIsResetting(true); setResetResult(null)
    try {
      const res = await fetch('/api/reset-pin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ secretToken: magicToken, email: forgotEmail }) })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'エラーが発生しました')
      setResetResult({ success: true, message: '新しい暗証番号をメールで送信しました！\nメールをご確認ください。' })
      setTimeout(() => { setIsForgotPinOpen(false); setResetResult(null); setForgotEmail('') }, 3000)
    } catch (err: any) { setResetResult({ success: false, message: err.message }) } 
    finally { setIsResetting(false) }
  }

  const handleSaveProfile = async () => {
    setIsSaving(true); setProfileError('')
    let updateData: any = { name: editName, email: editEmail }
    if (newPinInput) {
      if (newPinInput.length !== 4) { setProfileError('新しいPINは4桁で入力してください。'); setIsSaving(false); return }
      if (staff.security_pin && currentPinInput !== staff.security_pin) { setProfileError('現在の暗証番号が間違っています。'); setIsSaving(false); return }
      updateData.security_pin = newPinInput
    }
    const { error } = await supabase.from('staffs').update(updateData).eq('id', staff.id)
    if (error) { setProfileError('情報の更新に失敗しました。'); setIsSaving(false); return; }
    setStaff({ ...staff, ...updateData }); setCurrentPinInput(''); setNewPinInput(''); setIsSaving(false); setIsEditMode(false) 
  }

  const handleCancelEdit = () => {
    setIsEditMode(false)
    setEditName(staff.name)
    setEditEmail(staff.email)
    setCurrentPinInput('')
    setNewPinInput('')
    setProfileError('')
  }

  const handleExchangePay = async () => {
    const pt = exchangeType === 'all' ? summary.confirmed : Number(exchangeAmount);
    if (pt <= 0 || pt > summary.confirmed) {
      alert('交換可能なポイント数が正しくありません。');
      return;
    }
    setIsExchanging(true);
    await new Promise(resolve => setTimeout(resolve, 1500)); 
    alert(`${pt.toLocaleString()}pt を えらべるPay に交換申請しました！\n（※現在はテスト環境のため実際の交換は行われません）`);
    setIsExchanging(false);
    setIsExchangeModalOpen(false);
    setExchangeAmount('');
    loadData(true);
  }

  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (lockoutUntil) { const interval = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(interval) }
  }, [lockoutUntil])

  if (loading) return <div className="fixed inset-0 flex items-center justify-center bg-gray-50"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>
  if (!staff) return <div className="fixed inset-0 flex items-center justify-center bg-gray-50 text-gray-500 font-bold">ページが見つかりません。</div>

  const STATUS_MAP: any = {
    pending: { label: '仮計上', color: 'bg-amber-50 text-amber-700 border-amber-100', icon: <Clock className="w-3 h-3" /> },
    confirmed: { label: '確定', color: 'bg-emerald-50 text-emerald-700 border-emerald-100', icon: <CheckCircle2 className="w-3 h-3" /> },
    issued: { label: '確定', color: 'bg-emerald-50 text-emerald-700 border-emerald-100', icon: <CheckCircle2 className="w-3 h-3" /> },
    cancel: { label: 'キャンセル', color: 'bg-red-50 text-red-600 border-red-100', icon: <Ban className="w-3 h-3" /> },
  }

  return (
    <div className="fixed inset-0 bg-gray-50 flex flex-col font-sans text-gray-800 overflow-hidden selection:bg-indigo-100 selection:text-indigo-900">
      
      {!isUnlocked ? (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-6 bg-white">
          <div className="w-full max-w-sm animate-in fade-in zoom-in-95 duration-500">
            <div className="text-center mb-10">
              <p className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em] mb-2">Duacel 紹介プログラム</p>
              <div className="flex justify-center mb-4"><div className={`w-20 h-20 rounded-full bg-gradient-to-tr ${getGradient(staff.name)} flex items-center justify-center text-white font-black text-3xl shadow-lg border-4 border-white`}>{staff.name.charAt(0).toUpperCase()}</div></div>
              <h1 className="text-2xl font-black text-gray-900 leading-tight mb-2 tracking-tight">{shop?.name}<br/>{staff.name} さんのページ</h1>
              <p className="text-xs text-gray-500 font-medium mt-4">アクセスするには4桁の暗証番号を<br/>入力してください。</p>
            </div>
            <div className={`flex justify-center gap-4 mb-8 ${pinError ? 'animate-[shake_0.5s_ease-in-out]' : ''}`}>
              {pin.map((digit, index) => (
                <input key={index} ref={pinInputRefs[index]} type="password" inputMode="numeric" maxLength={1} value={digit} onChange={(e) => handlePinChange(index, e.target.value)} onKeyDown={(e) => handlePinKeyDown(index, e)}
                  className={`w-14 h-16 text-center text-2xl font-black rounded-2xl border-2 outline-none transition-all shadow-sm ${pinError ? 'border-red-400 bg-red-50 text-red-600' : digit ? 'border-indigo-600 bg-indigo-50 text-indigo-900 shadow-indigo-100' : 'border-gray-200 bg-gray-50 focus:border-indigo-400 focus:bg-white'}`}
                />
              ))}
            </div>
            <div className="h-8 flex flex-col items-center">
              {pinError ? (<><p className="text-center text-xs font-bold text-red-500 animate-in fade-in mb-1">暗証番号が間違っています</p><p className="text-[10px] font-bold text-gray-400">残り試行回数: <span className="text-red-500">{attemptsLeft}回</span></p></>) : (<p className="text-center text-[10px] text-gray-400 font-bold">※登録時に設定したPINコードです</p>)}
            </div>
            <div className="mt-8 text-center"><button onClick={() => setIsForgotPinOpen(true)} className="text-xs font-bold text-indigo-500 hover:text-indigo-600 underline underline-offset-4 transition-colors">暗証番号を忘れた方はこちら</button></div>
          </div>
          
          <AnimatePresence>
            {isForgotPinOpen && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[110] bg-gray-900/60 backdrop-blur-sm flex flex-col justify-end p-4 sm:p-6">
                <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} className="bg-white rounded-[2rem] p-6 sm:p-8 w-full max-w-md mx-auto shadow-2xl relative overflow-hidden">
                  <button onClick={() => setIsForgotPinOpen(false)} className="absolute top-4 right-4 p-2 text-gray-400 hover:bg-gray-100 rounded-full"><X className="w-5 h-5" /></button>
                  <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mb-6"><Mail className="w-6 h-6" /></div>
                  <h3 className="text-xl font-black text-gray-900 mb-2">暗証番号の再設定</h3>
                  <p className="text-xs text-gray-500 font-medium leading-relaxed mb-6">ご登録されているメールアドレスを入力してください。<br/>新しい暗証番号を発行して送信します。</p>
                  <form onSubmit={handleForgotPin} className="space-y-4">
                    <input type="email" required placeholder="example@email.com" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} disabled={isResetting} className="w-full px-4 py-4 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none" />
                    {resetResult && (
                      <div className={`p-3 rounded-xl text-xs font-bold flex items-start gap-2 whitespace-pre-wrap ${resetResult.success ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                        {resetResult.success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <Ban className="w-4 h-4 shrink-0" />} {resetResult.message}
                      </div>
                    )}
                    <button type="submit" disabled={isResetting || !forgotEmail} className="w-full py-4 bg-gray-900 text-white rounded-xl text-sm font-bold shadow-lg active:scale-95 transition flex justify-center items-center gap-2 disabled:opacity-50">
                      {isResetting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Send className="w-4 h-4" /> 再発行メールを送信する</>}
                    </button>
                  </form>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ) : (
        <>
          {/* ★ ヘッダー (ダッシュボードと統一) */}
          <header className="px-5 pt-safe-top pb-4 flex items-center justify-between border-b border-gray-100 bg-white/90 backdrop-blur-md z-20 shadow-sm">
            <div>
              <p className="text-[9px] font-bold text-indigo-600 tracking-wider mb-1 uppercase">{shop?.name}</p>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black text-gray-900">{staff.name}</h1>
                {staff.is_team_pool_eligible !== false && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-700 flex items-center gap-1"><Handshake className="w-2.5 h-2.5"/> チーム対象</span>
                )}
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <button onClick={handleManualLock} className="p-2 text-gray-400 hover:text-gray-900 transition-colors bg-gray-50 hover:bg-gray-100 rounded-full active:scale-95">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </header>

          <main className="flex-1 relative overflow-y-auto pb-32 -webkit-overflow-scrolling-touch bg-gray-50/30">
            <AnimatePresence mode="wait">
              <motion.div key={activeTab} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} transition={{ duration: 0.25, ease: "easeOut" }} className="p-5">
                
                {/* 📊 TAB 1: ウォレット (Stats) */}
                {activeTab === 'stats' && (
                  <div className="max-w-md mx-auto space-y-6">
                    {/* えらべるPay 交換ボタン */}
                    <button 
                      onClick={() => setIsExchangeModalOpen(true)}
                      className="w-full p-5 bg-gradient-to-r from-gray-900 to-gray-800 text-white rounded-2xl shadow-md flex items-center justify-between active:scale-95 transition-transform"
                    >
                      <div className="text-left">
                        <h2 className="text-sm font-bold flex items-center gap-2"><JapaneseYen className="w-4 h-4"/> えらべるPayに交換する</h2>
                        <p className="text-[10px] text-gray-300 mt-1 leading-tight">貯まったポイントを、PayPayやAmazonギフトなどの<br/>お好きな電子マネーに交換できます。</p>
                      </div>
                      <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center shrink-0">
                        <ChevronRight className="w-4 h-4 text-white" />
                      </div>
                    </button>

                    <div className="space-y-3">
                      <div className="bg-white border border-gray-200 p-5 rounded-2xl shadow-sm relative overflow-hidden">
                        <div className="absolute right-0 top-0 p-4 opacity-5"><Wallet className="w-16 h-16 text-gray-900" /></div>
                        <p className="text-[10px] font-bold text-gray-500 mb-1">💰 あなたが交換できる確定ポイント</p>
                        <p className="text-3xl font-mono font-black text-gray-900 tracking-tight">{summary.confirmed.toLocaleString()}<span className="text-xs ml-1 text-gray-400 font-sans">pt</span></p>
                      </div>
                      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-bold text-gray-500 mb-0.5">🚀 確定待ち (もうすぐ入る予定)</p>
                          <p className="text-lg font-mono font-bold tracking-tight text-gray-800">{summary.pending.toLocaleString()}<span className="text-[10px] ml-1 text-gray-400 font-sans">pt</span></p>
                        </div>
                        <Clock className="w-6 h-6 text-gray-300" />
                      </div>
                    </div>

                    <div className="pt-2">
                      <h2 className="text-sm font-bold mb-4 flex items-center gap-2 text-gray-900"><ClipboardList className="w-4 h-4 text-gray-400" /> あなたの実績フィード</h2>
                      
                      <div className="space-y-3">
                        {history.length === 0 ? (
                          <div className="text-center py-10 text-gray-400 text-xs">まだ実績がありません</div>
                        ) : (
                          history.map((item) => {
                            const isPending = item.status === 'pending';
                            const isCanceled = item.status === 'cancel';
                            const customerName = item.customer_name || '匿名のお客様';
                            const isRecurring = item.recurring_count > 1;

                            return (
                              <div key={item.id} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm w-full hover:border-gray-300 transition-colors">
                                <div className="flex justify-between items-start mb-1.5">
                                  <p className="text-[10px] font-bold text-gray-900 flex items-center gap-1">
                                    {isPending ? <Clock className="w-3 h-3 text-amber-500"/> : isCanceled ? <Ban className="w-3 h-3 text-red-500"/> : <CheckCircle2 className="w-3 h-3 text-emerald-500"/>}
                                    {isPending ? '【仮計上】' : isCanceled ? '【無効】' : '【ポイント獲得】'}
                                    {customerName}の{isRecurring ? `定期${item.recurring_count}回目` : '初回購入'}
                                  </p>
                                  <span className="text-[8px] text-gray-400 whitespace-nowrap ml-2">
                                    {new Date(item.created_at).toLocaleDateString('ja-JP', {month:'short', day:'numeric'})}
                                  </span>
                                </div>
                                
                                <div className="flex items-center justify-between mb-3 mt-2">
                                  <span className="text-[9px] font-semibold text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded">
                                    {item.isMine ? 'あなたが紹介' : '他のスタッフの紹介'}
                                  </span>
                                  <p className={`text-sm font-mono font-bold ${isCanceled ? 'line-through text-gray-300' : 'text-gray-900'}`}>
                                    獲得: +{item.totalPt.toLocaleString()} <span className="text-[9px] font-sans text-gray-500">pt</span>
                                  </p>
                                </div>
                                
                                {/* 店舗留保を見せず、総発生と自分の取り分だけを明記 */}
                                {!isPending && !isCanceled && (
                                  <div className="pt-3 mt-3 border-t border-gray-100/80">
                                    <div className="flex justify-between text-[10px] mb-1.5">
                                      <span className="text-gray-500">対象の総発生ポイント</span>
                                      <span className="font-mono text-gray-700">{item.totalGenerated?.toLocaleString()}pt</span>
                                    </div>
                                    <div className="flex justify-between text-[10px] mb-1.5 pl-2 border-l-2 border-gray-200">
                                      <span className="text-gray-500 flex items-center gap-1"><User className="w-3 h-3"/> 本人還元 ({item.snapshot_ratio_individual}%)</span>
                                      <span className="font-mono text-gray-700">+{item.myIndPart?.toLocaleString()}pt</span>
                                    </div>
                                    {item.myTeamPart > 0 && (
                                      <div className="flex justify-between text-[10px] pl-2 border-l-2 border-gray-200">
                                        <span className="text-gray-500 flex items-center gap-1"><Handshake className="w-3 h-3"/> チーム山分け ({item.snapshot_ratio_team}%)</span>
                                        <span className="font-mono text-gray-700">+{item.myTeamPart?.toLocaleString()}pt</span>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )
                          })
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* 📱 TAB 2: スタッフQR (Staff) */}
                {activeTab === 'qr' && (
                  <div className="flex flex-col items-center max-w-sm mx-auto h-full justify-center">
                    <div className="w-full bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 flex flex-col items-center relative overflow-hidden mb-6">
                      <div className="p-6 bg-white rounded-[2rem] shadow-sm border-2 border-gray-50 mb-2 flex items-center justify-center relative z-10">
                        <QRCodeCanvas value={referralUrl} size={190} level={"H"} fgColor="#111827" />
                      </div>
                      <p className="text-xs font-bold text-gray-600 mt-4 tracking-wider">お客様のスマートフォンで<br/>読み込んでください</p>
                    </div>
                    <div className="w-full space-y-3">
                      <button onClick={() => handleCopy(referralUrl)} className={`w-full py-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 active:scale-95 shadow-sm ${copied ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'}`}>
                        {copied ? <CheckCircle2 className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                        {copied ? 'URLをコピーしました！' : '接客用URLをコピー'}
                      </button>
                    </div>
                  </div>
                )}

                {/* 📖 TAB 3: マニュアル (Info) */}
                {activeTab === 'info' && (
                  <div className="max-w-md mx-auto">
                    <div className="mb-6">
                      <h2 className="text-sm font-bold flex items-center gap-1.5"><BookOpen className="w-4 h-4 text-gray-400" /> ドキュメント</h2>
                      <p className="text-[10px] text-gray-500 mt-1">運用マニュアルやトークスクリプト</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { icon: <LayoutDashboard className="w-5 h-5"/>, title: '使い方ガイド', desc: 'マイページの見方' },
                        { icon: <ShoppingBag className="w-5 h-5"/>, title: '製品カタログ', desc: '成分・効果の詳細' },
                        { icon: <MessageCircle className="w-5 h-5"/>, title: 'トーク集', desc: 'お客様への声かけ例' },
                        { icon: <PlayCircle className="w-5 h-5"/>, title: '施術動画', desc: '機器の正しい使い方' },
                      ].map((item, i) => (
                        <button key={i} className="bg-white p-4 rounded-2xl border border-gray-100 text-left hover:border-gray-300 transition-all flex flex-col justify-between aspect-square active:scale-95">
                          <div className="w-8 h-8 bg-gray-50 text-gray-600 rounded-md flex items-center justify-center mb-3">{item.icon}</div>
                          <div>
                            <h3 className="text-xs font-semibold text-gray-900 mb-1">{item.title}</h3>
                            <p className="text-[9px] text-gray-500 leading-tight">{item.desc}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 🛒 TAB 4: 仕入れ (Shop) */}
                {activeTab === 'shop' && (
                  <div className="max-w-md mx-auto">
                    <div className="flex justify-between items-end mb-6">
                      <div>
                        <h2 className="text-sm font-bold flex items-center gap-1.5"><Store className="w-4 h-4 text-gray-400" /> 仕入れ・交換</h2>
                        <p className="text-[10px] text-gray-500 mt-1">貯まったポイントで商材をお得にゲット！</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-gray-400 mb-0.5">現在のポイント</p>
                        <p className="text-xl font-mono leading-none">{summary.confirmed.toLocaleString()}<span className="text-xs ml-0.5 font-sans text-gray-500">pt</span></p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {MOCK_PRODUCTS.map(product => {
                        const canBuyWithPoint = summary.confirmed >= product.ptPrice;
                        return (
                          <div key={product.id} className="bg-white p-3 rounded-xl border border-gray-100 flex items-center gap-4 hover:border-gray-300 transition-colors">
                            <div className="w-16 h-16 rounded-lg bg-gray-50 flex items-center justify-center shrink-0 border border-gray-100">
                              {product.icon}
                            </div>
                            <div className="flex-1">
                              <h3 className="text-xs font-semibold leading-snug mb-2 text-gray-800">{product.name}</h3>
                              <div className="flex items-end justify-between">
                                <div>
                                  <p className="text-[10px] text-gray-400 line-through">通常: ¥{product.price.toLocaleString()}</p>
                                  <p className="text-sm font-mono flex items-baseline gap-1">
                                    {product.ptPrice.toLocaleString()}<span className="text-[9px] font-sans text-gray-500">pt</span>
                                  </p>
                                </div>
                                <button 
                                  className={`px-4 py-1.5 rounded-md text-[10px] font-bold transition-all active:scale-95 ${
                                    canBuyWithPoint ? 'bg-gray-900 text-white hover:bg-gray-800' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                                  }`}
                                  onClick={() => alert('※ ここからecforceのAPIを叩き、クーポン付きでシークレットLPへ飛ばすフローが入ります。')}
                                >
                                  {canBuyWithPoint ? '交換する' : '購入する'}
                                </button>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    <div className="mt-6 p-4 bg-gray-50 rounded-xl flex items-start gap-2 border border-gray-200">
                      <Info className="w-4 h-4 text-gray-400 shrink-0" />
                      <p className="text-[10px] font-semibold text-gray-600 leading-relaxed">
                        ポイントが足りない場合でも、クレジットカード決済でそのままご購入いただけます。（店舗宛の掛け払いはオーナーのみ可能です）
                      </p>
                    </div>
                  </div>
                )}

                {/* ⚙️ TAB 5: 設定 (Settings) */}
                {activeTab === 'settings' && (
                  <div className="max-w-md mx-auto space-y-4">
                    <div className="flex justify-between items-center mb-4">
                      <h2 className="text-sm font-bold flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-gray-400" /> アカウント情報</h2>
                      {!isOwner && (
                        !isEditMode ? (
                          <button onClick={() => setIsEditMode(true)} className="px-3 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-md text-[10px] font-bold flex items-center gap-1 hover:bg-gray-50 transition-all active:scale-95"><Edit2 className="w-3 h-3 text-gray-400" /> 編集する</button>
                        ) : (
                          <button onClick={handleCancelEdit} className="px-3 py-1.5 bg-gray-100 text-gray-500 rounded-md text-[10px] font-bold hover:bg-gray-200 transition-all">キャンセル</button>
                        )
                      )}
                    </div>

                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-8">
                      <div className="p-5 border-b border-gray-50 flex items-center gap-4 bg-gray-50/50">
                        <div className={`w-12 h-12 rounded-full bg-gradient-to-tr ${getGradient(staff.name)} flex items-center justify-center text-white font-bold text-xl shadow-inner border-2 border-white`}>{staff.name.charAt(0).toUpperCase()}</div>
                        <div>
                          <p className="text-sm font-bold text-gray-900">{staff.name}</p>
                          <p className="text-[10px] text-gray-400 font-medium mt-0.5">ID: {staff.referral_code}</p>
                        </div>
                      </div>

                      <div className="p-5 space-y-4">
                        <div>
                          <label className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 mb-1.5 uppercase tracking-wider"><User className="w-3 h-3" /> 表示名</label>
                          {!isEditMode ? <p className="text-sm font-bold text-gray-800 px-1">{staff.name}</p> : <input type="text" value={editName} onChange={e => setEditName(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs font-bold text-gray-900 focus:border-gray-400 outline-none transition-all" />}
                        </div>
                        <div className="h-px bg-gray-100" />
                        <div>
                          <label className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 mb-1.5 uppercase tracking-wider"><Mail className="w-3 h-3" /> メールアドレス</label>
                          {!isEditMode ? <p className="text-xs font-medium text-gray-600 px-1">{staff.email}</p> : <input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs font-medium text-gray-900 focus:border-gray-400 outline-none transition-all" />}
                        </div>
                        <div className="h-px bg-gray-100" />
                        <div>
                          <label className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 mb-1.5 uppercase tracking-wider"><Lock className="w-3 h-3" /> 暗証番号（PIN）の変更</label>
                          {!isEditMode ? (
                            <p className="text-sm font-bold text-gray-600 px-1 tracking-widest">••••</p>
                          ) : (
                            <div className="space-y-2">
                              <input type="password" inputMode="numeric" maxLength={4} placeholder="現在のPIN (4桁)" value={currentPinInput} onChange={e => setCurrentPinInput(e.target.value.replace(/[^0-9]/g, ''))} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono tracking-[0.5em] focus:border-gray-400 outline-none transition-all" />
                              <input type="password" inputMode="numeric" maxLength={4} placeholder="新しいPIN (4桁)" value={newPinInput} onChange={e => setNewPinInput(e.target.value.replace(/[^0-9]/g, ''))} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono tracking-[0.5em] focus:border-gray-400 outline-none transition-all" />
                              <p className="text-[9px] text-gray-400 font-bold px-1">※変更しない場合は空欄のままにしてください</p>
                            </div>
                          )}
                        </div>
                      </div>

                      <AnimatePresence>
                        {isEditMode && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="p-5 pt-0">
                            {profileError && (<div className="p-2 mb-3 bg-red-50 text-red-600 border border-red-100 rounded-lg text-[10px] font-bold flex items-start gap-1.5"><X className="w-3 h-3 shrink-0" /> {profileError}</div>)}
                            <button onClick={handleSaveProfile} disabled={isSaving || (editName === staff.name && editEmail === staff.email && !newPinInput)} className="w-full py-3 bg-gray-900 text-white rounded-lg text-xs font-bold disabled:opacity-50 transition-all active:scale-95 flex justify-center items-center gap-2">
                              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : '変更を保存する'}
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                    
                    {isOwner && (
                      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-gray-50 border border-gray-200 rounded-2xl p-5 shadow-sm">
                        <h3 className="text-xs font-bold text-gray-900 mb-1 flex items-center gap-1.5"><Crown className="w-4 h-4 text-amber-500" /> オーナー専用メニュー</h3>
                        <p className="text-[10px] text-gray-500 mb-4 leading-relaxed">お名前やメールアドレスなどの店舗情報は、管理ダッシュボードから行ってください。</p>
                        <button onClick={() => router.push('/dashboard')} className="w-full py-3 bg-white border border-gray-300 text-gray-900 text-xs font-bold rounded-xl shadow-sm hover:bg-gray-50 transition active:scale-95 flex items-center justify-center gap-2">
                          <LayoutDashboard className="w-4 h-4" /> 管理ダッシュボードを開く
                        </button>
                      </motion.div>
                    )}
                  </div>
                )}
                
              </motion.div>
            </AnimatePresence>
          </main>

          {/* ★ ダークテーマのボトムナビ (ダッシュボードと統一) */}
          <nav className="bg-gray-900 border-t border-gray-800 px-1 py-1 flex justify-between items-center z-50 pb-safe shrink-0">
            {[
              { id: 'stats', icon: <LayoutDashboard className="w-5 h-5" />, label: 'Home' },
              { id: 'qr', icon: <QrCode className="w-5 h-5" />, label: 'QR' },
              { id: 'info', icon: <BookOpen className="w-5 h-5" />, label: 'Guide' },
              { id: 'shop', icon: <Store className="w-5 h-5" />, label: 'Shop' },
              { id: 'settings', icon: <Settings className="w-5 h-5" />, label: 'Setting' },
            ].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex flex-col items-center justify-center flex-1 py-2 gap-1 transition-colors ${activeTab === tab.id ? 'text-white' : 'text-gray-400 hover:text-gray-200'}`}>
                <div className={`transition-transform duration-200 ${activeTab === tab.id ? 'scale-110' : 'scale-100'}`}>{tab.icon}</div>
                <span className="text-[8px] font-semibold tracking-wide">{tab.label}</span>
              </button>
            ))}
          </nav>

          {/* ★ えらべるPay 交換モーダル */}
          <AnimatePresence>
            {isExchangeModalOpen && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }} className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl relative max-h-[90vh] overflow-y-auto">
                  <button onClick={() => setIsExchangeModalOpen(false)} className="absolute top-4 right-4 p-2 text-gray-400 hover:bg-gray-100 rounded-full"><X className="w-4 h-4" /></button>
                  <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mb-4"><JapaneseYen className="w-5 h-5" /></div>
                  <h3 className="text-base font-bold text-gray-900 mb-2">えらべるPayに交換</h3>
                  <p className="text-[10px] text-gray-500 mb-6 leading-relaxed">ポイントをPayPayやAmazonギフト券などの電子マネーに交換します。</p>
                  
                  <div className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <p className="text-[10px] font-bold text-gray-400 mb-0.5">現在の確定ポイント</p>
                    <p className="text-xl font-mono font-black text-gray-900">{summary.confirmed.toLocaleString()}<span className="text-[10px] font-sans text-gray-500 ml-1">pt</span></p>
                  </div>

                  <div className="space-y-4 mb-8">
                    <label className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${exchangeType === 'all' ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:border-gray-300'}`}>
                      <input type="radio" checked={exchangeType === 'all'} onChange={() => { setExchangeType('all'); setExchangeAmount(''); }} className="w-4 h-4 text-gray-900 accent-gray-900" />
                      <div>
                        <p className="text-xs font-bold text-gray-900">すべてのポイントを交換</p>
                        <p className="text-[9px] text-gray-500 mt-0.5">{summary.confirmed.toLocaleString()} pt</p>
                      </div>
                    </label>
                    
                    <label className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer ${exchangeType === 'custom' ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:border-gray-300'}`}>
                      <input type="radio" checked={exchangeType === 'custom'} onChange={() => setExchangeType('custom')} className="w-4 h-4 text-gray-900 accent-gray-900 mt-1" />
                      <div className="flex-1">
                        <p className="text-xs font-bold text-gray-900 mb-2">ポイント数を指定する</p>
                        <input 
                          type="number" 
                          placeholder="例: 1000" 
                          value={exchangeAmount} 
                          onChange={(e) => { setExchangeType('custom'); setExchangeAmount(e.target.value); }} 
                          disabled={exchangeType !== 'custom'}
                          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-mono focus:border-gray-900 outline-none disabled:bg-gray-100 disabled:opacity-50"
                        />
                      </div>
                    </label>
                  </div>

                  <button onClick={handleExchangePay} disabled={isExchanging || summary.confirmed <= 0} className="w-full py-3.5 bg-gray-900 text-white text-xs font-bold rounded-xl active:scale-95 transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50">
                    {isExchanging ? <Loader2 className="w-4 h-4 animate-spin"/> : "申請する"}
                  </button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

        </>
      )}
    </div>
  )
}