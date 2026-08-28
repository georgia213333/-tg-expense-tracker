module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(200).send("ok");
    return;
  }

  const result = await fetch(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/createInvoiceLink`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "Экспорт в CSV",
      description: "Разовая покупка: экспорт всех твоих трат в CSV-файл",
      payload: "premium_csv_export",
      currency: "XTR",
      prices: [{ label: "Экспорт CSV", amount: 1 }],
    }),
  }).then((r) => r.json());

  if (!result.ok) {
    res.status(500).json({ error: result.description });
    return;
  }

  res.status(200).json({ link: result.result });
};
