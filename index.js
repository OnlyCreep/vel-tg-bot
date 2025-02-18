const TelegramBot = require('node-telegram-bot-api');
const token = '7339008763:AAHU4_ZQ1jKwdmOfSMg6WvN0VLW7MNIRHv0';
const bot = new TelegramBot(token, { polling: true });

// Таблица цен по прайсу Юрия Веля
const pricing = {
    "workdays": 11000, // Январь-май, сентябрь-ноябрь (вс-чт)
    "weekends": 14000, // Январь-май, сентябрь-ноябрь (пт-сб)
    "summer_workdays": 14000, // Лето (вс-чт)
    "summer_weekends": 15000, // Лето (пт-сб)
    "december_early": 14000, // Декабрь до 14.12
    "december_late": 15000  // Декабрь с 15.12
};

// Коэффициенты по количеству гостей
const guestMultiplier = {
    "До 50": 1,
    "50-75": 1.1,
    "76-100": 1.2,
    "101-150": 1.7,
    "151-200": 2,
    "200-300": 2.5
};

// Дополнительные расходы по локации
const locationExtra = {
    "Новосибирск": 0,
    "Пригород (до 30 км)": 5000,
    "Другое": 1.5
};

// Опции выбора
const eventOptions = ["Корпоратив", "Свадьба", "Выпускной", "День рождения", "Обучение/Тимбилдинг", "Другое"];
const guestOptions = Object.keys(guestMultiplier);
const locationOptions = Object.keys(locationExtra);
const budgetOptions = ["30-50", "51-75", "76-100", "101-150", "151-200", "Более 200"];
const imageOptions = ["📷 Картинка 1", "📷 Картинка 2", "📷 Картинка 3"];

let userSessions = {};

// Команда /start
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    
    // Сбрасываем всю предыдущую историю
    userSessions[chatId] = {}; 

    bot.sendMessage(chatId, "🎉 Добро пожаловать! Я помогу рассчитать стоимость мероприятия.\n\nВыберите команду:", {
        reply_markup: { keyboard: [["/survey"]], one_time_keyboard: true }
    }).then(() => {
        bot.sendMessage(chatId, "Важными факторами успешного праздника является слаженная работа ведущего и DJ, а также наличие хорошего оборудования, поэтому стоимость будет включать эти позиции.\n\n(Ведущий+DJ+Оборудование)");
    });
});

// Команда /survey — начало опроса
bot.onText(/\/survey/, (msg) => {
    const chatId = msg.chat.id;

    // Очищаем сессию перед началом нового опроса
    userSessions[chatId] = {}; 
    
    // Начинаем строго с вопроса о дате
    askDate(chatId);
});

// Вопрос о дате (без вариантов выбора, просто текстовый ввод)
function askDate(chatId) {
    bot.sendMessage(chatId, "📅 Введите дату мероприятия:", { reply_markup: { force_reply: true } });
}

// Обработчик ответов
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
            return bot.sendMessage(chatId, "🚨 Выберите один из предложенных вариантов:", {
                reply_markup: { keyboard: [eventOptions.slice(0, 3), eventOptions.slice(3)], one_time_keyboard: true }
            });
        }
        session.event = text;
        askGuests(chatId);
    } else if (!session.guests) {
        if (!guestOptions.includes(text)) {
            return bot.sendMessage(chatId, "🚨 Выберите количество гостей:", {
                reply_markup: { keyboard: [guestOptions.slice(0, 3), guestOptions.slice(3)], one_time_keyboard: true }
            });
        }
        session.guests = text;
        askLocation(chatId);
    } else if (!session.location) {
        if (!locationOptions.includes(text)) {
            return bot.sendMessage(chatId, "🚨 Выберите одно из предложенных мест:", {
                reply_markup: { keyboard: [locationOptions], one_time_keyboard: true }
            });
        }
        session.location = text;
        askHours(chatId);
    } else if (!session.hours) {
        const hours = parseInt(text);
        if (isNaN(hours) || hours <= 0) {
            return bot.sendMessage(chatId, "🚨 Введите корректное количество часов (только число).");
        }
        session.hours = hours;
        askBudget(chatId);
    } else if (!session.budget) {
        if (!budgetOptions.includes(text)) {
            return bot.sendMessage(chatId, "🚨 Выберите диапазон стоимости:", {
                reply_markup: { keyboard: [budgetOptions.slice(0, 3), budgetOptions.slice(3)], one_time_keyboard: true }
            });
        }
        session.budget = text;
        sendSummary(chatId);
    }
});

function sendSummary(chatId) {
    const session = userSessions[chatId];

    let basePrice;
    const date = new Date(session.date);
    const month = date.getMonth() + 1;
    const dayOfWeek = date.getDay();

    if ((month >= 1 && month <= 5) || (month >= 9 && month <= 11)) {
        basePrice = (dayOfWeek >= 5) ? pricing.weekends : pricing.workdays;
    } else if (month >= 6 && month <= 8) {
        basePrice = (dayOfWeek >= 5) ? pricing.summer_weekends : pricing.summer_workdays;
    } else if (month === 12) {
        basePrice = (date.getDate() < 15) ? pricing.december_early : pricing.december_late;
    } else {
        basePrice = pricing.weekends;
    }

    const guestFactor = guestMultiplier[session.guests] || 1;
    let locationCost = (session.location === "Другое") ? basePrice * 0.5 : locationExtra[session.location] || 0;
    const totalPrice = Math.round((basePrice * guestFactor * session.hours) + locationCost);

    bot.sendMessage(chatId, `✅ Ваша ориентировочная стоимость: ${totalPrice.toLocaleString()}₽\n\nЯ старался сэкономить наше время и нервы, поэтому стоимость максимально приближенная, но все-таки ориентировочная. Окончательная смета после встречи и согласования программы.`);

    bot.sendMessage(chatId, `🎁 Люблю делать подарки. При бронировании даты в течение суток, можно выбрать 🎁:\n1) Доп. час работы диджея\n2) 1.5 часа работы фотографа\n3) 1.5 часа работы рилсмейкера (вертикальные видео).`);

    delete userSessions[chatId];
}
