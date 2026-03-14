/**
 * $fetch のエラーからユーザー向けメッセージを抽出する。
 * サーバーが返す message があればそれを使い、なければステータスコードに応じた
 * 日本語メッセージにフォールバックする。
 */
export function extractErrorMessage(error: unknown): string {
  const e = error as {
    data?: { message?: string };
    message?: string;
    statusCode?: number;
    status?: number;
  };

  // サーバーが返した明示的なメッセージがあればそのまま表示
  if (e?.data?.message) {
    return e.data.message;
  }

  // サーバーからメッセージが届かなかった場合のフォールバック
  const status = e?.statusCode || e?.status;
  if (status) {
    return "エラーが発生しました。しばらくしてからもう一度お試しください。";
  }

  // ネットワークエラーなど statusCode がない場合
  return "通信エラーが発生しました。ネットワーク接続を確認してください。";
}
