// === Dependencies ===
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config(); // if you're using .env for DB config

// === Constants ===
const SECRET_KEY = 'mysecretkey';
const API_PORT = 3101;
const LOGIN_PORT = 8167;

// === PostgreSQL Pool Setup ===
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'postgres',
  database: process.env.DB_NAME || 'new_employee_db',
  password: process.env.DB_PASSWORD || 'admin834',
  port: process.env.DB_PORT || 5432,
});

// === Initialize Database Function ===
const initializeDatabase = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sampledata_table (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100),
        email VARCHAR(100) UNIQUE,
        password VARCHAR(100)
      );
    `);
    console.log('✅ Database initialized');
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
  }
};

// === Call to Initialize Database ===
initializeDatabase();

// === Express App for API and WebSocket ===
const apiApp = express();
const apiServer = http.createServer(apiApp);
const wss = new WebSocket.Server({ server: apiServer });

// === Middleware ===
apiApp.use(cors({ origin: 'http://13.221.80.34:8167', credentials: true }));
apiApp.use(bodyParser.json());

// === Login API ===
apiApp.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query(
      'SELECT * FROM sampledata_table WHERE email = $1 AND password = $2',
      [email, password]
    );
    if (result.rows.length > 0) {
      const user = result.rows[0];
      const token = jwt.sign({ email: user.email }, SECRET_KEY, { expiresIn: '1h' });
      res.json({ token });
    } else {
      res.status(401).json({ error: 'Invalid credentials' });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// === WebSocket ===
const clients = new Map();

wss.on('connection', (ws, req) => {
  const params = new URLSearchParams(req.url.replace('/?', ''));
  const token = params.get('token');
  if (!token) {
    ws.close();
    return;
  }

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    const email = decoded.email;
    clients.set(email, ws);

    pool.query('SELECT * FROM sampledata_table WHERE email = $1', [email]).then(result => {
      const user = result.rows[0];
      if (user) {
        ws.send(JSON.stringify({ type: 'data', payload: user }));
      }
    });
  } catch (err) {
    console.error('WebSocket error:', err);
    ws.close();
  }

  ws.on('close', () => {
    for (const [email, client] of clients.entries()) {
      if (client === ws) clients.delete(email);
    }
  });
});

// === Start API + WebSocket Server ===
apiServer.listen(API_PORT, () =>
  console.log(`✅ Server + WebSocket running on http://13.221.80.34:${API_PORT}`)
);

// === Separate Express App for Login Static Page ===
const loginApp = express();
loginApp.use(express.static(path.join(__dirname, 'login')));
loginApp.listen(LOGIN_PORT, () =>
  console.log(`🚪 Login Page running on http://13.221.80.34:${LOGIN_PORT}`)
);
