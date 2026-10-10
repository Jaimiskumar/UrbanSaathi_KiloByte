import React, { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Toaster, toast } from 'react-hot-toast';
import axios from 'axios';
import { io } from 'socket.io-client';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import CitizenDashboard from './pages/CitizenDashboard';
import MobileAppPage from './pages/MobileAppPage';
import PortalGateway from './pages/PortalGateway';
import MobileV2VDashcam from './pages/MobileV2VDashcam';

function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    if (token && userData) {
      setUser(JSON.parse(userData));
    }
  }, []);

  useEffect(() => {
    const socket = io({
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5
    });

    socket.on('violation-alert', (alert) => {
      toast(
        () => (
          <div className="flex flex-col space-y-2">
            <div className="font-bold text-red-600">Violation Alert</div>
            <div className="text-sm">
              <p><strong>Vehicle:</strong> {alert.vehicleNumber}</p>
              <p><strong>Type:</strong> {alert.violationType}</p>
              <p><strong>Zone:</strong> {alert.zone}</p>
              <p className="mt-2 text-xs text-gray-600">{alert.message}</p>
            </div>
          </div>
        ),
        {
          duration: 10000,
          style: {
            background: '#fee',
            color: '#c41e3a',
            border: '2px solid #c41e3a'
          }
        }
      );
    });

    socket.on('admin_incident_alert', (incident) => {
      toast(
        () => (
          <div className="flex flex-col space-y-1">
            <div className="font-bold text-red-700">Traffic Incident Alert</div>
            <div className="text-sm">{incident.title}</div>
            <div className="text-xs text-gray-600">Authority: {incident.authority}</div>
            <div className="text-xs font-semibold text-red-700">{incident.authorityAction}</div>
          </div>
        ),
        { duration: 12000, style: { background: '#fff7ed', border: '2px solid #f97316' } }
      );
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const handleLogin = (payload) => {
    const accessToken = payload.accessToken || payload.token;
    if (accessToken) {
      localStorage.setItem('token', accessToken);
    }
    if (payload.refreshToken) {
      localStorage.setItem('refreshToken', payload.refreshToken);
    }
    localStorage.setItem('user', JSON.stringify(payload.user));
    setUser(payload.user);
  };

  const handleLogout = async () => {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        await axios.post('/api/auth/logout', { refreshToken });
      }
    } catch (error) {
      // Ignore logout API failures and clear client state regardless.
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      setUser(null);
    }
  };

  return (
    <BrowserRouter>
      <Toaster position="top-right" />
      <Routes>
        <Route path="/" element={<PortalGateway user={user} />} />
        <Route path="/mobile" element={<MobileAppPage />} />
        <Route path="/app" element={<MobileAppPage />} />
        <Route path="/dashcam" element={<MobileV2VDashcam />} />
        <Route path="/v2v-mobile" element={<MobileV2VDashcam />} />
        <Route
          path="/login"
          element={user ? <Navigate to={user.role === 'admin' ? '/admin' : '/citizen'} /> : <Login onLogin={handleLogin} />}
        />
        <Route
          path="/admin/*"
          element={user?.role === 'admin' ? <AdminDashboard user={user} onLogout={handleLogout} /> : <Navigate to="/login" />}
        />
        <Route
          path="/citizen/*"
          element={user?.role === 'citizen' ? <CitizenDashboard user={user} onLogout={handleLogout} /> : <Navigate to="/login" />}
        />
        <Route
          path="*"
          element={<Navigate to="/" />}
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
