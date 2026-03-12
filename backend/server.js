require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const { Server } = require('socket.io');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const WebSocket = require('ws');
const Y = require('yjs');
const syncProtocol = require('y-protocols/sync');
const awarenessProtocol = require('y-protocols/awareness');
const encoding = require('lib0/encoding');
const decoding = require('lib0/decoding');
const map = require('lib0/map');
const { Storage } = require('@google-cloud/storage');
const multer = require('multer');

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

// Serve static frontend files in production
app.use(express.static(path.join(__dirname, '../frontend/dist')));

const io = new Server(server, {
  cors: {
    origin: '*', // For development
    methods: ['GET', 'POST']
  }
});

// --- In-Memory Database Simulation ---
// In production, swap these for a real DB (PostgreSQL/MongoDB)
const db = {
  users: [], // { id, username, password, status }
  contacts: {} // { userId: [contactId1, contactId2] }
};

// Simple ID generator
const generateId = () => Math.random().toString(36).substr(2, 9);

// --- REST API Routes ---

// 1. Register
app.post('/api/auth/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  
  const existing = db.users.find(u => u.username === username);
  if (existing) return res.status(409).json({ error: 'Username already exists' });

  const newUser = { id: generateId(), username, password, status: 'online' };
  db.users.push(newUser);
  db.contacts[newUser.id] = [];
  
  res.json({ id: newUser.id, username: newUser.username });
});

// 2. Login
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.users.find(u => u.username === username && u.password === password);
  
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  
  user.status = 'online';
  res.json({ id: user.id, username: user.username });
});

// 3. Search Users (for adding to contacts)
app.get('/api/users/search', (req, res) => {
  const query = req.query.q?.toLowerCase() || '';
  const matches = db.users
    .filter(u => u.username.toLowerCase().includes(query))
    .map(u => ({ id: u.id, username: u.username }));
  res.json(matches);
});

// 4. Get Contacts
app.get('/api/contacts/:userId', (req, res) => {
  const userId = req.params.userId;
  const contactIds = db.contacts[userId] || [];
  
  const populatedContacts = contactIds.map(cid => {
    const contact = db.users.find(u => u.id === cid);
    return contact ? { id: contact.id, username: contact.username, status: contact.status } : null;
  }).filter(c => c !== null);

  res.json(populatedContacts);
});

// 5. Add Contact
app.post('/api/contacts/add', (req, res) => {
  const { userId, contactId } = req.body;
  
  if (!db.contacts[userId]) db.contacts[userId] = [];
  
  if (!db.contacts[userId].includes(contactId)) {
    db.contacts[userId].push(contactId);
  }
  
  res.json({ success: true });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'SyncSpace backend is running' });
});

// --- Google Cloud Storage Integration ---
const GCS_BUCKET_NAME = process.env.GCS_BUCKET_NAME || 'syncspace-files-divine';
let bucket = null;

try {
  const storage = new Storage(); // Uses Application Default Credentials on Cloud Run
  bucket = storage.bucket(GCS_BUCKET_NAME);
  console.log(`GCS bucket configured: ${GCS_BUCKET_NAME}`);
} catch (err) {
  console.warn('GCS not configured — file storage endpoints will return errors:', err.message);
}

// Multer: store uploads in memory before streaming to GCS
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50 MB limit
});

// Upload a file to GCS
app.post('/api/files/upload', upload.single('file'), async (req, res) => {
  try {
    if (!bucket) return res.status(503).json({ error: 'Cloud Storage not configured' });
    if (!req.file) return res.status(400).json({ error: 'No file provided' });

    const fileName = `${Date.now()}-${req.file.originalname}`;
    const blob = bucket.file(fileName);
    const stream = blob.createWriteStream({
      resumable: false,
      contentType: req.file.mimetype,
      metadata: {
        metadata: {
          uploadedBy: req.body.userId || 'anonymous',
          originalName: req.file.originalname
        }
      }
    });

    stream.on('error', (err) => {
      console.error('GCS upload error:', err);
      res.status(500).json({ error: 'Failed to upload file' });
    });

    stream.on('finish', async () => {
      res.json({
        success: true,
        fileName,
        originalName: req.file.originalname,
        size: req.file.size,
        contentType: req.file.mimetype
      });
    });

    stream.end(req.file.buffer);
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// List files in the bucket
app.get('/api/files', async (req, res) => {
  try {
    if (!bucket) return res.status(503).json({ error: 'Cloud Storage not configured' });

    const [files] = await bucket.getFiles();
    const fileList = files.map(f => ({
      name: f.name,
      size: f.metadata.size,
      contentType: f.metadata.contentType,
      created: f.metadata.timeCreated,
      originalName: f.metadata.metadata?.originalName || f.name,
      uploadedBy: f.metadata.metadata?.uploadedBy || 'unknown'
    }));

    res.json(fileList);
  } catch (err) {
    console.error('List files error:', err);
    res.status(500).json({ error: 'Failed to list files' });
  }
});

// Get a signed download URL for a file
app.get('/api/files/:filename', async (req, res) => {
  try {
    if (!bucket) return res.status(503).json({ error: 'Cloud Storage not configured' });

    const file = bucket.file(req.params.filename);
    const [exists] = await file.exists();
    if (!exists) return res.status(404).json({ error: 'File not found' });

    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 60 * 60 * 1000 // 1 hour
    });

    res.json({ url, fileName: req.params.filename });
  } catch (err) {
    console.error('Download URL error:', err);
    res.status(500).json({ error: 'Failed to generate download URL' });
  }
});

// Delete a file from the bucket
app.delete('/api/files/:filename', async (req, res) => {
  try {
    if (!bucket) return res.status(503).json({ error: 'Cloud Storage not configured' });

    const file = bucket.file(req.params.filename);
    const [exists] = await file.exists();
    if (!exists) return res.status(404).json({ error: 'File not found' });

    await file.delete();
    res.json({ success: true, deleted: req.params.filename });
  } catch (err) {
    console.error('Delete file error:', err);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

// Fallback all other routes to the React app
app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

// Initialize Gemini (Will need API key loaded in environment)
const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;
if (genAI) {
  console.log('Gemini AI initialized with API key');
} else {
  console.warn('No GEMINI_API_KEY found — AI will use simulated responses');
}

app.post('/api/ai/chat', async (req, res) => {
  try {
    const { prompt, context } = req.body;
    
    if (!genAI) {
      // Return a simulated response if no API key is present for testing the UI
      return res.json({ 
        response: `**Simulated AI Response**\n\nI received your prompt: "${prompt}"\n\nI also received ${context ? context.length : 0} characters of context from your editor. To use real Gemini, add GEMINI_API_KEY to the backend .env file.` 
      });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
    
    const fullPrompt = `
      You are an AI coding assistant and pair programming partner inside a collaborative workspace.
      Here is the current content of the user's editor:
      \`\`\`
      ${context || 'Empty document'}
      \`\`\`
      
      User's request: ${prompt}
    `;
    
    const result = await model.generateContent(fullPrompt);
    const response = await result.response.text();
    
    res.json({ response });
  } catch (error) {
    console.error('AI Generation Error:', error);
    res.status(500).json({ error: 'Failed to generate AI response' });
  }
});

// Move socket logic to a separate manager soon, but initialize here for now
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    console.log(`${socket.id} joined room: ${roomId}`);
    // Notify others in the room
    socket.to(roomId).emit('user-joined', socket.id);
  });

  socket.on('send-message', (data) => {
    // Broadcast the message to everyone in the room EXCEPT the sender
    socket.to(data.room).emit('receive-message', data);
  });

  socket.on('ready-for-call', (roomId) => {
    // Let everyone else know I am ready to receive offers
    socket.to(roomId).emit('user-joined', socket.id);
  });

  // --- WebRTC Signaling ---
  
  // 1. Send Offer
  socket.on('webrtc-offer', ({ target, caller, sdp }) => {
    socket.to(target).emit('webrtc-offer', { caller, sdp });
  });

  // 2. Send Answer
  socket.on('webrtc-answer', ({ target, caller, sdp }) => {
    socket.to(target).emit('webrtc-answer', { caller, sdp });
  });

  // 3. ICE Candidates
  socket.on('webrtc-ice-candidate', ({ target, candidate }) => {
    socket.to(target).emit('webrtc-ice-candidate', { candidate, sender: socket.id });
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
  });

  // --- Real-Time Direct Messaging ---
  socket.on('join-user-room', (userId) => {
    // A user joins a room named exactly after their User ID to receive DMs
    socket.join(userId);
    console.log(`User ${userId} joined their personal DM room`);
  });

  socket.on('direct-message', (data) => {
    // data = { toUserId, fromUserId, fromUsername, text }
    const { toUserId, fromUserId, fromUsername, text } = data;
    const msg = {
      user: fromUsername,
      text: text,
      timestamp: Date.now(),
      private: true,
      fromId: fromUserId
    };
    
    // Send to the target user
    io.to(toUserId).emit('direct-message', msg);
    // Also send back to the sender so they see their own message
    socket.emit('direct-message', msg);
  });
});

// --- Yjs WebSocket Integration (inline server, y-websocket v3 compatible) ---
const docs = new Map(); // roomName -> Y.Doc

const getYDoc = (docName) => {
  return map.setIfUndefined(docs, docName, () => {
    const doc = new Y.Doc();
    doc.gcEnabled = true;
    return doc;
  });
};

const messageSync = 0;
const messageAwareness = 1;

const send = (conn, message) => {
  if (conn.readyState === WebSocket.OPEN) {
    try {
      conn.send(message, (err) => { if (err) console.error('WS send error:', err); });
    } catch (e) { /* closed */ }
  }
};

const setupWSConnection = (ws, req) => {
  // Extract room name from URL path
  const docName = req.url.slice(1).split('?')[0] || 'default';
  const doc = getYDoc(docName);

  // Track connections per doc
  if (!doc.conns) doc.conns = new Set();
  doc.conns.add(ws);

  // Create awareness if not exists
  if (!doc.awareness) {
    doc.awareness = new awarenessProtocol.Awareness(doc);
    doc.awareness.setLocalState(null);
  }

  const awareness = doc.awareness;

  // Send sync step 1
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, messageSync);
  syncProtocol.writeSyncStep1(encoder, doc);
  send(ws, encoding.toUint8Array(encoder));

  // Send awareness states
  const awarenessStates = awareness.getStates();
  if (awarenessStates.size > 0) {
    const enc = encoding.createEncoder();
    encoding.writeVarUint(enc, messageAwareness);
    encoding.writeVarUint8Array(enc, awarenessProtocol.encodeAwarenessUpdate(awareness, Array.from(awarenessStates.keys())));
    send(ws, encoding.toUint8Array(enc));
  }

  // Listen for doc updates and broadcast
  const onUpdate = (update, origin) => {
    if (origin !== ws) {
      const enc = encoding.createEncoder();
      encoding.writeVarUint(enc, messageSync);
      syncProtocol.writeUpdate(enc, update);
      send(ws, encoding.toUint8Array(enc));
    }
  };
  doc.on('update', onUpdate);

  // Listen for awareness changes and broadcast
  const onAwarenessChange = ({ added, updated, removed }, origin) => {
    const changedClients = added.concat(updated).concat(removed);
    const enc = encoding.createEncoder();
    encoding.writeVarUint(enc, messageAwareness);
    encoding.writeVarUint8Array(enc, awarenessProtocol.encodeAwarenessUpdate(awareness, changedClients));
    const message = encoding.toUint8Array(enc);
    doc.conns.forEach(conn => {
      if (conn !== ws) send(conn, message);
    });
  };
  awareness.on('update', onAwarenessChange);

  ws.on('message', (data) => {
    try {
      const message = new Uint8Array(data);
      const decoder = decoding.createDecoder(message);
      const messageType = decoding.readVarUint(decoder);

      switch (messageType) {
        case messageSync: {
          const enc = encoding.createEncoder();
          encoding.writeVarUint(enc, messageSync);
          syncProtocol.readSyncMessage(decoder, enc, doc, ws);
          const reply = encoding.toUint8Array(enc);
          if (encoding.length(enc) > 1) send(ws, reply);
          break;
        }
        case messageAwareness: {
          awarenessProtocol.applyAwarenessUpdate(awareness, decoding.readVarUint8Array(decoder), ws);
          break;
        }
      }
    } catch (e) {
      console.error('WS message error:', e);
    }
  });

  ws.on('close', () => {
    doc.conns.delete(ws);
    doc.off('update', onUpdate);
    awareness.off('update', onAwarenessChange);
    awarenessProtocol.removeAwarenessStates(awareness, [doc.clientID], null);
    if (doc.conns.size === 0) {
      docs.delete(docName);
      doc.destroy();
    }
  });
};

const wss = new WebSocket.Server({ noServer: true });
wss.on('connection', setupWSConnection);

server.on('upgrade', (request, socket, head) => {
  if (request.url.startsWith('/socket.io/')) {
    return; // Let Socket.io handle its own upgrades
  }
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Unified Server listening on port ${PORT}`);
});
