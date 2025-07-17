const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const bodyParser = require('body-parser');
const pool = require('./db'); // MySQL connection
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const jwtSecret = 'your-very-secure-secret'; // Change in production!

// ✅ REGISTER ROUTE
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ success: false, message: 'Missing fields' });

  try {
    const hashed = await bcrypt.hash(password, 10);
    await pool.query('INSERT INTO users (username, password_hash) VALUES (?, ?)', [username, hashed]);
    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Registration failed' });
  }
});

// ✅ LOGIN ROUTE
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ success: false, message: 'Missing fields' });

  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
    if (rows.length === 0) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const match = await bcrypt.compare(password, rows[0].password_hash);
    if (!match) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const token = jwt.sign({ userId: rows[0].id, username }, jwtSecret, { expiresIn: '1h' });
    return res.json({ success: true, token, username });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Login failed' });
  }
});

// ✅ SOCKET.IO CONNECTION
io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);

  socket.on('joinRoom', async ({ roomId, token }) => {
    try {
      const decoded = jwt.verify(token, jwtSecret);
      console.log(`✅ Authenticated user: ${decoded.username} joined room ${roomId}`);
      socket.join(roomId);
      socket.username = decoded.username;

      // Load latest document for this room
      const [rows] = await pool.query('SELECT code, language FROM documents WHERE room_id=?', [roomId]);
      if (rows.length > 0) {
        socket.emit('loadDocument', rows[0]);
      }

      // Load existing chat history
      const [chatRows] = await pool.query(
        'SELECT username, message, timestamp FROM chats WHERE room_id=? ORDER BY timestamp ASC',
        [roomId]
      );
      if (chatRows.length > 0) {
        socket.emit('loadChatHistory', chatRows);
      }

      const clients = Array.from(io.sockets.adapter.rooms.get(roomId) || []);
      if (clients.length > 1) {
        socket.to(roomId).emit('readyForCall');
      }
    } catch (err) {
      console.error(`❌ Invalid token from socket ${socket.id}`);
      socket.emit('authError', 'Invalid or expired token.');
    }
  });

  // ✅ Collaborative editing + code history snapshot
  socket.on('codeChange', async ({ roomId, code, language }) => {
    socket.to(roomId).emit('codeUpdate', code);

    try {
      // ✅ Fix: use the language actually sent by the client!
      await pool.query(
        'INSERT INTO code_history (room_id, code, language, username) VALUES (?, ?, ?, ?)',
        [roomId, code, language, socket.username]
      );
    } catch (err) {
      console.error('❌ Error saving code history:', err);
    }
  });

  // ✅ WebRTC signaling
  socket.on('ready', ({ roomId }) => {
    socket.to(roomId).emit('startCall');
  });

  socket.on('signal', ({ roomId, signal }) => {
    socket.to(roomId).emit('signal', signal);
  });

  // ✅ Secure multi-language code execution
  socket.on('runCode', ({ roomId, code, language }) => {
    console.log(`💻 Running code for room: ${roomId}, language: ${language}`);
    const tempDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

    let filename, dockerImage, runCommand;

    if (language === 'javascript') {
      filename = 'code.js';
      dockerImage = 'node:18';
      runCommand = `node ${filename}`;
    } else if (language === 'python') {
      filename = 'code.py';
      dockerImage = 'python:3.10';
      runCommand = `python ${filename}`;
    } else if (language === 'cpp') {
      filename = 'code.cpp';
      dockerImage = 'gcc:13';
      runCommand = `g++ ${filename} -o code.out && ./code.out`;
    } else {
      socket.emit('codeResult', '❌ Language not supported.');
      return;
    }

    const filepath = path.join(tempDir, filename);
    fs.writeFileSync(filepath, code);

    const dockerCmd = `docker run --rm -m 128m --network none -v ${tempDir}:/usr/src/app -w /usr/src/app ${dockerImage} bash -c "${runCommand}"`;
    console.log(`🚀 Executing: ${dockerCmd}`);

    exec(dockerCmd, { timeout: 5000 }, (error, stdout, stderr) => {
      if (error) {
        console.error(`❌ Execution error: ${error.message}`);
        socket.emit('codeResult', `❌ Error:\n${stderr || error.message}`);
      } else {
        socket.emit('codeResult', `✅ Output:\n${stdout}`);
      }
    });
  });

  // ✅ Integrated chat feature
  socket.on('chatMessage', async ({ roomId, message }) => {
    const username = socket.username;
    const timestamp = new Date();
    console.log(`💬 ${username} in ${roomId}: ${message}`);
    io.to(roomId).emit('newChatMessage', { username, message, timestamp });

    try {
      await pool.query(
        'INSERT INTO chats (room_id, username, message, timestamp) VALUES (?, ?, ?, ?)',
        [roomId, username, message, timestamp]
      );
    } catch (error) {
      console.error('❌ Failed to save chat:', error);
    }
  });

  socket.on('disconnect', () => console.log(`❌ Client disconnected: ${socket.id}`));
});

// ✅ Save latest code
app.post('/api/save', async (req, res) => {
  const { roomId, code, language } = req.body;
  if (!roomId || !code || !language) {
    return res.status(400).json({ error: 'roomId, code, and language required' });
  }
  try {
    await pool.query(
      'INSERT INTO documents (room_id, code, language) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE code=?, language=?, updated_at=NOW()',
      [roomId, code, language, code, language]
    );
    return res.json({ success: true });
  } catch (error) {
    console.error('❌ Error saving document:', error);
    return res.status(500).json({ error: 'Database error' });
  }
});

// ✅ Load latest code for a room
app.get('/api/load/:roomId', async (req, res) => {
  const { roomId } = req.params;
  try {
    const [rows] = await pool.query('SELECT code, language FROM documents WHERE room_id=?', [roomId]);
    if (rows.length === 0) return res.json({ code: '', language: 'javascript' });
    return res.json(rows[0]);
  } catch (error) {
    console.error('❌ Error loading document:', error);
    return res.status(500).json({ error: 'Database error' });
  }
});

// ✅ Fetch code history for playback
app.get('/api/history/:roomId', async (req, res) => {
  const { roomId } = req.params;
  try {
    const [rows] = await pool.query(
      'SELECT id, code, username, created_at FROM code_history WHERE room_id = ? ORDER BY created_at ASC',
      [roomId]
    );
    return res.json(rows);
  } catch (err) {
    console.error('❌ Error fetching history:', err);
    return res.status(500).json({ error: 'Database error' });
  }
});

const PORT = 5000;
server.listen(PORT, () => console.log(`🚀 Socket.IO server running on http://localhost:${PORT}`));
