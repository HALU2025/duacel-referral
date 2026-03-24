'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { QRCodeCanvas } from 'qrcode.react'
import { useRouter } from 'next/navigation'

import { 
  Building2, User, Mail, Lock, ArrowRight, 
  QrCode, UserPlus, CheckCircle2, Copy, Share2, 
  Loader2, X, Sparkles, Eye, EyeOff
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

  const router = useRouter()
  const shareText = "Duacelパートナー登録が完了しました！メンバーの皆さんは、以下のURLから自分の専用ページを発行してください。";

  const handleRegisterShop = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setErrorMessage('')

    const finalShopName = shopName.trim() !== '' ? shopName.trim() : ownerName.trim()

    const { data: authData, error: authError } = await supabase.auth.signUp({ email, password })
    if (authError) {
      setErrorMessage('アカウント作成エラー: ' + authError.message)
      setIsLoading(false); return;
    }

    const userId = authData.user?.id

    const { data: existingShops, error: countError } = await supabase.from('shops').select('id')
    if (countError) {
      setErrorMessage('エラー: データ取得に失敗しました')
      setIsLoading(false); return;
    }
    const nextNumber = (existingShops?.length || 0) + 1
    const newShopId = `S${nextNumber.toString().padStart(3, '0')}`

    const { error: insertError } = await supabase.from('shops').insert([{ 
      id: newShopId, name: finalShopName, owner_email: email, owner_id: userId 
    }])

    if (insertError) {
      setErrorMessage('店舗登録エラー: ' + insertError.message)
      setIsLoading(false); return;
    }

    const { data: allStaffs, error: fetchStaffError } = await supabase.from('staffs').select('id')
    if (fetchStaffError) {
      setErrorMessage('エラー: スタッフ情報の取得に失敗しました')
      setIsLoading(false); return;
    }

    const maxNum = allStaffs?.reduce((max, s) => {
      const num = parseInt(s.id.replace('ST', ''), 10)
      return !isNaN(num) && num > max ? num : max
    }, 0) || 0
    const nextStaffId = `ST${(maxNum + 1).toString().padStart(3, '0')}` 

    // ★ 修正：公開用IDと秘密の鍵（シークレットトークン）を分ける
    const secureToken = generateSecureToken()

    const { data: staffData, error: staffError } = await supabase.from('staffs').insert([{
      id: nextStaffId, 
      shop_id: newShopId, 
      name: ownerName, 
      email: email,
      referral_code: `${newShopId}_${nextStaffId}`, // 公開用 (例: S001_ST001)
      secret_token: secureToken,                    // 秘密用 (例: dLUa)
      is_deleted: false
    }]).select('id').single()

    if (staffError) {
      setErrorMessage('管理者情報の初期設定に失敗しました: ' + staffError.message)
      setIsLoading(false); return;
    }

    setShopName(finalShopName)

    setTimeout(() => {
      setStaffInviteUrl(`${window.location.origin}/reg/${newShopId}`)
      setOwnerMagicUrl(`${window.location.origin}/m/${secureToken}`) // ★ 自身のマイページURL
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
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4 font-sans text-gray-800 selection:bg-indigo-100 selection:text-indigo-900">
      
      {!staffInviteUrl ? (
        <div className="w-full max-w-md">
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
        <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-xl shadow-emerald-100/50 border border-emerald-100 text-center relative overflow-hidden">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-32 bg-gradient-to-b from-emerald-50 to-transparent pointer-events-none" />
            <div className="relative z-10">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 mb-5 ring-8 ring-emerald-50">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h2 className="text-2xl font-extrabold text-gray-900 mb-2">準備が整いました！</h2>
              <p className="text-sm text-gray-500 mb-8 leading-relaxed">
                「{shopName}」の環境構築が完了しました。<br/>
                さっそくダッシュボードにログインして、<br/>現在の設定を確認してみましょう。
              </p>

              <button onClick={() => router.push('/login')} className="w-full py-4 bg-gray-900 hover:bg-gray-800 text-white rounded-2xl font-bold text-base transition-all shadow-lg hover:shadow-xl flex justify-center items-center gap-2 group">
                ダッシュボードへ進む 
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>

              <div className="flex items-center gap-4 my-6">
                <div className="flex-1 h-px bg-gray-100" />
                <span className="text-xs font-bold text-gray-300 uppercase tracking-widest">or</span>
                <div className="flex-1 h-px bg-gray-100" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => router.push(ownerMagicUrl)} className="flex flex-col items-center justify-center gap-2 p-4 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-2xl transition-colors">
                  <div className="p-2 bg-white rounded-full shadow-sm text-indigo-600"><QrCode className="w-5 h-5" /></div>
                  <span className="text-[11px] font-bold text-gray-600">自分の接客用QR</span>
                </button>
                <button onClick={() => setActiveModal('invite')} className="flex flex-col items-center justify-center gap-2 p-4 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 rounded-2xl transition-colors">
                  <div className="p-2 bg-white rounded-full shadow-sm text-indigo-600"><UserPlus className="w-5 h-5" /></div>
                  <span className="text-[11px] font-bold text-indigo-700">メンバーを招待</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* モーダル群 */}
      {activeModal === 'invite' && (
        <div className="fixed inset-0 bg-gray-900/60 flex items-center justify-center z-50 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={() => setActiveModal(null)}>
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