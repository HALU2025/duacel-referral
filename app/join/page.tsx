'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion' 
import { translateAuthError } from '@/lib/errorTranslator' // ★ 翻訳フィルターをインポート

import { 
  ArrowRight, ArrowLeft, CheckCircle2, Loader2, 
  Eye, EyeOff, ChevronRight, User
} from 'lucide-react'

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
    x: direction > 0 ? 30 : -30,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction < 0 ? 30 : -30,
    opacity: 0,
  })
}

export default function ShopJoinPage() {
  const router = useRouter()

  const [shopName, setShopName] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('') 
  const [phone, setPhone] = useState('') 
  const [pin, setPin] = useState('')
  
  const [showPassword, setShowPassword] = useState(false) 
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  
  const [ownerMagicUrl, setOwnerMagicUrl] = useState('')

  const [[currentStep, direction], setStepDirection] = useState([1, 0])
  const TOTAL_STEPS = 5

  const handleKeyDown = (e: React.KeyboardEvent, nextAction: () => void) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      nextAction()
    }
  }

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

  const handleRegisterShop = async () => {
    setErrorMessage('')
    if (pin.length !== 4) return setErrorMessage('4桁の数字を入力してください。')

    setIsLoading(true)

    try {
      const finalShopName = shopName.trim() !== '' ? shopName.trim() : ownerName.trim()

      // 1. Supabase Auth にユーザー登録
      const { data: authData, error: authError } = await supabase.auth.signUp({ email, password })
      // ★ 修正：エラー時に翻訳フィルターを通す！
      if (authError) throw new Error(translateAuthError(authError.message))

      const userId = authData.user?.id
      // 仮のID（あとで S0001 形式にアップデートする）
      const tempId = `TEMP_${Date.now()}`
      const inviteToken = generateInviteToken()

      // 2. 店舗情報の登録（このタイミングでDB側で shop_number が自動的に連番で発番される）
      const { data: newShop, error: insertError } = await supabase
        .from('shops').insert([{ 
          id: tempId, name: finalShopName, owner_email: email, phone: phone, owner_id: userId, invite_token: inviteToken 
        }]).select('shop_number').single()
      
      if (insertError) throw new Error('店舗登録エラー: ' + insertError.message)

      // 3. 発番された shop_number を使って、美しいID（S0001形式）を作り、DBをアップデートする
      // ※4桁パディング（S0001, S0002...）に変更
      const formattedShopId = `s${newShop.shop_number.toString().padStart(4, '0')}`
      const { error: updateError } = await supabase.from('shops').update({ id: formattedShopId }).eq('shop_number', newShop.shop_number)
      if (updateError) throw new Error('店舗ID確定エラー: ' + updateError.message)

      // 4. オーナーのスタッフ情報登録
      // ★ 変更点：オーナーのIDは必ず 'm01' に固定し、紹介コードは 'S0001_m01' 形式にする
      const ownerStaffId = 'm01'
      const secureToken = generateSecureToken()
      
      const { error: staffError } = await supabase.from('staffs').insert([{
        id: ownerStaffId, shop_id: formattedShopId, name: ownerName, email: email,
        referral_code: `${formattedShopId}_${ownerStaffId}`, // 例: S0001_m01
        secret_token: secureToken, 
        security_pin: pin, is_deleted: false
      }])
      
      if (staffError) throw new Error('管理者情報の初期設定に失敗しました: ' + staffError.message)

      setOwnerMagicUrl(`${window.location.origin}/m/${secureToken}`)
      setIsLoading(false)
      setStepDirection([6, 1])

    } catch (err: any) {
      setErrorMessage(err.message) // ★ throw で投げられた翻訳済みのメッセージがここに入ります
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-gray-100 flex flex-col justify-center items-center p-4 sm:p-6 font-sans text-gray-900 selection:bg-gray-900 selection:text-white">
      
      <div className="w-full max-w-md bg-white rounded-[2rem] shadow-2xl relative flex flex-col overflow-hidden h-[85dvh] min-h-[450px] max-h-[640px] border border-gray-200">
        
        {/* プログレスバー (ドット) */}
        {currentStep < 6 && (
          <div className="absolute top-8 left-0 right-0 flex justify-center gap-1.5 z-40 px-10 pointer-events-none">
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <div key={i} className={`h-1.5 rounded-full transition-all duration-500 ${currentStep === i + 1 ? 'w-8 bg-gray-900' : currentStep > i + 1 ? 'w-3 bg-gray-300' : 'w-3 bg-gray-100'}`} />
            ))}
          </div>
        )}

        {/* 戻るボタン */}
        {currentStep > 1 && currentStep < 6 && !isLoading && (
          <button onClick={handleBack} className="absolute top-5 left-5 z-50 text-gray-400 hover:text-gray-900 transition-colors p-2 bg-white/80 backdrop-blur-sm rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}

        <div className="flex-1 relative overflow-x-hidden overflow-y-auto pb-safe">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={currentStep}
              custom={direction}
              variants={swipeVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: "tween", duration: 0.25, ease: "circOut" }}
              className="flex flex-col h-full px-8 pt-24 pb-8 min-h-full"
            >
              
              {/* ==========================================
                  STEP 1: 店舗名
              ========================================== */}
              {currentStep === 1 && (
                <div className="flex flex-col h-full">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Duacel 紹介プログラム</p>
                  <h2 className="text-2xl font-black text-gray-900 mb-4 leading-tight">まずはサロン名・店舗名を<br/>入力してください</h2>
                  <p className="text-sm text-gray-500 font-medium leading-relaxed mb-8">
                    ※個人で登録する場合はスキップしてください。
                  </p>
                  
                  <div className="mt-auto space-y-4">
                    <input 
                      placeholder="例: Duacel サロン 表参道店" value={shopName} onChange={e => setShopName(e.target.value)}
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
                  <h2 className="text-2xl font-black text-gray-900 mb-4 leading-tight">管理者のお名前を<br/>入力してください</h2>
                  <p className="text-sm text-gray-500 font-medium leading-relaxed mb-8">
                    管理者は、メンバーの追加や削除、<br/>紹介実績の確認、インセンティブの<br/>配分比率設定などを行えます。
                  </p>
                  
                  <div className="mt-auto space-y-4">
                    <input 
                      placeholder="例: 山田 太郎" value={ownerName} onChange={e => setOwnerName(e.target.value)}
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
                  <h2 className="text-2xl font-black text-gray-900 mb-4 leading-tight">ログイン情報を<br/>設定してください</h2>
                  <p className="text-sm text-gray-500 font-medium leading-relaxed mb-6">
                    管理者用のダッシュボードにアクセスするための<br/>メールアドレスとパスワードを入力してください。
                  </p>
                  
                  <div className="mt-auto space-y-4">
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 block mb-1">メールアドレス</label>
                      <input 
                        type="email" placeholder="admin@example.com" value={email} onChange={e => setEmail(e.target.value)}
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
                  <h2 className="text-2xl font-black text-gray-900 mb-4 leading-tight">管理者の電話番号を<br/>入力してください</h2>
                  <p className="text-sm text-gray-500 font-medium leading-relaxed mb-8">
                    メールが送信できなかった場合などに使用します。<br/>通常は使用しません。
                  </p>
                  
                  <div className="mt-auto space-y-4">
                    <input 
                      type="tel" placeholder="03-1234-5678" value={phone} onChange={e => setPhone(e.target.value)}
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
                  <h2 className="text-2xl font-black text-gray-900 mb-4 leading-tight">数字4ケタのPINコードを<br/>設定してください</h2>
                  <p className="text-sm text-gray-500 font-medium leading-relaxed mb-8">
                    紹介QRを表示する「マイページ」に<br/>アクセスするために必要になります。
                  </p>
                  
                  <div className="mt-auto space-y-4">
                    <input 
                      type="password" inputMode="numeric" maxLength={4} placeholder="••••" 
                      value={pin} onChange={e => setPin(e.target.value.replace(/[^0-9]/g, ''))} disabled={isLoading}
                      onKeyDown={e => handleKeyDown(e, handleRegisterShop)}
                      className="w-full px-4 py-4 bg-gray-50 border border-gray-200 rounded-xl text-2xl tracking-[1em] text-center font-mono font-black text-gray-900 focus:ring-2 focus:ring-gray-900 focus:bg-white transition-all outline-none" 
                    />
                    {errorMessage && <p className="text-xs font-bold text-red-500 text-center">{errorMessage}</p>}
                    <button 
                      onClick={handleRegisterShop} disabled={isLoading || pin.length !== 4} 
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
                        <p className="text-[10px] text-gray-400 font-bold mb-1 uppercase tracking-widest flex items-center gap-1"><User className="w-3 h-3"/> Player's Page</p>
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