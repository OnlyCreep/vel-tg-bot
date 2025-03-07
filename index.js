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

let userSessions = new Map();
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

function calculatePrice(session) {
  let baseRate = getBaseRate(session.date);
  let guestFactor = guestMultiplier[session.guests] || 1;
  let locationFactor = locationExtra[session.location] || 1;
  let totalPrice = baseRate * session.hours * guestFactor;
  totalPrice =
    locationFactor === 5000 ? totalPrice + 5000 : totalPrice * locationFactor;
  return totalPrice;
}

function getBaseRate(dateString) {
  let date = parseDate(dateString);
  if (!date) return 15000;

  const months = Object.keys(seasonRates);
  let monthName =
    months.find((m) => dateString.toLowerCase().includes(m)) ||
    months[date.getMonth()];
  let day = date.getDate();
  let dayOfWeek = date.getDay();
  let rateType = dayOfWeek >= 5 ? "пт-сб" : "вс-чт";

  return monthName === "декабрь"
    ? day >= 15
      ? seasonRates[monthName]["с 15"]
      : seasonRates[monthName]["до 14"]
    : seasonRates[monthName][rateType] || 15000;
}

function parseDate(input) {
  let dateParts = input.match(/(\d{1,2})\s([а-я]+)/i);
  if (!dateParts) return null;

  let day = parseInt(dateParts[1]);
  let monthName = dateParts[2].toLowerCase();
  const months = {
    январь: 0,
    февраль: 1,
    март: 2,
    апрель: 3,
    май: 4,
    июнь: 5,
    июль: 6,
    август: 7,
    сентябрь: 8,
    октябрь: 9,
    ноябрь: 10,
    декабрь: 11,
  };
  if (!(monthName in months)) return null;

  let year = new Date().getFullYear();
  let date = new Date(year, months[monthName], day);
  return isNaN(date.getTime()) ? null : date;
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

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  userSessions.set(userId, { isSurveyActive: false });
  bot.sendMessage(chatId, "Добро пожаловать! Нажмите 'Поехали' для начала.", {
    reply_markup: {
      inline_keyboard: [
        [{ text: "Поехали 🚂", callback_data: "start_survey" }],
      ],
    },
  });
});

bot.onText(/\/survey/, async (msg) => {
  const chatId = msg.chat.id;
  userSessions.set(userId, {
    userId,
    username,
    isSurveyActive: true,
    botMessages: [],
  });
  const userId = msg.from.id;
  const username = msg.from.username
    ? `@${msg.from.username}`
    : `[Профиль](tg://user?id=${userId})`;
  const now = Date.now();

  // Удаляем старые сообщения бота, если есть
  await deletePreviousBotMessages(userId, chatId);

  lastSurveyTime[userId] = now;

  askDate(chatId);
});

async function deletePreviousBotMessages(userId, chatId) {
  const session = userSessions.get(userId);
  if (session?.botMessages?.length) {
    for (const messageId of session.botMessages) {
      try {
        await bot.deleteMessage(chatId, messageId);
      } catch (err) {
        console.error(`Ошибка удаления сообщения ${messageId}:`, err.message);
      }
    }
    session.botMessages = [];
  }
}

// Функция отправки сообщений с сохранением ID сообщений бота
async function sendBotMessage(chatId, text, options = {}) {
  try {
    if (!userSessions[chatId]) {
      userSessions[chatId] = { botMessages: [] };
    }
    const sentMessage = await bot.sendMessage(chatId, text, options);
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

const pendingRequests = {}; // Храним активные запросы

bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const userId = query.from.id;
  const username = query.from.username ? `@${query.from.username}` : null;
  const phoneNumber = query.from.phone_number
    ? `📞 ${query.from.phone_number}`
    : null;

  try {
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
        userSessions[chatId] = { userId, username, isSurveyActive: true };
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
        if (!session) {
          return bot.sendMessage(
            chatId,
            "❌ Произошла ошибка. Попробуйте позже."
          );
        }

        if (!session.username && !session.phoneNumber) {
          return bot.sendMessage(
            chatId,
            "❌ Мы не можем отправить ваши данные оператору. Пожалуйста, напишите Юрию напрямую: @yuriy_vel"
          );
        }

        if (pendingRequests[userId]) {
          return bot.answerCallbackQuery(query.id, {
            text: "⛔ Вы уже отправили заявку, ожидайте!",
            show_alert: true,
          });
        }

        pendingRequests[userId] = true; // Фиксируем заявку

        let adminMessage = `📩 *Новая заявка!*
          👤 *Пользователь*: ${session.username || `📞 ${session.phoneNumber}`}
          💬 Нажал кнопку "Свяжите меня с человеком".`;

        await bot.sendMessage(adminChatId, adminMessage, {
          parse_mode: "Markdown",
        });
        await bot.sendMessage(
          chatId,
          "✅ Ваша заявка отправлена. Скоро с вами свяжутся!"
        );
        bot.answerCallbackQuery(query.id, { text: "✅ Заявка обработана!" });
        break;
    }
  } catch (error) {
    console.error("Ошибка в обработке callback_query:", error);
    bot.sendMessage(chatId, "❌ Произошла ошибка. Попробуйте позже.");
  }
});

// ОБНОВЛЕННАЯ ФУНКЦИЯ ДЛЯ ВЫВОДА ИТОГОВ
function sendSummary(chatId) {
  if (!userSessions[chatId]) return; // Проверяем, есть ли активная сессия

  const session = userSessions[chatId];
  let totalPrice = calculatePrice(session);

  let contactInfo = session.username
    ? `[Профиль](tg://user?id=${chatId})`
    : session.phoneNumber
    ? `📞 ${session.phoneNumber}`
    : null;

  const summaryMessage =
    `📩 *Новый опрос*\n` +
    `👤 *Пользователь*: ${contactInfo}\n` +
    `📅 *Дата*: ${session.date}\n` +
    `🎉 *Событие*: ${session.event}\n` +
    `👥 *Гости*: ${session.guests}\n` +
    `📍 *Локация*: ${session.location}\n` +
    `⏳ *Длительность*: ${session.hours} ч.\n` +
    `💰 *Ожидания по бюджету*: ${session.budget} тыс. ₽\n` +
    `🔮 *3 слова про мероприятие*: ${session.words}\n` +
    `🖼 *Выбранный стиль*: ${session.selectedImage}\n` +
    `🎁 *Выбранный бонус*: ${session.bonus}\n` +
    `💵 *Итоговая стоимость*: ${totalPrice.toLocaleString()}₽`;

  bot.sendMessage(
    chatId,
    `✅ Ваша ориентировочная стоимость: ${totalPrice.toLocaleString()}₽\n\n` +
      `Я старался сэкономить наши время и нервы, поэтому стоимость максимально приближенная и все-таки ориентировочная. Окончательная смета после встречи и согласования программы.`,
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

  // Отправляем админу информацию о запросе
  bot.sendMessage(adminChatId, summaryMessage, { parse_mode: "Markdown" });
}

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
