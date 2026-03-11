import React, { useState } from 'react';
import ChatPanel from './features/chat/ChatPanel';
import VideoGrid from './features/video/VideoGrid';
import CodeEditor from './features/editor/CodeEditor';
import RichTextEditor from './features/editor/RichTextEditor';
import AIAssistant from './features/ai/AIAssistant';
import { 
  MonitorPlay, 
  MessageSquare, 
  Code2, 
  FileText, 
  Bot, 
  Settings,
  Users
} from 'lucide-react';
import './index.css';

// Placeholder components - will be replaced in subsequent phases
const Placeholder = ({ title, icon: Icon }) => (
  <div className="flex-center" style={{ height: '100%', flexDirection: 'column', color: 'var(--text-secondary)', gap: '16px' }}>
    <Icon size={48} opacity={0.5} />
    <h2>{title}</h2>
    <p>Component under construction</p>
  </div>
);

function App() {
  const [activeTab, setActiveTab] = useState('code');
  const [rightPanel, setRightPanel] = useState('chat'); // 'chat', 'ai', 'video', or 'closed'

  const toggleRightPanel = (panel) => {
    if (rightPanel === panel) {
      setRightPanel('closed');
    } else {
      setRightPanel(panel);
    }
  };

  return (
    <div className="app-container">
      {/* LEFT SIDEBAR */}
      <div className="sidebar">
        <div style={{ marginBottom: '24px', color: 'var(--accent-primary)' }}>
          <MonitorPlay size={28} />
        </div>
        
        <button 
          className={`icon-btn ${activeTab === 'code' ? 'active' : ''}`}
          onClick={() => setActiveTab('code')}
          title="Code Editor"
        >
          <Code2 size={22} />
        </button>
        
        <button 
          className={`icon-btn ${activeTab === 'text' ? 'active' : ''}`}
          onClick={() => setActiveTab('text')}
          title="Rich Text"
        >
          <FileText size={22} />
        </button>

        <div style={{ flex: 1 }}></div>

        <button 
          className={`icon-btn ${rightPanel === 'chat' ? 'active' : ''}`}
          onClick={() => toggleRightPanel('chat')}
          title="Chat"
        >
          <MessageSquare size={22} />
        </button>

        <button 
          className={`icon-btn ${rightPanel === 'ai' ? 'active' : ''}`}
          onClick={() => toggleRightPanel('ai')}
          title="AI Assistant"
        >
          <Bot size={22} />
        </button>
        
        <button className="icon-btn" title="Settings">
          <Settings size={22} />
        </button>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="main-content">
        {/* TOP NAVBAR */}
        <div className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontWeight: 600, fontSize: '1.1rem' }}>SyncSpace</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', padding: '2px 8px', background: 'var(--bg-tertiary)', borderRadius: '12px' }}>
              Room: sandbox-1
            </span>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
              <Users size={16} />
              <span style={{ fontSize: '0.9rem' }}>1 Online</span>
            </div>
            <button className="btn-primary" onClick={() => toggleRightPanel('video')}>
              <MonitorPlay size={16} style={{ marginRight: '6px', display: 'inline' }} />
              Video Call
            </button>
          </div>
        </div>

        {/* WORKSPACE AREA (Editor + Floating Panels) */}
        <div className="workspace-area">
          {/* Main Editor Canvas */}
          <div style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>
            {activeTab === 'code' ? (
              <CodeEditor roomId="sandbox-1" />
            ) : (
              <div style={{ height: 'calc(100vh - 108px)' }}>
                <RichTextEditor roomId="sandbox-1" />
              </div>
            )}
          </div>

          {/* Right Side Panel */}
          <div className="side-panel" data-state={rightPanel !== 'closed' ? 'open' : 'closed'}>
            <div className="panel-header">
              <h3>
                {rightPanel === 'chat' && 'Team Chat'}
                {rightPanel === 'ai' && 'Gemini AI Assistant'}
                {rightPanel === 'video' && 'Video Call'}
              </h3>
              <button className="icon-btn" onClick={() => setRightPanel('closed')}>
                &times;
              </button>
            </div>
            <div className="panel-content" style={{ display: 'flex', flexDirection: 'column' }}>
              {rightPanel === 'chat' && <ChatPanel roomId="sandbox-1" username={`User_${Math.floor(Math.random() * 1000)}`} />}
              {rightPanel === 'ai' && <AIAssistant getEditorContext={() => "Current document context would go here."} />}
              {rightPanel === 'video' && <VideoGrid roomId="sandbox-1" />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
