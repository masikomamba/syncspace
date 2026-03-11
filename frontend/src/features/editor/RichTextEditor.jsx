import React, { useEffect, useRef, useState } from 'react';
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

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }} className="rich-text-container">
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
