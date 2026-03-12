const http = require('http');
const cors = require('cors');
const path = require('path');
const { Server } = require('socket.io');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const WebSocket = require('ws');
const { setupWSConnection } = require('y-websocket/bin/utils');

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

// Fallback all other routes to the React app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

// Initialize Gemini (Will need API key loaded in environment)
// Note: During local demo without keys, we'll provide a mock fallback if it fails
const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;

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

// --- Yjs WebSocket Integration ---
const wss = new WebSocket.Server({ noServer: true });
wss.on('connection', setupWSConnection);

server.on('upgrade', (request, socket, head) => {
  // Only handle upgrades intended for Yjs (we can path match if needed, but we'll accept all WS here since Socket.io has its own upgrade handler path usually under /socket.io/)
  if (request.url.startsWith('/socket.io/')) {
      // Let Socket.io handle it
      return;
  }
  
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Unified Server listening on port ${PORT}`);
});
