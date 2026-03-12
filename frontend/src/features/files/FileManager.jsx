import React, { useState, useEffect, useRef } from 'react';
import { Upload, File, Trash2, Download, RefreshCw, FolderOpen } from 'lucide-react';

const FileManager = () => {
  const [files, setFiles] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const apiHost = window.location.hostname === 'localhost' ? 'http://localhost:8080' : '';

  const loadFiles = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${apiHost}/api/files`);
      if (res.ok) {
        setFiles(await res.json());
      }
    } catch (err) {
      console.error('Failed to load files:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadFiles();
  }, []);

  const handleUpload = async (file) => {
    if (!file) return;
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`${apiHost}/api/files/upload`, {
        method: 'POST',
        body: formData
      });

      if (res.ok) {
        loadFiles();
      } else {
        console.error('Upload failed');
      }
    } catch (err) {
      console.error('Upload error:', err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownload = async (fileName) => {
    try {
      const res = await fetch(`${apiHost}/api/files/${encodeURIComponent(fileName)}`);
      if (res.ok) {
        const data = await res.json();
        window.open(data.url, '_blank');
      }
    } catch (err) {
      console.error('Download error:', err);
    }
  };

  const handleDelete = async (fileName) => {
    try {
      const res = await fetch(`${apiHost}/api/files/${encodeURIComponent(fileName)}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        loadFiles();
      }
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  };

  const formatSize = (bytes) => {
    const num = parseInt(bytes);
    if (num < 1024) return `${num} B`;
    if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
    return `${(num / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '16px' }}>
      
      {/* Upload Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: `2px dashed ${dragOver ? 'var(--accent-primary)' : 'var(--border-color)'}`,
          borderRadius: 'var(--radius-lg)',
          padding: '24px',
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          background: dragOver ? 'rgba(99, 102, 241, 0.1)' : 'transparent'
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          style={{ display: 'none' }}
          onChange={(e) => {
            if (e.target.files[0]) handleUpload(e.target.files[0]);
            e.target.value = '';
          }}
        />
        {isUploading ? (
          <div style={{ color: 'var(--accent-primary)' }}>
            <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', marginBottom: '8px' }} />
            <p style={{ fontSize: '0.85rem', margin: 0 }}>Uploading...</p>
            <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
          </div>
        ) : (
          <>
            <Upload size={24} style={{ color: 'var(--text-secondary)', marginBottom: '8px' }} />
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
              Drop a file or click to upload
            </p>
          </>
        )}
      </div>

      {/* File List Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h4 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          <FolderOpen size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
          Cloud Files ({files.length})
        </h4>
        <button
          onClick={loadFiles}
          className="icon-btn"
          style={{ padding: '4px' }}
          title="Refresh"
        >
          <RefreshCw size={14} style={isLoading ? { animation: 'spin 1s linear infinite' } : {}} />
        </button>
      </div>

      {/* File List */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {files.length === 0 && !isLoading && (
          <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '32px' }}>
            No files uploaded yet.
          </div>
        )}

        {files.map((file) => (
          <div
            key={file.name}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px',
              background: 'var(--bg-tertiary)',
              borderRadius: 'var(--radius-md)',
              transition: 'background 0.2s'
            }}
          >
            <File size={18} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: '0.85rem',
                fontWeight: 600,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                {file.originalName}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                {formatSize(file.size)} · {formatDate(file.created)}
              </div>
            </div>
            <button
              onClick={() => handleDownload(file.name)}
              className="icon-btn"
              style={{ padding: '4px' }}
              title="Download"
            >
              <Download size={14} />
            </button>
            <button
              onClick={() => handleDelete(file.name)}
              className="icon-btn"
              style={{ padding: '4px', color: 'var(--accent-red)' }}
              title="Delete"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FileManager;
