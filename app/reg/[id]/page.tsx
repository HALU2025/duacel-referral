'use client'

import { useState, useEffect, Suspense } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { QRCodeCanvas } from 'qrcode.react'

function RegisterContent() {
  const params = useParams()
  const shopId = params.id as string

  const [shopName, setShopName] = useState('読み込み中...')
  const [staffName, setStaffName] = useState('')
  const [staffEmail, setStaffEmail] = useState('')
  const [status, setStatus] = useState('')
  const [referralUrl, setReferralUrl] = useState('')
  
  const shareText = "Duacelパートナー登録が完了しました！私専用の紹介URL（QRコード）を発行しました。";

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
      const { data: allStaffs, error: fetchError } = await supabase
        .from('staffs')
        .select('id')
      
      if (fetchError) throw fetchError

      const maxNum = allStaffs?.reduce((max, s) => {
        const num = parseInt(s.id.replace('ST', ''), 10)
        return !isNaN(num) && num > max ? num : max
      }, 0) || 0
      
      const nextStaffId = `ST${(maxNum + 1).toString().padStart(3, '0')}`
      const referralCode = `${shopId}_${nextStaffId}`

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

      setReferralUrl(`${window.location.origin}/?r=${referralCode}`)
      setStatus('✅ 登録が完了しました！')
    } catch (err: any) {
      console.error('Registration Error:', err)
      setStatus('エラー: ' + (err.message || '登録に失敗しました'))
    }
  }

  // 共有メニューの呼び出し
  const handleWebShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Duacel紹介用URL',
          text: shareText,
          url: referralUrl,
        });
      } catch (error) {
        console.log('Error sharing', error);
      }
    } else {
      navigator.clipboard.writeText(referralUrl);
      alert('URLをコピーしました！');
    }
  };

  if (!shopId) return <div style={{ padding: '40px', textAlign: 'center' }}>店舗IDが正しくありません。</div>

  return (
    <main style={{ padding: '40px 20px', maxWidth: '450px', margin: '0 auto', fontFamily: 'sans-serif', color: '#334155' }}>
      <div style={{ textAlign: 'center', marginBottom: '30px' }}>
        <h2 style={{ color: '#10b981', marginBottom: '8px', fontSize: '24px' }}>スタッフ登録</h2>
        <div style={{ display: 'inline-block', backgroundColor: '#f1f5f9', padding: '4px 12px', borderRadius: '20px', marginBottom: '10px' }}>
          <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 'bold' }}>ID: {shopId}</span>
        </div>
        <p style={{ color: '#1e293b', fontSize: '18px', fontWeight: 'bold', margin: 0 }}>
          {shopName}
        </p>
      </div>

      {!referralUrl ? (
        <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '20px', backgroundColor: '#fff', padding: '25px', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
          <div>
            <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#475569', display: 'block', marginBottom: '8px' }}>お名前</label>
            <input 
              placeholder="例：山田 太郎" 
              value={staffName} 
              onChange={(e) => setStaffName(e.target.value)} 
              required 
              style={{ width: '100%', padding: '14px', border: '1px solid #cbd5e1', borderRadius: '10px', fontSize: '16px', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#475569', display: 'block', marginBottom: '8px' }}>メールアドレス</label>
            <input 
              type="email"
              placeholder="example@test.com" 
              value={staffEmail} 
              onChange={(e) => setStaffEmail(e.target.value)} 
              required 
              style={{ width: '100%', padding: '14px', border: '1px solid #cbd5e1', borderRadius: '10px', fontSize: '16px', boxSizing: 'border-box' }}
            />
            <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '8px' }}>※登録完了後、こちらの指定アドレスに自分専用URLが届きます。</p>
          </div>

          <button type="submit" style={{ padding: '16px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px', marginTop: '10px', boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.2)' }}>
            専用URLを発行する
          </button>
        </form>
      ) : (
        <div style={{ padding: '30px', backgroundColor: '#fff', border: '2px solid #10b981', borderRadius: '20px', textAlign: 'center', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}>
          <div style={{ fontSize: '40px', marginBottom: '10px' }}>✨</div>
          <h2 style={{ color: '#059669', margin: '0 0 10px 0', fontSize: '20px' }}>登録が完了しました！</h2>
          <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '20px', lineHeight: '1.5' }}>
            こちらのQRコードをお客様に提示するか、<br />URLをスマホに保存してください。
          </p>
          
          {/* QRコード表示エリア */}
          <div style={{ 
            backgroundColor: 'white', 
            padding: '20px', 
            borderRadius: '16px', 
            display: 'inline-block', 
            marginBottom: '20px',
            border: '1px solid #f1f5f9',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
          }}>
            <QRCodeCanvas 
              value={referralUrl} 
              size={200}
              level={"H"}
              includeMargin={true}
            />
          </div>

          <div style={{ margin: '0 0 25px 0', padding: '12px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', wordBreak: 'break-all', fontWeight: 'bold', fontSize: '14px', color: '#059669' }}>
            {referralUrl}
          </div>

          {/* 共有・保存アクション */}
          <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '25px' }}>
            <button 
              onClick={handleWebShare}
              style={{ width: '100%', padding: '16px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px', marginBottom: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              📲 URLをスマホに保存・共有
            </button>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '20px' }}>
              {/* LINE */}
              <a 
                href={`https://line.me/R/msg/text/?${encodeURIComponent(shareText + "\n" + referralUrl)}`} 
                target="_blank" 
                rel="noreferrer"
                style={{ textDecoration: 'none', textAlign: 'center' }}
              >
                <div style={{ width: '50px', height: '50px', backgroundColor: '#06C755', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '5px' }}>
                  <span style={{ color: 'white', fontSize: '10px', fontWeight: 'bold' }}>LINE</span>
                </div>
              </a>

              {/* Instagram (コピー) */}
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(referralUrl);
                  alert('URLをコピーしました！インスタのプロフィールやDMに貼り付けられます。');
                }}
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
              >
                <div style={{ width: '50px', height: '50px', background: 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '5px' }}>
                  <span style={{ color: 'white', fontSize: '10px', fontWeight: 'bold' }}>DM</span>
                </div>
              </button>
            </div>
            <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '15px' }}>※自分宛のメールでもURLを確認できます。</p>
          </div>
        </div>
      )}
      
      {status && !referralUrl && (
        <p style={{ marginTop: '20px', textAlign: 'center', color: status.includes('✅') ? '#059669' : '#ef4444', fontWeight: 'bold', fontSize: '14px' }}>
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