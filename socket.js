const SocketIO = require('socket.io');
const { removeRoom } = require('./services');

module.exports = (server, app, sessionMiddleware) => {
  const io = SocketIO(server, { path: '/socket.io' });
  app.set('io', io); // express에 io 객체를 넣어줌, (req.app.get('io')로 사용가능)

  const room = io.of('/room');
  const chat = io.of('/chat');
  const wrap = (middleware) => (socket, next) =>
    middleware(socket.request, {}, next);
  chat.use(wrap(sessionMiddleware)); // chat 네임스페이스에 미들웨어 적용

  // room 네임스페이스에 이벤트 리스너를 붙임
  room.on('connection', (socket) => {
    console.log('room 네임스페이스 접속');
    socket.on('disconnect', () => {
      console.log('room 네임스페이스 접속 해제');
    });
  });

  // chat 네임스페이스에 이벤트 리스너를 붙임
  chat.on('connection', (socket) => {
    console.log('chat 네임스페이스 접속');
    socket.on('join', (data) => {
      socket.join(data); // 방에 참가
      const currentRoom = socket.adapter.rooms.get(data);
      const userCount = currentRoom ? currentRoom.size : 0;
      // 채팅방 목록에서의 인원 수 업데이트
      room.emit('updateUserCount', { roomId: data, userCount });

      // 같은 방에 있는 소켓들에게 메시지 전송
      // (chat.html에 있는 socket.on('join') 이벤트 리스너가 실행됨)
      socket.to(data).emit('join', {
        user: 'system',
        chat: `${socket.request.session.color} 님이 입장하셨습니다.`,
      });
      // 현재 인원 수 업데이트
      socket.to(data).emit('updateCount', { userCount });
    });

    // 채팅방 나갈 때의 이벤트 리스너
    socket.on('disconnect', async () => {
      console.log('chat 네임스페이스 접속 해제');
      const { referer } = socket.request.headers;
      const roomId = new URL(referer).pathname.split('/').at(-1);
      const currentRoom = socket.adapter.rooms.get(roomId);
      const userCount = currentRoom ? currentRoom.size : 0;

      // 채팅방 목록에서의 인원 수 업데이트
      room.emit('updateUserCount', { roomId, userCount });
      // 현재 인원 수 업데이트
      socket.to(roomId).emit('updateCount', { userCount });

      if (userCount === 0) {
        await removeRoom(roomId);
        room.emit('removeRoom', roomId);
        console.log('방 제거 요청 성공');
      } else {
        socket.to(roomId).emit('exit', {
          user: 'system',
          chat: `${socket.request.session.color} 님이 퇴장하셨습니다..`,
        });
      }
    });
  });
};

// module.exports = (server) => {
//     const io = SocketIO(server, { path: '/socket.io' });
//     // 그냥 io는 기본 네임스페이스 ('/')에 접속했을 때의 네임스페이스
//     io.on('connection', (socket) => {
//       const req = socket.request;
//       const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
//       console.log('새로운 클라이언트 접속', ip, socket.id);

//       socket.on('disconnect', () => {
//         console.log('클라이언트 접속 해제', ip, socket.id);
//         clearInterval(socket.interval);
//       });

//       socket.on('reply', (data) => {
//         console.log(data);
//       });

//       socket.on('error', console.error);

//       socket.interval = setInterval(() => {
//         socket.emit('news', 'Hello Socket.IO');
//       }, 3000);
//     });
//   };

// module.exports = (server) => {
//   const wss = new webSocket.Server({ server });

//   wss.on('connection', (ws, req) => {
//     const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
//     console.log('새로운 클라이언트 접속', ip);
//     ws.on('message', (message) => {
//       console.log(message.toString());
//     });
//     ws.on('error', console.error);
//     ws.on('close', () => {
//       console.log('클라이언트 접속 해제', ip);
//       clearInterval(ws.interval);
//     });
//     ws.interval = setInterval(() => {
//       if (ws.readyState === ws.OPEN) {
//         ws.send('서버에서 클라이언트로 메시지를 보냅니다.');
//       }
//     }, 3000);
//   });
// };
