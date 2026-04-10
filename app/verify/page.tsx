'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Loader2, Phone, KeyRound, ShieldAlert } from 'lucide-react'

export default function SecurityVerification() {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2>(1)
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const formatPhoneNumber = (num: string) => {
    const cleaned = num.replace(/[^0-9]/g, '')
    if (cleaned.startsWith('0')) return '+81' + cleaned.slice(1)
    return '+' + cleaned
  }

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const formattedPhone = formatPhoneNumber(phone)
      const { error } = await supabase.auth.signInWithOtp({ phone: formattedPhone })
      if (error) throw error
      setStep(2)
    } catch (err: any) {
      console.error(err)
      setError('SMSの送信に失敗しました。電話番号をご確認ください。')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const formattedPhone = formatPhoneNumber(phone)
      const { error } = await supabase.auth.verifyOtp({ phone: formattedPhone, token: otp, type: 'sms' })
      if (error) throw error
      
      // 認証成功後、オーナー用ダッシュボードへ
      router.replace('/dashboard')
    } catch (err: any) {
      console.error(err)
      setError('認証コードが間違っているか、有効期限が切れています。')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fffef2] font-sans text-[#333333] selection:bg-[#e6e2d3] selection:text-[#333333]">
      <div className="w-full max-w-md bg-[#fffef2] min-h-screen sm:min-h-[600px] sm:h-auto relative shadow-none sm:shadow-sm sm:border border-[#e6e2d3] flex flex-col overflow-hidden">
        
        <div className="flex flex-col items-center justify-center pt-16 pb-8">
          <h1 className="text-3xl font-black font-inter tracking-normal text-[#1a1a1a] mb-2">
            Duacel<sup className="text-lg font-medium -ml-0.5">®</sup>
          </h1>
          <p className="text-[11px] text-[#666666] tracking-widest uppercase">Security Verification</p>
        </div>

        <div className="flex-1 px-6 pb-12">
          <div className="mb-8 text-center">
            <h2 className="text-sm font-bold text-[#1a1a1a] mb-3">ご本人確認</h2>
            <p className="text-[11px] text-[#666666] leading-relaxed">
              重要な操作（管理画面へのアクセスや設定変更）を行うため、<br/>SMSでのご本人確認をお願いします。
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-[#fcf0f0] border border-[#fcf0f0] text-[#8a3c3c] text-[11px] flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" strokeWidth={1.5} />
              {error}
            </div>
          )}

          {step === 1 && (
            <form onSubmit={handleSendOtp} className="space-y-8 animate-in fade-in duration-300">
              <div>
                <label className="block text-[11px] text-[#999999] tracking-wider uppercase mb-2">携帯電話番号</label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#999999]" strokeWidth={1.5} />
                  <input
                    type="tel"
                    placeholder="090-0000-0000"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 bg-[#f5f2e6] border-none text-[#333333] outline-none focus:ring-1 focus:ring-[#333333] font-mono text-base transition-all"
                    required
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading || phone.length < 10}
                className="w-full py-5 bg-[#1a1a1a] text-[#fffef2] text-sm tracking-widest transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'SMSでコードを受け取る'}
              </button>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleVerifyOtp} className="space-y-8 animate-in fade-in duration-300">
              <div className="text-center mb-4">
                <p className="text-base font-mono text-[#1a1a1a]">{phone}</p>
                <p className="text-[11px] text-[#666666] mt-2">宛に6桁のコードを送信しました</p>
              </div>

              <div>
                <div className="relative">
                  <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#999999]" strokeWidth={1.5} />
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    placeholder="123456"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
                    className="w-full pl-12 pr-4 py-4 bg-[#f5f2e6] border-none text-[#333333] outline-none focus:ring-1 focus:ring-[#333333] font-mono text-2xl tracking-[0.3em] text-center transition-all"
                    required
                  />
                </div>
              </div>
              
              <div className="space-y-4">
                <button
                  type="submit"
                  disabled={loading || otp.length !== 6}
                  className="w-full py-5 bg-[#1a1a1a] text-[#fffef2] text-sm tracking-widest transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : '認証を完了する'}
                </button>
                <button
                  type="button"
                  onClick={() => { setStep(1); setOtp(''); }}
                  className="w-full py-4 bg-[#fffef2] border border-[#e6e2d3] text-[11px] text-[#666666] hover:bg-[#f5f2e6] active:scale-[0.98] transition-all"
                >
                  電話番号を入力し直す
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}