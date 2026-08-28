const CATEGORIES = [
  { id: "groceries", label: "Продукты", icon: "🛒", color: "#f2a65a" },
  { id: "restaurants", label: "Рестораны", icon: "🍽", color: "#e85d75" },
  { id: "delivery", label: "Доставка", icon: "🛵", color: "#f7d060" },
  { id: "transport", label: "Транспорт", icon: "🚕", color: "#6fcf97" },
  { id: "fuel", label: "АЗС", icon: "⛽", color: "#56ccf2" },
  { id: "home", label: "Жильё", icon: "🏠", color: "#bb86fc" },
  { id: "fun", label: "Развлечения", icon: "🎮", color: "#ff8c69" },
  { id: "health", label: "Здоровье", icon: "💊", color: "#4dd0e1" },
  { id: "shopping", label: "Покупки", icon: "🛍", color: "#ffb74d" },
  { id: "other", label: "Прочее", icon: "✨", color: "#9aa0a6" },
];

const CATEGORY_ORDER = CATEGORIES.map((c) => c.id);
const CATEGORY_LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.label]));
const CATEGORY_ICON = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.icon]));
const CATEGORY_COLOR = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.color]));

const CURRENCIES = ["GEL", "USD", "THB", "EUR"];
const CURRENCY_SYMBOLS = { GEL: "₾", USD: "$", THB: "฿", EUR: "€" };
const FALLBACK_RATES_USD = { USD: 1, GEL: 2.7, THB: 34, EUR: 0.92 };
const MONTH_NAMES = ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];
const DOW = ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"];
const SVG_NS = "http://www.w3.org/2000/svg";

const SUPABASE_URL = "https://ajygagwlupjmbffayeir.supabase.co";
const SUPABASE_KEY = "sb_publishable_cp1xhLHSdYKR8RAtq4Zi_A_uSPbahMg";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

function resolveUserId() {
  const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
  if (tgUser?.id) return tgUser.id;
  let debugId = localStorage.getItem("debug_user_id");
  if (!debugId) {
    debugId = Math.floor(Math.random() * 1e9);
    localStorage.setItem("debug_user_id", debugId);
  }
  return Number(debugId);
}

const userId = resolveUserId();

let entries = [];
let periodType = "month";
let periodAnchor = new Date();
let calendarMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let calendarSelectedDate = null;
let baseCurrency = localStorage.getItem("base_currency") || "USD";
let ratesUSD = { ...FALLBACK_RATES_USD };
let formCategory = CATEGORIES[0].id;

async function loadEntries() {
  const { data, error } = await supabaseClient
    .from("expenses")
    .select("*")
    .eq("telegram_user_id", userId);
  if (error) {
    console.error(error);
    return [];
  }
  return data;
}

async function fetchRates() {
  try {
    const symbols = CURRENCIES.filter((c) => c !== "USD").join(",");
    const res = await fetch(`https://api.frankfurter.dev/v1/latest?base=USD&symbols=${symbols}`);
    if (!res.ok) return;
    const data = await res.json();
    ratesUSD = { USD: 1, ...FALLBACK_RATES_USD, ...data.rates };
  } catch {
    // офлайн / нет сети — остаёмся на фолбэк-курсах
  }
}

function convert(amount, from, to) {
  if (from === to) return amount;
  const usd = amount / (ratesUSD[from] || 1);
  return usd * (ratesUSD[to] || 1);
}

function formatMoney(amount, currency) {
  const symbol = CURRENCY_SYMBOLS[currency] || currency;
  return `${amount.toFixed(2)} ${symbol}`;
}

function dateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function entriesInRange(start, end) {
  return entries.filter((e) => e.date >= start && e.date <= end);
}

function getPeriodRange(type, anchor) {
  if (type === "week") {
    const dow = (anchor.getDay() + 6) % 7;
    const start = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() - dow);
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
    return { start: dateKey(start), end: dateKey(end) };
  }
  if (type === "year") {
    return { start: `${anchor.getFullYear()}-01-01`, end: `${anchor.getFullYear()}-12-31` };
  }
  const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  return { start: dateKey(start), end: dateKey(end) };
}

function shiftPeriod(dir) {
  if (periodType === "week") {
    periodAnchor = new Date(periodAnchor.getFullYear(), periodAnchor.getMonth(), periodAnchor.getDate() + dir * 7);
  } else if (periodType === "year") {
    periodAnchor = new Date(periodAnchor.getFullYear() + dir, periodAnchor.getMonth(), 1);
  } else {
    periodAnchor = new Date(periodAnchor.getFullYear(), periodAnchor.getMonth() + dir, 1);
  }
  renderMain();
}

function renderPeriodLabel() {
  const label = document.getElementById("period-label");
  if (periodType === "year") {
    label.textContent = String(periodAnchor.getFullYear());
    return;
  }
  if (periodType === "week") {
    const { start, end } = getPeriodRange("week", periodAnchor);
    const [, sm, sd] = start.split("-");
    const [, em, ed] = end.split("-");
    label.textContent =
      sm === em
        ? `${sd}–${ed} ${MONTH_NAMES[Number(sm) - 1].slice(0, 3)}`
        : `${sd} ${MONTH_NAMES[Number(sm) - 1].slice(0, 3)} – ${ed} ${MONTH_NAMES[Number(em) - 1].slice(0, 3)}`;
    return;
  }
  label.textContent = `${MONTH_NAMES[periodAnchor.getMonth()]} ${periodAnchor.getFullYear()}`;
}

function periodTotals() {
  const { start, end } = getPeriodRange(periodType, periodAnchor);
  const periodEntries = entriesInRange(start, end);
  const totals = {};
  let grandTotal = 0;
  periodEntries.forEach((e) => {
    const v = convert(e.amount, e.currency, baseCurrency);
    totals[e.category] = (totals[e.category] || 0) + v;
    grandTotal += v;
  });
  return { periodEntries, totals, grandTotal };
}

function renderSummary(grandTotal) {
  document.getElementById("period-total").textContent = formatMoney(grandTotal, baseCurrency);
}

function renderDonut(totals, grandTotal) {
  const svg = document.getElementById("donut-svg");
  const centerLabel = document.getElementById("donut-center-label");
  const R = 80;
  const CIRC = 2 * Math.PI * R;

  svg.innerHTML = "";
  const track = document.createElementNS(SVG_NS, "circle");
  track.setAttribute("cx", "100");
  track.setAttribute("cy", "100");
  track.setAttribute("r", String(R));
  track.setAttribute("class", "donut-track");
  svg.appendChild(track);

  if (grandTotal === 0) {
    centerLabel.textContent = "Нет трат за этот период";
    return;
  }

  const sortedCats = CATEGORY_ORDER.filter((id) => totals[id]).sort((a, b) => totals[b] - totals[a]);
  let cumulative = 0;

  sortedCats.forEach((id, index) => {
    const len = (totals[id] / grandTotal) * CIRC;
    const circle = document.createElementNS(SVG_NS, "circle");
    circle.setAttribute("cx", "100");
    circle.setAttribute("cy", "100");
    circle.setAttribute("r", String(R));
    circle.setAttribute("class", "donut-segment");
    circle.style.stroke = CATEGORY_COLOR[id];
    circle.style.strokeDasharray = `0 ${CIRC}`;
    circle.style.strokeDashoffset = String(-cumulative);
    svg.appendChild(circle);

    setTimeout(() => {
      requestAnimationFrame(() => {
        circle.style.strokeDasharray = `${len} ${CIRC - len}`;
      });
    }, index * 90);

    cumulative += len;
  });

  const count = periodTotals().periodEntries.length;
  centerLabel.textContent = `${count} ${pluralizeTrata(count)}`;
}

function pluralizeTrata(n) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "трата";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "траты";
  return "трат";
}

function renderCategoryPills(totals) {
  const wrap = document.getElementById("category-pills");
  const cats = CATEGORY_ORDER.filter((id) => totals[id]).sort((a, b) => totals[b] - totals[a]);

  if (!cats.length) {
    wrap.innerHTML = '<div class="empty-hint">Пока нет трат за этот период</div>';
    return;
  }

  wrap.innerHTML = cats
    .map(
      (id) => `
    <div class="pill">
      <span class="pill__icon" style="background:${CATEGORY_COLOR[id]}33;color:${CATEGORY_COLOR[id]}">${CATEGORY_ICON[id]}</span>
      <span class="pill__label">${CATEGORY_LABEL[id]}</span>
      <span class="pill__amount">${formatMoney(totals[id], baseCurrency)}</span>
    </div>`
    )
    .join("");
}

function entryRowHtml(e) {
  return `
    <div class="entry">
      <div class="entry__icon">${CATEGORY_ICON[e.category] || "✨"}</div>
      <div class="entry__body">
        <div class="entry__category">${CATEGORY_LABEL[e.category] || "Прочее"}</div>
        ${e.note ? `<div class="entry__note">${escapeHtml(e.note)}</div>` : ""}
      </div>
      <div class="entry__amount">${formatMoney(e.amount, e.currency)}</div>
      <button class="entry__delete" data-id="${e.id}">✕</button>
    </div>`;
}

function bindDeleteButtons(container) {
  container.querySelectorAll(".entry__delete").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = Number(btn.dataset.id);
      const { error } = await supabaseClient.from("expenses").delete().eq("id", id);
      if (error) {
        console.error(error);
        return;
      }
      entries = entries.filter((e) => e.id !== id);
      renderAll();
    });
  });
}

function renderPeriodEntries(periodEntries) {
  const list = document.getElementById("entries-list");
  const items = periodEntries.slice().sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);

  if (!items.length) {
    list.innerHTML = '<div class="empty-hint">Ничего не найдено</div>';
    return;
  }

  list.innerHTML = items.map(entryRowHtml).join("");
  bindDeleteButtons(list);
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function renderMain() {
  renderPeriodLabel();
  const { periodEntries, totals, grandTotal } = periodTotals();
  renderSummary(grandTotal);
  renderDonut(totals, grandTotal);
  renderCategoryPills(totals);
  renderPeriodEntries(periodEntries);
}

function calendarEntriesForMonth(month) {
  const prefix = dateKey(month).slice(0, 7);
  return entries.filter((e) => e.date.startsWith(prefix));
}

function renderCalendarGrid() {
  const cal = document.getElementById("calendar");
  cal.innerHTML = "";

  DOW.forEach((d) => {
    const el = document.createElement("div");
    el.className = "cal-dow";
    el.textContent = d;
    cal.appendChild(el);
  });

  const y = calendarMonth.getFullYear();
  const m = calendarMonth.getMonth();
  const firstDay = new Date(y, m, 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const todayKey = dateKey(new Date());

  const spendByDay = {};
  calendarEntriesForMonth(calendarMonth).forEach((e) => {
    spendByDay[e.date] = (spendByDay[e.date] || 0) + convert(e.amount, e.currency, baseCurrency);
  });

  for (let i = 0; i < startOffset; i++) {
    const el = document.createElement("div");
    el.className = "cal-day empty";
    cal.appendChild(el);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(y, m, day);
    const key = dateKey(d);
    const el = document.createElement("div");
    el.className = "cal-day";
    if (spendByDay[key]) el.classList.add("has-spend");
    if (key === todayKey) el.classList.add("today");
    if (key === calendarSelectedDate) el.classList.add("selected");
    el.innerHTML = `${day}<span class="dot"></span>`;
    el.addEventListener("click", () => {
      calendarSelectedDate = calendarSelectedDate === key ? null : key;
      renderCalendarScreen();
    });
    cal.appendChild(el);
  }
}

function renderCalendarEntriesList() {
  const list = document.getElementById("calendar-entries-list");
  const title = document.getElementById("calendar-entries-title");
  let items = calendarEntriesForMonth(calendarMonth);

  if (calendarSelectedDate) {
    items = items.filter((e) => e.date === calendarSelectedDate);
    title.textContent = "Траты за " + calendarSelectedDate.split("-").reverse().join(".");
  } else {
    title.textContent = "Все траты за месяц";
  }

  items = items.slice().sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);

  if (!items.length) {
    list.innerHTML = '<div class="empty-hint">Ничего не найдено</div>';
    return;
  }

  list.innerHTML = items.map(entryRowHtml).join("");
  bindDeleteButtons(list);
}

function renderCalendarScreen() {
  document.getElementById("calendar-month-label").textContent =
    `${MONTH_NAMES[calendarMonth.getMonth()]} ${calendarMonth.getFullYear()}`;
  renderCalendarGrid();
  renderCalendarEntriesList();
}

function renderAll() {
  renderMain();
  renderCalendarScreen();
}

function setupPeriodTabs() {
  document.querySelectorAll(".period-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      periodType = tab.dataset.period;
      document.querySelectorAll(".period-tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      renderMain();
    });
  });
}

function setupPeriodNav() {
  document.getElementById("prev-period").addEventListener("click", () => shiftPeriod(-1));
  document.getElementById("next-period").addEventListener("click", () => shiftPeriod(1));
}

function setupCalendarScreen() {
  document.getElementById("open-calendar").addEventListener("click", () => {
    calendarMonth = new Date(periodAnchor.getFullYear(), periodAnchor.getMonth(), 1);
    calendarSelectedDate = null;
    renderCalendarScreen();
    document.getElementById("calendar-screen").classList.remove("hidden");
  });
  document.getElementById("calendar-back").addEventListener("click", () => {
    document.getElementById("calendar-screen").classList.add("hidden");
  });
  document.getElementById("prev-cal-month").addEventListener("click", () => {
    calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1);
    calendarSelectedDate = null;
    renderCalendarScreen();
  });
  document.getElementById("next-cal-month").addEventListener("click", () => {
    calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1);
    calendarSelectedDate = null;
    renderCalendarScreen();
  });
}

function setupCurrencySelects() {
  const baseSelect = document.getElementById("base-currency");
  const inputCurrency = document.getElementById("input-currency");
  CURRENCIES.forEach((c) => {
    const o1 = document.createElement("option");
    o1.value = c;
    o1.textContent = c;
    baseSelect.appendChild(o1);

    const o2 = document.createElement("option");
    o2.value = c;
    o2.textContent = c;
    inputCurrency.appendChild(o2);
  });
  baseSelect.value = baseCurrency;
  baseSelect.addEventListener("change", () => {
    baseCurrency = baseSelect.value;
    localStorage.setItem("base_currency", baseCurrency);
    renderAll();
  });
}

function setupCategoryPicker() {
  const picker = document.getElementById("category-picker");
  picker.innerHTML = "";
  CATEGORIES.forEach((c) => {
    const chip = document.createElement("div");
    chip.className = "category-chip" + (c.id === formCategory ? " active" : "");
    chip.textContent = `${c.icon} ${c.label}`;
    chip.addEventListener("click", () => {
      formCategory = c.id;
      picker.querySelectorAll(".category-chip").forEach((el) => el.classList.remove("active"));
      chip.classList.add("active");
    });
    picker.appendChild(chip);
  });
}

function openAddSheet() {
  document.getElementById("input-amount").value = "";
  document.getElementById("input-note").value = "";
  document.getElementById("input-date").value = dateKey(new Date());
  document.getElementById("input-currency").value = baseCurrency;
  formCategory = CATEGORIES[0].id;
  setupCategoryPicker();
  document.getElementById("add-overlay").classList.remove("hidden");
}

function closeAddSheet() {
  document.getElementById("add-overlay").classList.add("hidden");
}

async function confirmAdd() {
  const amount = parseFloat(document.getElementById("input-amount").value);
  if (!amount || amount <= 0) return;

  const { data, error } = await supabaseClient
    .from("expenses")
    .insert({
      telegram_user_id: userId,
      amount,
      currency: document.getElementById("input-currency").value,
      category: formCategory,
      date: document.getElementById("input-date").value,
      note: document.getElementById("input-note").value.trim(),
    })
    .select()
    .single();

  if (error) {
    console.error(error);
    return;
  }

  entries.push(data);
  closeAddSheet();
  renderAll();
}

function setupAddSheet() {
  document.getElementById("fab-add").addEventListener("click", openAddSheet);
  document.getElementById("cancel-add").addEventListener("click", closeAddSheet);
  document.getElementById("confirm-add").addEventListener("click", confirmAdd);
  document.getElementById("add-overlay").addEventListener("click", (e) => {
    if (e.target.id === "add-overlay") closeAddSheet();
  });
}

function initTelegramWebApp() {
  const tg = window.Telegram?.WebApp;
  if (!tg) return;
  tg.ready();
  tg.expand();
}

function applyTelegramThemeParams() {
  const tg = window.Telegram?.WebApp;
  if (!tg) return;
  const p = tg.themeParams || {};
  const root = document.documentElement.style;
  if (p.bg_color) root.setProperty("--bg", p.bg_color);
  if (p.text_color) root.setProperty("--text", p.text_color);
  if (p.hint_color) root.setProperty("--text-dim", p.hint_color);
  if (p.secondary_bg_color) root.setProperty("--surface", p.secondary_bg_color);
}

function clearInlineThemeVars() {
  const root = document.documentElement.style;
  ["--bg", "--text", "--text-dim", "--surface"].forEach((v) => root.removeProperty(v));
}

function applyTheme(theme) {
  if (theme === "auto") {
    document.documentElement.removeAttribute("data-theme");
    applyTelegramThemeParams();
  } else {
    clearInlineThemeVars();
    document.documentElement.setAttribute("data-theme", theme);
  }
}

let settings = { display_name: "", start_screen: "overview", theme: "auto", is_premium: false };

async function loadSettings() {
  const { data } = await supabaseClient
    .from("user_settings")
    .select("*")
    .eq("telegram_user_id", userId)
    .maybeSingle();
  return data || { display_name: "", start_screen: "overview", theme: "auto", is_premium: false };
}

async function saveSettings() {
  await supabaseClient.from("user_settings").upsert({
    telegram_user_id: userId,
    display_name: settings.display_name,
    start_screen: settings.start_screen,
    theme: settings.theme,
  });
}

function renderPremiumSection() {
  const wrap = document.getElementById("premium-section");
  if (settings.is_premium) {
    wrap.innerHTML = `
      <div class="empty-hint">✅ Премиум активен</div>
      <button id="export-csv-btn" class="btn btn--primary" style="margin-top:8px;width:100%">Экспортировать в CSV</button>
    `;
    document.getElementById("export-csv-btn").addEventListener("click", exportCsv);
  } else {
    wrap.innerHTML = `<button id="buy-premium-btn" class="btn btn--primary" style="width:100%">💎 Экспорт в CSV — 1 ⭐</button>`;
    document.getElementById("buy-premium-btn").addEventListener("click", buyPremium);
  }
}

async function buyPremium() {
  const tg = window.Telegram?.WebApp;
  if (!tg?.openInvoice) {
    alert("Оплата доступна только внутри Telegram");
    return;
  }

  const res = await fetch("/api/create-invoice", { method: "POST" });
  const data = await res.json();
  if (!data.link) {
    alert("Не получилось создать счёт на оплату");
    return;
  }

  tg.openInvoice(data.link, (status) => {
    if (status === "paid") {
      settings.is_premium = true;
      renderPremiumSection();
    }
  });
}

function exportCsv() {
  const rows = [["Дата", "Категория", "Сумма", "Валюта", "Заметка"]];
  entries.forEach((e) => {
    rows.push([e.date, CATEGORY_LABEL[e.category] || e.category, e.amount, e.currency, e.note || ""]);
  });
  const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "expenses.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function renderHeaderTitle() {
  document.getElementById("header-title").textContent = settings.display_name
    ? `Привет, ${settings.display_name}`
    : "Расходы";
}

function setSegmentedValue(containerId, value) {
  document.querySelectorAll(`#${containerId} .period-tab`).forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.value === value);
  });
}

function setupSettingsScreen() {
  document.getElementById("open-settings").addEventListener("click", () => {
    document.getElementById("settings-name").value = settings.display_name || "";
    setSegmentedValue("settings-start-screen", settings.start_screen);
    setSegmentedValue("settings-theme", settings.theme);
    renderPremiumSection();
    document.getElementById("settings-screen").classList.remove("hidden");
  });

  document.getElementById("settings-back").addEventListener("click", () => {
    document.getElementById("settings-screen").classList.add("hidden");
  });

  document.getElementById("settings-name").addEventListener("change", async (e) => {
    settings.display_name = e.target.value.trim();
    renderHeaderTitle();
    await saveSettings();
  });

  document.querySelectorAll("#settings-start-screen .period-tab").forEach((btn) => {
    btn.addEventListener("click", async () => {
      settings.start_screen = btn.dataset.value;
      setSegmentedValue("settings-start-screen", settings.start_screen);
      await saveSettings();
    });
  });

  document.querySelectorAll("#settings-theme .period-tab").forEach((btn) => {
    btn.addEventListener("click", async () => {
      settings.theme = btn.dataset.value;
      setSegmentedValue("settings-theme", settings.theme);
      applyTheme(settings.theme);
      await saveSettings();
    });
  });
}

async function init() {
  initTelegramWebApp();
  setupCurrencySelects();
  setupPeriodTabs();
  setupPeriodNav();
  setupCalendarScreen();
  setupSettingsScreen();
  setupAddSheet();

  const [, , loadedSettings] = await Promise.all([
    fetchRates(),
    loadEntries().then((data) => { entries = data; }),
    loadSettings(),
  ]);
  settings = loadedSettings;

  applyTheme(settings.theme);
  renderHeaderTitle();
  renderAll();

  if (settings.start_screen === "calendar") {
    calendarMonth = new Date(periodAnchor.getFullYear(), periodAnchor.getMonth(), 1);
    renderCalendarScreen();
    document.getElementById("calendar-screen").classList.remove("hidden");
  }
}

init();
