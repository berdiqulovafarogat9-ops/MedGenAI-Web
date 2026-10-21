# Professor ruxsatlari va dashboard hisoblagichlari

## O‘zgarishlar
- `backend/phase1_academy_ext.py`: professor endi faqat administrator biriktirgan faol talabalarni ko‘radi. Dastlab ro‘yxat bo‘sh. SUPER_ADMIN barcha faol talabalarni ko‘ra oladi; mavjud profil/rozilik talablari saqlanadi.
- Admin GET `/api/v1/admin/academy/teaching-assignments` professorlar va talabalar ro‘yxatini beradi.
- Admin PUT `/api/v1/admin/academy/teaching-assignments/{professor}` `{ "students": ["username"] }` bilan ruxsatlarni almashtiradi; bo‘sh ro‘yxat bekor qiladi. Noto‘g‘ri yoki faol bo‘lmagan hisoblar qabul qilinmaydi. Limit 500; takrorlar olib tashlanadi.
- Ruxsatlar professor profilidagi server boshqaradigan `teaching_students` maydonida saqlanadi, mavjud `_db_save` chaqiriladi va o‘zgarish auditga yoziladi. Universitet/guruh nomini o‘zi kiritish kirish huquqini bermaydi.
- `backend/main.py`: username almashtirilganda biriktirishlar yangilanadi; eski username qayta ishlatilsa ruxsat meros bo‘lmaydi. Dashboard hisoblagichlari `user`, eski `username`, so‘ng `owner` orqali egani topadi; qarama-qarshi maydonlarda `user` ustun.
- `app.js`: admin paneliga professor tanlash, talabalarni belgilash va ruxsatlarni saqlash boshqaruvi qo‘shildi; loading/empty/error holatlari mavjud.

## Tekshiruv
`python -m pytest backend/tests -q`: 33 test o‘tdi. Yangi 7 test: ikki professor izolyatsiyasi, biriktirish/bekor qilish, admin bo‘lmagan foydalanuvchi uchun 403, noto‘g‘ri ro‘yxatning atomar rad etilishi, faol bo‘lmagan talabani yashirish, profil orqali o‘ziga ruxsat berishning oldini olish, username o‘zgarishi va to‘rtta hisoblagichning egalar bo‘yicha ajratilishi.
`node --check app.js` va `git diff --check`: muvaffaqiyatli.

## Cheklovlar va deploy
Testlar lokal FastAPI TestClient bilan, haqiqiy PostgreSQLsiz bajarildi. `_db_save` chaqirilishi tekshirildi; DB restart/durability tekshiruvi bajarilmadi. Mavjud snapshot saqlash mexanizmining xatoni yutib yuborish xavfi hali ochiq. Yangi admin UI browser E2E/mobil sinovidan hali o‘tmadi.
GitHubga push, Render yoki Cloudflare deploy bajarilmadi. Backend endpointlari yangi bo‘lgani uchun avval Render backend, keyin frontend chiqarilishi lozim. Cloudflare ZIPni almashtirishning o‘zi backenddagi ruxsat muammosini tuzatmaydi. Repo app.js Render konfiguratsiyasida: Cloudflare paketida API bazasini oldingidek `/api/v1` qilish kerak.

## Keyingi bosqich
Ma’lumotlarni saqlashdagi xatolarni yashirmaslik va DB qayta ishga tushganda tiklanishini test qilish; yangi admin boshqaruvini browserda tekshirish; so‘ng knowledge graph egasi/ruxsatlarini ajratish va Learning Hub progressini serverga ulash. Maktab frontendini olib tashlagan oldingi o‘zgarishlar saqlangan, legacy backend maktab endpointlari hali mavjud.
