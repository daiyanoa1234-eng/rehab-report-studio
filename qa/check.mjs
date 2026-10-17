import { chromium } from "@playwright/test";
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  acceptDownloads: true,
});
const errors = [];
const requests = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("request", (r) => {
  if (
    !r.url().startsWith("http://127.0.0.1:4173") &&
    !r.url().startsWith("data:") &&
    !r.url().startsWith("blob:")
  )
    requests.push(r.url());
});
await page.goto("http://127.0.0.1:4173/");
await page.screenshot({ path: "qa/upload.png", fullPage: true });
await page.getByRole("button", { name: "サンプルデータで試す" }).click();
await page.waitForTimeout(900);
await page.screenshot({ path: "qa/dashboard.png", fullPage: true });
for (const text of ["19,440", "324", "75.0", "60.0"])
  if (!(await page.locator(".kpi-value").filter({ hasText: text }).count()))
    throw Error("KPI missing " + text);
await page.setViewportSize({ width: 1280, height: 720 });
await page.waitForTimeout(500);
await page.screenshot({ path: "qa/dashboard-1280.png" });
console.log("charts", await page.locator("#trend-chart").boundingBox());
await page.getByRole("button", { name: "月次レポートを作成" }).click();
await page.waitForTimeout(200);
if (
  !(await page
    .getByRole("button", { name: "PPTXを保存", exact: true })
    .isDisabled())
)
  throw Error("gate failed");
await page.getByLabel("数値とコメントを確認した", { exact: false }).check();
const [download] = await Promise.all([
  page.waitForEvent("download"),
  page.getByRole("button", { name: "PPTXを保存", exact: true }).click(),
]);
await download.saveAs("qa/sample-report.pptx");
await page.screenshot({ path: "qa/report.png", fullPage: true });
const [png] = await Promise.all([
  page.waitForEvent("download"),
  page.getByRole("button", { name: "PNG", exact: true }).click(),
]);
await png.saveAs("qa/chart.png");
await page
  .locator(".comment-field textarea")
  .first()
  .fill("確認用に編集したコメント");
if (
  !(await page
    .getByRole("button", { name: "PPTXを保存", exact: true })
    .isDisabled())
)
  throw Error("gate reset failed");
await page.getByLabel("数値とコメントを確認した", { exact: false }).check();
await page.emulateMedia({ media: "print" });
await page.waitForTimeout(500);
await page.pdf({
  path: "qa/sample-report.pdf",
  format: "A4",
  landscape: true,
  printBackground: true,
});
await page.emulateMedia({ media: "screen" });
await page.getByRole("button", { name: "ダッシュボード", exact: true }).click();
await page.locator(".multi-select").first().getByRole("button").first().click();
await page.getByLabel("A病棟", { exact: true }).check();
await page.getByRole("button", { name: "完了", exact: true }).click();
if (
  !(await page
    .locator(".kpi-value")
    .first()
    .textContent()
    .then((s) => s.includes("8,640")))
)
  throw Error("filter failed");
await page.getByLabel("対象月").selectOption("2026-04");
if (
  !(await page
    .locator(".kpi-delta")
    .first()
    .textContent()
    .then((s) => s.includes("前月データなし")))
)
  throw Error("missing previous failed");
await page.setViewportSize({ width: 390, height: 844 });
await page.screenshot({ path: "qa/mobile.png", fullPage: true });
const overflow = await page.evaluate(
  () => document.documentElement.scrollWidth > innerWidth,
);
if (overflow) throw Error("mobile overflow");
console.log(JSON.stringify({ errors, externalRequests: requests, overflow }));
await browser.close();
if (errors.length || requests.length) process.exit(1);
