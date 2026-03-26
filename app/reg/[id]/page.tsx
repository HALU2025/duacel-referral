'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion' 

import { 
  User, Mail, ArrowRight, ArrowLeft, CheckCircle2, 
  Loader2, X, Sparkles, UserPlus, QrCode, Smartphone, 
  ChevronRight, Apple, Share, Zap, Coins, Star, Gift, Lock
} from 'lucide-react'

const generateSecureToken = () => {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
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

export default function MemberJoinPage() {
  const params = useParams()
  // ★ 変更：URLパラメータは shop_id ではなく invite_token になります
  const inviteToken = params.id as string 
  const router = useRouter()

  const [shop, setShop] = useState<any>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [pin, setPin] = useState('') 
  
  const [isLoading, setIsLoading] = useState(false)
  const [isPageLoading, setIsPageLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  
  const [magicLinkUrl, setMagicLinkUrl] = useState('')
  const [isReturningUser, setIsReturningUser] = useState(false)
  const [deviceType, setDeviceType] = useState<'ios' | 'android' | 'desktop'>('desktop')

  const [[onboardingStep, direction], setStepDirection] = useState([1, 0])
  const TOTAL_STEPS = 4 

  const paginate = (newDirection: number) => {
    setStepDirection([onboardingStep + newDirection, newDirection])
  }

  // --- 店舗情報の取得（invite_token から逆引き検索） ---
  useEffect(() => {
    const fetchShop = async () => {
      // ★ 変更：invite_tokenを使って店舗を特定し、実際のshop.id（S001など）を取得する
      const { data, error } = await supabase
        .from('shops')
        .select('id, name')
        .eq('invite_token', inviteToken)
        .single()
        
      if (data) {
        setShop(data) // data.id に本物の店舗IDが入っている
      }
      setIsPageLoading(false)
    }
    if (inviteToken) fetchShop()
  }, [inviteToken])

  // --- LocalStorageによる復元 ---
  useEffect(() => {
    if (!shop?.id) return;
    const savedKey = `duacel_member_onboarding_${shop.id}`;
    const savedData = localStorage.getItem(savedKey);
    if (savedData) {
      const data = JSON.parse(savedData);
      setName(data.name);
      setMagicLinkUrl(data.magicLinkUrl);
      setIsReturningUser(data.isReturningUser);
      setStepDirection([data.onboardingStep || 1, 0]);
    }
  }, [shop?.id]);

  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase()
    if (/iphone|ipad|ipod/.test(ua)) setDeviceType('ios')
    else if (/android/.test(ua)) setDeviceType('android')
    else setDeviceType('desktop')
  }, [])

  useEffect(() => {
    if (magicLinkUrl && shop?.id) {
      const savedKey = `duacel_member_onboarding_${shop.id}`;
      const savedData = localStorage.getItem(savedKey);
      if (savedData) {
        const data = JSON.parse(savedData);
        data.onboardingStep = onboardingStep;
        localStorage.setItem(savedKey, JSON.stringify(data));
      }
    }
  }, [onboardingStep, magicLinkUrl, shop?.id]);

  // --- 登録処理 ---
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setErrorMessage('')

    if (pin.length !== 4) {
      setErrorMessage('暗証番号は4桁の数字で入力してください。')
      setIsLoading(false)
      return
    }

    try {
      // 1. 既存ユーザーチェック (本物の shop.id を使用)
      const { data: existingStaff } = await supabase
        .from('staffs').select('secret_token, name').eq('shop_id', shop.id).eq('email', email).maybeSingle()

      if (existingStaff) {
        const onboardingData = {
          name: existingStaff.name,
          magicLinkUrl: `/m/${existingStaff.secret_token}`,
          isReturningUser: true,
          onboardingStep: 1
        };
        localStorage.setItem(`duacel_member_onboarding_${shop.id}`, JSON.stringify(onboardingData));

        setTimeout(() => {
          setName(existingStaff.name)
          setMagicLinkUrl(onboardingData.magicLinkUrl)
          setIsReturningUser(true)
          setIsLoading(false)
        }, 600)
        return
      }

      // 2. 新規登録処理
      const { data: allStaffs } = await supabase.from('staffs').select('id')
      const maxNum = allStaffs?.reduce((max, s) => {
        const num = parseInt(s.id.replace('ST', ''), 10)
        return !isNaN(num) && num > max ? num : max
      }, 0) || 0
      const nextStaffId = `ST${(maxNum + 1).toString().padStart(3, '0')}`

      const secureToken = generateSecureToken()
      // 紹介コードには本物の店舗ID（S001）を使う
      const publicReferralCode = `${shop.id}_${nextStaffId}`

      // ★ security_pin を本番のDBカラムに保存
      const { error: insertError } = await supabase.from('staffs').insert([{
        id: nextStaffId, shop_id: shop.id, name: name, email: email,
        referral_code: publicReferralCode, secret_token: secureToken,
        security_pin: pin, is_deleted: false 
      }])

      if (insertError) throw insertError

      const onboardingData = {
        name: name,
        magicLinkUrl: `/m/${secureToken}`,
        isReturningUser: false,
        onboardingStep: 1
      };
      localStorage.setItem(`duacel_member_onboarding_${shop.id}`, JSON.stringify(onboardingData));

      setTimeout(() => {
        setMagicLinkUrl(onboardingData.magicLinkUrl)
        setIsLoading(false)
      }, 800)

    } catch (err: any) {
      setErrorMessage('登録エラーが発生しました: ' + err.message)
      setIsLoading(false)
    }
  }

  const goToMyPage = () => {
    localStorage.removeItem(`duacel_member_onboarding_${shop?.id}`);
    router.push(magicLinkUrl);
  }

  if (isPageLoading) return <div className="min-h-[100dvh] flex items-center justify-center bg-gray-50"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>
  if (!shop) return <div className="min-h-[100dvh] flex items-center justify-center bg-gray-50 text-gray-500">無効な招待URLです。</div>

  return (
    <div className="fixed inset-0 bg-gray-50 flex flex-col justify-center items-center p-4 sm:p-6 font-sans text-gray-800 overflow-hidden selection:bg-indigo-100 selection:text-indigo-900">
      
      {!magicLinkUrl ? (
        // --- 登録フォーム ---
        <div className="w-full max-w-md animate-in fade-in duration-500 overflow-y-auto max-h-full pb-10">
          <div className="text-center mb-8 mt-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 mb-4 shadow-sm border border-indigo-100 relative">
              <UserPlus className="w-8 h-8 relative z-10" />
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 10, repeat: Infinity, ease: "linear" }} className="absolute -inset-2 bg-gradient-to-tr from-indigo-200 to-transparent rounded-full opacity-30 blur-md" />
            </div>
            <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-1 opacity-80">{shop.name}</p>
            <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">メンバー登録</h1>
            <p className="text-sm text-gray-500 mt-2 leading-relaxed">アカウント情報を入力して、<br/>専用ページを発行しましょう。</p>
          </div>

          <form onSubmit={handleRegister} className="bg-white p-6 sm:p-8 rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100 space-y-5">
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-gray-500 mb-1.5 uppercase tracking-wider">お名前（表示名） <span className="text-red-500 ml-1">*</span></label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400"><User className="w-5 h-5" /></div>
                  <input required placeholder="例: 山田 太郎" value={name} onChange={e => setName(e.target.value)} disabled={isLoading}
                    className="w-full pl-11 pr-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white transition-all outline-none" />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-500 mb-1.5 uppercase tracking-wider">連絡先メールアドレス <span className="text-red-500 ml-1">*</span></label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400"><Mail className="w-5 h-5" /></div>
                  <input required type="email" placeholder="example@email.com" value={email} onChange={e => setEmail(e.target.value)} disabled={isLoading}
                    className="w-full pl-11 pr-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white transition-all outline-none" />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-end mb-1.5">
                  <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">暗証番号（数字4桁） <span className="text-red-500 ml-1">*</span></label>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400"><Lock className="w-5 h-5" /></div>
                  <input required type="password" inputMode="numeric" maxLength={4} placeholder="••••" 
                    value={pin} onChange={e => setPin(e.target.value.replace(/[^0-9]/g, ''))} disabled={isLoading}
                    className="w-full pl-11 pr-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl text-lg tracking-[0.5em] font-mono focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white transition-all outline-none" />
                </div>
                <p className="text-[10px] text-gray-400 mt-1.5">※設定変更時のロック解除に使用します</p>
              </div>
            </div>

            {errorMessage && (
              <div className="p-3 bg-red-50 text-red-600 border border-red-100 rounded-xl text-xs font-bold flex items-start gap-2">
                <X className="w-4 h-4 shrink-0" /> {errorMessage}
              </div>
            )}

            <button type="submit" disabled={isLoading} className="w-full py-4 bg-gray-900 hover:bg-gray-800 text-white rounded-xl font-bold text-sm transition-all shadow-xl flex justify-center items-center gap-2 mt-2 active:scale-95">
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : '専用ページを発行する'}
            </button>
          </form>
        </div>

      ) : (

        // --- 登録後：プロモード・オンボーディング ---
        <div className="w-full max-w-sm h-[80vh] min-h-[500px] max-h-[640px] bg-white rounded-[2.5rem] shadow-2xl relative overflow-hidden border-[8px] border-gray-900/5 select-none animate-in fade-in zoom-in-95 duration-500">
          
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
                if ((offset.x < -swipeThreshold || velocity.x < -500) && onboardingStep < TOTAL_STEPS) paginate(1)
                else if ((offset.x > swipeThreshold || velocity.x > 500) && onboardingStep > 1) paginate(-1)
              }}
              style={{ touchAction: "pan-y" }} 
              className="absolute inset-0 flex flex-col items-center justify-center p-8 cursor-grab active:cursor-grabbing h-full"
            >
              
              {/* --- 1枚目 --- */}
              {onboardingStep === 1 && (
                <div className="flex flex-col items-center text-center h-full pt-16 w-full">
                  <div className="relative mb-10">
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 15, repeat: Infinity, ease: "linear" }} className="absolute -inset-6 bg-gradient-to-tr from-emerald-200 to-indigo-200 rounded-full opacity-50 blur-2xl" />
                    <div className="relative w-32 h-32 bg-white border border-gray-50 rounded-[2rem] flex items-center justify-center shadow-2xl">
                      {isReturningUser ? <Sparkles className="w-16 h-16 text-emerald-500" /> : <CheckCircle2 className="w-16 h-16 text-emerald-500" />}
                    </div>
                  </div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3">{shop.name}</p>
                  <h2 className="text-3xl font-black text-gray-900 leading-tight mb-4">
                    {isReturningUser ? 'おかえりなさい！' : '発行完了しました！'}
                  </h2>
                  <p className="text-sm text-gray-500 font-medium leading-relaxed mb-auto">
                    {isReturningUser 
                      ? `${name}さんの専用ページは準備万端です。\nさっそく活動を再開しましょう。` 
                      : `${name}さんの専用ページができました。\nお客様に紹介して、\nインセンティブを獲得しましょう。`}
                  </p>
                </div>
              )}

              {/* --- 2枚目 --- */}
              {onboardingStep === 2 && (
                <div className="flex flex-col items-center text-center h-full pt-16 w-full">
                  <div className="flex items-center gap-3 mb-10 p-5 bg-white shadow-xl shadow-gray-200/50 rounded-3xl border border-gray-100">
                    <div className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl"><QrCode className="w-8 h-8" /></div>
                    <motion.div animate={{ x: [0, 5, 0] }} transition={{ duration: 1.5, repeat: Infinity }}>
                      <ArrowRight className="w-6 h-6 text-gray-300" />
                    </motion.div>
                    <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl"><Gift className="w-8 h-8" /></div>
                  </div>
                  <h3 className="text-2xl font-black text-gray-900 mb-5">QRを見せるだけ</h3>
                  <p className="text-sm text-gray-500 font-medium leading-relaxed mb-8">
                    購入希望のお客様に、<br/>
                    あなたの<strong className="text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">専用QRコード</strong>を<br/>
                    スキャンしてもらうだけで完了です。
                  </p>
                  <div className="p-4 bg-gray-50 border border-gray-100 rounded-2xl text-[11px] font-bold text-gray-600 text-left space-y-2 w-full shadow-inner">
                     <p className="flex items-center gap-2"><Zap className="w-4 h-4 text-amber-500"/> その後の手続きは一切不要</p>
                     <p className="flex items-center gap-2"><Coins className="w-4 h-4 text-amber-500"/> 購入後、自動でポイントを付与</p>
                  </div>
                </div>
              )}

              {/* --- 3枚目 --- */}
              {onboardingStep === 3 && (
                <div className="flex flex-col items-center text-center h-full pt-12 w-full">
                  <div className="w-20 h-20 bg-gray-900 text-white rounded-[2rem] flex items-center justify-center mb-6 shadow-2xl relative">
                    <Smartphone className="w-10 h-10" />
                    <Star className="w-5 h-5 text-yellow-400 absolute -top-2 -right-2 animate-pulse drop-shadow-lg" />
                  </div>
                  <h3 className="text-xl font-black text-gray-900 mb-4">1秒でQRを出すために</h3>
                  <p className="text-xs text-gray-500 font-medium leading-relaxed mb-6">
                    接客中にサッと提示できるよう、<br/>
                    <strong className="text-indigo-600">スマートフォンのホーム画面</strong>に<br/>
                    追加しておきましょう。
                  </p>

                  {deviceType === 'ios' ? (
                    <div className="bg-gray-50 rounded-2xl p-5 w-full text-left space-y-4 border border-gray-100 shadow-inner mb-auto">
                      <p className="text-xs font-bold text-gray-800 flex items-center gap-2"><Apple className="w-4 h-4" /> やり方 (iPhone)</p>
                      <ol className="text-[11px] text-gray-600 space-y-3 font-medium">
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
                    <div className="bg-gray-50 rounded-2xl p-5 w-full text-left space-y-4 border border-gray-100 shadow-inner mb-auto">
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

              {/* --- 4枚目 --- */}
              {onboardingStep === TOTAL_STEPS && (
                <div className="flex flex-col items-center text-center h-full pt-16 w-full">
                  <div className="w-24 h-24 bg-gradient-to-tr from-indigo-600 to-emerald-500 rounded-full flex items-center justify-center mb-10 shadow-2xl relative">
                    <motion.div animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0, 0.5] }} transition={{ duration: 2, repeat: Infinity }} className="absolute inset-0 bg-white rounded-full" />
                    <Sparkles className="w-12 h-12 text-white relative z-10" />
                  </div>
                  <h2 className="text-3xl font-black text-gray-900 mb-3">準備完了です！</h2>
                  <p className="text-sm text-gray-500 font-medium leading-relaxed mb-auto">
                    まずはご自身のQRコードを<br/>
                    確認してみましょう。
                  </p>
                  
                  <div className="w-full mt-auto">
                    <button 
                      onClick={goToMyPage} 
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