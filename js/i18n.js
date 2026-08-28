const CATEGORY_META = [
  { id: "groceries", icon: "🛒", color: "#f2a65a" },
  { id: "restaurants", icon: "🍽", color: "#e85d75" },
  { id: "delivery", icon: "🛵", color: "#f7d060" },
  { id: "transport", icon: "🚕", color: "#6fcf97" },
  { id: "fuel", icon: "⛽", color: "#56ccf2" },
  { id: "home", icon: "🏠", color: "#bb86fc" },
  { id: "fun", icon: "🎮", color: "#ff8c69" },
  { id: "health", icon: "💊", color: "#4dd0e1" },
  { id: "shopping", icon: "🛍", color: "#ffb74d" },
  { id: "other", icon: "✨", color: "#9aa0a6" },
];

const CATEGORY_ORDER = CATEGORY_META.map((c) => c.id);
const CATEGORY_ICON = Object.fromEntries(CATEGORY_META.map((c) => [c.id, c.icon]));
const CATEGORY_COLOR = Object.fromEntries(CATEGORY_META.map((c) => [c.id, c.color]));

const CATEGORY_LABELS = {
  ru: { groceries: "Продукты", restaurants: "Рестораны", delivery: "Доставка", transport: "Транспорт", fuel: "АЗС", home: "Жильё", fun: "Развлечения", health: "Здоровье", shopping: "Покупки", other: "Прочее" },
  en: { groceries: "Groceries", restaurants: "Restaurants", delivery: "Delivery", transport: "Transport", fuel: "Fuel", home: "Housing", fun: "Entertainment", health: "Health", shopping: "Shopping", other: "Other" },
  uk: { groceries: "Продукти", restaurants: "Ресторани", delivery: "Доставка", transport: "Транспорт", fuel: "АЗС", home: "Житло", fun: "Розваги", health: "Здоров'я", shopping: "Покупки", other: "Інше" },
};

const MONTH_NAMES_I18N = {
  ru: ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  uk: ["Січень", "Лютий", "Березень", "Квітень", "Травень", "Червень", "Липень", "Серпень", "Вересень", "Жовтень", "Листопад", "Грудень"],
};

const DOW_I18N = {
  ru: ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"],
  en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  uk: ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"],
};

const I18N = {
  ru: {
    app_title: "Расходы",
    greeting_prefix: "Привет",
    tab_week: "Нед", tab_month: "Мес", tab_year: "Год",
    recent_expenses: "Последние траты",
    no_expenses_period: "Нет трат за этот период",
    no_expenses_hint: "Пока нет трат за этот период",
    nothing_found: "Ничего не найдено",
    all_month_expenses: "Все траты за месяц",
    expenses_for: "Траты за",
    settings_title: "Настройки",
    change_photo: "Сменить фото",
    name_label: "Имя",
    name_placeholder: "Как к тебе обращаться",
    start_screen_label: "Начальный экран",
    start_overview: "Обзор",
    start_calendar: "Календарь",
    theme_label: "Тема",
    theme_auto: "Авто",
    theme_dark: "Тёмная",
    theme_light: "Светлая",
    language_label: "Язык",
    map_title: "Карта сообщества",
    map_hint: "Места, которыми поделились пользователи — цена усреднена по всем отметкам",
    new_expense: "Новая трата",
    amount_label: "Сумма",
    currency_label: "Валюта",
    date_label: "Дата",
    category_label: "Категория",
    note_label: "Заметка (необязательно)",
    note_placeholder: "Например: обед в кафе",
    place_label: "Место (необязательно)",
    place_placeholder: "Название кафе/магазина",
    share_label: "📍 Поделиться местом с картой сообщества",
    cancel: "Отмена",
    add: "Добавить",
    geo_failed: "Не удалось получить геолокацию — трата сохранится без метки на карте",
    payment_telegram_only: "Оплата доступна только внутри Telegram",
    invoice_failed: "Не получилось создать счёт на оплату",
    expense_forms: ["трата", "траты", "трат"],
    mark_forms: ["отметка", "отметки", "отметок"],
  },
  en: {
    app_title: "Expenses",
    greeting_prefix: "Hi",
    tab_week: "Week", tab_month: "Month", tab_year: "Year",
    recent_expenses: "Recent expenses",
    no_expenses_period: "No expenses for this period",
    no_expenses_hint: "No expenses yet for this period",
    nothing_found: "Nothing found",
    all_month_expenses: "All expenses this month",
    expenses_for: "Expenses for",
    settings_title: "Settings",
    change_photo: "Change photo",
    name_label: "Name",
    name_placeholder: "What should we call you",
    start_screen_label: "Start screen",
    start_overview: "Overview",
    start_calendar: "Calendar",
    theme_label: "Theme",
    theme_auto: "Auto",
    theme_dark: "Dark",
    theme_light: "Light",
    language_label: "Language",
    map_title: "Community map",
    map_hint: "Places shared by users — price is averaged across all entries",
    new_expense: "New expense",
    amount_label: "Amount",
    currency_label: "Currency",
    date_label: "Date",
    category_label: "Category",
    note_label: "Note (optional)",
    note_placeholder: "e.g. lunch at a cafe",
    place_label: "Place (optional)",
    place_placeholder: "Cafe/shop name",
    share_label: "📍 Share this place on the community map",
    cancel: "Cancel",
    add: "Add",
    geo_failed: "Couldn't get your location — the expense will be saved without a map pin",
    payment_telegram_only: "Payment is only available inside Telegram",
    invoice_failed: "Couldn't create the payment invoice",
    expense_forms: ["expense", "expenses"],
    mark_forms: ["mark", "marks"],
  },
  uk: {
    app_title: "Витрати",
    greeting_prefix: "Привіт",
    tab_week: "Тижд", tab_month: "Міс", tab_year: "Рік",
    recent_expenses: "Останні витрати",
    no_expenses_period: "Немає витрат за цей період",
    no_expenses_hint: "Поки немає витрат за цей період",
    nothing_found: "Нічого не знайдено",
    all_month_expenses: "Всі витрати за місяць",
    expenses_for: "Витрати за",
    settings_title: "Налаштування",
    change_photo: "Змінити фото",
    name_label: "Ім'я",
    name_placeholder: "Як до тебе звертатись",
    start_screen_label: "Початковий екран",
    start_overview: "Огляд",
    start_calendar: "Календар",
    theme_label: "Тема",
    theme_auto: "Авто",
    theme_dark: "Темна",
    theme_light: "Світла",
    language_label: "Мова",
    map_title: "Карта спільноти",
    map_hint: "Місця, якими поділились користувачі — ціна усереднена за всіма позначками",
    new_expense: "Нова витрата",
    amount_label: "Сума",
    currency_label: "Валюта",
    date_label: "Дата",
    category_label: "Категорія",
    note_label: "Нотатка (необов'язково)",
    note_placeholder: "Наприклад: обід у кафе",
    place_label: "Місце (необов'язково)",
    place_placeholder: "Назва кафе/магазину",
    share_label: "📍 Поділитись місцем на карті спільноти",
    cancel: "Скасувати",
    add: "Додати",
    geo_failed: "Не вдалось отримати геолокацію — витрата збережеться без мітки на карті",
    payment_telegram_only: "Оплата доступна лише в Telegram",
    invoice_failed: "Не вдалось створити рахунок на оплату",
    expense_forms: ["витрата", "витрати", "витрат"],
    mark_forms: ["позначка", "позначки", "позначок"],
  },
};

function t(key) {
  const lang = (typeof settings !== "undefined" && settings.language) || "ru";
  return (I18N[lang] || I18N.ru)[key];
}

function categoryLabel(id) {
  const lang = (typeof settings !== "undefined" && settings.language) || "ru";
  return (CATEGORY_LABELS[lang] || CATEGORY_LABELS.ru)[id] || id;
}

function monthNames() {
  const lang = (typeof settings !== "undefined" && settings.language) || "ru";
  return MONTH_NAMES_I18N[lang] || MONTH_NAMES_I18N.ru;
}

function dowNames() {
  const lang = (typeof settings !== "undefined" && settings.language) || "ru";
  return DOW_I18N[lang] || DOW_I18N.ru;
}

function pluralize(n, forms) {
  if (forms.length === 2) return n === 1 ? forms[0] : forms[1];
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return forms[1];
  return forms[2];
}

function detectInterfaceLanguage() {
  const tgLang = window.Telegram?.WebApp?.initDataUnsafe?.user?.language_code;
  if (tgLang && ["ru", "en", "uk"].includes(tgLang)) return tgLang;
  return "ru";
}

function detectMapLanguage() {
  const tgLang = window.Telegram?.WebApp?.initDataUnsafe?.user?.language_code;
  if (tgLang && ["ru", "en", "uk", "ka"].includes(tgLang)) return tgLang;
  return "ru";
}

function applyI18nStatic() {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  document.title = t("app_title");
  document.documentElement.lang = (typeof settings !== "undefined" && settings.language) || "ru";
}
