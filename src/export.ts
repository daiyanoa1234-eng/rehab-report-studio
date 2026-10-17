import { group, sum, fmt, shiftMonth, type Row } from "./data";
export function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
export async function exportPPTX(
  rows: Row[],
  month: string,
  text: { fact: string; candidate: string; check: string },
  scope: string,
  fake: boolean,
) {
  const { default: PptxGenJS } = await import("pptxgenjs");
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "リハ科 Report Studio";
  pptx.subject = "リハ科月次報告";
  pptx.title = `リハ科月次レポート ${month}`;
  pptx.theme = { headFontFace: "Meiryo", bodyFontFace: "Meiryo" };
  const footer = `${month}  |  ${scope}  |  ${fake ? "研修用架空データ  |  " : ""}数値とコメントは作成者確認済み`;
  function slide(title: string, n: number) {
    const s = pptx.addSlide();
    s.background = { color: "FAFAFD" };
    s.addShape(pptx.ShapeType.rect, {
      x: 0,
      y: 0,
      w: 0.16,
      h: 7.5,
      fill: { color: "7055D8" },
      line: { color: "7055D8" },
    });
    s.addText("REHAB REPORT STUDIO", {
      x: 0.6,
      y: 0.32,
      w: 10,
      h: 0.25,
      fontSize: 10,
      color: "7055D8",
      bold: true,
      charSpacing: 2,
    });
    s.addText(title, {
      x: 0.6,
      y: 0.95,
      w: 12,
      h: 0.7,
      fontSize: 26,
      bold: true,
      color: "29263D",
      breakLine: false,
    });
    s.addText(footer, {
      x: 0.6,
      y: 7.05,
      w: 11.8,
      h: 0.25,
      fontSize: 9,
      color: "666174",
    });
    s.addText(String(n).padStart(2, "0"), {
      x: 12.3,
      y: 7.02,
      w: 0.4,
      h: 0.3,
      fontSize: 10,
      color: "666174",
    });
    return s;
  }
  const a = sum(rows.filter((r) => r.年月 === month));
  const cover = slide("リハ科 月次レポート", 1);
  cover.addText(`${month.replace("-", "年 ")}月`, {
    x: 0.65,
    y: 2.2,
    w: 11,
    h: 1.1,
    fontSize: 42,
    bold: true,
    color: "7055D8",
  });
  cover.addText("数字は自動、解釈は人。", {
    x: 0.65,
    y: 3.7,
    w: 11,
    h: 0.6,
    fontSize: 22,
    color: "4A465D",
  });
  cover.addText(scope, {
    x: 0.65,
    y: 4.6,
    w: 11,
    h: 0.6,
    fontSize: 16,
    color: "666174",
  });
  const summary = slide("今月のサマリー", 2);
  const metrics = [
    ["実施単位", `${fmt(a.実施単位)} 単位`],
    ["患者数", `${fmt(a.患者数)} 人`],
    ["新規患者数", `${fmt(a.新規患者数)} 人`],
    ["自宅退院率", a.rate === null ? "—" : `${fmt(a.rate, 1)} %`],
    ["1人あたり単位", fmt(a.per, 1)],
  ];
  metrics.forEach(([label, value], i) => {
    summary.addText(label, {
      x: 0.65 + i * 2.5,
      y: 1.9,
      w: 2.35,
      h: 0.35,
      fontSize: 13,
      color: "666174",
    });
    summary.addText(value, {
      x: 0.65 + i * 2.5,
      y: 2.4,
      w: 2.35,
      h: 0.65,
      fontSize: 23,
      bold: true,
      color: "7055D8",
    });
  });
  const blocks = [
    ["事実", text.fact],
    [
      "変化の候補・要確認",
      text.candidate ||
        "全体差が0、または前月データがないため候補はありません。",
    ],
    ["要確認", text.check],
  ];
  blocks.forEach(([title, body], i) => {
    summary.addText(title, {
      x: 0.65,
      y: 3.35 + i * 1.1,
      w: 2.1,
      h: 0.3,
      fontSize: 12,
      bold: true,
      color: "7055D8",
    });
    summary.addText(body, {
      x: 2.8,
      y: 3.3 + i * 1.1,
      w: 9.7,
      h: 1,
      fontSize: 12,
      color: "29263D",
      valign: "top",
      fit: "shrink",
    });
  });
  summary.addNotes(
    "患者数は月内実人数。複数月を合算しない。コメントはルール生成を人が確認・編集したもの。",
  );
  const options = {
    x: 0.7,
    y: 1.95,
    w: 11.8,
    h: 4.65,
    showLegend: true,
    legendPos: "b" as const,
    showValue: true,
    chartColors: ["7055D8", "C5C9EE", "9F8CE6", "B2D5D2"],
    showTitle: false,
    catAxisLabelFontFace: "Meiryo",
    catAxisLabelFontSize: 12,
    valAxisLabelFontSize: 11,
    dataLabelFormatCode: "#,##0",
    showBorder: false,
    showCatName: false,
    showMarker: true,
  };
  const months = [...new Set(rows.map((r) => r.年月))].sort();
  const trend = slide("月別 実施単位の推移", 3);
  trend.addChart(
    pptx.ChartType.line,
    [
      {
        name: "実施単位",
        labels: months,
        values: months.map(
          (m) => sum(rows.filter((r) => r.年月 === m)).実施単位,
        ),
      },
    ],
    options,
  );
  trend.addNotes(
    `対象月：${month}。月にデータがない場合は値を補完していません。`,
  );
  const wards = group(rows, "病棟", month, shiftMonth(month, -1));
  slide("病棟別 前月との比較", 4).addChart(
    pptx.ChartType.bar,
    [
      {
        name: "対象月",
        labels: wards.map((r) => r.name),
        values: wards.map((r) => r.current),
      },
      ...(rows.some((r) => r.年月 === shiftMonth(month, -1))
        ? [
            {
              name: "前月",
              labels: wards.map((r) => r.name),
              values: wards.map((r) => r.previous),
            },
          ]
        : []),
    ],
    { ...options, barDir: "col", barGrouping: "clustered" },
  );
  const diseases = [...new Set(rows.map((r) => r.疾患群))];
  const wardNames = [...new Set(rows.map((r) => r.病棟))];
  slide("疾患群別 実施単位の内訳", 5).addChart(
    pptx.ChartType.bar,
    wardNames.map((w) => ({
      name: w,
      labels: diseases,
      values: diseases.map(
        (d) =>
          sum(
            rows.filter(
              (r) => r.年月 === month && r.病棟 === w && r.疾患群 === d,
            ),
          ).実施単位,
      ),
    })),
    { ...options, barDir: "bar", barGrouping: "stacked" },
  );
  await pptx.writeFile({
    fileName: `リハ科月報_${month}.pptx`,
    compression: true,
  });
}
export async function exportPNG(id: string, name: string, caption = "") {
  const svg = document.querySelector(`#${id} svg.recharts-surface`);
  if (!svg)
    throw Error(
      "グラフがありません。ダッシュボードでグラフを表示してください。",
    );
  const clone = svg.cloneNode(true) as SVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const bounds = svg.getBoundingClientRect();
  clone.setAttribute("width", String(bounds.width));
  clone.setAttribute("height", String(bounds.height));
  const blob = new Blob([new XMLSerializer().serializeToString(clone)], {
    type: "image/svg+xml;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(Error("画像の生成に失敗しました。"));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = bounds.width * 2;
    canvas.height = (bounds.height + 66) * 2;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#55416e";
    ctx.font = "bold 28px sans-serif";
    ctx.fillText(
      document.querySelector(`#${id} h3`)?.textContent ?? "実績グラフ",
      28,
      40,
    );
    ctx.drawImage(img, 0, 60, canvas.width, bounds.height * 2);
    ctx.font = "20px sans-serif";
    ctx.fillStyle = "#665475";
    ctx.fillText(caption, 28, canvas.height - 20);
    await new Promise<void>((resolve) =>
      canvas.toBlob((b) => {
        if (b) saveBlob(b, name);
        resolve();
      }, "image/png"),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
