// Система перекладів для української та литовської мов

export type Language = 'uk' | 'lt'

export const translations = {
  uk: {
    // Загальні
    back: 'Назад',
    save: 'Зберегти',
    cancel: 'Скасувати',
    confirm: 'Підтвердити',
    delete: 'Видалити',
    edit: 'Редагувати',
    add: 'Додати',
    search: 'Пошук',
    loading: 'Завантаження...',
    error: 'Помилка',
    success: 'Успішно',
    yes: 'Так',
    no: 'Ні',
    close: 'Закрити',
    
    // Інвентар
    inventory: 'Склад',
    inventoryManagement: 'Управління складом',
    itemReceipt: 'Приход товару',
    itemReceiptTablet: 'Приход товару (планшет)',
    itemName: 'Назва товару',
    currentStock: 'Залишок',
    quantity: 'Кількість',
    unit: 'Одиниця',
    price: 'Ціна',
    cost: 'Собівартість',
    supplier: 'Постачальник',
    category: 'Категорія',
    reason: 'Причина',
    
    // Одиниці виміру
    kg: 'кг',
    g: 'г',
    l: 'л',
    ml: 'мл',
    pcs: 'шт',
    pack: 'уп',
    
    // Форма приходу
    selectItem: 'Виберіть товар',
    quickAdd: 'Швидке додавання',
    manualInput: 'Ручне введення',
    packages: 'Упаковок',
    unitsPerPackage: 'Одиниць в упаковці',
    totalQuantity: 'Загальна кількість',
    costPerUnit: 'Ціна за одиницю',
    receiptReason: 'Причина приходу',
    defaultReason: 'Приход товару',
    submitReceipt: 'Підтвердити приход',
    saving: 'Збереження...',
    
    // Повідомлення
    itemNotSelected: 'Виберіть товар',
    enterQuantity: 'Введіть кількість',
    enterValidQuantity: 'Введіть коректну кількість (більше 0)',
    quantityTooLarge: 'Кількість занадто велика (максимум 10000)',
    enterValidPrice: 'Введіть коректну ціну',
    enterReason: 'Введіть причину приходу',
    receiptSuccess: 'Приход успішно збережено',
    receiptError: 'Помилка збереження',
    itemNotFound: 'Товар не знайдено',
    noItems: 'Немає товарів',
    
    // Адмін панель
    adminPanel: 'Адміністративна панель',
    dashboard: 'Головна',
    orders: 'Замовлення',
    menu: 'Меню',
    employees: 'Співробітники',
    reports: 'Звіти',
    settings: 'Налаштування',
    
    // Музичний плеєр
    musicPlayer: 'Музичний плеєр',
    play: 'Грати',
    pause: 'Пауза',
    next: 'Наступний',
    previous: 'Попередній',
    volume: 'Гучність',
    playlist: 'Плейлист',
  },
  
  lt: {
    // Bendri
    back: 'Atgal',
    save: 'Išsaugoti',
    cancel: 'Atšaukti',
    confirm: 'Patvirtinti',
    delete: 'Ištrinti',
    edit: 'Redaguoti',
    add: 'Pridėti',
    search: 'Paieška',
    loading: 'Kraunama...',
    error: 'Klaida',
    success: 'Sėkmingai',
    yes: 'Taip',
    no: 'Ne',
    close: 'Uždaryti',
    
    // Inventorius
    inventory: 'Sandėlis',
    inventoryManagement: 'Sandėlio valdymas',
    itemReceipt: 'Prekių gavimas',
    itemReceiptTablet: 'Prekių gavimas (planšetė)',
    itemName: 'Prekės pavadinimas',
    currentStock: 'Likutis',
    quantity: 'Kiekis',
    unit: 'Vienetas',
    price: 'Kaina',
    cost: 'Savikaina',
    supplier: 'Tiekėjas',
    category: 'Kategorija',
    reason: 'Priežastis',
    
    // Matavimo vienetai
    kg: 'kg',
    g: 'g',
    l: 'l',
    ml: 'ml',
    pcs: 'vnt',
    pack: 'pak',
    
    // Gavimo forma
    selectItem: 'Pasirinkite prekę',
    quickAdd: 'Greitas pridėjimas',
    manualInput: 'Rankinis įvedimas',
    packages: 'Pakuočių',
    unitsPerPackage: 'Vienetų pakuotėje',
    totalQuantity: 'Bendras kiekis',
    costPerUnit: 'Kaina už vienetą',
    receiptReason: 'Gavimo priežastis',
    defaultReason: 'Prekių gavimas',
    submitReceipt: 'Patvirtinti gavimą',
    saving: 'Išsaugoma...',
    
    // Pranešimai
    itemNotSelected: 'Pasirinkite prekę',
    enterQuantity: 'Įveskite kiekį',
    enterValidQuantity: 'Įveskite teisingą kiekį (daugiau nei 0)',
    quantityTooLarge: 'Kiekis per didelis (maksimumas 10000)',
    enterValidPrice: 'Įveskite teisingą kainą',
    enterReason: 'Įveskite gavimo priežastį',
    receiptSuccess: 'Gavimas sėkmingai išsaugotas',
    receiptError: 'Išsaugojimo klaida',
    itemNotFound: 'Prekė nerasta',
    noItems: 'Nėra prekių',
    
    // Admin skydelis
    adminPanel: 'Administravimo skydelis',
    dashboard: 'Pagrindinis',
    orders: 'Užsakymai',
    menu: 'Meniu',
    employees: 'Darbuotojai',
    reports: 'Ataskaitos',
    settings: 'Nustatymai',
    
    // Muzikos grotuvas
    musicPlayer: 'Muzikos grotuvas',
    play: 'Groti',
    pause: 'Pauzė',
    next: 'Kitas',
    previous: 'Ankstesnis',
    volume: 'Garsumas',
    playlist: 'Grojaraštis',
  }
}

export function getTranslation(lang: Language, key: keyof typeof translations.uk): string {
  return translations[lang][key] || translations.uk[key] || key
}

export function t(lang: Language) {
  return (key: keyof typeof translations.uk) => getTranslation(lang, key)
}
