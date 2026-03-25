'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { QRCodeCanvas } from 'qrcode.react'
import { useRouter } from 'next/navigation'

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
        <div className="w-full max-w-sm h-[600px] flex flex-col relative overflow-hidden bg-white rounded-[2.5rem] shadow-2xl border-[8px] border-gray-900/5">
          
          {/* プログレスバー（上部） */}
          <div className="absolute top-6 left-0 right-0 flex justify-center gap-2 z-20 px-8">
            {[1, 2, 3].map(step => (
              <div key={step} className={`h-1.5 rounded-full flex-1 transition-all duration-500 ${onboardingStep >= step ? 'bg-indigo-600' : 'bg-gray-200'}`} />
            ))}
          </div>

          {/* 各ステップのカード */}
          <div className="flex-1 relative">
            
            {/* Step 1: 完了とアプリ化の推奨 */}
            <div className={`absolute inset-0 p-8 flex flex-col items-center justify-center text-center transition-all duration-500 transform ${onboardingStep === 1 ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0 pointer-events-none'}`}>
              <div className="w-24 h-24 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center mb-6 ring-8 ring-emerald-50 animate-bounce">
                <CheckCircle2 className="w-12 h-12" />
              </div>
              <h2 className="text-2xl font-black text-gray-900 mb-3">準備完了！</h2>
              <p className="text-sm text-gray-500 font-medium leading-relaxed mb-8">
                「{shopName}」の環境ができました。<br/>
                Duacelは<strong className="text-indigo-600">スマホアプリ</strong>として<br/>使うのが一番便利です。
              </p>
              
              <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 w-full mb-8 text-left">
                <p className="text-xs font-bold text-gray-600 mb-2 flex items-center gap-1.5"><MonitorSmartphone className="w-4 h-4 text-indigo-500"/> アプリ化のメリット</p>
                <ul className="text-[11px] text-gray-500 space-y-2">
                  <li className="flex items-center gap-2">✅ <span className="flex-1">ブラウザの枠が消えて全画面に</span></li>
                  <li className="flex items-center gap-2">✅ <span className="flex-1">QRコードが1秒で出せるように</span></li>
                  <li className="flex items-center gap-2">✅ <span className="flex-1">ログイン状態が保持されやすい</span></li>
                </ul>
              </div>

              <button onClick={() => setOnboardingStep(2)} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-200 active:scale-95 transition-transform">
                次へ進む <ArrowRight className="w-5 h-5" />
              </button>
            </div>

            {/* Step 2: ホーム画面追加ガイド */}
            <div className={`absolute inset-0 p-8 flex flex-col items-center justify-center text-center transition-all duration-500 transform ${onboardingStep === 2 ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0 pointer-events-none'}`}>
              <div className="w-20 h-20 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center mb-6">
                <Smartphone className="w-10 h-10" />
              </div>
              <h2 className="text-xl font-black text-gray-900 mb-2">ホーム画面に追加</h2>
              <p className="text-xs text-gray-500 font-medium leading-relaxed mb-6">
                以下の手順で、この画面を<br/>スマホのホームに保存してください。
              </p>

              {deviceType === 'ios' ? (
                <div className="bg-gray-50 rounded-2xl p-5 w-full text-left space-y-4 border border-gray-100 mb-8">
                  <p className="text-xs font-bold text-gray-800 flex items-center gap-2"><Apple className="w-4 h-4" /> iPhone の場合</p>
                  <ol className="text-[11px] text-gray-600 space-y-3 font-medium">
                    <li className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-400 shadow-sm"><Share className="w-3 h-3" /></span>
                      画面下の「共有」ボタンをタップ
                    </li>
                    <li className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-400 font-bold shadow-sm">+</span>
                      「ホーム画面に追加」を選択
                    </li>
                  </ol>
                </div>
              ) : (
                <div className="bg-gray-50 rounded-2xl p-5 w-full text-left space-y-4 border border-gray-100 mb-8">
                  <p className="text-xs font-bold text-gray-800 flex items-center gap-2"><Smartphone className="w-4 h-4" /> Android / PC の場合</p>
                  <p className="text-[11px] text-gray-600 font-medium">
                    ブラウザ右上のメニュー（︙）から<br/>
                    <strong className="text-gray-800">「アプリをインストール」</strong><br/>
                    または<strong className="text-gray-800">「ホーム画面に追加」</strong>を選択。
                  </p>
                </div>
              )}

              <div className="flex w-full gap-3 mt-auto">
                <button onClick={() => setOnboardingStep(1)} className="p-4 bg-gray-100 text-gray-600 rounded-2xl font-bold active:scale-95 transition-transform">
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <button onClick={() => setOnboardingStep(3)} className="flex-1 py-4 bg-gray-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-transform">
                  確認しました <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Step 3: 最終アクションの選択 */}
            <div className={`absolute inset-0 p-8 flex flex-col items-center justify-center text-center transition-all duration-500 transform ${onboardingStep === 3 ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0 pointer-events-none'}`}>
              <h2 className="text-xl font-black text-gray-900 mb-6 mt-8">さあ、始めましょう！</h2>
              
              <div className="w-full space-y-4 mb-auto">
                {/* 管理者ログインボタン */}
                <button onClick={() => window.location.href = '/login'} className="w-full p-4 bg-gray-900 hover:bg-gray-800 text-white rounded-2xl text-left transition-all shadow-lg group relative overflow-hidden">
                  <div className="relative z-10 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-400 font-bold mb-1 uppercase tracking-wider">For Owner</p>
                      <p className="font-bold text-lg">ダッシュボードを開く</p>
                    </div>
                    <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center group-hover:bg-white/20 transition-colors">
                      <ChevronRight className="w-5 h-5" />
                    </div>
                  </div>
                </button>

                {/* 接客用マイページボタン */}
                <button onClick={() => window.open(ownerMagicUrl, '_blank')} className="w-full p-4 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 text-indigo-900 rounded-2xl text-left transition-all group">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] text-indigo-500 font-bold mb-1 uppercase tracking-wider flex items-center gap-1"><QrCode className="w-3 h-3"/> 自分も紹介する</p>
                      <p className="font-bold text-sm">接客用マイページを開く</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-indigo-400 group-hover:text-indigo-600 transition-colors" />
                  </div>
                </button>

                {/* メンバー招待ボタン */}
                <button onClick={() => setActiveModal('invite')} className="w-full p-4 bg-white border border-gray-200 text-gray-700 rounded-2xl text-left hover:bg-gray-50 transition-all flex items-center justify-between group">
                  <div>
                    <p className="text-[10px] text-gray-400 font-bold mb-1 uppercase tracking-wider flex items-center gap-1"><UserPlus className="w-3 h-3"/> チーム作り</p>
                    <p className="font-bold text-sm">メンバーを招待する</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors" />
                </button>
              </div>

              <button onClick={() => setOnboardingStep(2)} className="mt-6 text-xs text-gray-400 font-bold underline underline-offset-4">
                ホーム画面への追加方法をもう一度見る
              </button>
            </div>

          </div>
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