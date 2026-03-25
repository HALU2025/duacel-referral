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
  MonitorSmartphone, ChevronRight, Apple, Share
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

  const [activeModal, setActiveModal] = useState<'qr' | 'invite' | null>(null)
  const [copiedType, setCopiedType] = useState('') 

  // ★ オンボーディング（スワイプ画面）用のステート
  const [onboardingStep, setOnboardingStep] = useState(1)
  const [deviceType, setDeviceType] = useState<'ios' | 'android' | 'desktop'>('desktop')

  const router = useRouter()
  const shareText = "Duacelパートナー登録が完了しました！メンバーの皆さんは、以下のURLから自分の専用ページを発行してください。"

  // 端末判別ロジック
  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase()
    if (/iphone|ipad|ipod/.test(ua)) setDeviceType('ios')
    else if (/android/.test(ua)) setDeviceType('android')
    else setDeviceType('desktop')
  }, [])

  const handleRegisterShop = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setErrorMessage('')

    const finalShopName = shopName.trim() !== '' ? shopName.trim() : ownerName.trim()

    // 1. Supabase Authでアカウント作成
    const { data: authData, error: authError } = await supabase.auth.signUp({ email, password })
    if (authError) {
      setErrorMessage('アカウント作成エラー: ' + authError.message)
      setIsLoading(false); return;
    }

    const userId = authData.user?.id
    const tempId = `TEMP_${Date.now()}`

    // 2. 店舗の新規登録
    const { data: newShop, error: insertError } = await supabase
      .from('shops')
      .insert([{ id: tempId, name: finalShopName, owner_email: email, owner_id: userId }])
      .select('shop_number')
      .single()

    if (insertError) {
      setErrorMessage('店舗登録エラー: ' + insertError.message)
      setIsLoading(false); return;
    }

    // 3. 正式なID組み立てと更新
    const formattedShopId = `S${newShop.shop_number.toString().padStart(3, '0')}`
    const { error: updateError } = await supabase.from('shops').update({ id: formattedShopId }).eq('shop_number', newShop.shop_number)

    if (updateError) {
      setErrorMessage('店舗ID確定エラー: ' + updateError.message)
      setIsLoading(false); return;
    }

    // 4. 管理者スタッフの登録
    const nextStaffId = `ST${generateSecureToken().toUpperCase()}` 
    const secureToken = generateSecureToken()

    const { error: staffError } = await supabase.from('staffs').insert([{
      id: nextStaffId, shop_id: formattedShopId, name: ownerName, email: email,
      referral_code: `${formattedShopId}_${nextStaffId}`, secret_token: secureToken, is_deleted: false
    }])

    if (staffError) {
      setErrorMessage('管理者情報の初期設定に失敗しました: ' + staffError.message)
      setIsLoading(false); return;
    }

    // 5. 完了
    setShopName(finalShopName)
    setTimeout(() => {
      setStaffInviteUrl(`${window.location.origin}/reg/${formattedShopId}`)
      setOwnerMagicUrl(`${window.location.origin}/m/${secureToken}`)
      setIsLoading(false)
    }, 800)
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
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4 font-sans text-gray-800 selection:bg-indigo-100 selection:text-indigo-900 overflow-hidden">
      
      {/* 登録前：いつものフォーム */}
      {!staffInviteUrl ? (
        <div className="w-full max-w-md">
          {/* (既存のフォーム部分：省略せずにそのまま維持) */}
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

        // ★ 登録完了後：アプリ化オンボーディング（スワイプ風UI）
        <div className="w-full max-w-sm h-[620px] bg-white rounded-[2.5rem] shadow-2xl relative overflow-hidden border-[8px] border-gray-900/5">
  
  {/* インジケーター */}
  <div className="absolute top-6 left-0 right-0 flex justify-center gap-2 z-30 px-10">
    {[1, 2, 3].map(step => (
      <div key={step} className={`h-1.5 rounded-full flex-1 transition-all duration-500 ${onboardingStep >= step ? 'bg-indigo-600' : 'bg-gray-100'}`} />
    ))}
  </div>

  <AnimatePresence mode="wait">
    <motion.div
      key={onboardingStep}
      drag="x" // ★ 横スワイプを有効化
      dragConstraints={{ left: 0, right: 0 }} // 戻る力を設定
      onDragEnd={(e, { offset, velocity }) => {
        // ★ 左右に一定以上スワイプしたらページをめくる
        const swipe = offset.x
        if (swipe < -50 && onboardingStep < 3) {
          setOnboardingStep(s => s + 1)
        } else if (swipe > 50 && onboardingStep > 1) {
          setOnboardingStep(s => s - 1)
        }
      }}
      initial={{ x: 300, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -300, opacity: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="absolute inset-0 p-8 flex flex-col items-center justify-center cursor-grab active:cursor-grabbing"
    >
      
      {/* --- Step 1 内容 --- */}
      {onboardingStep === 1 && (
        <>
          <div className="w-24 h-24 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center mb-6 animate-bounce">
            <CheckCircle2 className="w-12 h-12" />
          </div>
          <h2 className="text-2xl font-black text-gray-900 mb-3">準備完了！</h2>
          <p className="text-sm text-gray-500 font-medium mb-12">
            「{shopName}」の環境ができました。<br/>
            左右にスワイプして進めてください。
          </p>
          <div className="flex items-center gap-2 text-indigo-500 font-bold animate-pulse">
            <ArrowLeft className="w-4 h-4" /> スワイプして次へ <ArrowRight className="w-4 h-4" />
          </div>
        </>
      )}

      {/* --- Step 2 内容 --- */}
      {onboardingStep === 2 && (
        <>
          <div className="w-20 h-20 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center mb-6">
            <Smartphone className="w-10 h-10" />
          </div>
          <h2 className="text-xl font-black text-gray-900 mb-2">ホーム画面に追加</h2>
          {/* ... (デバイス別ガイドを表示) ... */}
          <div className="bg-gray-50 rounded-2xl p-5 w-full text-left space-y-3 border border-gray-100">
            <p className="text-xs font-bold text-gray-800">ブラウザの「ホーム画面に追加」で、URLバーのない全画面アプリになります。</p>
          </div>
        </>
      )}

      {/* --- Step 3 内容 --- */}
      {onboardingStep === 3 && (
        <div className="w-full space-y-4">
          <h2 className="text-xl font-black text-gray-900 mb-8">さあ、始めましょう！</h2>
          <button onClick={() => window.location.href = '/login'} className="w-full p-5 bg-gray-900 text-white rounded-2xl text-left shadow-xl">
             <p className="text-[10px] text-gray-400 font-bold uppercase">For Owner</p>
             <p className="font-bold text-lg">ダッシュボードへログイン</p>
          </button>
          <button onClick={() => window.open(ownerMagicUrl, '_blank')} className="w-full p-5 bg-indigo-50 text-indigo-900 rounded-2xl text-left border border-indigo-100">
             <p className="text-[10px] text-indigo-400 font-bold uppercase">For Staff</p>
             <p className="font-bold text-sm">自分のマイページ（QR）を開く</p>
          </button>
        </div>
      )}

    </motion.div>
  </AnimatePresence>
</div>
      )}

      {/* 招待モーダル (既存のものを流用) */}
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