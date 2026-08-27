const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = 3000;

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname)));

const DB_FILE = path.join(__dirname, 'users.json');
const POSTS_FILE = path.join(__dirname, 'posts.json');
const TASKS_FILE = path.join(__dirname, 'tasks.json');
const REPORTS_FILE = path.join(__dirname, 'reports.json');
const PETITIONS_FILE = path.join(__dirname, 'petitions.json');

let users = [];
let posts = [];
let tasks = [];
let reports = [];
let petitions = [];

if (fs.existsSync(DB_FILE)) users = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
if (fs.existsSync(POSTS_FILE)) posts = JSON.parse(fs.readFileSync(POSTS_FILE, 'utf8'));
if (fs.existsSync(TASKS_FILE)) tasks = JSON.parse(fs.readFileSync(TASKS_FILE, 'utf8'));
if (fs.existsSync(REPORTS_FILE)) reports = JSON.parse(fs.readFileSync(REPORTS_FILE, 'utf8'));
if (fs.existsSync(PETITIONS_FILE)) petitions = JSON.parse(fs.readFileSync(PETITIONS_FILE, 'utf8'));

// Фикс: добавляем warnings: 0 всем, у кого его нет
users = users.map(u => ({ ...u, warnings: u.warnings || 0 }));

// Фикс: добавляем status: "pending" всем рапортам и ходатайствам
reports = reports.map(r => ({ ...r, status: r.status || "pending" }));
petitions = petitions.map(p => ({ ...p, status: p.status || "pending" }));

// Главный админ
if (users.length === 0) {
    users.push({ id: 1, steam: "STEAM_0:0:111111111", callSign: "Komandir", pass: "123", rank: "Начальник УФСБ", post: "Начальник УФСБ", role: "admin", warnings: 0 });
    fs.writeFileSync(DB_FILE, JSON.stringify(users, null, 2));
}

function saveUsers() { fs.writeFileSync(DB_FILE, JSON.stringify(users, null, 2)); }
function savePosts() { fs.writeFileSync(POSTS_FILE, JSON.stringify(posts, null, 2)); }
function saveTasks() { fs.writeFileSync(TASKS_FILE, JSON.stringify(tasks, null, 2)); }
function saveReports() { fs.writeFileSync(REPORTS_FILE, JSON.stringify(reports, null, 2)); }
function savePetitions() { fs.writeFileSync(PETITIONS_FILE, JSON.stringify(petitions, null, 2)); }

// --- Регистрация ---
app.post('/api/register', (req, res) => {
    const { steam, callSign, pass, rank, post } = req.body;
    if (!steam || !callSign || !pass) return res.status(400).json({ error: 'Заполните все поля!' });
    if (users.some(u => u.callSign === callSign)) return res.status(400).json({ error: 'Позывной занят!' });

    const allowedRanks = ['Прапорщик', 'Старший Прапорщик', 'Лейтенант', 'Старший Лейтенант'];
    const allowedPosts = ['Оперативник', 'Инструктор'];

    if (!allowedRanks.includes(rank)) return res.status(400).json({ error: 'Максимальное звание при регистрации: Лейтенант!' });
    if (!allowedPosts.includes(post)) return res.status(400).json({ error: 'Максимальная должность при регистрации: Инструктор!' });

    const newUser = { id: Date.now(), steam, callSign, pass, rank, post, role: "user", warnings: 0 };
    users.push(newUser);
    saveUsers();
    res.json({ success: true });
});

// --- Вход ---
app.post('/api/login', (req, res) => {
    const { callSign, pass } = req.body;
    const user = users.find(u => u.callSign === callSign && u.pass === pass);
    if (!user) return res.status(401).json({ error: 'Неверный позывной или пароль!' });
    res.json(user);
});

// --- Получить всех ---
app.get('/api/users', (req, res) => res.json(users));

// --- Обновить пользователя (включая позывной и пароль) ---
app.post('/api/updateUser', (req, res) => {
    const { id, field, value } = req.body;
    const user = users.find(u => u.id === id);
    if (!user) return res.status(404).json({ error: 'Не найден' });
    if (user.callSign === "Komandir") return res.status(403).json({ error: 'Нельзя редактировать главного админа' });
    
    // Если меняем позывной, нужно проверить, что новый позывной не занят
    if (field === 'callSign') {
        const existing = users.find(u => u.callSign === value && u.id !== id);
        if (existing) return res.status(400).json({ error: 'Этот позывной уже занят!' });
    }

    user[field] = value;
    saveUsers();
    res.json({ success: true });
});

// --- Удалить пользователя ---
app.delete('/api/users/:id', (req, res) => {
    const userId = Number(req.params.id);
    const user = users.find(u => u.id === userId);
    if (!user) return res.status(404).json({ error: 'Не найден' });
    if (user.callSign === "Komandir") return res.status(403).json({ error: 'Нельзя удалить главного админа' });
    users = users.filter(u => u.id !== userId);
    saveUsers();
    res.json({ success: true });
});

// --- Выговор ---
app.post('/api/warn', (req, res) => {
    const { id, amount } = req.body;
    const user = users.find(u => u.id === id);
    if (!user) return res.status(404).json({ error: 'Не найден' });
    if (user.callSign === "Komandir") return res.status(403).json({ error: 'Нельзя дать выговор главному админу' });
    user.warnings = Math.max(0, (user.warnings || 0) + amount);
    saveUsers();
    res.json({ success: true });
});

// --- Права ---
app.post('/api/toggleRole', (req, res) => {
    const { id } = req.body;
    const user = users.find(u => u.id === id);
    if (!user) return res.status(404).json({ error: 'Не найден' });
    if (user.callSign === "Komandir") return res.status(403).json({ error: 'Нельзя менять главного админа' });
    user.role = user.role === 'admin' ? 'user' : 'admin';
    saveUsers();
    res.json({ success: true });
});

// --- Посты ---
app.get('/api/posts', (req, res) => res.json(posts));
app.post('/api/posts', (req, res) => {
    const { title, content, tag, author } = req.body;
    if (!title || !content) return res.status(400).json({ error: 'Заполните поля' });
    const newPost = { id: Date.now(), title, content, tag, author, date: new Date().toLocaleDateString('ru-RU') };
    posts.push(newPost);
    savePosts();
    res.json({ success: true });
});
app.delete('/api/posts/:id', (req, res) => {
    posts = posts.filter(p => p.id !== Number(req.params.id));
    savePosts();
    res.json({ success: true });
});

// --- Задачи ---
app.get('/api/tasks', (req, res) => res.json(tasks));
app.post('/api/tasks', (req, res) => {
    const { title, content, author } = req.body;
    if (!title) return res.status(400).json({ error: 'Введите название задачи' });
    const newTask = { id: Date.now(), title, content, author, date: new Date().toLocaleDateString('ru-RU') };
    tasks.push(newTask);
    saveTasks();
    res.json({ success: true });
});
app.delete('/api/tasks/:id', (req, res) => {
    tasks = tasks.filter(t => t.id !== Number(req.params.id));
    saveTasks();
    res.json({ success: true });
});

// --- РАПОРТЫ ---
app.get('/api/reports', (req, res) => res.json(reports));
app.post('/api/reports', (req, res) => {
    const { title, content, author } = req.body;
    if (!title || !content) return res.status(400).json({ error: 'Заполните поля' });
    const newReport = { id: Date.now(), title, content, author, date: new Date().toLocaleDateString('ru-RU'), status: "pending" };
    reports.push(newReport);
    saveReports();
    res.json({ success: true });
});
app.post('/api/reports/status', (req, res) => {
    const { id, status } = req.body;
    const report = reports.find(r => r.id === id);
    if (!report) return res.status(404).json({ error: 'Не найден' });
    report.status = status;
    saveReports();
    res.json({ success: true });
});
app.delete('/api/reports/:id', (req, res) => {
    reports = reports.filter(r => r.id !== Number(req.params.id));
    saveReports();
    res.json({ success: true });
});

// --- ХОДАТАЙСТВА ---
app.get('/api/petitions', (req, res) => res.json(petitions));
app.post('/api/petitions', (req, res) => {
    const { title, content, author } = req.body;
    if (!title || !content) return res.status(400).json({ error: 'Заполните поля' });
    const newPetition = { id: Date.now(), title, content, author, date: new Date().toLocaleDateString('ru-RU'), status: "pending" };
    petitions.push(newPetition);
    savePetitions();
    res.json({ success: true });
});
app.post('/api/petitions/status', (req, res) => {
    const { id, status } = req.body;
    const petition = petitions.find(p => p.id === id);
    if (!petition) return res.status(404).json({ error: 'Не найден' });
    petition.status = status;
    savePetitions();
    res.json({ success: true });
});
app.delete('/api/petitions/:id', (req, res) => {
    petitions = petitions.filter(p => p.id !== Number(req.params.id));
    savePetitions();
    res.json({ success: true });
});

app.listen(PORT, () => {
    console.log(`Сервер запущен! Откройте в браузере: http://localhost:3000`);
});