'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { QRCodeCanvas } from 'qrcode.react'
import { motion, AnimatePresence } from 'framer-motion' 
import Cropper from 'react-easy-crop'
// ★ 追加：LINE LIFFのインポート
import liff from '@line/liff'

import { 
  QrCode, Copy, MessageCircle, Wallet, Gift, Clock, History, 
  Settings, Mail, User, CheckCircle2, Ban, CheckCheck, ChevronRight, 
  Share, UserPlus, LayoutDashboard, Crown, Edit2, Loader2, Link as LinkIcon, 
  Trash2, Store, CreditCard, Send, LogOut, Info, ShoppingBag, BookOpen, 
  Sparkles, PlayCircle, ShieldCheck, X, Lock, JapaneseYen, Handshake, ClipboardList,
  Edit3, Award, ExternalLink, Camera, ImagePlus, ZoomIn, ZoomOut, MapPin
} from 'lucide-react'

// デフォルトアバター
const DEFAULT_AVATAR = '/avatars/default.png'

// 超軽量化・圧縮版のトリミング関数
const getCroppedImg = async (imageSrc: string, pixelCrop: any): Promise<File | null> => {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.addEventListener('load', () => resolve(img));
    img.addEventListener('error', (error) => reject(error));
    img.setAttribute('crossOrigin', 'anonymous'); 
    img.src = imageSrc;
  });

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) return null;

  // ① サイズを512pxから256pxに変更（アバターならこれで十分綺麗です）
  const safeSize = 256;
  canvas.width = safeSize;
  canvas.height = safeSize;

  ctx.beginPath();
  ctx.arc(safeSize / 2, safeSize / 2, safeSize / 2, 0, Math.PI * 2, true);
  ctx.closePath();
  ctx.clip();

  // ② JPEGは透過をサポートしないため、背景を白で塗りつぶす
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, safeSize, safeSize);

  ctx.drawImage(
    image,
    pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 
    0, 0, safeSize, safeSize 
  );

  // ③ PNGではなくJPEG形式にし、画質を80% (0.8) に圧縮して出力する
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) { resolve(null); return; }
      // 拡張子も .jpg に変更
      const file = new File([blob], 'avatar.jpg', { type: 'image/jpeg' });
      resolve(file);
    }, 'image/jpeg', 0.8); // ← この 0.8 が魔法の圧縮パラメータです
  });
};

export default function MemberMagicPage() {
  const params = useParams()
  const magicToken = params.id as string 
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  
  const [isUnlocked, setIsUnlocked] = useState(false)
  const [pin, setPin] = useState(['', '', '', '']) 
  const [pinError, setPinError] = useState(false)
  const pinInputRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)]

  const MAX_ATTEMPTS = 5
  const LOCKOUT_MINUTES = 15
  const [attemptsLeft, setAttemptsLeft] = useState(MAX_ATTEMPTS)
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null)

  const [isForgotPinOpen, setIsForgotPinOpen] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [isResetting, setIsResetting] = useState(false)
  const [resetResult, setResetResult] = useState<{success?: boolean, message: string} | null>(null)

  // URLの ?tab=... を読み取って初期タブを決める
const searchParams = useSearchParams()
const initialTab = (searchParams.get('tab') as any) || 'qr'
const [activeTab, setActiveTab] = useState<'stats' | 'shop' | 'qr' | 'info' | 'settings'>(initialTab)
  const [staff, setStaff] = useState<any>(null)
  const [shop, setShop] = useState<any>(null)
  const [history, setHistory] = useState<any[]>([])
  const [summary, setSummary] = useState({ total: 0, pending: 0, confirmed: 0, paid: 0 })
  const [copied, setCopied] = useState(false)
  
  // 編集用ステート
  const [isEditMode, setIsEditMode] = useState(false) 
  const [editName, setEditName] = useState('')
  const [editAvatar, setEditAvatar] = useState('') 
  const [avatarFile, setAvatarFile] = useState<File | null>(null) 
  const [currentPinInput, setCurrentPinInput] = useState('') 
  const [newPinInput, setNewPinInput] = useState('')
  
  // 店舗情報編集用ステート (オーナーのみ使用)
  const [editShopName, setEditShopName] = useState('')
  const [editShopAddress, setEditShopAddress] = useState('')

  const [profileError, setProfileError] = useState('')       
  const [isSaving, setIsSaving] = useState(false)

  // 画像トリミング用ステート
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [isCropperModalOpen, setIsCropperModalOpen] = useState(false);
  const [rawImageSrc, setRawImageSrc] = useState<string>(''); 
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  const [isExchangeModalOpen, setIsExchangeModalOpen] = useState(false)
  const [exchangeType, setExchangeType] = useState<'all' | 'custom'>('all')
  const [exchangeAmount, setExchangeAmount] = useState('')
  const [isExchanging, setIsExchanging] = useState(false)

  const [selectedDetail, setSelectedDetail] = useState<{type: 'referral' | 'shop', data: any} | null>(null)
  const [isShareModalOpen, setIsShareModalOpen] = useState(false)
  const [shareTarget, setShareTarget] = useState<'line' | 'email'>('line')
  const [shareMessage, setShareMessage] = useState('')

  const [isOwnerModalOpen, setIsOwnerModalOpen] = useState(false)
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false)

  const [unreadReferrals, setUnreadReferrals] = useState<any[]>([])
  const [currentUnreadIndex, setCurrentUnreadIndex] = useState(0)

  // ★ LINE連携用ステート
  const [isLiffLoading, setIsLiffLoading] = useState(false)
  const [liffInitialized, setLiffInitialized] = useState(false)

  // ★ 1. ページを開いた瞬間にLINEの準備（初期化）をする
  useEffect(() => {
    const initLiff = async () => {
      try {
        const liffId = process.env.NEXT_PUBLIC_LIFF_ID
        if (liffId) {
          await liff.init({ liffId })
          setLiffInitialized(true)
        }
      } catch (error) {
        console.error('LIFF Init Error:', error)
      }
    }
    initLiff()
  }, [])

  const MOCK_PRODUCTS = [
    { id: 1, name: 'Duacel スカルプセラム (店販用)', price: 8800, ptPrice: 8000, icon: <Sparkles className="w-6 h-6 text-[#999999]" />, desc: 'お客様への店販用に最適なスカルプセラムです。店内でのお試し用にもご利用いただけます。' },
    { id: 2, name: '専用導入機器 (Proモデル)', price: 45000, ptPrice: 42000, icon: <ShieldCheck className="w-6 h-6 text-[#999999]" />, desc: 'サロンでの本格的な施術に使用する専用機器です。保証期間1年付き。' },
    { id: 3, name: '店販用パンフレット (100部)', price: 2000, ptPrice: 2000, icon: <BookOpen className="w-6 h-6 text-[#999999]" />, desc: 'お客様へお渡しする商品解説のパンフレットです。QRコードを貼付してご活用ください。' },
  ]

  const referralUrl = staff ? `${typeof window !== 'undefined' ? window.location.origin : ''}/welcome/${staff.referral_code || ''}` : ''
  const isOwner = shop?.owner_email === staff?.email
  const defaultShareText = `【${shop?.name || '店舗'}】Duacelスカルプセラムの専用購入ページです。\n以下のURLからご購入いただけます。\n\n${referralUrl}`

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const locked = localStorage.getItem(`duacel_lockout_${magicToken}`)
      if (locked && parseInt(locked) > Date.now()) {
        setLockoutUntil(parseInt(locked))
      } else if (locked) {
        localStorage.removeItem(`duacel_lockout_${magicToken}`)
        setAttemptsLeft(MAX_ATTEMPTS)
      }
      if (sessionStorage.getItem(`duacel_auth_${magicToken}`) === 'true') {
        setIsUnlocked(true)
      }
    }
  }, [magicToken])

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true)
    const { data: staffData, error } = await supabase.from('staffs').select('*').eq('secret_token', magicToken).single()
    if (error || !staffData) { if(!silent) setLoading(false); return; }

    const { data: shopData } = await supabase.from('shops').select('*, shop_categories(*)').eq('id', staffData.shop_id).single()

    const [refRes, txRes, staffCountRes] = await Promise.all([
      supabase.from('referrals').select('*').eq('shop_id', staffData.shop_id).order('created_at', { ascending: false }),
      supabase.from('point_transactions').select('*').eq('shop_id', staffData.shop_id), 
      supabase.from('staffs').select('id', { count: 'exact' }).eq('shop_id', staffData.shop_id).eq('is_deleted', false)
    ])

    const referralLogs = refRes.data || []
    const pointLogs = txRes.data || []
    const activeStaffCount = staffCountRes.count || 1

    const category = shopData.shop_categories;
    const basePointsDefault = category?.reward_points || 0;
    const firstBonusEnabled = category?.first_bonus_enabled || false;
    const firstBonusPoints = category?.first_bonus_points || 0;

    const shopHasBonusTx = pointLogs.some(tx => tx.metadata?.is_bonus === true);
    const reversedLogs = [...referralLogs].reverse();

    let sTotal = 0; let sPending = 0; let sConfirmed = 0; let sPaid = 0;
    const myReferrals: any[] = [];
    const isMeEligible = staffData.is_team_pool_eligible !== false;

    const { data: allStaffsData } = await supabase.from('staffs').select('id, name').eq('shop_id', staffData.shop_id);
    const staffNameMap = new Map((allStaffsData || []).map(s => [s.id, s.name]));

    reversedLogs.forEach((r, index) => {
      const isMine = r.staff_id === staffData.id;
      const refTxs = pointLogs.filter(tx => tx.referral_id === r.id && (tx.status === 'confirmed' || tx.status === 'paid'));
      const isCanceled = r.status === 'cancel';
      const isOldest = index === 0;
      
      const isFirstTime = !isCanceled && (refTxs.length > 0 ? refTxs.some(tx => tx.metadata?.is_bonus) : (!shopHasBonusTx && isOldest));
      
      const basePoints = basePointsDefault + (isFirstTime && firstBonusEnabled ? firstBonusPoints : 0);
      const totalBase = basePoints;

      const ratioInd = r.snapshot_ratio_individual ?? (shopData.ratio_individual ?? 100);
      const ratioTeam = r.snapshot_ratio_team ?? (shopData.ratio_team ?? 0);

      const totalIndPart = Math.floor(totalBase * (ratioInd / 100));
      const totalTeamPool = Math.floor(totalBase * (ratioTeam / 100));

      const indPart = isMine ? totalIndPart : 0;
      const teamPart = isMeEligible ? (totalTeamPool / activeStaffCount) : 0;
      const myEarnedPoints = Math.floor(indPart + teamPart);

      if (!isCanceled && (isMine || isMeEligible)) {
        myReferrals.push({ 
          ...r, 
          staffName: staffNameMap.get(r.staff_id) || '不明',
          totalPt: myEarnedPoints, 
          myIndPart: Math.floor(indPart),
          myTeamPart: Math.floor(teamPart),
          staffVisibleTotal: totalIndPart + totalTeamPool, 
          snapshot_ratio_individual: ratioInd,
          snapshot_ratio_team: ratioTeam,
          isMine, 
          hasBonus: isFirstTime && firstBonusEnabled && isMine 
        });

        if (r.status === 'pending') {
          sPending += myEarnedPoints;
        } else if (r.status === 'confirmed' || r.status === 'issued' || r.is_staff_rewarded) {
          sConfirmed += myEarnedPoints;
          sTotal += myEarnedPoints;
          if (r.is_staff_rewarded) sPaid += myEarnedPoints;
        }
      }
    });

    setStaff(staffData)
    setEditName(staffData.name)
    setEditAvatar(staffData.avatar_url || '') 
    setAvatarFile(null)
    
    setShop(shopData)
    // 店舗情報の初期値セット
    setEditShopName(shopData.name || '')
    setEditShopAddress(shopData.address || '')
    
    const finalHistory = myReferrals.reverse();
    setHistory(finalHistory)
    setSummary({ total: sTotal + sConfirmed, pending: sPending, confirmed: sConfirmed, paid: sPaid })
    
    if (typeof window !== 'undefined') {
      const localSeen = JSON.parse(localStorage.getItem(`seen_referrals_${magicToken}`) || '[]');
      const newUnreads = finalHistory.filter(r => r.status === 'pending' && !localSeen.includes(r.id));
      setUnreadReferrals(newUnreads);
    }

    if(!silent) setLoading(false)
  }

  useEffect(() => { if (magicToken) loadData() }, [magicToken])
  useEffect(() => { if (staff && shop) setShareMessage(defaultShareText) }, [staff, shop, defaultShareText])

  useEffect(() => {
    if (!staff?.shop_id) return;
    const channel = supabase
      .channel('member-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'referrals', filter: `shop_id=eq.${staff.shop_id}` }, () => loadData(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'point_transactions', filter: `shop_id=eq.${staff.shop_id}` }, () => loadData(true))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [staff?.shop_id]);

  // ★ 2. LINEログインから戻ってきた時の「自動連携」処理
  useEffect(() => {
    const autoConnect = async () => {
      // 「LIFFの準備完了」＆「未連携」＆「LINEログイン済み(戻ってきた直後)」なら自動発動
      if (liffInitialized && staff && !staff.line_user_id && liff.isLoggedIn()) {
        setIsLiffLoading(true)
        try {
          const liffProfile = await liff.getProfile()
          const { error } = await supabase
            .from('staffs')
            .update({
              line_user_id: liffProfile.userId,
              line_display_name: liffProfile.displayName,
              line_picture_url: liffProfile.pictureUrl
            })
            .eq('id', staff.id)

          if (error) throw error
          window.location.reload() // 成功したら画面をリロードしてバッジを表示！
        } catch (err) {
          console.error(err)
        } finally {
          setIsLiffLoading(false)
        }
      }
    }
    autoConnect()
  }, [liffInitialized, staff])

  const handleCopy = (url: string) => {
    navigator.clipboard.writeText(url)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setRawImageSrc(reader.result as string); 
        setIsCropperModalOpen(true); 
        setZoom(1); setCrop({ x: 0, y: 0 }); 
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  }

  const onCropComplete = useCallback((_croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels)
  }, [])

  const handleSaveCroppedImage = async () => {
    if (!rawImageSrc || !croppedAreaPixels) return;
    setIsSaving(true);
    try {
      const file = await getCroppedImg(rawImageSrc, croppedAreaPixels);
      if (file) {
        setAvatarFile(file); 
        setEditAvatar(URL.createObjectURL(file)); 
        setIsCropperModalOpen(false); 
      }
    } catch (e) {
      console.error(e);
      alert('画像のトリミングに失敗しました。');
    } finally {
      setIsSaving(false);
    }
  }

  const handleReselectImage = (type: 'album' | 'camera') => {
    setIsCropperModalOpen(false);
    setRawImageSrc('');
    setTimeout(() => {
      if (type === 'album') fileInputRef.current?.click();
      else cameraInputRef.current?.click();
    }, 100); 
  }


  const handlePinChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return; 
    const newPin = [...pin]; newPin[index] = value.slice(-1); setPin(newPin); setPinError(false);

    if (value && index < 3) pinInputRefs[index + 1].current?.focus()
    if (index === 3 && value) {
      const enteredPin = newPin.join('')
      if (!staff.security_pin || enteredPin === staff.security_pin) { 
        sessionStorage.setItem(`duacel_auth_${magicToken}`, 'true')
        setAttemptsLeft(MAX_ATTEMPTS)
        setTimeout(() => setIsUnlocked(true), 300)
      } else {
        const newAttempts = attemptsLeft - 1; setAttemptsLeft(newAttempts)
        if (newAttempts <= 0) {
          const unlockTime = Date.now() + LOCKOUT_MINUTES * 60 * 1000
          setLockoutUntil(unlockTime); localStorage.setItem(`duacel_lockout_${magicToken}`, unlockTime.toString())
        } else {
          setPinError(true); setTimeout(() => setPin(['', '', '', '']), 500); pinInputRefs[0].current?.focus()
        }
      }
    }
  }

  const handlePinKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !pin[index] && index > 0) pinInputRefs[index - 1].current?.focus()
  }

  const handleManualLock = () => {
    sessionStorage.removeItem(`duacel_auth_${magicToken}`)
    setIsUnlocked(false); setActiveTab('qr'); setPin(['', '', '', ''])
  }

  const handleForgotPin = async (e: React.FormEvent) => {
    e.preventDefault(); setIsResetting(true); setResetResult(null)
    try {
      const res = await fetch('/api/reset-pin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ secretToken: magicToken, email: forgotEmail }) })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'エラーが発生しました')
      setResetResult({ success: true, message: '新しい暗証番号を送信しました。\nメールをご確認ください。' })
      setTimeout(() => { setIsForgotPinOpen(false); setResetResult(null); setForgotEmail('') }, 3000)
    } catch (err: any) { setResetResult({ success: false, message: err.message }) } 
    finally { setIsResetting(false) }
  }

  const handleSaveProfile = async () => {
    setIsSaving(true); setProfileError('')
    
    // 1. スタッフ情報の更新
    let updateStaffData: any = { name: editName }
    
    if (newPinInput) {
      if (newPinInput.length !== 4) { setProfileError('新しいPINは4桁で入力してください。'); setIsSaving(false); return }
      if (staff.security_pin && currentPinInput !== staff.security_pin) { setProfileError('現在の暗証番号が間違っています。'); setIsSaving(false); return }
      updateStaffData.security_pin = newPinInput
    }

    if (avatarFile) {
      const fileExt = avatarFile.name.split('.').pop() || 'png';
      const filePath = `${staff.shop_id}/${staff.id}_${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, avatarFile);
      if (uploadError) {
        setProfileError('画像のアップロードに失敗しました。');
        setIsSaving(false); return;
      }
      
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);
      updateStaffData.avatar_url = publicUrl;
    } else if (editAvatar === '') {
      updateStaffData.avatar_url = null;
    }

    const { error: staffError } = await supabase.from('staffs').update(updateStaffData).eq('id', staff.id)
    if (staffError) { setProfileError('スタッフ情報の更新に失敗しました。'); setIsSaving(false); return; }
    
    // 2. 店舗情報の更新（オーナーのみ）
    let updateShopData: any = {}
    if (isOwner) {
      updateShopData = { name: editShopName, address: editShopAddress }
      const { error: shopError } = await supabase.from('shops').update(updateShopData).eq('id', shop.id)
      if (shopError) { setProfileError('店舗情報の更新に失敗しました。'); setIsSaving(false); return; }
    }

    setStaff({ ...staff, ...updateStaffData }); 
    if (isOwner) setShop({ ...shop, ...updateShopData });
    
    setCurrentPinInput(''); setNewPinInput(''); setAvatarFile(null); 
    setIsSaving(false); setIsEditMode(false);
  }

  const handleCancelEdit = () => {
    setIsEditMode(false); 
    setEditName(staff.name); 
    setEditAvatar(staff.avatar_url || ''); 
    setAvatarFile(null);
    setCurrentPinInput(''); setNewPinInput(''); 
    setProfileError('');
    if (isOwner) {
      setEditShopName(shop.name || '');
      setEditShopAddress(shop.address || '');
    }
  }

  const handleExchangePay = async () => {
    const pt = exchangeType === 'all' ? summary.confirmed : Number(exchangeAmount);
    if (pt <= 0 || pt > summary.confirmed) {
      alert('交換可能なポイント数が正しくありません。'); return;
    }
    setIsExchanging(true);
    await new Promise(resolve => setTimeout(resolve, 1500)); 
    alert(`${pt.toLocaleString()}pt を えらべるPay に交換申請しました。\n（※現在はテスト環境です）`);
    setIsExchanging(false); setIsExchangeModalOpen(false); setExchangeAmount(''); loadData(true);
  }

  const handleExecuteShare = () => {
    if (shareTarget === 'line') {
      window.open(`https://line.me/R/msg/text/?${encodeURIComponent(shareMessage)}`, '_blank')
    } else {
      window.location.href = `mailto:?subject=${encodeURIComponent(shop?.name + 'からのご案内')}&body=${encodeURIComponent(shareMessage)}`
    }
    setIsShareModalOpen(false)
  }

  const handleCloseUnread = () => {
    const current = unreadReferrals[currentUnreadIndex];
    const localSeen = JSON.parse(localStorage.getItem(`seen_referrals_${magicToken}`) || '[]');
    localStorage.setItem(`seen_referrals_${magicToken}`, JSON.stringify([...localSeen, current.id]));

    if (currentUnreadIndex < unreadReferrals.length - 1) {
      setCurrentUnreadIndex(prev => prev + 1);
    } else {
      setUnreadReferrals([]);
      setCurrentUnreadIndex(0);
    }
  }

// ★ 3. ボタンを押した時の処理（ログイン画面に飛ばすだけ）
  const handleConnectLine = () => {
    if (!liffInitialized) return alert('LINE連携の準備中です。数秒待ってから再度お試しください。')
    
    if (!liff.isLoggedIn()) {
      // ① ブラウザに「今いる場所（/m/L0P0など）」をこっそり覚えさせる
      sessionStorage.setItem('liff_redirect', window.location.pathname)
      
      // ② LINEには、コンソールで登録した「魔法のドア（/lineapp/login）」を正確に指定して飛ばす
      const loginUrl = window.location.origin + '/lineapp/login'
      liff.login({ redirectUri: loginUrl })
    }
  }

  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (lockoutUntil) { const interval = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(interval) }
  }, [lockoutUntil])

  const pendingReferrals = useMemo(() => {
    return history.filter(r => r.status === 'pending')
  }, [history])

  const formatDateYMD = (isoString: string) => {
    const d = new Date(isoString);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}/${m}/${day}`;
  }

  const formatDateTime = (isoString: string) => {
    const d = new Date(isoString);
    return `${d.toLocaleDateString('ja-JP')} ${d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}`;
  }

  if (loading) return <div className="fixed inset-0 flex items-center justify-center bg-[#fffef2]"><Loader2 className="w-8 h-8 animate-spin text-[#1a1a1a]" /></div>
  if (!staff) return <div className="fixed inset-0 flex items-center justify-center bg-[#fffef2] text-[#666666] text-base">ページが見つかりません。</div>

  return (
    <div className="fixed inset-0 bg-[#fffef2] flex justify-center font-sans text-[#333333] overflow-hidden selection:bg-[#e6e2d3] selection:text-[#333333]">
      <div className="w-full max-w-md bg-[#fffef2] h-full relative shadow-sm border-x border-[#e6e2d3] flex flex-col overflow-hidden">
        
        {!isUnlocked ? (
          <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center p-6 bg-[#fffef2]">
            <div className="w-full max-w-sm animate-in fade-in zoom-in-95 duration-500">
              <div className="text-center mb-12">
                <h1 className="text-2xl font-serif tracking-[0.2em] text-[#1a1a1a] mb-8">Duacel.</h1>
                <div className="w-20 h-20 mx-auto bg-[#faf9f6] rounded-full overflow-hidden mb-4 border-2 border-[#e6e2d3] flex items-center justify-center">
                  {staff.avatar_url ? (
                    <img src={staff.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                  ) : (
                    <img src={DEFAULT_AVATAR} alt="avatar" className="w-full h-full object-cover opacity-60" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                  )}
                </div>
                <p className="text-sm font-bold text-[#666666] mb-1">{shop?.name}</p>
                <h2 className="text-xl text-[#1a1a1a] mb-6">{staff.name}</h2>
                <p className="text-sm text-[#999999] leading-relaxed">アクセスするには4桁の暗証番号を<br/>入力してください。</p>
              </div>
              <div className={`flex justify-center gap-4 mb-10 ${pinError ? 'animate-[shake_0.5s_ease-in-out]' : ''}`}>
                {pin.map((digit, index) => (
                  <input key={index} ref={pinInputRefs[index]} type="password" inputMode="numeric" maxLength={1} value={digit} onChange={(e) => handlePinChange(index, e.target.value)} onKeyDown={(e) => handlePinKeyDown(index, e)}
                    className={`w-16 h-20 text-center text-2xl font-medium rounded-none border-none outline-none transition-all ${pinError ? 'bg-[#fcf0f0] text-[#8a3c3c]' : 'bg-[#f5f2e6] text-[#333333] focus:ring-1 focus:ring-[#333333]'}`}
                  />
                ))}
              </div>
              <div className="h-10 flex flex-col items-center">
                {pinError ? (<><p className="text-center text-sm text-[#8a3c3c] animate-in fade-in mb-1">暗証番号が異なります</p><p className="text-xs text-[#999999]">残り試行回数: <span className="text-[#8a3c3c]">{attemptsLeft}回</span></p></>) : null}
              </div>
              <div className="mt-10 text-center"><button onClick={() => setIsForgotPinOpen(true)} className="text-sm text-[#666666] hover:text-[#1a1a1a] underline underline-offset-4 transition-colors">暗証番号を忘れた方</button></div>
            </div>
            
            <AnimatePresence>
              {isForgotPinOpen && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[110] bg-[#1a1a1a]/60 backdrop-blur-sm flex flex-col justify-end p-4 sm:p-6">
                  <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'tween', duration: 0.3 }} className="bg-[#fffef2] p-8 w-full max-w-md mx-auto relative overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.2)]">
                    <button onClick={() => setIsForgotPinOpen(false)} className="absolute top-4 right-4 p-3 text-[#999999] hover:text-[#333333]"><X className="w-6 h-6" /></button>
                    <h3 className="text-lg text-[#1a1a1a] mb-4">暗証番号の再設定</h3>
                    <p className="text-sm text-[#666666] leading-relaxed mb-6">ご登録のメールアドレスを入力してください。<br/>新しい暗証番号を送信します。</p>
                    <form onSubmit={handleForgotPin} className="space-y-6">
                      <input type="email" required placeholder="example@email.com" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} disabled={isResetting} className="w-full px-4 py-5 bg-[#f5f2e6] border-none rounded-none text-base text-[#333333] focus:ring-1 focus:ring-[#333333] outline-none" />
                      {resetResult && (
                        <div className={`p-4 text-sm flex items-start gap-2 whitespace-pre-wrap ${resetResult.success ? 'bg-[#f4f8f4] text-[#2d5a2d]' : 'bg-[#fcf0f0] text-[#8a3c3c]'}`}>
                          {resetResult.message}
                        </div>
                      )}
                      <button type="submit" disabled={isResetting || !forgotEmail} className="w-full py-5 bg-[#1a1a1a] text-[#fffef2] text-sm uppercase tracking-widest font-medium transition-all active:scale-[0.98] flex justify-center items-center gap-2 disabled:opacity-50">
                        {isResetting ? <Loader2 className="w-5 h-5 animate-spin" /> : '送信する'}
                      </button>
                    </form>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          <>
            <header className="px-6 pt-safe-top pb-4 pt-6 flex items-start justify-between border-b border-[#e6e2d3] bg-[#fffef2]/90 backdrop-blur-md z-20 shrink-0">
              <div className="flex flex-col items-start gap-2">
                <h1 className="text-base text-[#1a1a1a] font-bold">{shop?.name}</h1>
                {shop?.shop_categories?.label && (
                  <span className="px-2 py-1 text-[11px] border border-[#e6e2d3] bg-[#f5f2e6] text-[#666666] tracking-wider flex items-center gap-1">
                    <Award className="w-3 h-3" /> {shop.shop_categories.label}
                  </span>
                )}
              </div>
              
              <div className="flex flex-col items-end gap-2 text-right">
                <div className="flex items-center gap-2">
                  <div className="flex flex-col items-end justify-center">
                     <span className="text-[10px] text-[#999999] tracking-wider font-inter">NAME</span>
                     <h1 className="text-sm font-bold text-[#1a1a1a]">{staff.name}</h1>
                  </div>
                  <div className="w-9 h-9 bg-[#faf9f6] rounded-full overflow-hidden border border-[#e6e2d3] flex items-center justify-center ml-1">
                    {staff.avatar_url ? (
                      <img src={staff.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                    ) : (
                      <img src={DEFAULT_AVATAR} alt="avatar" className="w-full h-full object-cover opacity-60" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isOwner && (
                    <button onClick={() => setIsOwnerModalOpen(true)} className="px-2 py-1 text-[11px] border border-[#e6e2d3] bg-[#f5f2e6] text-[#666666] tracking-wider uppercase flex items-center gap-1 active:scale-95 transition-transform">
                      <Crown className="w-3 h-3"/> Owner
                    </button>
                  )}
                  {staff.is_team_pool_eligible !== false && (
                    <button onClick={() => setIsTeamModalOpen(true)} className="px-2 py-1 text-[11px] border border-[#e6e2d3] bg-[#f5f2e6] text-[#666666] tracking-wider uppercase flex items-center gap-1 active:scale-95 transition-transform">
                      <Handshake className="w-3 h-3"/> Team
                    </button>
                  )}
                </div>
              </div>
            </header>

            <main className="flex-1 relative overflow-hidden bg-[#fffef2]">
              <AnimatePresence mode="wait">
                <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="absolute inset-0 overflow-y-auto pb-32 pt-6 px-6 -webkit-overflow-scrolling-touch">
                  
                  {/* 📊 TAB 1: ウォレット (Stats) */}
                  {activeTab === 'stats' && (
                    <div className="max-w-md mx-auto space-y-8">
                      {isOwner && (
                        <button onClick={() => window.open('/dashboard', '_blank')} className="w-full py-4 bg-[#1a1a1a] text-[#fffef2] text-sm tracking-widest transition-all active:scale-[0.98] flex items-center justify-center gap-2 mb-2">
                          <LayoutDashboard className="w-5 h-5" strokeWidth={1.5} /> 管理ダッシュボードへ <ExternalLink className="w-4 h-4 ml-1 opacity-70" />
                        </button>
                      )}

                      <div className="bg-[#f5f2e6] border border-[#e6e2d3] p-6 shadow-[0_0_20px_rgba(0,0,0,0.03)] relative overflow-hidden">
                        <p className="text-sm text-[#666666] mb-3 tracking-wider">交換可能な確定ポイント</p>
                        <div className="flex items-center justify-between">
                          <p className="text-3xl font-sans tabular-nums tracking-tight text-[#1a1a1a]">{summary.confirmed.toLocaleString()}<span className="text-sm ml-1 text-[#999999]">pt</span></p>
                          <button onClick={() => setIsExchangeModalOpen(true)} className="px-5 py-3 bg-[#1a1a1a] text-[#fffef2] text-xs tracking-widest active:scale-[0.98] transition-transform">
                            ポイント交換
                          </button>
                        </div>
                      </div>

                      <div className="bg-transparent border-b border-[#e6e2d3] pb-3 pt-2 flex items-center justify-between">
                        <p className="text-xs text-[#666666] tracking-wider">確定待ち（仮計上）</p>
                        <p className="text-lg font-sans tabular-nums tracking-tight text-[#333333]">{summary.pending.toLocaleString()}<span className="text-[11px] ml-1 text-[#999999]">pt</span></p>
                      </div>

                      {pendingReferrals.length > 0 && (
                        <div className="pt-2">
                          <h2 className="text-sm text-[#1a1a1a] mb-1">紹介履歴（報酬未確定）</h2>
                          <p className="text-[11px] text-[#666666] mb-4">商品のお届け完了後に報酬が確定します。</p>
                          <div className="space-y-0">
                            {pendingReferrals.map((item) => (
                              <button key={item.id} onClick={() => setSelectedDetail({ type: 'referral', data: item })} className="w-full text-left bg-transparent border-b border-[#e6e2d3] first:border-t py-4 flex justify-between items-center active:bg-[#f5f2e6] transition-colors">
                                <div className="flex items-start gap-3 flex-1">
                                  <div className="w-[72px] shrink-0 flex flex-col gap-1.5 pt-1">
                                    <span className="text-xs text-[#999999] tabular-nums leading-none">{formatDateYMD(item.created_at)}</span>
                                    <span className="text-[11px] bg-[#a24343] text-[#fffef2] border border-[#a24343] px-1 py-1 text-center leading-none">仮計上</span>
                                  </div>
                                  <div className="flex-1 flex flex-col">
                                    <p className="text-sm text-[#333333] mb-1 leading-snug">
                                      {item.customer_name || '匿名のお客様'} <span className="text-[#999999] text-sm">[{item.recurring_count > 1 ? `定期${item.recurring_count}` : '初回'}]</span>
                                    </p>
                                    <p className="text-sm text-[#666666]">担当: {item.staffName}</p>
                                  </div>
                                </div>
                                <div className="flex flex-col items-end shrink-0 pl-2">
                                  <span className="text-[11px] text-[#999999] mb-1">獲得予定ポイント</span>
                                  <div className="flex items-center gap-2">
                                    <p className="text-lg font-sans tabular-nums text-[#1a1a1a]">{item.staffVisibleTotal?.toLocaleString()} <span className="text-[11px] text-[#999999]">pt</span></p>
                                    <ChevronRight className="w-4 h-4 text-[#999999]" />
                                  </div>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="pt-2">
                        <h2 className="text-sm text-[#1a1a1a] mb-4">ポイント獲得履歴</h2>
                        <div className="space-y-0">
                          {history.length === 0 ? (
                            <div className="text-center py-10 text-[#999999] text-sm">まだ実績がありません</div>
                          ) : (
                            history.map((item) => {
                              const isPending = item.status === 'pending';
                              const isCanceled = item.status === 'cancel';
                              if (isPending) return null; 
                              
                              return (
                                <button key={item.id} onClick={() => setSelectedDetail({ type: 'referral', data: item })} className="w-full text-left bg-transparent border-b border-[#e6e2d3] first:border-t py-4 flex justify-between items-center active:bg-[#f5f2e6] transition-colors">
                                  <div className="flex items-start gap-3 flex-1">
                                    <div className="w-[72px] shrink-0 flex flex-col gap-1.5 pt-1">
                                      <span className="text-xs text-[#999999] tabular-nums leading-none">{formatDateYMD(item.created_at)}</span>
                                      {isCanceled ? (
                                        <span className="text-[11px] bg-[#dddddd] text-[#616161] border border-[#cbcbcb] px-1 py-1 text-center leading-none">無効</span>
                                      ) : (
                                        <span className="text-[11px] bg-[#577859] text-[#fffef2] border border-[#577859] px-1 py-1 text-center leading-none">報酬確定</span>
                                      )}
                                    </div>
                                    <div className="flex-1 flex flex-col">
                                      <p className={`text-sm text-[#333333] mb-1 leading-snug ${isCanceled ? 'line-through text-[#999999]' : ''}`}>
                                        {item.customer_name || '匿名のお客様'} <span className="text-[#999999] text-sm">[{item.recurring_count > 1 ? `定期${item.recurring_count}` : '初回'}]</span>
                                      </p>
                                      <p className="text-sm text-[#666666]">担当: {item.staffName}</p>
                                    </div>
                                  </div>
                                  <div className="flex flex-col items-end shrink-0 pl-2">
                                    <span className="text-[11px] text-[#999999] mb-1">報酬確定ポイント</span>
                                    <div className="flex items-center gap-2">
                                      <p className={`text-lg font-sans tabular-nums ${isCanceled ? 'line-through text-[#999999]' : 'text-[#1a1a1a]'}`}>
                                        +{item.totalPt.toLocaleString()} <span className="text-[11px] text-[#999999]">pt</span>
                                      </p>
                                      <ChevronRight className="w-4 h-4 text-[#999999]" />
                                    </div>
                                  </div>
                                </button>
                              )
                            })
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 🛒 TAB 2: 仕入れ (Shop) */}
                  {activeTab === 'shop' && (
                    <div className="max-w-md mx-auto space-y-8">
                      <div className="bg-[#fffef2] border-b border-[#e6e2d3] py-4 flex items-center justify-between">
                        <p className="text-sm text-[#666666] tracking-wider">保有ポイント</p>
                        <p className="text-2xl font-sans tabular-nums tracking-tight text-[#333333]">{summary.confirmed.toLocaleString()}<span className="text-sm ml-1 text-[#999999]">pt</span></p>
                      </div>

                      <div className="space-y-4">
                        {MOCK_PRODUCTS.map(product => {
                          return (
                            <button 
                              key={product.id} 
                              onClick={() => setSelectedDetail({ type: 'shop', data: product })}
                              className="w-full text-left bg-[#fffef2] border border-[#e6e2d3] p-5 shadow-[0_0_20px_rgba(0,0,0,0.03)] flex gap-5 items-center active:bg-[#f5f2e6] transition-colors"
                            >
                              <div className="w-16 h-16 bg-[#f5f2e6] flex items-center justify-center shrink-0">
                                {product.icon}
                              </div>
                              <div className="flex-1">
                                <h3 className="text-sm text-[#333333] mb-2">{product.name}</h3>
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="text-xs text-[#999999] line-through">¥{product.price.toLocaleString()}</p>
                                    <p className="text-base font-sans tabular-nums text-[#1a1a1a]">
                                      {product.ptPrice.toLocaleString()}<span className="text-xs text-[#666666] ml-1">pt</span>
                                    </p>
                                  </div>
                                  <ChevronRight className="w-5 h-5 text-[#999999]" />
                                </div>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* 📱 TAB 3: QRコード */}
                  {activeTab === 'qr' && (
                    <div className="flex flex-col items-center max-w-sm mx-auto pb-10 pt-2 space-y-8 px-2">
                      
                      <div className="w-full text-center">
                        <h2 className="text-4xl font-black font-inter tracking-tight text-[#1a1a1a]">Duacel<sup className="text-xl font-medium -ml-0.5">®</sup></h2>
                      </div>

                      <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-[#fffef2] shadow-lg bg-[#faf9f6] shrink-0">
                        {staff.avatar_url ? (
                          <img src={staff.avatar_url} alt="Staff Avatar" className="w-full h-full object-cover" />
                        ) : (
                          <img src={DEFAULT_AVATAR} alt="avatar" className="w-full h-full object-cover opacity-60" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                        )}
                      </div>

                      <div className="w-full text-center space-y-1">
                        <p className="text-base text-[#666666] tracking-widest font-bold">{shop?.name}</p>
                        <p className="text-base text-[#1a1a1a] tracking-wider mt-1">{staff.name} のご紹介</p>
                      </div>

                      <div className="w-full bg-[#f5f2e6] border border-[#e6e2d3] shadow-[0_0_40px_rgba(0,0,0,0.05)] flex flex-col items-center overflow-hidden rounded-sm">
                        
                        <div className="w-full aspect-[3/2] bg-[#e6e2d3] relative border-b border-[#e6e2d3]">
                          <img src="/qr-hero.jpg" alt="Duacel Benefit" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                        </div>

                        <div className="w-full p-8 flex flex-col items-center">
                          <div className="p-4 bg-[#ffffff] border border-[#e6e2d3] mb-6 shadow-inner">
                            <QRCodeCanvas value={referralUrl} size={200} level={"H"} fgColor="#1a1a1a" />
                          </div>
                          <p className="text-sm text-[#666666] tracking-widest text-center leading-relaxed mb-6">お客様のスマートフォンで<br/>読み込んでください</p>
                          
                          <div className="w-full space-y-3">
                            <button onClick={() => handleCopy(referralUrl)} className="w-full bg-[#fffef2] border border-[#e6e2d3] p-4 flex items-center justify-between hover:bg-[#ffffff] transition-colors active:scale-[0.98] rounded-sm shadow-sm">
                              <div className="flex items-center gap-3">
                                {copied ? <CheckCircle2 className="w-5 h-5 text-[#333333]" /> : <Copy className="w-5 h-5 text-[#333333]" />}
                                <span className="text-sm text-[#333333] font-medium">{copied ? 'URLをコピーしました' : '紹介URLをコピー'}</span>
                              </div>
                              <ChevronRight className="w-5 h-5 text-[#999999]" />
                            </button>
                            
                            <button onClick={() => { setShareTarget('line'); setIsShareModalOpen(true); }} className="w-full bg-[#fffef2] border border-[#e6e2d3] p-4 flex items-center justify-between hover:bg-[#ffffff] transition-colors active:scale-[0.98] rounded-sm shadow-sm">
                              <div className="flex items-center gap-3">
                                <MessageCircle className="w-5 h-5 text-[#333333]" />
                                <span className="text-sm text-[#333333] font-medium">LINEで送信</span>
                              </div>
                              <ChevronRight className="w-5 h-5 text-[#999999]" />
                            </button>
                            
                            <button onClick={() => { setShareTarget('email'); setIsShareModalOpen(true); }} className="w-full bg-[#fffef2] border border-[#e6e2d3] p-4 flex items-center justify-between hover:bg-[#ffffff] transition-colors active:scale-[0.98] rounded-sm shadow-sm">
                              <div className="flex items-center gap-3">
                                <Mail className="w-5 h-5 text-[#333333]" />
                                <span className="text-sm text-[#333333] font-medium">メールで送信</span>
                              </div>
                              <ChevronRight className="w-5 h-5 text-[#999999]" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 📖 TAB 4: マニュアル (Info) */}
                  {activeTab === 'info' && (
                    <div className="max-w-md mx-auto space-y-6">
                      <p className="text-sm text-[#666666] tracking-wider mb-2">ドキュメント・マニュアル</p>
                      <div className="space-y-3">
                        {[
                          { icon: <LayoutDashboard className="w-5 h-5"/>, title: '使い方ガイド', desc: 'アプリの操作方法' },
                          { icon: <ShoppingBag className="w-5 h-5"/>, title: '製品カタログ', desc: '成分や効果の詳細' },
                          { icon: <MessageCircle className="w-5 h-5"/>, title: 'トーク集', desc: 'お客様へのご案内' },
                          { icon: <PlayCircle className="w-5 h-5"/>, title: '施術動画', desc: '機器の利用手順' },
                        ].map((item, i) => (
                          <button key={i} onClick={() => alert(`${item.title} を開きます`)} className="w-full bg-[#fffef2] p-5 border border-[#e6e2d3] text-left hover:bg-[#f5f2e6] transition-colors flex items-center justify-between shadow-[0_0_15px_rgba(0,0,0,0.02)] active:scale-[0.98]">
                            <div className="flex items-center gap-4">
                              <div className="text-[#333333]">{item.icon}</div>
                              <div>
                                <h3 className="text-sm text-[#1a1a1a] mb-1">{item.title}</h3>
                                <p className="text-xs text-[#999999]">{item.desc}</p>
                              </div>
                            </div>
                            <ChevronRight className="w-5 h-5 text-[#999999]" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ⚙️ TAB 5: 設定 (Settings) */}
                  {activeTab === 'settings' && (
                    <div className="max-w-md mx-auto space-y-8 pb-10">

                      {/* ★ 追加：LINE連携バナー ★ */}
                      <div className="mb-2">
                        {!staff.line_user_id ? (
                          <div className="bg-[#f0f9f0] border border-[#d1e7d1] p-5 flex flex-col gap-3 relative overflow-hidden shadow-sm">
                            <div className="absolute top-0 right-0 p-2 opacity-10"><MessageCircle className="w-16 h-16 rotate-12 text-[#2d5a2d]" /></div>
                            <div className="relative z-10">
                              <p className="text-xs font-bold text-[#2d5a2d] flex items-center gap-1.5 mb-1"><MessageCircle className="w-4 h-4" /> LINE連携のお願い</p>
                              <p className="text-[10px] text-[#4a7c4a] leading-relaxed">
                                LINEを連携すると、紹介が発生した時に通知が届きます。<br/>ポイント交換URLもLINEで受け取れるようになります。
                              </p>
                            </div>
                            <button
                              onClick={handleConnectLine}
                              disabled={isLiffLoading}
                              className="relative z-10 w-full bg-[#2d5a2d] text-[#fffef2] py-3 text-[11px] font-bold tracking-widest uppercase active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                              {isLiffLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'LINEと連携する'}
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-1.5 py-3 bg-[#f0f9f0] border border-[#d1e7d1] shadow-sm">
                            <CheckCircle2 className="w-4 h-4 text-[#2d5a2d]" />
                            <span className="text-[10px] font-bold text-[#2d5a2d] uppercase tracking-widest">LINE連携済み</span>
                          </div>
                        )}
                      </div>
                      {/* ★ ここまで追加 ★ */}

                      <div className="flex justify-between items-center">
                        <p className="text-sm text-[#666666] tracking-wider">アカウント情報</p>
                        {!isEditMode ? (
                          <button onClick={() => setIsEditMode(true)} className="text-xs text-[#333333] border border-[#e6e2d3] bg-[#f5f2e6] px-4 py-2 hover:bg-[#e6e2d3] active:scale-[0.98] transition-all">編集する</button>
                        ) : (
                          <button onClick={handleCancelEdit} className="text-xs text-[#666666] px-4 py-2">キャンセル</button>
                        )}
                      </div>

                      <div className="bg-[#fffef2] border border-[#e6e2d3] shadow-[0_0_20px_rgba(0,0,0,0.03)] p-6 space-y-6">
                        
                        {/* アバター設定 */}
                        <div className="pb-6 border-b border-[#e6e2d3]">
                          <label className="block text-xs text-[#999999] mb-4 tracking-wider uppercase">Profile Photo</label>
                          <div className="flex items-start gap-5">
                            <div className="w-16 h-16 bg-[#faf9f6] border border-[#e6e2d3] rounded-full overflow-hidden flex items-center justify-center shrink-0">
                              {(!isEditMode ? staff.avatar_url : editAvatar) ? (
                                <img src={!isEditMode ? staff.avatar_url : editAvatar} alt="avatar" className="w-full h-full object-cover" />
                              ) : (
                                <img src={DEFAULT_AVATAR} alt="avatar" className="w-full h-full object-cover opacity-60" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                              )}
                            </div>
                            
                            {isEditMode ? (
                              <div className="flex-1 flex gap-2">
                                <label className="flex-1 py-3 border border-[#e6e2d3] bg-[#faf9f6] text-[#666666] flex flex-col items-center justify-center rounded-sm transition-colors hover:bg-[#e6e2d3] cursor-pointer active:scale-95">
                                  <ImagePlus className="w-5 h-5 mb-1" />
                                  <span className="text-[10px] font-bold">アルバム</span>
                                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
                                </label>
                                
                                <label className="flex-1 py-3 border border-[#e6e2d3] bg-[#faf9f6] text-[#666666] flex flex-col items-center justify-center rounded-sm transition-colors hover:bg-[#e6e2d3] cursor-pointer active:scale-95">
                                  <Camera className="w-5 h-5 mb-1" />
                                  <span className="text-[10px] font-bold">カメラ</span>
                                  <input ref={cameraInputRef} type="file" accept="image/*" capture="user" className="hidden" onChange={handleImageSelect} />
                                </label>
                                
                                <button onClick={() => { setEditAvatar(''); setAvatarFile(null); }} className="w-12 py-3 border border-[#e6e2d3] bg-[#faf9f6] text-[#999999] flex flex-col items-center justify-center rounded-sm transition-colors hover:bg-[#fcf0f0] hover:text-[#8a3c3c]">
                                  <Trash2 className="w-5 h-5 mb-1" />
                                  <span className="text-[10px] font-bold">削除</span>
                                </button>
                              </div>
                            ) : (
                              <div className="text-xs text-[#999999] pt-1 leading-relaxed">
                                {staff.avatar_url ? '設定済み' : '未設定（デフォルト画像）'}<br/>
                                <span className="text-[10px] opacity-70">編集モードで変更できます</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* 個人の一般設定 (名前とPINのみ編集可、IDとEmailは表示のみ) */}
                        <div>
                          <label className="block text-xs text-[#999999] mb-2 tracking-wider uppercase">Name</label>
                          {!isEditMode ? <p className="text-base text-[#1a1a1a]">{staff.name}</p> : <input type="text" value={editName} onChange={e => setEditName(e.target.value)} className="w-full bg-[#f5f2e6] border-none px-4 py-3 text-sm text-[#333333] outline-none focus:ring-1 focus:ring-[#333333]" />}
                        </div>
                        
                        <div>
                          <label className="block text-xs text-[#999999] mb-2 tracking-wider uppercase flex items-center gap-1">ID <Lock className="w-3 h-3"/></label>
                          <p className="text-base text-[#999999] tabular-nums">{staff.referral_code}</p>
                        </div>

                        <div>
                          <label className="block text-xs text-[#999999] mb-2 tracking-wider uppercase flex items-center gap-1">Email <Lock className="w-3 h-3"/></label>
                          <p className="text-base text-[#999999]">{staff.email || '未設定'}</p>
                        </div>

                        <div>
                          <label className="block text-xs text-[#999999] mb-2 tracking-wider uppercase">PIN</label>
                          {!isEditMode ? (
                            <p className="text-base text-[#1a1a1a] tracking-[0.4em] tabular-nums">••••</p>
                          ) : (
                            <div className="space-y-3">
                              <input type="password" inputMode="numeric" maxLength={4} placeholder="現在のPIN" value={currentPinInput} onChange={e => setCurrentPinInput(e.target.value.replace(/[^0-9]/g, ''))} className="w-full bg-[#f5f2e6] border-none px-4 py-3 text-sm tracking-widest tabular-nums outline-none focus:ring-1 focus:ring-[#333333]" />
                              <input type="password" inputMode="numeric" maxLength={4} placeholder="新しいPIN" value={newPinInput} onChange={e => setNewPinInput(e.target.value.replace(/[^0-9]/g, ''))} className="w-full bg-[#f5f2e6] border-none px-4 py-3 text-sm tracking-widest tabular-nums outline-none focus:ring-1 focus:ring-[#333333]" />
                              <p className="text-xs text-[#999999]">※変更しない場合は空欄</p>
                            </div>
                          )}
                        </div>

                        {/* 店舗情報設定 (オーナーのみ編集可) */}
                        <div className="pt-6 border-t border-[#e6e2d3]">
                           <label className="block text-xs text-[#999999] mb-4 tracking-wider uppercase flex items-center gap-1">Shop Info {isOwner ? <Edit2 className="w-3 h-3"/> : <Lock className="w-3 h-3"/>}</label>
                           <div className="space-y-4">
                             <div>
                               <label className="block text-[10px] text-[#999999] mb-1">店舗名</label>
                               {(!isEditMode || !isOwner) ? <p className="text-sm text-[#1a1a1a]">{shop?.name}</p> : <input type="text" value={editShopName} onChange={e => setEditShopName(e.target.value)} className="w-full bg-[#f5f2e6] border-none px-4 py-3 text-sm text-[#333333] outline-none focus:ring-1 focus:ring-[#333333]" />}
                             </div>
                             <div>
                               <label className="block text-[10px] text-[#999999] mb-1">店舗住所</label>
                               {(!isEditMode || !isOwner) ? (
                                 <p className="text-sm text-[#1a1a1a] flex items-start gap-1">
                                   <MapPin className="w-4 h-4 text-[#999999] shrink-0 mt-0.5" />
                                   {shop?.address || '未設定'}
                                 </p>
                               ) : (
                                 <input type="text" placeholder="都道府県市区町村..." value={editShopAddress} onChange={e => setEditShopAddress(e.target.value)} className="w-full bg-[#f5f2e6] border-none px-4 py-3 text-sm text-[#333333] outline-none focus:ring-1 focus:ring-[#333333]" />
                               )}
                             </div>
                             {!isOwner && isEditMode && (
                               <p className="text-xs text-[#8a3c3c] bg-[#fcf0f0] p-2">※店舗情報の変更はオーナー権限が必要です</p>
                             )}
                           </div>
                        </div>

                        <AnimatePresence>
                          {isEditMode && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="pt-6 border-t border-[#e6e2d3]">
                              {profileError && (<div className="mb-4 text-xs text-[#8a3c3c]">{profileError}</div>)}
                              <button onClick={handleSaveProfile} disabled={isSaving} className="w-full py-4 bg-[#1a1a1a] text-[#fffef2] text-sm tracking-widest disabled:opacity-50 transition-all active:scale-[0.98]">
                                {isSaving ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'SAVE CHANGES'}
                              </button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                      
                      {isOwner && (
                        <div className="bg-transparent pb-2">
                          <button onClick={() => window.open('/dashboard', '_blank')} className="w-full py-4 bg-[#1a1a1a] text-[#fffef2] text-sm tracking-widest transition-all active:scale-[0.98] flex items-center justify-center gap-2">
                            <LayoutDashboard className="w-5 h-5" strokeWidth={1.5} /> 管理ダッシュボードへ <ExternalLink className="w-4 h-4 ml-1 opacity-70" />
                          </button>
                        </div>
                      )}

                      <div className="pt-4">
                        <button onClick={handleManualLock} className="w-full py-4 border border-[#e6e2d3] bg-[#fffef2] text-[#666666] text-sm hover:bg-[#fcf0f0] hover:text-[#8a3c3c] hover:border-[#fcf0f0] transition-colors flex items-center justify-center gap-2">
                          <LogOut className="w-4 h-4" /> ログアウトする
                        </button>
                      </div>
                    </div>
                  )}
                  
                </motion.div>
              </AnimatePresence>
            </main>

            {/* ボトムナビゲーション */}
            <nav className="bg-[#1a1a1a] px-2 py-4 flex justify-between items-center z-50 pb-safe relative shrink-0">
              <button onClick={() => setActiveTab('stats')} className={`flex flex-col items-center justify-center gap-1.5 flex-1 transition-colors ${activeTab === 'stats' ? 'text-[#fffef2]' : 'text-[#666666] hover:text-[#999999]'}`}>
                <Wallet className="w-6 h-6" strokeWidth={1.5} />
                <span className="text-[11px] tracking-wider">STATS</span>
              </button>
              
              <button onClick={() => setActiveTab('shop')} className={`flex flex-col items-center justify-center gap-1.5 flex-1 transition-colors ${activeTab === 'shop' ? 'text-[#fffef2]' : 'text-[#666666] hover:text-[#999999]'}`}>
                <Store className="w-6 h-6" strokeWidth={1.5} />
                <span className="text-[11px] tracking-wider">SHOP</span>
              </button>

              <div className="px-4 flex-shrink-0 z-50 -mt-6">
                <button onClick={() => setActiveTab('qr')} className={`p-4 rounded-full transition-all active:scale-95 border-4 border-[#1a1a1a] ${activeTab === 'qr' ? 'bg-[#fffef2] text-[#1a1a1a]' : 'bg-[#333333] text-[#fffef2]'}`}>
                  <QrCode className="w-7 h-7" strokeWidth={1.5} />
                </button>
              </div>

              <button onClick={() => setActiveTab('info')} className={`flex flex-col items-center justify-center gap-1.5 flex-1 transition-colors ${activeTab === 'info' ? 'text-[#fffef2]' : 'text-[#666666] hover:text-[#999999]'}`}>
                <BookOpen className="w-6 h-6" strokeWidth={1.5} />
                <span className="text-[11px] tracking-wider">INFO</span>
              </button>

              <button onClick={() => setActiveTab('settings')} className={`flex flex-col items-center justify-center gap-1.5 flex-1 transition-colors ${activeTab === 'settings' ? 'text-[#fffef2]' : 'text-[#666666] hover:text-[#999999]'}`}>
                <Settings className="w-6 h-6" strokeWidth={1.5} />
                <span className="text-[11px] tracking-wider">SETTING</span>
              </button>
            </nav>

            {/* ★ 画像トリミング用モーダル */}
            <AnimatePresence>
              {isCropperModalOpen && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[200] bg-[#1a1a1a] flex flex-col overflow-hidden">
                  <div className="p-5 flex justify-between items-center border-b border-[#333333]">
                    <button onClick={() => setIsCropperModalOpen(false)} className="text-sm text-[#999999] hover:text-white transition-colors">キャンセル</button>
                    <h3 className="text-base font-bold text-white tracking-wider">写真の調整</h3>
                    <button onClick={handleSaveCroppedImage} disabled={isSaving} className="text-sm font-bold text-[#a3b18a] hover:text-white transition-colors flex items-center gap-1.5">
                      {isSaving ? <Loader2 className="w-4 h-4 animate-spin"/> : '決定'}
                    </button>
                  </div>

                  <div className="flex-1 relative bg-black">
                    <Cropper
                      image={rawImageSrc}
                      crop={crop}
                      zoom={zoom}
                      aspect={1}
                      cropShape="round"
                      showGrid={false}
                      onCropChange={setCrop}
                      onZoomChange={setZoom}
                      onCropComplete={onCropComplete}
                      style={{
                        containerStyle: { background: 'black' },
                        cropAreaStyle: { border: '2px solid white' }
                      }}
                    />
                  </div>

                  <div className="p-6 space-y-6 border-t border-[#333333]">
                    <div className="flex items-center gap-4">
                      <ZoomOut className="w-5 h-5 text-[#999999]" />
                      <input type="range" value={zoom} min={1} max={3} step={0.1} onChange={(e) => setZoom(parseFloat(e.target.value))} className="flex-1 h-1 bg-[#333333] appearance-none accent-white cursor-pointer" />
                      <ZoomIn className="w-5 h-5 text-[#999999]" />
                    </div>
                    <div className="flex gap-3">
                      <button onClick={() => handleReselectImage('album')} className="flex-1 py-4 bg-[#333333] text-white text-xs font-bold rounded-sm active:scale-95 transition flex items-center justify-center gap-2">
                        <ImagePlus className="w-4 h-4" /> 選び直す
                      </button>
                      <button onClick={() => handleReselectImage('camera')} className="flex-1 py-4 bg-[#333333] text-white text-xs font-bold rounded-sm active:scale-95 transition flex items-center justify-center gap-2">
                        <Camera className="w-4 h-4" /> 撮り直す
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* 各種モーダル群 (Share, Exchange, Detail, Owner, Team, Unread) */}
            <AnimatePresence>
              {isShareModalOpen && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[100] bg-[#1a1a1a]/60 backdrop-blur-sm flex flex-col justify-end p-4 sm:p-6">
                  <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'tween', duration: 0.3 }} className="bg-[#fffef2] p-8 w-full max-w-md mx-auto relative overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.2)]">
                    <button onClick={() => setIsShareModalOpen(false)} className="absolute top-4 right-4 p-3 text-[#999999] hover:text-[#333333]"><X className="w-6 h-6" strokeWidth={1.5} /></button>
                    <h3 className="text-base font-medium text-[#1a1a1a] mb-2">{shareTarget === 'line' ? 'LINEで送信' : 'メールで送信'}</h3>
                    <p className="text-xs text-[#666666] mb-6 leading-relaxed">送信するテキストを確認・編集できます。</p>
                    <div className="relative mb-8">
                      <textarea 
                        value={shareMessage}
                        onChange={(e) => setShareMessage(e.target.value)}
                        className="w-full h-48 bg-[#f5f2e6] border-none p-5 text-sm text-[#333333] outline-none focus:ring-1 focus:ring-[#333333] resize-none leading-relaxed"
                      />
                      <Edit3 className="absolute right-4 bottom-4 w-4 h-4 text-[#999999] pointer-events-none" />
                    </div>
                    <button onClick={handleExecuteShare} className="w-full py-5 bg-[#1a1a1a] text-[#fffef2] text-sm tracking-widest transition-all active:scale-[0.98] flex items-center justify-center gap-2">
                      <Send className="w-4 h-4" strokeWidth={1.5} /> 送信する
                    </button>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {isExchangeModalOpen && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[100] bg-[#1a1a1a]/60 backdrop-blur-sm flex items-center justify-center p-4">
                  <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }} className="bg-[#fffef2] p-8 w-full max-w-sm shadow-[0_0_40px_rgba(0,0,0,0.2)] relative">
                    <button onClick={() => setIsExchangeModalOpen(false)} className="absolute top-4 right-4 p-2 text-[#999999] hover:text-[#333333]"><X className="w-6 h-6" strokeWidth={1.5} /></button>
                    <h3 className="text-base text-[#1a1a1a] mb-2">えらべるPayに交換</h3>
                    <p className="text-xs text-[#666666] mb-8 leading-relaxed">ポイントを各種電子マネーに交換します。</p>
                    <div className="mb-8 pb-6 border-b border-[#e6e2d3]">
                      <p className="text-xs text-[#666666] mb-1 tracking-wider">交換可能なポイント</p>
                      <p className="text-3xl font-sans tabular-nums text-[#1a1a1a]">{summary.confirmed.toLocaleString()}<span className="text-sm text-[#999999] ml-1">pt</span></p>
                    </div>
                    <div className="space-y-4 mb-10">
                      <label className={`flex items-center gap-4 p-5 border transition-all cursor-pointer ${exchangeType === 'all' ? 'border-[#1a1a1a] bg-[#f5f2e6]' : 'border-[#e6e2d3]'}`}>
                        <input type="radio" checked={exchangeType === 'all'} onChange={() => { setExchangeType('all'); setExchangeAmount(''); }} className="w-5 h-5 accent-[#1a1a1a]" />
                        <div><p className="text-sm text-[#333333]">すべて交換する</p></div>
                      </label>
                      <label className={`flex items-start gap-4 p-5 border transition-all cursor-pointer ${exchangeType === 'custom' ? 'border-[#1a1a1a] bg-[#f5f2e6]' : 'border-[#e6e2d3]'}`}>
                        <input type="radio" checked={exchangeType === 'custom'} onChange={() => setExchangeType('custom')} className="w-5 h-5 accent-[#1a1a1a] mt-1" />
                        <div className="flex-1">
                          <p className="text-sm text-[#333333] mb-3">ポイント数を指定</p>
                          <input 
                            type="number" 
                            placeholder="例: 1000" 
                            value={exchangeAmount} 
                            onChange={(e) => { setExchangeType('custom'); setExchangeAmount(e.target.value); }} 
                            disabled={exchangeType !== 'custom'}
                            className="w-full px-4 py-3 bg-[#fffef2] border border-[#e6e2d3] text-base tabular-nums focus:border-[#1a1a1a] outline-none disabled:opacity-50"
                          />
                        </div>
                      </label>
                    </div>
                    <button onClick={handleExchangePay} disabled={isExchanging || summary.confirmed <= 0} className="w-full py-5 bg-[#1a1a1a] text-[#fffef2] text-sm tracking-widest transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50">
                      {isExchanging ? <Loader2 className="w-5 h-5 animate-spin"/> : "申請する"}
                    </button>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {selectedDetail && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[110] bg-[#1a1a1a]/60 backdrop-blur-sm flex flex-col justify-end p-4 sm:p-6">
                  <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'tween', duration: 0.3 }} className="bg-[#fffef2] p-8 w-full max-w-md mx-auto relative overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.2)]">
                    <button onClick={() => setSelectedDetail(null)} className="absolute top-4 right-4 p-3 text-[#999999] hover:text-[#333333]"><X className="w-6 h-6" strokeWidth={1.5} /></button>
                    {selectedDetail.type === 'referral' && (
                      <>
                        <h3 className="text-base text-[#1a1a1a] mb-6 border-b border-[#e6e2d3] pb-4">実績の詳細情報</h3>
                        <div className="space-y-6 mb-8">
                          <div>
                            <p className="text-[11px] text-[#999999] mb-1 tracking-wider uppercase">ステータス</p>
                            <p className="text-sm text-[#333333]">
                              {selectedDetail.data.status === 'pending' ? '仮計上（確定待ち）' : selectedDetail.data.status === 'cancel' ? '無効（キャンセル）' : 'ポイント獲得済'}
                            </p>
                          </div>
                          <div>
                            <p className="text-[11px] text-[#999999] mb-1 tracking-wider uppercase">お客様情報</p>
                            <p className="text-sm text-[#333333]">
                              {selectedDetail.data.customer_name || '匿名のお客様'} <span className="text-xs text-[#666666]">({selectedDetail.data.recurring_count > 1 ? `定期${selectedDetail.data.recurring_count}回目` : '初回購入'})</span>
                            </p>
                          </div>
                          <div>
                            <p className="text-[11px] text-[#999999] mb-1 tracking-wider uppercase">発生日時</p>
                            <p className="text-sm tabular-nums text-[#333333]">{formatDateTime(selectedDetail.data.created_at)}</p>
                          </div>
                          {selectedDetail.data.status !== 'pending' && (
                            <div>
                              <p className="text-[11px] text-[#999999] mb-1 tracking-wider uppercase">確定日時</p>
                              <p className="text-sm tabular-nums text-[#333333]">{formatDateTime(selectedDetail.data.updated_at)}</p>
                            </div>
                          )}
                          <div>
                            <p className="text-[11px] text-[#999999] mb-1 tracking-wider uppercase">担当スタッフ</p>
                            <p className="text-sm text-[#333333]">{selectedDetail.data.staffName}</p>
                          </div>
                          <div className="pt-6 border-t border-[#e6e2d3]">
                            <p className="text-[11px] text-[#999999] mb-2 tracking-wider uppercase">獲得予定 / 獲得済ポイント</p>
                            <p className={`text-3xl font-sans tabular-nums ${selectedDetail.data.status === 'cancel' ? 'line-through text-[#999999]' : 'text-[#1a1a1a]'}`}>
                              +{selectedDetail.data.totalPt.toLocaleString()}<span className="text-sm ml-1 text-[#999999]">pt</span>
                            </p>
                            <div className="mt-4 bg-[#f5f2e6] p-5">
                              <div className="flex justify-between text-sm text-[#666666] mb-3">
                                <span>対象合計</span>
                                <span className="tabular-nums">{selectedDetail.data.staffVisibleTotal?.toLocaleString()}pt</span>
                              </div>
                              <div className="flex justify-between text-sm text-[#666666] pl-3 border-l border-[#e6e2d3] mb-2">
                                <span>個人還元 ({selectedDetail.data.snapshot_ratio_individual}%)</span>
                                <span className="tabular-nums">+{selectedDetail.data.myIndPart?.toLocaleString()}pt</span>
                              </div>
                              {selectedDetail.data.myTeamPart > 0 && (
                                <div className="flex justify-between text-sm text-[#666666] pl-3 border-l border-[#e6e2d3]">
                                  <span>チーム還元 ({selectedDetail.data.snapshot_ratio_team}%)</span>
                                  <span className="tabular-nums">+{selectedDetail.data.myTeamPart?.toLocaleString()}pt</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                    {selectedDetail.type === 'shop' && (
                      <>
                        <div className="flex justify-center mb-6">
                          <div className="w-24 h-24 bg-[#f5f2e6] flex items-center justify-center rounded-full">
                            {selectedDetail.data.icon}
                          </div>
                        </div>
                        <h3 className="text-lg text-[#1a1a1a] mb-4 text-center">{selectedDetail.data.name}</h3>
                        <p className="text-sm text-[#666666] leading-relaxed mb-8">{selectedDetail.data.desc}</p>
                        <div className="bg-[#f5f2e6] border border-[#e6e2d3] p-5 mb-8 flex justify-between items-end">
                          <div>
                            <p className="text-xs text-[#999999] mb-1 line-through">通常価格: ¥{selectedDetail.data.price.toLocaleString()}</p>
                            <p className="text-[11px] text-[#666666] tracking-wider uppercase">交換必要ポイント</p>
                          </div>
                          <p className="text-2xl font-sans tabular-nums text-[#1a1a1a]">
                            {selectedDetail.data.ptPrice.toLocaleString()}<span className="text-sm ml-1 text-[#999999]">pt</span>
                          </p>
                        </div>
                        <button 
                          onClick={() => { alert('※ 購入フローへ遷移します'); setSelectedDetail(null); }} 
                          className={`w-full py-5 text-sm tracking-widest transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${summary.confirmed >= selectedDetail.data.ptPrice ? 'bg-[#1a1a1a] text-[#fffef2]' : 'bg-transparent border border-[#e6e2d3] text-[#666666]'}`}
                        >
                          {summary.confirmed >= selectedDetail.data.ptPrice ? '交換手続きへ進む' : 'ポイント不足（購入へ進む）'}
                        </button>
                      </>
                    )}
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {isOwnerModalOpen && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[110] bg-[#1a1a1a]/60 backdrop-blur-sm flex flex-col justify-end p-4 sm:p-6">
                  <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'tween', duration: 0.3 }} className="bg-[#fffef2] p-8 w-full max-w-md mx-auto relative overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.2)]">
                    <button onClick={() => setIsOwnerModalOpen(false)} className="absolute top-4 right-4 p-3 text-[#999999] hover:text-[#333333]"><X className="w-6 h-6" strokeWidth={1.5} /></button>
                    <div className="w-12 h-12 bg-[#f5f2e6] rounded-full flex items-center justify-center mb-6">
                      <Crown className="w-6 h-6 text-[#1a1a1a]" strokeWidth={1.5} />
                    </div>
                    <h3 className="text-lg text-[#1a1a1a] mb-4">オーナー権限について</h3>
                    <div className="text-sm text-[#666666] leading-relaxed mb-8 space-y-3">
                      <p>あなたはこの店舗のオーナーです。</p>
                      <p>管理ダッシュボードにアクセスすることで、以下の機能をご利用いただけます。</p>
                      <ul className="list-disc pl-5 space-y-1 mt-2 text-[#333333]">
                        <li>店舗情報の編集</li>
                        <li>スタッフの招待・管理</li>
                        <li>還元・分配率の変更</li>
                        <li>店舗全体の売上・実績確認</li>
                      </ul>
                    </div>
                    <button onClick={() => { setIsOwnerModalOpen(false); window.open('/dashboard', '_blank'); }} className="w-full py-5 bg-[#1a1a1a] text-[#fffef2] text-sm tracking-widest transition-all active:scale-[0.98] flex items-center justify-center gap-2">
                      <LayoutDashboard className="w-5 h-5" strokeWidth={1.5} /> 管理ダッシュボードへ <ExternalLink className="w-4 h-4 ml-1 opacity-70" />
                    </button>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {isTeamModalOpen && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[110] bg-[#1a1a1a]/60 backdrop-blur-sm flex flex-col justify-end p-4 sm:p-6">
                  <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'tween', duration: 0.3 }} className="bg-[#fffef2] p-8 w-full max-w-md mx-auto relative overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.2)]">
                    <button onClick={() => setIsTeamModalOpen(false)} className="absolute top-4 right-4 p-3 text-[#999999] hover:text-[#333333]"><X className="w-6 h-6" strokeWidth={1.5} /></button>
                    <div className="w-12 h-12 bg-[#f5f2e6] rounded-full flex items-center justify-center mb-6">
                      <Handshake className="w-6 h-6 text-[#1a1a1a]" strokeWidth={1.5} />
                    </div>
                    <h3 className="text-lg text-[#1a1a1a] mb-4">チーム還元について</h3>
                    <div className="text-sm text-[#666666] leading-relaxed mb-8 space-y-3">
                      <p>あなたはこの店舗の「チーム還元」対象スタッフです。</p>
                      <p>
                        店舗全体で発生したポイントの一部が、チームメンバー全員に平等に分配（還元）されます。
                        <br/>
                        （自分が紹介したお客様でなくても、店舗の売上が上がることでポイントを獲得できます）
                      </p>
                    </div>
                    {isOwner ? (
                      <button onClick={() => { setIsTeamModalOpen(false); window.open('/dashboard', '_blank'); }} className="w-full py-5 bg-[#1a1a1a] text-[#fffef2] text-sm tracking-widest transition-all active:scale-[0.98] flex items-center justify-center gap-2">
                        分配率を設定する <ExternalLink className="w-4 h-4 ml-1 opacity-70" />
                      </button>
                    ) : (
                      <button onClick={() => setIsTeamModalOpen(false)} className="w-full py-5 bg-[#f5f2e6] border border-[#e6e2d3] text-[#333333] text-sm tracking-widest transition-all active:scale-[0.98] flex items-center justify-center gap-2">
                        閉じる
                      </button>
                    )}
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {unreadReferrals.length > 0 && activeTab === 'stats' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[120] bg-[#1a1a1a]/60 backdrop-blur-sm flex flex-col justify-center items-center p-6">
                  <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }} className="bg-[#fffef2] p-8 w-full max-w-sm shadow-[0_0_40px_rgba(0,0,0,0.2)] relative border border-[#e6e2d3]">
                    <div className="flex justify-center mb-6">
                       <div className="w-12 h-12 bg-[#f5f2e6] rounded-full flex items-center justify-center">
                         <Gift className="w-6 h-6 text-[#1a1a1a]" strokeWidth={1.5} />
                       </div>
                    </div>
                    <h3 className="text-xl font-serif text-center text-[#1a1a1a] mb-2 tracking-widest">CONGRATULATIONS.</h3>
                    <p className="text-sm text-center text-[#333333] mb-6 leading-relaxed">
                      <span className="font-bold">{unreadReferrals[currentUnreadIndex].staffName}</span> さんのご紹介で<br/>商品が購入されました。
                    </p>
                    <div className="bg-[#f5f2e6] p-5 border border-[#e6e2d3] mb-6">
                      <div className="flex justify-between text-xs text-[#666666] mb-3">
                        <span>購入者</span>
                        <span className="text-[#333333] font-bold">{unreadReferrals[currentUnreadIndex].customer_name || '匿名'} 様</span>
                      </div>
                      <div className="flex justify-between text-xs text-[#666666] mb-3">
                        <span>種別</span>
                        <span className="text-[#333333]">{unreadReferrals[currentUnreadIndex].recurring_count > 1 ? `定期${unreadReferrals[currentUnreadIndex].recurring_count}回目` : '初回購入'}</span>
                      </div>
                      <div className="flex justify-between text-xs text-[#666666] pt-3 border-t border-[#e6e2d3]">
                        <span>獲得予定</span>
                        <span className="text-[#1a1a1a] font-sans font-bold text-sm tabular-nums">{unreadReferrals[currentUnreadIndex].staffVisibleTotal?.toLocaleString()} <span className="text-[11px]">pt</span></span>
                      </div>
                    </div>
                    <p className="text-[11px] text-[#666666] text-center mb-6 leading-relaxed">
                      商品のお届け完了後に報酬が確定します。
                    </p>
                    <button onClick={handleCloseUnread} className="w-full py-4 bg-[#1a1a1a] text-[#fffef2] text-sm tracking-widest active:scale-[0.98] transition-all flex justify-center items-center">
                      {currentUnreadIndex < unreadReferrals.length - 1 ? '次へ' : '確認しました'}
                    </button>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

          </>
        )}
      </div>
    </div>
  )
}