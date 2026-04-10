'use client'

import { useState, useEffect } from 'react' // ★ useEffectを追加
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Loader2, Mail, Lock, ShieldAlert } from 'lucide-react'
import { setAdminSessionCookie } from '@/app/actions/admin-auth' // ★ 追加

export default function AdminLogin() {
  const router = useRouter()
  // ... (ステート定義などそのまま) ...

  // ★ 追加：ブラウザを閉じて弾かれて来た場合、残ったゴミセッションを掃除する
  useEffect(() => {
    supabase.auth.signOut()
  }, [])

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password })
      if (authError) throw new Error('メールアドレスまたはパスワードが間違っています。')
      if (!authData.user) throw new Error('ユーザー情報の取得に失敗しました。')

      const { data: adminData } = await supabase
        .from('system_admins')
        .select('id')
        .eq('id', authData.user.id)
        .maybeSingle()

      if (!adminData) {
        await supabase.auth.signOut()
        throw new Error('管理者権限がありません。このアクセスは記録されました。')
      }

      // ★ 追加：認証成功＆権限確認OKなら、サーバー側で一時Cookieを発行！
      await setAdminSessionCookie()

      router.push('/admin')
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'ログインに失敗しました。')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4 font-sans text-gray-100">
      <div className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl p-8 sm:p-10">
        
        {/* ヘッダー */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 bg-gray-800 rounded-2xl flex items-center justify-center mb-6 shadow-inner border border-gray-700">
            <Lock className="w-8 h-8 text-blue-400" strokeWidth={1.5} />
          </div>
          <h1 className="text-2xl font-bold tracking-widest text-white mb-2">HQ SYSTEM</h1>
          <p className="text-xs text-gray-500 font-mono tracking-widest">AUTHORIZED PERSONNEL ONLY</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-950/50 border border-red-900/50 rounded-xl flex gap-3 items-start">
            <ShieldAlert className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <p className="text-sm font-medium text-red-400">{error}</p>
          </div>
        )}

        <form onSubmit={handleAdminLogin} className="space-y-6">
          <div>
            <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Admin Email</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="email"
                placeholder="admin@duacel.net"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-gray-950 border border-gray-800 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all text-white placeholder:text-gray-700"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-gray-950 border border-gray-800 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all text-white placeholder:text-gray-700 font-mono tracking-widest"
                required
              />
            </div>
          </div>
          
          <button
            type="submit"
            disabled={loading || !email || !password}
            className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-900/20 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-4"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'SECURE LOGIN'}
          </button>
        </form>

      </div>
    </div>
  )
}