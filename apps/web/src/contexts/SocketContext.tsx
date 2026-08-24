// src/contexts/SocketContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { backendOrigin } from '@/utils/axiosConfig';

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

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      console.log('No token found for socket connection');
      return;
    }

    console.log('Attempting to connect socket...');

    // Simplified connection
    const socketInstance = io(backendOrigin, {
      auth: { token },
      transports: ['polling', 'websocket'] // Try polling first
    });

    socketInstance.on('connect', () => {
      console.log('✅ Socket connected!', socketInstance.id);
      setIsConnected(true);
    });

    socketInstance.on('disconnect', () => {
      console.log('❌ Socket disconnected');
      setIsConnected(false);
    });

    socketInstance.on('connect_error', (err) => {
      console.error('Socket connection error:', err.message);
      setIsConnected(false);
    });

    setSocket(socketInstance);

    return () => {
      if (socketInstance) {
        socketInstance.disconnect();
      }
    };
  }, []);

  const reconnect = () => {
    console.log('Manual reconnect requested');
    if (socket) {
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