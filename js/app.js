const CATEGORIES = [
  { id: "groceries", label: "Продукты", icon: "🛒" },
  { id: "restaurants", label: "Рестораны", icon: "🍽" },
  { id: "delivery", label: "Доставка", icon: "🛵" },
  { id: "transport", label: "Транспорт", icon: "🚕" },
  { id: "home", label: "Жильё", icon: "🏠" },
  { id: "fun", label: "Развлечения", icon: "🎮" },
  { id: "health", label: "Здоровье", icon: "💊" },
  { id: "shopping", label: "Покупки", icon: "🛍" },
  { id: "other", label: "Прочее", icon: "✨" },
];

const CURRENCIES = ["GEL", "USD", "THB", "EUR"];
const CURRENCY_SYMBOLS = { GEL: "₾", USD: "$", THB: "฿", EUR: "€" };
const FALLBACK_RATES_USD = { USD: 1, GEL: 2.7, THB: 34, EUR: 0.92 };
const MONTH_NAMES = ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];
const DOW = ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"];

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
let currentMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let selectedDate = null;
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

function entriesForMonth(month) {
  const prefix = dateKey(month).slice(0, 7);
  return entries.filter((e) => e.date.startsWith(prefix));
}

function renderMonthLabel() {
  document.getElementById("month-label").textContent =
    `${MONTH_NAMES[currentMonth.getMonth()]} ${currentMonth.getFullYear()}`;
}

function renderSummary() {
  const monthEntries = entriesForMonth(currentMonth);
  const total = monthEntries.reduce((sum, e) => sum + convert(e.amount, e.currency, baseCurrency), 0);
  document.getElementById("month-total").textContent = formatMoney(total, baseCurrency);
}

function renderCalendar() {
  const cal = document.getElementById("calendar");
  cal.innerHTML = "";

  DOW.forEach((d) => {
    const el = document.createElement("div");
    el.className = "cal-dow";
    el.textContent = d;
    cal.appendChild(el);
  });

  const y = currentMonth.getFullYear();
  const m = currentMonth.getMonth();
  const firstDay = new Date(y, m, 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const todayKey = dateKey(new Date());

  const spendByDay = {};
  entriesForMonth(currentMonth).forEach((e) => {
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
    if (key === selectedDate) el.classList.add("selected");
    el.innerHTML = `${day}<span class="dot"></span>`;
    el.addEventListener("click", () => {
      selectedDate = selectedDate === key ? null : key;
      renderCalendar();
      renderEntries();
    });
    cal.appendChild(el);
  }
}

function renderCategoryChart() {
  const wrap = document.getElementById("category-chart");
  const monthEntries = entriesForMonth(currentMonth);

  if (!monthEntries.length) {
    wrap.innerHTML = '<div class="empty-hint">Пока нет трат в этом месяце</div>';
    return;
  }

  const totals = {};
  monthEntries.forEach((e) => {
    totals[e.category] = (totals[e.category] || 0) + convert(e.amount, e.currency, baseCurrency);
  });

  const max = Math.max(...Object.values(totals));

  wrap.innerHTML = "";
  CATEGORIES.filter((c) => totals[c.id]).sort((a, b) => totals[b.id] - totals[a.id]).forEach((c) => {
    const row = document.createElement("div");
    row.className = "category-row";
    const pct = (totals[c.id] / max) * 100;
    row.innerHTML = `
      <div class="category-row__label">${c.icon} ${c.label}</div>
      <div class="category-row__bar-wrap"><div class="category-row__bar" style="width:${pct}%"></div></div>
      <div class="category-row__amount">${formatMoney(totals[c.id], baseCurrency)}</div>
    `;
    wrap.appendChild(row);
  });
}

function renderEntries() {
  const list = document.getElementById("entries-list");
  const title = document.getElementById("entries-title");
  let items = entriesForMonth(currentMonth);

  if (selectedDate) {
    items = items.filter((e) => e.date === selectedDate);
    title.textContent = "Траты за " + selectedDate.split("-").reverse().join(".");
  } else {
    title.textContent = "Все траты за месяц";
  }

  items = items.slice().sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);

  if (!items.length) {
    list.innerHTML = '<div class="empty-hint">Ничего не найдено</div>';
    return;
  }

  list.innerHTML = "";
  items.forEach((e) => {
    const cat = CATEGORIES.find((c) => c.id === e.category) || CATEGORIES[CATEGORIES.length - 1];
    const row = document.createElement("div");
    row.className = "entry";
    row.innerHTML = `
      <div class="entry__icon">${cat.icon}</div>
      <div class="entry__body">
        <div class="entry__category">${cat.label}</div>
        ${e.note ? `<div class="entry__note">${escapeHtml(e.note)}</div>` : ""}
      </div>
      <div class="entry__amount">${formatMoney(e.amount, e.currency)}</div>
      <button class="entry__delete" data-id="${e.id}">✕</button>
    `;
    list.appendChild(row);
  });

  list.querySelectorAll(".entry__delete").forEach((btn) => {
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

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function renderAll() {
  renderMonthLabel();
  renderSummary();
  renderCalendar();
  renderCategoryChart();
  renderEntries();
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

function setupNav() {
  document.getElementById("prev-month").addEventListener("click", () => {
    currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
    selectedDate = null;
    renderAll();
  });
  document.getElementById("next-month").addEventListener("click", () => {
    currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
    selectedDate = null;
    renderAll();
  });
  document.getElementById("fab-add").addEventListener("click", openAddSheet);
  document.getElementById("cancel-add").addEventListener("click", closeAddSheet);
  document.getElementById("confirm-add").addEventListener("click", confirmAdd);
  document.getElementById("add-overlay").addEventListener("click", (e) => {
    if (e.target.id === "add-overlay") closeAddSheet();
  });
}

function applyTelegramTheme() {
  const tg = window.Telegram?.WebApp;
  if (!tg) return;
  tg.ready();
  tg.expand();
  const p = tg.themeParams || {};
  const root = document.documentElement.style;
  if (p.bg_color) root.setProperty("--bg", p.bg_color);
  if (p.text_color) root.setProperty("--text", p.text_color);
  if (p.hint_color) root.setProperty("--text-dim", p.hint_color);
  if (p.secondary_bg_color) root.setProperty("--surface", p.secondary_bg_color);
}

async function init() {
  applyTelegramTheme();
  setupCurrencySelects();
  setupNav();
  await Promise.all([fetchRates(), loadEntries().then((data) => { entries = data; })]);
  renderAll();
}

init();
