import React, { useState, useEffect, useRef } from 'react';
import { Send, User } from 'lucide-react';
import { io } from 'socket.io-client';

// We'll manage a singleton socket later, but for now we connect locally
const socketHost = window.location.hostname === 'localhost' ? 'http://localhost:8080' : '/';
const socket = io(socketHost);

const ChatPanel = ({ roomId = 'sandbox-1', username = `User_${Math.floor(Math.random() * 1000)}` }) => {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    // Join Room
    socket.emit('join-room', roomId);

    // Listen for incoming messages
    socket.on('receive-message', (data) => {
      setMessages((prev) => [...prev, data]);
    });

    socket.on('user-joined', (id) => {
       setMessages(prev => [...prev, { system: true, text: `User ${id.substring(0, 4)} joined`, id: Date.now() }]);
    });

    return () => {
      socket.off('receive-message');
      socket.off('user-joined');
    };
  }, [roomId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const messageData = {
      room: roomId,
      user: username,
      text: inputValue,
      timestamp: new Date().toISOString(),
      id: Date.now()
    };

    // Optimistically add to local state
    setMessages((prev) => [...prev, messageData]);
    
    // Broadcast to others
    socket.emit('send-message', messageData);
    setInputValue('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div 
        style={{ 
          flex: 1, 
          overflowY: 'auto', 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '12px',
          paddingBottom: '16px'
        }}
        className="chat-messages"
      >
        {messages.map((msg, idx) => (
          msg.system ? (
            <div key={idx} style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {msg.text}
            </div>
          ) : (
            <div 
              key={msg.id || idx} 
              style={{ 
                alignSelf: msg.user === username ? 'flex-end' : 'flex-start',
                maxWidth: '85%'
              }}
            >
              {msg.user !== username && (
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginLeft: '8px' }}>
                  {msg.user}
                </span>
              )}
              <div 
                style={{
                  padding: '8px 12px',
                  borderRadius: '12px',
                  background: msg.user === username ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                  color: msg.user === username ? 'white' : 'var(--text-primary)',
                  boxShadow: 'var(--shadow-sm)',
                  marginTop: '4px'
                }}
              >
                {msg.text}
              </div>
            </div>
          )
        ))}
        <div ref={messagesEndRef} />
      </div>

      <form 
        onSubmit={handleSend}
        style={{ 
          display: 'flex', 
          gap: '8px', 
          paddingTop: '16px',
          borderTop: '1px solid var(--border-color)' 
        }}
      >
        <input 
          type="text" 
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Type a message..."
          style={{
            flex: 1,
            padding: '10px 14px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
            background: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            outline: 'none',
          }}
        />
        <button 
          type="submit" 
          className="btn-primary" 
          style={{ padding: '0 12px', display: 'flex', alignItems: 'center' }}
          disabled={!inputValue.trim()}
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  );
};

export default ChatPanel;
