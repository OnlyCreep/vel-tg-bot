const TelegramBot = require("node-telegram-bot-api");
const token = "7339008763:AAHU4_ZQ1jKwdmOfSMg6WvN0VLW7MNIRHv0";
const bot = new TelegramBot(token, { polling: true });

const adminChatId = -4701713936;
const guestOptions = [
  "До 50",
  "50-75",
  "76-100",
  "101-150",
  "151-200",
  "Более 200",
];
const eventOptions = [
  "Корпоратив",
  "Свадьба",
  "Выпускной",
  "День рождения",
  "Обучение/Тимбилдинг",
  "Другое",
];
const locationOptions = ["Новосибирск", "Пригород (до 30 км)", "Другое"];
const budgetOptions = [
  "30-50",
  "51-75",
  "76-100",
  "101-150",
  "151-200",
  "Более 200",
];

let pendingRequests = {};

const seasonRates = {
  январь: { "вс-чт": 11000, "пт-сб": 14000 },
  февраль: { "вс-чт": 11000, "пт-сб": 14000 },
  март: { "вс-чт": 11000, "пт-сб": 14000 },
  апрель: { "вс-чт": 11000, "пт-сб": 14000 },
  май: { "вс-чт": 11000, "пт-сб": 14000 },
  июнь: { "вс-чт": 14000, "пт-сб": 15000 },
  июль: { "вс-чт": 14000, "пт-сб": 15000 },
  август: { "вс-чт": 14000, "пт-сб": 15000 },
  сентябрь: { "вс-чт": 11000, "пт-сб": 14000 },
  октябрь: { "вс-чт": 11000, "пт-сб": 14000 },
  ноябрь: { "вс-чт": 11000, "пт-сб": 14000 },
  декабрь: { "до 14": 14000, "с 15": 15000 },
};
const guestMultiplier = {
  "До 50": 1,
  "50-75": 1.1,
  "76-100": 1.2,
  "101-150": 1.7,
  "151-200": 2,
  "Более 200": 2.5,
};
const locationExtra = {
  Новосибирск: 0,
  "Пригород (до 30 км)": 5000,
  Другое: 1.5,
};
let userSessions = {};
let lastSurveyTime = {};

const images = [
  {
    url: "https://vel-agency.sps.center/wp-content/uploads/2024/10/card_quiz_4_vel-e1740539781897.png",
    caption: "Девушка с синими плетёными аксессуарами (первая картинка слева)",
  },
  {
    url: "https://vel-agency.sps.center/wp-content/uploads/2024/10/card_quiz_3_vel-e1740539861115.png",
    caption: "Уютная спальня с жёлтыми шторами (верхняя справа)",
  },
  {
    url: "https://vel-agency.sps.center/wp-content/uploads/2024/10/card_quiz_2_vel-e1740539841526.png",
    caption: "Зелёные листья вблизи (по центру справа)",
  },
  {
    url: "https://vel-agency.sps.center/wp-content/uploads/2024/10/card_quiz_1_vel.png",
    caption: "Женщина в роскошном образе с украшениями (нижняя справа)",
  },
];

function escapeMarkdownV2(text) {
  return text.replace(/[_*[\]()~`>#+-=|{}.!]/g, "\\$&");
}

function calculatePrice(session) {
  let baseRate = getBaseRate(session.date);
  let guestFactor = guestMultiplier[session.guests] || 1;
  let locationFactor = locationExtra[session.location] || 1;
  let totalPrice = baseRate * session.hours * guestFactor;
  totalPrice =
    locationFactor == 5000
      ? totalPrice + 5000
      : locationFactor == 1.5
      ? (totalPrice *= 1.5)
      : totalPrice;
  return totalPrice;
}

function getBaseRate(dateString) {
  const months = {
    январь: 1,
    февраль: 2,
    март: 3,
    апрель: 4,
    май: 5,
    июнь: 6,
    июль: 7,
    август: 8,
    сентябрь: 9,
    октябрь: 10,
    ноябрь: 11,
    декабрь: 12,
  };

  // Пакетные предложения с путями к изображениям

  let date = parseDate(dateString);
  let monthName =
    Object.keys(months).find((m) => dateString.toLowerCase().includes(m)) ||
    Object.keys(months)[date.getMonth()];
  let day = date.getDate();
  let dayOfWeek = date.getDay();
  let rateType = dayOfWeek >= 5 ? "пт-сб" : "вс-чт";
  if (monthName === "декабрь" && day >= 15) {
    return seasonRates["декабрь"]["с 15"];
  }
  return seasonRates[monthName][rateType];
}

function parseDate(input) {
  let date = new Date();
  if (!isNaN(input)) {
    date.setDate(parseInt(input));
  } else {
    let parsedDate = Date.parse(input);
    if (!isNaN(parsedDate)) {
      date = new Date(parsedDate);
    }
  }
  return date;
}

function askDate(chatId) {
  bot.sendMessage(chatId, "📆 Введите дату мероприятия (например, 15 января)");
}

function askGuests(chatId) {
  bot.sendMessage(chatId, "👥 Количество гостей?", {
    reply_markup: {
      keyboard: guestOptions.map((opt) => [opt]),
      one_time_keyboard: true,
    },
  });
}

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const username = msg.from.username
    ? `@${msg.from.username}`
    : `[Профиль]tg://user?id=${userId}`;

  // Удаляем все старые сообщения бота перед перезапуском
  await deletePreviousBotMessages(chatId);

  // Если пользователь уже проходил квиз, уведомляем администратора
  if (userSessions[chatId]?.isSurveyActive) {
    bot.sendMessage(
      adminChatId,
      `⚠️ Пользователь [@${username}](tg://user?id=${userId}) остановил текущий опрос командой /start.`,
      { parse_mode: "Markdown" }
    );
  }

  // Полностью очищаем данные пользователя и прерываем квиз
  userSessions[chatId] = { isSurveyActive: false }; // Сбрасываем состояние опроса

  // Отправляем стартовое сообщение с кнопкой
  bot.sendMessage(
    chatId,
    "Важными факторами успешного праздника является слаженная работа ведущего и DJ, а также наличие хорошего оборудования. Стоимость включает эти позиции.\n\n(Ведущий+DJ+Оборудование)",
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "Поехали🚂", callback_data: "start_survey" }],
        ],
      },
    }
  );
});

bot.onText(/\/survey/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const username = msg.from.username
    ? `@${msg.from.username}`
    : `[Профиль](tg://user?id=${userId})`;
  const now = Date.now();

  // Удаляем старые сообщения бота, если есть
  await deletePreviousBotMessages(chatId);

  // Удаляем старую сессию и создаем новую
  userSessions[chatId] = {
    userId,
    username,
    isSurveyActive: true,
    botMessages: [],
  };

  lastSurveyTime[userId] = now;

  askDate(chatId);
});

async function deletePreviousBotMessages(chatId) {
  if (!userSessions[chatId] || !userSessions[chatId].botMessages) return;

  for (const messageId of userSessions[chatId].botMessages) {
    try {
      await bot.deleteMessage(chatId, messageId);
    } catch (err) {
      console.error(`Ошибка удаления сообщения ${messageId}:`, err.message);
    }
  }

  userSessions[chatId].botMessages = [];
}

async function sendBotMessage(chatId, text, options = {}) {
  try {
    const sentMessage = await bot.sendMessage(chatId, text, options);
    if (!userSessions[chatId]) {
      userSessions[chatId] = { botMessages: [] }; // Гарантируем, что объект существует
    }
    if (!userSessions[chatId].botMessages) {
      userSessions[chatId].botMessages = [];
    }
    userSessions[chatId].botMessages.push(sentMessage.message_id);
  } catch (err) {
    console.error("Ошибка отправки сообщения:", err.message);
  }
}

bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  if (msg.text.startsWith("/")) return; // Игнорируем команды

  // Проверяем, если пользователь уже проходит квиз
  if (userSessions[chatId] && userSessions[chatId].isSurveyActive) return;

  bot.sendMessage(
    chatId,
    "Хотите пройти короткий квиз и узнать стоимость вашего мероприятия?",
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "Поехали🚂", callback_data: "start_survey" }],
        ],
      },
    }
  );
});

function askImageSelection(chatId) {
  const mediaGroup = images.map((img) => ({
    type: "photo",
    media: img.url,
    caption: img.caption,
  }));

  bot.sendMediaGroup(chatId, mediaGroup).then(() => {
    bot.sendMessage(chatId, "Выберите картинку по душе:", {
      reply_markup: {
        keyboard: images.map((img) => [img.caption]),
        one_time_keyboard: true,
      },
    });
  });
}

function askBonusSelection(chatId) {
  bot.sendMessage(
    chatId,
    "🎁 Люблю делать подарки. При бронировании даты в течение суток, вы можете выбрать один из бонусов:\n1) Доп. час работы диджея\n2) 1.5 часа работы фотографа\n3) 1.5 часа работы рилсмейкера",
    {
      reply_markup: {
        keyboard: [
          ["Доп. час диджея"],
          ["1.5 часа фотографа"],
          ["1.5 часа рилсмейкера"],
        ],
        one_time_keyboard: true,
      },
    }
  );
}

const fs = require("fs");

// Пакетные предложения с путями к изображениям
const packageImages = {
  Корпоратив: ["./images/corporate1.jpg"], // 1 фото
  Выпускной: ["./images/graduation1.jpg", "./images/graduation2.jpg"], // 2 фото
  "День рождения": ["./images/birthday1.jpg"], // 1 фото
  Свадьба: ["./images/wedding1.jpg", "./images/wedding2.jpg"], // 2 фото
};

// Функция отправки кнопок "Интересные пакетные предложения"
function sendPackageOptions(chatId) {
  bot.sendMessage(chatId, "Выберите интересующее вас пакетное предложение:", {
    reply_markup: {
      inline_keyboard: [
        [{ text: "Корпоратив", callback_data: "package_corporate" }],
        [{ text: "Выпускной", callback_data: "package_graduation" }],
        [{ text: "День рождения", callback_data: "package_birthday" }],
        [{ text: "Свадьба", callback_data: "package_wedding" }],
      ],
    },
  });
}

// Функция отправки изображений
function sendPackageImages(chatId, eventType) {
  const images = packageImages[eventType];

  if (!images || images.length === 0) {
    return bot.sendMessage(chatId, "❌ Изображения не найдены.");
  }

  const mediaGroup = images.map((imgPath) => ({
    type: "photo",
    media: fs.createReadStream(imgPath),
  }));

  bot.sendMediaGroup(chatId, mediaGroup).then(() => {
    bot.sendMessage(chatId, "🔹 Узнать больше:", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "Свяжите меня с человеком", callback_data: "oper_mes" }],
          [
            {
              text: "Другие пакетные предложения",
              callback_data: "show_packages",
            },
          ],
        ],
      },
    });
  });
}

// ГЛАВНЫЙ ОБРАБОТЧИК ВСЕХ CALLBACK-КНОПОК
bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const userId = query.from.id;
  const username = query.from.username ? `@${query.from.username}` : null;
  const phoneNumber = query.from.phone_number
    ? `📞 ${query.from.phone_number}`
    : null;

  switch (query.data) {
    case "start_survey":
      if (
        lastSurveyTime[userId] &&
        Date.now() - lastSurveyTime[userId] < 60000
      ) {
        return bot.answerCallbackQuery(query.id, {
          text: "⛔ Пожалуйста, подождите 1 минуту перед повторным запуском опроса.",
          show_alert: true,
        });
      }
      lastSurveyTime[userId] = Date.now();
      userSessions[chatId] = { userId, isSurveyActive: true }; // Теперь уникально для каждого пользователя
      askDate(chatId);
      break;

    case "show_packages":
      sendPackageOptions(chatId);
      break;

    case "package_corporate":
      sendPackageImages(chatId, "Корпоратив");
      break;

    case "package_graduation":
      sendPackageImages(chatId, "Выпускной");
      break;

    case "package_birthday":
      sendPackageImages(chatId, "День рождения");
      break;

    case "package_wedding":
      sendPackageImages(chatId, "Свадьба");
      break;

    case "oper_mes":
      const session = userSessions[chatId];
      if (!session) return;

      let userInfo = `👤 Пользователь: [Профиль](tg://user?id=${userId})\n`;
      if (session.username) {
        userInfo += `🔹 Ник: ${escapeMarkdownV2(session.username)}\n`;
      }

      await bot.sendMessage(
        adminChatId,
        `📩 *Новая заявка!*\n${userInfo}💬 Нажал кнопку "Свяжите меня с человеком".`,
        { parse_mode: "MarkdownV2" }
      );

      bot.answerCallbackQuery(query.id, { text: "✅ Заявка обработана!" });
      break;
  }
});

function sendSummary(chatId) {
  if (!userSessions[chatId]) return;

  const session = userSessions[chatId];
  if (!session.date || !session.event || !session.guests) return; // Проверяем, что сессия полная

  let totalPrice = calculatePrice(session);

  let summaryMessage =
    `📩 *Новый опрос*\n` +
    `👤 *Пользователь*: [Профиль](tg://user?id=${chatId})\n` +
    `📅 *Дата*: ${escapeMarkdownV2(session.date)}\n` +
    `🎉 *Событие*: ${escapeMarkdownV2(session.event)}\n` +
    `👥 *Гости*: ${escapeMarkdownV2(session.guests)}\n` +
    `📍 *Локация*: ${escapeMarkdownV2(session.location)}\n` +
    `⏳ *Длительность*: ${escapeMarkdownV2(session.hours.toString())} ч.\n` +
    `💰 *Ожидания по бюджету*: ${escapeMarkdownV2(session.budget)} тыс. ₽\n` +
    `🔮 *3 слова про мероприятие*: ${escapeMarkdownV2(session.words)}\n` +
    `🖼 *Выбранный стиль*: ${escapeMarkdownV2(session.selectedImage)}\n` +
    `🎁 *Выбранный бонус*: ${escapeMarkdownV2(session.bonus)}\n` +
    `💵 *Итоговая стоимость*: ${totalPrice.toLocaleString()}₽`;

  bot.sendMessage(
    chatId,
    `✅ Ваша ориентировочная стоимость: ${totalPrice.toLocaleString()}₽`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "Свяжите меня с человеком", callback_data: "oper_mes" }],
          [
            {
              text: "Интересные пакетные предложения",
              callback_data: "show_packages",
            },
          ],
        ],
      },
    }
  );

  bot.sendMessage(adminChatId, summaryMessage, { parse_mode: "MarkdownV2" });

  delete userSessions[chatId]; // Очищаем данные только после отправки!
}

// Объект для отслеживания заявок

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  // Игнорируем команды (сообщения, начинающиеся с "/")
  if (text.startsWith("/")) return;

  // Проверяем, есть ли активная сессия и квиз
  if (!userSessions[chatId] || !userSessions[chatId].isSurveyActive) return;

  const session = userSessions[chatId];

  if (!session.date) {
    session.date = text;
    askEvent(chatId);
  } else if (!session.event) {
    if (!eventOptions.includes(text)) {
      askEvent(chatId, true);
      return;
    }
    session.event = text;
    askGuests(chatId);
  } else if (!session.guests) {
    if (!guestOptions.includes(text)) {
      askGuests(chatId, true);
      return;
    }
    session.guests = text;
    askLocation(chatId);
  } else if (!session.location) {
    if (!locationOptions.includes(text)) {
      askLocation(chatId, true);
      return;
    }
    session.location = text;
    askHours(chatId);
  } else if (!session.hours) {
    if (isNaN(text) || parseInt(text) <= 0) {
      bot.sendMessage(
        chatId,
        "⛔ Введите корректное количество часов цифрами!"
      );
      return;
    }
    session.hours = parseInt(text);
    askBudget(chatId);
  } else if (!session.budget) {
    if (!budgetOptions.includes(text)) {
      askBudget(chatId, true);
      return;
    }
    session.budget = text;
    askWords(chatId);
  } else if (!session.words) {
    session.words = text;
    askImageSelection(chatId);
  } else if (!session.selectedImage) {
    if (!images.some((img) => img.caption === text)) return;
    session.selectedImage = text;
    askBonusSelection(chatId);
  } else if (!session.bonus) {
    if (
      ![
        "Доп. час диджея",
        "1.5 часа фотографа",
        "1.5 часа рилсмейкера",
      ].includes(text)
    )
      return;

    session.bonus = text;
    bot.sendMessage(
      chatId,
      "✅ Ваш бонус учтен! Спасибо за прохождение опроса"
    );
    sendSummary(chatId);
    delete userSessions[chatId];
  }
});

function askEvent(chatId, retry = false) {
  sendBotMessage(
    chatId,
    retry ? "⛔ Пожалуйста, выберите вариант из списка!" : "🎉 Какое событие?",
    {
      reply_markup: {
        keyboard: eventOptions.map((opt) => [opt]),
        one_time_keyboard: true,
      },
    }
  );
}

function askGuests(chatId, retry = false) {
  sendBotMessage(
    chatId,
    retry
      ? "⛔ Пожалуйста, выберите вариант из списка!"
      : "👥 Количество гостей:",
    {
      reply_markup: {
        keyboard: guestOptions.map((opt) => [opt]),
        one_time_keyboard: true,
      },
    }
  );
}

function askLocation(chatId) {
  sendBotMessage(chatId, "📍 Где пройдет мероприятие?", {
    reply_markup: {
      keyboard: locationOptions.map((opt) => [opt]),
      one_time_keyboard: true,
    },
  });
}

function askHours(chatId) {
  sendBotMessage(chatId, "⏳ Сколько часов будет мероприятие?");
}

function askBudget(chatId) {
  sendBotMessage(
    chatId,
    "💰 Какая стоимость кажется адекватной заданным параметрам и ТЗ? (тыс.₽)",
    {
      reply_markup: {
        keyboard: budgetOptions.map((opt) => [opt]),
        one_time_keyboard: true,
      },
    }
  );
}

function askWords(chatId) {
  sendBotMessage(
    chatId,
    "🔮 Какими 3 словами вы бы хотели запомнить мероприятие?"
  );
}
