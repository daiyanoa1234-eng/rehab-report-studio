import { chromium } from "@playwright/test";
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
});
const p = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto("http://127.0.0.1:4173");
await p.getByRole("button", { name: "サンプルデータで試す" }).click();
await p.getByRole("button", { name: "月次レポートを作成" }).click();
await p.getByLabel("数値とコメントを確認した", { exact: false }).check();
await p.emulateMedia({ media: "print" });
await p.waitForTimeout(1000);
console.log(
  await p
    .locator("#trend-chart")
    .evaluate((e) => ({
      rect: e.getBoundingClientRect().toJSON(),
      html: e.innerHTML,
    })),
);
await p.screenshot({ path: "qa/print-debug.png", fullPage: true });
await browser.close();
