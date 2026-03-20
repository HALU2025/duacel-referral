'use client'

import { useState, useEffect, Suspense } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

function RegisterContent() {
  const params = useParams()
  const shopId = params.id as string

  const [shopName, setShopName] = useState('読み込み中...')
  const [staffName, setStaffName] = useState('')
  const [staffEmail, setStaffEmail] = useState('')
  const [status, setStatus] = useState('')
  const [referralUrl, setReferralUrl] = useState('')

  // 1. ページ読み込み時に店舗名を取得
  useEffect(() => {
    const fetchShopInfo = async () => {
      const { data } = await supabase
        .from('shops')
        .select('name')
        .eq('id', shopId)
        .single()
      
      if (data) {
        setShopName(data.name)
      } else {
        setShopName('不明な店舗')
      }
    }
    if (shopId) fetchShopInfo()
  }, [shopId])

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('発行中...')

    try {
      // 2. 全スタッフの中から最大のID番号を探して、絶対に被らないIDを作る
      const { data: allStaffs, error: fetchError } = await supabase
        .from('staffs')
        .select('id')
      
      if (fetchError) throw fetchError

      // 既存のID（ST001等）から数字部分だけを取り出して最大値を計算
      const maxNum = allStaffs?.reduce((max, s) => {
        const num = parseInt(s.id.replace('ST', ''), 10)
        return !isNaN(num) && num > max ? num : max
      }, 0) || 0
      
      // 次のID（例：ST006）を生成
      const nextStaffId = `ST${(maxNum + 1).toString().padStart(3, '0')}`
      const referralCode = `${shopId}_${nextStaffId}`

      // 3. staffsテーブルに保存（email列が必要です）
      const { error: insertError } = await supabase
        .from('staffs')
        .insert([{ 
          id: nextStaffId, 
          shop_id: shopId, 
          name: staffName, 
          email: staffEmail, 
          referral_code: referralCode 
        }])

      if (insertError) throw insertError

      // 成功時の処理
      setReferralUrl(`${window.location.origin}/?r=${referralCode}`)
      setStatus('✅ 登録が完了しました！')
    } catch (err: any) {
      console.error('Registration Error:', err)
      setStatus('エラー: ' + (err.message || '登録に失敗しました'))
    }
  }

  if (!shopId) return <div style={{ padding: '40px', textAlign: 'center' }}>店舗IDが正しくありません。</div>

  return (
    <main style={{ padding: '40px 20px', maxWidth: '400px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <div style={{ textAlign: 'center', marginBottom: '30px' }}>
        <h2 style={{ color: '#10b981', marginBottom: '5px' }}>スタッフ登録</h2>
        <p style={{ color: '#1f2937', fontSize: '18px', fontWeight: 'bold', margin: 0 }}>
          {shopName}
        </p>
        <p style={{ color: '#94a3b8', fontSize: '12px' }}>店舗コード: {shopId}</p>
      </div>

      {!referralUrl ? (
        <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#475569', display: 'block', marginBottom: '5px' }}>お名前</label>
            <input 
              placeholder="例：山田 太郎" 
              value={staffName} 
              onChange={(e) => setStaffName(e.target.value)} 
              required 
              style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '16px', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#475569', display: 'block', marginBottom: '5px' }}>メールアドレス</label>
            <input 
              type="email"
              placeholder="example@test.com" 
              value={staffEmail} 
              onChange={(e) => setStaffEmail(e.target.value)} 
              required 
              style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '16px', boxSizing: 'border-box' }}
            />
          </div>

          <button type="submit" style={{ padding: '16px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px', marginTop: '10px' }}>
            専用URLを発行する
          </button>
        </form>
      ) : (
        <div style={{ padding: '25px', backgroundColor: '#f0fdf4', border: '1px solid #10b981', borderRadius: '15px', textAlign: 'center' }}>
          <p style={{ fontSize: '40px', margin: '0 0 10px 0' }}>🎉</p>
          <p style={{ fontSize: '14px', fontWeight: 'bold', color: '#059669', marginBottom: '10px' }}>あなたの紹介用URL</p>
          <div style={{ margin: '15px 0', padding: '15px', backgroundColor: 'white', border: '1px solid #dcfce7', borderRadius: '8px', wordBreak: 'break-all', fontWeight: 'bold', fontSize: '15px', color: '#059669' }}>
            {referralUrl}
          </div>
          <button 
            onClick={() => { navigator.clipboard.writeText(referralUrl); alert('URLをコピーしました！'); }}
            style={{ padding: '12px 24px', backgroundColor: '#059669', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', width: '100%' }}
          >
            URLをコピーする
          </button>
          <p style={{ fontSize: '12px', color: '#64748b', marginTop: '15px' }}>このURLをSNSやLINEでお客様に共有してください。</p>
        </div>
      )}
      
      {status && !referralUrl && (
        <p style={{ marginTop: '20px', textAlign: 'center', color: status.includes('✅') ? '#059669' : '#ef4444', fontWeight: 'bold' }}>
          {status}
        </p>
      )}
    </main>
  )
}

export default function RegisterStaffPage() {
  return (
    <Suspense fallback={<div style={{ padding: '40px', textAlign: 'center' }}>読み込み中...</div>}>
      <RegisterContent />
    </Suspense>
  )
}