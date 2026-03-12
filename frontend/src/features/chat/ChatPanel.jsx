import React, { useState, useEffect, useRef } from 'react';
import { Send, User, Download, Search, UserPlus } from 'lucide-react';
import { io } from 'socket.io-client';

const socketHost = window.location.hostname === 'localhost' ? 'http://localhost:8080' : '/';
const socket = io(socketHost);

const ChatPanel = ({ roomId = 'sandbox-1', username, userId }) => {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [chatMode, setChatMode] = useState('room'); // 'room' or 'dms'
  const [contacts, setContacts] = useState([]);
  const [activeContact, setActiveContact] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const messagesEndRef = useRef(null);

  const loadContacts = async () => {
    try {
      const apiHost = window.location.hostname === 'localhost' ? 'http://localhost:8080' : '';
      const res = await fetch(`${apiHost}/api/contacts/${userId}`);
      if (res.ok) {
        setContacts(await res.json());
      }
    } catch (e) {
      console.error('Failed to load contacts', e);
    }
  };

  useEffect(() => {
    if (userId) {
      loadContacts();
      socket.emit('join-user-room', userId);
    }
  }, [userId]);

  useEffect(() => {
    socket.emit('join-room', roomId);

    socket.on('user-joined', (user) => {
      setMessages(prev => [...prev, { system: true, text: `${user} joined the room` }]);
    });

    socket.on('user-left', (user) => {
      setMessages(prev => [...prev, { system: true, text: `${user} left the room` }]);
    });

    socket.on('receive-message', (data) => {
      setMessages(prev => [...prev, data]);
    });

    socket.on('direct-message', (data) => {
      setMessages(prev => [...prev, data]);
    });

    return () => {
      socket.off('user-joined');
      socket.off('user-left');
      socket.off('receive-message');
      socket.off('direct-message');
    };
  }, [roomId, userId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    try {
      const apiHost = window.location.hostname === 'localhost' ? 'http://localhost:8080' : '';
      const res = await fetch(`${apiHost}/api/users/search?q=${encodeURIComponent(searchQuery)}`);
      if (res.ok) {
        setSearchResults(await res.json());
      }
    } catch (e) {}
  };

  const handleAddContact = async (contactId) => {
    if (contactId === userId) return;
    try {
      const apiHost = window.location.hostname === 'localhost' ? 'http://localhost:8080' : '';
      await fetch(`${apiHost}/api/contacts/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, contactId })
      });
      loadContacts();
      setSearchQuery('');
      setSearchResults([]);
    } catch (e) {}
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    if (chatMode === 'room') {
      const messageData = { room: roomId, user: username, text: inputValue };
      socket.emit('send-message', messageData);
      setMessages(prev => [...prev, { ...messageData, timestamp: Date.now() }]);
    } else if (chatMode === 'dms' && activeContact) {
      socket.emit('direct-message', {
        toUserId: activeContact.id,
        fromUserId: userId,
        fromUsername: username,
        text: inputValue
      });
    }

    setInputValue('');
  };

  const handleSaveChat = () => {
    const chatText = messages.map(m => {
      if (m.system) return `[System] ${m.text}`;
      return `[${new Date(m.timestamp || Date.now()).toLocaleTimeString()}] ${m.private ? '(DM) ' : ''}${m.user === username ? 'You' : m.user}: ${m.text}`;
    }).join('\n');
    
    const blob = new Blob([chatText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SyncSpace_Chat_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const visibleMessages = messages.filter(m => {
    if (chatMode === 'room') return !m.private;
    if (chatMode === 'dms') {
      if (!activeContact) return false;
      return m.private && (m.fromId === activeContact.id || m.fromId === userId);
    }
    return false;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      
      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <button 
          onClick={() => setChatMode('room')}
          style={{ flex: 1, padding: '8px', background: chatMode === 'room' ? 'var(--bg-tertiary)' : 'transparent', color: chatMode === 'room' ? 'white' : 'var(--text-secondary)', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 600 }}
        >
          Room Chat
        </button>
        <button 
          onClick={() => setChatMode('dms')}
          style={{ flex: 1, padding: '8px', background: chatMode === 'dms' ? 'var(--bg-tertiary)' : 'transparent', color: chatMode === 'dms' ? 'white' : 'var(--text-secondary)', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 600 }}
        >
          Direct Messages
        </button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingBottom: '12px' }}>
        <button onClick={handleSaveChat} className="icon-btn" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: '0.8rem', padding: '6px 12px' }}>
          <Download size={14} style={{ marginRight: '6px' }} /> Export Chat
        </button>
      </div>

      {chatMode === 'dms' && !activeContact && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: '8px' }}>
            <input 
              type="text" 
              className="chat-input" 
              placeholder="Search users..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ flex: 1 }}
            />
            <button type="submit" className="icon-btn" style={{ background: 'var(--accent-blue)', color: 'white' }}>
              <Search size={16} />
            </button>
          </form>
          
          {searchResults.length > 0 && (
            <div style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', padding: '8px' }}>
              <h5 style={{ margin: '0 0 8px 0', color: 'var(--text-secondary)' }}>Search Results</h5>
              {searchResults.map(res => (
                <div key={res.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px', background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)', marginBottom: '4px' }}>
                  <span style={{ fontSize: '0.9rem' }}>{res.username}</span>
                  <button onClick={() => handleAddContact(res.id)} className="icon-btn" style={{ padding: '4px' }}>
                    <UserPlus size={16} color="var(--accent-blue)" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div style={{ flex: 1, overflowY: 'auto' }}>
            <h5 style={{ margin: '0 0 12px 0', color: 'var(--text-secondary)' }}>Your Contacts</h5>
            {contacts.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textAlign: 'center', marginTop: '32px' }}>No contacts yet. Search to add someone!</p>
            ) : (
              contacts.map(c => (
                <div 
                  key={c.id} 
                  onClick={() => setActiveContact(c)}
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', cursor: 'pointer', marginBottom: '8px' }}
                >
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <User size={16} color="white" />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 600 }}>{c.username}</div>
                    <div style={{ fontSize: '0.75rem', color: c.status === 'online' ? 'var(--accent-green)' : 'var(--text-secondary)' }}>{c.status}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {(chatMode === 'room' || (chatMode === 'dms' && activeContact)) && (
        <>
          {chatMode === 'dms' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '12px', borderBottom: '1px solid var(--border-color)', marginBottom: '12px' }}>
              <button 
                onClick={() => setActiveContact(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--accent-blue)', cursor: 'pointer', fontSize: '1.2rem' }}
              >
                &larr;
              </button>
              <span style={{ fontWeight: 600 }}>{activeContact.username}</span>
            </div>
          )}
          <div 
            style={{ 
              flex: 1, 
              overflowY: 'auto', 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '12px',
              paddingRight: '8px',
              marginBottom: '16px'
            }}
          >
            {visibleMessages.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: 'auto', marginBottom: 'auto' }}>
                No messages yet.
              </div>
            )}
            {visibleMessages.map((msg, idx) => (
              <div key={idx} style={{ 
                alignSelf: msg.system ? 'center' : (msg.user === username ? 'flex-end' : 'flex-start'),
                maxWidth: msg.system ? '100%' : '85%'
              }}>
                {msg.system ? (
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', padding: '4px 12px', background: 'var(--bg-tertiary)', borderRadius: '12px' }}>
                    {msg.text}
                  </span>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: msg.user === username ? 'flex-end' : 'flex-start' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px', marginLeft: '4px', marginRight: '4px' }}>
                      {msg.user}
                    </span>
                    <div style={{ 
                      background: msg.user === username ? 'var(--accent-blue)' : 'var(--bg-tertiary)',
                      color: msg.user === username ? 'white' : 'var(--text-primary)',
                      padding: '10px 14px',
                      borderRadius: '16px',
                      borderBottomRightRadius: msg.user === username ? '4px' : '16px',
                      borderBottomLeftRadius: msg.user === username ? '16px' : '4px',
                      fontSize: '0.95rem',
                      lineHeight: '1.4'
                    }}>
                      {msg.text}
                    </div>
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={chatMode === 'dms' ? `Message ${activeContact?.username}...` : "Type a message..."}
              className="chat-input"
              style={{ flex: 1 }}
            />
            <button 
              type="submit" 
              className="icon-btn" 
              style={{ background: inputValue.trim() ? 'var(--accent-blue)' : 'var(--bg-tertiary)', color: inputValue.trim() ? 'white' : 'var(--text-secondary)' }}
            >
              <Send size={18} />
            </button>
          </form>
        </>
      )}
    </div>
  );
};

export default ChatPanel;
