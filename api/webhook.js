const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const CATEGORY_KEYWORDS = {
  groceries: ["продукты", "супермаркет", "carrefour", "карфур", "spar", "спар", "fresco", "фреско", "goodwill", "гудвилл", "nikora", "никора", "магнит"],
  restaurants: ["ресторан", "кафе", "кофе", "обед", "ужин", "завтрак", "бар", "паб", "столовая", "шаурма", "суши", "перекус"],
  delivery: ["wolt", "волт", "glovo", "глово", "доставка"],
  transport: ["такси", "автобус", "метро", "транспорт", "маршрутка", "поезд", "самолет", "самолёт", "билет"],
  fuel: ["азс", "заправка", "бензин", "дизель", "топливо", "wissol", "виссол", "socar", "сокар", "rompetrol", "ромпетрол", "gulf", "гулф", "lukoil", "лукойл"],
  home: ["аренда", "квартира", "жкх", "счет", "счёт", "интернет", "коммуналка"],
  fun: ["кино", "вечеринка", "развлечения", "игра", "концерт"],
  health: ["аптека", "врач", "лекарств", "стоматолог", "больница"],
  shopping: ["одежда", "магазин", "покупк", "техника"],
};

const CATEGORY_LABELS = {
  groceries: "Продукты",
  restaurants: "Рестораны",
  delivery: "Доставка",
  transport: "Транспорт",
  fuel: "АЗС",
  home: "Жильё",
  fun: "Развлечения",
  health: "Здоровье",
  shopping: "Покупки",
  other: "Прочее",
};

const CATEGORY_ICONS = {
  groceries: "🛒",
  restaurants: "🍽",
  delivery: "🛵",
  transport: "🚕",
  fuel: "⛽",
  home: "🏠",
  fun: "🎮",
  health: "💊",
  shopping: "🛍",
  other: "✨",
};

const CATEGORY_ORDER = Object.keys(CATEGORY_LABELS);

function parseExpenseText(text) {
  const amountMatch = text.match(/(\d+(?:[.,]\d+)?)/);
  if (!amountMatch) return null;
  const amount = parseFloat(amountMatch[1].replace(",", "."));

  const lower = text.toLowerCase();
  let currency = "GEL";
  if (/(доллар|usd|\$)/.test(lower)) currency = "USD";
  else if (/(бат|thb|฿)/.test(lower)) currency = "THB";
  else if (/(евро|eur|€)/.test(lower)) currency = "EUR";

  let category = "other";
  for (const [cat, words] of Object.entries(CATEGORY_KEYWORDS)) {
    if (words.some((w) => lower.includes(w))) {
      category = cat;
      break;
    }
  }

  const note = text.replace(amountMatch[0], "").trim();

  return { amount, currency, category, note };
}

function todayInTbilisi() {
  const shifted = new Date(Date.now() + 4 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 10);
}

function categoryKeyboard(expenseId) {
  const buttons = CATEGORY_ORDER.map((id) => ({
    text: `${CATEGORY_ICONS[id]} ${CATEGORY_LABELS[id]}`,
    callback_data: `cat:${expenseId}:${id}`,
  }));
  const rows = [];
  for (let i = 0; i < buttons.length; i += 2) {
    rows.push(buttons.slice(i, i + 2));
  }
  return { inline_keyboard: rows };
}

function confirmationText(expense) {
  return `✅ Записано: ${expense.amount} ${expense.currency} · ${CATEGORY_LABELS[expense.category]}\n\nНе та категория? Тапни нужную:`;
}

async function telegramApi(method, payload) {
  const res = await fetch(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json();
}

async function sendMessage(chatId, text, replyMarkup) {
  return telegramApi("sendMessage", {
    chat_id: chatId,
    text,
    reply_markup: replyMarkup,
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(200).send("ok");
    return;
  }

  const preCheckout = req.body?.pre_checkout_query;
  if (preCheckout) {
    await telegramApi("answerPreCheckoutQuery", {
      pre_checkout_query_id: preCheckout.id,
      ok: true,
    });
    res.status(200).json({ ok: true });
    return;
  }

  const callback = req.body?.callback_query;
  if (callback) {
    const [, expenseId, categoryId] = callback.data.split(":");

    const { data: expense, error } = await supabase
      .from("expenses")
      .update({ category: categoryId })
      .eq("id", expenseId)
      .select()
      .single();

    if (error || !expense) {
      await telegramApi("answerCallbackQuery", {
        callback_query_id: callback.id,
        text: "Не получилось изменить категорию",
      });
      res.status(200).json({ ok: true });
      return;
    }

    await telegramApi("answerCallbackQuery", {
      callback_query_id: callback.id,
      text: `Изменено на: ${CATEGORY_LABELS[categoryId]}`,
    });

    await telegramApi("editMessageText", {
      chat_id: callback.message.chat.id,
      message_id: callback.message.message_id,
      text: `✅ Записано: ${expense.amount} ${expense.currency} · ${CATEGORY_LABELS[categoryId]}`,
    });

    res.status(200).json({ ok: true });
    return;
  }

  const message = req.body?.message;
  if (!message) {
    res.status(200).json({ ok: true });
    return;
  }

  if (message.successful_payment) {
    const payload = message.successful_payment.invoice_payload;
    if (payload === "premium_csv_export") {
      await supabase.from("user_settings").upsert({
        telegram_user_id: message.from.id,
        is_premium: true,
      });
      await sendMessage(message.chat.id, "✅ Спасибо за покупку! Открой мини-апп — экспорт в CSV уже доступен в настройках.");
    }
    res.status(200).json({ ok: true });
    return;
  }

  if (!message.text) {
    res.status(200).json({ ok: true });
    return;
  }

  const chatId = message.chat.id;
  const text = message.text.trim();

  if (text === "/start") {
    await sendMessage(
      chatId,
      "Привет! Пиши траты в свободной форме, например:\n\n12 лари кофе\n\nВалюта не обязательна — по умолчанию лари. Если категория окажется неправильной — под сообщением будут кнопки, чтобы поправить. Открыть полное приложение — кнопка меню внизу."
    );
    res.status(200).json({ ok: true });
    return;
  }

  const parsed = parseExpenseText(text);
  if (!parsed) {
    await sendMessage(chatId, "Не нашёл сумму в сообщении. Напиши, например: 12 лари кофе");
    res.status(200).json({ ok: true });
    return;
  }

  const { data: expense, error } = await supabase
    .from("expenses")
    .insert({
      telegram_user_id: message.from.id,
      amount: parsed.amount,
      currency: parsed.currency,
      category: parsed.category,
      date: todayInTbilisi(),
      note: parsed.note || null,
    })
    .select()
    .single();

  if (error) {
    await sendMessage(chatId, "Не получилось сохранить трату, попробуй ещё раз.");
    res.status(200).json({ ok: true });
    return;
  }

  await sendMessage(chatId, confirmationText(expense), categoryKeyboard(expense.id));
  res.status(200).json({ ok: true });
};
