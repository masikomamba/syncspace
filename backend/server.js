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
