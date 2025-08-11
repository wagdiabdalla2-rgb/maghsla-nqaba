// server.js
// تشغيل: node server.js
const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
require('dotenv').config();

const app = express();
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Database
const db = new sqlite3.Database(path.join(__dirname, 'wash.db'));
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    phone TEXT,
    vehicle TEXT,
    service TEXT,
    date TEXT,
    time TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

// Optional: Twilio WhatsApp sample - requires TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM
const sendWhatsApp = async (to, message) => {
  if (!process.env.TWILIO_ACCOUNT_SID) return;
  const client = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  try {
    await client.messages.create({
      from: `whatsapp:${process.env.TWILIO_WHATSAPP_FROM}`,
      to: `whatsapp:${to}`,
      body: message
    });
  } catch (err) {
    console.error('WhatsApp send error', err);
  }
};

// API: create booking
app.post('/api/book', (req, res) => {
  const {name, phone, vehicle, service, date, time, notes} = req.body;
  if (!name || !phone || !date || !time) return res.status(400).json({error: 'الحقول الأساسية مطلوبة'});
  const stmt = db.prepare(`INSERT INTO bookings (name, phone, vehicle, service, date, time, notes) VALUES (?, ?, ?, ?, ?, ?, ?)`);
  stmt.run(name, phone, vehicle, service, date, time, notes, function(err){
    if (err) return res.status(500).json({error: 'خطأ في الحفظ'});
    const id = this.lastID;
    // send WhatsApp confirmation (optional)
    const msg = `تم حجز موعدك في مغسلة النقابة. رقم الحجز: ${id}\nالتاريخ: ${date} - ${time}\nالخدمة: ${service}`;
    sendWhatsApp(phone, msg);
    res.json({ok:true, id});
  });
  stmt.finalize();
});

// API: list bookings
app.get('/api/bookings', (req, res) => {
  db.all('SELECT * FROM bookings ORDER BY created_at DESC', (err, rows) => {
    if (err) return res.status(500).json({error:'خطأ'});
    res.json(rows);
  });
});

const port = process.env.PORT || 3000;
app.listen(port, ()=> console.log('Server running on', port));
