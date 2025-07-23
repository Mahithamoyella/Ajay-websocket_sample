const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const localtunnel = require('localtunnel');
const { Pool } = require('pg');

const SECRET_KEY = 'mysecretkey';
const API_PORT = 3101;
const LOGIN_PORT = 8167;

// PostgreSQL pool and initialization
const pool = new Pool({
  user: 'postgres',         // update with your DB user
  host: 'postgres',
  database: 'new_employee_db',
  password: 'admin834', // update with your DB password
  port: 5432,
});

async function initializeDatabase() {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS sampledata_table (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      name VARCHAR(100) NOT NULL,
      role VARCHAR(50) NOT NULL
    );
  `;
  const insertSampleData = `
    INSERT INTO sampledata_table (email, password, name, role)
    VALUES 
      ('ajay@example.com', '1234', 'Ajay', 'Employee'),
      ('john@example.com', 'abcd', 'John', 'HR')
    ON CONFLICT (email) DO NOTHING;
  `;
  try {
    await pool.query(createTableQuery);
    await pool.query(insertSampleData);
    console.log("✅ Database initialized.");
  } catch (error) {
    console.error("❌ Error initializing database:", error);
  }
}

initializeDatabase();

// === Express API App ===
const apiApp = express();
const apiServer = http.createServer(apiApp);
const wss = new WebSocket.Server({ server: apiServer });

apiApp.use(cors({ origin: 'http://44.203.253.121:8167', credentials: true }));
apiApp.use(bodyParser.json());

// Basic Auth Middleware
apiApp.use('/api', (req, res, next) => {
  const auth = { login: 'admin', password: 'secret' };
  const b64auth = (req.headers.authorization || '').split(' ')[1] || '';
  const [login, password] = Buffer.from(b64auth, 'base64').toString().split(':');
  if (login === auth.login && password === auth.password) return next();
  res.set('WWW-Authenticate', 'Basic realm="401"');
  res.status(401).send('Authentication required.');
});

// Login Endpoint
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
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// === WebSocket Setup ===
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

    pool.query('SELECT * FROM sampledata_table WHERE email = $1', [email])
      .then(result => {
        const user = result.rows[0];
        if (user) {
          ws.send(JSON.stringify({ type: 'data', payload: user }));
        }
      });

    ws.on('close', () => {
      for (const [email, client] of clients.entries()) {
        if (client === ws) clients.delete(email);
      }
    });

  } catch {
    ws.close();
  }
});

// Start API server
apiServer.listen(API_PORT, () => {
  console.log(`✅ Server + WebSocket running at http://44.203.253.121:${API_PORT}`);
});

// Create public tunnel
(async () => {
  const tunnel = await localtunnel({ port: API_PORT, subdomain: 'superuniquesubdomain123' });
  console.log(`🌍 Public tunnel available at: ${tunnel.url}`);
})();

// === Serve Login Page ===
const loginApp = express();
loginApp.use(express.static(path.join(__dirname, 'login')));

loginApp.listen(LOGIN_PORT, () => {
  console.log(`🚪 Login page running at http://44.203.253.121:${LOGIN_PORT}`);
});