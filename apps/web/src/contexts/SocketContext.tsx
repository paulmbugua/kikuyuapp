// src/contexts/SocketContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { backendOrigin } from '@/utils/axiosConfig';
import { useAuth } from '@/contexts/AuthContext';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  reconnect: () => void;
  emitEvent: (event: string, data?: any) => void;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  reconnect: () => {},
  emitEvent: () => {},
});

export const useSocket = () => useContext(SocketContext);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading || !isAuthenticated) return;

    const token = localStorage.getItem('accessToken');
    if (!token) return;

    const socketInstance = io(backendOrigin, {
      auth: { token },
      transports: ['polling', 'websocket'],
    });

    socketInstance.on('connect', () => {
      setIsConnected(true);
    });

    socketInstance.on('disconnect', () => {
      setIsConnected(false);
    });

    socketInstance.on('connect_error', (err) => {
      console.error('Socket connection error:', err.message);
      setIsConnected(false);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.removeAllListeners();
      socketInstance.disconnect();
      setSocket(null);
      setIsConnected(false);
    };
  }, [isAuthenticated, isLoading]);

  const reconnect = () => {
    if (socket) {
      const token = localStorage.getItem('accessToken');
      if (!token) return;
      socket.auth = { token };
      socket.disconnect();
      socket.connect();
    }
  };

  const emitEvent = (event: string, data?: any) => {
    if (socket && isConnected) {
      socket.emit(event, data);
    } else {
      console.warn(`Cannot emit ${event}: socket not connected`);
    }
  };

  return (
    <SocketContext.Provider value={{ socket, isConnected, reconnect, emitEvent }}>
      {children}
    </SocketContext.Provider>
  );
};