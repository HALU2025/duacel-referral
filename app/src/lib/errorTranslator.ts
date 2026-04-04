/**
 * Supabase Auth の英語エラーメッセージを
 * ユーザーフレンドリーな日本語に翻訳するユーティリティ関数
 */
export const translateAuthError = (errorMsg: string | undefined | null): string => {
  if (!errorMsg) return '予期せぬエラーが発生しました。もう一度お試しください。';

  // 大文字小文字の揺れを吸収するため、全て小文字に変換して判定
  const msg = errorMsg.toLowerCase();

  // ==========================================
  // アカウント登録・作成関連
  // ==========================================
  if (msg.includes('user already registered')) {
    return 'このメールアドレスは既に登録されています。別のメールアドレスをお試しいただくか、ログインしてください。';
  }
  if (msg.includes('password should be at least 6 characters')) {
    return 'セキュリティのため、パスワードは6文字以上で設定してください。';
  }
  if (msg.includes('signup requires a valid password')) {
    return '有効なパスワードを入力してください。';
  }
  if (msg.includes('signups not allowed for this instance')) {
    return '現在、新規の登録は制限されています。管理者にお問い合わせください。';
  }

  // ==========================================
  // ログイン・認証関連
  // ==========================================
  if (msg.includes('invalid login credentials')) {
    return 'メールアドレス、またはパスワードが間違っています。';
  }
  if (msg.includes('email not confirmed')) {
    return 'メールアドレスの確認が完了していません。受信トレイの認証メールをご確認ください。';
  }
  if (msg.includes('user not found')) {
    return '入力されたメールアドレスのアカウントが見つかりません。';
  }

  // ==========================================
  // セキュリティ・制限関連（Rate Limit）
  // ==========================================
  if (msg.includes('rate limit exceeded') || msg.includes('too many requests')) {
    return 'アクセスが集中しているか、試行回数が上限に達しました。しばらく時間をおいてから再度お試しください。';
  }
  if (msg.includes('over_email_send_rate_limit')) {
    return 'メールの送信上限に達しました。1時間ほどお待ちいただいてから再度お試しください。';
  }

  // ==========================================
  // トークン・リンク期限切れ
  // ==========================================
  if (msg.includes('token has expired or is invalid') || msg.includes('invalid claim')) {
    return 'リンクの有効期限が切れているか、無効なURLです。お手数ですが、再度メールの送信からやり直してください。';
  }

  // ==========================================
  // パスワード変更関連
  // ==========================================
  if (msg.includes('new password should be different from the old password')) {
    return '新しいパスワードは、現在と同じものは使用できません。';
  }

  // ==========================================
  // データベース・サーバー起因
  // ==========================================
  if (msg.includes('database error saving new user')) {
    return 'システムエラーが発生しました。時間を置いてから再度お試しください。';
  }

  // 万が一、辞書にない未知の英語エラーが飛んできた場合のフォールバック（無難なエラー文）
  // ※ここで errorMsg をそのまま返すと英語が露出してしまうため、固定文言にします
  return 'エラーが発生しました。入力内容をご確認の上、再度お試しください。';
};