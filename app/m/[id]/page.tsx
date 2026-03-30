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
  Sparkles, PlayCircle, ShieldCheck, X
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
  const [activeTab, setActiveTab] = useState<'wallet' | 'shop' | 'qr' | 'info' | 'settings'>('qr')
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

  // ★ SHOP（仕入れ）用ダミーデータ
  const MOCK_PRODUCTS = [
    { id: 1, name: 'Duacel スカルプセラム (業務・店販用)', price: 8800, ptPrice: 8000, img: 'bg-indigo-100', icon: <Sparkles className="w-8 h-8 text-indigo-500" /> },
    { id: 2, name: 'Duacel 専用導入機器 (Proモデル)', price: 45000, ptPrice: 42000, img: 'bg-slate-100', icon: <ShieldCheck className="w-8 h-8 text-slate-500" /> },
    { id: 3, name: '店販用パンフレット (100部セット)', price: 2000, ptPrice: 2000, img: 'bg-amber-100', icon: <BookOpen className="w-8 h-8 text-amber-500" /> },
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

  const loadData = async () => {
    const { data: staffData, error } = await supabase.from('staffs').select('*').eq('secret_token', magicToken).single()
    if (error || !staffData) { setLoading(false); return; }

    const { data: shopData } = await supabase.from('shops').select('*, shop_categories(*)').eq('id', staffData.shop_id).single()

    const [refRes, txRes, staffCountRes] = await Promise.all([
      supabase.from('referrals').select('*').eq('shop_id', staffData.shop_id).order('created_at', { ascending: true }),
      supabase.from('point_transactions').select('*').eq('shop_id', staffData.shop_id), 
      supabase.from('staffs').select('id', { count: 'exact' }).eq('shop_id', staffData.shop_id).eq('is_deleted', false)
    ])

    const allReferrals = refRes.data || []
    const pointLogs = txRes.data || []
    const activeStaffCount = staffCountRes.count || 1

    const ratioInd = shopData.ratio_individual ?? 100;
    const ratioTeam = shopData.ratio_team ?? 0;
    const ratioOwner = shopData.ratio_owner ?? 0;

    const category = shopData.shop_categories;
    const basePoints = category?.reward_points || 0;
    const firstBonusEnabled = category?.first_bonus_enabled || false;
    const firstBonusPoints = category?.first_bonus_points || 0;

    const shopHasBonusTx = pointLogs.some(tx => tx.metadata?.is_bonus === true);
    const myReferrals: any[] = [];
    let sTotal = 0; let sPending = 0; let sConfirmed = 0; let sPaid = 0;

    allReferrals.forEach((r, index) => {
      const isMine = r.staff_id === staffData.id;
      const refTxs = pointLogs.filter(tx => tx.referral_id === r.id && (tx.status === 'confirmed' || tx.status === 'paid'));
      const isCanceled = r.status === 'cancel';
      const isOldest = index === 0;
      const isFirstTime = !isCanceled && (refTxs.length > 0 ? refTxs.some(tx => tx.metadata?.is_bonus) : (!shopHasBonusTx && isOldest));
      const totalBase = basePoints + (isFirstTime && firstBonusEnabled ? firstBonusPoints : 0);

      const isOwnerAction = shopData.owner_email === staffData.email;
      let myEarnedPoints = 0;
      
      const actualTxPoints = refTxs.reduce((sum, tx) => sum + (Number(tx.points) || 0), 0);

      if (r.status === 'pending') {
        const indPart = isMine ? totalBase * (ratioInd / 100) : 0;
        const teamPart = (totalBase * (ratioTeam / 100)) / activeStaffCount;
        const ownerPart = isOwnerAction ? totalBase * (ratioOwner / 100) : 0;
        myEarnedPoints = Math.floor(indPart + teamPart + ownerPart);
      } else {
        const indPart = isMine ? actualTxPoints * (ratioInd / 100) : 0;
        const teamPart = (actualTxPoints * (ratioTeam / 100)) / activeStaffCount;
        const ownerPart = isOwnerAction ? actualTxPoints * (ratioOwner / 100) : 0;
        myEarnedPoints = Math.floor(indPart + teamPart + ownerPart);
      }

      if (myEarnedPoints > 0) {
        myReferrals.push({ ...r, totalPt: isCanceled ? 0 : myEarnedPoints, isMine, hasBonus: isFirstTime && firstBonusEnabled && isMine });
        if (!isCanceled) {
          if (r.is_staff_rewarded || r.status === 'issued') {
            sTotal += myEarnedPoints;
            if (r.is_staff_rewarded) sPaid += myEarnedPoints;
            if (!r.is_staff_rewarded && r.status === 'issued') sConfirmed += myEarnedPoints;
          }
          if (r.status === 'pending' || r.status === 'confirmed') {
            if (r.status === 'confirmed') sConfirmed += myEarnedPoints; else sPending++; 
          }
        }
      }
    });

    setStaff(staffData)
    setEditName(staffData.name)
    setEditEmail(staffData.email)
    setShop(shopData)
    setHistory(myReferrals.reverse())
    setSummary({ total: sTotal + sConfirmed, pending: sPending, confirmed: sConfirmed, paid: sPaid })
    setLoading(false)
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

  // ==========================================
  // 🔒 ロックアウト画面 / ログイン画面
  // ==========================================
  if (lockoutUntil && lockoutUntil > now) {
    const minutesLeft = Math.ceil((lockoutUntil - now) / 60000)
    return (
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-6 bg-white selection:bg-indigo-100 selection:text-indigo-900">
        <div className="w-full max-w-sm text-center animate-in fade-in zoom-in-95 duration-500">
          <div className="w-24 h-24 bg-red-50 text-red-600 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-sm border border-red-100"><Ban className="w-12 h-12" /></div>
          <h2 className="text-2xl font-black text-gray-900 mb-3">アカウントロック中</h2>
          <p className="text-sm font-bold text-gray-500 leading-relaxed mb-8">暗証番号の入力を規定回数間違えたため、<br/>セキュリティ保護のため画面をロックしました。</p>
          <div className="p-6 bg-gray-50 rounded-2xl border border-gray-100">
            <p className="text-xs font-bold text-gray-400 mb-1">自動解除まで約</p>
            <p className="text-4xl font-black text-red-600 tabular-nums">{minutesLeft} <span className="text-sm font-bold text-gray-400">分</span></p>
          </div>
        </div>
      </div>
    )
  }

  if (!isUnlocked) {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-6 bg-white selection:bg-indigo-100 selection:text-indigo-900">
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
    )
  }

  // ==========================================
  // 🔓 メイン画面 (5タブ)
  // ==========================================
  return (
    <div className="fixed inset-0 bg-gray-50 flex flex-col font-sans text-gray-800 overflow-hidden selection:bg-indigo-100 selection:text-indigo-900">
      
      <header className="bg-white px-6 pt-safe-top pb-4 border-b border-gray-100 flex items-center justify-between shadow-sm z-20">
        <div className="flex items-center gap-3 mt-4">
          <div className={`w-10 h-10 rounded-full bg-gradient-to-tr ${getGradient(staff.name)} flex items-center justify-center text-white font-bold text-lg shadow-sm border-2 border-white ring-2 ring-gray-50`}>{staff.name.charAt(0).toUpperCase()}</div>
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{shop?.name}</p>
            <h1 className="text-sm font-extrabold text-gray-900">{staff.name} <span className="text-xs font-medium text-gray-500">の専用ページ</span></h1>
          </div>
        </div>
        <div className="mt-4">
          <button onClick={handleManualLock} className="p-2 text-gray-400 hover:bg-gray-100 rounded-full transition-colors"><LogOut className="w-5 h-5" /></button>
        </div>
      </header>

      <main className="flex-1 relative overflow-hidden bg-gray-50/50">
        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} transition={{ duration: 0.25, ease: "easeOut" }} className="absolute inset-0 overflow-y-auto pb-32 pt-6 px-6 -webkit-overflow-scrolling-touch">
            
            {/* 📊 TAB 1: ウォレット (Wallet) */}
            {activeTab === 'wallet' && (
               <div className="max-w-md mx-auto space-y-6">
                 <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 text-white p-6 rounded-[2rem] shadow-xl shadow-indigo-200 relative overflow-hidden">
                   <div className="absolute top-0 right-0 p-4 opacity-10"><Wallet className="w-24 h-24" /></div>
                   <div className="mb-6">
                     <p className="text-[11px] font-bold opacity-80 mb-1 flex items-center gap-1"><Gift className="w-4 h-4"/> 交換可能な確定ポイント</p>
                     <p className="text-4xl font-black tabular-nums tracking-tight">{summary.confirmed.toLocaleString()}<span className="text-sm ml-1 font-medium opacity-80">pt</span></p>
                   </div>
                   <button onClick={() => setActiveTab('shop')} className="w-full bg-white text-indigo-600 font-black py-3.5 rounded-xl shadow-lg active:scale-95 transition flex justify-center items-center gap-2">
                     ポイントでお買い物する <ChevronRight className="w-4 h-4" />
                   </button>
                   <div className="flex gap-6 border-t border-white/20 pt-5 mt-5">
                     <div>
                       <p className="text-[10px] opacity-80 mb-0.5 font-bold">承認待ち（仮計上）</p>
                       <p className="text-lg font-bold tabular-nums">{summary.pending} <span className="text-[10px] font-normal">件</span></p>
                     </div>
                     <div>
                       <p className="text-[10px] opacity-80 mb-0.5 font-bold">累計交換済</p>
                       <p className="text-lg font-bold tabular-nums">{summary.paid.toLocaleString()} <span className="text-[10px] font-normal">pt</span></p>
                     </div>
                   </div>
                 </div>

                 <div>
                   <h3 className="text-sm font-extrabold text-gray-900 mb-4 flex items-center gap-2"><History className="w-5 h-5 text-indigo-500" /> アクション履歴</h3>
                   <div className="space-y-3">
                     {history.length === 0 ? (
                       <div className="bg-white rounded-2xl p-8 text-center border border-gray-100 shadow-sm"><MessageCircle className="w-8 h-8 text-gray-300 mx-auto mb-3" /><p className="text-sm font-bold text-gray-500">まだ実績がありません</p></div>
                     ) : (
                       history.map((item, i) => {
                         const isCanceled = item.status === 'cancel';
                         const status = STATUS_MAP[item.status] || { label: item.status, color: 'bg-gray-100 border-gray-200 text-gray-500' };
                         return (
                           <motion.div initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} transition={{ delay: i*0.05 }} key={item.id} className={`bg-white p-4 rounded-2xl border flex items-center justify-between shadow-sm ${isCanceled ? 'border-red-100 bg-red-50/30 opacity-75' : 'border-gray-100'}`}>
                              <div>
                                <p className="text-[10px] font-bold text-gray-400 mb-1">{new Date(item.created_at).toLocaleDateString('ja-JP')} {new Date(item.created_at).toLocaleTimeString('ja-JP', {hour:'2-digit', minute:'2-digit'})}</p>
                                <div className="flex items-center gap-2 mb-1"><span className="text-sm font-bold text-gray-800">{item.isMine ? '自分で紹介' : 'チーム/店舗分配'}</span></div>
                                <div className="flex items-center gap-1.5">
                                  {isCanceled ? <span className="text-[9px] font-bold bg-red-100 text-red-600 px-2 py-0.5 rounded-full border border-red-200">キャンセル</span>
                                  : item.is_staff_rewarded ? <span className="text-[9px] font-bold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full border border-gray-200 flex items-center gap-1"><CheckCheck className="w-3 h-3"/>交換済</span>
                                  : <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${status.color}`}>{status.icon} {status.label}</span>}
                                </div>
                              </div>
                              <div className="text-right">
                                <p className={`text-lg font-black tabular-nums ${isCanceled ? 'text-gray-400 line-through' : item.is_staff_rewarded ? 'text-gray-400' : 'text-indigo-600'}`}>+{item.totalPt.toLocaleString()}<span className="text-[10px] ml-0.5">pt</span></p>
                                {item.hasBonus && <p className="text-[9px] font-bold text-emerald-500">初回ボーナス！</p>}
                              </div>
                           </motion.div>
                         )
                       })
                     )}
                   </div>
                 </div>
               </div>
            )}

            {/* 🛒 TAB 2: ショップ (Shop) ★新設 */}
            {activeTab === 'shop' && (
              <div className="max-w-md mx-auto">
                <div className="flex justify-between items-end mb-6">
                  <div>
                    <h2 className="text-lg font-black text-gray-900 flex items-center gap-2"><Store className="w-5 h-5 text-indigo-500" /> 仕入れ・交換</h2>
                    <p className="text-[10px] font-bold text-gray-500 mt-1">貯まったポイントで商材をお得にゲット！</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-gray-400 mb-0.5">現在のポイント</p>
                    <p className="text-xl font-black text-indigo-600 tabular-nums leading-none">{summary.confirmed.toLocaleString()}<span className="text-xs ml-0.5">pt</span></p>
                  </div>
                </div>

                <div className="space-y-4">
                  {MOCK_PRODUCTS.map(product => {
                    const canBuyWithPoint = summary.confirmed >= product.ptPrice;
                    return (
                      <div key={product.id} className="bg-white p-4 rounded-[1.5rem] border border-gray-100 shadow-sm flex items-center gap-4">
                        <div className={`w-20 h-20 rounded-2xl flex items-center justify-center shrink-0 ${product.img}`}>
                          {product.icon}
                        </div>
                        <div className="flex-1">
                          <h3 className="text-sm font-bold text-gray-900 leading-snug mb-2">{product.name}</h3>
                          <div className="flex items-end justify-between">
                            <div>
                              <p className="text-[10px] text-gray-400 font-bold line-through">通常: ¥{product.price.toLocaleString()}</p>
                              <p className="text-sm font-black text-indigo-600 tabular-nums flex items-baseline gap-1">
                                {product.ptPrice.toLocaleString()}<span className="text-[10px] font-bold">pt</span>
                              </p>
                            </div>
                            <button 
                              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 shadow-sm ${
                                canBuyWithPoint ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
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

                <div className="mt-8 p-5 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-start gap-3">
                  <Info className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
                  <p className="text-xs font-bold text-indigo-800 leading-relaxed">
                    ポイントが足りない場合でも、クレジットカード決済でそのままご購入いただけます。（店舗宛の掛け払いはオーナーアカウントのみご利用可能です）
                  </p>
                </div>
              </div>
            )}

            {/* 📱 TAB 3: QRコード (中央のメインタブ) */}
            {activeTab === 'qr' && (
              <div className="flex flex-col items-center max-w-sm mx-auto h-full justify-center">
                 <div className="w-full bg-white p-8 rounded-[2.5rem] shadow-xl border border-gray-100 flex flex-col items-center relative overflow-hidden mb-6">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full blur-3xl -mr-10 -mt-10" />
                  <div className="p-6 bg-white rounded-[2rem] shadow-lg border-4 border-indigo-50/80 mb-2 flex items-center justify-center relative z-10">
                    <QRCodeCanvas value={referralUrl} size={190} level={"H"} fgColor="#1e1b4b" />
                  </div>
                  <p className="text-xs font-bold text-indigo-500 mt-4 tracking-wider">お客様のスマートフォンで<br/>読み込んでください</p>
                </div>
                <div className="w-full space-y-3">
                  <button onClick={() => handleCopy(referralUrl)} className={`w-full py-4 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 active:scale-95 shadow-sm ${copied ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'}`}>
                    {copied ? <CheckCircle2 className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                    {copied ? 'URLをコピーしました！' : '紹介用URLをコピー'}
                  </button>
                </div>
              </div>
            )}

            {/* 📖 TAB 4: マニュアル (Info) ★新設 */}
            {activeTab === 'info' && (
              <div className="max-w-md mx-auto">
                <div className="mb-6">
                  <h2 className="text-lg font-black text-gray-900 flex items-center gap-2"><BookOpen className="w-5 h-5 text-indigo-500" /> 情報・マニュアル</h2>
                  <p className="text-[10px] font-bold text-gray-500 mt-1">Duacelプログラムを成功させるための情報をまとめました。</p>
                </div>

                {/* 4分割グリッドUI */}
                <div className="grid grid-cols-2 gap-4">
                  <button className="bg-white p-5 rounded-[1.5rem] shadow-sm border border-gray-100 text-left hover:shadow-md hover:border-indigo-200 transition-all group flex flex-col justify-between aspect-square active:scale-95">
                    <div className="w-10 h-10 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform"><LayoutDashboard className="w-5 h-5" /></div>
                    <div>
                      <h3 className="text-sm font-black text-gray-900 mb-1">システムの使い方</h3>
                      <p className="text-[10px] font-bold text-gray-400 leading-tight">マイページやポイント交換の手順</p>
                    </div>
                  </button>
                  
                  <button className="bg-white p-5 rounded-[1.5rem] shadow-sm border border-gray-100 text-left hover:shadow-md hover:border-emerald-200 transition-all group flex flex-col justify-between aspect-square active:scale-95">
                    <div className="w-10 h-10 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform"><ShoppingBag className="w-5 h-5" /></div>
                    <div>
                      <h3 className="text-sm font-black text-gray-900 mb-1">商品カタログ</h3>
                      <p className="text-[10px] font-bold text-gray-400 leading-tight">Duacel製品の成分や効果的な使用方法</p>
                    </div>
                  </button>

                  <button className="bg-white p-5 rounded-[1.5rem] shadow-sm border border-gray-100 text-left hover:shadow-md hover:border-amber-200 transition-all group flex flex-col justify-between aspect-square active:scale-95">
                    <div className="w-10 h-10 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform"><MessageCircle className="w-5 h-5" /></div>
                    <div>
                      <h3 className="text-sm font-black text-gray-900 mb-1">紹介のコツ</h3>
                      <p className="text-[10px] font-bold text-gray-400 leading-tight">お客様への自然な声かけ・ご提案のトーク例</p>
                    </div>
                  </button>

                  <button className="bg-white p-5 rounded-[1.5rem] shadow-sm border border-gray-100 text-left hover:shadow-md hover:border-rose-200 transition-all group flex flex-col justify-between aspect-square active:scale-95">
                    <div className="w-10 h-10 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform"><PlayCircle className="w-5 h-5" /></div>
                    <div>
                      <h3 className="text-sm font-black text-gray-900 mb-1">施術マニュアル</h3>
                      <p className="text-[10px] font-bold text-gray-400 leading-tight">専用機器を使ったサロン施術の動画解説</p>
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* ⚙️ TAB 5: 設定 (Settings) */}
            {activeTab === 'settings' && (
              <div className="max-w-md mx-auto">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-lg font-black text-gray-900 flex items-center gap-2"><Settings className="w-5 h-5 text-indigo-500" /> アカウント情報</h2>
                  {!isOwner && (
                    !isEditMode ? (
                      <button onClick={() => setIsEditMode(true)} className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-full text-xs font-bold shadow-sm flex items-center gap-1.5 hover:bg-gray-50 transition-all active:scale-95"><Edit2 className="w-3 h-3 text-gray-400" /> 編集する</button>
                    ) : (
                      <button onClick={handleCancelEdit} className="px-4 py-2 bg-gray-100 text-gray-500 rounded-full text-xs font-bold hover:bg-gray-200 transition-all">キャンセル</button>
                    )
                  )}
                </div>

                <div className="bg-white rounded-[2rem] shadow-xl shadow-gray-200/40 border border-gray-100 overflow-hidden mb-8">
                  <div className="p-6 border-b border-gray-50 flex items-center gap-4 bg-gray-50/50">
                    <div className={`w-16 h-16 rounded-full bg-gradient-to-tr ${getGradient(staff.name)} flex items-center justify-center text-white font-black text-2xl shadow-inner border-4 border-white`}>{staff.name.charAt(0).toUpperCase()}</div>
                    <div>
                      <p className="text-lg font-black text-gray-900">{staff.name}</p>
                      <p className="text-xs text-gray-400 font-medium mt-0.5">ID: {staff.referral_code}</p>
                    </div>
                  </div>

                  <div className="p-6 space-y-6">
                    <div>
                      <label className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 mb-2 uppercase tracking-wider"><User className="w-3.5 h-3.5" /> 表示名</label>
                      {!isEditMode ? <p className="text-base font-bold text-gray-800 px-1">{staff.name}</p> : <input type="text" value={editName} onChange={e => setEditName(e.target.value)} className="w-full bg-indigo-50/50 border border-indigo-100 rounded-xl px-4 py-3 text-sm font-bold text-indigo-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />}
                    </div>
                    <div className="h-px bg-gray-100" />
                    <div>
                      <label className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 mb-2 uppercase tracking-wider"><Mail className="w-3.5 h-3.5" /> メールアドレス</label>
                      {!isEditMode ? <p className="text-sm font-medium text-gray-600 px-1">{staff.email}</p> : <input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} className="w-full bg-indigo-50/50 border border-indigo-100 rounded-xl px-4 py-3 text-sm font-medium text-indigo-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />}
                    </div>
                    <div className="h-px bg-gray-100" />
                    <div>
                      <label className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 mb-2 uppercase tracking-wider"><Lock className="w-3.5 h-3.5" /> 暗証番号（PIN）の変更</label>
                      {!isEditMode ? (
                        <p className="text-sm font-bold text-gray-600 px-1 tracking-widest">••••</p>
                      ) : (
                        <div className="space-y-3">
                          <input type="password" inputMode="numeric" maxLength={4} placeholder="現在のPIN (4桁)" value={currentPinInput} onChange={e => setCurrentPinInput(e.target.value.replace(/[^0-9]/g, ''))} className="w-full bg-indigo-50/50 border border-indigo-100 rounded-xl px-4 py-3 text-sm font-bold tracking-[0.5em] font-mono text-indigo-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
                          <input type="password" inputMode="numeric" maxLength={4} placeholder="新しいPIN (4桁)" value={newPinInput} onChange={e => setNewPinInput(e.target.value.replace(/[^0-9]/g, ''))} className="w-full bg-indigo-50/50 border border-indigo-100 rounded-xl px-4 py-3 text-sm font-bold tracking-[0.5em] font-mono text-indigo-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
                          <p className="text-[10px] text-gray-400 font-bold px-1">※変更しない場合は空欄のままにしてください</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <AnimatePresence>
                    {isEditMode && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="p-6 pt-0 border-t border-gray-50 bg-gray-50/30">
                        {profileError && (<div className="p-3 mb-4 bg-red-50 text-red-600 border border-red-100 rounded-xl text-xs font-bold flex items-start gap-2"><X className="w-4 h-4 shrink-0" /> {profileError}</div>)}
                        <button onClick={handleSaveProfile} disabled={isSaving || (editName === staff.name && editEmail === staff.email && !newPinInput)} className="w-full py-4 bg-indigo-600 text-white rounded-xl text-sm font-bold disabled:opacity-50 transition-all shadow-lg active:scale-95 flex justify-center items-center gap-2">
                          {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : '変更を保存する'}
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                
                {isOwner && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-indigo-50 border border-indigo-100 rounded-[2rem] p-6 shadow-sm">
                    <h3 className="text-xs font-black text-indigo-800 mb-2 flex items-center gap-2"><Crown className="w-4 h-4 text-amber-500" /> オーナー専用メニュー</h3>
                    <p className="text-[10px] text-indigo-600/80 font-bold mb-4 leading-relaxed">お名前やメールアドレスの変更は<br/>ダッシュボードから行ってください。</p>
                    <div className="space-y-3">
                      <button onClick={() => setIsInviteQrOpen(true)} className="w-full py-4 bg-white text-indigo-700 font-bold rounded-xl shadow-sm flex items-center justify-between px-5 active:scale-95 transition-all hover:bg-gray-50 border border-indigo-100/50">
                        <span className="flex items-center gap-2"><UserPlus className="w-4 h-4"/> メンバー招待QRを表示</span><ChevronRight className="w-4 h-4 text-indigo-300" />
                      </button>
                      <button onClick={() => router.push('/dashboard')} className="w-full py-4 bg-gray-900 text-white font-bold rounded-xl shadow-sm flex items-center justify-between px-5 active:scale-95 transition-all hover:bg-gray-800">
                        <span className="flex items-center gap-2"><LayoutDashboard className="w-4 h-4"/> 管理ダッシュボードを開く</span><ChevronRight className="w-4 h-4 text-gray-400" />
                      </button>
                    </div>
                  </motion.div>
                )}
              </div>
            )}
            
          </motion.div>
        </AnimatePresence>
      </main>

      {/* =========================================
          ★ ボトムナビゲーション (5要素)
      ========================================= */}
      <nav className="bg-white border-t border-gray-100 px-2 py-2 flex justify-between items-center z-50 pb-safe shadow-[0_-10px_40px_rgba(0,0,0,0.03)] relative">
        <button onClick={() => setActiveTab('wallet')} className={`flex flex-col items-center justify-center gap-1 flex-1 py-2 transition-colors ${activeTab === 'wallet' ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}>
          <Wallet className={`w-6 h-6 transition-transform ${activeTab === 'wallet' ? 'scale-110' : ''}`} />
          <span className="text-[9px] font-bold">実績</span>
        </button>
        
        <button onClick={() => setActiveTab('shop')} className={`flex flex-col items-center justify-center gap-1 flex-1 py-2 transition-colors ${activeTab === 'shop' ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}>
          <Store className={`w-6 h-6 transition-transform ${activeTab === 'shop' ? 'scale-110' : ''}`} />
          <span className="text-[9px] font-bold">仕入れ</span>
        </button>

        <div className="relative -mt-8 px-2 flex-shrink-0">
          <button onClick={() => setActiveTab('qr')} className={`p-4 rounded-full shadow-xl border-4 border-gray-50 transition-all active:scale-95 ${activeTab === 'qr' ? 'bg-indigo-600 text-white shadow-indigo-200' : 'bg-gray-900 text-white'}`}>
            <QrCode className="w-7 h-7" />
          </button>
        </div>

        <button onClick={() => setActiveTab('info')} className={`flex flex-col items-center justify-center gap-1 flex-1 py-2 transition-colors ${activeTab === 'info' ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}>
          <BookOpen className={`w-6 h-6 transition-transform ${activeTab === 'info' ? 'scale-110' : ''}`} />
          <span className="text-[9px] font-bold">情報</span>
        </button>

        <button onClick={() => setActiveTab('settings')} className={`flex flex-col items-center justify-center gap-1 flex-1 py-2 transition-colors ${activeTab === 'settings' ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}>
          <Settings className={`w-6 h-6 transition-transform ${activeTab === 'settings' ? 'scale-110' : ''}`} />
          <span className="text-[9px] font-bold">設定</span>
        </button>
      </nav>

      {/* 招待QRモーダル */}
      <AnimatePresence>
        {isInviteQrOpen && shop?.invite_token && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-indigo-600/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-white">
            <h2 className="text-2xl font-black mb-2">メンバー招待QR</h2>
            <p className="text-xs font-medium mb-8 opacity-80 text-center">スタッフにこのQRを読み込んでもらい、<br/>登録を完了させてください。</p>
            <div className="bg-white p-6 rounded-[2rem] shadow-2xl relative mb-8">
              <QRCodeCanvas value={`${window.location.origin}/reg/${shop.invite_token}`} size={200} level="H" fgColor="#1e1b4b" />
            </div>
            <button onClick={() => handleCopy(`${window.location.origin}/reg/${shop.invite_token}`, 'invite')} className="w-full max-w-xs py-4 bg-white/10 border border-white/20 text-white rounded-xl font-bold shadow-lg active:scale-95 transition flex items-center justify-center gap-2 mb-4">
              <Share className="w-4 h-4" /> 招待URLをコピーする
            </button>
            <button onClick={() => setIsInviteQrOpen(false)} className="w-full max-w-xs py-4 bg-white text-indigo-600 rounded-xl font-bold shadow-lg active:scale-95 transition">閉じる</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}