/* Shared UI language and appearance. Never translate user inputs or scientific data. */
(()=>{
 const rows=[['Technical data (JSON)','Texnik ma’lumotlar (JSON)','Технические данные (JSON)'],["Search sources", "Qidiruv manbalari", "Источники поиска"],
["Search covers PubMed only. This is not a general AI synthesis or treatment recommendation.", "Qidiruv faqat PubMed manbalarini qamraydi. Bu umumiy AI xulosasi yoki davolash tavsiyasi emas.", "Поиск охватывает только PubMed. Это не обобщение универсальной ИИ-модели и не рекомендация по лечению."],
["Actual search query", "Amalda qidirilgan so‘rov", "Фактический поисковый запрос"],
["No sources found. Refine your query and retry.", "Manba topilmadi. So‘rovni aniqlashtirib qayta urinib ko‘ring.", "Источники не найдены. Уточните запрос и повторите поиск."],
["Titles and excerpts are in their original language. Relevance and study type are assigned automatically; check the source yourself.", "Sarlavha va parchalar asl tilda berilgan. Moslik reytingi va tadqiqot turi avtomatik belgilanadi; manbani o‘zingiz tekshiring.", "Названия и выдержки приведены на языке оригинала. Релевантность и тип исследования определяются автоматически; проверьте источник самостоятельно."],
["Enter a research question or search term.", "Ilmiy savol yoki qidiruv so‘zini kiriting.", "Введите исследовательский вопрос или поисковый термин."],
["Searching PubMed sources…", "PubMed manbalari qidirilmoqda…", "Поиск источников PubMed…"],
["Search completed. Result recorded in report history.", "Qidiruv tugadi. Natija hisobotlar tarixiga yozildi.", "Поиск завершён. Результат записан в историю отчётов."],["Search by name or ID", "Nom yoki ID bo‘yicha qidirish", "Поиск по названию или ID"],
["Record type", "Yozuv turi", "Тип записи"],
["All", "Barchasi", "Все"],
["Reports", "Hisobotlar", "Отчёты"],
["Experiments", "Tajribalar", "Эксперименты"],
["Selected record", "Tanlangan yozuv", "Выбранная запись"],
["Download JSON", "JSON yuklab olish", "Скачать JSON"],
["Saved data is shown below. A report does not establish experimentally validated efficacy.", "Quyida saqlangan ma’lumotlar ko‘rsatiladi. Hisobot tajribada tasdiqlangan samaradorlikni anglatmaydi.", "Ниже показаны сохранённые данные. Отчёт не подтверждает экспериментально доказанную эффективность."],
["No matching records.", "Mos yozuv topilmadi.", "Подходящих записей нет."],
["Report", "Hisobot", "Отчёт"],
["Experiment", "Tajriba", "Эксперимент"],
["Open", "Ochish", "Открыть"],
["Previous", "Oldingi", "Назад"],
["History loaded.", "Tarix yuklandi.", "История загружена."],['Session changed. Reopen this section.','Sessiya o‘zgardi. Bo‘limni qayta oching.','Сессия изменилась. Откройте раздел снова.'],["Learn through computation: analyze a sequence, molecule or protein structure. This is not a physical laboratory experiment.", "Hisoblash orqali o‘rganing: ketma-ketlik, molekula yoki oqsil tuzilmasini tahlil qiling. Bu haqiqiy laboratoriya tajribasi emas.", "Учитесь с помощью вычислений: анализируйте последовательность, молекулу или структуру белка. Это не эксперимент в физической лаборатории."],
["Experiment name", "Tajriba nomi", "Название эксперимента"],
["For example: my first learning analysis", "Masalan: birinchi o‘quv tahlilim", "Например: мой первый учебный анализ"],
["Input method", "Kiritish usuli", "Способ ввода"],
["Simple fields", "Oddiy maydonlar", "Простые поля"],
["Expert JSON", "Mutaxassis uchun JSON", "JSON для специалистов"],
["DNA, RNA or protein sequence (optional)", "DNK, RNK yoki oqsil ketma-ketligi (ixtiyoriy)", "Последовательность ДНК, РНК или белка (необязательно)"],
["Insert DNA example", "DNK misolini qo‘yish", "Вставить пример ДНК"],
["Molecule SMILES (optional)", "Molekula SMILES (ixtiyoriy)", "SMILES молекулы (необязательно)"],
["Insert ethanol example", "Etanol misolini qo‘yish", "Вставить пример этанола"],
["PDB structure ID (optional)", "PDB tuzilma ID (ixtiyoriy)", "ID структуры PDB (необязательно)"],
["Insert protein example", "Oqsil misolini qo‘yish", "Вставить пример белка"],
["Fill at least one field. Only calculations matching your inputs will run.", "Kamida bitta maydonni to‘ldiring. Faqat kiritilgan ma’lumotga mos hisoblashlar bajariladi.", "Заполните хотя бы одно поле. Выполняются только расчёты, соответствующие вашим данным."],
["Start analysis", "Tahlilni boshlash", "Начать анализ"],
["Fill at least one analysis field.", "Kamida bitta tahlil maydonini to‘ldiring.", "Заполните хотя бы одно поле для анализа."],
["Enter a JSON object: { ... }", "JSON obyekt kiriting: { ... }", "Введите объект JSON: { ... }"],
["Protein structure", "Oqsil tuzilmasi", "Структура белка"],
["Report data", "Hisobot ma’lumotlari", "Данные отчёта"],
["Property-based comparison", "Xossalarga asoslangan taqqoslash", "Сравнение по свойствам"],
["Docking", "Dokking", "Докинг"],
["Completed", "Bajarildi", "Выполнено"],
["Error", "Xato", "Ошибка"],
["Skipped", "O‘tkazib yuborildi", "Пропущено"],
["Pending", "Kutilmoqda", "Ожидание"],
["More inputs needed", "Qo‘shimcha ma’lumot kerak", "Нужны дополнительные данные"],
["Sequence type", "Ketma-ketlik turi", "Тип последовательности"],
["Length", "Uzunlik", "Длина"],
["GC content", "GC ulushi", "Доля GC"],
["Molecular formula", "Molekulyar formula", "Молекулярная формула"],
["Molar mass", "Molyar massa", "Молярная масса"],
["Canonical SMILES", "Kanonik SMILES", "Канонический SMILES"],
["Explanation", "Izoh", "Пояснение"],
["This is a computational result, not evidence of drug efficacy or safety.", "Bu hisoblash natijasi; dori samaradorligi yoki xavfsizligi tasdig‘i emas.", "Это вычислительный результат, а не доказательство эффективности или безопасности лекарства."],
["Validating workflow inputs…", "Workflow ma’lumotlari tekshirilmoqda...", "Проверка данных процесса…"],
["Running scientific pipeline…", "Ilmiy pipeline bajarilmoqda...", "Выполнение научного процесса…"],
["Analysis completed; result and report saved.", "Ilmiy tajriba bajarildi; natija va hisobot saqlandi.", "Анализ выполнен; результат и отчёт сохранены."],
["Analysis completed; report was not created.", "Ilmiy tajriba bajarildi; hisobot yaratilmadi.", "Анализ выполнен; отчёт не создан."],["Place organs — learning game", "Organlarni joyiga qo‘y — haqiqiy mini-o‘yin", "Разместите органы — учебная игра"],
 ["Select an organ, then select its body region. Place as many correctly as you can in 60 seconds.", "Organni tanlang, so‘ng tanadagi mos joyini bosing. 60 soniyada imkon qadar ko‘pini to‘g‘ri joylashtiring.", "Выберите орган, затем соответствующую область тела. Разместите как можно больше органов за 60 секунд."],
 ["Time", "Vaqt", "Время"],
 ["Press Start!", "Boshlash tugmasini bosing!", "Нажмите «Начать»!"],
 ["Brain", "Miya", "Мозг"],
 ["HEAD", "BOSH", "ГОЛОВА"],
 ["CHEST", "KO‘KRAK", "ГРУДНАЯ КЛЕТКА"],
 ["UPPER ABDOMEN", "QORIN YUQORI QISMI", "ВЕРХНЯЯ ЧАСТЬ ЖИВОТА"],
 ["LOWER BACK", "BEL SOHASI", "ПОЯСНИЦА"],
 ["Pumps blood around the body.", "Qonni butun tanaga haydaydi.", "Перекачивает кровь по телу."],
 ["Participates in oxygen exchange.", "Kislorod almashinuvini bajaradi.", "Участвует в обмене кислорода."],
 ["Controls the nervous system.", "Asab tizimini boshqaradi.", "Управляет нервной системой."],
 ["Mixes food and helps digestion.", "Ovqatni aralashtirib hazm qilishga yordam beradi.", "Перемешивает пищу и помогает пищеварению."],
 ["Filters blood and produces urine.", "Qonni filtrlaydi va siydik hosil qiladi.", "Фильтрует кровь и образует мочу."],
 ["Selected:", "Tanlangan:", "Выбрано:"],
 ["Now select the matching body region.", "Endi mos tana qismini bosing.", "Теперь выберите соответствующую область тела."],
 ["First select an organ below.", "Avval pastdagi organni tanlang.", "Сначала выберите орган ниже."],
 ["This region does not match. Hint:", "Bu joy mos emas. Maslahat:", "Эта область не подходит. Подсказка:"],
 ["Well done! All organs are placed.", "Ajoyib! Barcha organlar joyida.", "Отлично! Все органы на месте."],
 ["Time is up.", "Vaqt tugadi.", "Время вышло."],
 ["Final score:", "Yakuniy ball:", "Итоговый балл:"],
 ["Press the button to play again.", "Qayta o‘ynash uchun tugmani bosing.", "Нажмите кнопку, чтобы сыграть снова."],
 ["Play again", "Qayta o‘ynash", "Играть снова"],
 ["Restart", "Qaytadan boshlash", "Начать заново"],
 ["Select an organ and its body region!", "Organni tanlang va mos tana qismini bosing!", "Выберите орган и соответствующую область тела!"],["symptom", "alomat", "симптом"],
 ["treatment", "davolash", "лечение"],
 ["blood pressure", "qon bosimi", "артериальное давление"],
 ["Good morning", "Xayrli tong", "Доброе утро"],
 ["How are you?", "Qalaysiz?", "Как Вы?"],
 ["Thank you", "Rahmat", "Спасибо"],
 ["reading comprehension", "o‘qib tushunish", "понимание прочитанного"],
 ["listening comprehension", "tinglab tushunish", "понимание речи на слух"],
 ["speaking", "gapirish", "говорение"],
 ["Hello", "Salom", "Здравствуйте"],
 ["How are things?", "Ishlaringiz qalay?", "Как дела?"],
 ["reading", "o‘qish", "чтение"],
 ["listening", "tinglash", "слушание"],
 ["I have read this", "O‘qib chiqdim", "Я прочитал(а)"],
 ["Saved as read", "O‘qilgan deb saqlandi", "Сохранено как прочитанное"],
 ["Marked in temporary memory", "Vaqtinchalik xotirada belgilandi", "Отмечено во временной памяти"],
 ["Not saved — retry", "Saqlanmadi — qayta urinish", "Не сохранено — повторить"],
 ["Learning results", "O‘quv natijalari", "Результаты обучения"],
 ["View results history ↓", "Natijalar tarixini ko‘rish ↓", "Посмотреть историю результатов ↓"],
 ["Loading saved results…", "Saqlangan natijalar yuklanmoqda…", "Загрузка сохранённых результатов…"],
 ["Saved practice results", "Saqlangan mashq natijalari", "Сохранённые результаты упражнений"],
 ["The latest 100 attempts are retained. These are not official grades or certificates.", "Oxirgi 100 urinish saqlanadi. Bu rasmiy baho yoki sertifikat emas.", "Сохраняются последние 100 попыток. Это не официальные оценки или сертификаты."],
 ["No results saved yet.", "Hali saqlangan natija yo‘q.", "Пока нет сохранённых результатов."],
 ["Language mini-lessons marked as read:", "O‘qilgan til mini-darslari (o‘zingiz belgilagan):", "Языковые мини-уроки, отмеченные вами как прочитанные:"],
 ["Results history could not load.", "Natijalar tarixi ochilmadi.", "Не удалось загрузить историю результатов."],
 ["Reopen the learning center after resolving the issue.", "Muammoni bartaraf etgach, o‘quv markazini qayta oching.", "После устранения проблемы откройте учебный центр снова."],
 ["Quick knowledge", "Tezkor bilim", "Быстрая викторина"],
 ["Theory exercise", "Nazariy mashq", "Теоретическое упражнение"],
 ["Clinical exercise", "Klinik mashq", "Клиническое упражнение"],
 ["Molecules", "Molekulalar", "Молекулы"],
 ["Organ placement", "Organlarni joylashtirish", "Размещение органов"],
 ["Cell lesson", "Hujayra darsi", "Урок о клетке"],
 ["Blood lesson", "Qon darsi", "Урок о крови"],
 ["Heart lesson", "Yurak darsi", "Урок о сердце"],
 ["DNA lesson", "DNK darsi", "Урок о ДНК"],
 ["Microbiology lesson", "Mikrobiologiya darsi", "Урок микробиологии"],
 ["Saving result to server…", "Natija serverga saqlanmoqda…", "Сохранение результата на сервере…"],
 ["Saved to database:", "Bazaga saqlandi:", "Сохранено в базе данных:"],
 ["In temporary server memory:", "Vaqtinchalik server xotirasida:", "Во временной памяти сервера:"],
 ["This may be lost when the server restarts.", "Server qayta ishga tushsa yo‘qolishi mumkin.", "При перезапуске сервера данные могут быть потеряны."],
 ["Saving has not been confirmed.", "Saqlash tasdiqlanmadi.", "Сохранение не подтверждено."],
 ["Save again", "Qayta saqlash", "Повторить сохранение"],
 ["Practice languages, exam preparation and medical knowledge in one place. These exercises do not replace an official certificate or examination.", "Tillar, sertifikat imtihonlari va tibbiy bilimlarni bir joyda mashq qiling. Bu mashqlar tayyorgarlik uchun; rasmiy sertifikat yoki imtihon o‘rnini bosmaydi.", "Практикуйте языки, подготовку к экзаменам и медицинские знания в одном месте. Эти упражнения не заменяют официальный сертификат или экзамен."],
 ["3D biology animation", "3D biologiya animatsiyasi", "3D-анимация по биологии"],
 ["Rotate the cell model to view its structure. This is a schematic learning model.", "Hujayra modelini aylantirib, tuzilishini ko‘ring. Bu o‘quv uchun sxematik model.", "Вращайте модель клетки, чтобы рассмотреть строение. Это схематическая учебная модель."],
 ["3D model loading…", "3D model yuklanmoqda…", "Загрузка 3D-модели…"],
 ["Rotating 3D cell learning model", "Aylanuvchi hujayraning 3D o‘quv modeli", "Вращающаяся учебная 3D-модель клетки"],
 ["Competitions and achievements", "Musobaqalar va yutuqlar", "Соревнования и достижения"],
 ["Learning exercises are available at this stage. Official competition schedules and verified certificates require separate integrations.", "Bu bosqichda o‘quv mashqlari mavjud. Rasmiy musobaqa jadvali va tasdiqlanadigan sertifikatlar alohida integratsiya qilinadi.", "На этом этапе доступны учебные упражнения. Официальное расписание соревнований и проверяемые сертификаты требуют отдельных интеграций."],
 ["Complete an exercise to track your result.", "Mashqni yakunlab o‘z natijangizni kuzating.", "Завершите упражнение, чтобы увидеть результат."],["Cell biology", "Hujayra biologiyasi", "Клеточная биология"],
 ["The cell is a structural and functional unit of living organisms. The membrane regulates transport into and out of the cell. Many reactions occur in the cytoplasm; the nucleus stores DNA. Mitochondria are important in cellular respiration and ATP production. Ribosomes synthesize proteins.", "Hujayra — tirik organizmlarning tuzilish va faoliyat birligi. Hujayra membranasi moddalar kirishi-chiqishini boshqaradi; sitoplazmada ko‘plab reaksiyalar kechadi; yadro DNKni saqlaydi. Mitoxondriya hujayra nafas olishi va ATP hosil bo‘lishida muhim. Ribosomalar oqsil sintez qiladi.", "Клетка — структурная и функциональная единица живых организмов. Мембрана регулирует поступление и выход веществ. В цитоплазме идут многие реакции; ядро хранит ДНК. Митохондрии важны для клеточного дыхания и образования АТФ. Рибосомы синтезируют белки."],
 ["What is a main function of mitochondria?", "Mitoxondriyaning asosiy vazifasi qaysi?", "Какова одна из основных функций митохондрий?"],
 ["Help produce ATP", "ATP ishlab chiqarishga yordam berish", "Участвовать в образовании АТФ"],
 ["Filter blood", "Qonni filtrlash", "Фильтровать кровь"],
 ["Transmit nerve impulses", "Nerv impulsini uzatish", "Передавать нервные импульсы"],
 ["Mitochondria play an important role in cellular energy metabolism.", "Mitoxondriya hujayra energiya almashinuvida muhim rol o‘ynaydi.", "Митохондрии играют важную роль в энергетическом обмене клетки."],
 ["Blood and blood cells", "Qon va qon hujayralari", "Кровь и клетки крови"],
 ["Blood consists of plasma and formed elements. Red blood cells primarily carry oxygen using hemoglobin. White blood cells contribute to immune defense. Platelets are important in blood clotting. These functions complement each other.", "Qon plazma va shaklli elementlardan iborat. Eritrotsitlar gemoglobin yordamida asosan kislorod tashiydi. Leykotsitlar immun himoyada qatnashadi. Trombotsitlar qon ivishida muhim. Bu vazifalar bir-birini to‘ldiradi.", "Кровь состоит из плазмы и форменных элементов. Эритроциты переносят главным образом кислород с помощью гемоглобина. Лейкоциты участвуют в иммунной защите. Тромбоциты важны для свёртывания крови. Эти функции дополняют друг друга."],
 ["Which element is important in blood clotting?", "Qon ivishida qaysi element muhim?", "Какой элемент важен для свёртывания крови?"],
 ["Platelet", "Trombotsit", "Тромбоцит"],
 ["Red blood cell", "Eritrotsit", "Эритроцит"],
 ["Neuron", "Neyron", "Нейрон"],
 ["Platelets participate in hemostasis.", "Trombotsitlar gemostaz jarayonida ishtirok etadi.", "Тромбоциты участвуют в гемостазе."],
 ["Heart and circulation", "Yurak va qon aylanishi", "Сердце и кровообращение"],
 ["The heart is a muscular organ with four chambers. Its right side sends blood to the lungs; its left side pumps oxygen-rich blood around the body. Valves help blood flow mainly in one direction. The circulatory system supplies tissues with oxygen and nutrients.", "Yurak to‘rt kamerali mushakli a’zo. O‘ng tomoni qonni o‘pkaga yuboradi, chap tomoni esa kislorodga boy qonni tana bo‘ylab haydaydi. Klapanlar qonning asosan bir yo‘nalishda oqishiga yordam beradi. Qon aylanish tizimi to‘qimalarga kislorod va oziqa yetkazadi.", "Сердце — мышечный орган с четырьмя камерами. Правая половина направляет кровь в лёгкие, левая — насыщенную кислородом кровь по телу. Клапаны обеспечивают преимущественно однонаправленный ток крови. Система кровообращения доставляет тканям кислород и питательные вещества."],
 ["What is the main function of the left ventricle?", "Chap qorinchaning asosiy vazifasi nima?", "Какова основная функция левого желудочка?"],
 ["Pump blood into systemic circulation", "Qonni katta qon aylanish doirasiga haydash", "Нагнетать кровь в большой круг кровообращения"],
 ["Filter air", "Havoni filtrlash", "Фильтровать воздух"],
 ["Produce bile", "Safro ishlab chiqarish", "Вырабатывать желчь"],
 ["The left ventricle pumps oxygen-rich blood into the aorta.", "Chap qorincha kislorodga boy qonni aortaga haydaydi.", "Левый желудочек нагнетает насыщенную кислородом кровь в аорту."],
 ["DNA and genetics", "DNK va genetika", "ДНК и генетика"],
 ["DNA stores hereditary information. Its nucleotides contain A, T, C and G bases. A gene is a DNA region involved in encoding or regulating a functional product. DNA replication copies genetic information before cell division.", "DNK irsiy axborotni saqlovchi molekuladir. Uning nukleotidlari A, T, C va G asoslarini tutadi. Gen — funksional mahsulotni kodlash yoki boshqarishda qatnashadigan DNK qismi. DNK replikatsiyasi hujayra bo‘linishidan oldin genetik axborotni nusxalashga yordam beradi.", "ДНК хранит наследственную информацию. Её нуклеотиды содержат основания A, T, C и G. Ген — участок ДНК, участвующий в кодировании или регуляции функционального продукта. Репликация ДНК копирует генетическую информацию перед делением клетки."],
 ["Which base pairs with adenine in DNA?", "DNKda adenin qaysi asos bilan juftlashadi?", "С каким основанием аденин образует пару в ДНК?"],
 ["Thymine", "Timin", "Тимин"],
 ["Guanine", "Guanin", "Гуанин"],
 ["Cytosine", "Sitozin", "Цитозин"],
 ["In double-stranded DNA, A usually pairs with T, and G with C.", "Ikki zanjirli DNKda A odatda T bilan, G esa C bilan juftlashadi.", "В двухцепочечной ДНК A обычно образует пару с T, а G — с C."],
 ["Microbiology basics", "Mikrobiologiya asoslari", "Основы микробиологии"],
 ["Microorganisms include bacteria, archaea, microscopic fungi and other microscopic biological entities. Viruses have no cellular structure and need a host cell to reproduce. Antibiotics are used against bacteria and do not act directly against viral infections.", "Mikroorganizmlarga bakteriyalar, arxeyalar, mikroskopik zamburug‘lar va ayrim boshqa mikroskopik biologik birliklar kiradi. Viruslar hujayraviy tuzilishga ega emas va ko‘payish uchun xo‘jayin hujayraga muhtoj. Antibiotiklar bakteriyalarga qarshi ishlatiladi, virusli infeksiyalarga bevosita ta’sir qilmaydi.", "К микроорганизмам относятся бактерии, археи, микроскопические грибы и другие микроскопические биологические объекты. Вирусы не имеют клеточного строения и нуждаются в клетке-хозяине для размножения. Антибиотики применяют против бактерий; они не действуют непосредственно на вирусные инфекции."],
 ["What are antibiotics primarily used against?", "Antibiotiklar asosan nimaga qarshi ishlatiladi?", "Против чего преимущественно применяют антибиотики?"],
 ["Bacteria", "Bakteriyalarga", "Бактерий"],
 ["All viruses", "Barcha viruslarga", "Всех вирусов"],
 ["An allergen", "Allergenga", "Аллергена"],
 ["Antibiotics act against bacteria and should be used only when medically indicated.", "Antibiotiklar bakteriyalarga ta’sir qiladi; ularni faqat tibbiy ko‘rsatma bilan qo‘llash kerak.", "Антибиотики действуют против бактерий; их следует применять только по медицинским показаниям."],
 ["Where does protein synthesis occur in a cell?", "Hujayrada oqsil sintezi qayerda kechadi?", "Где в клетке происходит синтез белка?"],
 ["In ribosomes", "Ribosomada", "В рибосомах"],
 ["In lysosomes", "Lizosomada", "В лизосомах"],
 ["In centrioles", "Sentriolada", "В центриолях"],
 ["Ribosomes synthesize proteins.", "Ribosomalar oqsil sintez qiladi.", "Рибосомы синтезируют белки."],
 ["Which blood element plays the main role in oxygen transport?", "Qaysi qon elementi kislorod tashishda asosiy rol o‘ynaydi?", "Какой элемент крови играет основную роль в переносе кислорода?"],
 ["Red blood cell", "Eritrotsit", "Эритроцит"],
 ["Platelet", "Trombotsit", "Тромбоцит"],
 ["White blood cell", "Leykotsit", "Лейкоцит"],
 ["Hemoglobin is found in red blood cells.", "Gemoglobin eritrotsitlarda joylashgan.", "Гемоглобин находится в эритроцитах."],
 ["Which base usually pairs with A in DNA?", "DNKdagi A odatda qaysi asos bilan juftlashadi?", "С каким основанием обычно образует пару A в ДНК?"],
 ["Thymine", "Timin", "Тимин"],
 ["Cytosine", "Sitozin", "Цитозин"],
 ["Guanine", "Guanin", "Гуанин"],
 ["DNA forms A–T and G–C base pairs.", "DNKda A–T va G–C juftlari hosil bo‘ladi.", "В ДНК образуются пары A–T и G–C."],
 ["Which chamber pumps blood into systemic circulation?", "Qonni katta qon aylanishiga qaysi kamera haydaydi?", "Какая камера нагнетает кровь в большой круг кровообращения?"],
 ["Left ventricle", "Chap qorincha", "Левый желудочек"],
 ["Right atrium", "O‘ng bo‘lmacha", "Правое предсердие"],
 ["Right ventricle", "O‘ng qorincha", "Правый желудочек"],
 ["The left ventricle pumps blood into the aorta.", "Chap qorincha qonni aortaga haydaydi.", "Левый желудочек нагнетает кровь в аорту."],
 ["Which microorganisms are antibiotics primarily used against?", "Antibiotiklar asosan qaysi mikroorganizmlarga qarshi ishlatiladi?", "Против каких микроорганизмов преимущественно применяют антибиотики?"],
 ["Bacteria", "Bakteriyalar", "Бактерии"],
 ["All viruses", "Barcha viruslar", "Все вирусы"],
 ["Prions", "Prionlar", "Прионы"],
 ["Antibiotics are used against bacteria.", "Antibiotiklar bakteriyalarga qarshi qo‘llanadi.", "Антибиотики применяют против бактерий."],
 ["A patient suddenly deteriorates and has difficulty breathing. In this learning scenario, what is the first principle?", "Bemorning holati keskin yomonlashdi va nafas olishi qiyinlashdi. O‘quv vaziyatida birinchi tamoyil qaysi?", "Состояние пациента резко ухудшилось, дыхание затруднено. Каков первый принцип в этой учебной ситуации?"],
 ["Call for urgent medical help and ensure safety", "Zudlik bilan shoshilinch tibbiy yordam chaqirish va xavfsizlikni ta’minlash", "Срочно вызвать медицинскую помощь и обеспечить безопасность"],
 ["Only search online for a medicine", "Faqat internetdan dori izlash", "Только искать лекарство в интернете"],
 ["Leave the patient alone", "Bemorni yolg‘iz qoldirish", "Оставить пациента одного"],
 ["Life-threatening signs require urgent professional assessment.", "Hayot uchun xavfli belgilar shoshilinch professional baholashni talab qiladi.", "Угрожающие жизни признаки требуют срочной профессиональной оценки."],
 ["What matters before interpreting a laboratory result?", "Laboratoriya natijasini talqin qilishdan oldin nima muhim?", "Что важно перед интерпретацией лабораторного результата?"],
 ["Check clinical context, units and reference intervals", "Klinik holat, birliklar va referens oralig‘ini tekshirish", "Проверить клиническую ситуацию, единицы и референсные интервалы"],
 ["Look only at one number", "Faqat bitta raqamga qarash", "Смотреть только на одно число"],
 ["Reach the same conclusion for all patients", "Barcha bemorlar uchun bir xil xulosa qilish", "Делать одинаковый вывод для всех пациентов"],
 ["Results are interpreted with clinical context and laboratory reference ranges.", "Natijalar klinik kontekst va laboratoriya me’yorlari bilan birga talqin qilinadi.", "Результаты интерпретируют с учётом клинической ситуации и лабораторных референсных интервалов."],
 ["Which safety check matters before prescribing a medicine?", "Dori buyurishdan oldin qaysi xavfsizlik tekshiruvi muhim?", "Какая проверка безопасности важна перед назначением лекарства?"],
 ["Check allergies, other medicines and contraindications", "Allergiya, boshqa dorilar va qarshi ko‘rsatmalarni tekshirish", "Проверить аллергии, другие лекарства и противопоказания"],
 ["Check only its color", "Faqat rangini tekshirish", "Проверить только цвет"],
 ["Guess the dose", "Dozani taxmin qilish", "Угадать дозу"],
 ["Medicine safety requires assessing allergies, interactions and contraindications.", "Dori xavfsizligi uchun allergiya, o‘zaro ta’sir va qarshi ko‘rsatmalar baholanadi.", "Для безопасности лекарства оценивают аллергии, взаимодействия и противопоказания."],
 ["What is an important rule when handling patient information?", "Bemor ma’lumotlari bilan ishlashning muhim qoidasi?", "Каково важное правило работы с информацией о пациенте?"],
 ["Maintain confidentiality and authorized access", "Maxfiylikni saqlash va ruxsatli foydalanish", "Соблюдать конфиденциальность и разрешённый доступ"],
 ["Send the information to everyone", "Ma’lumotni hammaga yuborish", "Отправлять информацию всем"],
 ["Publish personal information openly", "Shaxsiy ma’lumotni ochiq joylash", "Публиковать персональные данные открыто"],
 ["Medical information is confidential and should be used only for authorized purposes.", "Tibbiy ma’lumotlar maxfiy va faqat vakolatli maqsadda ishlatilishi kerak.", "Медицинская информация конфиденциальна и должна использоваться только для разрешённых целей."],
 ["What is the best approach when scientific evidence conflicts?", "Ilmiy dalillar qarama-qarshi bo‘lsa, eng to‘g‘ri yondashuv?", "Как лучше поступить, если научные данные противоречат друг другу?"],
 ["Assess evidence quality and state uncertainty openly", "Dalil sifatini baholash va noaniqlikni ochiq qayd etish", "Оценить качество доказательств и открыто указать неопределённость"],
 ["Blindly trust the first article found", "Birinchi topilgan maqolaga ko‘r-ko‘rona ishonish", "Слепо доверять первой найденной статье"],
 ["Hide uncertainty", "Noaniqlikni yashirish", "Скрывать неопределённость"],
 ["An evidence-based approach considers study quality and limitations.", "Dalillarga asoslangan yondashuvda tadqiqot sifati va cheklovlar hisobga olinadi.", "Доказательный подход учитывает качество и ограничения исследований."],
 ["Test yourself:", "O‘zingizni tekshiring:", "Проверьте себя:"],
 ["Correct.", "To‘g‘ri.", "Верно."],
 ["Not correct yet.", "Hali to‘g‘ri emas.", "Пока неверно."],
 ["Incorrect.", "Noto‘g‘ri.", "Неверно."],
 ["Exam completed", "Imtihon yakunlandi", "Экзамен завершён"],
 ["Retake", "Qayta topshirish", "Повторить"],
 ["View result", "Natijani ko‘rish", "Посмотреть результат"],
 ["Next question", "Keyingi savol", "Следующий вопрос"],
 ["Theory practice", "Nazariy imtihon", "Теоретическая практика"],
 ["Start theory practice", "Nazariy imtihonni boshlash", "Начать теоретическую практику"],
 ["Clinical practice", "Amaliy klinik imtihon", "Клиническая практика"],
 ["Start clinical practice", "Amaliy imtihonni boshlash", "Начать клиническую практику"],
 ["Open lesson", "Darsni ochish", "Открыть урок"],
 ["Choose a topic: read a short lesson, review key concepts and test yourself.", "Mavzuni tanlang: qisqa nazariya, asosiy tushunchalar va o‘zingizni tekshirish savoli chiqadi.", "Выберите тему: краткая теория, основные понятия и вопрос для самопроверки."],
 ["5 questions with feedback after each answer and a final score.", "5 ta savol, javobni tanlagandan keyin izoh va yakuniy ball.", "5 вопросов с пояснением после ответа и итоговым баллом."],
 ["Practice clinical reasoning through scenarios. This is not a diagnosis or medical consultation.", "Vaziyatli savollar orqali klinik fikrlashni mashq qiling. Bu tashxis yoki shifokor maslahati emas.", "Тренируйте клиническое мышление на ситуационных вопросах. Это не диагноз и не медицинская консультация."],
 ["Press Open lesson.", "Darsni ochish tugmasini bosing.", "Нажмите «Открыть урок»."],
 ["Theory lessons", "Haqiqiy nazariya darslari", "Теоретические уроки"],
 ["Topic", "Mavzu", "Тема"],
 ['Zoom in','Yaqinlashtirish','Приблизить'],['Zoom out','Uzoqlashtirish','Отдалить'],
 ['Start rotation','Aylanishni boshlash','Включить вращение'],['Pause rotation','Aylanishni to‘xtatish','Остановить вращение'],
 ['Reset view','Ko‘rinishni tiklash','Сбросить вид'],
 ['Schematic learning model. Drag or use arrow keys to rotate; use the zoom buttons.','Sxematik o‘quv modeli. Sudrab yoki yo‘nalish tugmalari bilan aylantiring; kattalashtirish tugmalaridan foydalaning.','Схематическая учебная модель. Вращайте мышью или стрелками; используйте кнопки масштаба.'],
 ['3D cell: use arrow keys to rotate','3D hujayra: yo‘nalish tugmalari bilan aylantiring','3D-клетка: вращайте клавишами со стрелками'],
 ['3D library could not load. Check your internet connection.','3D kutubxonasi yuklanmadi. Internet ulanishini tekshiring.','Библиотека 3D не загрузилась. Проверьте подключение к интернету.'],

 [
  "Quick knowledge game",
  "Tezkor bilim o‘yini",
  "Быстрая викторина"
 ],
 [
  "Answer biology and medical terminology questions and earn points.",
  "Biologiya va tibbiyot terminlari bo‘yicha savolga javob bering, ball to‘plang.",
  "Отвечайте на вопросы по биологии и медицинским терминам и набирайте баллы."
 ],
 [
  "Start game",
  "O‘yinni boshlash",
  "Начать игру"
 ],
 [
  "Question",
  "Savol",
  "Вопрос"
 ],
 [
  "Result",
  "Natija",
  "Результат"
 ],
 [
  "Score",
  "Ball",
  "Баллы"
 ],
 [
  "Next",
  "Keyingi",
  "Далее"
 ],
 [
  "Play again",
  "Yana o‘ynash",
  "Играть снова"
 ],
 [
  "Game finished!",
  "O‘yin tugadi!",
  "Игра завершена!"
 ],
 [
  "What does “blood pressure” mean?",
  "“Blood pressure” nimani anglatadi?",
  "Что означает «blood pressure»?"
 ],
 [
  "Blood pressure",
  "Qon bosimi",
  "Артериальное давление"
 ],
 [
  "Blood group",
  "Qon guruhi",
  "Группа крови"
 ],
 [
  "Heartbeat",
  "Yurak urishi",
  "Сердцебиение"
 ],
 [
  "Which organ pumps blood?",
  "Qaysi organ qonni haydaydi?",
  "Какой орган перекачивает кровь?"
 ],
 [
  "Lung",
  "O‘pka",
  "Лёгкое"
 ],
 [
  "Heart",
  "Yurak",
  "Сердце"
 ],
 [
  "Kidney",
  "Buyrak",
  "Почка"
 ],
 [
  "What does “symptom” mean?",
  "“Symptom” so‘zining ma’nosi?",
  "Что означает «symptom»?"
 ],
 [
  "Treatment",
  "Davolash",
  "Лечение"
 ],
 [
  "Sign of a condition",
  "Alomat",
  "Признак состояния"
 ],
 [
  "Analysis",
  "Tahlil",
  "Анализ"
 ],
 [
  "Which organ is called “kidney” in English?",
  "Inglizcha “kidney” qaysi a’zo?",
  "Какой орган по-английски называется «kidney»?"
 ],
 [
  "Liver",
  "Jigar",
  "Печень"
 ],
 [
  "Stomach",
  "Oshqozon",
  "Желудок"
 ],
 [
  "What does the Russian word “Здоровье” mean?",
  "“Здоровье” so‘zi o‘zbekchada nima?",
  "Какое значение имеет слово «Здоровье»?"
 ],
 [
  "Disease",
  "Kasallik",
  "Болезнь"
 ],
 [
  "Health",
  "Sog‘liq",
  "Здоровье"
 ],
 [
  "Medicine",
  "Dori",
  "Лекарство"
 ],
 [
  "Where does photosynthesis mainly occur in plants?",
  "Fotosintez asosan qayerda sodir bo‘ladi?",
  "Где у растений в основном происходит фотосинтез?"
 ],
 [
  "In leaves",
  "Barglarda",
  "В листьях"
 ],
 [
  "At root tips",
  "Ildiz uchida",
  "На кончиках корней"
 ],
 [
  "In pollen",
  "Gul changida",
  "В пыльце"
 ],
 [
  "Which cell is important for oxygen transport in blood?",
  "Qonning kislorod tashishida qaysi hujayra muhim?",
  "Какая клетка важна для переноса кислорода кровью?"
 ],
 [
  "Red blood cell",
  "Eritrotsit",
  "Эритроцит"
 ],
 [
  "Platelet",
  "Trombotsit",
  "Тромбоцит"
 ],
 [
  "Neuron",
  "Neyron",
  "Нейрон"
 ],
 [
  "What does “to learn” mean?",
  "Inglizcha “to learn” nimani bildiradi?",
  "Что означает «to learn»?"
 ],
 [
  "To teach",
  "O‘qitmoq",
  "Обучать"
 ],
 [
  "To learn",
  "O‘rganmoq",
  "Учиться"
 ],
 [
  "To write",
  "Yozmoq",
  "Писать"
 ],
 [
  "Which organs are “Лёгкие”?",
  "“Лёгкие” qaysi a’zolar?",
  "Какие органы обозначает слово «Лёгкие»?"
 ],
 [
  "Kidneys",
  "Buyraklar",
  "Почки"
 ],
 [
  "Intestines",
  "Ichaklar",
  "Кишечник"
 ],
 [
  "What is the main function of DNA?",
  "DNKning asosiy vazifasi nima?",
  "Какова основная функция ДНК?"
 ],
 [
  "Store genetic information",
  "Genetik axborotni saqlash",
  "Хранить генетическую информацию"
 ],
 [
  "Digest food",
  "Ovqatni hazm qilish",
  "Переваривать пищу"
 ],
 [
  "Pump blood",
  "Qonni haydash",
  "Перекачивать кровь"
 ],
 [
  "What does “careful” mean?",
  "Inglizcha “careful” so‘zi nimani anglatadi?",
  "Что означает «careful»?"
 ],
 [
  "Careful",
  "Ehtiyotkor",
  "Осторожный"
 ],
 [
  "Tired",
  "Charchagan",
  "Уставший"
 ],
 [
  "Fast",
  "Tezkor",
  "Быстрый"
 ],
 [
  "Which system includes the brain and spinal cord?",
  "Miya va orqa miya qaysi tizimga kiradi?",
  "К какой системе относятся головной и спинной мозг?"
 ],
 [
  "Respiration",
  "Nafas olish",
  "Дыхание"
 ],
 [
  "Nervous system",
  "Asab tizimi",
  "Нервная система"
 ],
 [
  "Digestion",
  "Ovqat hazm qilish",
  "Пищеварение"
 ],
 [
  "Molecule matching game",
  "Molekula moslashtirish o‘yini",
  "Сопоставление молекул"
 ],
 [
  "Match each molecule or biomolecule with its function. Each correct answer earns 10 points.",
  "Molekula yoki biomolekula nomini uning vazifasi bilan moslang. Har to‘g‘ri javob +10 ball.",
  "Сопоставьте молекулу или биомолекулу с её функцией. За правильный ответ — 10 баллов."
 ],
 [
  "DNA",
  "DNK",
  "ДНК"
 ],
 [
  "Hemoglobin",
  "Gemoglobin",
  "Гемоглобин"
 ],
 [
  "Insulin",
  "Insulin",
  "Инсулин"
 ],
 [
  "Antibody",
  "Antitana",
  "Антитело"
 ],
 [
  "Stores hereditary information",
  "Irsiy axborotni saqlaydi",
  "Хранит наследственную информацию"
 ],
 [
  "Participates in oxygen transport",
  "Kislorod tashishda qatnashadi",
  "Участвует в переносе кислорода"
 ],
 [
  "Helps regulate blood glucose",
  "Qondagi glyukozani boshqarishga yordam beradi",
  "Помогает регулировать уровень глюкозы в крови"
 ],
 [
  "One of the main energy carriers in cells",
  "Hujayraning asosiy energiya tashuvchilaridan biri",
  "Один из основных переносчиков энергии в клетке"
 ],
 [
  "Recognizes and binds a specific antigen",
  "Muayyan antigenni tanib bog‘lanadi",
  "Распознаёт и связывает определённый антиген"
 ],
 [
  "Correct!",
  "To‘g‘ri!",
  "Верно!"
 ],
 [
  "Correct match:",
  "To‘g‘ri moslik:",
  "Правильное соответствие:"
 ],
 [
  "Try again to improve your result.",
  "Yana mashq qilib natijani yaxshilashingiz mumkin.",
  "Попробуйте ещё раз, чтобы улучшить результат."
 ],
 [
  "Last game result",
  "Oxirgi mini-o‘yin natijasi",
  "Результат последней игры"
 ],
 [
  "matches",
  "moslik",
  "совпадений"
 ],
 [
  "points",
  "ball",
  "баллов"
 ]
,
 ['Listen','Tinglash','Прослушать'],['Show meaning','Ma’nosini ko‘rsatish','Показать значение'],['Hide meaning','Ma’nosini yashirish','Скрыть значение'],
 ['Audio is unavailable on this device.','Bu qurilmada ovozli o‘qish mavjud emas.','Озвучивание недоступно на этом устройстве.'],
 ['English','Ingliz tili','Английский'],['Russian','Rus tili','Русский'],['German','Nemis tili','Немецкий'],['French','Fransuz tili','Французский'],
 ['Language','Til','Язык'],['Track','Yo‘nalish','Направление'],['Medical language','Tibbiyot uchun','Медицинский язык'],['General communication','Umumiy muloqot','Общее общение'],['Certificate exam','Sertifikat imtihoni','Сертификационный экзамен'],
 ['Start lesson','Darsni boshlash','Начать урок'],['Choose a language and track.','Til va yo‘nalishni tanlang.','Выберите язык и направление.'],
 ['Today’s mini-lesson','Bugungi mini-dars','Мини-урок на сегодня'],['Read each phrase aloud and make your own sentence.','Har bir iborani ovoz chiqarib o‘qing va o‘zingiz gap tuzing.','Прочитайте каждую фразу вслух и составьте своё предложение.'],
 ['🗣️ Language courses','🗣️ Til kurslari','🗣️ Языковые курсы'],['🌍 Learning center','🌍 O‘rganish markazi','🌍 Учебный центр'],

 ['Show AlphaFold model','AlphaFold modelini ko‘rsatish','Показать модель AlphaFold'],
 ['Enter a UniProt ID, for example P69905.','UniProt ID kiriting, masalan P69905.','Введите UniProt ID, например P69905.'],
 ['3D viewer could not load. Check your connection and reload.','3D ko‘ruvchi yuklanmadi. Internetni tekshirib sahifani yangilang.','3D-просмотрщик не загрузился. Проверьте подключение и обновите страницу.'],
 ['Mean pLDDT','O‘rtacha pLDDT','Средний pLDDT'],
 ['Predicted structure, not proof of drug efficacy.','Bashorat qilingan tuzilma; dori samaradorligi tasdig‘i emas.','Предсказанная структура, а не доказательство эффективности лекарства.'],

 ['Use learning example','O‘quv misolini qo‘yish','Вставить учебный пример'],
 ['🧬 Molecular Visual Lab','🧬 Molekulyar vizual laboratoriya','🧬 Молекулярная визуальная лаборатория'],
 ['2D chemical structure + interactive 3D molecule/protein viewer.','2D kimyoviy tuzilma va aylantiriladigan 3D molekula/oqsil modeli.','2D химическая структура и интерактивная 3D-модель молекулы/белка.'],
 ['2D Structure','2D tuzilma','2D структура'],['3D Molecule / Protein','3D molekula / oqsil','3D молекула / белок'],
 ['Render 2D','2D ko‘rsatish','Показать 2D'],['Show Molecule 3D','Molekulani 3D ko‘rsatish','Показать молекулу в 3D'],['Show Protein 3D','Oqsilni 3D ko‘rsatish','Показать белок в 3D'],
 ['Workflow name','Ish jarayoni nomi','Название процесса'],['Target (e.g. EGFR)','Nishon (masalan, EGFR)','Мишень (например, EGFR)'],
 ['PDB ID (optional)','PDB ID (ixtiyoriy)','PDB ID (необязательно)'],['Chain ID (optional)','Zanjir ID (ixtiyoriy)','ID цепи (необязательно)'],
 ['Sequence (optional)','Ketma-ketlik (ixtiyoriy)','Последовательность (необязательно)'],['Ligand SMILES (optional)','Ligand SMILES (ixtiyoriy)','SMILES лиганда (необязательно)'],
 ['Similarity library: one SMILES per line (optional)','Taqqoslash: har qatorda bitta SMILES (ixtiyoriy)','Сравнение: один SMILES в строке (необязательно)'],
 ['End-to-End Scientific Workflow','Bosqichma-bosqich ilmiy ish jarayoni','Поэтапный научный процесс'],
 ['Structure → Sequence → Molecular Analysis → Similarity → Experiment.','Tuzilma → Ketma-ketlik → Molekulyar tahlil → O‘xshashlik → Tajriba yozuvi.','Структура → Последовательность → Молекулярный анализ → Сходство → Запись эксперимента.'],

 ['Search PubMed evidence','PubMed manbalarini qidirish','Поиск источников PubMed'],
 ['You','Siz','Вы'],['Search query','Qidiruv so‘rovi','Поисковый запрос'],['Request failed','So‘rov bajarilmadi','Запрос не выполнен'],
 ['Username','Foydalanuvchi nomi','Имя пользователя'],
 ['Password','Parol','Пароль'],['Confirm password','Parolni tasdiqlash','Подтвердите пароль'],
 ['Full name','To‘liq ism','Полное имя'],['Email','Elektron pochta','Электронная почта'],['Phone number','Telefon raqami','Номер телефона'],
 ['Register','Ro‘yxatdan o‘tish','Регистрация'],['Back to sign in','Kirishga qaytish','Вернуться ко входу'],
 ['Global Biomedical AI Platform','Global biotibbiy sun’iy intellekt platformasi','Глобальная биомедицинская ИИ-платформа'],
 ['Global Biomedical AI Platform — registration is available.','Global biotibbiy platforma — ro‘yxatdan o‘tish mumkin.','Глобальная биомедицинская платформа — регистрация открыта.'],
 ['Your primary professional role','Sizning asosiy professional rolingiz','Ваша основная профессиональная роль'],
 ['Choose one primary role. Additional roles require administrator approval.','Faqat bitta asosiy rol tanlang. Keyingi rollar CEO/Admin tasdig‘idan keyin ochiladi.','Выберите одну основную роль. Дополнительные роли требуют одобрения администратора.'],
 ['Select your primary role.','Asosiy rolni tanlang.','Выберите основную роль.'],
 ['Student','Talaba','Студент'],['Doctor','Shifokor','Врач'],['Researcher','Olim / Researcher','Исследователь'],
 ['Professor','Professor','Профессор'],['Laboratory Specialist','Laborant','Лаборант'],['Biotechnologist','Biotexnolog','Биотехнолог'],
 ['Pharma','Farmatsevtika','Фармацевтика'],['Bioinformatician','Bioinformatik','Биоинформатик'],['Hospital','Klinika / Hospital','Клиника / Больница'],
 ['Biotech / Pharma Company','Biotexnologiya / farmatsevtika kompaniyasi','Биотехнологическая / фармацевтическая компания'],
 ['Medical Academy','Tibbiyot akademiyasi','Медицинская академия'],['Clinical Workspace','Klinik ish maydoni','Клиническое рабочее пространство'],
 ['Research Workspace','Tadqiqot maydoni','Исследовательское пространство'],['Teaching Workspace','O‘qitish maydoni','Преподавательское пространство'],
 ['Laboratory','Laboratoriya','Лаборатория'],['Biotechnology','Biotexnologiya','Биотехнология'],['Drug Discovery','Dori tadqiqoti','Исследование лекарств'],
 ['Omics & Pipelines','Omiks va tahlil jarayonlari','Омикс и процессы анализа'],['Clinical Training','Klinik ta’lim','Клиническое обучение'],['Enterprise','Tashkilot','Организация'],
 ['☰ Menu','☰ Menyu','☰ Меню'],['My profile','Profilim','Мой профиль'],
 ['Molecular Analysis','Molekulyar tahlil','Молекулярный анализ'],['Bioinformatics','Bioinformatika','Биоинформатика'],
 ['PDB & Structure','PDB va tuzilma','PDB и структура'],['Research Assistant','Ilmiy yordamchi','Научный помощник'],
 ['Virtual Laboratory','Virtual laboratoriya','Виртуальная лаборатория'],['Scientific Jobs','Hisoblash vazifalari','Вычислительные задачи'],
 ['Global Platform','Tashkilotlar platformasi','Платформа организаций'],['Reports & History','Hisobotlar va tarix','Отчёты и история'],
 ['Learning Hub','O‘quv markazi','Учебный центр'],['Education center','Ta’lim markazi','Образовательный центр'],
 ['Lessons, practice and learning results.','Darslar, mashqlar va o‘quv natijalari.','Уроки, упражнения и результаты обучения.'],
 ['Analyze DNA, RNA and protein sequences.','DNK, RNK va oqsil ketma-ketliklarini tahlil qilish.','Анализ последовательностей ДНК, РНК и белков.'],
 ['Molecules and 3D','Molekula va 3D','Молекулы и 3D'],['Molecular properties, structures and scientific comparisons.','Molekulyar xossalar, tuzilmalar va ilmiy taqqoslash.','Молекулярные свойства, структуры и научные сравнения.'],
 ['Scientific research','Ilmiy tadqiqot','Научные исследования'],['Find sources and examine evidence.','Manbalarni topish va dalillar bilan ishlash.','Поиск источников и работа с доказательствами.'],
 ['Scientific workflows and computational tasks.','Ilmiy ish jarayonlari va hisoblash vazifalari.','Научные процессы и вычислительные задачи.'],
 ['Management','Boshqaruv paneli','Управление'],['Organizations, users and permissions.','Tashkilot, foydalanuvchilar va ruxsatlar.','Организации, пользователи и разрешения.'],
 ['Practice and learning history','Mashqlar va o‘quv tarixi','Упражнения и история обучения'],['Clinical reference','Klinik ma’lumotnoma','Клинический справочник'],
 ['Clinical practice','Klinik mashqlar','Клинические упражнения'],['Sequence analysis','Ketma-ketlik tahlili','Анализ последовательности'],
 ['Molecular properties','Molekula xossalari','Свойства молекул'],['Structure viewer','Tuzilma ko‘ruvchisi','Просмотр структур'],
 ['Scientific sources','Ilmiy manbalar','Научные источники'],['Workflows','Ish jarayonlari','Рабочие процессы'],
 ['Organizations and projects','Tashkilot va loyihalar','Организации и проекты'],['Scientific reports','Ilmiy hisobotlar','Научные отчёты'],
 ['PERSONAL WORKSPACE','SHAXSIY KABINET','ЛИЧНЫЙ КАБИНЕТ'],['Home','Bosh sahifa','Главная'],
 ['Security and consent','Xavfsizlik va roziliklar','Безопасность и согласия'],['KNOWLEDGE · ANALYSIS · RESEARCH','BILIM · TAHLIL · TADQIQOT','ЗНАНИЯ · АНАЛИЗ · ИССЛЕДОВАНИЯ'],
 ['Your scientific workspace','Yagona ilmiy kabinet','Ваш научный кабинет'],
 ['Choose a section. Tools and permissions match your account.','Kerakli bo‘limni tanlang. Vositalar va ruxsatlar akkauntingizga mos ko‘rsatiladi.','Выберите раздел. Инструменты и разрешения соответствуют вашему аккаунту.'],
 ['Workspace sections','Ish bo‘limlari','Разделы кабинета'],['6 areas · one account','6 yo‘nalish · bitta akkaunt','6 направлений · один аккаунт'],
 ['Administrator panel','Administrator paneli','Панель администратора'],['Not available for this role','Bu rol uchun ochilmagan','Недоступно для этой роли'],
 ['Need help?','Yordam kerakmi?','Нужна помощь?'],['Help with your account, tools and security.','Hisob, foydalanish va xavfsizlik bo‘yicha yordam.','Помощь с аккаунтом, инструментами и безопасностью.'],
 ['← Dashboard','← Kabinet','← Кабинет'],['Send','Yuborish','Отправить'],['Your question…','Savolingiz...','Ваш вопрос…'],
 ['Write a message…','Xabar yozing...','Напишите сообщение…'],['MedGen AI Assistant','MedGen AI yordamchi','Помощник MedGen AI'],
 ['Community','Hamjamiyat','Сообщество'],['Support center','Yordam markazi','Центр поддержки'],
 ['Hello! Ask a question about the MedGen AI platform.','Salom! MedGen AI platformasi bo‘yicha savolingizni yozing.','Здравствуйте! Задайте вопрос о платформе MedGen AI.'],
 ['This room is for members of your role.','Bu yopiq xona faqat sizning rolingiz uchun.','Эта комната доступна участникам вашей роли.'],
 ['No messages yet — start the conversation.','Hozircha xabar yo‘q — birinchi bo‘lib yozing.','Сообщений пока нет — начните разговор.'],
 ['Loading…','Yuklanmoqda...','Загрузка…'],['Run Scientific Workflow','Ilmiy jarayonni boshlash','Запустить научный процесс']
 ];
 const messages={
  theme:['Appearance','Ko‘rinish','Оформление'],system:['System','Qurilmaga mos','Как на устройстве'],light:['Light','Kunduzgi','Светлая'],dark:['Dark','Tungi','Тёмная'],
  locationUnavailable:['Location is unavailable on this device.','Bu qurilmada joylashuvni aniqlash mavjud emas.','Геолокация недоступна на устройстве.'],
  locationWaiting:['Waiting for location permission…','Joylashuvga ruxsat kutilmoqda…','Ожидание разрешения на геолокацию…'],
  locationSaved:['Coordinates saved. Address fields can be filled separately.','Koordinatalar saqlandi. Manzil nomlarini alohida to‘ldirishingiz mumkin.','Координаты сохранены. Название адреса можно заполнить отдельно.'],
  locationSaveFailed:['Coordinates could not be saved. Retry.','Koordinatalar saqlanmadi. Qayta urinib ko‘ring.','Не удалось сохранить координаты. Повторите попытку.'],
  locationDenied:['Location was denied or unavailable. You can enter your address manually.','Ruxsat berilmadi yoki joylashuv aniqlanmadi. Manzilni qo‘lda kiritishingiz mumkin.','Доступ запрещён или координаты недоступны. Адрес можно ввести вручную.']
 };
 const language=()=>['en','uz','ru'].includes(localStorage.getItem('medgen_language'))?localStorage.getItem('medgen_language'):'uz';
 const index=()=>({en:0,uz:1,ru:2})[language()];
 const lookup=new Map();for(const row of rows)for(const value of row)lookup.set(value,row);
 const translate=text=>lookup.get(text)?.[index()]||text;
 window.medgenText=key=>messages[key]?.[index()]||translate(key);
 const protectedSelector='.user-authored,#hubLanguageLesson li>b,script,style,pre,code,textarea,input,canvas,svg,[contenteditable],.result,#aiMsgs,#aiMessages,#communityMsgs,#supportList,#opportunitiesPanel,#researchResult';
 const textRecords=new WeakMap();
 function enhanceLanguageLesson(){
  document.querySelectorAll('#hubLanguageLesson li:not([data-practice-ready])').forEach(li=>{
   const phrase=li.querySelector('b');if(!phrase)return;
   li.dataset.practiceReady='1';
   const meaning=document.createElement('span');
   while(phrase.nextSibling)meaning.append(phrase.nextSibling);
   li.append(meaning);
   const actions=document.createElement('div');actions.className='language-practice-actions';
   const recall=document.createElement('button');recall.type='button';recall.className='ghost';recall.textContent=translate('Hide meaning');
   recall.onclick=()=>{meaning.hidden=!meaning.hidden;recall.textContent=translate(meaning.hidden?'Show meaning':'Hide meaning');};
   const listen=document.createElement('button');listen.type='button';listen.className='ghost';listen.textContent=translate('Listen');
   listen.onclick=()=>{
    if(!window.speechSynthesis||!window.SpeechSynthesisUtterance){listen.textContent=translate('Audio is unavailable on this device.');return;}
    const utterance=new SpeechSynthesisUtterance(phrase.textContent);
    utterance.lang=({en:'en-US',ru:'ru-RU',de:'de-DE',fr:'fr-FR'})[document.getElementById('hubLanguage')?.value]||'en-US';
    speechSynthesis.cancel();speechSynthesis.speak(utterance);
   };
   actions.append(recall,listen);li.append(actions);
  });
 }
 function update(){
  enhanceLanguageLesson();
  document.documentElement.lang=language();
  const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
  let node;
  while((node=walker.nextNode())){
   if(node.parentElement?.closest(protectedSelector))continue;
   const raw=node.textContent,trimmed=raw.trim();
   const parts=trimmed.match(/^([^\p{L}\p{N}]*)(.*)$/u);
   let prefix='',row=lookup.get(trimmed);
   if(!row&&parts&&lookup.has(parts[2])){prefix=parts[1];row=lookup.get(parts[2]);}
   if(!row){const old=textRecords.get(node);if(old&&old.includes(trimmed))row=old;}
   if(row){textRecords.set(node,row);const next=raw.replace(trimmed,prefix+row[index()]);if(next!==raw)node.textContent=next;}
  }
  document.querySelectorAll('[aria-label]').forEach(el=>{const old=el.getAttribute('aria-label'),next=translate(old);if(next!==old)el.setAttribute('aria-label',next);});
  document.querySelectorAll('[placeholder]').forEach(el=>{const next=translate(el.placeholder);if(next!==el.placeholder)el.placeholder=next;});
  document.querySelectorAll('[data-theme-label]').forEach(el=>{el.textContent=window.medgenText(el.dataset.themeLabel);});
  document.querySelectorAll('[data-theme-select]').forEach(el=>{el.setAttribute('aria-label',window.medgenText('theme'));});
 }
 const media=window.matchMedia?.('(prefers-color-scheme: dark)');
 function applyTheme(value){
  if(!['system','light','dark'].includes(value))value='system';
  localStorage.setItem('medgen_theme',value);
  document.documentElement.dataset.theme=value==='system'?(media?.matches?'dark':'light'):value;
  document.querySelectorAll('[data-theme-select]').forEach(el=>el.value=value);
 }
 function init(){
  // These panels used to sit outside the signed-in dashboard, below the page.
  for(const id of ['moleculeVisualPanel','scientificWorkflowPanel']){
   const panel=document.getElementById(id),workspace=document.getElementById('workspace');
   if(panel&&workspace)workspace.append(panel);
  }
  for(const [field,value] of [['visualUniprot','P69905'],['visualSmiles','CCO'],['visualPdb','1CRN'],['bioSequence','>example\nATGC']]){
   const input=document.getElementById(field);if(!input)continue;
   const button=document.createElement('button');button.type='button';button.className='ghost';button.textContent='Use learning example';
   button.onclick=()=>{input.value=value;input.focus();};input.after(button);
  }

  for(const parent of [document.querySelector('.language-box'),document.querySelector('.top-actions')]){
   if(!parent)continue;
   const label=document.createElement('label');label.className='theme-control';
   label.innerHTML='<span data-theme-label="theme"></span><select data-theme-select><option value="system" data-theme-label="system"></option><option value="light" data-theme-label="light"></option><option value="dark" data-theme-label="dark"></option></select>';
   label.querySelector('select').onchange=e=>applyTheme(e.target.value);parent.append(label);
  }
  applyTheme(localStorage.getItem('medgen_theme')||'system');
  media?.addEventListener?.('change',()=>applyTheme(localStorage.getItem('medgen_theme')||'system'));
  let scheduled=false;
  const observer=new MutationObserver(()=>{if(scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;observer.disconnect();update();observer.observe(document.body,{childList:true,subtree:true,characterData:true});});});
  update();observer.observe(document.body,{childList:true,subtree:true,characterData:true});
  document.querySelectorAll('#languageSelector,#loginLanguageSelector').forEach(el=>el.addEventListener('change',()=>{localStorage.setItem('medgen_language',el.value);update();}));
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
