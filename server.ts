import express from "express";
import { createServer as createViteServer } from "vite";
import pg from "pg";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import Database from "better-sqlite3";

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Database Compatibility Logic ---
let pool: any = null;
let sqlite: any = null;
const isPostgres = !!process.env.DATABASE_URL;

if (isPostgres) {
  pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  console.log("Using Postgres (Railway Mode)");
} else {
  sqlite = new Database("local.db");
  console.log("Using SQLite (Preview Mode)");
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(express.json({ limit: '50mb' }));

  // Initialize Database Tables
  if (isPostgres) {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS images (
          id SERIAL PRIMARY KEY,
          image_data TEXT NOT NULL,
          prompt_original TEXT NOT NULL,
          prompt_en TEXT NOT NULL,
          prompt_zh TEXT NOT NULL,
          tags TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log("Postgres initialized");
    } catch (err) {
      console.error("Postgres Init Error:", err);
    }
  } else {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS images (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        image_data TEXT NOT NULL,
        prompt_original TEXT NOT NULL,
        prompt_en TEXT NOT NULL,
        prompt_zh TEXT NOT NULL,
        tags TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Insert sample data if empty for preview
    const count = sqlite.prepare("SELECT count(*) as count FROM images").get().count;
    if (count === 0) {
      sqlite.prepare("INSERT INTO images (image_data, prompt_original, prompt_en, prompt_zh, tags) VALUES (?, ?, ?, ?, ?)").run(
        "https://picsum.photos/seed/ai-art/1200/800",
        "一个带有霓虹灯和飞行汽车的未来派赛博朋克城市，数字艺术风格",
        "A futuristic cyberpunk city with neon lights and flying cars, digital art style",
        "一个带有霓虹灯和飞行汽车的未来派赛博朋克城市，数字艺术风格",
        JSON.stringify(["赛博朋克", "城市", "未来"])
      );
      sqlite.prepare("INSERT INTO images (image_data, prompt_original, prompt_en, prompt_zh, tags) VALUES (?, ?, ?, ?, ?)").run(
        "https://picsum.photos/seed/nature/1200/800",
        "日落时分雄伟的山脉景观，配有清澈见底的湖泊",
        "Majestic mountain landscape at sunset with a crystal clear lake",
        "日落时分雄伟的山脉景观，配有清澈见底的湖泊",
        JSON.stringify(["自然", "风景", "日落"])
      );
    }
    console.log("SQLite initialized with sample data");
  }

  // API Routes
  app.get("/api/images", async (req, res) => {
    try {
      if (isPostgres) {
        const result = await pool.query("SELECT * FROM images ORDER BY created_at DESC");
        res.json(result.rows);
      } else {
        const rows = sqlite.prepare("SELECT * FROM images ORDER BY created_at DESC").all();
        res.json(rows);
      }
    } catch (err) {
      res.status(500).json({ error: "Fetch failed" });
    }
  });

  app.post("/api/images", async (req, res) => {
    const { image_data, prompt, tags } = req.body;
    try {
      if (isPostgres) {
        const query = `INSERT INTO images (image_data, prompt_original, prompt_en, prompt_zh, tags) VALUES ($1, $2, $3, $4, $5) RETURNING id`;
        const result = await pool.query(query, [image_data, prompt, prompt, prompt, JSON.stringify(tags || [])]);
        res.json({ id: result.rows[0].id, success: true });
      } else {
        const info = sqlite.prepare("INSERT INTO images (image_data, prompt_original, prompt_en, prompt_zh, tags) VALUES (?, ?, ?, ?, ?)").run(
          image_data, prompt, prompt, prompt, JSON.stringify(tags || [])
        );
        res.json({ id: info.lastInsertRowid, success: true });
      }
    } catch (err) {
      res.status(500).json({ error: "Save failed" });
    }
  });

  app.get("/api/tags", async (req, res) => {
    try {
      let rows = [];
      if (isPostgres) {
        rows = (await pool.query("SELECT tags FROM images")).rows;
      } else {
        rows = sqlite.prepare("SELECT tags FROM images").all();
      }
      const allTags = new Set<string>();
      rows.forEach((row: any) => {
        const tags = JSON.parse(row.tags || "[]");
        tags.forEach((tag: string) => allTags.add(tag));
      });
      res.json(Array.from(allTags));
    } catch (err) {
      res.json([]);
    }
  });

  app.delete("/api/images/:id", async (req, res) => {
    const { id } = req.params;
    try {
      if (isPostgres) {
        await pool.query("DELETE FROM images WHERE id = $1", [id]);
      } else {
        sqlite.prepare("DELETE FROM images WHERE id = ?").run(id);
      }
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Delete failed" });
    }
  });

  // Health check for debugging
  app.get("/api/health", (req, res) => {
    const distPath = path.resolve(__dirname, "dist");
    res.json({
      status: "ok",
      mode: isPostgres ? "postgres" : "sqlite",
      env: process.env.NODE_ENV,
      distExists: fs.existsSync(distPath)
    });
  });

  // Static files & Vite
  const distPath = path.resolve(__dirname, "dist");
  const isProd = process.env.NODE_ENV === "production" && fs.existsSync(distPath);

  if (isProd) {
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      if (req.path.startsWith('/api')) return res.status(404).json({error: "API not found"});
      res.sendFile(path.join(distPath, "index.html"));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    app.get("*", async (req, res) => {
      if (req.path.startsWith('/api')) return res.status(404).json({error: "API not found"});
      try {
        const template = fs.readFileSync(path.resolve(__dirname, "index.html"), "utf-8");
        const html = await vite.transformIndexHtml(req.originalUrl, template);
        res.status(200).set({ "Content-Type": "text/html" }).end(html);
      } catch (e) {
        res.status(500).end(String(e));
      }
    });
  }

  app.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`Mode: ${isPostgres ? "Postgres" : "SQLite"}`);
    console.log(`Environment: ${process.env.NODE_ENV}`);
    console.log(`Serving from: ${isProd ? "dist (Production)" : "Vite (Development)"}`);
  });
}

startServer().catch(console.error);
