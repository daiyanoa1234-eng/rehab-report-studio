import { test } from "node:test";
import assert from "node:assert/strict";
import Encoding from "encoding-japanese";
import {
  comments,
  decodeCSV,
  headers,
  makeSample,
  normalizeMonth,
  parseCSV,
  shiftMonth,
  sum,
} from "./data";
const sample = makeSample();
test("54行のサンプルと教材のKPI・前月比が一致する", () => {
  const r = parseCSV(sample);
  assert.deepEqual(r.errors, []);
  assert.equal(r.rows.length, 54);
  const a = sum(r.rows.filter((r) => r.年月 === "2026-09")),
    b = sum(r.rows.filter((r) => r.年月 === "2026-08"));
  assert.equal(a.実施単位, 19440);
  assert.equal(a.患者数, 324);
  assert.equal(a.新規患者数, 99);
  assert.equal(a.自宅数, 81);
  assert.equal(a.退院数, 108);
  assert.equal(a.rate, 75);
  assert.equal(a.per, 60);
  assert.equal(((a.実施単位 - b.実施単位) / b.実施単位) * 100, 8);
  assert.equal(a.患者数 - b.患者数, 24);
  assert.equal(a.rate! - b.rate!, 5);
  const c = comments(r.rows, "2026-09");
  assert.equal(c.trend, "増加");
  assert.match(c.candidate, /A病棟.*\+1,440.*100.0%/);
  assert.match(c.fact, /\+8.0%/);
});
test("数値エラーは行番号・列名を表示して全体を中止", () => {
  const r = parseCSV(sample.replace("48,10,12,9", "-1,文字,12,9"));
  assert.equal(r.rows.length, 0);
  assert.ok(r.errors.some((e) => e.includes("患者数")));
  assert.ok(r.errors.some((e) => e.includes("新規患者数")));
});
test("重複キーで中止・必須列不足・空入力", () => {
  assert.match(
    parseCSV(sample + "\r\n" + sample.split("\r\n")[1]).errors.join(""),
    /重複/,
  );
  assert.match(parseCSV("年月,病棟\n2026-09,A").errors[0], /疾患群/);
  assert.equal(parseCSV("").rows.length, 0);
});
test("整合性警告は読込を継続", () => {
  const r = parseCSV(headers.join(",") + "\n2026-09,A,脳血管,1,2,0,3,60,TRUE");
  assert.equal(r.errors.length, 0);
  assert.equal(r.rows.length, 1);
  assert.equal(r.warnings.length, 2);
});
test("形式の正規化・引用符付き数値・BOM・未知列", () => {
  assert.equal(normalizeMonth("2026/9"), "2026-09");
  assert.equal(normalizeMonth("2026年9月"), "2026-09");
  assert.equal(normalizeMonth("2026-13"), null);
  const r = parseCSV(
    "\uFEFF" +
      headers.join(",") +
      ',備考\n2026/9, A , 脳血管 ,10,2,4,3,"3,600",TRUE,ignored',
  );
  assert.deepEqual(r.errors, []);
  assert.equal(r.rows[0].実施単位, 3600);
  assert.equal(r.rows[0].病棟, "A");
});
test("UTF-8とShift_JISを文字化けなく読み込む", () => {
  const utf = new TextEncoder().encode(sample);
  assert.equal(decodeCSV(utf.buffer).rows.length, 54);
  const sjis = Encoding.convert(Encoding.stringToCode(sample), {
    from: "UNICODE",
    to: "SJIS",
    type: "array",
  });
  assert.equal(decodeCSV(new Uint8Array(sjis).buffer).rows[0].疾患群, "脳血管");
});
test("分母0・前月欠損・全体差0・年跨ぎ", () => {
  const r = parseCSV(sample).rows.filter((r) => r.年月 === "2026-09");
  const zero = r.map((r) => ({ ...r, 退院数: 0, 自宅数: 0, 患者数: 0 }));
  assert.equal(sum(zero).rate, null);
  assert.equal(sum(zero).per, null);
  assert.match(comments(r, "2026-09").fact, /算出できません/);
  assert.equal(comments(r, "2026-09").candidate, "");
  assert.equal(
    comments([...r, ...r.map((v) => ({ ...v, 年月: "2026-08" }))], "2026-09")
      .candidate,
    "",
  );
  assert.equal(shiftMonth("2026-01", -1), "2025-12");
  assert.equal(shiftMonth("2026-09", -12), "2025-09");
});
test("絞り込み後の集計が独立して一致する", () => {
  const r = parseCSV(sample).rows;
  const a = sum(r.filter((v) => v.年月 === "2026-09" && v.病棟 === "A病棟"));
  assert.equal(a.実施単位, 8640);
  assert.equal(a.患者数, 120);
});
