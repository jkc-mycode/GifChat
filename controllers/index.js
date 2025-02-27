const Room = require('../schemas/room');
const Chat = require('../schemas/chat');
const { removeRoom: removeRoomService } = require('../services/index');

exports.renderMain = async (req, res, next) => {
  try {
    const rooms = await Room.find({});
    const roomsSocket = req.app.get('io').of('/chat').adapter.rooms;
    const roomsSocketData = rooms.map((room) => {
      const roomId = room._id.toString();
      const connect = roomsSocket.get(roomId)?.size || 1;
      return {
        ...room.toObject(),
        connect,
      };
    });
    res.render('main', { rooms: roomsSocketData, title: 'GIF 채팅방' });
  } catch (err) {
    next(err);
  }
};

exports.renderRoom = (req, res, next) => {
  try {
    res.render('room', { title: 'GIF 채팅방 생성 페이지' });
  } catch (err) {
    next(err);
  }
};

exports.createRoom = async (req, res, next) => {
  try {
    const newRoom = await Room.create({
      title: req.body.title,
      max: req.body.max,
      owner: req.session.color,
      password: req.body.password,
    });

    const io = req.app.get('io');
    io.of('/room').emit('newRoom', newRoom);

    if (req.body.password) {
      res.redirect(`/room/${newRoom._id}?password=${req.body.password}`);
    } else {
      res.redirect(`/room/${newRoom._id}`);
    }
  } catch (err) {
    next(err);
  }
};

exports.enterRoom = async (req, res, next) => {
  try {
    const room = await Room.findOne({ _id: req.params.id });
    if (!room) {
      return res.redirect('/?error=존재하지 않는 방입니다.');
    }
    if (room.password && room.password !== req.query.password) {
      return res.redirect('/?error=비밀번호가 틀렸습니다.');
    }

    const io = req.app.get('io');
    const { rooms } = io.of('/chat').adapter; // chat 네임스페이스에 연결된 방의 목록을 가져옴
    const currentUser = rooms.get(req.params.id)?.size + 1 || 1;
    // 방의 ID를 통해서 방에 연결된 소켓 목록을 가져옴
    if (room.max <= currentUser) {
      return res.redirect('/?error=허용 인원이 초과하였습니다.');
    }

    const chats = await Chat.find({ room: room._id }).sort('createdAt');
    
    io.of('/chat').to(req.params.id).emit('updateCount', currentUser);
    res.render('chat', {
      title: 'GIF 채팅방 생성',
      room,
      chats,
      user: req.session.color,
      number: currentUser,
    });
  } catch (err) {
    next(err);
  }
};

exports.removeRoom = async (req, res, next) => {
  try {
    await removeRoomService(req.params.id);
    res.send('ok');
  } catch (err) {
    next(err);
  }
};

exports.sendChat = async (req, res, next) => {
  try {
    const chat = await Chat.create({
      room: req.params.id,
      user: req.session.color,
      chat: req.body.chat,
    });
    // 소켓IO -> chat 네임스페이스 -> 해당 ID의 방 -> 새로 만든 채팅 전달 (실시간 전송)
    req.app.get('io').of('/chat').to(req.params.id).emit('chat', chat);
    res.send('ok');
  } catch (err) {
    next(err);
  }
};

exports.sendGif = async (req, res, next) => {
  try {
    const chat = await Chat.create({
      room: req.params.id,
      user: req.session.color,
      gif: req.file.filename,
    });
    // 소켓IO -> chat 네임스페이스 -> 해당 ID의 방 -> 새로 만든 채팅 전달 (실시간 전송)
    req.app.get('io').of('/chat').to(req.params.id).emit('chat', chat);
    res.send('ok');
  } catch (err) {
    next(err);
  }
};
