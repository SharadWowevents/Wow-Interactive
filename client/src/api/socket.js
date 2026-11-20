import { io } from 'socket.io-client';

// In development, Vite proxies /socket.io to backend (port 5000)
// In production, client is served from same origin (port 5000)
export const socket = io('/', {
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  transports: ['websocket'],
  upgrade: false
});

export const joinQuestionRoom = (qid) => {
  if (socket.connected) {
    socket.emit('join_question', qid);
  } else {
    socket.once('connect', () => {
      socket.emit('join_question', qid);
    });
  }
};

export const leaveQuestionRoom = (qid) => {
  if (socket.connected) {
    socket.emit('leave_question', qid);
  }
};

export const joinAdminRoom = () => {
  if (socket.connected) {
    socket.emit('join_admin');
  } else {
    socket.once('connect', () => {
      socket.emit('join_admin');
    });
  }
};

export const leaveAdminRoom = () => {
  if (socket.connected) {
    socket.emit('leave_admin');
  }
};
