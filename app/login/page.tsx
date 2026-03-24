'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

import { 
  Mail, Lock, Loader2, X, LogIn, Eye, EyeOff, 
  KeyRound, CheckCircle2, ArrowRight
} from 'lucide-react'

export default function LoginPage() {
  // ログイン用のステート
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  
  // パスワードリセット（モーダル）用のステート
  const [isResetModalOpen, setIsResetModalOpen] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [resetMessage, setResetMessage] = useState({ type: '', text: '' }) // alertの代わりにインライン表示
  
  const router = useRouter()

  // ==========================================
  // 通常のログイン処理
  // ==========================================
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setErrorMessage('')
    
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      let msg = error.message
      if (msg.includes('Invalid login credentials')) msg = 'メールアドレスまたはパスワードが違います。'
      if (msg.includes('Email not confirmed')) msg = 'メールアドレスの認証が完了していません。'
      setErrorMessage(msg)
      setIsLoading(false)
    } else {
      router.push('/dashboard')
    }
  }

  // ==========================================
  // パスワードリセット（モーダル内）の処理
  // ==========================================
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setResetMessage({ type: '', text: '' })

    if (!resetEmail) {
      setResetMessage({ type: 'error', text: 'メールアドレスを入力してください。' })
      return
    }

    setResetLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/update-password`, 
    })
    setResetLoading(false)

    if (error) {
      if (error.message.includes('User not found')) {
        setResetMessage({ type: 'error', text: '入力されたメールアドレスは登録されていません。' })
      } else {
        setResetMessage({ type: 'error', text: `エラー: ${error.message}` })
      }
    } else {
      setResetMessage({ type: 'success', text: 'パスワード再設定用のメールを送信しました！' })
      setResetEmail('')
    }
  }

  // モーダルを閉じる時のリセット処理
  const closeResetModal = () => {
    setIsResetModalOpen(false)
    setResetEmail('')
    setResetMessage({ type: '', text: '' })
  }

  // ==========================================
  // UIレンダリング
  // ==========================================
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4 font-sans text-gray-800 selection:bg-indigo-100 selection:text-indigo-900">
      
      <div className="w-full max-w-md">
        
        {/* ヘッダー部分 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gray-900 text-white mb-4 shadow-lg shadow-gray-200">
            <LogIn className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">管理ダッシュボード</h1>
          <p className="text-sm text-gray-500 mt-2">登録済みのメールアドレスとパスワードでログイン</p>
        </div>
        
        {/* ログインフォーム */}
        <form onSubmit={handleLogin} className="bg-white p-6 sm:p-8 rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100 space-y-5">
          
          <div className="space-y-4">
            {/* メールアドレス */}
            <div>
              <label className="block text-[11px] font-bold text-gray-500 mb-1.5 uppercase tracking-wider">メールアドレス</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                  <Mail className="w-5 h-5" />
                </div>
                <input required type="email" placeholder="admin@example.com" value={email} onChange={e => setEmail(e.target.value)} disabled={isLoading}
                  className="w-full pl-11 pr-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-gray-900 focus:border-gray-900 focus:bg-white transition-all outline-none" />
              </div>
            </div>

            {/* パスワード */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">パスワード</label>
                <button type="button" onClick={() => setIsResetModalOpen(true)} disabled={isLoading} className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors">
                  忘れた場合はこちら
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                  <Lock className="w-5 h-5" />
                </div>
                <input required type={showPassword ? "text" : "password"} placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} disabled={isLoading}
                  className="w-full pl-11 pr-12 py-3 bg-gray-50/50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-gray-900 focus:border-gray-900 focus:bg-white transition-all outline-none" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} disabled={isLoading} className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600 transition-colors">
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </div>

          {/* エラーメッセージ（インライン表示） */}
          {errorMessage && (
            <div className="p-3 bg-red-50 text-red-600 border border-red-100 rounded-xl text-xs font-bold flex items-start gap-2 animate-in fade-in duration-200">
              <X className="w-4 h-4 shrink-0" /> {errorMessage}
            </div>
          )}

          {/* ログインボタン */}
          <button type="submit" disabled={isLoading} className="w-full py-3.5 bg-gray-900 hover:bg-black text-white rounded-xl font-bold text-sm transition-all shadow-md shadow-gray-300 flex justify-center items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed">
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'ログイン'}
          </button>

          <p className="text-center text-[11px] text-gray-400 pt-2">
            店舗・事業者アカウントの作成は<a href="/reg" className="text-gray-900 font-bold ml-1 hover:underline">こちら</a>
          </p>
        </form>
      </div>

      {/* ==========================================
          パスワードリセット用モーダル (統一デザイン)
      ========================================== */}
      {isResetModalOpen && (
        <div className="fixed inset-0 bg-gray-900/60 flex items-center justify-center z-50 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={closeResetModal}>
          <div className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl text-center relative" onClick={e => e.stopPropagation()}>
            <button onClick={closeResetModal} className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 bg-gray-50 rounded-full transition-colors"><X className="w-5 h-5" /></button>
            
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 mb-3">
              <KeyRound className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">パスワード再設定</h3>
            <p className="text-xs text-gray-500 mb-6 leading-relaxed">
              ご登録のメールアドレスを入力してください。<br/>再設定用のリンクをお送りします。
            </p>
            
            <form onSubmit={handleResetPassword} className="space-y-4 text-left">
              <div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                    <Mail className="w-5 h-5" />
                  </div>
                  <input required type="email" placeholder="メールアドレス" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} disabled={resetLoading}
                    className="w-full pl-11 pr-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white transition-all outline-none" />
                </div>
              </div>

              {/* モーダル内のメッセージ（成功 or エラー） */}
              {resetMessage.text && (
                <div className={`p-3 border rounded-xl text-xs font-bold flex items-start gap-2 animate-in fade-in duration-200 ${resetMessage.type === 'error' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
                  {resetMessage.type === 'error' ? <X className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
                  {resetMessage.text}
                </div>
              )}

              <button type="submit" disabled={resetLoading} className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition-all shadow-md shadow-indigo-200 flex justify-center items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed">
                {resetLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                  <>送信する <ArrowRight className="w-4 h-4" /></>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}