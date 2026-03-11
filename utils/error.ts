/**
 * $fetch のエラーからユーザー向けメッセージを抽出する。
 */
export function extractErrorMessage(error: unknown): string {
	const e = error as { data?: { message?: string }; message?: string };
	return e?.data?.message || e?.message || String(error);
}
