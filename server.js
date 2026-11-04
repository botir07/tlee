
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const app = express();
const PORT = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const COOKIE = "volta_session";

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/"
  };
}

function getDatabase() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL sozlanmagan");
  }
  return neon(process.env.DATABASE_URL);
}

function authenticate(req, res, next) {
  const token = req.cookies?.[COOKIE] ||
    req.headers.authorization?.replace("Bearer ", "");

  if (!token) {
    return res.status(401).json({ error: "Kirish talab qilinadi." });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Sessiya muddati tugagan." });
  }
}

// Cookie parser
app.use((req, res, next) => {
  const cookies = req.headers.cookie || "";
  req.cookies = {};

  cookies.split(";").forEach((item) => {
    const index = item.indexOf("=");
    if (index > -1) {
      const key = item.slice(0, index).trim();
      const value = item.slice(index + 1).trim();
      req.cookies[key] = decodeURIComponent(value);
    }
  });

  next();
});

// Ro'yxatdan o'tish
app.post("/api/register", async (req, res) => {
  try {
    const sql = getDatabase();
    const { name, email, password } = req.body;

    const cleanName = String(name || "").trim();
    const cleanEmail = String(email || "").trim().toLowerCase();

    if (
      cleanName.length < 2 ||
      cleanName.length > 80 ||
      !/^\S+@\S+\.\S+$/.test(cleanEmail) ||
      typeof password !== "string" ||
      password.length < 8 ||
      password.length > 72
    ) {
      return res.status(400).json({
        error: "Ma'lumotlarni to'g'ri kiriting. Parol 8–72 belgi bo'lsin."
      });
    }

    const hash = await bcrypt.hash(password, 12);

    const rows = await sql`
      INSERT INTO users (name, email, password_hash)
      VALUES (${cleanName}, ${cleanEmail}, ${hash})
      RETURNING id, name, email
    `;

    const user = rows[0];

    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.cookie(COOKIE, token, cookieOptions());

    return res.status(201).json({ ok: true, user });

  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        error: "Bu email bilan hisob mavjud."
      });
    }

    console.error(error);
    return res.status(500).json({
      error: "Ro'yxatdan o'tishda xatolik."
    });
  }
});

// Login
app.post("/api/login", async (req, res) => {
  try {
    const sql = getDatabase();
    const { email, password } = req.body;

    const cleanEmail = String(email || "").trim().toLowerCase();

    if (!cleanEmail || typeof password !== "string") {
      return res.status(400).json({
        error: "Email va parolni kiriting."
      });
    }

    const rows = await sql`
      SELECT id, name, email, password_hash
      FROM users
      WHERE email = ${cleanEmail}
      LIMIT 1
    `;

    const user = rows[0];

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({
        error: "Email yoki parol noto'g'ri."
      });
    }

    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.cookie(COOKIE, token, cookieOptions());

    return res.json({
      ok: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Login vaqtida xatolik."
    });
  }
});

// Foydalanuvchini tekshirish
app.get("/api/me", authenticate, (req, res) => {
  res.json({
    user: {
      id: req.user.id,
      name: req.user.name,
      email: req.user.email
    }
  });
});

// Logout
app.post("/api/logout", (req, res) => {
  res.clearCookie(COOKIE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/"
  });

  res.json({ ok: true });
});

// Bosh sahifa
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Serverni ishga tushirish
app.listen(PORT, "0.0.0.0", () => {
  console.log(`VOLTA server ${PORT} portda ishga tushdi.`);
});
