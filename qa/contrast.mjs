import { chromium } from "@playwright/test";
const b = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
});
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto("http://127.0.0.1:4173");
const audit=()=>p.evaluate(() => {
    const parse = (c) => c.match(/[\d.]+/g)?.map(Number) ?? [];
    const lum = (c) =>
      c
        .slice(0, 3)
        .map((v) => v / 255)
        .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
        .reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
    return [...document.querySelectorAll("main *,aside *,header *")]
      .filter(
        (e) =>
          e.childNodes.length &&
          [...e.childNodes].some(
            (n) => n.nodeType === 3 && n.textContent.trim(),
          ) &&
          e.getBoundingClientRect().width,
      )
      .flatMap((e) => {
        const s = getComputedStyle(e);
        if (s.opacity !== "1" || e.closest(":disabled,.disabled")) return [];
        let bg = e;
        while (bg && parse(getComputedStyle(bg).backgroundColor)[3] === 0)
          bg = bg.parentElement;
        const a = lum(parse(s.color)),
          bb = bg ? lum(parse(getComputedStyle(bg).backgroundColor)) : 1;
        const ratio = (Math.max(a, bb) + 0.05) / (Math.min(a, bb) + 0.05);
        return ratio < 4.5
          ? [
              {
                text: e.textContent.slice(0, 40),
                color: s.color,
                bg: bg && getComputedStyle(bg).backgroundColor,
                ratio: ratio.toFixed(2),
              },
            ]
          : [];
      });
  });
console.log("upload",await audit());
await p.getByRole("button", {name:"サンプルデータで試す"}).click();
console.log("dashboard",await audit());
await p.getByRole("button", {name:"月次レポートを作成"}).click();
console.log("report",await audit());
await b.close();
