'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { QRCodeCanvas } from 'qrcode.react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion' 

import { 
  Building2, User, Mail, Lock, ArrowRight, ArrowLeft,
  QrCode, UserPlus, CheckCircle2, Copy, Share2, 
  Loader2, X, Sparkles, Eye, EyeOff, Smartphone, 
  ChevronRight, Apple, Share, Trophy, Coins, Zap, Star, LayoutDashboard, Phone
} from 'lucide-react'

// ★ オーナーのマイページ用トークン（4桁）
const generateSecureToken = () => {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

// ★ 推測不可能な招待URL用のトークン（8桁）
const generateInviteToken = () => {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

const swipeVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 300 : -300,
    opacity: 0,
    scale: 0.95,
  }),
  center: {
    zIndex: 1,
    x: 0,
    opacity: 1,
    scale: 1,
  },
  exit: (direction: number) => ({
    zIndex: 0,
    x: direction < 0 ? 300 : -300,
    opacity: 0,
    scale: 0.95,
  })
}

export default function ShopJoinPage() {
  const [shopName, setShopName] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('') 
  const [password, setPassword] = useState('') 
  const [pin, setPin] = useState('') // ★ PINのステートを追加
  
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [showPassword, setShowPassword] = useState(false) 
  
  const [staffInviteUrl, setStaffInviteUrl] = useState('')
  const [ownerMagicUrl, setOwnerMagicUrl] = useState('')
  const [activeModal, setActiveModal] = useState<'invite' | null>(null)
  const [copiedType, setCopiedType] = useState('') 
  const [deviceType, setDeviceType] = useState<'ios' | 'android' | 'desktop'>('desktop')

  const [[onboardingStep, direction], setStepDirection] = useState([1, 0])
  const TOTAL_STEPS = 5 

  const paginate = (newDirection: number) => {
    setStepDirection([onboardingStep + newDirection, newDirection])
  }

  const router = useRouter()
  const shareText = "Duacelアンバサダープログラムへようこそ！メンバーの皆さんは、以下のURLから自分の接客用ページを発行してください。"

  useEffect(() => {
    const savedData = localStorage.getItem('duacel_onboarding_data');
    if (savedData) {
      const data = JSON.parse(savedData);
      setShopName(data.shopName);
      setStaffInviteUrl(data.staffInviteUrl);
      setOwnerMagicUrl(data.ownerMagicUrl);
      setStepDirection([data.onboardingStep || 1, 0]);
    }
  }, []);

  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase()
    if (/iphone|ipad|ipod/.test(ua)) setDeviceType('ios')
    else if (/android/.test(ua)) setDeviceType('android')
    else setDeviceType('desktop')
  }, [])

  useEffect(() => {
    if (staffInviteUrl) {
      const savedData = localStorage.getItem('duacel_onboarding_data');
      if (savedData) {
        const data = JSON.parse(savedData);
        data.onboardingStep = onboardingStep;
        localStorage.setItem('duacel_onboarding_data', JSON.stringify(data));
      }
    }
  }, [onboardingStep, staffInviteUrl]);

  const handleRegisterShop = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setErrorMessage('')

    // ★ 4桁のPINチェック
    if (pin.length !== 4) {
      setErrorMessage('マイページ用暗証番号は4桁の数字で入力してください。')
      setIsLoading(false)
      return
    }

    const finalShopName = shopName.trim() !== '' ? shopName.trim() : ownerName.trim()

    // 1. Supabase Auth への登録
    const { data: authData, error: authError } = await supabase.auth.signUp({ email, password })
    if (authError) { setErrorMessage('アカウント作成エラー: ' + authError.message); setIsLoading(false); return; }

    const userId = authData.user?.id
    const tempId = `TEMP_${Date.now()}`
    const inviteToken = generateInviteToken()

    // 2. 店舗情報の登録
    const { data: newShop, error: insertError } = await supabase
      .from('shops').insert([{ 
        id: tempId, 
        name: finalShopName, 
        owner_email: email, 
        phone: phone, 
        owner_id: userId,
        invite_token: inviteToken 
      }])
      .select('shop_number').single()
    
    if (insertError) { setErrorMessage('店舗登録エラー: ' + insertError.message); setIsLoading(false); return; }

    const formattedShopId = `S${newShop.shop_number.toString().padStart(3, '0')}`
    const { error: updateError } = await supabase.from('shops').update({ id: formattedShopId }).eq('shop_number', newShop.shop_number)
    if (updateError) { setErrorMessage('店舗ID確定エラー: ' + updateError.message); setIsLoading(false); return; }

    // 3. オーナーを「最初のスタッフ」として登録（★ security_pin に 4桁のPINを保存！）
    const nextStaffId = `ST${generateSecureToken().toUpperCase()}` 
    const secureToken = generateSecureToken()
    const { error: staffError } = await supabase.from('staffs').insert([{
      id: nextStaffId, shop_id: formattedShopId, name: ownerName, email: email,
      referral_code: `${formattedShopId}_${nextStaffId}`, secret_token: secureToken, 
      security_pin: pin, // 👈 追加
      is_deleted: false
    }])
    if (staffError) { setErrorMessage('管理者情報の初期設定に失敗しました: ' + staffError.message); setIsLoading(false); return; }

    // 4. 次の画面へ渡すデータの整理
    const onboardingData = {
      shopName: finalShopName,
      staffInviteUrl: `${window.location.origin}/reg/${inviteToken}`,
      ownerMagicUrl: `${window.location.origin}/m/${secureToken}`,
      onboardingStep: 1
    };
    
    localStorage.setItem('duacel_onboarding_data', JSON.stringify(onboardingData));

    setShopName(onboardingData.shopName);
    setStaffInviteUrl(onboardingData.staffInviteUrl);
    setOwnerMagicUrl(onboardingData.ownerMagicUrl);
    
    setTimeout(() => setIsLoading(false), 800)
  }

  const handleWebShare = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: 'Duacelスタッフ登録', text: shareText, url: staffInviteUrl }); } 
      catch (error) { console.log('Error sharing', error); }
    } else {
      navigator.clipboard.writeText(`${shareText}\n${staffInviteUrl}`)
      setCopiedType('invite')
      setTimeout(() => setCopiedType(''), 2000)
    }
  }

  return (
    <div className="fixed inset-0 bg-gray-50 flex flex-col justify-center items-center p-4 sm:p-6 font-sans text-gray-800 overflow-hidden">
      
      {!staffInviteUrl ? (
        // 登録フォーム
        <div className="w-full max-w-md animate-in fade-in duration-500 overflow-y-auto max-h-full pb-10">
          <div className="text-center mb-8 mt-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-600 text-white mb-4 shadow-lg shadow-indigo-200">
              <Sparkles className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Duacel パートナー登録</h1>
            <p className="text-sm text-gray-500 mt-2">事業情報を入力して、環境を構築しましょう。</p>
          </div>

          <form onSubmit={handleRegisterShop} className="bg-white p-6 sm:p-8 rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100 space-y-5">
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-gray-500 mb-1.5 uppercase tracking-wider">店舗・屋号・チーム名 <span className="text-indigo-500 ml-1">(任意)</span></label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400"><Building2 className="w-5 h-5" /></div>
                  <input placeholder="空欄の場合はお名前が登録されます" value={shopName} onChange={e => setShopName(e.target.value)} disabled={isLoading}
                    className="w-full pl-11 pr-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white transition-all outline-none placeholder:text-xs" />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-500 mb-1.5 uppercase tracking-wider">店舗の電話番号 <span className="text-red-500 ml-1">*</span></label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400"><Phone className="w-5 h-5" /></div>
                  <input required type="tel" placeholder="03-1234-5678" value={phone} onChange={e => setPhone(e.target.value)} disabled={isLoading}
                    className="w-full pl-11 pr-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white transition-all outline-none" />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-500 mb-1.5 uppercase tracking-wider">管理者名（ご自身のお名前） <span className="text-red-500 ml-1">*</span></label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400"><User className="w-5 h-5" /></div>
                  <input required placeholder="例: 山田 太郎 / アカウント名" value={ownerName} onChange={e => setOwnerName(e.target.value)} disabled={isLoading}
                    className="w-full pl-11 pr-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white transition-all outline-none" />
                </div>
              </div>
              
              <div>
                <label className="block text-[11px] font-bold text-gray-500 mb-1.5 uppercase tracking-wider">ログイン用メールアドレス <span className="text-red-500 ml-1">*</span></label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400"><Mail className="w-5 h-5" /></div>
                  <input required type="email" placeholder="admin@example.com" value={email} onChange={e => setEmail(e.target.value)} disabled={isLoading}
                    className="w-full pl-11 pr-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white transition-all outline-none" />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-500 mb-1.5 uppercase tracking-wider">管理用パスワード (6文字以上) <span className="text-red-500 ml-1">*</span></label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400"><Lock className="w-5 h-5" /></div>
                  <input required type={showPassword ? "text" : "password"} minLength={6} placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} disabled={isLoading}
                    className="w-full pl-11 pr-12 py-3 bg-gray-50/50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white transition-all outline-none" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600 transition-colors">
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* ★ 追加：マイページ用PIN入力フィールド */}
              <div>
                <div className="flex justify-between items-end mb-1.5">
                  <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">マイページ用 暗証番号（数字4桁） <span className="text-red-500 ml-1">*</span></label>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400"><Smartphone className="w-5 h-5" /></div>
                  <input required type="password" inputMode="numeric" maxLength={4} placeholder="••••" 
                    value={pin} onChange={e => setPin(e.target.value.replace(/[^0-9]/g, ''))} disabled={isLoading}
                    className="w-full pl-11 pr-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl text-lg tracking-[0.5em] font-mono focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white transition-all outline-none" />
                </div>
                <p className="text-[10px] text-gray-400 mt-1.5">※現場用のマイページを開く際に使用します</p>
              </div>

            </div>

            {errorMessage && (
              <div className="p-3 bg-red-50 text-red-600 border border-red-100 rounded-xl text-xs font-bold flex items-start gap-2">
                <X className="w-4 h-4 shrink-0" /> {errorMessage}
              </div>
            )}

            <button type="submit" disabled={isLoading} className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition-all shadow-md shadow-indigo-200 flex justify-center items-center gap-2 mt-2 disabled:opacity-70 disabled:cursor-not-allowed active:scale-95">
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'アカウントを作成する'}
            </button>
            <p className="text-center text-[10px] text-gray-400">すでにアカウントをお持ちの場合は<a href="/login" className="text-indigo-600 font-bold ml-1 hover:underline">ログイン</a></p>
          </form>
        </div>

      ) : (

        // オンボーディング画面
        <div className="w-full max-w-sm h-[80vh] min-h-[500px] max-h-[680px] bg-white rounded-[2.5rem] shadow-2xl relative overflow-hidden border-[8px] border-gray-900/5 select-none animate-in fade-in zoom-in-95 duration-500">
          
          <div className="absolute top-6 left-0 right-0 flex justify-center gap-1.5 z-30 px-10">
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <div key={i} className={`h-1.5 rounded-full transition-all duration-500 ${onboardingStep === i + 1 ? 'w-8 bg-indigo-600' : onboardingStep > i + 1 ? 'w-4 bg-indigo-300' : 'w-4 bg-gray-100'}`} />
            ))}
          </div>

          <AnimatePresence initial={false} custom={direction}>
            <motion.div
              key={onboardingStep}
              custom={direction}
              variants={swipeVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: "spring", stiffness: 400, damping: 35 }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.8}
              onDragEnd={(e, { offset, velocity }) => {
                const swipeThreshold = 30;
                if (offset.x < -swipeThreshold && onboardingStep < TOTAL_STEPS) {
                  paginate(1)
                } else if (offset.x > swipeThreshold && onboardingStep > 1) {
                  paginate(-1)
                }
              }}
              style={{ touchAction: "pan-y" }} 
              className="absolute inset-0 flex flex-col items-center justify-center p-8 cursor-grab active:cursor-grabbing h-full"
            >
              
              {/* --- 1枚目 --- */}
              {onboardingStep === 1 && (
                <div className="flex flex-col items-center text-center h-full pt-16">
                  <div className="relative mb-12">
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 15, repeat: Infinity, ease: "linear" }} className="absolute -inset-6 bg-gradient-to-tr from-indigo-200 to-emerald-200 rounded-full opacity-50 blur-2xl" />
                    <div className="relative w-32 h-32 bg-white border border-gray-50 rounded-[2rem] flex items-center justify-center shadow-2xl">
                      <Sparkles className="w-16 h-16 text-indigo-600" />
                    </div>
                  </div>
                  <p className="text-xs font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-emerald-500 uppercase tracking-[0.2em] mb-3">Welcome to</p>
                  <h2 className="text-3xl font-black text-gray-900 leading-tight mb-6">Duacel<br/><span className="text-2xl text-gray-500">紹介プログラムへ</span></h2>
                  <p className="text-sm text-gray-500 font-medium leading-relaxed mb-auto">
                    サロンワークの価値を最大化する、<br/>
                    新しいプロモーションの形が始まります。
                  </p>
                </div>
              )}

              {/* --- 2枚目 --- */}
              {onboardingStep === 2 && (
                <div className="flex flex-col items-center text-center h-full pt-16">
                  <div className="flex items-center gap-3 mb-10 p-5 bg-white shadow-xl shadow-gray-200/50 rounded-3xl border border-gray-100">
                    <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl"><Trophy className="w-8 h-8" /></div>
                    <motion.div animate={{ x: [0, 5, 0] }} transition={{ duration: 1.5, repeat: Infinity }}>
                      <ArrowRight className="w-6 h-6 text-gray-300" />
                    </motion.div>
                    <div className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl"><Coins className="w-8 h-8" /></div>
                  </div>
                  <h3 className="text-2xl font-black text-gray-900 mb-5">施術とプロダクトの<br/>美しいシナジー</h3>
                  <p className="text-sm text-gray-500 font-medium leading-relaxed mb-8">
                    お店の「発毛促進・髪質改善コース」を<br/>
                    お客様へプロモーションしてください。<br/><br/>
                    <strong className="text-gray-900 bg-indigo-50 px-2 py-1 rounded">購入件数に応じたインセンティブ</strong>を<br/>
                    お支払いするプログラムです。
                  </p>
                </div>
              )}

              {/* --- 3枚目 --- */}
              {onboardingStep === 3 && (
                <div className="flex flex-col items-center text-center h-full pt-16">
                  <div className="relative mb-8">
                    <QRCodeCanvas value={`${window.location.origin}/welcome/S000_Demo`} size={120} level="H" fgColor="#4338ca" className="p-3 bg-white border border-gray-100 rounded-[2rem] shadow-2xl" />
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.3, type: "spring" }} className="absolute -bottom-4 -right-4 p-3 bg-emerald-500 rounded-full shadow-lg border-4 border-white text-white">
                      <CheckCircle2 className="w-6 h-6" />
                    </motion.div>
                  </div>
                  <h3 className="text-2xl font-black text-gray-900 mb-4">紹介は、<br/>QRをご提示するだけ。</h3>
                  <p className="text-sm text-gray-500 font-medium leading-relaxed mb-6">
                    購入希望のお客様に、<br/>スマホでサッとQRを見せるだけ。
                  </p>
                  <div className="flex items-center gap-3 p-4 bg-indigo-50/80 border border-indigo-100 rounded-2xl w-full">
                    <Zap className="w-8 h-8 text-indigo-500 shrink-0" />
                    <p className="text-[11px] text-indigo-900 font-bold text-left leading-relaxed">
                      お客様も<strong className="text-indigo-700 text-xs">「紹介特別価格」</strong>で<br/>ご購入いただける、喜ばれる仕組みです。
                    </p>
                  </div>
                </div>
              )}

              {/* --- 4枚目 --- */}
              {onboardingStep === 4 && (
                <div className="flex flex-col items-center text-center h-full pt-12">
                  <div className="w-20 h-20 bg-gray-900 text-white rounded-[2rem] flex items-center justify-center mb-6 shadow-2xl relative">
                    <QrCode className="w-10 h-10" />
                    <Star className="w-5 h-5 text-yellow-400 absolute -top-2 -right-2 animate-pulse drop-shadow-lg" />
                  </div>
                  <h3 className="text-xl font-black text-gray-900 mb-3">アプリとして追加する</h3>
                  <p className="text-xs text-gray-500 font-medium leading-relaxed mb-6">
                    紹介QRをいつでも・一瞬で提示できるよう<br/>
                    <strong className="text-indigo-600">スマートフォンのホーム画面</strong>に<br/>
                    Duacelを追加することをお勧めします。
                  </p>

                  {deviceType === 'ios' ? (
                    <div className="bg-gray-50 rounded-2xl p-4 w-full text-left space-y-3 border border-gray-100 shadow-inner mb-auto">
                      <p className="text-xs font-bold text-gray-800 flex items-center gap-2"><Apple className="w-4 h-4" /> やり方 (iPhone)</p>
                      <ol className="text-[11px] text-gray-600 space-y-2 font-medium">
                        <li className="flex items-center gap-3">
                          <span className="w-7 h-7 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-500 shadow-sm"><Share className="w-4 h-4" /></span>
                          Safari下の「共有」ボタンをタップ
                        </li>
                        <li className="flex items-center gap-3">
                          <span className="w-7 h-7 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-500 font-bold shadow-sm">+</span>
                          「ホーム画面に追加」を選択
                        </li>
                      </ol>
                    </div>
                  ) : (
                    <div className="bg-gray-50 rounded-2xl p-4 w-full text-left space-y-3 border border-gray-100 shadow-inner mb-auto">
                      <p className="text-xs font-bold text-gray-800 flex items-center gap-2"><Smartphone className="w-4 h-4" /> やり方 (Android / PC)</p>
                      <p className="text-[11px] text-gray-600 font-medium leading-relaxed">
                        ブラウザのメニュー（︙）を開き、<br/>
                        <strong className="text-gray-900">「アプリをインストール」</strong> または<br/>
                        <strong className="text-gray-900">「ホーム画面に追加」</strong> を選択してください。
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* --- 5枚目 (★変更: マイページへの案内だけに統一) --- */}
              {onboardingStep === TOTAL_STEPS && (
                <div className="flex flex-col items-center text-center h-full pt-16">
                  <div className="w-24 h-24 bg-gradient-to-tr from-indigo-600 to-emerald-500 rounded-full flex items-center justify-center mb-8 shadow-2xl relative">
                    <motion.div animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0, 0.5] }} transition={{ duration: 2, repeat: Infinity }} className="absolute inset-0 bg-white rounded-full" />
                    <CheckCircle2 className="w-12 h-12 text-white relative z-10" />
                  </div>
                  <h2 className="text-3xl font-black text-gray-900 mb-3">準備完了！</h2>
                  <p className="text-sm text-gray-500 font-medium leading-relaxed mb-8">
                    それでは、はじめましょう。
                  </p>
                  
                  <div className="w-full mt-auto">
                    <button 
                      onClick={() => { localStorage.removeItem('duacel_onboarding_data'); window.location.href = ownerMagicUrl; }} 
                      className="w-full p-5 bg-gray-900 hover:bg-gray-800 text-white rounded-2xl text-left transition-all shadow-xl group relative overflow-hidden active:scale-95 flex items-center justify-between"
                    >
                      <div>
                        <p className="text-[10px] text-gray-400 font-bold mb-1 uppercase tracking-widest flex items-center gap-1"><User className="w-3 h-3"/> Player's Page</p>
                        <p className="font-bold text-lg">マイページを開く</p>
                      </div>
                      <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center group-hover:bg-white/20 transition-colors">
                        <ChevronRight className="w-5 h-5" />
                      </div>
                    </button>
                    <p className="text-[10px] text-gray-400 font-medium mt-4">※ホーム画面に追加してから開くのがおすすめです</p>
                  </div>
                </div>
              )}

            </motion.div>
          </AnimatePresence>
          
          {onboardingStep < TOTAL_STEPS && (
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}
              className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 text-[10px] font-bold text-gray-400 tracking-widest uppercase pointer-events-none"
            >
              <ArrowLeft className="w-3 h-3 animate-pulse" /> Swipe <ArrowRight className="w-3 h-3 animate-pulse" />
            </motion.div>
          )}
        </div>
      )}
    </div>
  )
}