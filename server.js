// 환경변수 로드
require('dotenv').config();

// ===== MILK CASINO v2.0.1 =====
// 럭셔 디자인 + 바카라 + 블랙잭 통합
// 배포 트리거: 2026-05-20
// GitHub: rhaop1/black_jack
// =================================

const express = require('express');
const session = require('express-session');
const cors = require('cors');
const path = require('path');

// 라우트 임포트
const playerRoutes = require('./routes/player');
const gameRoutes = require('./routes/game');
const baccaratRoutes = require('./routes/baccarat');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

// 미들웨어
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// 세션 설정
const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Railway에서 https 사용 시 true로 변경
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24시간
  }
};

app.use(session(sessionConfig));

// API 라우트
app.use('/api/player', playerRoutes);
app.use('/api/game', gameRoutes);
app.use('/api/baccarat', baccaratRoutes);
app.use('/api/admin', adminRoutes);

// 정적 파일 라우트
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/game.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'game.html'));
});

app.get('/admin.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// 에러 핸들링
app.use((err, req, res, next) => {
  console.error('서버 오류:', err);
  res.status(500).json({ error: '서버 오류가 발생했습니다' });
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`🎰 블랙잭 게임 서버가 포트 ${PORT}에서 실행 중입니다`);
  console.log(`🌐 접속: http://localhost:${PORT}`);
  console.log(`👤 관리자: http://localhost:${PORT}/admin.html`);
});
