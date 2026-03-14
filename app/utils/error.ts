/**
 * $fetch のエラーからユーザー向けメッセージを抽出する。
 * サーバーが返す message があればそれを使い、なければ汎用メッセージを返す。
 */
export function extractErrorMessage(error: unknown): string {
  const e = error as { data?: { message?: string } };
  return e?.data?.message || "エラーが発生しました。しばらくしてからもう一度お試しください。";
}
