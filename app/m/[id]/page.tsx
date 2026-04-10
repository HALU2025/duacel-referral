'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import { QRCodeCanvas } from 'qrcode.react'
import { motion, AnimatePresence } from 'framer-motion' 

import { 
  QrCode, Copy, MessageCircle, Wallet, Gift, Clock, History, 
  Settings, Mail, User, CheckCircle2, Ban, CheckCheck, ChevronRight, 
  Share, UserPlus, LayoutDashboard, Crown, Edit2, Loader2, Link as LinkIcon, 
  Trash2, Store, CreditCard, Send, LogOut, Info, ShoppingBag, BookOpen, 
  Sparkles, PlayCircle, ShieldCheck, X, Lock, JapaneseYen, Handshake, ClipboardList,
  Edit3, Award
} from 'lucide-react'

export default function MemberMagicPage() {
  const params = useParams()
  const magicToken = params.id as string 
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  
  // セッション管理
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

  // メインコンテンツ用ステート
  const [activeTab, setActiveTab] = useState<'stats' | 'shop' | 'qr' | 'info' | 'settings'>('qr')
  const [staff, setStaff] = useState<any>(null)
  const [shop, setShop] = useState<any>(null)
  const [history, setHistory] = useState<any[]>([])
  const [summary, setSummary] = useState({ total: 0, pending: 0, confirmed: 0, paid: 0 })

  const [copied, setCopied] = useState(false)
  
  // プロフィール・PIN編集用ステート
  const [isEditMode, setIsEditMode] = useState(false) 
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [currentPinInput, setCurrentPinInput] = useState('') 
  const [newPinInput, setNewPinInput] = useState('')         
  const [profileError, setProfileError] = useState('')       
  const [isSaving, setIsSaving] = useState(false)

  // モーダル制御用ステート
  const [isExchangeModalOpen, setIsExchangeModalOpen] = useState(false)
  const [exchangeType, setExchangeType] = useState<'all' | 'custom'>('all')
  const [exchangeAmount, setExchangeAmount] = useState('')
  const [isExchanging, setIsExchanging] = useState(false)

  const [selectedDetail, setSelectedDetail] = useState<{type: 'referral' | 'shop', data: any} | null>(null)
  const [isShareModalOpen, setIsShareModalOpen] = useState(false)
  const [shareTarget, setShareTarget] = useState<'line' | 'email'>('line')
  const [shareMessage, setShareMessage] = useState('')

  // バッジ説明用モーダル
  const [isOwnerModalOpen, setIsOwnerModalOpen] = useState(false)
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false)

  // SHOP（仕入れ）用ダミーデータ
  const MOCK_PRODUCTS = [
    { id: 1, name: 'Duacel スカルプセラム (店販用)', price: 8800, ptPrice: 8000, icon: <Sparkles className="w-6 h-6 text-[#999999]" />, desc: 'お客様への店販用に最適なスカルプセラムです。店内でのお試し用にもご利用いただけます。' },
    { id: 2, name: '専用導入機器 (Proモデル)', price: 45000, ptPrice: 42000, icon: <ShieldCheck className="w-6 h-6 text-[#999999]" />, desc: 'サロンでの本格的な施術に使用する専用機器です。保証期間1年付き。' },
    { id: 3, name: '店販用パンフレット (100部)', price: 2000, ptPrice: 2000, icon: <BookOpen className="w-6 h-6 text-[#999999]" />, desc: 'お客様へお渡しする商品解説のパンフレットです。QRコードを貼付してご活用ください。' },
  ]

  const referralUrl = staff ? `${typeof window !== 'undefined' ? window.location.origin : ''}/welcome/${staff.referral_code || ''}` : ''
  const isOwner = shop?.owner_email === staff?.email
  const defaultShareText = `【${shop?.name || '店舗'}】Duacelスカルプセラムの専用購入ページです。\n以下のURLからご購入いただけます。\n\n${referralUrl}`

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
      supabase.from('referrals').select('*').eq('shop_id', staffData.shop_id).order('created_at', { ascending: false }),
      supabase.from('point_transactions').select('*').eq('shop_id', staffData.shop_id), 
      supabase.from('staffs').select('id', { count: 'exact' }).eq('shop_id', staffData.shop_id).eq('is_deleted', false)
    ])

    const referralLogs = refRes.data || []
    const pointLogs = txRes.data || []
    const activeStaffCount = staffCountRes.count || 1

    const category = shopData.shop_categories;
    const basePointsDefault = category?.reward_points || 0;
    const firstBonusEnabled = category?.first_bonus_enabled || false;
    const firstBonusPoints = category?.first_bonus_points || 0;

    const shopHasBonusTx = pointLogs.some(tx => tx.metadata?.is_bonus === true);
    const reversedLogs = [...referralLogs].reverse();

    let sTotal = 0; let sPending = 0; let sConfirmed = 0; let sPaid = 0;
    const myReferrals: any[] = [];
    const isMeEligible = staffData.is_team_pool_eligible !== false;

    const { data: allStaffsData } = await supabase.from('staffs').select('id, name').eq('shop_id', staffData.shop_id);
    const staffNameMap = new Map((allStaffsData || []).map(s => [s.id, s.name]));

    reversedLogs.forEach((r, index) => {
      const isMine = r.staff_id === staffData.id;
      const refTxs = pointLogs.filter(tx => tx.referral_id === r.id && (tx.status === 'confirmed' || tx.status === 'paid'));
      const isCanceled = r.status === 'cancel';
      const isOldest = index === 0;
      
      const isFirstTime = !isCanceled && (refTxs.length > 0 ? refTxs.some(tx => tx.metadata?.is_bonus) : (!shopHasBonusTx && isOldest));
      
      const basePoints = basePointsDefault + (isFirstTime && firstBonusEnabled ? firstBonusPoints : 0);
      const totalBase = basePoints;

      const ratioInd = r.snapshot_ratio_individual ?? (shopData.ratio_individual ?? 100);
      const ratioTeam = r.snapshot_ratio_team ?? (shopData.ratio_team ?? 0);

      const totalIndPart = Math.floor(totalBase * (ratioInd / 100));
      const totalTeamPool = Math.floor(totalBase * (ratioTeam / 100));

      const indPart = isMine ? totalIndPart : 0;
      const teamPart = isMeEligible ? (totalTeamPool / activeStaffCount) : 0;
      const myEarnedPoints = Math.floor(indPart + teamPart);

      if (!isCanceled && (isMine || isMeEligible)) {
        myReferrals.push({ 
          ...r, 
          staffName: staffNameMap.get(r.staff_id) || '不明',
          totalPt: myEarnedPoints, 
          myIndPart: Math.floor(indPart),
          myTeamPart: Math.floor(teamPart),
          staffVisibleTotal: totalIndPart + totalTeamPool, 
          snapshot_ratio_individual: ratioInd,
          snapshot_ratio_team: ratioTeam,
          isMine, 
          hasBonus: isFirstTime && firstBonusEnabled && isMine 
        });

        if (r.status === 'pending') {
          sPending += myEarnedPoints;
        } else if (r.status === 'confirmed' || r.status === 'issued' || r.is_staff_rewarded) {
          sConfirmed += myEarnedPoints;
          sTotal += myEarnedPoints;
          if (r.is_staff_rewarded) sPaid += myEarnedPoints;
        }
      }
    });

    setStaff(staffData)
    setEditName(staffData.name)
    setEditEmail(staffData.email)
    setShop(shopData)
    setHistory(myReferrals.reverse())
    setSummary({ total: sTotal + sConfirmed, pending: sPending, confirmed: sConfirmed, paid: sPaid })
    if(!silent) setLoading(false)
  }

  useEffect(() => { if (magicToken) loadData() }, [magicToken])
  
  useEffect(() => { if (staff && shop) setShareMessage(defaultShareText) }, [staff, shop, defaultShareText])

  useEffect(() => {
    if (!staff?.shop_id) return;
    const channel = supabase
      .channel('member-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'referrals', filter: `shop_id=eq.${staff.shop_id}` }, () => loadData(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'point_transactions', filter: `shop_id=eq.${staff.shop_id}` }, () => loadData(true))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [staff?.shop_id]);

  const handleCopy = (url: string) => {
    navigator.clipboard.writeText(url)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

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
      setResetResult({ success: true, message: '新しい暗証番号を送信しました。\nメールをご確認ください。' })
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
    setIsEditMode(false); setEditName(staff.name); setEditEmail(staff.email); setCurrentPinInput(''); setNewPinInput(''); setProfileError('')
  }

  const handleExchangePay = async () => {
    const pt = exchangeType === 'all' ? summary.confirmed : Number(exchangeAmount);
    if (pt <= 0 || pt > summary.confirmed) {
      alert('交換可能なポイント数が正しくありません。'); return;
    }
    setIsExchanging(true);
    await new Promise(resolve => setTimeout(resolve, 1500)); 
    alert(`${pt.toLocaleString()}pt を えらべるPay に交換申請しました。\n（※現在はテスト環境です）`);
    setIsExchanging(false); setIsExchangeModalOpen(false); setExchangeAmount(''); loadData(true);
  }

  const handleExecuteShare = () => {
    if (shareTarget === 'line') {
      window.open(`https://line.me/R/msg/text/?${encodeURIComponent(shareMessage)}`, '_blank')
    } else {
      window.location.href = `mailto:?subject=${encodeURIComponent(shop?.name + 'からのご案内')}&body=${encodeURIComponent(shareMessage)}`
    }
    setIsShareModalOpen(false)
  }

  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (lockoutUntil) { const interval = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(interval) }
  }, [lockoutUntil])

  const pendingReferrals = useMemo(() => {
    return history.filter(r => r.status === 'pending')
  }, [history])

  const formatDateYMD = (isoString: string) => {
    const d = new Date(isoString);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}/${m}/${day}`;
  }

  const formatDateTime = (isoString: string) => {
    const d = new Date(isoString);
    return `${d.toLocaleDateString('ja-JP')} ${d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}`;
  }

  // ==========================================
  // レンダー
  // ==========================================
  if (loading) return <div className="fixed inset-0 flex items-center justify-center bg-[#fffef2]"><Loader2 className="w-8 h-8 animate-spin text-[#1a1a1a]" /></div>
  if (!staff) return <div className="fixed inset-0 flex items-center justify-center bg-[#fffef2] text-[#666666] text-base">ページが見つかりません。</div>

  return (
    <div className="fixed inset-0 bg-[#fffef2] flex justify-center font-sans text-[#333333] overflow-hidden selection:bg-[#e6e2d3] selection:text-[#333333]">
      <div className="w-full max-w-md bg-[#fffef2] h-full relative shadow-sm border-x border-[#e6e2d3] flex flex-col overflow-hidden">
      
        {/* ==========================================
            LOCK SCREEN
        ========================================== */}
        {!isUnlocked ? (
          <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center p-6 bg-[#fffef2]">
            <div className="w-full max-w-sm animate-in fade-in zoom-in-95 duration-500">
              <div className="text-center mb-12">
                <h1 className="text-2xl font-serif tracking-[0.2em] text-[#1a1a1a] mb-8">Duacel.</h1>
                <p className="text-sm font-bold text-[#666666] mb-2">{shop?.name}</p>
                <h2 className="text-xl text-[#1a1a1a] mb-6">{staff.name}</h2>
                <p className="text-sm text-[#999999] leading-relaxed">アクセスするには4桁の暗証番号を<br/>入力してください。</p>
              </div>
              <div className={`flex justify-center gap-4 mb-10 ${pinError ? 'animate-[shake_0.5s_ease-in-out]' : ''}`}>
                {pin.map((digit, index) => (
                  <input key={index} ref={pinInputRefs[index]} type="password" inputMode="numeric" maxLength={1} value={digit} onChange={(e) => handlePinChange(index, e.target.value)} onKeyDown={(e) => handlePinKeyDown(index, e)}
                    className={`w-16 h-20 text-center text-2xl font-medium rounded-none border-none outline-none transition-all ${pinError ? 'bg-[#fcf0f0] text-[#8a3c3c]' : 'bg-[#f5f2e6] text-[#333333] focus:ring-1 focus:ring-[#333333]'}`}
                  />
                ))}
              </div>
              <div className="h-10 flex flex-col items-center">
                {pinError ? (<><p className="text-center text-sm text-[#8a3c3c] animate-in fade-in mb-1">暗証番号が異なります</p><p className="text-xs text-[#999999]">残り試行回数: <span className="text-[#8a3c3c]">{attemptsLeft}回</span></p></>) : null}
              </div>
              <div className="mt-10 text-center"><button onClick={() => setIsForgotPinOpen(true)} className="text-sm text-[#666666] hover:text-[#1a1a1a] underline underline-offset-4 transition-colors">暗証番号を忘れた方</button></div>
            </div>
            
            <AnimatePresence>
              {isForgotPinOpen && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[110] bg-[#1a1a1a]/60 backdrop-blur-sm flex flex-col justify-end p-4 sm:p-6">
                  <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'tween', duration: 0.3 }} className="bg-[#fffef2] p-8 w-full max-w-md mx-auto relative overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.2)]">
                    <button onClick={() => setIsForgotPinOpen(false)} className="absolute top-4 right-4 p-3 text-[#999999] hover:text-[#333333]"><X className="w-6 h-6" /></button>
                    <h3 className="text-lg text-[#1a1a1a] mb-4">暗証番号の再設定</h3>
                    <p className="text-sm text-[#666666] leading-relaxed mb-6">ご登録のメールアドレスを入力してください。<br/>新しい暗証番号を送信します。</p>
                    <form onSubmit={handleForgotPin} className="space-y-6">
                      <input type="email" required placeholder="example@email.com" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} disabled={isResetting} className="w-full px-4 py-5 bg-[#f5f2e6] border-none rounded-none text-base text-[#333333] focus:ring-1 focus:ring-[#333333] outline-none" />
                      {resetResult && (
                        <div className={`p-4 text-sm flex items-start gap-2 whitespace-pre-wrap ${resetResult.success ? 'bg-[#f4f8f4] text-[#2d5a2d]' : 'bg-[#fcf0f0] text-[#8a3c3c]'}`}>
                          {resetResult.message}
                        </div>
                      )}
                      <button type="submit" disabled={isResetting || !forgotEmail} className="w-full py-5 bg-[#1a1a1a] text-[#fffef2] text-sm uppercase tracking-widest font-medium transition-all active:scale-[0.98] flex justify-center items-center gap-2 disabled:opacity-50">
                        {isResetting ? <Loader2 className="w-5 h-5 animate-spin" /> : '送信する'}
                      </button>
                    </form>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          <>
            {/* ==========================================
                MAIN APP HEADER
            ========================================== */}
            <header className="px-6 pt-safe-top pb-4 pt-6 flex items-start justify-between border-b border-[#e6e2d3] bg-[#fffef2]/90 backdrop-blur-md z-20 shrink-0">
              {/* 左：店舗情報 */}
              <div className="flex flex-col items-start gap-2">
                <h1 className="text-base text-[#1a1a1a] font-bold">{shop?.name}</h1>
                {shop?.shop_categories?.label && (
                  <span className="px-2 py-1 text-[10px] border border-[#e6e2d3] bg-[#f5f2e6] text-[#666666] tracking-wider flex items-center gap-1">
                    <Award className="w-3 h-3" /> {shop.shop_categories.label}
                  </span>
                )}
              </div>
              
              {/* 右：ユーザー情報 */}
              <div className="flex flex-col items-end gap-2 text-right">
                <div className="flex items-baseline gap-1">
                  <span className="text-[10px] text-[#999999] tracking-wider font-inter">NAME:</span>
                  <h1 className="text-base text-[#1a1a1a]">{staff.name}</h1>
                </div>
                <div className="flex items-center gap-2">
                  {isOwner && (
                    <button onClick={() => setIsOwnerModalOpen(true)} className="px-2 py-1 text-[10px] border border-[#e6e2d3] bg-[#f5f2e6] text-[#666666] tracking-wider uppercase flex items-center gap-1 active:scale-95 transition-transform">
                      <Crown className="w-3 h-3"/> Owner
                    </button>
                  )}
                  {staff.is_team_pool_eligible !== false && (
                    <button onClick={() => setIsTeamModalOpen(true)} className="px-2 py-1 text-[10px] border border-[#e6e2d3] bg-[#f5f2e6] text-[#666666] tracking-wider uppercase flex items-center gap-1 active:scale-95 transition-transform">
                      <Handshake className="w-3 h-3"/> Team
                    </button>
                  )}
                </div>
              </div>
            </header>

            <main className="flex-1 relative overflow-hidden bg-[#fffef2]">
              <AnimatePresence mode="wait">
                <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="absolute inset-0 overflow-y-auto pb-32 pt-6 px-6 -webkit-overflow-scrolling-touch">
                  
                  {/* 📊 TAB 1: ウォレット (Stats) */}
                  {activeTab === 'stats' && (
                    <div className="max-w-md mx-auto space-y-8">
                      
                      {/* ★ オーナー専用 管理ダッシュボードボタン */}
                      {isOwner && (
                        <button onClick={() => router.push('/dashboard')} className="w-full py-4 bg-[#1a1a1a] text-[#fffef2] text-sm tracking-widest transition-all active:scale-[0.98] flex items-center justify-center gap-2 mb-2">
                          <LayoutDashboard className="w-5 h-5" strokeWidth={1.5} /> 管理ダッシュボードを開く
                        </button>
                      )}

                      {/* ★ メインウォレット */}
                      <div className="bg-[#f5f2e6] border-y border-[#e6e2d3] py-6 px-6 -mx-6 shadow-[0_0_20px_rgba(0,0,0,0.03)] relative overflow-hidden -mt-6 mb-0">
                        <p className="text-sm text-[#666666] mb-3 tracking-wider">交換可能な確定ポイント</p>
                        <div className="flex items-center justify-between">
                          <p className="text-3xl font-sans tabular-nums tracking-tight text-[#1a1a1a]">{summary.confirmed.toLocaleString()}<span className="text-sm ml-1 text-[#999999]">pt</span></p>
                          <button onClick={() => setIsExchangeModalOpen(true)} className="px-5 py-3 bg-[#1a1a1a] text-[#fffef2] text-xs tracking-widest active:scale-[0.98] transition-transform">
                            ポイント交換
                          </button>
                        </div>
                      </div>

                      {/* 確定待ち */}
                      <div className="bg-[#fffef2] border-b border-[#e6e2d3] py-4 flex flex-col justify-center">
                        <p className="text-xs text-[#666666] mb-1 tracking-wider">確定待ち（仮計上）</p>
                        <p className="text-2xl font-sans tabular-nums tracking-tight text-[#333333]">{summary.pending.toLocaleString()}<span className="text-sm ml-1 text-[#999999]">pt</span></p>
                      </div>

                      {/* 紹介履歴 (報酬未確定) */}
                      {pendingReferrals.length > 0 && (
                        <div className="pt-2">
                          <h2 className="text-sm text-[#1a1a1a] mb-1">紹介履歴（報酬未確定）</h2>
                          <p className="text-[10px] text-[#666666] mb-4">商品のお届け完了後にポイントが発行されます。</p>
                          <div className="space-y-0">
                            {pendingReferrals.map((item) => (
                              <button key={item.id} onClick={() => setSelectedDetail({ type: 'referral', data: item })} className="w-full text-left bg-transparent border-b border-[#e6e2d3] first:border-t py-4 flex justify-between items-center active:bg-[#f5f2e6] transition-colors">
                                <div className="flex items-start gap-3 flex-1">
                                  <div className="w-[72px] shrink-0 flex flex-col gap-1.5 pt-1">
                                    <span className="text-xs text-[#999999] tabular-nums leading-none">{formatDateYMD(item.created_at)}</span>
                                    <span className="text-xs bg-[#a24343] text-[#fffef2] border border-[#a24343] px-1 py-1 text-center leading-none">仮計上</span>
                                  </div>
                                  <div className="flex-1 flex flex-col">
                                    <p className="text-sm text-[#333333] mb-1 leading-snug">
                                      {item.customer_name || '匿名のお客様'} <span className="text-[#999999] text-sm">[{item.recurring_count > 1 ? `定期${item.recurring_count}` : '初回'}]</span>
                                    </p>
                                    <p className="text-sm text-[#666666]">担当: {item.staffName}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0 pl-2">
                                  <p className="text-lg font-sans tabular-nums text-[#1a1a1a]">+{item.staffVisibleTotal?.toLocaleString()} <span className="text-[10px] text-[#999999]">pt</span></p>
                                  <ChevronRight className="w-4 h-4 text-[#999999]" />
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* ポイント獲得履歴 */}
                      <div className="pt-2">
                        <h2 className="text-sm text-[#1a1a1a] mb-4">ポイント獲得履歴</h2>
                        <div className="space-y-0">
                          {history.length === 0 ? (
                            <div className="text-center py-10 text-[#999999] text-sm">まだ実績がありません</div>
                          ) : (
                            history.map((item) => {
                              const isPending = item.status === 'pending';
                              const isCanceled = item.status === 'cancel';
                              if (isPending) return null; 
                              
                              return (
                                <button key={item.id} onClick={() => setSelectedDetail({ type: 'referral', data: item })} className="w-full text-left bg-transparent border-b border-[#e6e2d3] first:border-t py-4 flex justify-between items-center active:bg-[#f5f2e6] transition-colors">
                                  <div className="flex items-start gap-3 flex-1">
                                    <div className="w-[72px] shrink-0 flex flex-col gap-1.5 pt-1">
                                      <span className="text-xs text-[#999999] tabular-nums leading-none">{formatDateYMD(item.created_at)}</span>
                                      {isCanceled ? (
                                        <span className="text-xs bg-[#dddddd] text-[#616161] border border-[#cbcbcb] px-1 py-1 text-center leading-none">無効</span>
                                      ) : (
                                        <span className="text-xs bg-[#daebd8] text-[#488c3d] border border-[#94d986] px-1 py-1 text-center leading-none">報酬確定</span>
                                      )}
                                    </div>
                                    <div className="flex-1 flex flex-col">
                                      <p className={`text-sm text-[#333333] mb-1 leading-snug ${isCanceled ? 'line-through text-[#999999]' : ''}`}>
                                        {item.customer_name || '匿名のお客様'} <span className="text-[#999999] text-sm">[{item.recurring_count > 1 ? `定期${item.recurring_count}` : '初回'}]</span>
                                      </p>
                                      <p className="text-sm text-[#666666]">担当: {item.staffName}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0 pl-2">
                                    <p className={`text-lg font-sans tabular-nums ${isCanceled ? 'line-through text-[#999999]' : 'text-[#1a1a1a]'}`}>
                                      +{item.totalPt.toLocaleString()} <span className="text-[10px] text-[#999999]">pt</span>
                                    </p>
                                    <ChevronRight className="w-4 h-4 text-[#999999]" />
                                  </div>
                                </button>
                              )
                            })
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 🛒 TAB 2: 仕入れ (Shop) */}
                  {activeTab === 'shop' && (
                    <div className="max-w-md mx-auto space-y-8">
                      <div className="bg-[#fffef2] border-b border-[#e6e2d3] py-4 flex items-center justify-between">
                        <p className="text-sm text-[#666666] tracking-wider">保有ポイント</p>
                        <p className="text-2xl font-sans tabular-nums tracking-tight text-[#333333]">{summary.confirmed.toLocaleString()}<span className="text-sm ml-1 text-[#999999]">pt</span></p>
                      </div>

                      <div className="space-y-4">
                        {MOCK_PRODUCTS.map(product => {
                          return (
                            <button 
                              key={product.id} 
                              onClick={() => setSelectedDetail({ type: 'shop', data: product })}
                              className="w-full text-left bg-[#fffef2] border border-[#e6e2d3] p-5 shadow-[0_0_20px_rgba(0,0,0,0.03)] flex gap-5 items-center active:bg-[#f5f2e6] transition-colors"
                            >
                              <div className="w-16 h-16 bg-[#f5f2e6] flex items-center justify-center shrink-0">
                                {product.icon}
                              </div>
                              <div className="flex-1">
                                <h3 className="text-sm text-[#333333] mb-2">{product.name}</h3>
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="text-xs text-[#999999] line-through">¥{product.price.toLocaleString()}</p>
                                    <p className="text-base font-sans tabular-nums text-[#1a1a1a]">
                                      {product.ptPrice.toLocaleString()}<span className="text-xs text-[#666666] ml-1">pt</span>
                                    </p>
                                  </div>
                                  <ChevronRight className="w-5 h-5 text-[#999999]" />
                                </div>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* 📱 TAB 3: QRコード (メイン・プレゼン画面化) */}
                  {activeTab === 'qr' && (
                    <div className="flex flex-col items-center max-w-sm mx-auto pb-10 pt-2">
                      {/* プレゼン用ヘッダーテキスト */}
                      <div className="w-full text-center mb-6">
                        <h2 className="text-3xl font-black font-inter tracking-normal text-[#1a1a1a] mb-2">Duacel<sup className="text-lg font-medium -ml-0.5">®</sup></h2>
                        <p className="text-sm text-[#666666] tracking-widest font-bold">{shop?.name}</p>
                        <p className="text-sm text-[#1a1a1a] tracking-widest mt-1">{staff.name} のご紹介</p>
                      </div>

                      {/* 全体を包含するプレゼンカード */}
                      <div className="w-full bg-[#f5f2e6] border border-[#e6e2d3] shadow-[0_0_30px_rgba(0,0,0,0.04)] flex flex-col items-center mb-8 overflow-hidden">
                        
                        {/* ★ 画像配置エリア */}
                        <div className="w-full aspect-[4/3] bg-[#e6e2d3] relative border-b border-[#e6e2d3]">
                          <img src="/qr-hero.jpg" alt="Duacel Benefit" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                          <div className="absolute inset-0 flex items-center justify-center text-[#999999] text-xs -z-10">
                            [ Image: /qr-hero.jpg ]
                          </div>
                        </div>

                        {/* QRとアクションボタン群 */}
                        <div className="w-full p-8 flex flex-col items-center">
                          <div className="p-4 bg-[#ffffff] border border-[#e6e2d3] mb-6">
                            <QRCodeCanvas value={referralUrl} size={180} level={"H"} fgColor="#1a1a1a" />
                          </div>
                          <p className="text-sm text-[#666666] tracking-widest text-center leading-relaxed mb-6">お客様のスマートフォンで<br/>読み込んでください</p>
                          
                          <div className="w-full space-y-3">
                            <button onClick={() => handleCopy(referralUrl)} className="w-full bg-[#fffef2] border border-[#e6e2d3] p-4 flex items-center justify-between hover:bg-[#ffffff] transition-colors active:scale-[0.98]">
                              <div className="flex items-center gap-3">
                                {copied ? <CheckCircle2 className="w-5 h-5 text-[#333333]" /> : <Copy className="w-5 h-5 text-[#333333]" />}
                                <span className="text-sm text-[#333333]">{copied ? 'URLをコピーしました' : '紹介URLをコピー'}</span>
                              </div>
                              <ChevronRight className="w-5 h-5 text-[#999999]" />
                            </button>
                            
                            <button onClick={() => { setShareTarget('line'); setIsShareModalOpen(true); }} className="w-full bg-[#fffef2] border border-[#e6e2d3] p-4 flex items-center justify-between hover:bg-[#ffffff] transition-colors active:scale-[0.98]">
                              <div className="flex items-center gap-3">
                                <MessageCircle className="w-5 h-5 text-[#333333]" />
                                <span className="text-sm text-[#333333]">LINEで送信</span>
                              </div>
                              <ChevronRight className="w-5 h-5 text-[#999999]" />
                            </button>
                            
                            <button onClick={() => { setShareTarget('email'); setIsShareModalOpen(true); }} className="w-full bg-[#fffef2] border border-[#e6e2d3] p-4 flex items-center justify-between hover:bg-[#ffffff] transition-colors active:scale-[0.98]">
                              <div className="flex items-center gap-3">
                                <Mail className="w-5 h-5 text-[#333333]" />
                                <span className="text-sm text-[#333333]">メールで送信</span>
                              </div>
                              <ChevronRight className="w-5 h-5 text-[#999999]" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 📖 TAB 4: マニュアル (Info) */}
                  {activeTab === 'info' && (
                    <div className="max-w-md mx-auto space-y-6">
                      <p className="text-sm text-[#666666] tracking-wider mb-2">ドキュメント・マニュアル</p>
                      <div className="space-y-3">
                        {[
                          { icon: <LayoutDashboard className="w-5 h-5"/>, title: '使い方ガイド', desc: 'アプリの操作方法' },
                          { icon: <ShoppingBag className="w-5 h-5"/>, title: '製品カタログ', desc: '成分や効果の詳細' },
                          { icon: <MessageCircle className="w-5 h-5"/>, title: 'トーク集', desc: 'お客様へのご案内' },
                          { icon: <PlayCircle className="w-5 h-5"/>, title: '施術動画', desc: '機器の利用手順' },
                        ].map((item, i) => (
                          <button key={i} onClick={() => alert(`${item.title} を開きます`)} className="w-full bg-[#fffef2] p-5 border border-[#e6e2d3] text-left hover:bg-[#f5f2e6] transition-colors flex items-center justify-between shadow-[0_0_15px_rgba(0,0,0,0.02)] active:scale-[0.98]">
                            <div className="flex items-center gap-4">
                              <div className="text-[#333333]">{item.icon}</div>
                              <div>
                                <h3 className="text-sm text-[#1a1a1a] mb-1">{item.title}</h3>
                                <p className="text-xs text-[#999999]">{item.desc}</p>
                              </div>
                            </div>
                            <ChevronRight className="w-5 h-5 text-[#999999]" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ⚙️ TAB 5: 設定 (Settings) */}
                  {activeTab === 'settings' && (
                    <div className="max-w-md mx-auto space-y-8 pb-10">
                      <div className="flex justify-between items-center">
                        <p className="text-sm text-[#666666] tracking-wider">アカウント情報</p>
                        {!isOwner && (
                          !isEditMode ? (
                            <button onClick={() => setIsEditMode(true)} className="text-xs text-[#333333] border border-[#e6e2d3] bg-[#f5f2e6] px-4 py-2 hover:bg-[#e6e2d3] active:scale-[0.98] transition-all">編集する</button>
                          ) : (
                            <button onClick={handleCancelEdit} className="text-xs text-[#666666] px-4 py-2">キャンセル</button>
                          )
                        )}
                      </div>

                      <div className="bg-[#fffef2] border border-[#e6e2d3] shadow-[0_0_20px_rgba(0,0,0,0.03)] p-6 space-y-6">
                        <div>
                          <label className="block text-xs text-[#999999] mb-2 tracking-wider uppercase">Name</label>
                          {!isEditMode ? <p className="text-base text-[#1a1a1a]">{staff.name}</p> : <input type="text" value={editName} onChange={e => setEditName(e.target.value)} className="w-full bg-[#f5f2e6] border-none px-4 py-3 text-sm text-[#333333] outline-none focus:ring-1 focus:ring-[#333333]" />}
                        </div>
                        
                        <div>
                          <label className="block text-xs text-[#999999] mb-2 tracking-wider uppercase">ID</label>
                          <p className="text-base text-[#666666]">{staff.referral_code}</p>
                        </div>

                        <div>
                          <label className="block text-xs text-[#999999] mb-2 tracking-wider uppercase">Email</label>
                          {!isEditMode ? <p className="text-base text-[#666666]">{staff.email}</p> : <input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} className="w-full bg-[#f5f2e6] border-none px-4 py-3 text-sm text-[#333333] outline-none focus:ring-1 focus:ring-[#333333]" />}
                        </div>

                        <div>
                          <label className="block text-xs text-[#999999] mb-2 tracking-wider uppercase">PIN</label>
                          {!isEditMode ? (
                            <p className="text-base text-[#666666] tracking-[0.4em]">••••</p>
                          ) : (
                            <div className="space-y-3">
                              <input type="password" inputMode="numeric" maxLength={4} placeholder="現在のPIN" value={currentPinInput} onChange={e => setCurrentPinInput(e.target.value.replace(/[^0-9]/g, ''))} className="w-full bg-[#f5f2e6] border-none px-4 py-3 text-sm tracking-widest outline-none focus:ring-1 focus:ring-[#333333]" />
                              <input type="password" inputMode="numeric" maxLength={4} placeholder="新しいPIN" value={newPinInput} onChange={e => setNewPinInput(e.target.value.replace(/[^0-9]/g, ''))} className="w-full bg-[#f5f2e6] border-none px-4 py-3 text-sm tracking-widest outline-none focus:ring-1 focus:ring-[#333333]" />
                              <p className="text-xs text-[#999999]">※変更しない場合は空欄</p>
                            </div>
                          )}
                        </div>

                        <AnimatePresence>
                          {isEditMode && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="pt-6 border-t border-[#e6e2d3]">
                              {profileError && (<div className="mb-4 text-xs text-[#8a3c3c]">{profileError}</div>)}
                              {/* ★ Primary Action (スミベタ) */}
                              <button onClick={handleSaveProfile} disabled={isSaving} className="w-full py-4 bg-[#1a1a1a] text-[#fffef2] text-sm tracking-widest disabled:opacity-50 transition-all active:scale-[0.98]">
                                {isSaving ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'SAVE CHANGES'}
                              </button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                      
                      {/* アプリ仕様：ログアウトボタンを一番下に配置 */}
                      <div className="pt-4">
                        <button onClick={handleManualLock} className="w-full py-4 border border-[#e6e2d3] bg-[#fffef2] text-[#666666] text-sm hover:bg-[#fcf0f0] hover:text-[#8a3c3c] hover:border-[#fcf0f0] transition-colors flex items-center justify-center gap-2">
                          <LogOut className="w-4 h-4" /> ログアウトする
                        </button>
                      </div>
                    </div>
                  )}
                  
                </motion.div>
              </AnimatePresence>
            </main>

            {/* ==========================================
                BOTTOM NAVIGATION (漆黒のスミベタベース)
            ========================================== */}
            <nav className="bg-[#1a1a1a] px-2 py-4 flex justify-between items-center z-50 pb-safe relative shrink-0">
              <button onClick={() => setActiveTab('stats')} className={`flex flex-col items-center justify-center gap-1.5 flex-1 transition-colors ${activeTab === 'stats' ? 'text-[#fffef2]' : 'text-[#666666] hover:text-[#999999]'}`}>
                <Wallet className="w-6 h-6" strokeWidth={1.5} />
                <span className="text-[10px] tracking-wider">STATS</span>
              </button>
              
              <button onClick={() => setActiveTab('shop')} className={`flex flex-col items-center justify-center gap-1.5 flex-1 transition-colors ${activeTab === 'shop' ? 'text-[#fffef2]' : 'text-[#666666] hover:text-[#999999]'}`}>
                <Store className="w-6 h-6" strokeWidth={1.5} />
                <span className="text-[10px] tracking-wider">SHOP</span>
              </button>

              <div className="px-4 flex-shrink-0 z-50 -mt-6">
                <button onClick={() => setActiveTab('qr')} className={`p-4 rounded-full transition-all active:scale-95 border-4 border-[#1a1a1a] ${activeTab === 'qr' ? 'bg-[#fffef2] text-[#1a1a1a]' : 'bg-[#333333] text-[#fffef2]'}`}>
                  <QrCode className="w-7 h-7" strokeWidth={1.5} />
                </button>
              </div>

              <button onClick={() => setActiveTab('info')} className={`flex flex-col items-center justify-center gap-1.5 flex-1 transition-colors ${activeTab === 'info' ? 'text-[#fffef2]' : 'text-[#666666] hover:text-[#999999]'}`}>
                <BookOpen className="w-6 h-6" strokeWidth={1.5} />
                <span className="text-[10px] tracking-wider">INFO</span>
              </button>

              <button onClick={() => setActiveTab('settings')} className={`flex flex-col items-center justify-center gap-1.5 flex-1 transition-colors ${activeTab === 'settings' ? 'text-[#fffef2]' : 'text-[#666666] hover:text-[#999999]'}`}>
                <Settings className="w-6 h-6" strokeWidth={1.5} />
                <span className="text-[10px] tracking-wider">SETTING</span>
              </button>
            </nav>

            {/* ==========================================
                ★ SHARE PREVIEW & EDIT MODAL
            ========================================== */}
            <AnimatePresence>
              {isShareModalOpen && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[100] bg-[#1a1a1a]/60 backdrop-blur-sm flex flex-col justify-end p-4 sm:p-6">
                  <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'tween', duration: 0.3 }} className="bg-[#fffef2] p-8 w-full max-w-md mx-auto relative overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.2)]">
                    <button onClick={() => setIsShareModalOpen(false)} className="absolute top-4 right-4 p-3 text-[#999999] hover:text-[#333333]"><X className="w-6 h-6" strokeWidth={1.5} /></button>
                    
                    <h3 className="text-base font-medium text-[#1a1a1a] mb-2">{shareTarget === 'line' ? 'LINEで送信' : 'メールで送信'}</h3>
                    <p className="text-xs text-[#666666] mb-6 leading-relaxed">送信するテキストを確認・編集できます。</p>
                    
                    <div className="relative mb-8">
                      <textarea 
                        value={shareMessage}
                        onChange={(e) => setShareMessage(e.target.value)}
                        className="w-full h-48 bg-[#f5f2e6] border-none p-5 text-sm text-[#333333] outline-none focus:ring-1 focus:ring-[#333333] resize-none leading-relaxed"
                      />
                      <Edit3 className="absolute right-4 bottom-4 w-4 h-4 text-[#999999] pointer-events-none" />
                    </div>

                    {/* ★ Primary Action (スミベタ) */}
                    <button onClick={handleExecuteShare} className="w-full py-5 bg-[#1a1a1a] text-[#fffef2] text-sm tracking-widest transition-all active:scale-[0.98] flex items-center justify-center gap-2">
                      <Send className="w-4 h-4" strokeWidth={1.5} /> 送信する
                    </button>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ==========================================
                EXCHANGE MODAL
            ========================================== */}
            <AnimatePresence>
              {isExchangeModalOpen && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[100] bg-[#1a1a1a]/60 backdrop-blur-sm flex items-center justify-center p-4">
                  <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }} className="bg-[#fffef2] p-8 w-full max-w-sm shadow-[0_0_40px_rgba(0,0,0,0.2)] relative">
                    <button onClick={() => setIsExchangeModalOpen(false)} className="absolute top-4 right-4 p-2 text-[#999999] hover:text-[#333333]"><X className="w-6 h-6" strokeWidth={1.5} /></button>
                    
                    <h3 className="text-base text-[#1a1a1a] mb-2">えらべるPayに交換</h3>
                    <p className="text-xs text-[#666666] mb-8 leading-relaxed">ポイントを各種電子マネーに交換します。</p>
                    
                    <div className="mb-8 pb-6 border-b border-[#e6e2d3]">
                      <p className="text-xs text-[#666666] mb-1 tracking-wider">交換可能なポイント</p>
                      <p className="text-3xl font-sans tabular-nums text-[#1a1a1a]">{summary.confirmed.toLocaleString()}<span className="text-sm text-[#999999] ml-1">pt</span></p>
                    </div>

                    <div className="space-y-4 mb-10">
                      <label className={`flex items-center gap-4 p-5 border transition-all cursor-pointer ${exchangeType === 'all' ? 'border-[#1a1a1a] bg-[#f5f2e6]' : 'border-[#e6e2d3]'}`}>
                        <input type="radio" checked={exchangeType === 'all'} onChange={() => { setExchangeType('all'); setExchangeAmount(''); }} className="w-5 h-5 accent-[#1a1a1a]" />
                        <div>
                          <p className="text-sm text-[#333333]">すべて交換する</p>
                        </div>
                      </label>
                      
                      <label className={`flex items-start gap-4 p-5 border transition-all cursor-pointer ${exchangeType === 'custom' ? 'border-[#1a1a1a] bg-[#f5f2e6]' : 'border-[#e6e2d3]'}`}>
                        <input type="radio" checked={exchangeType === 'custom'} onChange={() => setExchangeType('custom')} className="w-5 h-5 accent-[#1a1a1a] mt-1" />
                        <div className="flex-1">
                          <p className="text-sm text-[#333333] mb-3">ポイント数を指定</p>
                          <input 
                            type="number" 
                            placeholder="例: 1000" 
                            value={exchangeAmount} 
                            onChange={(e) => { setExchangeType('custom'); setExchangeAmount(e.target.value); }} 
                            disabled={exchangeType !== 'custom'}
                            className="w-full px-4 py-3 bg-[#fffef2] border border-[#e6e2d3] text-base tabular-nums focus:border-[#1a1a1a] outline-none disabled:opacity-50"
                          />
                        </div>
                      </label>
                    </div>

                    <button onClick={handleExchangePay} disabled={isExchanging || summary.confirmed <= 0} className="w-full py-5 bg-[#1a1a1a] text-[#fffef2] text-sm tracking-widest transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50">
                      {isExchanging ? <Loader2 className="w-5 h-5 animate-spin"/> : "申請する"}
                    </button>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ==========================================
                DETAIL MODAL (詳細情報表示)
            ========================================== */}
            <AnimatePresence>
              {selectedDetail && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[110] bg-[#1a1a1a]/60 backdrop-blur-sm flex flex-col justify-end p-4 sm:p-6">
                  <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'tween', duration: 0.3 }} className="bg-[#fffef2] p-8 w-full max-w-md mx-auto relative overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.2)]">
                    <button onClick={() => setSelectedDetail(null)} className="absolute top-4 right-4 p-3 text-[#999999] hover:text-[#333333]"><X className="w-6 h-6" strokeWidth={1.5} /></button>
                    
                    {selectedDetail.type === 'referral' && (
                      <>
                        <h3 className="text-base text-[#1a1a1a] mb-6 border-b border-[#e6e2d3] pb-4">実績の詳細情報</h3>
                        <div className="space-y-6 mb-8">
                          <div>
                            <p className="text-xs text-[#999999] mb-1 tracking-wider uppercase">ステータス</p>
                            <p className="text-sm text-[#333333]">
                              {selectedDetail.data.status === 'pending' ? '仮計上（確定待ち）' : selectedDetail.data.status === 'cancel' ? '無効（キャンセル）' : 'ポイント獲得済'}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-[#999999] mb-1 tracking-wider uppercase">お客様情報</p>
                            <p className="text-sm text-[#333333]">
                              {selectedDetail.data.customer_name || '匿名のお客様'} <span className="text-xs text-[#666666]">({selectedDetail.data.recurring_count > 1 ? `定期${selectedDetail.data.recurring_count}回目` : '初回購入'})</span>
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-[#999999] mb-1 tracking-wider uppercase">発生日時</p>
                            <p className="text-sm tabular-nums text-[#333333]">{formatDateTime(selectedDetail.data.created_at)}</p>
                          </div>
                          {selectedDetail.data.status !== 'pending' && (
                            <div>
                              <p className="text-xs text-[#999999] mb-1 tracking-wider uppercase">確定日時</p>
                              <p className="text-sm tabular-nums text-[#333333]">{formatDateTime(selectedDetail.data.updated_at)}</p>
                            </div>
                          )}
                          <div>
                            <p className="text-xs text-[#999999] mb-1 tracking-wider uppercase">担当スタッフ</p>
                            <p className="text-sm text-[#333333]">{selectedDetail.data.staffName}</p>
                          </div>
                          <div className="pt-6 border-t border-[#e6e2d3]">
                            <p className="text-xs text-[#999999] mb-2 tracking-wider uppercase">獲得予定 / 獲得済ポイント</p>
                            <p className={`text-3xl font-sans tabular-nums ${selectedDetail.data.status === 'cancel' ? 'line-through text-[#999999]' : 'text-[#1a1a1a]'}`}>
                              +{selectedDetail.data.totalPt.toLocaleString()}<span className="text-sm ml-1 text-[#999999]">pt</span>
                            </p>
                            
                            {/* 内訳 */}
                            <div className="mt-4 bg-[#f5f2e6] p-5">
                              <div className="flex justify-between text-sm text-[#666666] mb-3">
                                <span>対象合計</span>
                                <span className="tabular-nums">{selectedDetail.data.staffVisibleTotal?.toLocaleString()}pt</span>
                              </div>
                              <div className="flex justify-between text-sm text-[#666666] pl-3 border-l border-[#e6e2d3] mb-2">
                                <span>個人還元 ({selectedDetail.data.snapshot_ratio_individual}%)</span>
                                <span className="tabular-nums">+{selectedDetail.data.myIndPart?.toLocaleString()}pt</span>
                              </div>
                              {selectedDetail.data.myTeamPart > 0 && (
                                <div className="flex justify-between text-sm text-[#666666] pl-3 border-l border-[#e6e2d3]">
                                  <span>チーム還元 ({selectedDetail.data.snapshot_ratio_team}%)</span>
                                  <span className="tabular-nums">+{selectedDetail.data.myTeamPart?.toLocaleString()}pt</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </>
                    )}

                    {selectedDetail.type === 'shop' && (
                      <>
                        <div className="flex justify-center mb-6">
                          <div className="w-24 h-24 bg-[#f5f2e6] flex items-center justify-center rounded-full">
                            {selectedDetail.data.icon}
                          </div>
                        </div>
                        <h3 className="text-lg text-[#1a1a1a] mb-4 text-center">{selectedDetail.data.name}</h3>
                        <p className="text-sm text-[#666666] leading-relaxed mb-8">{selectedDetail.data.desc}</p>
                        
                        <div className="bg-[#f5f2e6] border border-[#e6e2d3] p-5 mb-8 flex justify-between items-end">
                          <div>
                            <p className="text-xs text-[#999999] mb-1 line-through">通常価格: ¥{selectedDetail.data.price.toLocaleString()}</p>
                            <p className="text-xs text-[#666666] tracking-wider uppercase">交換必要ポイント</p>
                          </div>
                          <p className="text-2xl font-sans tabular-nums text-[#1a1a1a]">
                            {selectedDetail.data.ptPrice.toLocaleString()}<span className="text-sm ml-1 text-[#999999]">pt</span>
                          </p>
                        </div>
                        
                        {/* ★ Primary Action (スミベタ) */}
                        <button 
                          onClick={() => {
                            alert('※ 購入フローへ遷移します');
                            setSelectedDetail(null);
                          }} 
                          className={`w-full py-5 text-sm tracking-widest transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${summary.confirmed >= selectedDetail.data.ptPrice ? 'bg-[#1a1a1a] text-[#fffef2]' : 'bg-transparent border border-[#e6e2d3] text-[#666666]'}`}
                        >
                          {summary.confirmed >= selectedDetail.data.ptPrice ? '交換手続きへ進む' : 'ポイント不足（購入へ進む）'}
                        </button>
                      </>
                    )}
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ==========================================
                ★ BADGE INFO MODAL (オーナー/チーム)
            ========================================== */}
            <AnimatePresence>
              {isOwnerModalOpen && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[110] bg-[#1a1a1a]/60 backdrop-blur-sm flex flex-col justify-end p-4 sm:p-6">
                  <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'tween', duration: 0.3 }} className="bg-[#fffef2] p-8 w-full max-w-md mx-auto relative overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.2)]">
                    <button onClick={() => setIsOwnerModalOpen(false)} className="absolute top-4 right-4 p-3 text-[#999999] hover:text-[#333333]"><X className="w-6 h-6" strokeWidth={1.5} /></button>
                    
                    <div className="w-12 h-12 bg-[#f5f2e6] rounded-full flex items-center justify-center mb-6">
                      <Crown className="w-6 h-6 text-[#1a1a1a]" strokeWidth={1.5} />
                    </div>
                    <h3 className="text-lg text-[#1a1a1a] mb-4">オーナー権限について</h3>
                    <div className="text-sm text-[#666666] leading-relaxed mb-8 space-y-3">
                      <p>あなたはこの店舗のオーナーです。</p>
                      <p>管理ダッシュボードにアクセスすることで、以下の機能をご利用いただけます。</p>
                      <ul className="list-disc pl-5 space-y-1 mt-2 text-[#333333]">
                        <li>店舗情報の編集</li>
                        <li>スタッフの招待・管理</li>
                        <li>還元・分配率の変更</li>
                        <li>店舗全体の売上・実績確認</li>
                      </ul>
                    </div>
                    
                    <button onClick={() => { setIsOwnerModalOpen(false); router.push('/dashboard'); }} className="w-full py-5 bg-[#1a1a1a] text-[#fffef2] text-sm tracking-widest transition-all active:scale-[0.98] flex items-center justify-center gap-2">
                      <LayoutDashboard className="w-5 h-5" strokeWidth={1.5} /> 管理ダッシュボードへ
                    </button>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {isTeamModalOpen && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[110] bg-[#1a1a1a]/60 backdrop-blur-sm flex flex-col justify-end p-4 sm:p-6">
                  <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'tween', duration: 0.3 }} className="bg-[#fffef2] p-8 w-full max-w-md mx-auto relative overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.2)]">
                    <button onClick={() => setIsTeamModalOpen(false)} className="absolute top-4 right-4 p-3 text-[#999999] hover:text-[#333333]"><X className="w-6 h-6" strokeWidth={1.5} /></button>
                    
                    <div className="w-12 h-12 bg-[#f5f2e6] rounded-full flex items-center justify-center mb-6">
                      <Handshake className="w-6 h-6 text-[#1a1a1a]" strokeWidth={1.5} />
                    </div>
                    <h3 className="text-lg text-[#1a1a1a] mb-4">チーム還元について</h3>
                    <div className="text-sm text-[#666666] leading-relaxed mb-8 space-y-3">
                      <p>あなたはこの店舗の「チーム還元」対象スタッフです。</p>
                      <p>
                        店舗全体で発生したポイントの一部が、チームメンバー全員に平等に分配（還元）されます。
                        <br/>
                        （自分が紹介したお客様でなくても、店舗の売上が上がることでポイントを獲得できます）
                      </p>
                    </div>
                    
                    {isOwner ? (
                      <button onClick={() => { setIsTeamModalOpen(false); router.push('/dashboard'); }} className="w-full py-5 bg-[#1a1a1a] text-[#fffef2] text-sm tracking-widest transition-all active:scale-[0.98] flex items-center justify-center gap-2">
                        分配率を設定する（管理画面）
                      </button>
                    ) : (
                      <button onClick={() => setIsTeamModalOpen(false)} className="w-full py-5 bg-[#f5f2e6] border border-[#e6e2d3] text-[#333333] text-sm tracking-widest transition-all active:scale-[0.98] flex items-center justify-center gap-2">
                        閉じる
                      </button>
                    )}
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

          </>
        )}
      </div>
    </div>
  )
}