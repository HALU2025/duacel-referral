'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion' 

import { 
  ArrowRight, ArrowLeft, CheckCircle2, Loader2, 
  Phone, KeyRound, Store, User, ChevronRight, PlayCircle, ShieldAlert
} from 'lucide-react'

// ==========================================
// ヘルパー関数
// ==========================================
const generateSecureToken = () => {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

const generateInviteToken = () => {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
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

export default function ShopJoinPage() {
  const router = useRouter()

  const [phone, setPhone] = useState('') 
  const [otp, setOtp] = useState('')
  const [role, setRole] = useState<'owner' | 'staff' | null>(null)
  const [shopName, setShopName] = useState('')
  const [userName, setUserName] = useState('')
  const [pin, setPin] = useState('')
  
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const [[currentStep, direction], setStepDirection] = useState([1, 0])
  const TOTAL_STEPS = 5 // 1:Phone -> 2:OTP -> 3:Role -> 4:Profile -> 5:PIN (6:Complete)

  // 既にログイン済みの場合は自動でダッシュボードへ（賢いルーティング）
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) router.replace('/dashboard') 
    }
    checkSession()
  }, [router])

  const handleKeyDown = (e: React.KeyboardEvent, nextAction: () => void) => {
    if (e.key === 'Enter') { e.preventDefault(); nextAction(); }
  }

  const goNext = (stepIndex: number) => {
    setErrorMessage(''); setStepDirection([stepIndex, 1])
  }

  const handleBack = () => {
    setErrorMessage(''); setStepDirection([currentStep - 1, -1])
  }

  // STEP 1: SMS送信
  const handleSendOtp = async () => {
    setErrorMessage('')
    const cleanPhone = phone.replace(/\D/g, '')
    if (cleanPhone.length < 10) return setErrorMessage('有効な電話番号をご入力ください。')

    setIsLoading(true)
    try {
      const formattedPhone = formatPhoneNumber(phone)
      const { error } = await supabase.auth.signInWithOtp({ phone: formattedPhone })
      if (error) throw error
      goNext(2)
    } catch (err: any) {
      setErrorMessage('SMSの送信に失敗しました。番号をご確認ください。')
    } finally {
      setIsLoading(false)
    }
  }

  // STEP 2: 認証確認 ＆ 既存ユーザーチェック
  const handleVerifyOtp = async () => {
    setErrorMessage('')
    if (otp.length !== 6) return setErrorMessage('6桁の認証コードをご入力ください。')

    setIsLoading(true)
    try {
      const formattedPhone = formatPhoneNumber(phone)
      const { error: authError } = await supabase.auth.verifyOtp({ phone: formattedPhone, token: otp, type: 'sms' })
      if (authError) throw authError

      const { data: existingStaff } = await supabase.from('staffs').select('id').eq('phone', formattedPhone).maybeSingle()
      if (existingStaff) {
        // 既存ユーザーはそのままダッシュボード（またはホーム）へ
        router.replace('/dashboard')
      } else {
        // 新規ユーザーは【役割選択】へ
        goNext(3)
      }
    } catch (err: any) {
      setErrorMessage('認証コードが正しくないか、有効期限が切れています。')
    } finally {
      setIsLoading(false)
    }
  }

  // STEP 3: 役割選択 (PLG戦略の要)
  const handleSelectRole = (selectedRole: 'owner' | 'staff') => {
    setRole(selectedRole)
    goNext(4)
  }

  const handleDemoMode = () => {
    alert('※ 実際のデモ画面（ダミーデータが入り、ツールチップで案内が出る画面）へ遷移します。')
  }

  // STEP 4: プロフィール入力のバリデーション
  const handleProfileSubmit = () => {
    setErrorMessage('')
    if (role === 'owner' && !shopName.trim()) return setErrorMessage('店舗名をご入力ください。')
    if (!userName.trim()) return setErrorMessage('お名前をご入力ください。')
    goNext(5)
  }

  // STEP 5: PIN設定 ＆ データベース登録（最終）
  const handleRegisterProfile = async () => {
    setErrorMessage('')
    if (pin.length !== 4) return setErrorMessage('4桁の暗証番号を設定してください。')

    setIsLoading(true)
    try {
      const formattedPhone = formatPhoneNumber(phone)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('認証セッションが見つかりません。')

      const secureToken = generateSecureToken()
      const publicReferralCode = generateReferralCode()
      let finalShopId = null

      // オーナーの場合は先に店舗(Shop)を作成
      if (role === 'owner') {
        const inviteToken = generateInviteToken()
        const { data: newShop, error: shopErr } = await supabase
          .from('shops').insert([{ name: shopName.trim(), owner_id: user.id, invite_token: inviteToken }])
          .select('id').single()
        if (shopErr) throw new Error('店舗の作成に失敗しました。')
        finalShopId = newShop.id
      }

      // スタッフ情報を登録 (スタッフの場合は shop_id が null の「フリー状態」になる)
      const { error: staffErr } = await supabase.from('staffs').insert([{
        id: user.id,
        shop_id: finalShopId, 
        name: userName.trim(), 
        phone: formattedPhone,
        role: role, 
        referral_code: publicReferralCode, 
        secret_token: secureToken, 
        security_pin: pin, 
        is_deleted: false,
        is_team_pool_eligible: true
      }])
      
      if (staffErr) throw new Error('アカウントの作成に失敗しました。')

      goNext(6) // 完了画面へ
    } catch (err: any) {
      setErrorMessage(err.message) 
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-[#fffef2] flex flex-col justify-center items-center p-4 sm:p-6 font-sans text-[#333333] selection:bg-[#e6e2d3] selection:text-[#333333] overflow-hidden">
      
      <div className="w-full max-w-md relative flex flex-col h-[100dvh] sm:h-[85dvh] sm:min-h-[600px] sm:max-h-[800px] bg-[#fffef2] sm:border sm:border-[#e6e2d3] sm:shadow-[0_0_40px_rgba(0,0,0,0.03)]">
        
        {/* ヘッダーロゴ & プログレスバー */}
        <div className="absolute top-8 left-0 right-0 flex flex-col items-center justify-center z-40 pointer-events-none bg-gradient-to-b from-[#fffef2] via-[#fffef2] to-transparent pb-4">
          <h1 className="text-xl font-serif tracking-[0.2em] text-[#1a1a1a]">Duacel.</h1>
          {currentStep < 6 && (
            <div className="flex justify-center gap-2 mt-4">
              {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
                <div key={i} className={`h-1 rounded-full transition-all duration-700 ease-in-out ${currentStep === i + 1 ? 'w-8 bg-[#1a1a1a]' : currentStep > i + 1 ? 'w-3 bg-[#999999]' : 'w-3 bg-[#e6e2d3]'}`} />
              ))}
            </div>
          )}
        </div>

        {/* 戻るボタン */}
        {currentStep > 1 && currentStep < 6 && !isLoading && (
          <button onClick={handleBack} className="absolute top-8 left-6 z-50 text-[#999999] hover:text-[#1a1a1a] transition-colors p-2">
            <ArrowLeft className="w-6 h-6" strokeWidth={1.5} />
          </button>
        )}

        <div className="flex-1 relative overflow-hidden mt-24 pb-safe">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={currentStep}
              custom={direction}
              variants={swipeVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: "tween", duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
              className="flex flex-col h-full px-8 pb-12 overflow-y-auto -webkit-overflow-scrolling-touch"
            >
              {errorMessage && (
                <div className="mb-6 p-4 bg-[#fcf0f0] border border-[#fcf0f0] text-[#8a3c3c] text-[11px] flex items-start gap-2 animate-in fade-in shrink-0">
                  <ShieldAlert className="w-4 h-4 shrink-0" strokeWidth={1.5} />
                  {errorMessage}
                </div>
              )}
              
              {/* ==========================================
                  STEP 1: 電話番号 (SMS送信)
              ========================================== */}
              {currentStep === 1 && (
                <div className="flex flex-col h-full justify-center">
                  <div className="mb-10 text-center">
                    <h2 className="text-xl font-bold tracking-widest text-[#1a1a1a] mb-4 uppercase">Sign In / Register</h2>
                    <p className="text-[11px] text-[#666666] leading-relaxed tracking-wider">
                      ご登録の携帯電話番号をご入力ください。<br/>
                      SMSにて認証コードを送信いたします。
                    </p>
                  </div>
                  
                  <div className="space-y-6 mt-4">
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#999999]" strokeWidth={1.5} />
                      <input 
                        type="tel" placeholder="090-0000-0000" value={phone} onChange={e => setPhone(e.target.value)}
                        onKeyDown={e => handleKeyDown(e, handleSendOtp)} disabled={isLoading}
                        className="w-full pl-12 pr-4 py-4 bg-[#f5f2e6] border-none rounded-none text-base tracking-wider text-[#333333] focus:ring-1 focus:ring-[#1a1a1a] transition-all outline-none disabled:opacity-50" 
                      />
                    </div>
                    <button onClick={handleSendOtp} disabled={isLoading || phone.length < 10} className="w-full py-5 bg-[#1a1a1a] text-[#fffef2] font-bold text-[11px] tracking-widest uppercase active:scale-[0.98] transition-all flex justify-center items-center gap-3 disabled:opacity-50">
                      {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Continue <ArrowRight className="w-4 h-4" strokeWidth={1.5} /></>}
                    </button>
                  </div>
                </div>
              )}

              {/* ==========================================
                  STEP 2: 認証コード (OTP確認)
              ========================================== */}
              {currentStep === 2 && (
                <div className="flex flex-col h-full justify-center">
                  <div className="mb-10 text-center">
                    <h2 className="text-xl font-bold tracking-widest text-[#1a1a1a] mb-4 uppercase">Verification</h2>
                    <p className="text-[11px] text-[#666666] leading-relaxed tracking-wider">
                      <span className="font-bold text-[#1a1a1a] tracking-widest text-sm block mb-2">{phone}</span>
                      宛に6桁の認証コードを送信いたしました。
                    </p>
                  </div>
                  
                  <div className="space-y-6 mt-4">
                    <div className="relative">
                      <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#999999]" strokeWidth={1.5} />
                      <input 
                        type="text" inputMode="numeric" maxLength={6} placeholder="000000" 
                        value={otp} onChange={e => setOtp(e.target.value.replace(/[^0-9]/g, ''))} disabled={isLoading}
                        onKeyDown={e => handleKeyDown(e, handleVerifyOtp)}
                        className="w-full pl-12 pr-4 py-5 bg-[#f5f2e6] border-none rounded-none text-2xl tracking-[0.4em] text-center font-mono text-[#333333] focus:ring-1 focus:ring-[#1a1a1a] transition-all outline-none disabled:opacity-50" 
                      />
                    </div>
                    <button onClick={handleVerifyOtp} disabled={isLoading || otp.length !== 6} className="w-full py-5 bg-[#1a1a1a] text-[#fffef2] font-bold text-[11px] tracking-widest uppercase active:scale-[0.98] transition-all flex justify-center items-center gap-3 disabled:opacity-50">
                      {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Verify <ArrowRight className="w-4 h-4" strokeWidth={1.5} /></>}
                    </button>
                  </div>
                </div>
              )}

              {/* ==========================================
                  STEP 3: 役割選択 (PLGオンボーディング)
              ========================================== */}
              {currentStep === 3 && (
                <div className="flex flex-col h-full py-6">
                  <div className="mb-8 text-center shrink-0">
                    <h2 className="text-xl font-bold tracking-widest text-[#1a1a1a] mb-3 uppercase">Choose Your Path</h2>
                    <p className="text-[11px] text-[#666666] leading-relaxed">
                      アカウントの利用目的を選択してください。
                    </p>
                  </div>
                  
                  <div className="space-y-4 flex-1">
                    {/* オーナー登録ルート */}
                    <button onClick={() => handleSelectRole('owner')} className="w-full bg-[#f5f2e6] border border-[#e6e2d3] p-6 text-left hover:border-[#1a1a1a] transition-colors active:scale-[0.98] group flex flex-col justify-center gap-2">
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-2 text-[#1a1a1a]">
                          <Store className="w-5 h-5" strokeWidth={1.5} />
                          <h3 className="text-sm font-bold">店舗管理者として登録する</h3>
                        </div>
                        <ChevronRight className="w-5 h-5 text-[#999999] group-hover:text-[#1a1a1a] transition-colors" strokeWidth={1.5} />
                      </div>
                      <p className="text-[11px] text-[#666666] pl-7">新しく店舗のワークスペースを作成し、紹介制度をスタートします。</p>
                    </button>

                    {/* スタッフルート (フリーエージェント) */}
                    <button onClick={() => handleSelectRole('staff')} className="w-full bg-[#fffef2] border border-[#e6e2d3] p-6 text-left hover:bg-[#f5f2e6] transition-colors active:scale-[0.98] group flex flex-col justify-center gap-2">
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-2 text-[#1a1a1a]">
                          <User className="w-5 h-5" strokeWidth={1.5} />
                          <h3 className="text-sm font-bold">店舗スタッフとして登録する</h3>
                        </div>
                        <ChevronRight className="w-5 h-5 text-[#999999] group-hover:text-[#1a1a1a] transition-colors" strokeWidth={1.5} />
                      </div>
                      <p className="text-[11px] text-[#666666] pl-7">アカウントを作成し、後からQRコードなどで既存の店舗に参加します。</p>
                    </button>
                  </div>

                  {/* デモモードへの逃げ道 */}
                  <div className="mt-8 shrink-0">
                    <button onClick={handleDemoMode} className="w-full py-4 text-[11px] text-[#999999] hover:text-[#1a1a1a] flex items-center justify-center gap-2 transition-colors">
                      <PlayCircle className="w-4 h-4" strokeWidth={1.5} /> デモモードで中を体験する
                    </button>
                  </div>
                </div>
              )}

              {/* ==========================================
                  STEP 4: プロフィール入力
              ========================================== */}
              {currentStep === 4 && (
                <div className="flex flex-col h-full justify-center">
                  <div className="mb-8 text-center">
                    <h2 className="text-xl font-bold tracking-widest text-[#1a1a1a] mb-4 uppercase">Profile Setup</h2>
                    <p className="text-[11px] text-[#666666] leading-relaxed tracking-wide">
                      {role === 'owner' ? '店舗情報とご担当者様名をお知らせください。' : 'あなたのお名前（表示名）を入力してください。'}
                    </p>
                  </div>
                  
                  <div className="space-y-5">
                    {role === 'owner' && (
                      <div>
                        <label className="block text-[11px] text-[#999999] mb-2 tracking-widest uppercase">Shop Name</label>
                        <div className="relative">
                          <Store className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#999999]" strokeWidth={1.5} />
                          <input 
                            placeholder="例: サロン 表参道店" value={shopName} onChange={e => setShopName(e.target.value)}
                            onKeyDown={e => handleKeyDown(e, handleProfileSubmit)} disabled={isLoading}
                            className="w-full pl-11 pr-4 py-4 bg-[#f5f2e6] border-none text-sm text-[#333333] focus:ring-1 focus:ring-[#1a1a1a] transition-all outline-none disabled:opacity-50" 
                          />
                        </div>
                      </div>
                    )}
                    <div>
                      <label className="block text-[11px] text-[#999999] mb-2 tracking-widest uppercase">Your Name</label>
                      <div className="relative">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#999999]" strokeWidth={1.5} />
                        <input 
                          placeholder="例: 山田 太郎" value={userName} onChange={e => setUserName(e.target.value)}
                          onKeyDown={e => handleKeyDown(e, handleProfileSubmit)} disabled={isLoading}
                          className="w-full pl-11 pr-4 py-4 bg-[#f5f2e6] border-none text-sm text-[#333333] focus:ring-1 focus:ring-[#1a1a1a] transition-all outline-none disabled:opacity-50" 
                        />
                      </div>
                    </div>
                    
                    <button onClick={handleProfileSubmit} disabled={isLoading || !userName.trim() || (role === 'owner' && !shopName.trim())} className="w-full py-5 mt-4 bg-[#1a1a1a] text-[#fffef2] font-bold text-[11px] tracking-widest uppercase active:scale-[0.98] transition-all flex justify-center items-center gap-3 disabled:opacity-50">
                      Next <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
                    </button>
                  </div>
                </div>
              )}

              {/* ==========================================
                  STEP 5: PIN設定 (最終登録)
              ========================================== */}
              {currentStep === 5 && (
                <div className="flex flex-col h-full justify-center">
                  <div className="mb-10 text-center">
                    <h2 className="text-xl font-bold tracking-widest text-[#1a1a1a] mb-4 uppercase">Security PIN</h2>
                    <p className="text-[11px] text-[#666666] leading-relaxed tracking-wide">
                      ポイント交換やセキュリティ保護に使用する<br/>
                      4桁の暗証番号を設定してください。
                    </p>
                  </div>
                  
                  <div className="space-y-6 mt-4">
                    <input 
                      type="password" inputMode="numeric" maxLength={4} placeholder="••••" 
                      value={pin} onChange={e => setPin(e.target.value.replace(/[^0-9]/g, ''))} disabled={isLoading}
                      onKeyDown={e => handleKeyDown(e, handleRegisterProfile)}
                      className="w-full px-4 py-5 bg-[#f5f2e6] border-none text-3xl tracking-[0.5em] text-center font-mono font-bold text-[#333333] focus:ring-1 focus:ring-[#1a1a1a] transition-all outline-none disabled:opacity-50" 
                    />
                    
                    <button onClick={handleRegisterProfile} disabled={isLoading || pin.length !== 4} className="w-full py-5 bg-[#1a1a1a] text-[#fffef2] font-bold text-[11px] tracking-widest uppercase active:scale-[0.98] transition-all flex justify-center items-center gap-3 disabled:opacity-50">
                      {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Complete Setup'}
                    </button>
                  </div>
                </div>
              )}

              {/* ==========================================
                  STEP 6: 完了画面
              ========================================== */}
              {currentStep === 6 && (
                <div className="flex flex-col items-center justify-center text-center h-full animate-in zoom-in-95 duration-500">
                  <div className="relative mb-10">
                    <motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0, 0.3] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }} className="absolute inset-0 bg-[#e6e2d3] rounded-full -z-10 blur-xl" />
                    <CheckCircle2 className="w-16 h-16 text-[#1a1a1a]" strokeWidth={1} />
                  </div>
                  <h2 className="text-xl font-bold tracking-widest text-[#1a1a1a] mb-6 uppercase">Registration<br/>Complete.</h2>
                  <p className="text-[11px] text-[#666666] leading-relaxed tracking-wide mb-12">
                    ご登録ありがとうございました。<br/>
                    さっそくDuacelを始めましょう。
                  </p>
                  
                  <button onClick={() => router.replace('/dashboard')} className="w-full py-5 bg-[#1a1a1a] text-[#fffef2] text-[11px] tracking-widest font-bold uppercase active:scale-[0.98] transition-all flex items-center justify-center gap-3 group">
                    Go to Dashboard
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" strokeWidth={1.5} />
                  </button>
                </div>
              )}

            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}