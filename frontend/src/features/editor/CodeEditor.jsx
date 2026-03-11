import React, { useEffect, useRef, useState } from 'react';
import Editor from '@monaco-editor/react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { MonacoBinding } from 'y-monaco';

// Simple hash map for generating random user cursor colors
const userColors = [
  '#30bced',
  '#6eeb83',
  '#ffbc42',
  '#ecd444',
  '#ee6352',
  '#9ac2c9',
  '#8acb88',
  '#1be7ff'
];

const myColor = userColors[Math.floor(Math.random() * userColors.length)];

const CodeEditor = ({ roomId = 'sandbox-1', username = `User_${Math.floor(Math.random() * 1000)}` }) => {
  const editorRef = useRef(null);
  const [provider, setProvider] = useState(null);

  // Called when Monaco mounts
  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;

    // 1. Initialize a Yjs Document
    const ydoc = new Y.Doc();

    // 2. Setup the WebSockets connection
    // In production, we connect to the same host using wss://. Locally, we use ws://
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // If we're on localhost:5555 (dev server), point to localhost:8080 (backend)
    // Otherwise, point to the current host (production Cloud Run)
    const wsHost = window.location.hostname === 'localhost' ? 'localhost:8080' : window.location.host;
    
    const wsProvider = new WebsocketProvider(
      `${wsProtocol}//${wsHost}`,
      roomId + '-code',
      ydoc
    );

    // 3. Define the collaborative awareness state (cursors, selection)
    wsProvider.awareness.setLocalStateField('user', {
      name: username,
      color: myColor,
    });

    // 4. Bind Yjs text type to Monaco Editor
    const ytext = ydoc.getText('monaco');
    const binding = new MonacoBinding(
      ytext, 
      editorRef.current.getModel(), 
      new Set([editorRef.current]), 
      wsProvider.awareness
    );

    setProvider(wsProvider);

    return () => {
      wsProvider.destroy();
      ydoc.destroy();
      binding.destroy();
    };
  };

  useEffect(() => {
    // Inject dynamic CSS for awareness cursors
    const style = document.createElement('style');
    style.innerHTML = `
      .yRemoteSelection { background-color: rgb(250, 129, 0, .5); }
      .yRemoteSelectionHead { position: absolute; border-left: pink solid 2px; border-top: pink solid 2px; border-bottom: pink solid 2px; height: 100%; box-sizing: border-box; }
      .yRemoteSelectionHead::after { position: absolute; content: ' '; border: 3px solid pink; border-radius: 4px; left: -4px; top: -5px; background-color: pink; }
    `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, []);

  return (
    <div style={{ height: '100%', width: '100%', borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
      <Editor
        height="100%"
        defaultLanguage="javascript"
        theme="vs-dark"
        onMount={handleEditorDidMount}
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          fontFamily: 'JetBrains Mono, "Fira Code", Consolas, monospace',
          roundedSelection: false,
          scrollBeyondLastLine: false,
          padding: { top: 16 }
        }}
      />
    </div>
  );
};

export default CodeEditor;
