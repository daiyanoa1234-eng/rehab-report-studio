import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
});
const p = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto("http://127.0.0.1:4173");
const header =
  "年月,病棟,疾患群,患者数,新規患者数,退院数,自宅数,実施単位,研修用架空データ";
const upload = async (text, name = "test.csv") => {
  await p
    .locator("input[type=file]")
    .setInputFiles({ name, mimeType: "text/csv", buffer: Buffer.from(text) });
  await p.waitForTimeout(120);
};
await upload("not csv", "file.txt");
if (
  !(await p
    .getByRole("status")
    .textContent()
    .then((x) => x.includes("CSVファイルを選んでください")))
)
  throw Error("invalid extension");
await upload("年月,病棟\n2026-09,A");
if (
  !(await p
    .getByRole("status")
    .textContent()
    .then((x) => x.includes("必須列が不足")))
)
  throw Error("missing fields");
await upload(header + "\n2026-09,A,脳血管,-1,2,4,3,10,TRUE");
if (
  !(await p
    .getByRole("status")
    .textContent()
    .then((x) => x.includes("2行目「患者数」")))
)
  throw Error("negative");
await upload(header + "\n2026-09,A,脳血管,1,2,0,3,10,TRUE");
if (
  !(await p
    .getByRole("status")
    .textContent()
    .then((x) => x.includes("自宅数が退院数を超え")))
)
  throw Error("warning");
if (
  !(await p
    .locator(".kpi-value")
    .nth(3)
    .textContent()
    .then((x) => x.includes("—")))
)
  throw Error("zero denominator");
const testRows = [
  "2025-09,A,脳血管,10,2,4,3,100,FALSE",
  "2026-09,A,脳血管,15,3,4,3,200,FALSE",
  "2026-08,B,運動器,20,3,4,3,150,FALSE",
];
await upload(header + "\n" + testRows.join("\n"));
await p.locator("label.yoy").click();
if (
  !(await p
    .locator(".year-delta")
    .first()
    .textContent()
    .then((x) => x.includes("+100.0%")))
)
  throw Error("yoy");
await p.locator(".multi-select").first().getByRole("button").first().click();
await p.getByLabel("B", { exact: true }).check();
await p.getByRole("button", { name: "完了", exact: true }).click();
if (
  !(await p
    .getByRole("heading", { name: "該当データがありません" })
    .isVisible())
)
  throw Error("empty filter");
await p.getByRole("button", { name: "絞り込みを解除", exact: true }).click();
const big = Array.from(
  { length: 5000 },
  (_, i) => `2026-09,病棟${i % 10},疾患${Math.floor(i / 10)},10,2,4,3,100,TRUE`,
);
const start = Date.now();
await upload(header + "\n" + big.join("\n"));
await p.locator(".kpi-value").first().filter({ hasText: "500,000" }).waitFor();
console.log("5000 rows upload/render:", Date.now() - start, "ms");
await p.close();
await browser.close();
console.log("All browser edge cases passed");
