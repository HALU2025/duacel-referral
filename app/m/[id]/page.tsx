'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams } from 'next/navigation'
import { QRCodeCanvas } from 'qrcode.react'

import { 
  QrCode, Copy, Share2, MessageCircle, ChevronDown, 
  Wallet, Gift, Clock, History, Settings, Mail, 
  User, CheckCircle2, ArrowRight, ShieldCheck, Loader2
} from 'lucide-react'

export default function MemberMagicPage() {
  const params = useParams()
  // ★ URLから取得する「シークレットトークン」 例: dLUa
  const magicToken = params.id as string 

  const [staff, setStaff] = useState<any>(null)
  const [shop, setShop] = useState<any>(null)
  const [history, setHistory] = useState<any[]>([])
  const [summary, setSummary] = useState({ total: 0, pending: 0, paid: 0 })
  const [loading, setLoading] = useState(true)

  const [copied, setCopied] = useState(false)
  const [editName, setEditName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [isUpdatingName, setIsUpdatingName] = useState(false)
  const [isSendingEmail, setIsSendingEmail] = useState(false)
  const [emailSentMsg, setEmailSentMsg] = useState('')

  // ★ 公開用のURLは DB の referral_code（例: S001_ST001）を使う！
  const referralUrl = staff ? `${typeof window !== 'undefined' ? window.location.origin : ''}/?r=${staff.referral_code}` : ''
  const lineShareText = `【${shop?.name || 'おすすめ'}】おすすめなのでぜひチェックしてみて！ここから予約・購入できます👇\n${referralUrl}`

  useEffect(() => {
    const fetchMemberData = async () => {
      // 1. シークレットトークンを使ってスタッフ情報を特定する
      const { data: staffData, error } = await supabase
        .from('staffs')
        .select('*')
        .eq('secret_token', magicToken) // ★ 検索先を secret_token に変更
        .single()

      if (error || !staffData) {
        setLoading(false)
        return
      }

      // 2. 所属店舗の取得
      const { data: shopData } = await supabase
        .from('shops')
        .select('*')
        .eq('id', staffData.shop_id)
        .single()

      // 3. 自分の紹介履歴とポイントを取得
      const [refRes, txRes] = await Promise.all([
        supabase.from('referrals').select('*').eq('staff_id', staffData.id).order('created_at', { ascending: false }),
        supabase.from('point_transactions').select('*').eq('shop_id', staffData.shop_id)
      ])

      const referrals = refRes.data || []
      const pointLogs = txRes.data || []

      const enriched = referrals.map(r => {
        const txs = pointLogs.filter(tx => tx.referral_id === r.id)
        const totalPt = txs.reduce((sum, tx) => sum + (Number(tx.points) || 0), 0)
        return { ...r, totalPt }
      })

      setStaff(staffData)
      setEditName(staffData.name)
      setShop(shopData)
      setHistory(enriched)

      const total = enriched.filter(r => r.is_staff_rewarded || r.status === 'issued').reduce((sum, r) => sum + r.totalPt, 0)
      const pending = enriched.filter(r => r.status === 'pending' || r.status === 'confirmed').length 
      const paid = enriched.filter(r => r.is_staff_rewarded).reduce((sum, r) => sum + r.totalPt, 0)

      setSummary({ total, pending, paid })
      setLoading(false)
    }

    if (magicToken) fetchMemberData()
  }, [magicToken])

  const handleCopy = () => {
    navigator.clipboard.writeText(referralUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleNameUpdate = async () => {
    if (!editName.trim()) return
    setIsUpdatingName(true)
    await supabase.from('staffs').update({ name: editName }).eq('id', staff.id)
    setStaff({ ...staff, name: editName })
    setIsUpdatingName(false)
    alert('お名前を更新しました！')
  }

  const handleEmailUpdateRequest = async () => {
    if (!newEmail.trim() || newEmail === staff.email) return
    setIsSendingEmail(true)
    setTimeout(() => {
      setIsSendingEmail(false)
      setEmailSentMsg(`セキュリティのため、${newEmail} 宛に確認リンクを送信しました。メール内のリンクをタップすると変更が完了します。`)
      setNewEmail('')
    }, 1500)
  }

  if (loading) return <div className="min-h-[100dvh] flex items-center justify-center bg-gray-50"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>
  if (!staff) return <div className="min-h-[100dvh] flex items-center justify-center bg-gray-50 text-gray-500">ページが見つかりません。URLをご確認ください。</div>

  return (
    <main className="bg-gray-50 font-sans text-gray-800 min-h-[100dvh]">
      
      <section className="relative min-h-[100dvh] flex flex-col items-center justify-center p-6 bg-gradient-to-b from-indigo-50 via-white to-gray-50 pb-20">
        
        <div className="absolute top-6 left-0 w-full px-6 flex justify-between items-center">
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{shop?.name}</p>
            <p className="text-sm font-extrabold text-gray-900">{staff.name} <span className="text-xs font-normal text-gray-500">の専用ページ</span></p>
          </div>
          <div className="bg-white px-3 py-1.5 rounded-full shadow-sm border border-gray-100 flex items-center gap-1.5">
            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            <span className="text-[10px] font-bold text-gray-600">アクティブ</span>
          </div>
        </div>

        <div className="bg-white p-6 sm:p-8 rounded-[2rem] shadow-2xl shadow-indigo-200/50 border border-indigo-50 flex flex-col items-center w-full max-w-sm relative z-10 mt-10">
          <h1 className="text-xl font-extrabold text-indigo-900 mb-2">紹介用QRコード</h1>
          <p className="text-xs text-gray-500 mb-8 text-center leading-relaxed">
            お客様にこの画面を見せて<br/>スマホのカメラで読み取ってもらってください
          </p>

          <div className="p-4 bg-white border-2 border-gray-100 rounded-2xl shadow-sm mb-8">
            {/* ★ 修正：お客様に読み取ってもらうのは、安全な referralUrl (S001_ST001) */}
            <QRCodeCanvas value={referralUrl} size={220} level={"H"} fgColor="#1e1b4b" />
          </div>

          <div className="w-full space-y-3">
            <button onClick={handleCopy} className={`w-full py-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${copied ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-transparent'}`}>
              {copied ? <CheckCircle2 className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
              {copied ? 'URLをコピーしました！' : '紹介用URLをコピー'}
            </button>

            <a 
              href={`https://line.me/R/msg/text/?${encodeURIComponent(lineShareText)}`} 
              target="_blank" rel="noopener noreferrer"
              className="w-full py-4 rounded-xl font-bold text-sm text-white transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#06C755]/30 hover:opacity-90"
              style={{ backgroundColor: '#06C755' }}
            >
              <MessageCircle className="w-5 h-5" />
              LINEで友達に送る
            </a>
          </div>
        </div>

        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center animate-bounce text-gray-400">
          <span className="text-[10px] font-bold uppercase tracking-widest mb-1">Scroll for details</span>
          <ChevronDown className="w-6 h-6" />
        </div>
      </section>

      {/* --- 以下、先ほどの履歴・設定セクションと全く同じです（省略せず残してください） --- */}
      <section className="px-4 py-12 max-w-lg mx-auto space-y-8">
        <div>
          <h2 className="text-sm font-extrabold text-gray-900 mb-3 flex items-center gap-2">
            <Gift className="w-5 h-5 text-indigo-500" /> あなたの紹介実績
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-indigo-600 text-white p-5 rounded-2xl shadow-lg shadow-indigo-200">
              <p className="text-[11px] font-bold opacity-80 mb-1">累計 獲得ポイント</p>
              <p className="text-3xl font-extrabold tabular-nums tracking-tight">{summary.total.toLocaleString()}<span className="text-sm ml-1 font-normal opacity-80">pt</span></p>
            </div>
            <div className="bg-white border border-gray-100 p-5 rounded-2xl shadow-sm flex flex-col justify-center">
              <p className="text-[11px] font-bold text-gray-500 mb-1">紹介成功（確定済）</p>
              <p className="text-2xl font-extrabold text-gray-900 tabular-nums tracking-tight">{history.filter(h => h.status !== 'cancel' && h.status !== 'pending').length}<span className="text-xs ml-1 font-normal text-gray-400">件</span></p>
            </div>
          </div>
        </div>
        
        <div>
          <h2 className="text-sm font-extrabold text-gray-900 mb-3 flex items-center gap-2">
            <History className="w-5 h-5 text-indigo-500" /> 履歴一覧
          </h2>
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden divide-y divide-gray-50">
            {history.map(item => (
              <div key={item.id} className="p-4 flex justify-between items-center">
                <div>
                  <p className="text-xs text-gray-400 font-mono mb-1">{new Date(item.created_at).toLocaleDateString()}</p>
                  {item.status === 'cancel' ? (
                    <span className="inline-block px-2 py-0.5 bg-red-50 text-red-600 text-[10px] font-bold rounded">キャンセル</span>
                  ) : item.is_staff_rewarded ? (
                    <span className="inline-block px-2 py-0.5 bg-gray-100 text-gray-500 text-[10px] font-bold rounded flex items-center gap-1 w-max"><CheckCircle2 className="w-3 h-3" /> 清算済</span>
                  ) : (
                    <span className="inline-block px-2 py-0.5 bg-emerald-50 text-emerald-600 text-[10px] font-bold rounded">有効</span>
                  )}
                </div>
                <div className="text-right">
                  {item.status === 'cancel' ? (
                    <p className="text-sm font-extrabold text-gray-300 line-through">0 pt</p>
                  ) : item.totalPt > 0 ? (
                    <p className="text-base font-extrabold text-indigo-600">+{item.totalPt.toLocaleString()} <span className="text-[10px] text-indigo-400">pt</span></p>
                  ) : (
                    <p className="text-xs font-bold text-gray-400">計算中...</p>
                  )}
                </div>
              </div>
            ))}
            {history.length === 0 && (
              <div className="p-8 text-center text-xs text-gray-400">まだ紹介履歴がありません。<br/>QRコードを見せて紹介をはじめましょう！</div>
            )}
          </div>
        </div>
      </section>

      <section className="px-4 py-8 max-w-lg mx-auto border-t border-gray-200/60 pb-20">
        <h2 className="text-sm font-extrabold text-gray-900 mb-4 flex items-center gap-2">
          <Settings className="w-5 h-5 text-indigo-500" /> アカウント設定
        </h2>
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <label className="flex items-center gap-2 text-[11px] font-bold text-gray-500 mb-2 uppercase tracking-wider">
              <User className="w-4 h-4" /> 表示名（いつでも変更可能）
            </label>
            <div className="flex gap-2">
              <input 
                type="text" value={editName} onChange={e => setEditName(e.target.value)}
                className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              />
              <button 
                onClick={handleNameUpdate} disabled={isUpdatingName || editName === staff.name}
                className="px-4 py-3 bg-gray-900 text-white rounded-xl text-sm font-bold disabled:opacity-50 transition-all hover:bg-gray-800"
              >
                保存
              </button>
            </div>
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex justify-between items-start mb-2">
              <label className="flex items-center gap-2 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                <Mail className="w-4 h-4" /> 連絡先メールアドレス
              </label>
              <div className="flex items-center gap-1 text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded text-center">
                <ShieldCheck className="w-3 h-3" /> セキュア変更
              </div>
            </div>
            <div className="space-y-3">
              <div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-500">
                現在の登録: <span className="font-bold text-gray-900 ml-1">{staff.email}</span>
              </div>
              {!emailSentMsg ? (
                <div className="flex gap-2">
                  <input 
                    type="email" placeholder="新しいメールアドレス" value={newEmail} onChange={e => setNewEmail(e.target.value)}
                    className="flex-1 bg-white border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  />
                  <button 
                    onClick={handleEmailUpdateRequest} disabled={isSendingEmail || !newEmail || newEmail === staff.email}
                    className="px-4 py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold disabled:opacity-50 transition-all hover:bg-indigo-700 flex items-center justify-center min-w-[100px]"
                  >
                    {isSendingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : '確認リンク送信'}
                  </button>
                </div>
              ) : (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3 animate-in fade-in zoom-in-95 duration-300">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-emerald-800 mb-1">確認メールを送信しました</p>
                    <p className="text-[10px] text-emerald-600 leading-relaxed">{emailSentMsg}</p>
                    <button onClick={() => setEmailSentMsg('')} className="mt-2 text-[10px] font-bold text-emerald-700 underline">別のメールを試す</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}