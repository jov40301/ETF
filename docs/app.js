// === 設定你的 Cloudflare Worker 網址 ===
const WORKER_BASE = "https://ticker-worker.jov40301.workers.dev";

const YEARS = ["1", "3", "5"]; // 固定顯示 1/3/5 年

const $ = (id) => document.getElementById(id);

function setText(id, v) {
  const el = $(id);
  if (el) el.textContent = v;
}

function fmtNum(n) {
  if (n === null || n === undefined) return "—";
  if (typeof n !== "number" || Number.isNaN(n)) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function fmtMoneyLike(n) {
  if (n === null || n === undefined) return "—";
  if (typeof n !== "number" || Number.isNaN(n)) return "—";
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function setStatus(msg, type = "info") {
  const el = $("status");
  if (!el) return;
  el.textContent = msg;
  el.classList.remove("ok", "err");
  if (type === "ok") el.classList.add("ok");
  if (type === "err") el.classList.add("err");
}

function setPill() {
  const pill = $("pill");
  if (!pill) return;
  pill.textContent = WORKER_BASE ? `API：${WORKER_BASE}` : "API：未設定";
}
setPill();

const goBtn = $("go");
const symbolInput = $("symbol");

if (goBtn) goBtn.addEventListener("click", () => run());
if (symbolInput) symbolInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") run();
});

function clearYear(y) {
  setText(`c5-${y}y`, "—");
  setText(`a5-${y}y`, "—");
  setText(`c10-${y}y`, "—");
  setText(`a10-${y}y`, "—");
  setText(`badge-${y}y`, "—");
}

function fillYear(y, bucket, cacheHint) {
  // 後端預期 bucket: { count5, count10, avgClose5, avgClose10 }
  setText(`c5-${y}y`, fmtNum(bucket?.count5));
  setText(`a5-${y}y`, fmtMoneyLike(bucket?.avgClose5));
  setText(`c10-${y}y`, fmtNum(bucket?.count10));
  setText(`a10-${y}y`, fmtMoneyLike(bucket?.avgClose10));
  setText(`badge-${y}y`, `cache ${cacheHint}`);
}

async function run() {
  const symbol = (symbolInput ? symbolInput.value : "").trim();

  if (!symbol) {
    setStatus("狀態：請先輸入代號（例如 0050.TW 或 VOO）", "err");
    return;
  }
  if (!WORKER_BASE) {
    setStatus("狀態：尚未設定 WORKER_BASE（請在 app.js 內設定你的 Worker 網址）", "err");
    return;
  }

  if (goBtn) goBtn.disabled = true;
  setStatus(`狀態：查詢中…\n${WORKER_BASE}/api?symbol=${encodeURIComponent(symbol)}`);

  YEARS.forEach(clearYear);

  try {
    const url = `${WORKER_BASE}/api?symbol=${encodeURIComponent(symbol)}`;
    const resp = await fetch(url, { cache: "no-store" });
    const cacheHint = resp.headers.get("x-cache") || "—";

    const data = await resp.json();
    if (!resp.ok) throw new Error(data?.error || `HTTP ${resp.status}`);

    // meta：如果後端沒回傳也不會壞
    setText("range", data?.range ? `${data.range.start} ~ ${data.range.end}` : "—");
    setText("points", fmtNum(data?.points));
    setText("source", data?.source || "—");
    setText("generatedAt", data?.generatedAt || "—");

    let missing = [];

    for (const y of YEARS) {
      const bucket = data?.drop_vs_20d?.[y];
      if (!bucket) {
        missing.push(y);
        // 仍顯示 cache，但內容空
        setText(`badge-${y}y`, `cache ${cacheHint}`);
        continue;
      }
      fillYear(y, bucket, cacheHint);
    }

    if (missing.length > 0) {
      setStatus(
        `狀態：完成（部分區間資料不足）\nSymbol: ${data.symbol || symbol}\n缺少：近 ${missing.join(" / ")} 年\nCache: ${cacheHint}\nSource: ${data.source || "—"}`,
        "err"
      );
    } else {
      setStatus(
        `狀態：完成 \nSymbol: ${data.symbol || symbol}\nCache: ${cacheHint}\nSource: ${data.source || "—"}`,
        "ok"
      );
    }
  } catch (e) {
    setStatus(`狀態：發生錯誤 \n${String(e.message || e)}`, "err");
  } finally {
    if (goBtn) goBtn.disabled = false;
  }
}