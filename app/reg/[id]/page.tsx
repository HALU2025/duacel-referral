'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'

import { 
  User, Mail, ArrowRight, CheckCircle2, 
  Loader2, X, Sparkles, UserPlus
} from 'lucide-react'

const generateSecureToken = () => {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export default function MemberJoinPage() {
  const params = useParams()
  const shopId = params.id as string
  const router = useRouter()

  const [shop, setShop] = useState<any>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  
  const [isLoading, setIsLoading] = useState(false)
  const [isPageLoading, setIsPageLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  
  const [magicLinkUrl, setMagicLinkUrl] = useState('')
  const [isReturningUser, setIsReturningUser] = useState(false)

  useEffect(() => {
    const fetchShop = async () => {
      const { data, error } = await supabase.from('shops').select('name').eq('id', shopId).single()
      if (data) setShop(data)
      setIsPageLoading(false)
    }
    if (shopId) fetchShop()
  }, [shopId])

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setErrorMessage('')

    try {
      // 1. 既存ユーザーチェック
      const { data: existingStaff } = await supabase
        .from('staffs')
        .select('secret_token, name')
        .eq('shop_id', shopId)
        .eq('email', email)
        .maybeSingle()

      if (existingStaff) {
        setTimeout(() => {
          setMagicLinkUrl(`/m/${existingStaff.secret_token}`)
          setName(existingStaff.name)
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
      const publicReferralCode = `${shopId}_${nextStaffId}`

      const { error: insertError } = await supabase.from('staffs').insert([{
        id: nextStaffId, 
        shop_id: shopId, 
        name: name, 
        email: email,
        referral_code: publicReferralCode, 
        secret_token: secureToken,
        is_deleted: false
      }])

      if (insertError) throw insertError

      setTimeout(() => {
        setMagicLinkUrl(`/m/${secureToken}`)
        setIsLoading(false)
      }, 800)

    } catch (err: any) {
      setErrorMessage('登録エラーが発生しました: ' + err.message)
      setIsLoading(false)
    }
  }

  if (isPageLoading) return <div className="min-h-[100dvh] flex items-center justify-center bg-gray-50"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>
  if (!shop) return <div className="min-h-[100dvh] flex items-center justify-center bg-gray-50 text-gray-500">無効な招待URLです。</div>

  return (
    <div className="min-h-[100dvh] bg-gray-50 flex flex-col justify-center items-center p-4 font-sans text-gray-800 selection:bg-indigo-100 selection:text-indigo-900">
      
      {!magicLinkUrl ? (
        <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 mb-4 shadow-sm border border-indigo-100">
              <UserPlus className="w-8 h-8" />
            </div>
            <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-1">{shop.name}</p>
            <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">メンバー登録</h1>
            <p className="text-sm text-gray-500 mt-2">パスワードは不要です。お名前とメールアドレスだけで専用ページが即時発行されます。</p>
          </div>

          <form onSubmit={handleRegister} className="bg-white p-6 sm:p-8 rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100 space-y-5">
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-gray-500 mb-1.5 uppercase tracking-wider">
                  お名前（表示名） <span className="text-red-500 ml-1">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400"><User className="w-5 h-5" /></div>
                  <input required placeholder="例: 山田 太郎" value={name} onChange={e => setName(e.target.value)} disabled={isLoading}
                    className="w-full pl-11 pr-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white transition-all outline-none" />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-500 mb-1.5 uppercase tracking-wider">
                  連絡先メールアドレス <span className="text-red-500 ml-1">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400"><Mail className="w-5 h-5" /></div>
                  <input required type="email" placeholder="example@email.com" value={email} onChange={e => setEmail(e.target.value)} disabled={isLoading}
                    className="w-full pl-11 pr-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white transition-all outline-none" />
                </div>
              </div>
            </div>

            {errorMessage && (
              <div className="p-3 bg-red-50 text-red-600 border border-red-100 rounded-xl text-xs font-bold flex items-start gap-2">
                <X className="w-4 h-4 shrink-0" /> {errorMessage}
              </div>
            )}

            <button type="submit" disabled={isLoading} className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition-all shadow-md shadow-indigo-200 flex justify-center items-center gap-2 mt-2">
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : '専用ページを発行する'}
            </button>
          </form>
        </div>

      ) : (
        <div className="w-full max-w-md animate-in zoom-in-95 duration-500">
          <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-2xl shadow-emerald-100/50 border border-emerald-100 text-center relative overflow-hidden">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-32 bg-gradient-to-b from-emerald-50 to-transparent pointer-events-none" />
            <div className="relative z-10">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 mb-5 ring-8 ring-emerald-50">
                {isReturningUser ? <Sparkles className="w-10 h-10" /> : <CheckCircle2 className="w-10 h-10" />}
              </div>
              <h2 className="text-2xl font-extrabold text-gray-900 mb-2">
                {isReturningUser ? 'おかえりなさい！' : '発行完了しました！'}
              </h2>
              <p className="text-sm text-gray-500 mb-8 leading-relaxed">
                {isReturningUser 
                  ? `入力されたメールアドレスはすでに登録されていました。引き続き ${name} さんの専用ページをご利用ください。` 
                  : `${name} さんの紹介専用ページが完成しました。さっそく開いて、ページをブックマーク（またはホーム画面に追加）しておきましょう！`}
              </p>
              <button onClick={() => router.push(magicLinkUrl)} className="w-full py-4 bg-gray-900 hover:bg-gray-800 text-white rounded-2xl font-bold text-base transition-all shadow-lg hover:shadow-xl flex justify-center items-center gap-2 group">
                マイページを開く <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}