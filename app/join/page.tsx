'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { QRCodeCanvas } from 'qrcode.react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion' // ★ Framer Motion

import { 
  Building2, User, Mail, Lock, ArrowRight, ArrowLeft,
  QrCode, UserPlus, CheckCircle2, Copy, Share2, 
  Loader2, X, Sparkles, Eye, EyeOff, Smartphone, 
  MonitorSmartphone, ChevronRight, Apple, Share, Trophy, Coins, Zap, Star
} from 'lucide-react'

// ランダムな4文字の英数字を生成する関数
const generateSecureToken = () => {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export default function ShopJoinPage() {
  const [shopName, setShopName] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('') 
  
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [showPassword, setShowPassword] = useState(false) 
  
  const [staffInviteUrl, setStaffInviteUrl] = useState('')
  const [ownerMagicUrl, setOwnerMagicUrl] = useState('')

  const [activeModal, setActiveModal] = useState<'invite' | null>(null)
  const [copiedType, setCopiedType] = useState('') 

  // ★ オンボーディング（スワイプ画面）用のステートと設定
  const [onboardingStep, setOnboardingStep] = useState(1)
  const [deviceType, setDeviceType] = useState<'ios' | 'android' | 'desktop'>('desktop')
  const TOTAL_STEPS = 5 // ステップ数を5に増やします

  const router = useRouter()
  const shareText = "Duacelアンバサダープログラムへようこそ！メンバーの皆さんは、以下のURLから自分の接客用ページを発行してください。"

  // --- 1. LocalStorageによる復元ロジック ---
  useEffect(() => {
    const savedData = localStorage.getItem('duacel_onboarding_data');
    if (savedData) {
      const data = JSON.parse(savedData);
      setShopName(data.shopName);
      setStaffInviteUrl(data.staffInviteUrl);
      setOwnerMagicUrl(data.ownerMagicUrl);
      setOnboardingStep(data.onboardingStep || 1);
    }
  }, []);

  // 端末判別ロジック
  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase()
    if (/iphone|ipad|ipod/.test(ua)) setDeviceType('ios')
    else if (/android/.test(ua)) setDeviceType('android')
    else setDeviceType('desktop')
  }, [])

  // ★ 2. スワイプするたびに「現在のステップ」をLocalStorageに保存
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

  // ★ 3. 登録成功時にLocalStorageに保存する関数を修正
  const handleRegisterShop = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setErrorMessage('')

    const finalShopName = shopName.trim() !== '' ? shopName.trim() : ownerName.trim()

    // --- 登録処理 (以前のまま維持) ---
    const { data: authData, error: authError } = await supabase.auth.signUp({ email, password })
    if (authError) { setErrorMessage('アカウント作成エラー: ' + authError.message); setIsLoading(false); return; }

    const userId = authData.user?.id
    const tempId = `TEMP_${Date.now()}`

    const { data: newShop, error: insertError } = await supabase
      .from('shops').insert([{ id: tempId, name: finalShopName, owner_email: email, owner_id: userId }])
      .select('shop_number').single()
    if (insertError) { setErrorMessage('店舗登録エラー: ' + insertError.message); setIsLoading(false); return; }

    const formattedShopId = `S${newShop.shop_number.toString().padStart(3, '0')}`
    const { error: updateError } = await supabase.from('shops').update({ id: formattedShopId }).eq('shop_number', newShop.shop_number)
    if (updateError) { setErrorMessage('店舗ID確定エラー: ' + updateError.message); setIsLoading(false); return; }

    const nextStaffId = `ST${generateSecureToken().toUpperCase()}` 
    const secureToken = generateSecureToken()
    const { error: staffError } = await supabase.from('staffs').insert([{
      id: nextStaffId, shop_id: formattedShopId, name: ownerName, email: email,
      referral_code: `${formattedShopId}_${nextStaffId}`, secret_token: secureToken, is_deleted: false
    }])
    if (staffError) { setErrorMessage('管理者情報の初期設定に失敗しました: ' + staffError.message); setIsLoading(false); return; }
    // ---------------------------------

    // ★ 登録完了後の処理
    const onboardingData = {
      shopName: finalShopName,
      staffInviteUrl: `${window.location.origin}/reg/${formattedShopId}`,
      ownerMagicUrl: `${window.location.origin}/m/${secureToken}`,
      onboardingStep: 1
    };
    
    // LocalStorageに保存！
    localStorage.setItem('duacel_onboarding_data', JSON.stringify(onboardingData));

    setShopName(onboardingData.shopName);
    setStaffInviteUrl(onboardingData.staffInviteUrl);
    setOwnerMagicUrl(onboardingData.ownerMagicUrl);
    
    setTimeout(() => {
      setIsLoading(false);
    }, 800)
  }

  // ★ 4. 「ダッシュボードへ進む」時にLocalStorageを消す
  const goToDashboard = () => {
    localStorage.removeItem('duacel_onboarding_data');
    router.push('/login');
  }

  const handleCopy = (text: string, type: string) => {
    navigator.clipboard.writeText(text)
    setCopiedType(type)
    setTimeout(() => setCopiedType(''), 2000)
  }

  const handleWebShare = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: 'Duacelスタッフ登録', text: shareText, url: staffInviteUrl }); } 
      catch (error) { console.log('Error sharing', error); }
    } else {
      handleCopy(`${shareText}\n${staffInviteUrl}`, 'invite')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4 font-sans text-gray-800 selection:bg-indigo-100 selection:text-indigo-900 overflow-hidden relative">
      
      {/* 登録前：いつものフォーム部分 (省略せずに維持) */}
      {!staffInviteUrl ? (
        <div className="w-full max-w-md animate-in fade-in duration-500">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-600 text-white mb-4 shadow-lg shadow-indigo-200">
              <Sparkles className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Duacel パートナー登録</h1>
            <p className="text-sm text-gray-500 mt-2">事業情報を入力して、環境を構築しましょう。</p>
          </div>

          <form onSubmit={handleRegisterShop} className="bg-white p-6 sm:p-8 rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100 space-y-5">
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-gray-500 mb-1.5 uppercase tracking-wider">
                  店舗・屋号・チーム名 <span className="text-indigo-500 ml-1">(任意)</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400"><Building2 className="w-5 h-5" /></div>
                  <input placeholder="空欄の場合はお名前が登録されます" value={shopName} onChange={e => setShopName(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white transition-all outline-none placeholder:text-xs" />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-500 mb-1.5 uppercase tracking-wider">
                  管理者名（ご自身のお名前） <span className="text-red-500 ml-1">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400"><User className="w-5 h-5" /></div>
                  <input required placeholder="例: 山田 太郎 / アカウント名" value={ownerName} onChange={e => setOwnerName(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white transition-all outline-none" />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-500 mb-1.5 uppercase tracking-wider">
                  ログイン用メールアドレス <span className="text-red-500 ml-1">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400"><Mail className="w-5 h-5" /></div>
                  <input required type="email" placeholder="admin@example.com" value={email} onChange={e => setEmail(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white transition-all outline-none" />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-500 mb-1.5 uppercase tracking-wider">
                  パスワード (6文字以上) <span className="text-red-500 ml-1">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400"><Lock className="w-5 h-5" /></div>
                  <input required type={showPassword ? "text" : "password"} minLength={6} placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)}
                    className="w-full pl-11 pr-12 py-3 bg-gray-50/50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white transition-all outline-none" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600 transition-colors">
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            </div>

            {errorMessage && (
              <div className="p-3 bg-red-50 text-red-600 border border-red-100 rounded-xl text-xs font-bold flex items-start gap-2">
                <X className="w-4 h-4 shrink-0" /> {errorMessage}
              </div>
            )}

            <button type="submit" disabled={isLoading} className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition-all shadow-md shadow-indigo-200 flex justify-center items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed">
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'アカウントを作成する'}
            </button>
            <p className="text-center text-[10px] text-gray-400">すでにアカウントをお持ちの場合は<a href="/login" className="text-indigo-600 font-bold ml-1 hover:underline">ログイン</a></p>
          </form>
        </div>

      ) : (

        // ★ 登録完了後：Proモード・オンボーディング（スワイプ実装版）
        <div className="w-full max-w-sm h-[640px] bg-white rounded-[2.5rem] shadow-2xl relative overflow-hidden border-[8px] border-gray-900/5 select-none animate-in fade-in duration-500">
          
          {/* インジケーター (上部) */}
          <div className="absolute top-6 left-0 right-0 flex justify-center gap-1.5 z-30 px-10">
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <div key={i} className={`h-1.5 rounded-full flex-1 transition-all duration-500 ${onboardingStep >= i + 1 ? 'bg-indigo-600' : 'bg-gray-100'}`} />
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={onboardingStep}
              drag="x" // 横スワイプを有効化
              dragConstraints={{ left: 0, right: 0 }} // 戻る力を設定
              dragElastic={0.2} // 引っ張った時の弾力
              onDragEnd={(e, { offset, velocity }) => {
                // 左右に一定以上スワイプしたらページをめくる
                const swipeThreshold = 50
                if (offset.x < -swipeThreshold && onboardingStep < TOTAL_STEPS) {
                  setOnboardingStep(s => s + 1)
                } else if (offset.x > swipeThreshold && onboardingStep > 1) {
                  setOnboardingStep(s => s - 1)
                }
              }}
              initial={{ x: 300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -300, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="absolute inset-0 flex flex-col items-center justify-center p-8 cursor-grab active:cursor-grabbing h-full"
            >
              
              {/* --- Step 1: ようこそ (Welcome) --- */}
              {onboardingStep === 1 && (
                <div className="flex flex-col items-center text-center h-full pt-10">
                  <div className="relative mb-12">
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 20, repeat: Infinity, ease: "linear" }} className="absolute -inset-4 bg-gradient-to-tr from-indigo-100 to-emerald-100 rounded-full opacity-60 blur-xl" />
                    <div className="relative w-28 h-28 bg-white border border-gray-100 rounded-3xl flex items-center justify-center shadow-xl">
                      <Sparkles className="w-16 h-16 text-indigo-500" />
                    </div>
                  </div>
                  <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-2">Welcome to</p>
                  <h2 className="text-3xl font-black text-gray-900 leading-tight mb-4">Duacel<br/><span className="text-2xl text-gray-600">アンバサダープログラムへ</span></h2>
                  <p className="text-sm text-gray-500 font-medium leading-relaxed mb-12">
                    美容師としての新しい価値を。<br/>
                    サロンワークに、もう一つの収入源と、<br/>お客様への「美」の提案を。
                  </p>
                  <div className="mt-auto flex items-center gap-2 text-[11px] font-bold text-gray-400 animate-pulse">
                    スワイプして次へ <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              )}

              {/* --- Step 2: プログラム説明 (What is) --- */}
              {onboardingStep === 2 && (
                <div className="flex flex-col items-center text-center h-full pt-10">
                  <div className="flex items-center gap-4 mb-10 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                    <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl"><Trophy className="w-7 h-7" /></div>
                    <ArrowRight className="w-6 h-6 text-gray-300" />
                    <div className="p-3 bg-indigo-100 text-indigo-600 rounded-xl"><Coins className="w-7 h-7" /></div>
                  </div>
                  <h3 className="text-xl font-black text-gray-900 mb-4">施術とプロダクトのシナジー</h3>
                  <p className="text-sm text-gray-500 font-medium leading-relaxed mb-8">
                    お店で行う発毛促進・髪質改善コースを<br/>
                    プロモーションしていただきます。<br/>
                    <strong className="text-gray-800">お客様の購入件数に応じたインセンティブ</strong>を<br/>
                    お支払いするプログラムです。
                  </p>
                  <div className="p-4 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-2xl text-[11px] font-bold text-left space-y-1 w-full">
                     <p>✅ 施術効果を自宅でも維持（LTV向上）</p>
                     <p>✅ 在庫リスク・販売の手間なし</p>
                     <p>✅ サロンワークの隙間時間で報酬獲得</p>
                  </div>
                </div>
              )}

              {/* --- Step 3: 紹介方法 (How to) --- */}
              {onboardingStep === 3 && (
                <div className="flex flex-col items-center text-center h-full pt-10">
                  <div className="relative mb-10">
                    <QRCodeCanvas value={`${window.location.origin}/welcome/S000_Demo`} size={120} level="H" fgColor="#4f46e5" className="p-2 bg-white border-2 border-indigo-100 rounded-2xl shadow-lg" />
                    <div className="absolute -bottom-3 -right-3 p-2 bg-white rounded-full shadow-lg border border-gray-100 text-emerald-500"><CheckCircle2 className="w-6 h-6" /></div>
                  </div>
                  <h3 className="text-xl font-black text-gray-900 mb-4">紹介は、QRを提示するだけ</h3>
                  <p className="text-sm text-gray-500 font-medium leading-relaxed mb-8">
                    購入希望のお客様に、<strong className="text-indigo-600">自分のQRコード</strong>を<br/>
                    スマホでスキャンしてもらうだけ。<br/>
                    複雑な操作は一切ありません。
                  </p>
                  <div className="flex items-center gap-3 p-4 bg-indigo-50 border border-indigo-100 rounded-2xl w-full">
                    <Zap className="w-8 h-8 text-indigo-500 shrink-0" />
                    <p className="text-xs text-indigo-900 font-bold text-left">お客様も、<strong className="text-indigo-700">紹介特別価格（10%OFF*）</strong>で<br/>ご購入いただけるため、提案しやすい設計です。</p>
                  </div>
                </div>
              )}

              {/* --- Step 4: PWAインストールガイド (Appify) --- */}
              {onboardingStep === 4 && (
                <div className="flex flex-col items-center text-center h-full pt-6">
                  <div className="w-20 h-20 bg-gray-900 text-white rounded-3xl flex items-center justify-center mb-6 shadow-xl relative">
                    <QrCode className="w-10 h-10" />
                    <Star className="w-5 h-5 text-yellow-400 absolute top-2 right-2 animate-pulse" />
                  </div>
                  <h3 className="text-lg font-black text-gray-900 mb-2">3秒でQRを表示するために</h3>
                  <p className="text-xs text-gray-500 font-medium leading-relaxed mb-6">
                    接客の流れを止めないよう、<br/>
                    Duacelを<strong className="text-indigo-600">スマホのホーム画面</strong>に追加して、<br/>
                    アプリのように使えるようにしましょう。
                  </p>

                  {deviceType === 'ios' ? (
                    <div className="bg-gray-50 rounded-2xl p-5 w-full text-left space-y-4 border border-gray-100 mb-6">
                      <p className="text-xs font-bold text-gray-800 flex items-center gap-2"><Apple className="w-4 h-4" /> iPhone の場合</p>
                      <ol className="text-[11px] text-gray-600 space-y-3 font-medium">
                        <li className="flex items-center gap-3">
                          <span className="w-6 h-6 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-400 shadow-sm"><Share className="w-3.5 h-3.5" /></span>
                          Safariの「共有」ボタンをタップ
                        </li>
                        <li className="flex items-center gap-3">
                          <span className="w-6 h-6 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-400 font-bold shadow-sm">+</span>
                          「ホーム画面に追加」を選択
                        </li>
                      </ol>
                    </div>
                  ) : (
                    <div className="bg-gray-50 rounded-2xl p-5 w-full text-left space-y-4 border border-gray-100 mb-6">
                      <p className="text-xs font-bold text-gray-800 flex items-center gap-2"><Smartphone className="w-4 h-4" /> Android / Chrome の場合</p>
                      <p className="text-[11px] text-gray-600 font-medium leading-relaxed">
                        ブラウザのメニュー（︙）から<br/>
                        <strong className="text-gray-800">「アプリをインストール」</strong>または<br/>
                        <strong className="text-gray-800">「ホーム画面に追加」</strong>を選択。
                      </p>
                    </div>
                  )}
                  <p className="text-[10px] text-gray-400 font-medium">※ホーム画面に追加してから、ログインしてください。</p>
                </div>
              )}

              {/* --- Step 5: 開始 (Get Started) --- */}
              {onboardingStep === TOTAL_STEPS && (
                <div className="flex flex-col items-center text-center h-full pt-10">
                  <div className="w-24 h-24 bg-gradient-to-tr from-indigo-600 to-emerald-500 rounded-full flex items-center justify-center mb-8 shadow-2xl relative">
                    <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 2, repeat: Infinity }} className="absolute inset-0 bg-white/20 rounded-full" />
                    <CheckCircle2 className="w-12 h-12 text-white relative z-10" />
                  </div>
                  <h2 className="text-2xl font-black text-gray-900 mb-3">準備は万全です。</h2>
                  <p className="text-sm text-gray-500 font-medium leading-relaxed mb-12">
                    アンバサダーとして、<br/>
                    サロンワークの新しい可能性を切り拓きましょう。
                  </p>
                  
                  <div className="w-full space-y-4">
                    {/* 管理者ログインボタン */}
                    <button onClick={() => window.location.href = '/login'} className="w-full p-4 bg-gray-900 hover:bg-gray-800 text-white rounded-2xl text-left transition-all shadow-lg group relative overflow-hidden active:scale-95">
                      <div className="relative z-10 flex items-center justify-between">
                        <div>
                          <p className="text-xs text-gray-400 font-bold mb-1 uppercase tracking-wider">For Owner</p>
                          <p className="font-bold text-lg">ダッシュボードへログイン</p>
                        </div>
                        <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center group-hover:bg-white/20 transition-colors">
                          <ChevronRight className="w-5 h-5" />
                        </div>
                      </div>
                    </button>

                    {/* 接客用マイページボタン */}
                    <button onClick={() => window.open(ownerMagicUrl, '_blank')} className="w-full p-4 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 text-indigo-900 rounded-2xl text-left transition-all group active:scale-95">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[10px] text-indigo-500 font-bold mb-1 uppercase tracking-wider flex items-center gap-1"><QrCode className="w-3 h-3"/> For Staff</p>
                          <p className="font-bold text-sm">自分の接客用ページを開く</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-indigo-400 group-hover:text-indigo-600 transition-colors" />
                      </div>
                    </button>
                  </div>
                </div>
              )}

            </motion.div>
          </AnimatePresence>

          {/* 中央下のスワイプ誘導バー (全画面QRモードを参考に) */}
          {onboardingStep < TOTAL_STEPS && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-1.5 p-2 bg-gray-900/5 rounded-full z-20 pointer-events-none">
              <div className="w-6 h-1 bg-gray-200 rounded-full" />
              <div className="w-1.5 h-1.5 bg-gray-200 rounded-full" />
              <div className="w-1.5 h-1.5 bg-gray-200 rounded-full" />
            </div>
          )}
        </div>
      )}

      {/* 招待モーダル (既存のまま維持) */}
      {activeModal === 'invite' && (
        <div className="fixed inset-0 bg-gray-900/60 flex items-center justify-center z-[100] backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={() => setActiveModal(null)}>
          <div className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl text-center relative" onClick={e => e.stopPropagation()}>
            <button onClick={() => setActiveModal(null)} className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 bg-gray-50 rounded-full"><X className="w-5 h-5" /></button>
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 mb-3"><UserPlus className="w-6 h-6" /></div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">メンバーの招待</h3>
            <p className="text-xs text-gray-500 mb-6 leading-relaxed">メンバーのスマホでQRを読み取ってもらうか、<br/>URLをLINE等で送信してください。</p>
            <div className="bg-white p-3 inline-block border-2 border-indigo-50 rounded-2xl mb-6"><QRCodeCanvas value={staffInviteUrl} size={140} level={"H"} fgColor="#4f46e5" /></div>
            <div className="space-y-3">
              <button onClick={handleWebShare} className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl transition-all shadow-md shadow-indigo-200 flex items-center justify-center gap-2">
                <Share2 className="w-4 h-4" /> 招待URLをシェアする
              </button>
              <button onClick={() => handleCopy(staffInviteUrl, 'invite')} className="w-full py-3.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 font-bold text-sm rounded-xl transition-colors flex items-center justify-center gap-2">
                {copiedType === 'invite' ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                {copiedType === 'invite' ? 'コピーしました！' : 'URLのみコピー'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}