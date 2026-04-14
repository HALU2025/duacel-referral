'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion' 

import { 
  ArrowRight, ArrowLeft, Loader2, Phone, KeyRound, Store, User, 
  ChevronRight, ShieldAlert, Plus, Lock, CheckCircle2, LogIn, X,
  MessageCircle, Mail, Send, Edit3, Share2
} from 'lucide-react'

// ==========================================
// ヘルパー関数
// ==========================================
const generateSecureToken = () => {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

const generateReferralCode = () => {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  return 'ref_' + Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

const formatPhoneNumber = (num: string) => {
  const cleaned = num.replace(/[^0-9]/g, '')
  if (cleaned.startsWith('0')) return '+81' + cleaned.slice(1)
  return '+' + cleaned
}

const swipeVariants = {
  enter: (direction: number) => ({ x: direction > 0 ? 20 : -20, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({ x: direction < 0 ? 20 : -20, opacity: 0 })
}

const DEFAULT_AVATAR = '/avatars/default.png'

export default function PortalPage() {
  const params = useParams()
  const token = params.token as string // URLパラメータ (例: /p/aB3dE6gH)
  const router = useRouter()

  // ==========================================
  // 状態管理 (全体)
  // ==========================================
  const [appMode, setAppMode] = useState<'loading' | 'setup' | 'portal'>('loading')
  const [shop, setShop] = useState<any>(null)
  const [staffList, setStaffList] = useState<any[]>([])
  
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  // ==========================================
  // 状態管理 (State 1: Setup モード)
  // ==========================================
  const [[setupStep, direction], setStepDirection] = useState([1, 0])
  const [phone, setPhone] = useState('') 
  const [otp, setOtp] = useState('')
  const [shopName, setShopName] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [setupPin, setSetupPin] = useState('')

  // ==========================================
  // 状態管理 (State 2: Portal モード)
  // ==========================================
  const [selectedStaff, setSelectedStaff] = useState<any>(null)
  const [loginPin, setLoginPin] = useState(['', '', '', ''])
  const [loginPinError, setLoginPinError] = useState(false)
  const pinInputRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)]

  // ★ パス1: この店舗に参加する (Join)
  const [isAddStaffOpen, setIsAddStaffOpen] = useState(false)
  const [newStaffName, setNewStaffName] = useState('')
  const [newStaffPin, setNewStaffPin] = useState('')

  // ★ パス2: メンバーを招待する (Invite)
  const [isInviteOpen, setIsInviteOpen] = useState(false)
  const [inviteTarget, setInviteTarget] = useState<'line' | 'email'>('line')
  const [inviteMessage, setInviteMessage] = useState('')

  // 管理者ログイン
  const [isAdminAuthOpen, setIsAdminAuthOpen] = useState(false)
  const [adminAuthStep, setAdminAuthStep] = useState<1 | 2>(1)
  const [adminPhone, setAdminPhone] = useState('')
  const [adminOtp, setAdminOtp] = useState('')

  // ==========================================
  // 初期ロード：トークンの状態(State)を判定
  // ==========================================
  useEffect(() => {
    const checkTokenState = async () => {
      if (!token) return

      // invite_tokenとして店舗が存在するか確認
      const { data: shopData } = await supabase
        .from('shops')
        .select('*')
        .eq('invite_token', token)
        .maybeSingle()

      if (shopData) {
        // 店舗が存在する -> State 2: ポータル画面へ
        setShop(shopData)
        await loadStaffList(shopData.id)
        
        // 招待メッセージの初期設定
        const portalUrl = typeof window !== 'undefined' ? window.location.href : `https://duacel.net/p/${token}`
        setInviteMessage(`【${shopData.name}】Duacelのスタッフポータルへ招待されました。\n以下のURLからアクセスし、「この店舗に参加する」からプロフィールの登録をお願いします。\n\n${portalUrl}`)
        
        setAppMode('portal')
      } else {
        // 店舗が存在しない -> State 1: セットアップ画面へ
        setAppMode('setup')
      }
    }
    checkTokenState()
  }, [token])

  const loadStaffList = async (shopId: string) => {
    const { data } = await supabase
      .from('staffs')
      .select('*')
      .eq('shop_id', shopId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: true })
    if (data) setStaffList(data)
  }

  // ==========================================
  // 関数群 (State 1: Setup フロー)
  // ==========================================
  const goNextSetup = (step: number) => { setErrorMessage(''); setStepDirection([step, 1]) }
  const goBackSetup = () => { setErrorMessage(''); setStepDirection([setupStep - 1, -1]) }

  const handleSendSetupOtp = async () => {
    setErrorMessage('')
    if (phone.replace(/\D/g, '').length < 10) return setErrorMessage('有効な電話番号をご入力ください。')
    setIsLoading(true)
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone: formatPhoneNumber(phone) })
      if (error) throw error
      goNextSetup(2)
    } catch (err: any) { setErrorMessage('SMSの送信に失敗しました。') } 
    finally { setIsLoading(false) }
  }

  const handleVerifySetupOtp = async () => {
    setErrorMessage('')
    if (otp.length !== 6) return setErrorMessage('6桁の認証コードをご入力ください。')
    setIsLoading(true)
    try {
      const { error } = await supabase.auth.verifyOtp({ phone: formatPhoneNumber(phone), token: otp, type: 'sms' })
      if (error) throw error
      goNextSetup(3)
    } catch (err: any) { setErrorMessage('認証コードが正しくないか、有効期限切れです。') } 
    finally { setIsLoading(false) }
  }

  const handleProfileSubmit = () => {
    setErrorMessage('')
    if (!shopName.trim()) return setErrorMessage('店舗名をご入力ください。')
    if (!ownerName.trim()) return setErrorMessage('管理者名をご入力ください。')
    goNextSetup(4)
  }

  const handleRegisterShopAndOwner = async () => {
    setErrorMessage('')
    if (setupPin.length !== 4) return setErrorMessage('4桁の暗証番号を設定してください。')
    setIsLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('認証エラーです。最初からやり直してください。')

      // 1. 店舗(Shop)の作成
      const { data: newShop, error: shopErr } = await supabase
        .from('shops').insert([{ name: shopName.trim(), owner_id: user.id, invite_token: token }])
        .select('id').single()
      if (shopErr) throw new Error('店舗の作成に失敗しました。')

      // 2. オーナー(Staff)の作成
      const secretToken = generateSecureToken()
      const { error: staffErr } = await supabase.from('staffs').insert([{
        id: user.id,
        shop_id: newShop.id, 
        name: ownerName.trim(), 
        phone: formatPhoneNumber(phone),
        role: 'owner', 
        referral_code: generateReferralCode(), 
        secret_token: secretToken, 
        security_pin: setupPin, 
        is_deleted: false,
        is_team_pool_eligible: true
      }])
      if (staffErr) throw new Error('アカウントの作成に失敗しました。')

      // 3. 自動ログイン＆遷移
      sessionStorage.setItem(`duacel_auth_${secretToken}`, 'true')
      router.replace(`/m/${secretToken}`)
    } catch (err: any) { setErrorMessage(err.message) } 
    finally { setIsLoading(false) }
  }

  // ==========================================
  // 関数群 (State 2: Portal フロー)
  // ==========================================

  // [既存ログイン]
  const handlePinChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return; 
    const newPin = [...loginPin]; newPin[index] = value.slice(-1); setLoginPin(newPin); setLoginPinError(false);

    if (value && index < 3) pinInputRefs[index + 1].current?.focus()
    if (index === 3 && value) {
      const enteredPin = newPin.join('')
      if (!selectedStaff.security_pin || enteredPin === selectedStaff.security_pin) { 
        sessionStorage.setItem(`duacel_auth_${selectedStaff.secret_token}`, 'true')
        router.push(`/m/${selectedStaff.secret_token}`)
      } else {
        setLoginPinError(true); 
        setTimeout(() => setLoginPin(['', '', '', '']), 500); 
        pinInputRefs[0].current?.focus()
      }
    }
  }

  // ★ [参加: Join] メアド不要の最速ジョイン
  const handleAddNewStaff = async () => {
    setErrorMessage('')
    if (!newStaffName.trim()) return setErrorMessage('名前を入力してください。')
    if (newStaffPin.length !== 4) return setErrorMessage('4桁のPINを入力してください。')

    setIsLoading(true)
    try {
      const secretToken = generateSecureToken()
      const { error } = await supabase.from('staffs').insert([{
        shop_id: shop.id, 
        name: newStaffName.trim(), 
        role: 'staff', 
        referral_code: generateReferralCode(), 
        secret_token: secretToken, 
        security_pin: newStaffPin, 
        is_deleted: false,
        is_team_pool_eligible: true
      }])

      if (error) throw new Error('スタッフの追加に失敗しました。')

      sessionStorage.setItem(`duacel_auth_${secretToken}`, 'true')
      router.push(`/m/${secretToken}`)
    } catch (err: any) {
      setErrorMessage(err.message)
      setIsLoading(false)
    }
  }

  // ★ [招待: Invite] LINE/メール送信実行
  const handleExecuteInvite = () => {
    if (inviteTarget === 'line') {
      window.open(`https://line.me/R/msg/text/?${encodeURIComponent(inviteMessage)}`, '_blank')
    } else {
      window.location.href = `mailto:?subject=${encodeURIComponent(shop?.name + 'からの招待')}&body=${encodeURIComponent(inviteMessage)}`
    }
    setIsInviteOpen(false)
  }

  // [管理者ログイン]
  const handleSendAdminOtp = async () => {
    setErrorMessage('')
    if (adminPhone.replace(/\D/g, '').length < 10) return setErrorMessage('有効な電話番号をご入力ください。')
    setIsLoading(true)
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone: formatPhoneNumber(adminPhone) })
      if (error) throw error
      setAdminAuthStep(2)
    } catch (err: any) { setErrorMessage('SMSの送信に失敗しました。') } 
    finally { setIsLoading(false) }
  }

  const handleVerifyAdminOtp = async () => {
    setErrorMessage('')
    if (adminOtp.length !== 6) return setErrorMessage('6桁の認証コードをご入力ください。')
    setIsLoading(true)
    try {
      const { error } = await supabase.auth.verifyOtp({ phone: formatPhoneNumber(adminPhone), token: adminOtp, type: 'sms' })
      if (error) throw error
      router.push('/dashboard')
    } catch (err: any) { setErrorMessage('認証コードが正しくないか、有効期限切れです。') } 
    finally { setIsLoading(false) }
  }


  // ==========================================
  // レンダリング
  // ==========================================

  if (appMode === 'loading') {
    return <div className="fixed inset-0 flex items-center justify-center bg-[#fffef2]"><Loader2 className="w-8 h-8 animate-spin text-[#1a1a1a]" /></div>
  }

  return (
    <div className="fixed inset-0 bg-[#fffef2] flex flex-col justify-center items-center p-0 sm:p-6 font-sans text-[#333333] selection:bg-[#e6e2d3] selection:text-[#333333] overflow-hidden">
      <div className="w-full max-w-md relative flex flex-col h-[100dvh] sm:h-[85dvh] sm:min-h-[600px] sm:max-h-[850px] bg-[#fffef2] sm:border sm:border-[#e6e2d3] sm:shadow-[0_0_40px_rgba(0,0,0,0.03)] overflow-hidden">
        
        {/* ========================================================= */}
        {/* STATE 1: SETUP MODE (初期設定) */}
        {/* ========================================================= */}
        {appMode === 'setup' && (
          <>
            <div className="absolute top-8 left-0 right-0 flex flex-col items-center justify-center z-40 pointer-events-none bg-gradient-to-b from-[#fffef2] via-[#fffef2] to-transparent pb-4">
              <h1 className="text-xl font-serif tracking-[0.2em] text-[#1a1a1a]">Duacel.</h1>
              <div className="flex justify-center gap-2 mt-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className={`h-1 rounded-full transition-all duration-700 ease-in-out ${setupStep === i + 1 ? 'w-8 bg-[#1a1a1a]' : setupStep > i + 1 ? 'w-3 bg-[#999999]' : 'w-3 bg-[#e6e2d3]'}`} />
                ))}
              </div>
            </div>

            {setupStep > 1 && !isLoading && (
              <button onClick={goBackSetup} className="absolute top-8 left-6 z-50 text-[#999999] hover:text-[#1a1a1a] transition-colors p-2">
                <ArrowLeft className="w-6 h-6" strokeWidth={1.5} />
              </button>
            )}

            <div className="flex-1 relative overflow-hidden mt-24 pb-safe">
              <AnimatePresence mode="wait" custom={direction}>
                <motion.div key={setupStep} custom={direction} variants={swipeVariants} initial="enter" animate="center" exit="exit" transition={{ type: "tween", duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }} className="flex flex-col h-full px-8 pb-12 overflow-y-auto">
                  
                  {errorMessage && (
                    <div className="mb-6 p-4 bg-[#fcf0f0] text-[#8a3c3c] text-[11px] flex items-start gap-2 animate-in fade-in shrink-0">
                      <ShieldAlert className="w-4 h-4 shrink-0" strokeWidth={1.5} /> {errorMessage}
                    </div>
                  )}
                  
                  {setupStep === 1 && (
                    <div className="flex flex-col h-full justify-center">
                      <div className="mb-10 text-center">
                        <h2 className="text-xl font-bold tracking-widest text-[#1a1a1a] mb-4 uppercase">System Setup</h2>
                        <p className="text-[11px] text-[#666666] leading-relaxed tracking-wider">店舗の管理者となる方の<br/>携帯電話番号をご入力ください。</p>
                      </div>
                      <div className="space-y-6 mt-4">
                        <div className="relative">
                          <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#999999]" strokeWidth={1.5} />
                          <input type="tel" placeholder="090-0000-0000" value={phone} onChange={e => setPhone(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSendSetupOtp()} disabled={isLoading}
                            className="w-full pl-12 pr-4 py-4 bg-[#f5f2e6] border-none rounded-none text-base tracking-wider text-[#333333] focus:ring-1 focus:ring-[#1a1a1a] outline-none disabled:opacity-50" />
                        </div>
                        <button onClick={handleSendSetupOtp} disabled={isLoading || phone.length < 10} className="w-full py-5 bg-[#1a1a1a] text-[#fffef2] font-bold text-[11px] tracking-widest uppercase active:scale-[0.98] transition-all flex justify-center items-center gap-3 disabled:opacity-50">
                          {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Continue <ArrowRight className="w-4 h-4" strokeWidth={1.5} /></>}
                        </button>
                      </div>
                    </div>
                  )}

                  {setupStep === 2 && (
                    <div className="flex flex-col h-full justify-center">
                      <div className="mb-10 text-center">
                        <h2 className="text-xl font-bold tracking-widest text-[#1a1a1a] mb-4 uppercase">Verification</h2>
                        <p className="text-[11px] text-[#666666] leading-relaxed tracking-wider"><span className="font-bold text-[#1a1a1a] tracking-widest text-sm block mb-2">{phone}</span>宛に送信された認証コードを入力</p>
                      </div>
                      <div className="space-y-6 mt-4">
                        <div className="relative">
                          <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#999999]" strokeWidth={1.5} />
                          <input type="text" inputMode="numeric" maxLength={6} placeholder="000000" value={otp} onChange={e => setOtp(e.target.value.replace(/[^0-9]/g, ''))} disabled={isLoading} onKeyDown={e => e.key === 'Enter' && handleVerifySetupOtp()}
                            className="w-full pl-12 pr-4 py-5 bg-[#f5f2e6] border-none rounded-none text-2xl tracking-[0.4em] text-center font-mono text-[#333333] focus:ring-1 focus:ring-[#1a1a1a] outline-none disabled:opacity-50" />
                        </div>
                        <button onClick={handleVerifySetupOtp} disabled={isLoading || otp.length !== 6} className="w-full py-5 bg-[#1a1a1a] text-[#fffef2] font-bold text-[11px] tracking-widest uppercase active:scale-[0.98] transition-all flex justify-center items-center gap-3 disabled:opacity-50">
                          {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Verify <ArrowRight className="w-4 h-4" strokeWidth={1.5} /></>}
                        </button>
                      </div>
                    </div>
                  )}

                  {setupStep === 3 && (
                    <div className="flex flex-col h-full justify-center">
                      <div className="mb-8 text-center">
                        <h2 className="text-xl font-bold tracking-widest text-[#1a1a1a] mb-4 uppercase">Shop Profile</h2>
                        <p className="text-[11px] text-[#666666] leading-relaxed tracking-wide">システムに登録する店舗名と<br/>管理者様のお名前を入力してください。</p>
                      </div>
                      <div className="space-y-5">
                        <div>
                          <label className="block text-[11px] text-[#999999] mb-2 tracking-widest uppercase">Shop Name</label>
                          <div className="relative">
                            <Store className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#999999]" strokeWidth={1.5} />
                            <input placeholder="例: サロン 表参道店" value={shopName} onChange={e => setShopName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleProfileSubmit()} disabled={isLoading}
                              className="w-full pl-11 pr-4 py-4 bg-[#f5f2e6] border-none text-sm text-[#333333] focus:ring-1 focus:ring-[#1a1a1a] outline-none disabled:opacity-50" />
                          </div>
                        </div>
                        <div>
                          <label className="block text-[11px] text-[#999999] mb-2 tracking-widest uppercase">Your Name (Admin)</label>
                          <div className="relative">
                            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#999999]" strokeWidth={1.5} />
                            <input placeholder="例: 山田 太郎" value={ownerName} onChange={e => setOwnerName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleProfileSubmit()} disabled={isLoading}
                              className="w-full pl-11 pr-4 py-4 bg-[#f5f2e6] border-none text-sm text-[#333333] focus:ring-1 focus:ring-[#1a1a1a] outline-none disabled:opacity-50" />
                          </div>
                        </div>
                        <button onClick={handleProfileSubmit} disabled={isLoading || !ownerName.trim() || !shopName.trim()} className="w-full py-5 mt-4 bg-[#1a1a1a] text-[#fffef2] font-bold text-[11px] tracking-widest uppercase active:scale-[0.98] transition-all flex justify-center items-center gap-3 disabled:opacity-50">
                          Next <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
                        </button>
                      </div>
                    </div>
                  )}

                  {setupStep === 4 && (
                    <div className="flex flex-col h-full justify-center">
                      <div className="mb-10 text-center">
                        <h2 className="text-xl font-bold tracking-widest text-[#1a1a1a] mb-4 uppercase">Security PIN</h2>
                        <p className="text-[11px] text-[#666666] leading-relaxed tracking-wide">あなた自身のマイページへアクセスする際の<br/>4桁の暗証番号を設定してください。</p>
                      </div>
                      <div className="space-y-6 mt-4">
                        <input type="password" inputMode="numeric" maxLength={4} placeholder="••••" value={setupPin} onChange={e => setSetupPin(e.target.value.replace(/[^0-9]/g, ''))} disabled={isLoading} onKeyDown={e => e.key === 'Enter' && handleRegisterShopAndOwner()}
                          className="w-full px-4 py-5 bg-[#f5f2e6] border-none text-3xl tracking-[0.5em] text-center font-mono font-bold text-[#333333] focus:ring-1 focus:ring-[#1a1a1a] outline-none disabled:opacity-50" />
                        <button onClick={handleRegisterShopAndOwner} disabled={isLoading || setupPin.length !== 4} className="w-full py-5 bg-[#1a1a1a] text-[#fffef2] font-bold text-[11px] tracking-widest uppercase active:scale-[0.98] transition-all flex justify-center items-center gap-3 disabled:opacity-50">
                          {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Complete Setup'}
                        </button>
                      </div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </>
        )}

        {/* ========================================================= */}
        {/* STATE 2: PORTAL MODE (スタッフ一覧・ログイン・追加・招待) */}
        {/* ========================================================= */}
        {appMode === 'portal' && (
          <div className="flex flex-col h-full bg-[#faf9f6]">
            {/* ヘッダー */}
            <header className="pt-safe-top pb-6 pt-10 flex flex-col items-center justify-center bg-[#fffef2] border-b border-[#e6e2d3] shrink-0 z-10 px-6 shadow-sm">
              <h1 className="text-2xl font-serif tracking-[0.1em] text-[#1a1a1a] mb-2">Duacel.</h1>
              <p className="text-xs font-bold text-[#666666] tracking-widest">{shop?.name}</p>
            </header>

            {/* メインエリア：既存スタッフ */}
            <main className="flex-1 overflow-y-auto p-6 -webkit-overflow-scrolling-touch">
              <p className="text-[10px] text-[#999999] uppercase tracking-widest text-center mb-6">Select your profile</p>
              
              <div className="grid grid-cols-2 gap-4">
                {staffList.map(staff => (
                  <button key={staff.id} onClick={() => setSelectedStaff(staff)} className="bg-[#fffef2] border border-[#e6e2d3] p-5 flex flex-col items-center gap-3 rounded-sm hover:border-[#1a1a1a] hover:shadow-md transition-all active:scale-95 group">
                    <div className="w-16 h-16 rounded-full overflow-hidden bg-[#f5f2e6] border border-[#e6e2d3] flex items-center justify-center group-hover:scale-105 transition-transform">
                      {staff.avatar_url ? (
                        <img src={staff.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                      ) : (
                        <img src={DEFAULT_AVATAR} alt="avatar" className="w-full h-full object-cover opacity-60" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                      )}
                    </div>
                    <div className="text-center w-full">
                      <p className="text-sm font-bold text-[#1a1a1a] truncate">{staff.name}</p>
                      {staff.role === 'owner' && <span className="text-[9px] bg-[#f5f2e6] text-[#666666] px-1.5 py-0.5 mt-1 inline-block">OWNER</span>}
                    </div>
                  </button>
                ))}
              </div>
            </main>

            {/* アクションエリア：参加・招待・管理者ログイン */}
            <div className="bg-[#fffef2] border-t border-[#e6e2d3] shrink-0 pb-safe shadow-[0_-10px_30px_rgba(0,0,0,0.02)]">
              
              <div className="p-6 space-y-4">
                {/* 経路1: 自分自身の参加 (Join) */}
                <button onClick={() => setIsAddStaffOpen(true)} className="w-full py-4 bg-[#1a1a1a] text-[#fffef2] text-sm tracking-widest font-bold transition-all active:scale-[0.98] flex items-center justify-center gap-2 rounded-sm">
                  <Plus className="w-5 h-5" strokeWidth={1.5} /> この店舗に参加する
                </button>
                
                {/* 経路2: 誰かを招待 (Invite) */}
                <button onClick={() => setIsInviteOpen(true)} className="w-full py-4 bg-white border border-[#e6e2d3] text-[#333333] text-sm tracking-widest font-bold hover:bg-[#faf9f6] transition-all active:scale-[0.98] flex items-center justify-center gap-2 rounded-sm">
                  <Share2 className="w-4 h-4" strokeWidth={1.5} /> メンバーを招待する
                </button>
              </div>

              {/* 管理者ログイン */}
              <div className="px-6 pb-6 pt-2">
                <button onClick={() => setIsAdminAuthOpen(true)} className="w-full py-3 text-[10px] font-bold text-[#999999] hover:text-[#1a1a1a] flex items-center justify-center gap-1.5 transition-colors uppercase tracking-widest">
                  <LogIn className="w-3.5 h-3.5" strokeWidth={1.5}/> Admin Dashboard Login
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* モーダル群 (Portal Mode 用) */}
        {/* ========================================================= */}
        <AnimatePresence>
          
          {/* 1. スタッフ PINログイン モーダル */}
          {selectedStaff && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[100] bg-[#1a1a1a]/60 backdrop-blur-sm flex flex-col justify-end sm:justify-center p-0 sm:p-6">
              <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'tween', duration: 0.3 }} className="bg-[#fffef2] p-8 w-full max-w-md mx-auto relative shadow-[0_0_40px_rgba(0,0,0,0.2)]">
                <button onClick={() => { setSelectedStaff(null); setLoginPinError(false); setLoginPin(['','','','']); }} className="absolute top-4 right-4 p-3 text-[#999999] hover:text-[#333333]"><X className="w-6 h-6" strokeWidth={1.5} /></button>
                
                <div className="flex flex-col items-center mb-8">
                  <div className="w-20 h-20 rounded-full overflow-hidden bg-[#f5f2e6] border border-[#e6e2d3] flex items-center justify-center mb-4">
                    {selectedStaff.avatar_url ? (
                      <img src={selectedStaff.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                    ) : (
                      <img src={DEFAULT_AVATAR} alt="avatar" className="w-full h-full object-cover opacity-60" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                    )}
                  </div>
                  <h3 className="text-xl font-bold text-[#1a1a1a]">{selectedStaff.name}</h3>
                  <p className="text-[11px] text-[#666666] mt-2 tracking-wider">PINコードを入力してログイン</p>
                </div>

                <div className={`flex justify-center gap-4 mb-6 ${loginPinError ? 'animate-[shake_0.5s_ease-in-out]' : ''}`}>
                  {loginPin.map((digit, index) => (
                    <input key={index} ref={pinInputRefs[index]} type="password" inputMode="numeric" maxLength={1} value={digit} onChange={(e) => handlePinChange(index, e.target.value)} onKeyDown={(e) => { if (e.key === 'Backspace' && !loginPin[index] && index > 0) pinInputRefs[index - 1].current?.focus() }}
                      className={`w-14 h-16 text-center text-xl font-medium rounded-none border-none outline-none transition-all ${loginPinError ? 'bg-[#fcf0f0] text-[#8a3c3c]' : 'bg-[#f5f2e6] text-[#333333] focus:ring-1 focus:ring-[#333333]'}`}
                    />
                  ))}
                </div>
                <div className="h-6 text-center">
                  {loginPinError && <p className="text-xs text-[#8a3c3c] animate-in fade-in">PINコードが異なります</p>}
                </div>
              </motion.div>
            </motion.div>
          )}

          {/* ★ 2. 新規スタッフ「参加(Join)」 モーダル (メアド不要の最速フロー) */}
          {isAddStaffOpen && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[100] bg-[#1a1a1a]/60 backdrop-blur-sm flex flex-col justify-end sm:justify-center p-0 sm:p-6">
              <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'tween', duration: 0.3 }} className="bg-[#fffef2] p-8 w-full max-w-md mx-auto relative shadow-[0_0_40px_rgba(0,0,0,0.2)]">
                <button onClick={() => setIsAddStaffOpen(false)} className="absolute top-4 right-4 p-3 text-[#999999] hover:text-[#333333]"><X className="w-6 h-6" strokeWidth={1.5} /></button>
                
                <div className="mb-8">
                  <h3 className="text-lg font-bold text-[#1a1a1a] mb-2 uppercase tracking-widest">Join Store</h3>
                  <p className="text-xs text-[#666666] leading-relaxed">
                    お名前とPINを入力するだけで、<br/>
                    一瞬であなたの専用ページが発行されます。
                  </p>
                </div>

                {errorMessage && (
                  <div className="mb-4 p-3 bg-[#fcf0f0] text-[#8a3c3c] text-[11px] flex items-start gap-2">
                    <ShieldAlert className="w-4 h-4 shrink-0" strokeWidth={1.5} /> {errorMessage}
                  </div>
                )}

                <div className="space-y-6">
                  <div>
                    <label className="block text-[10px] text-[#999999] mb-1 tracking-widest uppercase">Name <span className="text-[#8a3c3c]">*</span></label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#999999]" strokeWidth={1.5} />
                      <input placeholder="例: 佐藤 花子" value={newStaffName} onChange={e => setNewStaffName(e.target.value)} disabled={isLoading}
                        className="w-full pl-11 pr-4 py-4 bg-[#f5f2e6] border-none text-sm text-[#333333] focus:ring-1 focus:ring-[#1a1a1a] outline-none disabled:opacity-50" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] text-[#999999] mb-1 tracking-widest uppercase">New PIN <span className="text-[#8a3c3c]">*</span></label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#999999]" strokeWidth={1.5} />
                      <input type="password" inputMode="numeric" maxLength={4} placeholder="4桁の数字" value={newStaffPin} onChange={e => setNewStaffPin(e.target.value.replace(/[^0-9]/g, ''))} disabled={isLoading}
                        className="w-full pl-11 pr-4 py-4 bg-[#f5f2e6] border-none text-lg tracking-[0.5em] font-mono text-[#333333] focus:ring-1 focus:ring-[#1a1a1a] outline-none disabled:opacity-50" />
                    </div>
                  </div>

                  <button onClick={handleAddNewStaff} disabled={isLoading || !newStaffName.trim() || newStaffPin.length !== 4} className="w-full py-5 bg-[#1a1a1a] text-[#fffef2] font-bold text-[11px] tracking-widest uppercase active:scale-[0.98] transition-all flex justify-center items-center gap-3 disabled:opacity-50 mt-2">
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'マイページを発行する'}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}

          {/* ★ 3. メンバーを「招待(Invite)」 モーダル */}
          {isInviteOpen && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[100] bg-[#1a1a1a]/60 backdrop-blur-sm flex flex-col justify-end sm:justify-center p-0 sm:p-6">
              <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'tween', duration: 0.3 }} className="bg-[#fffef2] p-8 w-full max-w-md mx-auto relative shadow-[0_0_40px_rgba(0,0,0,0.2)]">
                <button onClick={() => setIsInviteOpen(false)} className="absolute top-4 right-4 p-3 text-[#999999] hover:text-[#333333]"><X className="w-6 h-6" strokeWidth={1.5} /></button>
                
                <h3 className="text-base font-bold text-[#1a1a1a] mb-2">メンバーを招待する</h3>
                <p className="text-xs text-[#666666] mb-6 leading-relaxed">
                  他のスタッフへ、このポータルのURLを送信します。<br/>送信するテキストは自由に編集できます。
                </p>

                <div className="relative mb-6">
                  <textarea 
                    value={inviteMessage}
                    onChange={(e) => setInviteMessage(e.target.value)}
                    className="w-full h-40 bg-[#f5f2e6] border-none p-4 text-sm text-[#333333] outline-none focus:ring-1 focus:ring-[#1a1a1a] resize-none leading-relaxed"
                  />
                  <Edit3 className="absolute right-4 bottom-4 w-4 h-4 text-[#999999] pointer-events-none" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => { setInviteTarget('line'); handleExecuteInvite(); }} className="w-full py-4 bg-white border border-[#e6e2d3] text-[#333333] text-[11px] font-bold tracking-widest transition-all active:scale-[0.98] flex items-center justify-center gap-2 rounded-sm shadow-sm hover:bg-[#faf9f6]">
                    <MessageCircle className="w-4 h-4" strokeWidth={1.5} /> LINE
                  </button>
                  <button onClick={() => { setInviteTarget('email'); handleExecuteInvite(); }} className="w-full py-4 bg-white border border-[#e6e2d3] text-[#333333] text-[11px] font-bold tracking-widest transition-all active:scale-[0.98] flex items-center justify-center gap-2 rounded-sm shadow-sm hover:bg-[#faf9f6]">
                    <Mail className="w-4 h-4" strokeWidth={1.5} /> メール
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}

          {/* 4. 管理者ログイン モーダル (OTP) */}
          {isAdminAuthOpen && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[110] bg-[#1a1a1a]/60 backdrop-blur-sm flex flex-col justify-end sm:justify-center p-0 sm:p-6">
              <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'tween', duration: 0.3 }} className="bg-[#fffef2] p-8 w-full max-w-md mx-auto relative shadow-[0_0_40px_rgba(0,0,0,0.2)]">
                <button onClick={() => { setIsAdminAuthOpen(false); setAdminAuthStep(1); }} className="absolute top-4 right-4 p-3 text-[#999999] hover:text-[#333333]"><X className="w-6 h-6" strokeWidth={1.5} /></button>
                
                <h3 className="text-lg font-bold text-[#1a1a1a] mb-2 uppercase tracking-widest">Admin Login</h3>
                <p className="text-xs text-[#666666] mb-6 leading-relaxed">
                  {adminAuthStep === 1 ? '管理ダッシュボードを開くため、登録した電話番号を入力してください。' : `${adminPhone}宛の認証コードを入力してください。`}
                </p>

                {errorMessage && (
                  <div className="mb-4 p-3 bg-[#fcf0f0] text-[#8a3c3c] text-[11px] flex items-start gap-2">
                    <ShieldAlert className="w-4 h-4 shrink-0" strokeWidth={1.5} /> {errorMessage}
                  </div>
                )}

                {adminAuthStep === 1 ? (
                  <div className="space-y-4">
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#999999]" strokeWidth={1.5} />
                      <input type="tel" placeholder="090-0000-0000" value={adminPhone} onChange={e => setAdminPhone(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSendAdminOtp()} disabled={isLoading}
                        className="w-full pl-12 pr-4 py-4 bg-[#f5f2e6] border-none text-sm text-[#333333] focus:ring-1 focus:ring-[#1a1a1a] outline-none disabled:opacity-50" />
                    </div>
                    <button onClick={handleSendAdminOtp} disabled={isLoading || adminPhone.length < 10} className="w-full py-4 bg-[#1a1a1a] text-[#fffef2] font-bold text-[11px] tracking-widest uppercase active:scale-[0.98] transition-all flex justify-center items-center gap-3 disabled:opacity-50">
                      {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'SMSを送信'}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="relative">
                      <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#999999]" strokeWidth={1.5} />
                      <input type="text" inputMode="numeric" maxLength={6} placeholder="000000" value={adminOtp} onChange={e => setAdminOtp(e.target.value.replace(/[^0-9]/g, ''))} disabled={isLoading} onKeyDown={e => e.key === 'Enter' && handleVerifyAdminOtp()}
                        className="w-full pl-12 pr-4 py-4 bg-[#f5f2e6] border-none text-2xl tracking-[0.4em] text-center font-mono text-[#333333] focus:ring-1 focus:ring-[#1a1a1a] outline-none disabled:opacity-50" />
                    </div>
                    <button onClick={handleVerifyAdminOtp} disabled={isLoading || adminOtp.length !== 6} className="w-full py-4 bg-[#1a1a1a] text-[#fffef2] font-bold text-[11px] tracking-widest uppercase active:scale-[0.98] transition-all flex justify-center items-center gap-3 disabled:opacity-50">
                      {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'ログイン'}
                    </button>
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  )
}