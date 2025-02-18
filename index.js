const TelegramBot = require('node-telegram-bot-api');
const token = '7339008763:AAHU4_ZQ1jKwdmOfSMg6WvN0VLW7MNIRHv0';
const bot = new TelegramBot(token, { polling: true });

const guestMultiplier = {
    "До 50": 1,
    "50-75": 1.1,
    "76-100": 1.2,
    "101-150": 1.7,
    "151-200": 2,
    "200-300": 2.5
};

const locationExtra = {
    "Новосибирск": 0,
    "Пригород (до 30 км)": 5000,
    "Другое": 1.5
};

const eventOptions = ["Корпоратив", "Свадьба", "Выпускной", "День рождения", "Обучение/Тимбилдинг", "Другое"];
const guestOptions = ["До 50", "50-75", "76-100", "101-150", "151-200", "200-300"];
const locationOptions = ["Новосибирск", "Пригород (до 30 км)", "Другое"];
const budgetOptions = ["30-50", "51-75", "76-100", "101-150", "151-200", "Более 200"];
const imageOptions = ["📷 Картинка 1", "📷 Картинка 2", "📷 Картинка 3"];

let userSessions = {};

// Команда /start
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    userSessions[chatId] = {}; // Очищаем предыдущую сессию
    bot.sendMessage(chatId, "Выберите команду:", {
        reply_markup: { keyboard: [["/survey"]], one_time_keyboard: true }
    });
});

// Команда /survey — начало опроса
bot.onText(/\/survey/, (msg) => {
    const chatId = msg.chat.id;
    userSessions[chatId] = {}; // Очищаем предыдущую сессию

    bot.sendMessage(chatId, "Важными факторами успешного праздника является слаженная работа ведущего и DJ, а также наличие хорошего оборудования, поэтому стоимость будет включать эти позиции.\n\n(Ведущий+DJ+Оборудование)", {
        reply_markup: { remove_keyboard: true }
    }).then(() => {
        askDate(chatId);
    });
});

function askDate(chatId) {
    bot.sendMessage(chatId, "📅 Введите дату мероприятия:", { reply_markup: { force_reply: true } });
}

// Обработчик сообщений после старта опроса
bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    if (!userSessions[chatId]) return;

    const session = userSessions[chatId];
    const text = msg.text;

    if (!session.date) {
        session.date = text;
        askEvent(chatId);
    } else if (!session.event) {
        if (!eventOptions.includes(text)) {
            return bot.sendMessage(chatId, "🚨 Пожалуйста, выберите один из предложенных вариантов:", {
                reply_markup: { keyboard: [eventOptions.slice(0, 2), eventOptions.slice(2, 4), eventOptions.slice(4)], one_time_keyboard: true }
            });
        }
        session.event = text;
        askGuests(chatId);
    } else if (!session.guests) {
        if (!guestOptions.includes(text)) {
            return bot.sendMessage(chatId, "🚨 Пожалуйста, выберите количество гостей:", {
                reply_markup: { keyboard: [guestOptions.slice(0, 2), guestOptions.slice(2, 4), guestOptions.slice(4)], one_time_keyboard: true }
            });
        }
        session.guests = text;
        askLocation(chatId);
    } else if (!session.location) {
        if (!locationOptions.includes(text)) {
            return bot.sendMessage(chatId, "🚨 Пожалуйста, выберите одно из предложенных мест:", {
                reply_markup: { keyboard: [locationOptions], one_time_keyboard: true }
            });
        }
        session.location = text;
        askVenue(chatId);
    } else if (!session.venue) {
        session.venue = text;
        askHours(chatId);
    } else if (!session.hours) {
        const hours = parseInt(text);
        if (isNaN(hours) || hours <= 0) {
            return bot.sendMessage(chatId, "🚨 Введите корректное количество часов (число).");
        }
        session.hours = hours;
        askBudget(chatId);
    } else if (!session.budget) {
        if (!budgetOptions.includes(text)) {
            return bot.sendMessage(chatId, "🚨 Пожалуйста, выберите диапазон стоимости:", {
                reply_markup: { keyboard: [budgetOptions.slice(0, 2), budgetOptions.slice(2, 4), budgetOptions.slice(4)], one_time_keyboard: true }
            });
        }
        session.budget = text;
        askImage(chatId);
    } else if (!session.image) {
        if (!imageOptions.includes(text)) {
            return bot.sendMessage(chatId, "🚨 Выберите изображение:", {
                reply_markup: { keyboard: [imageOptions], one_time_keyboard: true }
            });
        }
        session.image = text;
        askWords(chatId);
    } else if (!session.words) {
        session.words = text;
        askExtras(chatId);
    } else if (!session.extras) {
        session.extras = text;
        sendSummary(chatId);
    }
});

function askEvent(chatId) {
    bot.sendMessage(chatId, "🎉 Какое мероприятие? Выберите из списка:", {
        reply_markup: { keyboard: [eventOptions.slice(0, 2), eventOptions.slice(2, 4), eventOptions.slice(4)], one_time_keyboard: true }
    });
}

function askGuests(chatId) {
    bot.sendMessage(chatId, "👥 Сколько гостей?", {
        reply_markup: { keyboard: [guestOptions.slice(0, 2), guestOptions.slice(2, 4), guestOptions.slice(4)], one_time_keyboard: true }
    });
}

function askLocation(chatId) {
    bot.sendMessage(chatId, "📍 Где пройдет мероприятие?", {
        reply_markup: { keyboard: [locationOptions], one_time_keyboard: true }
    });
}

function askVenue(chatId) {
    bot.sendMessage(chatId, "🏢 Заведение/площадка (если выбрано):");
}

function askHours(chatId) {
    bot.sendMessage(chatId, "⏳ Сколько часов будет мероприятие? Введите число.");
}

function askBudget(chatId) {
    bot.sendMessage(chatId, "💰 Какая стоимость кажется адекватной?", {
        reply_markup: { keyboard: [budgetOptions.slice(0, 2), budgetOptions.slice(2, 4), budgetOptions.slice(4)], one_time_keyboard: true }
    });
}

function askImage(chatId) {
    bot.sendMessage(chatId, "📷 Выберите картинку по душе:", {
        reply_markup: { keyboard: [imageOptions], one_time_keyboard: true }
    });
}

function askWords(chatId) {
    bot.sendMessage(chatId, "🔮 Какими 3 словами вы бы хотели запомнить мероприятие?");
}

function askExtras(chatId) {
    bot.sendMessage(chatId, "🎭 Интересуют ли комплексные решения с привлечением артистов?");
}

function sendSummary(chatId) {
    const session = userSessions[chatId];

    // Базовая стоимость в зависимости от сезона и дня недели
    let basePrice = 14000; // Предположим, что по умолчанию пт-сб

    if (session.date) {
        const date = new Date(session.date);
        const month = date.getMonth() + 1; // Январь - 1, Декабрь - 12
        const dayOfWeek = date.getDay(); // Воскресенье - 0, Суббота - 6

        if ((month >= 1 && month <= 5) || (month >= 9 && month <= 11)) {
            basePrice = (dayOfWeek >= 5) ? 14000 : 11000; // Пт-Сб - 14к, Вс-Чт - 11к
        } else if (month === 6 || month === 7 || month === 8) {
            basePrice = (dayOfWeek >= 5) ? 15000 : 14000; // Пт-Сб - 15к, Вс-Чт - 14к
        } else if (month === 12) {
            basePrice = (date.getDate() < 15) ? 14000 : 15000; // До 14.12 - 14к, после - 15к
        }
    }

    // Коррекция стоимости по количеству гостей
    const guestFactor = guestMultiplier[session.guests] || 1;

    // Коррекция стоимости по местоположению
    let locationCost = 0;
    if (session.location === "Пригород (до 30 км)") {
        locationCost = 5000;
    } else if (session.location === "Другое") {
        locationCost = basePrice * 0.5; // Повышающий коэффициент *1.5
    }

    // Финальный расчет
    const totalPrice = (basePrice * guestFactor * session.hours) + locationCost;

    // Отправляем расчет клиенту
    bot.sendMessage(chatId, `✅ Ваша ориентировочная стоимость: ${totalPrice.toLocaleString()}₽\n\nЯ старался сэкономить наше время и нервы, поэтому стоимость максимально приближенная, но все-таки ориентировочная. Окончательная смета после встречи и согласования программы.`);

    bot.sendMessage(chatId, `🎁 Люблю делать подарки. При бронировании даты в течение суток, можно выбрать 🎁:\n1) Доп. час работы диджея\n2) 1.5 часа работы фотографа\n3) 1.5 часа работы рилсмейкера (вертикальные видео).`);

    delete userSessions[chatId];
}
