'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { QRCodeCanvas } from 'qrcode.react'

export default function ShopJoinPage() {
  const [shopName, setShopName] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('') 
  const [status, setStatus] = useState('')
  
  const [staffInviteUrl, setStaffInviteUrl] = useState('')
  const [ownerReferralUrl, setOwnerReferralUrl] = useState('')
  
  const shareText = "Duacelパートナー登録が完了しました！スタッフの皆さんは、以下のURLから自分の専用ページを発行してください。";

  const handleRegisterShop = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('アカウントと店舗環境を構築中...')

    // 1. Supabase Auth でユーザーを作成
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    })

    if (authError) {
      setStatus('アカウント作成エラー: ' + authError.message)
      return
    }

    const userId = authData.user?.id

    // 2. 新しい店舗IDを生成
    const { data: existingShops, error: countError } = await supabase.from('shops').select('id')
    if (countError) {
      setStatus('エラー: データ取得に失敗しました')
      return
    }
    const nextNumber = (existingShops?.length || 0) + 1
    const newShopId = `S${nextNumber.toString().padStart(3, '0')}`

    // 3. 店舗を登録
    const { error: insertError } = await supabase
      .from('shops')
      .insert([{ 
        id: newShopId, 
        name: shopName, 
        owner_email: email,
        owner_id: userId 
      }])

    if (insertError) {
      setStatus('店舗登録エラー: ' + insertError.message)
      return
    }

    // 4. 【修正】現在のスタッフIDの最大値を取得して、次のIDを生成する
    const { data: allStaffs, error: fetchStaffError } = await supabase.from('staffs').select('id')
    if (fetchStaffError) {
      setStatus('エラー: スタッフ情報の取得に失敗しました')
      return
    }

    const maxNum = allStaffs?.reduce((max, s) => {
      const num = parseInt(s.id.replace('ST', ''), 10)
      return !isNaN(num) && num > max ? num : max
    }, 0) || 0
    
    const nextStaffId = `ST${(maxNum + 1).toString().padStart(3, '0')}` // ST001固定ではなく動的に！

    // 5. 代表者を最初のスタッフとして自動登録
    const { data: staffData, error: staffError } = await supabase
      .from('staffs')
      .insert([{
        id: nextStaffId, // 生成した次のIDを使用
        shop_id: newShopId,
        name: ownerName, 
        email: email,
        referral_code: `${newShopId}_${nextStaffId}`,
        is_deleted: false
      }])
      .select('id')
      .single()

    if (staffError) {
      setStatus('オーナー情報の初期設定に失敗しました: ' + staffError.message)
      return
    }

    // 6. 完了処理
    setStatus(`✅ 「${shopName}」の環境構築が完了しました！`)
    setStaffInviteUrl(`${window.location.origin}/reg/${newShopId}`)
    setOwnerReferralUrl(`${window.location.origin}/?r=${newShopId}_${staffData.id}`) 
  }

  const handleWebShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Duacelスタッフ登録', text: shareText, url: staffInviteUrl });
      } catch (error) { console.log('Error sharing', error); }
    } else {
      navigator.clipboard.writeText(`${shareText}\n${staffInviteUrl}`);
      alert('URLをコピーしました。');
    }
  };

  return (
    <main style={{ padding: '40px 20px', maxWidth: '600px', margin: '0 auto', fontFamily: 'sans-serif', color: '#334155' }}>
      <header style={{ textAlign: 'center', marginBottom: '40px' }}>
        <h1 style={{ color: '#2563eb', margin: '0 0 10px 0' }}>Duacel紹介プログラム登録</h1>
        <p style={{ color: '#64748b', margin: 0 }}>サロン情報を入力して、管理アカウントを作成します。</p>
      </header>

      {!staffInviteUrl ? (
        <form onSubmit={handleRegisterShop} style={{ display: 'flex', flexDirection: 'column', gap: '20px', backgroundColor: '#fff', padding: '30px', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}>
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '8px' }}>店舗名</label>
            <input placeholder="例: ABCサロン" value={shopName} onChange={(e) => setShopName(e.target.value)} required style={{ width: '100%', padding: '12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '16px', boxSizing: 'border-box' }} />
          </div>
          
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '8px' }}>代表者名（ご自身のお名前）</label>
            <input placeholder="例: 山田 太郎" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} required style={{ width: '100%', padding: '12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '16px', boxSizing: 'border-box' }} />
            <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '5px' }}>※このお名前で、あなた専用の紹介用URLが即座に発行されます。</p>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '8px' }}>ログイン用メールアドレス</label>
            <input type="email" placeholder="owner@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ width: '100%', padding: '12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '16px', boxSizing: 'border-box' }} />
          </div>
          
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '8px' }}>パスワード</label>
            <input type="password" placeholder="6文字以上のパスワード" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required style={{ width: '100%', padding: '12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '16px', boxSizing: 'border-box' }} />
            <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '5px' }}>※登録後、この情報でダッシュボードにログインできます。</p>
          </div>
          
          <button type="submit" style={{ padding: '16px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px' }}>
            アカウントを作成して環境を構築
          </button>
          {status && <p style={{ textAlign: 'center', fontSize: '14px', color: '#ef4444', margin: 0 }}>{status}</p>}
        </form>
      ) : (
        <div style={{ padding: '30px', backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', textAlign: 'center', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}>
          <div style={{ fontSize: '50px', marginBottom: '10px' }}>✨</div>
          <h2 style={{ color: '#166534', margin: '0 0 10px 0' }}>環境構築が完了しました！</h2>
          <p style={{ color: '#64748b', margin: '0 0 30px 0', fontSize: '14px' }}>
            設定したメールアドレスとパスワードで、いつでもダッシュボードにログイン可能です。
          </p>
          
          <div style={{ marginBottom: '30px', padding: '20px', backgroundColor: '#ecfdf5', border: '2px solid #34d399', borderRadius: '12px' }}>
            <h3 style={{ margin: '0 0 10px 0', color: '#065f46', fontSize: '16px' }}>🚀 あなたの紹介専用URL（すぐ使えます）</h3>
            <div style={{ margin: '0 0 15px 0', padding: '12px', backgroundColor: '#fff', border: '1px solid #a7f3d0', borderRadius: '8px', wordBreak: 'break-all', fontWeight: 'bold', fontSize: '14px' }}>
              <a href={ownerReferralUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#059669', textDecoration: 'underline', display: 'block' }}>
                {ownerReferralUrl}
              </a>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <div style={{ padding: '10px', backgroundColor: '#fff', border: '1px solid #a7f3d0', borderRadius: '8px' }}>
                <QRCodeCanvas value={ownerReferralUrl} size={120} level={"H"} includeMargin={false} />
              </div>
            </div>
            <p style={{ fontSize: '12px', color: '#065f46', marginTop: '10px', fontWeight: 'bold' }}>
              ↑ お客様にこのQRを読み取ってもらうだけで紹介完了です！
            </p>
          </div>

          <hr style={{ border: 'none', borderTop: '2px dashed #e2e8f0', margin: '30px 0' }} />

          <div>
            <h3 style={{ margin: '0 0 10px 0', color: '#1e293b', fontSize: '16px' }}>👥 他のスタッフを招待する</h3>
            <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '15px' }}>
              従業員がいる場合は、以下のURLをLINE等で送って専用URLを発行してもらってください。
            </p>
            <div style={{ margin: '0 0 20px 0', padding: '15px', backgroundColor: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '8px', wordBreak: 'break-all', fontWeight: 'bold', color: '#0369a1', fontSize: '14px' }}>
              <a href={staffInviteUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'block', color: '#2563eb', textDecoration: 'underline' }}>
                {staffInviteUrl}
              </a>
            </div>
            
            <div style={{ margin: '20px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
              <div style={{ padding: '12px', backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', display: 'inline-block' }}>
                <QRCodeCanvas value={staffInviteUrl} size={120} level={"H"} includeMargin={false} />
              </div>
              <p style={{ fontSize: '12px', color: '#64748b', fontWeight: 'bold' }}>スマホで読み取ってスタッフ登録</p>
            </div>

            <button onClick={handleWebShare} style={{ width: '100%', padding: '14px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              📲 スタッフ招待URLを共有する
            </button>
          </div>

          <div style={{ marginTop: '30px', paddingTop: '20px', borderTop: '1px solid #e2e8f0' }}>
            <p style={{ fontSize: '13px', color: '#64748b' }}>
              オーナー用ダッシュボード：<br/>
              <a href="/login" style={{ color: '#2563eb', fontWeight: 'bold' }}>ログイン画面へ進む</a>
            </p>
          </div>
        </div>
      )}
    </main>
  )
}