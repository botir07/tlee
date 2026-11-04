# VOLTA — telefonlar do‘koni

## 1. Neon bazasini tayyorlash
1. https://neon.com saytida akkaunt oching va yangi project yarating.
2. Neon SQL Editor bo‘limiga kiring.
3. Ushbu papkadagi `schema.sql` fayl ichidagi SQL kodni ishga tushiring. `users` jadvali yaratiladi.
4. Dashboard → Connect orqali pooled connection string oling. Uni `DATABASE_URL` nomi bilan saqlang.

## 2. Loyihani kompyuterda ishga tushirish
Node.js 20 yoki undan yangisini o‘rnating.

```bash
npm install
```

`.env.example` faylidan nusxa olib `.env` deb nomlang va qiymatlarni to‘ldiring:

- `DATABASE_URL` — Neon'dan olingan connection string.
- `JWT_SECRET` — kamida 32 belgili maxfiy tasodifiy kalit.

So‘ng:

```bash
npx netlify dev
```

Brauzerda terminal ko‘rsatgan lokal manzilni oching. Birinchi marta “Ro‘yxatdan o‘tish” orqali foydalanuvchi yarating.

## 3. Netlify'ga deploy qilish
1. Loyihani GitHub'ga yuklang (`.env` faylini hech qachon GitHub'ga yuklamang).
2. https://app.netlify.com/start saytiga kiring va GitHub repository'ni ulang.
3. Build settings: Publish directory = `public`; Functions directory = `netlify/functions`.
4. Netlify → Site configuration / Project configuration → Environment variables bo‘limida quyidagilarni qo‘shing:
   - `DATABASE_URL` = Neon connection string
   - `JWT_SECRET` = maxfiy kalit (32+ belgi)
   O‘zgaruvchilar Functions uchun ham mavjud ekanini tekshiring.
5. Deploy site tugmasini bosing. Keyingi Git push'lar avtomatik deploy bo‘ladi.

## 4. Ishlash tartibi
- Ro‘yxatdan o‘tish va login Netlify Function orqali bajariladi.
- Parol bcrypt bilan hash qilinadi; ochiq holda saqlanmaydi.
- Sessiya HttpOnly, Secure cookie orqali yuritiladi.
- Neon faqat backend function ichidan ulanadi. `DATABASE_URL` hech qachon frontend kodiga qo‘yilmaydi.

## Eslatma
Landing page'dagi telefon nomlari va narxlari demo kontent. Ularni `public/index.html` ichidagi `demoProducts` ro‘yxatidan o‘zgartiring. Hozirgi “Batafsil” tugmasi namuna aloqa oynasini ko‘rsatadi; haqiqiy buyurtma, to‘lov va ombor boshqaruvi hali ulanmagan.
