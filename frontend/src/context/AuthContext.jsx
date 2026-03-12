import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('syncspace_user');
    if (saved) {
      try {
        setUser(JSON.parse(saved));
      } catch (e) { }
    }
    setIsReady(true);
  }, []);

  const login = async (username, password) => {
    const host = window.location.hostname === 'localhost' ? 'http://localhost:8080' : '';
    const res = await fetch(`${host}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    
    setUser(data);
    localStorage.setItem('syncspace_user', JSON.stringify(data));
    return data;
  };

  const register = async (username, password) => {
    const host = window.location.hostname === 'localhost' ? 'http://localhost:8080' : '';
    const res = await fetch(`${host}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    setUser(data);
    localStorage.setItem('syncspace_user', JSON.stringify(data));
    return data;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('syncspace_user');
  };

  if (!isReady) return null;

  return (
    <AuthContext.Provider value={{ user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
