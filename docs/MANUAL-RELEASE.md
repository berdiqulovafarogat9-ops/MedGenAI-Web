# Qo‘lda chiqarish — joriy holat

Frontend: MedGenAI-Frontend.zip faqat Cloudflare Pages medgen-ai loyihasiga yuklanadi.
Backend: MedGenAI-Source.zip arxivini ochib, fayllarni mavjud GitHub MedGenAI-Web repositoryga joylash kerak. Papka tuzilishini saqlang. ZIPning o‘zini GitHubga yuklash backendni yangilamaydi. GitHub main yangilansa Render backend auto-deploy ishlaydi.

Paket yaratish: python scripts/package_release.py
Tekshiruv: python -m pytest backend/tests -q; node tests/cloudflare-proxy.mjs; node --check app.js.

Joriy tuzatishlar: professor ruxsatlari admin biriktirish bilan chegaralangan; dashboard hisoblagichlari egani to‘g‘ri aniqlaydi; akademik tasdiqdagi chetlab o‘tishlar, workflow saqlash va knowledge paths importi tuzatilgan; maktab frontend bo‘limlari olib tashlangan.

Hali ochiq: DB saqlash xatolari va restart sinovi, knowledge graph uchun egalar/ruxsatlar, Learning Hub server progressi, barcha modullarning browser E2E va mobil sinovi. Legacy maktab backend endpointlari saqlangan. Barcha klinik/ilmiy natijalar validatsiya qilingan deb hisoblanmaydi.

Bu paket lokal sinovdan o‘tgan o‘zgarishlar yig‘indisi. Jonli deploy bajarilmadi. Yangi professor endpointi uchun backendni birinchi yangilang. Oldingi deployni rollback uchun saqlang.
