const TelegramBot = require("node-telegram-bot-api");
const moment = require("moment");
moment.locale("ru");

// Укажите ваш токен
const TOKEN = "7339008763:AAHU4_ZQ1jKwdmOfSMg6WvN0VLW7MNIRHv0";
const ADMIN_CHAT_ID = -4701713936;

const bot = new TelegramBot(TOKEN, { polling: true });

// Состояния пользователей
const userState = {};
const rateLimit = {};

// Настройки стоимости
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

const eventOptions = [
  "Корпоратив",
  "Свадьба",
  "Выпускной",
  "День рождения",
  "Обучение/Тимбилдинг",
  "Другое",
];

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
const budgetOptions = [
  "30-50",
  "51-75",
  "76-100",
  "101-150",
  "151-200",
  "Более 200",
];
const bonusOptions = [
  "Доп. час диджея",
  "1.5 часа фотографа",
  "1.5 часа рилсмейкера",
];

// Команда /start
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  userState[chatId] = { step: 1, totalPrice: 15000 };

  await bot.sendMessage(
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

// Обработка кнопки "Поехали"
bot.on("callback_query", async (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;

  if (callbackQuery.data === "start_survey") {
    userState[chatId] = { step: 1, baseRate: 15000 };
    await bot.sendMessage(
      chatId,
      "📆 Введите дату мероприятия (например, 15 января)"
    );
  }
});

bot.on("callback_query", async (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;

  if (data === "skip_words") {
    userState[chatId].threeWords = "Пропущено";
    userState[chatId].step++;
    await askImageChoice(chatId);
  }
});

const monthNames = {
  января: "январь",
  февраля: "февраль",
  марта: "март",
  апреля: "апрель",
  мая: "май",
  июня: "июнь",
  июля: "июль",
  августа: "август",
  сентября: "сентябрь",
  октября: "октябрь",
  ноября: "ноябрь",
  декабря: "декабрь",
};

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  if (chatId === ADMIN_CHAT_ID) return; // Игнорируем сообщения от админа

  // Проверяем, есть ли текст или контакт
  if (!msg.text && !msg.contact) {
    return bot.sendMessage(
      chatId,
      "⚠️ Пожалуйста, отправьте текстовое сообщение или контакт."
    );
  }

  // Если пользователь отправил контакт
  if (msg.contact) {
    if (!userState[chatId]) {
      userState[chatId] = { step: 0 };
    }
    userState[chatId].phone = msg.contact.phone_number;
    userState[chatId].name = msg.contact.first_name;
    return;
  }

  if (!msg.text) return; // Избегаем ошибки trim()
  const text = msg.text.trim();
  if (text.startsWith("/")) return; // Игнорируем команды

  // Если пользователь не начал опрос
  if (!userState[chatId] || userState[chatId].step === 0) {
    return bot.sendMessage(
      chatId,
      "Добро пожаловать! Нажмите 'Поехали' для начала.",
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "Поехали🚂", callback_data: "start_survey" }],
          ],
        },
      }
    );
  }

  const state = userState[chatId];

  console.log(`Текущий шаг: ${state.step}, Полученный текст: ${text}`);

  switch (state.step) {
    case 1:
      const dateMatch = text.match(/^(\d{1,2})\s([а-яё]+)$/i);
      if (!dateMatch) {
        return bot.sendMessage(chatId, "❗ Введите дату в формате: 15 января");
      }

      const day = parseInt(dateMatch[1]);
      const monthInput = dateMatch[2].toLowerCase();

      state.date = `${day} ${monthInput}`;
      state.baseRate = getBaseRate(day, monthInput); // Получаем базовую ставку
      state.step++;

      await bot.sendMessage(chatId, "🎉 Какое событие?", {
        reply_markup: {
          keyboard: eventOptions.map((e) => [e]),
          one_time_keyboard: true,
          resize_keyboard: true,
        },
      });
      break;

    case 2:
      if (!eventOptions.includes(text)) {
        return bot.sendMessage(
          chatId,
          "Выберите один из предложенных вариантов."
        );
      }

      state.event = text;
      state.step++;
      await bot.sendMessage(chatId, "👥 Количество гостей", {
        reply_markup: {
          keyboard: Object.keys(guestMultiplier).map((e) => [e]),
          one_time_keyboard: true,
        },
      });
      break;

    case 3:
      if (!guestMultiplier[text]) {
        return bot.sendMessage(
          chatId,
          "❗ Выберите один из предложенных вариантов."
        );
      }

      state.guestCount = text;
      state.totalPrice = state.baseRate * guestMultiplier[text]; // Умножаем базовую ставку на коэффициент гостей
      state.step++;

      await bot.sendMessage(chatId, "📍 Где пройдет мероприятие?", {
        reply_markup: {
          keyboard: Object.keys(locationExtra).map((e) => [e]),
          one_time_keyboard: true,
          resize_keyboard: true,
        },
      });
      break;

    case 4:
      if (!locationExtra.hasOwnProperty(text)) {
        return bot.sendMessage(
          chatId,
          "❗ Выберите один из предложенных вариантов."
        );
      }

      state.location = text;

      if (text === "Пригород (до 30 км)") {
        state.totalPrice += 5000; // Добавляем фиксированную сумму
      } else if (text === "Другое") {
        state.totalPrice *= 1.5; // Умножаем на коэффициент
      }

      state.step++;

      await bot.sendMessage(chatId, "⏳ Сколько часов будет мероприятие?");
      break;

    case 5:
      const hours = parseInt(text);
      if (isNaN(hours) || hours <= 0) {
        return bot.sendMessage(chatId, "❗ Введите пожалуйста число.");
      }

      state.hours = hours;
      state.totalPrice *= state.hours; // Умножаем на количество часов
      state.step++;

      await bot.sendMessage(
        chatId,
        "💰 Какая стоимость кажется адекватной заданным параметрам и ТЗ? (тыс.₽)",
        {
          reply_markup: {
            keyboard: budgetOptions.map((e) => [e]),
            one_time_keyboard: true,
            resize_keyboard: true,
          },
        }
      );
      break;

    case 6:
      if (!budgetOptions.includes(text)) {
        return bot.sendMessage(
          chatId,
          "❗ Выберите один из предложенных вариантов."
        );
      }

      state.budget = text;
      state.step++;
      await bot.sendMessage(
        chatId,
        "🔮 Какими 3 словами вы бы хотели запомнить мероприятие?",
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "Пропустить", callback_data: "skip_words" }],
            ],
          },
        }
      );
      break;

    case 7:
      const words = text.split(/\s+/);
      if (words.length !== 3) {
        return bot.sendMessage(
          chatId,
          "❗ Введите ровно три слова, разделенные пробелом."
        );
      }

      state.threeWords = text;
      state.step++; // Увеличиваем шаг перед вызовом askImageChoice

      await askImageChoice(chatId); // Вызываем функцию показа картинок
      break;

    case 8:
      await handleImageChoice(chatId, text);
      break;

    case 9:
      if (!bonusOptions.includes(text)) {
        return bot.sendMessage(
          chatId,
          "❗ Выберите один из предложенных бонусов."
        );
      }

      state.bonus = text;
      state.step++;

      await bot.sendMessage(
        chatId,
        `✅ Ваш бонус учтен! Спасибо за прохождение опроса.\n\n✅ Ваша ориентировочная стоимость: ${state.totalPrice}₽\nОкончательная смета после согласования.`,
        {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "Свяжите меня с человеком",
                  callback_data: "contact_me",
                },
              ],
              [
                {
                  text: "Интересные пакетные предложения",
                  callback_data: "package_offers",
                },
              ],
            ],
          },
        }
      );
      await sendAdminSummary(msg);
      break;

    case 10:
      const packageImages = {
        Корпоратив: ["./images/corporate1.jpg"],
        Выпускной: ["./images/graduation1.jpg", "./images/graduation2.jpg"],
        "День рождения": ["./images/birthday1.jpg"],
        Свадьба: ["./images/wedding1.jpg", "./images/wedding2.jpg"],
      };

      if (!packageImages[text]) {
        return bot.sendMessage(
          chatId,
          "❗ Выберите один из предложенных вариантов."
        );
      }

      state.package = text;

      for (const image of packageImages[text]) {
        await bot.sendPhoto(chatId, image);
      }

      await bot.sendMessage(chatId, "🔹 Узнать больше:", {
        reply_markup: {
          inline_keyboard: [
            [{ text: "Свяжите меня с человеком", callback_data: "contact_me" }],
            [
              {
                text: "Другие пакетные предложения",
                callback_data: "package_offers",
              },
            ],
          ],
        },
      });
      break;
  }
});

function getBaseRate(day, monthInput) {
  const month = monthInput.toLowerCase();
  if (!seasonRates[month]) return 15000; // Если месяц не найден, оставляем базовую цену

  if (month === "декабрь") {
    return day < 15 ? seasonRates[month]["до 14"] : seasonRates[month]["с 15"];
  }

  const dateString = `${day} ${month} 2024`; // Добавляем год для корректной проверки дня недели
  const weekday = moment(dateString, "D MMMM YYYY").isoWeekday();

  return weekday < 5
    ? seasonRates[month]["вс-чт"]
    : seasonRates[month]["пт-сб"];
}

// Обработка бюджета
async function askBudget(chatId) {
  userState[chatId].step = 6;
  await bot.sendMessage(
    chatId,
    "💰 Какая стоимость кажется адекватной заданным параметрам и ТЗ? (тыс.₽)",
    {
      reply_markup: {
        keyboard: budgetOptions.map((e) => [e]),
        one_time_keyboard: true,
      },
    }
  );
}

// Обработка выбора бюджета
async function handleBudget(chatId, text) {
  if (!budgetOptions.includes(text)) {
    return bot.sendMessage(chatId, "Выберите один из предложенных вариантов.");
  }
  userState[chatId].budget = text;
  await askThreeWords(chatId);
}

// Вопрос о трех словах
async function askThreeWords(chatId) {
  userState[chatId].step = 7;
  await bot.sendMessage(
    chatId,
    "🔮 Какими 3 словами вы бы хотели запомнить мероприятие?",
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "Пропустить", callback_data: "skip_words" }],
        ],
      },
    }
  );
}

// Обработка трех слов
async function handleThreeWords(chatId, text) {
  const words = text.split(/\s+/);
  if (words.length !== 3) {
    return bot.sendMessage(
      chatId,
      "❗ Введите ровно три слова, разделенные пробелом."
    );
  }
  userState[chatId].threeWords = text;
  await askImageChoice(chatId);
}

// Выбор картинки
async function askImageChoice(chatId) {
  userState[chatId].step = 8;

  const images = [
    {
      url: "https://vel-agency.sps.center/wp-content/uploads/2024/10/card_quiz_4_vel-e1740539781897.png",
      caption: "Девушка с синими аксессуарами (первая картинка слева)",
      title: "Девушка с аксессуарами",
    },
    {
      url: "https://vel-agency.sps.center/wp-content/uploads/2024/10/card_quiz_3_vel-e1740539861115.png",
      caption: "Уютная спальня с жёлтыми шторами (верхняя справа)",
      title: "Уютная спальня",
    },
    {
      url: "https://vel-agency.sps.center/wp-content/uploads/2024/10/card_quiz_2_vel-e1740539841526.png",
      caption: "Зелёные листья вблизи (по центру справа)",
      title: "Зелёные листья",
    },
    {
      url: "https://vel-agency.sps.center/wp-content/uploads/2024/10/card_quiz_1_vel.png",
      caption: "Женщина в роскошном образе с украшениями (нижняя справа)",
      title: "Женщина с украшениями",
    },
  ];

  // Отправляем все изображения как медиагруппу
  const mediaGroup = images.map((img) => ({
    type: "photo",
    media: img.url,
    caption: img.caption,
    parse_mode: "Markdown",
  }));

  await bot.sendMediaGroup(chatId, mediaGroup);

  // Создаем кнопки для выбора
  await bot.sendMessage(chatId, "Выберите картинку, которая вам нравится:", {
    reply_markup: {
      keyboard: images.map((img) => [img.title]), // Создаем кнопки с названиями картинок
      one_time_keyboard: true,
    },
  });
}

async function handleImageChoice(chatId, text) {
  const imageOptions = {
    "Девушка с аксессуарами": "первая картинка слева",
    "Уютная спальня": "верхняя справа",
    "Зелёные листья": "по центру справа",
    "Женщина с украшениями": "нижняя справа",
  };

  if (!imageOptions.hasOwnProperty(text)) {
    return bot.sendMessage(chatId, "Выберите картинку, используя кнопки ниже.");
  }

  userState[chatId].imageChoice = `${text} (${imageOptions[text]})`;
  userState[chatId].step++;

  await askBonus(chatId);
}

// Выбор бонуса
async function askBonus(chatId) {
  userState[chatId].step = 9;
  await bot.sendMessage(
    chatId,
    "🎁 Люблю делать подарки! Выберите один из бонусов:",
    {
      reply_markup: {
        keyboard: bonusOptions.map((e) => [e]),
        one_time_keyboard: true,
      },
    }
  );
}

// Обработка получения контакта
bot.on("contact", async (msg) => {
  const chatId = msg.chat.id;
  userState[chatId].phone = msg.contact.phone_number;
  userState[chatId].name = msg.contact.first_name;

  // Пересылаем контакт админу
  await bot.forwardMessage(ADMIN_CHAT_ID, chatId, msg.message_id);

  await bot.sendMessage(chatId, "✅ Контакт успешно отправлен.");
});

// Обработка бонуса
async function handleBonus(chatId, text) {
  if (!bonusOptions.includes(text)) {
    return bot.sendMessage(chatId, "Выберите один из предложенных бонусов.");
  }

  const state = userState[chatId];
  state.bonus = text;

  // Проверяем, что `totalPrice` корректно вычислен перед отправкой
  if (!state.totalPrice) {
    state.totalPrice = (state.baseRate || 15000) * (state.hours || 1);
  }

  await bot.sendMessage(
    chatId,
    `✅ Ваш бонус учтен! Спасибо за прохождение опроса.\n\n✅ Ваша ориентировочная стоимость: ${state.totalPrice}₽\nЯ старался сэкономить наши время и нервы, поэтому стоимость максимально приближенная и все-таки ориентировочная. Окончательная смета после встречи и согласования программы.`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "Свяжите меня с человеком", callback_data: "contact_me" }],
          [
            {
              text: "Интересные пакетные предложения",
              callback_data: "package_offers",
            },
          ],
        ],
      },
    }
  );

  await sendAdminSummary(chatId);
}

// Отправка результатов админу
async function sendAdminSummary(msg) {
  const state = userState[msg.chat.id];

  const summaryMessage = `
📩 *Новый опрос*\n
👤 *Пользователь*: @${msg.chat.username ?? "Неизвестно"}\n
📅 *Дата*: ${state.date}\n
🎉 *Событие*: ${state.event}\n
👥 *Гости*: ${state.guestCount}\n
📍 *Локация*: ${state.location}\n
⏳ *Длительность*: ${state.hours} ч.\n
💰 *Ожидания по бюджету*: ${state.budget} тыс. ₽\n
🔮 *3 слова про мероприятие*: ${state.threeWords || "Пропущено"}\n
🖼 *Выбранный стиль*: ${state.imageChoice}\n
🎁 *Выбранный бонус*: ${state.bonus}\n
💵 *Итоговая стоимость*: ${state.totalPrice}₽
`;

  await bot.sendMessage(ADMIN_CHAT_ID, summaryMessage, {
    parse_mode: "Markdown",
  });
}

bot.on("callback_query", async (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;

  if (data === "package_offers") {
    await askPackageOffer(chatId);
  }
});

bot.on("callback_query", async (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;

  if (data === "contact_me") {
    if (userState[chatId]?.contactRequested) {
      return bot.answerCallbackQuery(callbackQuery.id, {
        text: "Вы уже отправили запрос, ожидайте ответа.",
        show_alert: true,
      });
    }

    let contactInfo = await checkUserContact(chatId);

    if (!userState[chatId].phone) {
      await askForContact(chatId);
      return;
    }

    contactInfo += `, 📞 Телефон: ${userState[chatId].phone}`;

    userState[chatId].contactRequested = true;

    await bot.sendMessage(
      ADMIN_CHAT_ID,
      `📩 Новая заявка!\n👤 Пользователь: ${contactInfo}\n💬 Нажал кнопку "Свяжите меня с человеком".`
    );

    await bot.sendMessage(
      chatId,
      "Ваш запрос отправлен. Мы скоро с вами свяжемся!"
    );
  }
});

// Выбор пакетных предложений
async function askPackageOffer(chatId) {
  userState[chatId].step = 10;
  await bot.sendMessage(
    chatId,
    "Выберите интересующее вас пакетное предложение:",
    {
      reply_markup: {
        keyboard: [
          ["Корпоратив"],
          ["Выпускной"],
          ["День рождения"],
          ["Свадьба"],
        ],
        one_time_keyboard: true,
      },
    }
  );
}

// Обработка выбора пакета
async function handlePackageChoice(chatId, text) {
  const packageImages = {
    Корпоратив: ["./images/corporate1.jpg"],
    Выпускной: ["./images/graduation1.jpg", "./images/graduation2.jpg"],
    "День рождения": ["./images/birthday1.jpg"],
    Свадьба: ["./images/wedding1.jpg", "./images/wedding2.jpg"],
  };

  if (!packageImages[text]) {
    return bot.sendMessage(chatId, "Выберите один из предложенных вариантов.");
  }

  for (const image of packageImages[text]) {
    await bot.sendPhoto(chatId, image);
  }

  await bot.sendMessage(chatId, "🔹 Узнать больше:", {
    reply_markup: {
      inline_keyboard: [
        [{ text: "Свяжите меня с человеком", callback_data: "contact_me" }],
        [
          {
            text: "Другие пакетные предложения",
            callback_data: "package_offers",
          },
        ],
      ],
    },
  });
}

function isRateLimited(chatId) {
  const now = Date.now();
  if (rateLimit[chatId] && now - rateLimit[chatId] < 60000) {
    return true;
  }
  rateLimit[chatId] = now;
  return false;
}

bot.onText(/\/survey/, async (msg) => {
  const chatId = msg.chat.id;
  if (isRateLimited(chatId)) {
    return bot.sendMessage(
      chatId,
      "⛔ Подождите минуту перед повторным запуском опроса."
    );
  }

  userState[chatId] = { step: 1 }; // Начинаем опрос
  await bot.sendMessage(
    chatId,
    "📆 Введите дату мероприятия (например, 15 января)"
  );
});

async function askForContact(chatId) {
  await bot.sendMessage(
    chatId,
    "Пожалуйста, отправьте свой контакт, нажав на кнопку ниже:",
    {
      reply_markup: {
        keyboard: [
          [
            {
              text: "Отправить мой номер 📞",
              request_contact: true,
            },
          ],
        ],
        one_time_keyboard: true,
        resize_keyboard: true,
      },
    }
  );
}

async function checkUserContact(chatId) {
  try {
    const user = await bot.getChat(chatId);

    let contactInfo = "";

    if (user.username) {
      contactInfo = `@${user.username}`;
    } else if (user.first_name) {
      contactInfo = `${user.first_name} ${user.last_name || ""}`.trim();
    } else {
      contactInfo = "Неизвестный пользователь";
    }

    return contactInfo;
  } catch (error) {
    console.error("Ошибка получения данных пользователя:", error);
    return "Ошибка получения данных";
  }
}

function getSeasonRate(day, monthInput) {
  const monthNames = {
    январь: "январь",
    февраль: "февраль",
    март: "март",
    апрель: "апрель",
    май: "май",
    июнь: "июнь",
    июль: "июль",
    август: "август",
    сентябрь: "сентябрь",
    октябрь: "октябрь",
    ноябрь: "ноябрь",
    декабрь: "декабрь",
  };

  const month = monthInput.toLowerCase();
  if (!monthNames[month]) return null;

  if (month === "декабрь") {
    return day < 15 ? seasonRates[month]["до 14"] : seasonRates[month]["с 15"];
  }

  const dateString = `${day} ${month} 2024`; // Добавляем год для корректной проверки дня недели
  const weekday = moment(dateString, "D MMMM YYYY").isoWeekday();

  return weekday < 5
    ? seasonRates[month]["вс-чт"]
    : seasonRates[month]["пт-сб"];
}
