const { Server } = require('socket.io');

let io = null;

function initWebSocket(httpServer) {
  io = new Server(httpServer, {
    path: '/api/socket.io',
    cors: {
      origin: true,
      credentials: true
    },
    transports: ['websocket', 'polling']
  });

  io.on('connection', (socket) => {
    // Client joins a specific question room (e.g., 'q:abc123')
    socket.on('join_question', (qid) => {
      if (qid) {
        socket.join(`q:${qid}`);
      }
    });

    // Client leaves a question room
    socket.on('leave_question', (qid) => {
      if (qid) {
        socket.leave(`q:${qid}`);
      }
    });

    // Admin dashboard joins admin room
    socket.on('join_admin', () => {
      socket.join('admin');
    });

    socket.on('leave_admin', () => {
      socket.leave('admin');
    });
  });

  return io;
}

function getIO() {
  return io;
}

function broadcastQuestionUpdate(qid, summary, meta = null) {
  if (!io) return;
  // Send live summary to Live projector views and Answer pages
  io.to(`q:${qid}`).emit('update', summary);

  if (meta) {
    io.to(`q:${qid}`).emit('meta', meta);
  }

  // Notify admin dashboard so question cards update dynamically
  io.to('admin').emit('admin_update', { qid, summary, meta });
}

function broadcastAdminUpdate() {
  if (!io) return;
  io.to('admin').emit('admin_update');
}

function broadcastQuestionDeleted(qid) {
  if (!io) return;
  io.to(`q:${qid}`).emit('deleted', { id: qid });
  io.to('admin').emit('admin_update');
}

module.exports = {
  initWebSocket,
  getIO,
  broadcastQuestionUpdate,
  broadcastAdminUpdate,
  broadcastQuestionDeleted
};
