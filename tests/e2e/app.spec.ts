import { expect, test } from "@playwright/test";

test.describe("ことのはパレット - ブラウザテスト", () => {
  test("トップページが表示される", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("img.logo")).toBeVisible();
    await expect(page.locator('input[placeholder="言葉を入力"]')).toBeVisible();
    await expect(page.locator("button.search-button")).toBeVisible();
  });

  test("言葉を入力して検索するとパレットが表示される", async ({ page }) => {
    await page.goto("/");

    const input = page.locator('input[placeholder="言葉を入力"]');
    await input.fill("桜");
    await expect(input).toHaveValue("桜");

    const searchButton = page.locator("button.search-button");
    await searchButton.click();

    // ローディングスピナーが表示される
    await expect(page.locator(".spinner")).toBeVisible({ timeout: 5000 });

    // パレットが表示されるまで待つ（色のセルが表示される）
    await expect(page.locator("#image-picker-palette.active")).toBeVisible({ timeout: 30000 });

    // 6色のパレットが返る
    const cells = page.locator("#image-picker-palette div");
    await expect(cells).toHaveCount(6);

    // シェアボタンが有効になる
    await expect(page.locator('button:has-text("シェア")')).toBeEnabled();
  });

  test("クリアボタンで入力がリセットされる", async ({ page }) => {
    await page.goto("/");

    const input = page.locator('input[placeholder="言葉を入力"]');
    await input.fill("海");

    // クリアボタンが表示される
    const clearButton = page.locator("button.clear-button");
    await expect(clearButton).toBeVisible();
    await clearButton.click();

    await expect(input).toHaveValue("");
    await expect(clearButton).not.toBeVisible();
  });

  test("空入力では検索ボタンが無効", async ({ page }) => {
    await page.goto("/");
    const searchButton = page.locator("button.search-button");
    await expect(searchButton).toBeDisabled();
  });

  test("エラー時にトーストでメッセージが表示される", async ({ page }) => {
    // 100文字超の入力でバリデーションエラー
    await page.goto("/");
    const input = page.locator('input[placeholder="言葉を入力"]');
    await input.fill("あ".repeat(101));

    const searchButton = page.locator("button.search-button");
    await searchButton.click();

    // トーストメッセージが表示される（汎用メッセージではなく具体的なエラー）
    const toast = page.locator(".toast");
    await expect(toast).toBeVisible({ timeout: 10000 });
    await expect(toast).toContainText("100文字以内");
  });

  test("OGPメタタグが含まれる", async ({ page }) => {
    await page.goto("/");
    const ogTitle = page.locator('meta[property="og:title"]');
    await expect(ogTitle).toHaveAttribute("content", "ことのはパレット");

    const ogDescription = page.locator('meta[property="og:description"]');
    await expect(ogDescription).toHaveAttribute("content", "あなたが好きなものは，どんな色をしてますか？");
  });
});
