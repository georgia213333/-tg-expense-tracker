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

async function sendMessage(chatId, text) {
  await fetch(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(200).send("ok");
    return;
  }

  const message = req.body?.message;
  if (!message?.text) {
    res.status(200).json({ ok: true });
    return;
  }

  const chatId = message.chat.id;
  const text = message.text.trim();

  if (text === "/start") {
    await sendMessage(
      chatId,
      "Привет! Пиши траты в свободной форме, например:\n\n12 лари кофе\n\nВалюта не обязательна — по умолчанию лари. Открыть полное приложение — кнопка меню внизу."
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

  const { error } = await supabase.from("expenses").insert({
    telegram_user_id: message.from.id,
    amount: parsed.amount,
    currency: parsed.currency,
    category: parsed.category,
    date: todayInTbilisi(),
    note: parsed.note || null,
  });

  if (error) {
    await sendMessage(chatId, "Не получилось сохранить трату, попробуй ещё раз.");
    res.status(200).json({ ok: true });
    return;
  }

  await sendMessage(
    chatId,
    `✅ Записано: ${parsed.amount} ${parsed.currency} · ${CATEGORY_LABELS[parsed.category]}`
  );
  res.status(200).json({ ok: true });
};
