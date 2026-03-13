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

  // ステータスコードに応じたフォールバックメッセージ
  const status = e?.statusCode || e?.status;
  if (status) {
    switch (status) {
      case 400:
        return "リクエストが正しくありません。入力内容を確認してください。";
      case 404:
        return "画像が見つかりませんでした。別の言葉で試してみてください。";
      case 429:
        return "本日の検索上限に達しました。明日またお試しください。";
      case 500:
        return "サーバーでエラーが発生しました。しばらくしてからもう一度お試しください。";
      case 503:
        return "サービスが一時的に利用できません。しばらくしてからもう一度お試しください。";
      default:
        return "エラーが発生しました。しばらくしてからもう一度お試しください。";
    }
  }

  // ネットワークエラーなど statusCode がない場合
  return "通信エラーが発生しました。ネットワーク接続を確認してください。";
}
