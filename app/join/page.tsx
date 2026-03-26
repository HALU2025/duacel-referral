'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion' 

import { 
  Building2, User, Mail, Lock, ArrowRight, ArrowLeft,
  CheckCircle2, Loader2, X, Eye, EyeOff, Smartphone, 
  ChevronRight, Phone, ShieldCheck
} from 'lucide-react'

// ★ トークン生成
const generateSecureToken = () => {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

const generateInviteToken = () => {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

const swipeVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 100 : -100, // スライド幅を少し抑えて上品に
    opacity: 0,
  }),
  center: {
    zIndex: 1,
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    zIndex: 0,
    x: direction < 0 ? 100 : -100,
    opacity: 0,
  })
}

export default function ShopJoinPage() {
  const router = useRouter()

  // フォームステート
  const [shopName, setShopName] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('') 
  const [phone, setPhone] = useState('') 
  const [pin, setPin] = useState('')
  
  const [showPassword, setShowPassword] = useState(false) 
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  
  // URLステート
  const [ownerMagicUrl, setOwnerMagicUrl] = useState('')

  // ステップ管理 (1〜6)
  const [[currentStep, direction], setStepDirection] = useState([1, 0])
  const TOTAL_STEPS = 6

  // Enterキーでの進行制御
  const handleKeyDown = (e: React.KeyboardEvent, nextAction: () => void) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      nextAction()
    }
  }

  // 次のステップへ進むバリデーション
  const handleNext = () => {
    setErrorMessage('')
    if (currentStep === 2 && !ownerName.trim()) return setErrorMessage('お名前を入力してください。')
    if (currentStep === 3 && (!email.trim() || password.length < 6)) return setErrorMessage('有効なメールアドレスと6文字以上のパスワードを入力してください。')
    if (currentStep === 4 && !phone.trim()) return setErrorMessage('電話番号を入力してください。')
    
    setStepDirection([currentStep + 1, 1])
  }

  const handleBack = () => {
    setErrorMessage('')
    setStepDirection([currentStep - 1, -1])
  }

  // 最終ステップ（Step5）での登録処理
  const handleRegisterShop = async () => {
    setErrorMessage('')
    if (pin.length !== 4) return setErrorMessage('4桁の数字を入力してください。')

    setIsLoading(true)

    try {
      const finalShopName = shopName.trim() !== '' ? shopName.trim() : ownerName.trim()

      const { data: authData, error: authError } = await supabase.auth.signUp({ email, password })
      if (authError) throw new Error('アカウント作成エラー: ' + authError.message)

      const userId = authData.user?.id
      const tempId = `TEMP_${Date.now()}`
      const inviteToken = generateInviteToken()

      const { data: newShop, error: insertError } = await supabase
        .from('shops').insert([{ 
          id: tempId, name: finalShopName, owner_email: email, phone: phone, owner_id: userId, invite_token: inviteToken 
        }]).select('shop_number').single()
      
      if (insertError) throw new Error('店舗登録エラー: ' + insertError.message)

      const formattedShopId = `S${newShop.shop_number.toString().padStart(3, '0')}`
      const { error: updateError } = await supabase.from('shops').update({ id: formattedShopId }).eq('shop_number', newShop.shop_number)
      if (updateError) throw new Error('店舗ID確定エラー: ' + updateError.message)

      const nextStaffId = `ST${generateSecureToken().toUpperCase()}` 
      const secureToken = generateSecureToken()
      
      const { error: staffError } = await supabase.from('staffs').insert([{
        id: nextStaffId, shop_id: formattedShopId, name: ownerName, email: email,
        referral_code: `${formattedShopId}_${nextStaffId}`, secret_token: secureToken, 
        security_pin: pin, is_deleted: false
      }])
      
      if (staffError) throw new Error('管理者情報の初期設定に失敗しました: ' + staffError.message)

      // 成功したら完了画面（Step 6）へ
      setOwnerMagicUrl(`${window.location.origin}/m/${secureToken}`)
      setIsLoading(false)
      setStepDirection([6, 1])

    } catch (err: any) {
      setErrorMessage(err.message)
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-gray-100 flex flex-col justify-center items-center p-4 font-sans text-gray-900 selection:bg-gray-900 selection:text-white">
      
      {/* メインカード */}
      <div className="w-full max-w-md bg-white h-[85vh] min-h-[500px] max-h-[600px] rounded-[2rem] shadow-2xl relative overflow-hidden border border-gray-200 flex flex-col">
        
        {/* プログレスバー (白黒コントラスト) */}
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gray-100 z-50 flex">
          <motion.div 
            className="h-full bg-gray-900" 
            initial={{ width: 0 }}
            animate={{ width: `${(currentStep / TOTAL_STEPS) * 100}%` }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
          />
        </div>

        {/* 戻るボタン */}
        {currentStep > 1 && currentStep < 6 && !isLoading && (
          <button onClick={handleBack} className="absolute top-6 left-6 z-50 text-gray-400 hover:text-gray-900 transition-colors p-2 -ml-2">
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}

        <div className="flex-1 relative">
          <AnimatePresence initial={false} custom={direction} mode="wait">
            <motion.div
              key={currentStep}
              custom={direction}
              variants={swipeVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: "tween", duration: 0.3, ease: "circOut" }}
              className="absolute inset-0 flex flex-col px-8 pt-20 pb-8 overflow-y-auto"
            >
              
              {/* ==========================================
                  STEP 1: 店舗名
              ========================================== */}
              {currentStep === 1 && (
                <div className="flex flex-col h-full">
                  <div className="w-12 h-12 bg-gray-900 text-white rounded-xl flex items-center justify-center mb-6 shadow-lg">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Step 1/5</p>
                  <h2 className="text-2xl font-black text-gray-900 mb-4 leading-tight">Duacel紹介プログラムへ<br/>ようこそ</h2>
                  <p className="text-sm text-gray-500 font-medium leading-relaxed mb-8">
                    まずはサロン名・店舗名を入力してください。<br/>個人で登録する場合はスキップしてください。
                  </p>
                  
                  <div className="mt-auto space-y-4">
                    <input 
                      autoFocus placeholder="例: Duacel サロン 表参道店" value={shopName} onChange={e => setShopName(e.target.value)}
                      onKeyDown={e => handleKeyDown(e, handleNext)}
                      className="w-full px-4 py-4 bg-gray-50 border border-gray-200 rounded-xl text-base font-bold text-gray-900 focus:ring-2 focus:ring-gray-900 focus:bg-white transition-all outline-none" 
                    />
                    <div className="flex flex-col gap-3">
                      <button onClick={handleNext} className="w-full py-4 bg-gray-900 text-white rounded-xl font-bold text-sm shadow-md active:scale-95 transition-all flex justify-center items-center gap-2">
                        次へ進む <ArrowRight className="w-4 h-4" />
                      </button>
                      {shopName.trim() === '' && (
                        <button onClick={handleNext} className="w-full py-3 text-gray-400 font-bold text-xs hover:text-gray-900 transition-colors">
                          店舗名がないのでスキップする
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ==========================================
                  STEP 2: 管理者名
              ========================================== */}
              {currentStep === 2 && (
                <div className="flex flex-col h-full">
                  <div className="w-12 h-12 bg-gray-900 text-white rounded-xl flex items-center justify-center mb-6 shadow-lg">
                    <User className="w-6 h-6" />
                  </div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Step 2/5</p>
                  <h2 className="text-2xl font-black text-gray-900 mb-4 leading-tight">管理者のお名前を<br/>入力してください</h2>
                  <p className="text-sm text-gray-500 font-medium leading-relaxed mb-8">
                    管理者は、メンバーの追加や削除、<br/>紹介実績の確認、インセンティブの<br/>配分比率設定などを行えます。
                  </p>
                  
                  <div className="mt-auto space-y-4">
                    <input 
                      autoFocus placeholder="例: 山田 太郎" value={ownerName} onChange={e => setOwnerName(e.target.value)}
                      onKeyDown={e => handleKeyDown(e, handleNext)}
                      className="w-full px-4 py-4 bg-gray-50 border border-gray-200 rounded-xl text-base font-bold text-gray-900 focus:ring-2 focus:ring-gray-900 focus:bg-white transition-all outline-none" 
                    />
                    {errorMessage && <p className="text-xs font-bold text-red-500">{errorMessage}</p>}
                    <button onClick={handleNext} className="w-full py-4 bg-gray-900 text-white rounded-xl font-bold text-sm shadow-md active:scale-95 transition-all flex justify-center items-center gap-2">
                      次へ進む <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* ==========================================
                  STEP 3: ログイン情報
              ========================================== */}
              {currentStep === 3 && (
                <div className="flex flex-col h-full">
                  <div className="w-12 h-12 bg-gray-900 text-white rounded-xl flex items-center justify-center mb-6 shadow-lg">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Step 3/5</p>
                  <h2 className="text-2xl font-black text-gray-900 mb-4 leading-tight">ログイン情報を<br/>設定してください</h2>
                  <p className="text-sm text-gray-500 font-medium leading-relaxed mb-6">
                    管理者用のダッシュボードにアクセスするための<br/>メールアドレスとパスワードを入力してください。
                  </p>
                  
                  <div className="mt-auto space-y-4">
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 block mb-1">メールアドレス</label>
                      <input 
                        autoFocus type="email" placeholder="admin@example.com" value={email} onChange={e => setEmail(e.target.value)}
                        onKeyDown={e => handleKeyDown(e, handleNext)}
                        className="w-full px-4 py-4 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-900 focus:ring-2 focus:ring-gray-900 focus:bg-white transition-all outline-none" 
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 block mb-1">パスワード (6文字以上)</label>
                      <div className="relative">
                        <input 
                          type={showPassword ? "text" : "password"} placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)}
                          onKeyDown={e => handleKeyDown(e, handleNext)}
                          className="w-full pl-4 pr-12 py-4 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-900 focus:ring-2 focus:ring-gray-900 focus:bg-white transition-all outline-none" 
                        />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-900 transition-colors">
                          {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>
                    {errorMessage && <p className="text-xs font-bold text-red-500">{errorMessage}</p>}
                    <button onClick={handleNext} className="w-full py-4 bg-gray-900 text-white rounded-xl font-bold text-sm shadow-md active:scale-95 transition-all flex justify-center items-center gap-2 mt-2">
                      次へ進む <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* ==========================================
                  STEP 4: 電話番号
              ========================================== */}
              {currentStep === 4 && (
                <div className="flex flex-col h-full">
                  <div className="w-12 h-12 bg-gray-900 text-white rounded-xl flex items-center justify-center mb-6 shadow-lg">
                    <Phone className="w-6 h-6" />
                  </div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Step 4/5</p>
                  <h2 className="text-2xl font-black text-gray-900 mb-4 leading-tight">管理者の電話番号を<br/>入力してください</h2>
                  <p className="text-sm text-gray-500 font-medium leading-relaxed mb-8">
                    メールが送信できなかった場合などに使用します。<br/>通常は使用しません。
                  </p>
                  
                  <div className="mt-auto space-y-4">
                    <input 
                      autoFocus type="tel" placeholder="03-1234-5678" value={phone} onChange={e => setPhone(e.target.value)}
                      onKeyDown={e => handleKeyDown(e, handleNext)}
                      className="w-full px-4 py-4 bg-gray-50 border border-gray-200 rounded-xl text-base font-bold text-gray-900 focus:ring-2 focus:ring-gray-900 focus:bg-white transition-all outline-none" 
                    />
                    {errorMessage && <p className="text-xs font-bold text-red-500">{errorMessage}</p>}
                    <button onClick={handleNext} className="w-full py-4 bg-gray-900 text-white rounded-xl font-bold text-sm shadow-md active:scale-95 transition-all flex justify-center items-center gap-2">
                      次へ進む <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* ==========================================
                  STEP 5: PIN設定 (最終登録)
              ========================================== */}
              {currentStep === 5 && (
                <div className="flex flex-col h-full">
                  <div className="w-12 h-12 bg-gray-900 text-white rounded-xl flex items-center justify-center mb-6 shadow-lg">
                    <Smartphone className="w-6 h-6" />
                  </div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Step 5/5</p>
                  <h2 className="text-2xl font-black text-gray-900 mb-4 leading-tight">数字4ケタのPINコードを<br/>設定してください</h2>
                  <p className="text-sm text-gray-500 font-medium leading-relaxed mb-8">
                    紹介QRを表示する「マイページ」に<br/>アクセスするために必要になります。
                  </p>
                  
                  <div className="mt-auto space-y-4">
                    <input 
                      autoFocus type="password" inputMode="numeric" maxLength={4} placeholder="••••" 
                      value={pin} onChange={e => setPin(e.target.value.replace(/[^0-9]/g, ''))} disabled={isLoading}
                      onKeyDown={e => handleKeyDown(e, handleRegisterShop)}
                      className="w-full px-4 py-4 bg-gray-50 border border-gray-200 rounded-xl text-2xl tracking-[1em] text-center font-mono font-black text-gray-900 focus:ring-2 focus:ring-gray-900 focus:bg-white transition-all outline-none" 
                    />
                    {errorMessage && <p className="text-xs font-bold text-red-500 text-center">{errorMessage}</p>}
                    <button 
                      onClick={handleRegisterShop} disabled={isLoading} 
                      className="w-full py-4 bg-gray-900 text-white rounded-xl font-bold text-sm shadow-md active:scale-95 transition-all flex justify-center items-center gap-2 mt-4 disabled:opacity-50"
                    >
                      {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'この内容で登録を完了する'}
                    </button>
                  </div>
                </div>
              )}

              {/* ==========================================
                  STEP 6: 完了画面
              ========================================== */}
              {currentStep === 6 && (
                <div className="flex flex-col items-center text-center h-full pt-6">
                  <div className="w-20 h-20 bg-gray-900 rounded-full flex items-center justify-center mb-8 shadow-2xl relative">
                    <motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }} transition={{ duration: 2, repeat: Infinity }} className="absolute inset-0 bg-gray-200 rounded-full -z-10" />
                    <CheckCircle2 className="w-10 h-10 text-white" />
                  </div>
                  <h2 className="text-3xl font-black text-gray-900 mb-4 leading-tight">ご登録ありがとう<br/>ございました！</h2>
                  <p className="text-sm text-gray-500 font-medium leading-relaxed mb-auto">
                    まずはマイページにアクセスして、<br/>設定やQRコードを確認してください。
                  </p>
                  
                  <div className="w-full mt-auto">
                    <button 
                      onClick={() => { localStorage.removeItem('duacel_onboarding_data'); window.location.href = ownerMagicUrl; }} 
                      className="w-full p-5 bg-gray-900 hover:bg-black text-white rounded-2xl text-left transition-all shadow-xl group relative overflow-hidden active:scale-95 flex items-center justify-between"
                    >
                      <div>
                        <p className="text-[10px] text-gray-400 font-bold mb-1 uppercase tracking-widest flex items-center gap-1">Start Program</p>
                        <p className="font-bold text-lg">マイページを開く</p>
                      </div>
                      <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center group-hover:bg-white/20 transition-colors">
                        <ChevronRight className="w-5 h-5" />
                      </div>
                    </button>
                  </div>
                </div>
              )}

            </motion.div>
          </AnimatePresence>
        </div>
      </div>
      
      {/* ログインリンク (Step 1のみ表示) */}
      {currentStep === 1 && (
        <p className="mt-6 text-xs font-bold text-gray-500">
          すでにアカウントをお持ちの場合は
          <a href="/login" className="text-gray-900 ml-1 underline decoration-gray-400 underline-offset-4 hover:decoration-gray-900 transition-colors">ログイン</a>
        </p>
      )}

    </div>
  )
}