const express = require('express');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname)));

async function initDB() {
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      callSign VARCHAR(100) UNIQUE NOT NULL,
      pass VARCHAR(100) NOT NULL,
      rank VARCHAR(50),
      post VARCHAR(50),
      role VARCHAR(20) DEFAULT 'user',
      steam VARCHAR(100),
      warnings INT DEFAULT 0
    )`);
    
    await pool.query(`CREATE TABLE IF NOT EXISTS posts (
      id SERIAL PRIMARY KEY,
      title VARCHAR(200),
      content TEXT,
      tag VARCHAR(50),
      author VARCHAR(100),
      date VARCHAR(20)
    )`);
    
    await pool.query(`CREATE TABLE IF NOT EXISTS tasks (
      id SERIAL PRIMARY KEY,
      title VARCHAR(200),
      content TEXT,
      author VARCHAR(100),
      date VARCHAR(20)
    )`);
    
    await pool.query(`CREATE TABLE IF NOT EXISTS reports (
      id SERIAL PRIMARY KEY,
      title VARCHAR(200),
      content TEXT,
      author VARCHAR(100),
      date VARCHAR(20),
      status VARCHAR(20) DEFAULT 'pending'
    )`);
    
    await pool.query(`CREATE TABLE IF NOT EXISTS petitions (
      id SERIAL PRIMARY KEY,
      title VARCHAR(200),
      content TEXT,
      author VARCHAR(100),
      date VARCHAR(20),
      status VARCHAR(20) DEFAULT 'pending'
    )`);
    
    const adminCheck = await pool.query(`SELECT * FROM users WHERE callSign = 'Komandir'`);
    if (adminCheck.rows.length === 0) {
      await pool.query(`INSERT INTO users (callSign, pass, rank, post, role, steam, warnings) VALUES ('Komandir', '123', 'Начальник УФСБ', 'Начальник УФСБ', 'admin', 'STEAM_0:0:111111111', 0)`);
    }
    console.log('✅ База данных подключена!');
  } catch (err) {
    console.error('❌ Ошибка базы данных:', err.message);
  }
}

initDB();

// --- ПОЛЬЗОВАТЕЛИ ---
app.post('/api/login', async (req, res) => {
  const { callSign, pass } = req.body;
  try {
    const result = await pool.query("SELECT * FROM users WHERE callSign = $1 AND pass = $2", [callSign, pass]);
    if (result.rows.length === 0) return res.status(401).json({ error: 'Неверный позывной или пароль!' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/register', async (req, res) => {
  const { steam, callSign, pass, rank, post } = req.body;
  if (!steam || !callSign || !pass) return res.status(400).json({ error: 'Заполните все поля!' });

  const allowedRanks = ['Прапорщик', 'Старший Прапорщик', 'Лейтенант', 'Старший Лейтенант'];
  const allowedPosts = ['Оперативник', 'Инструктор'];

  if (!allowedRanks.includes(rank)) return res.status(400).json({ error: 'Максимальное звание при регистрации: Лейтенант!' });
  if (!allowedPosts.includes(post)) return res.status(400).json({ error: 'Максимальная должность при регистрации: Инструктор!' });

  try {
    const check = await pool.query("SELECT * FROM users WHERE callSign = $1", [callSign]);
    if (check.rows.length > 0) return res.status(400).json({ error: 'Позывной занят!' });
    await pool.query(`INSERT INTO users (steam, callSign, pass, rank, post, role, warnings) VALUES ($1, $2, $3, $4, $5, 'user', 0)`, [steam, callSign, pass, rank, post]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/users', async (req, res) => {
  try { res.json((await pool.query("SELECT * FROM users")).rows); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/updateUser', async (req, res) => {
  const { id, field, value } = req.body;
  try {
    if (field === 'callSign') {
      const check = await pool.query("SELECT * FROM users WHERE callSign = $1 AND id != $2", [value, id]);
      if (check.rows.length > 0) return res.status(400).json({ error: 'Этот позывной уже занят!' });
    }
    await pool.query(`UPDATE users SET ${field} = $1 WHERE id = $2`, [value, id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/users/:id', async (req, res) => {
  try { await pool.query("DELETE FROM users WHERE id = $1", [Number(req.params.id)]); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/warn', async (req, res) => {
  const { id, amount } = req.body;
  try { await pool.query("UPDATE users SET warnings = GREATEST(0, warnings + $1) WHERE id = $2", [amount, id]); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/toggleRole', async (req, res) => {
  const { id } = req.body;
  try {
    const result = await pool.query("SELECT role FROM users WHERE id = $1", [id]);
    const newRole = result.rows[0].role === 'admin' ? 'user' : 'admin';
    await pool.query("UPDATE users SET role = $1 WHERE id = $2", [newRole, id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- ПОСТЫ ---
app.get('/api/posts', async (req, res) => {
  try { res.json((await pool.query("SELECT * FROM posts ORDER BY id DESC")).rows); }
  catch (err) { res.status(500).json({ error: err.message }); }
});
app.post('/api/posts', async (req, res) => {
  const { title, content, tag, author } = req.body;
  if (!title || !content) return res.status(400).json({ error: 'Заполните поля' });
  try {
    await pool.query("INSERT INTO posts (title, content, tag, author, date) VALUES ($1, $2, $3, $4, $5)", [title, content, tag, author, new Date().toLocaleDateString('ru-RU')]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.delete('/api/posts/:id', async (req, res) => {
  try { await pool.query("DELETE FROM posts WHERE id = $1", [Number(req.params.id)]); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// --- ЗАДАЧИ ---
app.get('/api/tasks', async (req, res) => {
  try { res.json((await pool.query("SELECT * FROM tasks ORDER BY id DESC")).rows); }
  catch (err) { res.status(500).json({ error: err.message }); }
});
app.post('/api/tasks', async (req, res) => {
  const { title, content, author } = req.body;
  if (!title) return res.status(400).json({ error: 'Введите название задачи' });
  try {
    await pool.query("INSERT INTO tasks (title, content, author, date) VALUES ($1, $2, $3, $4)", [title, content, author, new Date().toLocaleDateString('ru-RU')]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.delete('/api/tasks/:id', async (req, res) => {
  try { await pool.query("DELETE FROM tasks WHERE id = $1", [Number(req.params.id)]); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// --- РАПОРТЫ ---
app.get('/api/reports', async (req, res) => {
  try { res.json((await pool.query("SELECT * FROM reports ORDER BY id DESC")).rows); }
  catch (err) { res.status(500).json({ error: err.message }); }
});
app.post('/api/reports', async (req, res) => {
  const { title, content, author } = req.body;
  if (!title || !content) return res.status(400).json({ error: 'Заполните поля' });
  try {
    await pool.query("INSERT INTO reports (title, content, author, date, status) VALUES ($1, $2, $3, $4, 'pending')", [title, content, author, new Date().toLocaleDateString('ru-RU')]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.post('/api/reports/status', async (req, res) => {
  const { id, status } = req.body;
  try { await pool.query("UPDATE reports SET status = $1 WHERE id = $2", [status, id]); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});
app.delete('/api/reports/:id', async (req, res) => {
  try { await pool.query("DELETE FROM reports WHERE id = $1", [Number(req.params.id)]); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// --- ХОДАТАЙСТВА ---
app.get('/api/petitions', async (req, res) => {
  try { res.json((await pool.query("SELECT * FROM petitions ORDER BY id DESC")).rows); }
  catch (err) { res.status(500).json({ error: err.message }); }
});
app.post('/api/petitions', async (req, res) => {
  const { title, content, author } = req.body;
  if (!title || !content) return res.status(400).json({ error: 'Заполните поля' });
  try {
    await pool.query("INSERT INTO petitions (title, content, author, date, status) VALUES ($1, $2, $3, $4, 'pending')", [title, content, author, new Date().toLocaleDateString('ru-RU')]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.post('/api/petitions/status', async (req, res) => {
  const { id, status } = req.body;
  try { await pool.query("UPDATE petitions SET status = $1 WHERE id = $2", [status, id]); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});
app.delete('/api/petitions/:id', async (req, res) => {
  try { await pool.query("DELETE FROM petitions WHERE id = $1", [Number(req.params.id)]); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.listen(PORT, () => {
  console.log(`Сервер запущен! Откройте в браузере: http://localhost:${PORT}`);
});
