import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  LayoutDashboard,
  LockKeyhole,
  Plus,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  X,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  LabelList,
  ReferenceDot,
} from "recharts";
import {
  comments,
  decodeCSV,
  fmt,
  group,
  headers,
  makeSample,
  numeric,
  parseCSV,
  shiftMonth,
  signed,
  sum,
  type Result,
  type Row,
} from "./data";
import { exportPNG, exportPPTX, saveBlob } from "./export";
import "./style.css";
const colors = [
  "#7557d5",
  "#b8b9e9",
  "#94bdb8",
  "#d4aad8",
  "#a4b6dd",
  "#c2b4a1",
];
const monthLabel = (m: string) => `${m.slice(0, 4)}年${+m.slice(5)}月`;
function App() {
  const [rows, setRows] = useState<Row[]>([]),
    [validation, setValidation] = useState<Result | null>(null),
    [filename, setFilename] = useState(""),
    [tab, setTab] = useState<"dashboard" | "report">("dashboard"),
    [month, setMonth] = useState(""),
    [wards, setWards] = useState<string[]>([]),
    [diseases, setDiseases] = useState<string[]>([]),
    [yoy, setYoy] = useState(false),
    [checked, setChecked] = useState(false),
    [drag, setDrag] = useState(false),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [preview, setPreview] = useState(0),
    [sort, setSort] = useState<{ key: keyof Row; asc: boolean }>({
      key: "病棟",
      asc: true,
    });
  const [detailPage, setDetailPage] = useState(0);
  useEffect(() => setDetailPage(0), [rows, wards, diseases, month, sort]);
  const fileInput = useRef<HTMLInputElement>(null);
  const [edit, setEdit] = useState({ fact: "", candidate: "", check: "" });
  const months = useMemo(
    () => [...new Set(rows.map((r) => r.年月))].sort(),
    [rows],
  );
  const wardOptions = useMemo(
    () => [...new Set(rows.map((r) => r.病棟))],
    [rows],
  );
  const diseaseOptions = useMemo(
    () => [...new Set(rows.map((r) => r.疾患群))],
    [rows],
  );
  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (!wards.length || wards.includes(r.病棟)) &&
          (!diseases.length || diseases.includes(r.疾患群)),
      ),
    [rows, wards, diseases],
  );
  const current = filtered.filter((r) => r.年月 === month),
    prevMonth = shiftMonth(month || "2026-09", -1),
    previous = filtered.filter((r) => r.年月 === prevMonth),
    hasPrev = previous.length > 0;
  const a = sum(current),
    b = sum(previous);
  const yearRows = filtered.filter(
      (r) => r.年月 === shiftMonth(month || "2026-09", -12),
    ),
    hasYear = yearRows.length > 0;
  const year = sum(yearRows);
  const fake = rows.some((r) => r.研修用架空データ);
  const generated = useMemo(
    () => comments(filtered, month || "2026-09"),
    [filtered, month],
  );
  useEffect(() => {
    setChecked(false);
    setEdit({
      fact: generated.fact,
      candidate: generated.candidate,
      check: generated.check,
    });
    setYoy(false);
  }, [generated]);
  useEffect(() => {
    if (!rows.length) return;
    const fn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", fn);
    return () => window.removeEventListener("beforeunload", fn);
  }, [rows]);
  function load(result: Result, name: string) {
    setValidation(result);
    if (!result.errors.length) {
      setRows(result.rows);
      setMonth([...new Set(result.rows.map((r) => r.年月))].sort().at(-1)!);
      setFilename(name);
      setWards([]);
      setDiseases([]);
      setTab("dashboard");
      setNotice("");
    }
  }
  async function read(file?: File) {
    if (!file) return;
    if (!/\.csv$/i.test(file.name) || !file.size) {
      setValidation({
        rows: [],
        errors: ["CSVファイルを選んでください。空のファイルは読み込めません。"],
        warnings: [],
      });
      return;
    }
    try {
      load(decodeCSV(await file.arrayBuffer()), file.name);
    } catch {
      setValidation({
        rows: [],
        errors: [
          "ファイルを読み込めませんでした。CSVの形式を確認して選び直してください。",
        ],
        warnings: [],
      });
    }
  }
  const template = () =>
    saveBlob(
      new Blob(["\uFEFF" + headers.join(",") + "\r\n"], {
        type: "text/csv;charset=utf-8",
      }),
      "リハ科_テンプレート.csv",
    );
  const sample = () =>
    load(
      { ...parseCSV(makeSample()), encoding: "UTF-8" },
      "研修用サンプル_2026年4–9月.csv",
    );
  const trend = months.map((m) => ({
    name: `${+m.slice(5)}月`,
    month: m,
    units: filtered.some((r) => r.年月 === m)
      ? sum(filtered.filter((r) => r.年月 === m)).実施単位
      : null,
  }));
  const wardData = group(filtered, "病棟", month, prevMonth);
  // Build the disease-by-ward matrix once instead of scanning all rows per bar.
  const diseaseMatrix = new Map<string, Map<string, number>>();
  for (const row of current) {
    const values = diseaseMatrix.get(row.疾患群) ?? new Map<string, number>();
    values.set(row.病棟, (values.get(row.病棟) ?? 0) + row.実施単位);
    diseaseMatrix.set(row.疾患群, values);
  }
  const diseaseData = diseaseOptions
    .filter((d) => !diseases.length || diseases.includes(d))
    .map((d) => ({
      name: d,
      ...Object.fromEntries(
        wardOptions
          .filter((w) => !wards.length || wards.includes(w))
          .map((w) => [w, diseaseMatrix.get(d)?.get(w) ?? 0]),
      ),
    }));
  const sorted = [...current].sort((x, y) => {
    const va = x[sort.key],
      vb = y[sort.key];
    return (
      (typeof va === "number" && typeof vb === "number"
        ? va - vb
        : String(va).localeCompare(String(vb), "ja")) * (sort.asc ? 1 : -1)
    );
  });
  const scope = `${wards.length ? wards.join("・") : "すべての病棟"} / ${diseases.length ? diseases.join("・") : "すべての疾患群"}`;
  const savePNG = (id: string, name: string) =>
    exportPNG(
      id,
      name,
      `${monthLabel(month)} · ${scope}${fake ? " · 研修用架空データ" : ""}`,
    );
  async function pptx() {
    if (!checked) return;
    setBusy(true);
    setNotice("");
    try {
      await exportPPTX(filtered, month, edit, scope, fake);
      setNotice(
        "PPTXを保存しました。5枚のスライドと編集可能なグラフが含まれます。",
      );
    } catch (e) {
      setNotice(
        `出力できませんでした。再試行してください。${e instanceof Error ? e.message : ""}`,
      );
    } finally {
      setBusy(false);
    }
  }
  const badges = (
    <>
      <span className="privacy">
        <LockKeyhole size={13} />
        ブラウザ内で処理
      </span>
      {fake && <span className="sample-badge">研修用架空データ</span>}
    </>
  );
  const metrics = [
    {
      label: "実施単位",
      value: fmt(a.実施単位),
      unit: "単位",
      note: "対象月の実施単位を合算",
      formula: `Σ 実施単位`,
      delta: b.実施単位 ? ((a.実施単位 - b.実施単位) / b.実施単位) * 100 : null,
      suffix: "%",
      decimal: 1,
      year: year.実施単位
        ? ((a.実施単位 - year.実施単位) / year.実施単位) * 100
        : null,
    },
    {
      label: "患者数",
      value: fmt(a.患者数),
      unit: "人",
      note: "月内実人数。月をまたいだ合計はしない",
      formula: "Σ 患者数（対象月のみ）",
      delta: a.患者数 - b.患者数,
      suffix: "人",
      decimal: 0,
      year: a.患者数 - year.患者数,
    },
    {
      label: "新規患者数",
      value: fmt(a.新規患者数),
      unit: "人",
      note: "対象月に新たに介入した患者",
      formula: "Σ 新規患者数",
      delta: a.新規患者数 - b.新規患者数,
      suffix: "人",
      decimal: 0,
      year: a.新規患者数 - year.新規患者数,
    },
    {
      label: "自宅退院率",
      value: fmt(a.rate, 1),
      unit: a.rate === null ? "" : "%",
      note: "退院患者に占める自宅退院の割合",
      formula: `${fmt(a.自宅数)}人 ÷ ${fmt(a.退院数)}人`,
      delta: a.rate !== null && b.rate !== null ? a.rate - b.rate : null,
      suffix: "pt",
      decimal: 1,
      year: a.rate !== null && year.rate !== null ? a.rate - year.rate : null,
    },
    {
      label: "患者1人あたり単位",
      value: fmt(a.per, 1),
      unit: a.per === null ? "" : "単位",
      note: "患者1人あたりの平均実施単位",
      formula: `${fmt(a.実施単位)}単位 ÷ ${fmt(a.患者数)}人`,
      delta: a.per !== null && b.per !== null ? a.per - b.per : null,
      suffix: "単位",
      decimal: 1,
      year: a.per !== null && year.per !== null ? a.per - year.per : null,
    },
  ];
  function chart(
    id: string,
    title: string,
    sub: string,
    content: React.ReactNode,
  ) {
    return (
      <section className="panel chart-panel" id={id}>
        <div className="panel-head">
          <div>
            <h3>{title}</h3>
            <p>{sub}</p>
          </div>
          <button
            className="icon-button png"
            disabled={!checked}
            title={
              checked
                ? "PNGで保存"
                : "月次レポートで数値とコメントを確認してください"
            }
            aria-label={`${title}をPNGで保存`}
            onClick={() =>
              savePNG(id, `${title}_${month}.png`).catch((e) =>
                setNotice(e.message),
              )
            }
          >
            <ArrowDownToLine size={17} />
          </button>
        </div>
        <div className="chart-body">{content}</div>
      </section>
    );
  }
  return (
    <>
      <input
        ref={fileInput}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          read(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <aside className="sidebar">
        <a className="brand" href="#" onClick={(e) => e.preventDefault()}>
          <span className="brand-mark">
            <Activity size={25} />
          </span>
          <span>
            リハ科<span className="brand-sub">Report Studio</span>
          </span>
        </a>
        <div className="workspace-label">WORKSPACE</div>
        <nav>
          <button
            className={tab === "dashboard" ? "nav-item active" : "nav-item"}
            onClick={() => setTab("dashboard")}
          >
            <LayoutDashboard size={18} />
            ダッシュボード{tab === "dashboard" && <span className="nav-dot" />}
          </button>
          <button
            className={tab === "report" ? "nav-item active" : "nav-item"}
            disabled={!rows.length}
            onClick={() => setTab("report")}
          >
            <FileText size={18} />
            月次レポート
          </button>
        </nav>
        <div className="sidebar-rule" />
        <div className="workspace-label">DATA & RESOURCES</div>
        <button className="nav-item" onClick={() => fileInput.current?.click()}>
          <FolderOpen size={18} />
          CSVを読み込む
        </button>
        <button className="nav-item" onClick={template}>
          <FileSpreadsheet size={18} />
          テンプレートCSV
          <ArrowDownToLine size={14} className="push" />
        </button>
        <div className="side-tip">
          <div className="tip-icon">
            <ShieldCheck size={21} />
          </div>
          <strong>数字は自動、解釈は人。</strong>
          <p>
            集計からレポートまでを、
            <br />
            ひとつのワークスペースで。
          </p>
          <span>
            <span className="green-dot" />
            データはこの端末の中だけ
          </span>
        </div>
        <div className="sidebar-foot">
          <span className="avatar">R</span>
          <div>
            リハ科 Report Studio<small>月次レポートワークスペース</small>
          </div>
          <span className="version">v1.0</span>
        </div>
      </aside>
      <div className="app">
        <header className="topbar">
          <div className="breadcrumb">
            ワークスペース
            <ChevronRight size={14} />
            <strong>
              {tab === "dashboard" ? "ダッシュボード" : "月次レポート"}
            </strong>
          </div>
          <div className="topbar-right">
            {badges}
            <span className="top-avatar">RK</span>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">MONTHLY PERFORMANCE</div>
              <h1>
                {rows.length
                  ? tab === "dashboard"
                    ? "リハ科 ダッシュボード"
                    : "月次レポート"
                  : "月次報告を、もっとシンプルに。"}
              </h1>
              <p>
                {rows.length
                  ? tab === "dashboard"
                    ? "日々の実績を、次の一歩につながる気づきへ。"
                    : "数字とコメントを確認して、会議で使える報告資料に。"
                  : "CSVを入れるだけで、実績の可視化から報告資料の作成まで。"}
              </p>
            </div>
            {!!rows.length && (
              <div className="heading-actions">
                <button
                  className="button secondary"
                  onClick={() => fileInput.current?.click()}
                >
                  <UploadCloud size={17} />
                  CSVを入替
                </button>
                <button
                  className="button primary"
                  onClick={() =>
                    tab === "dashboard" ? setTab("report") : pptx()
                  }
                  disabled={tab === "report" && (!checked || busy)}
                >
                  {tab === "dashboard" ? (
                    <FileText size={17} />
                  ) : (
                    <ArrowDownToLine size={17} />
                  )}{" "}
                  {tab === "dashboard"
                    ? "月次レポートを作成"
                    : busy
                      ? "PPTXを作成中…"
                      : "PPTXで出力"}
                  {tab === "dashboard" && <ArrowRight size={16} />}
                </button>
              </div>
            )}
          </div>
          {!rows.length && (
            <>
              <div className="intro-grid">
                <section
                  className={`upload-card ${drag ? "drag" : ""}`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDrag(true);
                  }}
                  onDragLeave={() => setDrag(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDrag(false);
                    read(e.dataTransfer.files[0]);
                  }}
                >
                  <span className="step-pill">STEP 01 · データを読み込む</span>
                  <div className="upload-icon">
                    <UploadCloud size={36} />
                  </div>
                  <h2>月次実績のCSVを、ここに。</h2>
                  <p>
                    ファイルをドラッグ＆ドロップ
                    <br />
                    または、端末からファイルを選んでください
                  </p>
                  <button
                    className="button primary"
                    onClick={() => fileInput.current?.click()}
                  >
                    <Plus size={17} />
                    CSVファイルを選択
                  </button>
                  <span className="file-hint">UTF-8 / Shift_JIS に対応</span>
                  <div className="upload-assurance">
                    <LockKeyhole size={15} />
                    データはこの端末の外に送信されません
                  </div>
                </section>
                <section className="sample-card">
                  <div className="sample-art">
                    <div className="mini-chart">
                      <div className="mini-title">
                        MONTHLY REPORT<span>2026.09</span>
                      </div>
                      <div className="mini-number">
                        19,440<small>単位</small>
                        <span>↗ +8.0%</span>
                      </div>
                      <svg viewBox="0 0 300 100" aria-hidden="true">
                        <defs>
                          <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
                            <stop stopColor="#8f73e5" stopOpacity=".22" />
                            <stop
                              offset="1"
                              stopColor="#8f73e5"
                              stopOpacity="0"
                            />
                          </linearGradient>
                        </defs>
                        <path
                          d="M5 80 L60 65 L115 52 L170 46 L225 40 L295 10 L295 100 L5 100Z"
                          fill="url(#fade)"
                        />
                        <path
                          d="M5 80 L60 65 L115 52 L170 46 L225 40 L295 10"
                          fill="none"
                          stroke="#8462dd"
                          strokeWidth="3"
                        />
                        <circle cx="295" cy="10" r="5" fill="#8462dd" />
                      </svg>
                      <div className="mini-bottom">
                        4月　　5月　　6月　　7月　　8月　　9月
                      </div>
                    </div>
                    <span className="floating-check">
                      <CheckCheck size={24} />
                    </span>
                  </div>
                  <span className="step-pill">まずは体験してみる</span>
                  <h2>データがなくても、大丈夫。</h2>
                  <p>
                    6ヶ月分の架空データで、集計から
                    <br />
                    月報の出力まで、すぐに体験できます。
                  </p>
                  <button className="button primary" onClick={sample}>
                    <Sparkles size={17} />
                    サンプルデータで試す
                    <ArrowRight size={17} />
                  </button>
                  <small>2026年4月–9月 / 3病棟 × 3疾患群 / 54行</small>
                </section>
              </div>
              <div className="how-it-works">
                {[
                  ["01", "CSVを読み込む", "月次集計データを準備"],
                  ["02", "数字を確かめる", "実績と変化を可視化"],
                  ["03", "コメントを整える", "解釈・最終確認は人が"],
                  ["04", "月報を出力する", "編集できるPowerPointへ"],
                ].map(([n, t, d]) => (
                  <div key={n}>
                    <span>{n}</span>
                    <div>
                      <strong>{t}</strong>
                      <p>{d}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="initial-note">
                <FileSpreadsheet size={19} />
                <div>
                  <strong>お手元のデータを使うには</strong>
                  <p>
                    <button className="text-button" onClick={template}>
                      テンプレートCSVをダウンロード
                    </button>
                    し、年月・病棟・疾患群ごとの集計値を入力してください。患者個人の情報は含めないでください。院外に出す資料は所属施設のルールに従ってください。
                  </p>
                </div>
              </div>
            </>
          )}
          {validation && (
            <div
              className={`validation ${validation.errors.length ? "error" : ""}`}
              role="status"
            >
              <FileCheck2 size={17} />
              <div>
                {validation.errors.length ? (
                  <>
                    <strong>
                      読み込めませんでした。CSVを修正して、もう一度選択してください。
                    </strong>
                    {validation.errors.map((e, i) => (
                      <p key={i}>{e}</p>
                    ))}
                    <button className="text-button" onClick={template}>
                      テンプレートCSVをダウンロード
                    </button>
                  </>
                ) : (
                  <>
                    <strong>{fmt(validation.rows.length)}行 / 必須列OK</strong>
                    <span className="validation-file">
                      {filename} · {validation.encoding || "UTF-8"}
                    </span>
                    {validation.warnings.map((w, i) => (
                      <p key={i}>要確認：{w}</p>
                    ))}
                  </>
                )}
              </div>
              {!validation.errors.length && (
                <span className="validation-check">
                  <Check size={13} />
                  読込完了
                </span>
              )}
            </div>
          )}
          {!!rows.length && (
            <>
              <section className="filterbar">
                <div className="filter-month">
                  <label htmlFor="month">対象月</label>
                  <select
                    id="month"
                    value={month}
                    onChange={(e) => setMonth(e.target.value)}
                  >
                    {[...months].reverse().map((m) => (
                      <option value={m} key={m}>
                        {monthLabel(m)}
                      </option>
                    ))}
                  </select>
                </div>
                <span className="filter-divider" />
                <MultiSelect
                  title="病棟"
                  options={wardOptions}
                  selected={wards}
                  onChange={setWards}
                />
                <MultiSelect
                  title="疾患群"
                  options={diseaseOptions}
                  selected={diseases}
                  onChange={setDiseases}
                />
                {(wards.length > 0 || diseases.length > 0) && (
                  <button
                    className="reset-filter"
                    onClick={() => {
                      setWards([]);
                      setDiseases([]);
                    }}
                  >
                    <RotateCcw size={13} />
                    解除
                  </button>
                )}
                <label
                  className={`yoy ${!hasYear ? "disabled" : ""}`}
                  title={
                    hasYear
                      ? "12ヶ月前の同月と比較します"
                      : "12ヶ月前の同月データがありません"
                  }
                >
                  <input
                    type="checkbox"
                    checked={yoy && hasYear}
                    disabled={!hasYear}
                    onChange={(e) => setYoy(e.target.checked)}
                  />
                  <span className="toggle" />
                  前年同月比
                </label>
              </section>
              {!current.length ? (
                <div className="empty">
                  <BarChart3 size={32} />
                  <h2>該当データがありません</h2>
                  <p>
                    病棟・疾患群の絞り込みを解除して、もう一度確認してください。
                  </p>
                  <button
                    className="button secondary"
                    onClick={() => {
                      setWards([]);
                      setDiseases([]);
                    }}
                  >
                    絞り込みを解除
                  </button>
                </div>
              ) : (
                <>
                  <div
                    className={
                      tab === "report"
                        ? "dashboard-wrap report-mode"
                        : "dashboard-wrap"
                    }
                  >
                    <div className="section-caption">
                      <div>
                        <span className="purple-dot" />
                        {monthLabel(month)}の実績
                        <span className="muted">OVERVIEW</span>
                      </div>
                      <span>
                        比較対象：
                        {hasPrev ? monthLabel(prevMonth) : "前月データなし"}
                      </span>
                    </div>
                    <div className="kpi-grid">
                      {metrics.map((m, i) => (
                        <section
                          className={`kpi ${i === 0 ? "highlight" : ""}`}
                          key={m.label}
                        >
                          <div className="kpi-label">
                            {m.label}
                            {i === 0 && <BarChart3 size={16} />}
                          </div>
                          <div className="kpi-value">
                            {m.value}
                            <span>{m.unit}</span>
                          </div>
                          <div className="kpi-delta">
                            {hasPrev && m.delta !== null ? (
                              <>
                                <span className="delta-badge">
                                  {m.delta >= 0 ? "▲" : "▼"}{" "}
                                  {signed(m.delta, m.decimal)}
                                  {m.suffix}
                                </span>
                                <span>
                                  前月{m.suffix === "%" ? "比" : "差"}
                                </span>
                              </>
                            ) : (
                              <span>—（前月データなし・算出不可）</span>
                            )}
                          </div>
                          {yoy && hasYear && (
                            <div className="year-delta">
                              前年同月{" "}
                              {m.year === null
                                ? "—"
                                : signed(m.year, m.decimal) + m.suffix}
                            </div>
                          )}
                          <div className="kpi-formula">{m.formula}</div>
                          <div className="kpi-note">{m.note}</div>
                        </section>
                      ))}
                    </div>
                    <div className="charts-grid">
                      {chart(
                        "trend-chart",
                        "月別 実施単位の推移",
                        "月ごとの変化を把握する",
                        <>
                          <div className="chart-legend">
                            <span>
                              <i style={{ background: colors[0] }} />
                              実施単位
                            </span>
                            <span className="muted">単位</span>
                          </div>
                          <ResponsiveContainer width="100%" height={205}>
                            <LineChart
                              data={trend}
                              margin={{
                                top: 16,
                                right: 32,
                                bottom: 0,
                                left: 5,
                              }}
                            >
                              <CartesianGrid
                                strokeDasharray="3 4"
                                vertical={false}
                                stroke="#ebeaf2"
                              />
                              <XAxis
                                dataKey="name"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: "#716a7e", fontSize: 12 }}
                                dy={7}
                              />
                              <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: "#716a7e", fontSize: 11 }}
                                tickFormatter={(v) => `${v / 1000}k`}
                              />
                              <Tooltip
                                formatter={(v) => [
                                  `${fmt(Number(v))} 単位`,
                                  "実施単位",
                                ]}
                                contentStyle={{
                                  borderRadius: 12,
                                  border: "1px solid #eeebf5",
                                }}
                              />
                              <Line
                                isAnimationActive={false}
                                type="linear"
                                dataKey="units"
                                stroke={colors[0]}
                                strokeWidth={3}
                                dot={{ r: 4, fill: "white", strokeWidth: 2 }}
                                activeDot={{ r: 6 }}
                              />
                              {current.length > 0 && (
                                <ReferenceDot
                                  x={`${+month.slice(5)}月`}
                                  y={a.実施単位}
                                  r={6}
                                  fill={colors[0]}
                                  stroke="#fff"
                                  strokeWidth={3}
                                  label={{
                                    value: fmt(a.実施単位),
                                    position: "top",
                                    fill: colors[0],
                                    fontSize: 13,
                                    fontWeight: 700,
                                  }}
                                />
                              )}
                            </LineChart>
                          </ResponsiveContainer>
                        </>,
                      )}
                      {chart(
                        "ward-chart",
                        "病棟別 前月との比較",
                        "変化の出どころを見つける",
                        <>
                          <div className="chart-legend">
                            <span>
                              <i style={{ background: colors[1] }} />
                              {hasPrev
                                ? `${+prevMonth.slice(5)}月（前月）`
                                : "前月データなし"}
                            </span>
                            <span>
                              <i style={{ background: colors[0] }} />
                              {+month.slice(5)}月（対象月）
                            </span>
                          </div>
                          <ResponsiveContainer width="100%" height={205}>
                            <BarChart
                              data={wardData}
                              margin={{
                                top: 20,
                                right: 10,
                                left: -15,
                                bottom: 0,
                              }}
                              barGap={5}
                            >
                              <CartesianGrid
                                strokeDasharray="3 4"
                                vertical={false}
                                stroke="#ebeaf2"
                              />
                              <XAxis
                                dataKey="name"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: "#716a7e", fontSize: 12 }}
                                dy={7}
                              />
                              <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: "#716a7e", fontSize: 11 }}
                                tickFormatter={(v) => `${v / 1000}k`}
                              />
                              <Tooltip
                                formatter={(v, n) => [
                                  fmt(Number(v)),
                                  n === "current" ? "対象月" : "前月",
                                ]}
                                cursor={{ fill: "#f6f4fb" }}
                              />
                              {hasPrev && (
                                <Bar
                                  isAnimationActive={false}
                                  dataKey="previous"
                                  fill={colors[1]}
                                  radius={[4, 4, 0, 0]}
                                  maxBarSize={36}
                                >
                                  <LabelList
                                    dataKey="previous"
                                    position="top"
                                    formatter={(v) => fmt(Number(v))}
                                    style={{ fontSize: 10, fill: "#77718b" }}
                                  />
                                </Bar>
                              )}
                              <Bar
                                isAnimationActive={false}
                                dataKey="current"
                                fill={colors[0]}
                                radius={[4, 4, 0, 0]}
                                maxBarSize={36}
                              >
                                <LabelList
                                  dataKey="current"
                                  position="top"
                                  formatter={(v) => fmt(Number(v))}
                                  style={{ fontSize: 10, fill: "#6547ba" }}
                                />
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </>,
                      )}
                      {chart(
                        "disease-chart",
                        "疾患群別 実施単位の内訳",
                        "対象月の疾患構成を病棟ごとに見る",
                        <>
                          <div className="chart-legend">
                            {wardOptions
                              .filter((w) => !wards.length || wards.includes(w))
                              .map((w, i) => (
                                <span key={w}>
                                  <i
                                    style={{
                                      background: colors[i % colors.length],
                                    }}
                                  />
                                  {w}
                                </span>
                              ))}
                          </div>
                          <ResponsiveContainer width="100%" height={205}>
                            <BarChart
                              layout="vertical"
                              data={diseaseData}
                              margin={{
                                top: 10,
                                right: 20,
                                bottom: 0,
                                left: 10,
                              }}
                            >
                              <CartesianGrid
                                strokeDasharray="3 4"
                                horizontal={false}
                                stroke="#ebeaf2"
                              />
                              <XAxis
                                type="number"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: "#716a7e", fontSize: 11 }}
                              />
                              <YAxis
                                type="category"
                                dataKey="name"
                                axisLine={false}
                                tickLine={false}
                                width={84}
                                tick={{ fill: "#655e79", fontSize: 12 }}
                              />
                              <Tooltip formatter={(v) => fmt(Number(v))} />
                              {wardOptions
                                .filter(
                                  (w) => !wards.length || wards.includes(w),
                                )
                                .map((w, i) => (
                                  <Bar
                                    isAnimationActive={false}
                                    key={w}
                                    stackId="ward"
                                    dataKey={w}
                                    fill={colors[i % colors.length]}
                                    maxBarSize={28}
                                  />
                                ))}
                            </BarChart>
                          </ResponsiveContainer>
                        </>,
                      )}
                      <section className="panel insight-card">
                        <div className="insight-heading">
                          <span className="insight-icon">
                            <Sparkles size={18} />
                          </span>
                          <div>
                            <h3>数字から見えてくること</h3>
                            <p>ルールで生成したコメント候補</p>
                          </div>
                          <span className="review-label">要確認</span>
                        </div>
                        <span className="trend-pill">
                          実施単位は{generated.trend}
                        </span>
                        <p className="insight-text">
                          {generated.candidate || generated.fact}
                        </p>
                        <div className="insight-note">
                          原因の解釈は、稼働日・人員・患者構成などを確認してから。
                        </div>
                        <button
                          className="insight-link"
                          onClick={() => setTab("report")}
                        >
                          コメントを確認・編集する
                          <ArrowRight size={16} />
                        </button>
                      </section>
                    </div>
                    <section className="panel detail-panel">
                      <div className="panel-head">
                        <div>
                          <h3>実績の明細</h3>
                          <p>{monthLabel(month)} · 病棟 × 疾患群</p>
                        </div>
                        <span className="row-count">{current.length}件</span>
                      </div>
                      <div className="table-scroll">
                        <table>
                          <thead>
                            <tr>
                              {(["病棟", "疾患群", ...numeric] as const).map(
                                (k) => (
                                  <th key={k}>
                                    <button
                                      onClick={() =>
                                        setSort({
                                          key: k,
                                          asc:
                                            sort.key === k ? !sort.asc : true,
                                        })
                                      }
                                    >
                                      {k}
                                      <span>
                                        {sort.key === k
                                          ? sort.asc
                                            ? "↑"
                                            : "↓"
                                          : "↕"}
                                      </span>
                                    </button>
                                  </th>
                                ),
                              )}
                            </tr>
                          </thead>
                          <tbody>
                            {sorted
                              .slice(detailPage * 50, (detailPage + 1) * 50)
                              .map((r, i) => (
                                <tr key={i}>
                                  {(
                                    ["病棟", "疾患群", ...numeric] as const
                                  ).map((k) => (
                                    <td key={k}>
                                      {typeof r[k] === "number"
                                        ? fmt(r[k] as number)
                                        : r[k]}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                          </tbody>
                          <tfoot>
                            <tr>
                              <td colSpan={2}>対象月の合計</td>
                              {numeric.map((k) => (
                                <td key={k}>{fmt(a[k])}</td>
                              ))}
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                      {current.length > 50 && (
                        <div className="table-pagination">
                          <span>
                            {detailPage * 50 + 1}–
                            {Math.min((detailPage + 1) * 50, current.length)} /{" "}
                            {current.length}件（合計は全行）
                          </span>
                          <button
                            disabled={detailPage === 0}
                            onClick={() => setDetailPage((p) => p - 1)}
                          >
                            前へ
                          </button>
                          <button
                            disabled={(detailPage + 1) * 50 >= current.length}
                            onClick={() => setDetailPage((p) => p + 1)}
                          >
                            次へ
                          </button>
                        </div>
                      )}
                    </section>
                  </div>
                  {tab === "report" && (
                    <div className="report-layout">
                      <section className="panel preview-panel">
                        <div className="panel-head">
                          <div>
                            <h3>月報プレビュー</h3>
                            <p>16:9 / 全5枚 / 編集可能なグラフ</p>
                          </div>
                          <span className="row-count">{preview + 1} / 5</span>
                        </div>
                        <div className="slide-preview">
                          <div className="slide-eyebrow">
                            REHAB REPORT STUDIO
                          </div>
                          <h2>
                            {
                              [
                                "リハ科 月次レポート",
                                "今月のサマリー",
                                "月別 実施単位の推移",
                                "病棟別 前月との比較",
                                "疾患群別 実施単位の内訳",
                              ][preview]
                            }
                          </h2>
                          {preview === 0 ? (
                            <>
                              <div className="cover-month">
                                {monthLabel(month)}
                              </div>
                              <p>数字は自動、解釈は人。</p>
                              <small>{scope}</small>
                            </>
                          ) : preview === 1 ? (
                            <>
                              <div className="preview-metrics">
                                <div>
                                  <small>実施単位</small>
                                  <strong>{fmt(a.実施単位)}</strong>
                                </div>
                                <div>
                                  <small>患者数</small>
                                  <strong>
                                    {fmt(a.患者数)}
                                    <em>人</em>
                                  </strong>
                                </div>
                                <div>
                                  <small>自宅退院率</small>
                                  <strong>
                                    {fmt(a.rate, 1)}
                                    <em>%</em>
                                  </strong>
                                </div>
                              </div>
                              <p className="preview-comment">{edit.fact}</p>
                            </>
                          ) : (
                            <div className="preview-graph">
                              {preview === 2 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                  <LineChart data={trend}>
                                    <XAxis dataKey="name" />
                                    <YAxis
                                      tickFormatter={(v) => `${v / 1000}k`}
                                    />
                                    <CartesianGrid vertical={false} />
                                    <Line
                                      isAnimationActive={false}
                                      dataKey="units"
                                      stroke={colors[0]}
                                      strokeWidth={3}
                                    />
                                  </LineChart>
                                </ResponsiveContainer>
                              ) : preview === 3 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                  <BarChart data={wardData}>
                                    <XAxis dataKey="name" />
                                    <YAxis />
                                    {hasPrev && (
                                      <Bar
                                        isAnimationActive={false}
                                        dataKey="previous"
                                        fill={colors[1]}
                                      />
                                    )}
                                    <Bar
                                      isAnimationActive={false}
                                      dataKey="current"
                                      fill={colors[0]}
                                    />
                                  </BarChart>
                                </ResponsiveContainer>
                              ) : (
                                <ResponsiveContainer width="100%" height="100%">
                                  <BarChart
                                    data={diseaseData}
                                    layout="vertical"
                                  >
                                    <XAxis type="number" />
                                    <YAxis
                                      type="category"
                                      dataKey="name"
                                      width={90}
                                    />
                                    {wardOptions.map((w, i) => (
                                      <Bar
                                        isAnimationActive={false}
                                        key={w}
                                        dataKey={w}
                                        stackId="a"
                                        fill={colors[i % colors.length]}
                                      />
                                    ))}
                                  </BarChart>
                                </ResponsiveContainer>
                              )}
                            </div>
                          )}
                          <div className="slide-foot">
                            {fake ? "研修用架空データ" : "リハ科 Report Studio"}
                            <span>{String(preview + 1).padStart(2, "0")}</span>
                          </div>
                        </div>
                        <div className="slide-tabs">
                          {[
                            "表紙",
                            "サマリー",
                            "月別推移",
                            "病棟別",
                            "疾患群別",
                          ].map((t, i) => (
                            <button
                              key={t}
                              className={preview === i ? "selected" : ""}
                              onClick={() => setPreview(i)}
                            >
                              <span>{String(i + 1).padStart(2, "0")}</span>
                              {t}
                            </button>
                          ))}
                        </div>
                        <div className="export-card">
                          <label className="confirmation">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => setChecked(e.target.checked)}
                            />
                            <span>
                              <strong>数値とコメントを確認した</strong>
                              <small>
                                出力する前に、集計の範囲と報告内容をご確認ください。
                              </small>
                            </span>
                          </label>
                          <div className="export-buttons">
                            <button
                              className="button primary"
                              disabled={!checked || busy}
                              onClick={pptx}
                            >
                              <ArrowDownToLine size={17} />
                              {busy ? "作成中…" : "PPTXを保存"}
                            </button>
                            <button
                              className="button secondary"
                              disabled={!checked}
                              onClick={() => window.print()}
                            >
                              <FileText size={17} />
                              PDFに保存
                            </button>
                            <button
                              className="button secondary"
                              disabled={!checked}
                              onClick={() => {
                                savePNG(
                                  [
                                    "trend-chart",
                                    "ward-chart",
                                    "disease-chart",
                                  ][Math.max(0, preview - 2)],
                                  `実績グラフ_${month}.png`,
                                ).catch((e) => setNotice(e.message));
                              }}
                            >
                              <ArrowDownToLine size={17} />
                              PNG
                            </button>
                          </div>
                          {!checked && (
                            <p className="gate-hint">
                              数値とコメントを確認してください。
                            </p>
                          )}
                          <small className="pdf-note">
                            PDFは印刷画面で「PDFに保存」を選んでください。PNGは選択中のグラフ（表紙・サマリーでは月別推移）を保存します。
                          </small>
                        </div>
                      </section>
                      <section className="panel editor-panel">
                        <div className="panel-head">
                          <div>
                            <h3>報告コメントを整える</h3>
                            <p>ルール生成 / 原因の推測は含みません</p>
                          </div>
                          <span className="review-label">要確認</span>
                        </div>
                        {(
                          [
                            ["fact", "01", "事実", "数字と前月の変化を確認"],
                            [
                              "candidate",
                              "02",
                              "変化の候補",
                              "寄与は因果関係を示すものではありません",
                            ],
                            ["check", "03", "要確認", "追加確認する観点を記録"],
                          ] as const
                        ).map(([k, n, t, desc]) => (
                          <label className="comment-field" key={k}>
                            <span className="comment-title">
                              <span>{n}</span>
                              {t}
                            </span>
                            <small>{desc}</small>
                            <textarea
                              value={edit[k]}
                              rows={k === "candidate" ? 5 : 4}
                              onChange={(e) => {
                                setEdit({ ...edit, [k]: e.target.value });
                                setChecked(false);
                              }}
                            />
                          </label>
                        ))}
                        <button
                          className="text-button"
                          onClick={() => {
                            setEdit({
                              fact: generated.fact,
                              candidate: generated.candidate,
                              check: generated.check,
                            });
                            setChecked(false);
                          }}
                        >
                          <RotateCcw size={13} />
                          自動生成された文に戻す
                        </button>
                      </section>
                    </div>
                  )}
                  <div className="print-disclosure">
                    {monthLabel(month)} · {scope}
                    {fake ? " · 研修用架空データ" : ""}
                  </div>
                  <div className="print-report">
                    <h1>リハ科 月次レポート · {monthLabel(month)}</h1>
                    <p>{scope}</p>
                    <div className="print-metrics">
                      {metrics.map((m) => (
                        <div key={m.label}>
                          {m.label}
                          <strong>
                            {m.value} {m.unit}
                          </strong>
                        </div>
                      ))}
                    </div>
                    <h2>事実</h2>
                    <p>{edit.fact}</p>
                    <h2>変化の候補（要確認）</h2>
                    <p>{edit.candidate || "候補なし"}</p>
                    <h2>要確認</h2>
                    <p>{edit.check}</p>
                    {fake && <p>研修用架空データ</p>}
                  </div>
                </>
              )}
            </>
          )}
          {notice && (
            <div className="notice" role="status">
              {notice}
              <button onClick={() => setNotice("")} aria-label="通知を閉じる">
                <X size={16} />
              </button>
            </div>
          )}
          <footer>
            <span>
              <ShieldCheck size={14} />
              データの外部送信・保存は行いません。再読み込みでデータは消去されます。
            </span>
            <span>{fake ? "研修用架空データ · " : ""}REHAB REPORT STUDIO</span>
          </footer>
        </main>
      </div>
    </>
  );
}
function MultiSelect({
  title,
  options,
  selected,
  onChange,
}: {
  title: string;
  options: string[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function close(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);
  return (
    <div className="multi-select" ref={ref}>
      <span>{title}</span>
      <button
        className="select-trigger"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {selected.length ? `${selected.length}件を選択` : `すべての${title}`}
        <ChevronDown size={14} />
      </button>
      {open && (
        <div
          className="select-menu"
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
          }}
        >
          <label>
            <input
              type="checkbox"
              checked={!selected.length}
              onChange={() => onChange([])}
            />
            すべて
          </label>
          {options.map((o) => (
            <label key={o}>
              <input
                type="checkbox"
                checked={selected.includes(o)}
                onChange={() =>
                  onChange(
                    selected.includes(o)
                      ? selected.filter((v) => v !== o)
                      : [...selected, o],
                  )
                }
              />
              {o}
            </label>
          ))}
          <button onClick={() => setOpen(false)}>
            完了
            <Check size={13} />
          </button>
        </div>
      )}
    </div>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
