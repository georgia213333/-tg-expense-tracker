const CURRENCIES = ["GEL", "USD", "THB", "EUR", "RUB", "UAH"];
const CURRENCY_SYMBOLS = { GEL: "₾", USD: "$", THB: "฿", EUR: "€", RUB: "₽", UAH: "₴" };
const FALLBACK_RATES_USD = { USD: 1, GEL: 2.7, THB: 34, EUR: 0.92, RUB: 86, UAH: 44 };
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
let formCategory = CATEGORY_META[0].id;

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
    const res = await fetch("https://open.er-api.com/v6/latest/USD");
    if (!res.ok) return;
    const data = await res.json();
    if (data.result !== "success") return;
    ratesUSD = { ...FALLBACK_RATES_USD, ...data.rates };
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
    const names = monthNames();
    label.textContent =
      sm === em
        ? `${sd}–${ed} ${names[Number(sm) - 1].slice(0, 3)}`
        : `${sd} ${names[Number(sm) - 1].slice(0, 3)} – ${ed} ${names[Number(em) - 1].slice(0, 3)}`;
    return;
  }
  label.textContent = `${monthNames()[periodAnchor.getMonth()]} ${periodAnchor.getFullYear()}`;
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
    centerLabel.textContent = t("no_expenses_period");
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
  centerLabel.textContent = `${count} ${pluralize(count, t("expense_forms"))}`;
}

function renderCategoryPills(totals) {
  const wrap = document.getElementById("category-pills");
  const cats = CATEGORY_ORDER.filter((id) => totals[id]).sort((a, b) => totals[b] - totals[a]);

  if (!cats.length) {
    wrap.innerHTML = `<div class="empty-hint">${t("no_expenses_hint")}</div>`;
    return;
  }

  wrap.innerHTML = cats
    .map(
      (id) => `
    <div class="pill">
      <span class="pill__icon" style="background:${CATEGORY_COLOR[id]}33;color:${CATEGORY_COLOR[id]}">${CATEGORY_ICON[id]}</span>
      <span class="pill__label">${categoryLabel(id)}</span>
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
        <div class="entry__category">${categoryLabel(e.category)}</div>
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
    list.innerHTML = `<div class="empty-hint">${t("nothing_found")}</div>`;
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

  dowNames().forEach((d) => {
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
    title.textContent = t("expenses_for") + " " + calendarSelectedDate.split("-").reverse().join(".");
  } else {
    title.textContent = t("all_month_expenses");
  }

  items = items.slice().sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);

  if (!items.length) {
    list.innerHTML = `<div class="empty-hint">${t("nothing_found")}</div>`;
    return;
  }

  list.innerHTML = items.map(entryRowHtml).join("");
  bindDeleteButtons(list);
}

function renderCalendarScreen() {
  document.getElementById("calendar-month-label").textContent =
    `${monthNames()[calendarMonth.getMonth()]} ${calendarMonth.getFullYear()}`;
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
  CATEGORY_META.forEach((c) => {
    const chip = document.createElement("div");
    chip.className = "category-chip" + (c.id === formCategory ? " active" : "");
    chip.textContent = `${c.icon} ${categoryLabel(c.id)}`;
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
  document.getElementById("input-place").value = "";
  document.getElementById("input-share").checked = false;
  document.getElementById("input-date").value = dateKey(new Date());
  document.getElementById("input-currency").value = baseCurrency;
  formCategory = CATEGORY_META[0].id;
  setupCategoryPicker();
  document.getElementById("add-overlay").classList.remove("hidden");
}

function closeAddSheet() {
  document.getElementById("add-overlay").classList.add("hidden");
}

function getTelegramLocation() {
  return new Promise((resolve) => {
    const tg = window.Telegram?.WebApp;
    if (!tg?.LocationManager) {
      resolve(null);
      return;
    }
    tg.LocationManager.init(() => {
      if (!tg.LocationManager.isLocationAvailable) {
        resolve(null);
        return;
      }
      tg.LocationManager.getLocation((location) => {
        resolve(location ? { lat: location.latitude, lng: location.longitude } : null);
      });
    });
  });
}

async function confirmAdd() {
  const amount = parseFloat(document.getElementById("input-amount").value);
  if (!amount || amount <= 0) return;

  const shareChecked = document.getElementById("input-share").checked;
  const placeName = document.getElementById("input-place").value.trim();

  let lat = null;
  let lng = null;
  let sharedToMap = false;

  if (shareChecked) {
    const location = await getTelegramLocation();
    if (location) {
      lat = location.lat;
      lng = location.lng;
      sharedToMap = true;
    } else {
      alert(t("geo_failed"));
    }
  }

  const { data, error } = await supabaseClient
    .from("expenses")
    .insert({
      telegram_user_id: userId,
      amount,
      currency: document.getElementById("input-currency").value,
      category: formCategory,
      date: document.getElementById("input-date").value,
      note: document.getElementById("input-note").value.trim(),
      place_name: placeName || null,
      lat,
      lng,
      shared_to_map: sharedToMap,
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

let settings = { display_name: "", start_screen: "overview", theme: "auto", is_premium: false, language: "ru", map_language: "ru" };

async function loadSettings() {
  const { data } = await supabaseClient
    .from("user_settings")
    .select("*")
    .eq("telegram_user_id", userId)
    .maybeSingle();
  return (
    data || {
      display_name: "",
      start_screen: "overview",
      theme: "auto",
      is_premium: false,
      language: detectInterfaceLanguage(),
      map_language: detectMapLanguage(),
    }
  );
}

async function saveSettings() {
  await supabaseClient.from("user_settings").upsert({
    telegram_user_id: userId,
    display_name: settings.display_name,
    start_screen: settings.start_screen,
    theme: settings.theme,
    language: settings.language,
    map_language: settings.map_language,
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
    alert(t("payment_telegram_only"));
    return;
  }

  const res = await fetch("/api/create-invoice", { method: "POST" });
  const data = await res.json();
  if (!data.link) {
    alert(t("invoice_failed"));
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
  const rows = [[t("date_label"), t("category_label"), t("amount_label"), t("currency_label"), t("note_label")]];
  entries.forEach((e) => {
    rows.push([e.date, categoryLabel(e.category), e.amount, e.currency, e.note || ""]);
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
    ? `${t("greeting_prefix")}, ${settings.display_name}`
    : t("app_title");
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
    setSegmentedValue("settings-language", settings.language);
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

  document.querySelectorAll("#settings-language .period-tab").forEach((btn) => {
    btn.addEventListener("click", () => setLanguage(btn.dataset.value));
  });
}

async function setLanguage(lang) {
  settings.language = lang;
  setSegmentedValue("settings-language", lang);
  applyI18nStatic();
  setupCategoryPicker();
  renderHeaderTitle();
  renderAll();
  await saveSettings();
}

async function loadSharedPins() {
  const { data, error } = await supabaseClient
    .from("expenses")
    .select("*")
    .eq("shared_to_map", true)
    .not("lat", "is", null)
    .not("lng", "is", null);
  if (error) {
    console.error(error);
    return [];
  }
  return data;
}

function clusterPins(pins) {
  const clusters = {};
  pins.forEach((p) => {
    const key = `${p.lat.toFixed(3)}:${p.lng.toFixed(3)}:${p.category}`;
    if (!clusters[key]) {
      clusters[key] = { lat: p.lat, lng: p.lng, category: p.category, placeNames: {}, amounts: [] };
    }
    clusters[key].amounts.push(convert(p.amount, p.currency, baseCurrency));
    const name = p.place_name || "Без названия";
    clusters[key].placeNames[name] = (clusters[key].placeNames[name] || 0) + 1;
  });
  return Object.values(clusters).map((c) => {
    const topName = Object.entries(c.placeNames).sort((a, b) => b[1] - a[1])[0][0];
    const avg = c.amounts.reduce((s, v) => s + v, 0) / c.amounts.length;
    return { lat: c.lat, lng: c.lng, category: c.category, name: topName, avg, count: c.amounts.length };
  });
}

const MAPTILER_KEY = "ot16oiPSCsaqLbDZr4Ty";

function applyMapLanguage(map, lang) {
  const style = map.getStyle();
  if (!style?.layers) return;
  style.layers.forEach((layer) => {
    if (layer.type === "symbol" && layer.layout && layer.layout["text-field"]) {
      map.setLayoutProperty(layer.id, "text-field", ["coalesce", ["get", `name:${lang}`], ["get", "name"]]);
    }
  });
}

let mapInstance = null;
let mapMarkers = [];

async function renderMapScreen() {
  const pins = clusterPins(await loadSharedPins());

  if (!mapInstance) {
    mapInstance = new maplibregl.Map({
      container: "map-container",
      style: `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_KEY}`,
      center: [44.5, 41.7],
      zoom: 7,
    });
    mapInstance.addControl(new maplibregl.NavigationControl(), "top-left");
    mapInstance.on("load", () => applyMapLanguage(mapInstance, settings.map_language));
  } else {
    applyMapLanguage(mapInstance, settings.map_language);
  }

  mapMarkers.forEach((m) => m.remove());
  mapMarkers = [];

  pins.forEach((p) => {
    const el = document.createElement("div");
    el.className = "map-pin";
    el.style.background = CATEGORY_COLOR[p.category] || "#9aa0a6";
    el.innerHTML = `<span>${CATEGORY_ICON[p.category] || ""}</span>`;

    const popup = new maplibregl.Popup({ offset: 20 }).setHTML(
      `<b>${CATEGORY_ICON[p.category] || ""} ${escapeHtml(p.name)}</b><br>${formatMoney(p.avg, baseCurrency)} · ${p.count} ${pluralize(p.count, t("mark_forms"))}`
    );

    const marker = new maplibregl.Marker({ element: el })
      .setLngLat([p.lng, p.lat])
      .setPopup(popup)
      .addTo(mapInstance);
    mapMarkers.push(marker);
  });

  setTimeout(() => mapInstance.resize(), 200);
}

function setMapLanguage(lang) {
  settings.map_language = lang;
  document.querySelectorAll(".map-lang-btn").forEach((b) => b.classList.toggle("active", b.dataset.lang === lang));
  if (mapInstance) applyMapLanguage(mapInstance, lang);
  saveSettings();
}

function setupMapScreen() {
  document.getElementById("open-map").addEventListener("click", async () => {
    document.getElementById("map-screen").classList.remove("hidden");
    setMapLanguage(settings.map_language);
    await renderMapScreen();
  });
  document.getElementById("map-back").addEventListener("click", () => {
    document.getElementById("map-screen").classList.add("hidden");
  });
  document.querySelectorAll(".map-lang-btn").forEach((btn) => {
    btn.addEventListener("click", () => setMapLanguage(btn.dataset.lang));
  });
}

async function init() {
  initTelegramWebApp();
  setupCurrencySelects();
  setupPeriodTabs();
  setupPeriodNav();
  setupCalendarScreen();
  setupSettingsScreen();
  setupMapScreen();
  setupAddSheet();

  const [, , loadedSettings] = await Promise.all([
    fetchRates(),
    loadEntries().then((data) => { entries = data; }),
    loadSettings(),
  ]);
  settings = loadedSettings;
  settings.language = settings.language || detectInterfaceLanguage();
  settings.map_language = settings.map_language || detectMapLanguage();

  applyTheme(settings.theme);
  applyI18nStatic();
  renderHeaderTitle();
  renderAll();

  if (settings.start_screen === "calendar") {
    calendarMonth = new Date(periodAnchor.getFullYear(), periodAnchor.getMonth(), 1);
    renderCalendarScreen();
    document.getElementById("calendar-screen").classList.remove("hidden");
  }
}

init();
