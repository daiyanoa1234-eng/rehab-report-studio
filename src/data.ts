import Papa from "papaparse";
import Encoding from "encoding-japanese";
export const numeric = [
  "患者数",
  "新規患者数",
  "退院数",
  "自宅数",
  "実施単位",
] as const;
export const headers = [
  "年月",
  "病棟",
  "疾患群",
  ...numeric,
  "研修用架空データ",
];
export type Row = {
  年月: string;
  病棟: string;
  疾患群: string;
  患者数: number;
  新規患者数: number;
  退院数: number;
  自宅数: number;
  実施単位: number;
  研修用架空データ: boolean;
};
export type Result = {
  rows: Row[];
  errors: string[];
  warnings: string[];
  encoding?: string;
};
export function normalizeMonth(value: string) {
  const m = value.trim().match(/^(\d{4})(?:-|\/|年)(\d{1,2})月?$/);
  return m && +m[2] >= 1 && +m[2] <= 12
    ? `${m[1]}-${m[2].padStart(2, "0")}`
    : null;
}
export function parseCSV(text: string): Result {
  const result: Result = { rows: [], errors: [], warnings: [] };
  if (!text.trim()) {
    result.errors.push(
      "CSVファイルを選んでください。空のファイルは読み込めません。",
    );
    return result;
  }
  const parsed = Papa.parse<string[]>(text.replace(/^\uFEFF/, ""), {
    skipEmptyLines: "greedy",
  });
  const fields = parsed.data[0] ?? [];
  const missing = headers.slice(0, 8).filter((h) => !fields.includes(h));
  if (missing.length) {
    result.errors.push(
      `必須列が不足しています：${missing.join("、")}。テンプレートCSVをダウンロードして列を修正してください。`,
    );
    return result;
  }
  if (new Set(fields).size !== fields.length)
    result.errors.push("同じ列名が複数あります。ヘッダーを修正してください。");
  parsed.errors.forEach((e) =>
    result.errors.push(`${(e.row ?? 0) + 1}行目：${e.message}`),
  );
  const keys = new Set<string>();
  parsed.data.slice(1).forEach((cells, i) => {
    const line = i + 2;
    const raw = Object.fromEntries(fields.map((f, j) => [f, cells[j] ?? ""]));
    if (cells.length !== fields.length) {
      result.errors.push(
        `${line}行目：列数が一致しません。カンマ付きの数値は引用符で囲んでください。`,
      );
      return;
    }
    const month = normalizeMonth(raw.年月);
    if (!month)
      result.errors.push(
        `${line}行目「年月」：2026-09の形式で入力してください。`,
      );
    const row = {
      年月: month ?? "",
      病棟: raw.病棟.trim(),
      疾患群: raw.疾患群.trim(),
      研修用架空データ: raw.研修用架空データ?.trim().toUpperCase() === "TRUE",
    } as Row;
    for (const key of ["病棟", "疾患群"] as const)
      if (!row[key])
        result.errors.push(`${line}行目「${key}」：空欄を入力してください。`);
    for (const key of numeric) {
      const v = raw[key].trim().replace(/,/g, "");
      if (!/^\d+$/.test(v) || !Number.isSafeInteger(+v))
        result.errors.push(
          `${line}行目「${key}」：0以上の整数を入力してください。`,
        );
      row[key] = +v;
    }
    if (
      raw.研修用架空データ?.trim() &&
      !/^(TRUE|FALSE)$/i.test(raw.研修用架空データ.trim())
    )
      result.errors.push(
        `${line}行目「研修用架空データ」：TRUE / FALSEを入力してください。`,
      );
    const k = JSON.stringify([row.年月, row.病棟, row.疾患群]);
    if (keys.has(k))
      result.errors.push(
        `${line}行目：年月×病棟×疾患群が重複しています（${row.年月}・${row.病棟}・${row.疾患群}）。`,
      );
    keys.add(k);
    if (row.自宅数 > row.退院数)
      result.warnings.push(`${line}行目：自宅数が退院数を超えています。`);
    if (row.新規患者数 > row.患者数)
      result.warnings.push(`${line}行目：新規患者数が患者数を超えています。`);
    result.rows.push(row);
  });
  if (!result.rows.length && !result.errors.length)
    result.errors.push(
      "データ行がありません。テンプレートに月次実績を入力してください。",
    );
  if (result.errors.length) result.rows = [];
  return result;
}
export function decodeCSV(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let text: string, encoding: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    encoding = "UTF-8";
  } catch {
    text = Encoding.convert(bytes, {
      to: "UNICODE",
      from: "SJIS",
      type: "string",
    });
    encoding = "Shift_JIS";
  }
  return { ...parseCSV(text), encoding };
}
export function shiftMonth(month: string, offset: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + offset, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
export function sum(rows: Row[]) {
  const out = { 患者数: 0, 新規患者数: 0, 退院数: 0, 自宅数: 0, 実施単位: 0 };
  for (const r of rows) for (const k of numeric) out[k] += r[k];
  return {
    ...out,
    rate: out.退院数 ? (out.自宅数 / out.退院数) * 100 : null,
    per: out.患者数 ? out.実施単位 / out.患者数 : null,
  };
}
export const fmt = (n: number | null, d = 0) =>
  n === null
    ? "—"
    : n.toLocaleString("ja-JP", {
        minimumFractionDigits: d,
        maximumFractionDigits: d,
      });
export const signed = (n: number, d = 0) =>
  (n >= 0 ? "+" : "−") + fmt(Math.abs(n), d);
export function group(
  rows: Row[],
  key: "病棟" | "疾患群",
  month: string,
  prev: string,
) {
  const values = new Map<
    string,
    { name: string; current: number; previous: number }
  >();
  for (const row of rows) {
    const v = values.get(row[key]) ?? {
      name: row[key],
      current: 0,
      previous: 0,
    };
    if (row.年月 === month) v.current += row.実施単位;
    if (row.年月 === prev) v.previous += row.実施単位;
    values.set(row[key], v);
  }
  return [...values.values()];
}
export function comments(rows: Row[], month: string) {
  const current = rows.filter((r) => r.年月 === month),
    previous = rows.filter((r) => r.年月 === shiftMonth(month, -1));
  const a = sum(current),
    b = sum(previous),
    delta = a.実施単位 - b.実施単位;
  const pct = b.実施単位 ? (delta / b.実施単位) * 100 : null;
  const fact = `${+month.slice(5)}月の実施単位は${fmt(a.実施単位)}単位（${previous.length && pct !== null ? `前月比${signed(pct, 1)}%、${signed(delta)}単位` : "前月比は算出できません"}）。${a.rate === null ? "退院数が0のため、自宅退院率は算出できません。" : `自宅退院率は${fmt(a.rate, 1)}%${previous.length && b.rate !== null ? `（前月差${signed(a.rate - b.rate, 1)}ポイント）` : ""}。`}`;
  const candidates =
    previous.length && delta !== 0
      ? (["病棟", "疾患群"] as const)
          .map((k) => {
            const best = group(rows, k, month, shiftMonth(month, -1))
              .filter((g) => (g.current - g.previous) * delta > 0)
              .sort(
                (x, y) =>
                  Math.abs(y.current - y.previous) -
                  Math.abs(x.current - x.previous),
              )[0];
            return best
              ? `${best.name}の${delta > 0 ? "増加" : "減少"}（${signed(best.current - best.previous)}単位）が全体の変化に寄与（${fmt(((best.current - best.previous) / delta) * 100, 1)}%）。`
              : "";
          })
          .filter(Boolean)
          .join("\n")
      : "";
  return {
    fact,
    candidate: candidates,
    check: "原因は稼働日、人員、患者構成などを追加確認してから記述する。",
    trend:
      pct === null
        ? "比較なし"
        : pct >= 5
          ? "増加"
          : pct <= -5
            ? "減少"
            : "横ばい",
  };
}
export function makeSample(): string {
  const rows: Row[] = [];
  const units = [15300, 16200, 17100, 17550, 18000, 19440];
  for (let m = 0; m < 6; m++)
    for (let w = 0; w < 3; w++)
      for (let d = 0; d < 3; d++) {
        const i = w * 3 + d;
        const patients =
          m === 5
            ? [48, 40, 32, 42, 36, 30, 36, 32, 28][i]
            : m === 4
              ? [44, 38, 30, 40, 32, 28, 34, 28, 26][i]
              : [44, 38, 30, 40, 32, 28, 34, 28, 26][i] - (4 - m);
        const u =
          m === 5
            ? [3600, 2700, 2340, 2520, 2160, 1800, 1800, 1440, 1080][i]
            : m === 4
              ? [3000, 2220, 1980, 2640, 2280, 1920, 1800, 1200, 960][i]
              : Math.round(
                  (units[m] / 18000) *
                    [3000, 2220, 1980, 2640, 2280, 1920, 1800, 1200, 960][i],
                );
        rows.push({
          年月: `2026-${String(m + 4).padStart(2, "0")}`,
          病棟: ["A病棟", "B病棟", "C病棟"][w],
          疾患群: ["脳血管", "運動器", "廃用症候群"][d],
          患者数: patients,
          新規患者数: m === 5 ? 10 + (i % 3) : 8 + (i % 3),
          退院数: m === 5 ? 12 : m === 4 ? 10 : 9,
          自宅数: m === 5 ? 9 : m === 4 ? 7 : 6,
          実施単位: u,
          研修用架空データ: true,
        });
      }
  return Papa.unparse({
    fields: headers,
    data: rows.map((r) => headers.map((h) => r[h as keyof Row])),
  });
}
