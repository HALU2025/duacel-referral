'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion' 

import { 
  ArrowRight, ArrowLeft, CheckCircle2, Loader2, 
  Phone, KeyRound, Store, User, ChevronRight
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

// 電話番号フォーマット（090... -> +8190...）
const formatPhoneNumber = (num: string) => {
  const cleaned = num.replace(/[^0-9]/g, '')
  if (cleaned.startsWith('0')) return '+81' + cleaned.slice(1)
  return '+' + cleaned
}

// アニメーション設定
const swipeVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 20 : -20,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction < 0 ? 20 : -20,
    opacity: 0,
  })
}

export default function ShopJoinPage() {
  const router = useRouter()

  // ステート管理
  const [phone, setPhone] = useState('') 
  const [otp, setOtp] = useState('')
  const [shopName, setShopName] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [pin, setPin] = useState('')
  
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [ownerMagicUrl, setOwnerMagicUrl] = useState('')

  const [[currentStep, direction], setStepDirection] = useState([1, 0])
  const TOTAL_STEPS = 4 // Phone -> OTP -> Names -> PIN (Completion is step 5)

  const handleKeyDown = (e: React.KeyboardEvent, nextAction: () => void) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      nextAction()
    }
  }

  const goNext = (stepIndex: number) => {
    setErrorMessage('')
    setStepDirection([stepIndex, 1])
  }

  const handleBack = () => {
    setErrorMessage('')
    setStepDirection([currentStep - 1, -1])
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
      const { data: authData, error: authError } = await supabase.auth.verifyOtp({
        phone: formattedPhone, token: otp, type: 'sms'
      })
      if (authError) throw authError

      // 既存スタッフか確認
      const { data: existingStaff } = await supabase.from('staffs').select('id').eq('phone', formattedPhone).maybeSingle()

      if (existingStaff) {
        // 既存ならそのままダッシュボードへ
        router.push('/dashboard')
      } else {
        // 新規なら店舗情報入力へ
        goNext(3)
      }
    } catch (err: any) {
      setErrorMessage('認証コードが正しくないか、有効期限が切れています。')
    } finally {
      setIsLoading(false)
    }
  }

  // STEP 3: 名前入力のバリデーション
  const handleNamesSubmit = () => {
    setErrorMessage('')
    if (!shopName.trim() || !ownerName.trim()) {
      return setErrorMessage('店舗名と代表者様氏名をご入力ください。')
    }
    goNext(4)
  }

  // STEP 4: PIN設定 ＆ データベース登録
  const handleRegisterProfile = async () => {
    setErrorMessage('')
    if (pin.length !== 4) return setErrorMessage('4桁の暗証番号を設定してください。')

    setIsLoading(true)
    try {
      const formattedPhone = formatPhoneNumber(phone)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('認証セッションが見つかりません。')

      // 1. 店舗(Shop)の作成
      const inviteToken = generateInviteToken()
      const { data: newShop, error: insertError } = await supabase
        .from('shops').insert([{ 
          name: shopName.trim(), 
          owner_id: user.id, 
          invite_token: inviteToken 
        }]).select('id').single()
      
      if (insertError) throw new Error('店舗情報の登録に失敗しました。')

      // 2. スタッフ(Owner)の作成
      const secureToken = generateSecureToken()
      const publicReferralCode = generateReferralCode()
      
      const { error: staffError } = await supabase.from('staffs').insert([{
        id: user.id,
        shop_id: newShop.id,
        name: ownerName.trim(), 
        phone: formattedPhone,
        role: 'owner', // オーナー権限を付与
        referral_code: publicReferralCode, 
        secret_token: secureToken, 
        security_pin: pin, 
        is_deleted: false
      }])
      
      if (staffError) throw new Error('管理者情報の登録に失敗しました。')

      setOwnerMagicUrl(`${window.location.origin}/m/${secureToken}`)
      goNext(5)
    } catch (err: any) {
      setErrorMessage(err.message) 
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-[#fffef2] flex flex-col justify-center items-center p-4 sm:p-6 font-sans text-[#333333] selection:bg-[#d5d0b5] selection:text-[#333333] overflow-hidden">
      
      {/* アプリ組み込みを意識した全画面コンテナ */}
      <div className="w-full max-w-md relative flex flex-col h-[100dvh] sm:h-[85dvh] sm:min-h-[500px] sm:max-h-[700px] bg-[#fffef2] sm:border sm:border-[#e6e2d3] sm:shadow-sm">
        
        {/* ヘッダーロゴ */}
        <div className="absolute top-8 left-0 right-0 flex flex-col items-center justify-center z-40 pointer-events-none">
          <h1 className="text-xl font-serif tracking-[0.2em] text-[#1a1a1a]">Duacel.</h1>
          
          {/* プログレスバー (ステップ1〜4まで表示) */}
          {currentStep < 5 && (
            <div className="flex justify-center gap-2 mt-4">
              {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
                <div key={i} className={`h-1 rounded-full transition-all duration-700 ease-in-out ${currentStep === i + 1 ? 'w-8 bg-[#333333]' : currentStep > i + 1 ? 'w-3 bg-[#a39e8a]' : 'w-3 bg-[#e6e2d3]'}`} />
              ))}
            </div>
          )}
        </div>

        {/* 戻るボタン */}
        {currentStep > 1 && currentStep < 5 && !isLoading && (
          <button onClick={handleBack} className="absolute top-8 left-6 z-50 text-[#999999] hover:text-[#333333] transition-colors p-2">
            <ArrowLeft className="w-6 h-6" strokeWidth={1.5} />
          </button>
        )}

        <div className="flex-1 relative overflow-hidden mt-16 pb-safe">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={currentStep}
              custom={direction}
              variants={swipeVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: "tween", duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
              className="flex flex-col h-full px-8 pt-16 pb-12"
            >
              
              {/* ==========================================
                  STEP 1: 電話番号 (SMS送信)
              ========================================== */}
              {currentStep === 1 && (
                <div className="flex flex-col h-full justify-center">
                  <div className="mb-10 text-center">
                    <h2 className="text-2xl font-serif tracking-widest text-[#1a1a1a] mb-4">Sign In / Register</h2>
                    <p className="text-sm text-[#666666] leading-relaxed tracking-wide">
                      ご登録の携帯電話番号をご入力ください。<br/>
                      SMSにて認証コードを送信いたします。
                    </p>
                  </div>
                  
                  <div className="space-y-6 mt-8">
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#999999]" strokeWidth={1.5} />
                      <input 
                        type="tel" placeholder="090-0000-0000" value={phone} onChange={e => setPhone(e.target.value)}
                        onKeyDown={e => handleKeyDown(e, handleSendOtp)} disabled={isLoading}
                        className="w-full pl-12 pr-4 py-4 bg-[#f5f2e6] border-none rounded-none text-lg tracking-wider text-[#333333] focus:ring-1 focus:ring-[#333333] transition-all outline-none disabled:opacity-50" 
                      />
                    </div>
                    {errorMessage && <p className="text-xs tracking-wide text-[#8a3c3c] text-center bg-[#fcf0f0] p-3">{errorMessage}</p>}
                    
                    <button onClick={handleSendOtp} disabled={isLoading || phone.length < 10} className="w-full py-4 bg-[#333333] text-[#fffef2] font-medium text-sm tracking-[0.15em] uppercase hover:bg-[#1a1a1a] shadow-sm hover:shadow-[0_0_20px_rgba(51,51,51,0.25)] transition-all duration-300 flex justify-center items-center gap-3 disabled:opacity-50 disabled:shadow-none">
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
                    <h2 className="text-2xl font-serif tracking-widest text-[#1a1a1a] mb-4">Verification</h2>
                    <p className="text-sm text-[#666666] leading-relaxed tracking-wide">
                      <span className="font-bold text-[#333333] tracking-widest">{phone}</span> 宛に<br/>
                      6桁の認証コードを送信いたしました。
                    </p>
                  </div>
                  
                  <div className="space-y-6 mt-8">
                    <div className="relative">
                      <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#999999]" strokeWidth={1.5} />
                      <input 
                        type="text" inputMode="numeric" maxLength={6} placeholder="000000" 
                        value={otp} onChange={e => setOtp(e.target.value.replace(/[^0-9]/g, ''))} disabled={isLoading}
                        onKeyDown={e => handleKeyDown(e, handleVerifyOtp)}
                        className="w-full pl-12 pr-4 py-4 bg-[#f5f2e6] border-none rounded-none text-2xl tracking-[0.4em] text-center font-mono text-[#333333] focus:ring-1 focus:ring-[#333333] transition-all outline-none disabled:opacity-50" 
                      />
                    </div>
                    {errorMessage && <p className="text-xs tracking-wide text-[#8a3c3c] text-center bg-[#fcf0f0] p-3">{errorMessage}</p>}
                    
                    <button onClick={handleVerifyOtp} disabled={isLoading || otp.length !== 6} className="w-full py-4 bg-[#333333] text-[#fffef2] font-medium text-sm tracking-[0.15em] uppercase hover:bg-[#1a1a1a] shadow-sm hover:shadow-[0_0_20px_rgba(51,51,51,0.25)] transition-all duration-300 flex justify-center items-center gap-3 disabled:opacity-50 disabled:shadow-none">
                      {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Verify <ArrowRight className="w-4 h-4" strokeWidth={1.5} /></>}
                    </button>
                  </div>
                </div>
              )}

              {/* ==========================================
                  STEP 3: 店舗名・氏名
              ========================================== */}
              {currentStep === 3 && (
                <div className="flex flex-col h-full justify-center">
                  <div className="mb-10 text-center">
                    <h2 className="text-2xl font-serif tracking-widest text-[#1a1a1a] mb-4">Welcome</h2>
                    <p className="text-sm text-[#666666] leading-relaxed tracking-wide">
                      Duacelパートナープログラムへようこそ。<br/>
                      店舗情報とご担当者様名をお知らせください。
                    </p>
                  </div>
                  
                  <div className="space-y-5 mt-4">
                    <div>
                      <label className="block text-xs font-medium text-[#666666] mb-2 tracking-widest uppercase">Shop Name</label>
                      <div className="relative">
                        <Store className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#999999]" strokeWidth={1.5} />
                        <input 
                          placeholder="例: サロン 表参道店" value={shopName} onChange={e => setShopName(e.target.value)}
                          onKeyDown={e => handleKeyDown(e, handleNamesSubmit)} disabled={isLoading}
                          className="w-full pl-11 pr-4 py-4 bg-[#f5f2e6] border-none rounded-none text-base tracking-wide text-[#333333] focus:ring-1 focus:ring-[#333333] transition-all outline-none disabled:opacity-50" 
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#666666] mb-2 tracking-widest uppercase">Your Name</label>
                      <div className="relative">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#999999]" strokeWidth={1.5} />
                        <input 
                          placeholder="例: 山田 太郎" value={ownerName} onChange={e => setOwnerName(e.target.value)}
                          onKeyDown={e => handleKeyDown(e, handleNamesSubmit)} disabled={isLoading}
                          className="w-full pl-11 pr-4 py-4 bg-[#f5f2e6] border-none rounded-none text-base tracking-wide text-[#333333] focus:ring-1 focus:ring-[#333333] transition-all outline-none disabled:opacity-50" 
                        />
                      </div>
                    </div>
                    
                    {errorMessage && <p className="text-xs tracking-wide text-[#8a3c3c] text-center bg-[#fcf0f0] p-3">{errorMessage}</p>}
                    
                    <button onClick={handleNamesSubmit} disabled={isLoading || !shopName.trim() || !ownerName.trim()} className="w-full py-4 mt-4 bg-[#333333] text-[#fffef2] font-medium text-sm tracking-[0.15em] uppercase hover:bg-[#1a1a1a] shadow-sm hover:shadow-[0_0_20px_rgba(51,51,51,0.25)] transition-all duration-300 flex justify-center items-center gap-3 disabled:opacity-50 disabled:shadow-none">
                      {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Next <ArrowRight className="w-4 h-4" strokeWidth={1.5} /></>}
                    </button>
                  </div>
                </div>
              )}

              {/* ==========================================
                  STEP 4: PIN設定 (最終登録)
              ========================================== */}
              {currentStep === 4 && (
                <div className="flex flex-col h-full justify-center">
                  <div className="mb-10 text-center">
                    <h2 className="text-2xl font-serif tracking-widest text-[#1a1a1a] mb-4">Security PIN</h2>
                    <p className="text-sm text-[#666666] leading-relaxed tracking-wide">
                      ポイント交換やセキュリティ保護に使用する<br/>
                      4桁の暗証番号を設定してください。
                    </p>
                  </div>
                  
                  <div className="space-y-6 mt-8">
                    <input 
                      type="password" inputMode="numeric" maxLength={4} placeholder="••••" 
                      value={pin} onChange={e => setPin(e.target.value.replace(/[^0-9]/g, ''))} disabled={isLoading}
                      onKeyDown={e => handleKeyDown(e, handleRegisterProfile)}
                      className="w-full px-4 py-5 bg-[#f5f2e6] border-none rounded-none text-3xl tracking-[0.5em] text-center font-mono font-bold text-[#333333] focus:ring-1 focus:ring-[#333333] transition-all outline-none disabled:opacity-50" 
                    />
                    {errorMessage && <p className="text-xs tracking-wide text-[#8a3c3c] text-center bg-[#fcf0f0] p-3">{errorMessage}</p>}
                    
                    <button onClick={handleRegisterProfile} disabled={isLoading || pin.length !== 4} className="w-full py-4 bg-[#333333] text-[#fffef2] font-medium text-sm tracking-[0.15em] uppercase hover:bg-[#1a1a1a] shadow-sm hover:shadow-[0_0_20px_rgba(51,51,51,0.25)] transition-all duration-300 flex justify-center items-center gap-3 disabled:opacity-50 disabled:shadow-none">
                      {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Complete Setup'}
                    </button>
                  </div>
                </div>
              )}

              {/* ==========================================
                  STEP 5: 完了画面
              ========================================== */}
              {currentStep === 5 && (
                <div className="flex flex-col items-center justify-center text-center h-full">
                  <div className="relative mb-10">
                    <motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0, 0.3] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }} className="absolute inset-0 bg-[#d5d0b5] rounded-full -z-10 blur-md" />
                    <CheckCircle2 className="w-16 h-16 text-[#333333]" strokeWidth={1} />
                  </div>
                  <h2 className="text-2xl font-serif tracking-widest text-[#1a1a1a] mb-6">Registration<br/>Complete.</h2>
                  <p className="text-sm text-[#666666] leading-relaxed tracking-wide mb-12">
                    ご登録ありがとうございました。<br/>
                    本登録（ご住所等の入力）は、<br/>マイページよりいつでも行えます。
                  </p>
                  
                  <button onClick={() => router.push('/dashboard')} className="w-full py-5 bg-[#333333] text-[#fffef2] uppercase tracking-[0.15em] text-sm hover:bg-[#1a1a1a] shadow-sm hover:shadow-[0_0_20px_rgba(51,51,51,0.25)] transition-all duration-300 flex items-center justify-center gap-4 group">
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