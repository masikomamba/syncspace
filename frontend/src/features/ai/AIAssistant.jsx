import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

const AIAssistant = ({ getEditorContext }) => {
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Hi! I am your AI assistant. Ask me to explain the code, suggest improvements, or generate new sections based on your current editor context.' }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const userText = inputValue;
    setMessages(prev => [...prev, { role: 'user', text: userText }]);
    setInputValue('');
    setIsLoading(true);

    try {
      // Grab the latest context from whichever editor is active
      const context = getEditorContext ? getEditorContext() : '';

      const apiHost = window.location.hostname === 'localhost' ? 'http://localhost:8080' : '';
      const response = await fetch(`${apiHost}/api/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: userText,
          context: context
        })
      });

      if (!response.ok) throw new Error('API Error');
      
      const data = await response.json();
      setMessages(prev => [...prev, { role: 'assistant', text: data.response }]);
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { role: 'system', text: 'Error connecting to AI service.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      
      <div 
        style={{ 
          flex: 1, 
          overflowY: 'auto', 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '16px',
          paddingBottom: '16px'
        }}
      >
        {messages.map((msg, idx) => (
          <div 
            key={idx} 
            style={{ 
              display: 'flex',
              flexDirection: 'column',
              alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
              {msg.role === 'assistant' && <Bot size={14} />}
              <span>{msg.role === 'user' ? 'You' : msg.role === 'assistant' ? 'Gemini AI' : 'System'}</span>
            </div>
            <div 
              style={{
                padding: '12px 16px',
                borderRadius: 'var(--radius-lg)',
                background: msg.role === 'user' ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                color: msg.role === 'user' ? 'white' : 'var(--text-primary)',
                boxShadow: 'var(--shadow-sm)',
                maxWidth: '90%',
                lineHeight: 1.6,
                fontSize: '0.9rem',
                border: msg.role === 'assistant' ? '1px solid var(--border-color)' : 'none'
              }}
              className="markdown-body"
            >
              {msg.role === 'system' ? (
                 <span style={{ color: 'var(--accent-red)' }}>{msg.text}</span>
              ) : (
                <ReactMarkdown>{msg.text}</ReactMarkdown>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', color: 'var(--text-secondary)' }}>
            <Loader2 size={16} className="spin" style={{ animation: 'spin 1s linear infinite' }} />
            <span style={{ fontSize: '0.85rem' }}>AI is thinking...</span>
            <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form 
        onSubmit={handleSubmit}
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
          placeholder="Ask AI about this document..."
          disabled={isLoading}
          style={{
            flex: 1,
            padding: '10px 14px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
            background: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            outline: 'none',
            opacity: isLoading ? 0.6 : 1
          }}
        />
        <button 
          type="submit" 
          className="btn-primary" 
          disabled={!inputValue.trim() || isLoading}
          style={{ padding: '0 12px', display: 'flex', alignItems: 'center', opacity: (!inputValue.trim() || isLoading) ? 0.6 : 1 }}
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  );
};

export default AIAssistant;
