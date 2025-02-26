const express = require('express');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const path = require('path');
const session = require('express-session');
const nunjucks = require('nunjucks');
const dotenv = require('dotenv');
const ColorHash = require('color-hash').default;
dotenv.config(); // process.env

const webSocket = require('./socket');
const indexRouter = require('./routes');
const connect = require('./schemas');

const app = express();
app.set('port', process.env.PORT || 8005);
app.set('view engine', 'html'); //템플릿엔진으로 읽을 때 html 파일을 사용

// 넌적스 템플릿엔진을 사용할 때 view폴더를 사용
// 즉, render를 사용할 때 views폴더에 있는 html 파일을 사용한다는 의미
nunjucks.configure('views', {
  express: app,
  watch: true,
});

app.use(morgan('dev')); // 실행 로깅
app.use(express.static(path.join(__dirname, 'public'))); // 프론트에서 public 폴더를 자유롭게 접근가능하게 허용
app.use('/gif', express.static(path.join(__dirname, 'uploads'))); // 프론트에서 /gif로 접근하면 uploads폴더로 접근가능
app.use(express.json()); // ajax json 요청 받을 수 있게 (req.body로 만들어서)
app.use(express.urlencoded({ extended: false })); // form 요청 받을 수 있게 (req.body로 만들어서)
app.use(cookieParser(process.env.COOKIE_SECRET)); // 헤더에 있는 쿠키 데이터 파싱, { connect.sid: 123876128942 }와 같은 객체로 만듬
const sessionMiddleware = session({
  resave: false,
  saveUninitialized: false,
  secret: process.env.COOKIE_SECRET,
  cookie: {
    httpOnly: true, // 자바스크립트 접근 못하게 만들때
    secure: false, // https 사용할 때 true
  },
});
app.use(sessionMiddleware);
app.use((req, res, next) => {
  if (!req.session.color) {
    const colorHash = new ColorHash();
    req.session.color = colorHash.hex(req.sessionID);
    console.log(req.session.color, req.sessionID);
  }
  next();
});

connect(); // 몽고디비 연결

app.use('/', indexRouter);

// 404 미들웨어
app.use((req, res, next) => {
  // 404 NOT FOUND
  const error = new Error(`${req.method} ${req.url} 라우터가 없습니다.`);
  error.status = 404;
  next(error);
});
//에러처리 미들웨어
app.use((err, req, res, next) => {
  res.locals.message = err.message;
  res.locals.error = process.env.NODE_ENV !== 'production' ? err : {}; // 에러 로그를 서비스한테 넘김
  res.status(err.status || 500);
  res.render('error'); // 템플릿엔진을 랜더링함 (views폴더에서 error라는 이름의 html파일을 랜더링)
});

const server = app.listen(app.get('port'), () => {
  console.log(app.get('port'), '번 포트에서 대기 중...');
});

webSocket(server, app, sessionMiddleware);
