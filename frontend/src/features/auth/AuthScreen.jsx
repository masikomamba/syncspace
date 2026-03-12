import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

const AuthScreen = () => {
  const { login, register } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (isLogin) {
        await login(username, password);
      } else {
        await register(username, password);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div style={{ height: '100vh', width: '100vw', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
      <div className="glass-panel" style={{ width: '400px', padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <h2 style={{ textAlign: 'center', margin: 0 }}>SyncSpace</h2>
        <h4 style={{ textAlign: 'center', margin: 0, color: 'var(--text-secondary)' }}>
          {isLogin ? 'Welcome back' : 'Create an account'}
        </h4>

        {error && (
          <div style={{ padding: '12px', background: 'rgba(255, 68, 68, 0.1)', color: 'var(--accent-red)', borderRadius: 'var(--radius-md)', fontSize: '0.9rem', textAlign: 'center' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '8px', color: 'var(--text-secondary)' }}>Username</label>
            <input 
              type="text" 
              className="chat-input"
              style={{ width: '100%' }}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '8px', color: 'var(--text-secondary)' }}>Password</label>
            <input 
              type="password" 
              className="chat-input"
              style={{ width: '100%' }}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button 
            type="submit" 
            style={{ 
              background: 'var(--accent-blue)', 
              color: 'white', 
              border: 'none', 
              padding: '12px', 
              borderRadius: 'var(--radius-md)', 
              cursor: 'pointer',
              fontWeight: 600,
              marginTop: '8px'
            }}
          >
            {isLogin ? 'Log In' : 'Sign Up'}
          </button>
        </form>

        <div style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <span 
            style={{ color: 'var(--accent-blue)', cursor: 'pointer', textDecoration: 'underline' }}
            onClick={() => { setIsLogin(!isLogin); setError(''); }}
          >
            {isLogin ? 'Sign up here' : 'Log in here'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default AuthScreen;
