import React, { useEffect, useRef, useState } from 'react';
import { Download } from 'lucide-react';
import Quill from 'quill';
import 'quill/dist/quill.snow.css';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { QuillBinding } from 'y-quill';

const userColors = [
  '#30bced', '#6eeb83', '#ffbc42', '#ecd444', 
  '#ee6352', '#9ac2c9', '#8acb88', '#1be7ff'
];
const myColor = userColors[Math.floor(Math.random() * userColors.length)];

const RichTextEditor = ({ roomId = 'sandbox-1', username = `User_${Math.floor(Math.random() * 1000)}` }) => {
  const containerRef = useRef(null);
  const quillRef = useRef(null);
  const providerRef = useRef(null);
  const bindingRef = useRef(null);
  const ydocRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || quillRef.current) return;

    // 1. Initialize Quill
    const quill = new Quill(containerRef.current, {
      theme: 'snow',
      modules: {
        toolbar: [
          [{ 'header': [1, 2, 3, false] }],
          ['bold', 'italic', 'underline', 'strike'],
          [{ 'color': [] }, { 'background': [] }],
          [{ 'list': 'ordered'}, { 'list': 'bullet' }],
          ['link', 'image', 'code-block']
        ]
      }
    });
    quillRef.current = quill;

    // 2. Initialize Yjs
    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;

    // 3. Connect to WebSocket
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.hostname === 'localhost' ? 'localhost:8080' : window.location.host;
    
    const provider = new WebsocketProvider(
      `${wsProtocol}//${wsHost}`, 
      roomId + '-text', 
      ydoc
    );
    providerRef.current = provider;

    // 4. Awareness
    provider.awareness.setLocalStateField('user', {
      name: username,
      color: myColor,
    });

    // 5. Bind Quill to Yjs text type
    const ytext = ydoc.getText('quill');
    const binding = new QuillBinding(ytext, quill, provider.awareness);
    bindingRef.current = binding;

    return () => {
      // Cleanup
      if (bindingRef.current) bindingRef.current.destroy();
      if (providerRef.current) providerRef.current.destroy();
      if (ydocRef.current) ydocRef.current.destroy();
    };
  }, [roomId, username]);

  const handleSaveDoc = () => {
    if (!quillRef.current) return;
    const html = quillRef.current.root.innerHTML;
    const fullHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>SyncSpace Document</title></head><body>${html}</body></html>`;
    const blob = new Blob([fullHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SyncSpace_Doc_${Date.now()}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }} className="rich-text-container">
      <button 
        onClick={handleSaveDoc}
        className="icon-btn"
        style={{ position: 'absolute', top: '6px', right: '8px', zIndex: 10, padding: '4px 8px', fontSize: '0.75rem', background: '#f0f0f0', color: '#333', border: '1px solid #ccc' }}
        title="Download Document"
      >
        <Download size={12} style={{ marginRight: '4px' }} /> Export HTML
      </button>
      <div 
        ref={containerRef} 
        style={{ 
          flex: 1, 
          backgroundColor: '#fff', 
          color: '#000', 
          borderBottomLeftRadius: 'var(--radius-lg)', 
          borderBottomRightRadius: 'var(--radius-lg)' 
        }} 
      />
    </div>
  );
};

export default RichTextEditor;
