// lib/line.ts

/**
 * 指定したLINE User IDに対してプッシュメッセージを送信する関数
 * @param lineUserId 送信先スタッフの line_user_id
 * @param text 送信するメッセージの内容
 */
export async function sendLineNotification(lineUserId: string, text: string) {
  const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;

  if (!accessToken) {
    console.warn('LINE_CHANNEL_ACCESS_TOKEN が設定されていません。');
    return false;
  }

  if (!lineUserId) {
    console.warn('送信先の LINE User ID がありません。');
    return false;
  }

  try {
    const response = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        to: lineUserId,
        messages: [
          {
            type: 'text',
            text: text
          }
        ]
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('LINE通知の送信に失敗しました:', errorData);
      return false;
    }

    return true;
  } catch (error) {
    console.error('LINE通知 APIの呼び出しでエラーが発生しました:', error);
    return false;
  }
}