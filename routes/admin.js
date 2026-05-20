const express = require('express');
const router = express.Router();
const bcryptjs = require('bcryptjs');
const db = require('../database/db');

// 관리자 인증 미들웨어
const adminAuth = (req, res, next) => {
  if (!req.session.admin) {
    return res.status(401).json({ error: '관리자 권한이 필요합니다' });
  }
  next();
};

// 관리자 로그인
router.post('/login', (req, res) => {
  const { id, password } = req.body;
  const adminId = process.env.ADMIN_ID || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin1234';

  if (id === adminId && password === adminPassword) {
    req.session.admin = true;
    res.json({ success: true, message: '로그인 성공' });
  } else {
    res.status(401).json({ error: '아이디 또는 비밀번호가 잘못되었습니다' });
  }
});

// 관리자 로그아웃
router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true, message: '로그아웃 성공' });
  });
});

// 관리자 상태 확인
router.get('/status', (req, res) => {
  res.json({ authenticated: !!req.session.admin });
});

// 전체 플레이어 목록
router.get('/players', adminAuth, (req, res) => {
  try {
    const players = db.getAllPlayers();
    res.json({
      success: true,
      players: players.map(p => ({
        id: p.id,
        name: p.name,
        chips: p.chips,
        balance: p.balance,
        total_games: p.total_games,
        total_wins: p.total_wins,
        total_losses: p.total_losses,
        total_pushes: p.total_pushes,
        biggest_win: p.biggest_win,
        win_rate: p.total_games > 0 ? ((p.total_wins / p.total_games) * 100).toFixed(1) : 0,
        created_at: p.created_at,
        last_played: p.last_played
      }))
    });
  } catch (error) {
    console.error('플레이어 목록 조회 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

// 칩 조작 (지급/차감/설정)
router.post('/chips', adminAuth, (req, res) => {
  const { playerName, action, amount, note } = req.body;

  // 입력 검증
  if (!playerName || !action || amount === undefined) {
    return res.status(400).json({ error: '필수 정보가 누락되었습니다' });
  }

  try {
    const player = db.getPlayer(playerName);
    if (!player) {
      return res.status(404).json({ error: '플레이어를 찾을 수 없습니다' });
    }

    const numAmount = parseInt(amount);
    if (numAmount < 0) {
      return res.status(400).json({ error: '음수는 입력할 수 없습니다' });
    }

    let newChips = player.chips;
    const beforeChips = player.chips;

    if (action === 'add') {
      newChips += numAmount;
    } else if (action === 'subtract') {
      if (player.chips < numAmount) {
        return res.status(400).json({ error: '칩이 부족합니다' });
      }
      newChips -= numAmount;
    } else if (action === 'set') {
      newChips = numAmount;
    } else if (action === 'reset') {
      newChips = 0;
    } else {
      return res.status(400).json({ error: '유효하지 않은 액션입니다' });
    }

    // 칩 업데이트
    db.updatePlayerChips(playerName, newChips);

    // 로그 기록
    db.addChipLog(playerName, action, numAmount, beforeChips, newChips, note || '');

    res.json({
      success: true,
      message: '칩이 수정되었습니다',
      playerName: playerName,
      beforeChips: beforeChips,
      afterChips: newChips
    });
  } catch (error) {
    console.error('칩 조작 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

// 칩 로그 조회
router.get('/logs', adminAuth, (req, res) => {
  try {
    const logs = db.getChipLogs(200);
    res.json({
      success: true,
      logs: logs
    });
  } catch (error) {
    console.error('칩 로그 조회 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

// 전체 통계
router.get('/stats', adminAuth, (req, res) => {
  try {
    const stats = db.getStats();
    res.json({
      success: true,
      stats: stats
    });
  } catch (error) {
    console.error('통계 조회 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

// 플레이어 삭제
router.delete('/player/:name', adminAuth, (req, res) => {
  const { name } = req.params;

  try {
    db.deletePlayer(name);
    res.json({
      success: true,
      message: '플레이어가 삭제되었습니다'
    });
  } catch (error) {
    console.error('플레이어 삭제 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

module.exports = router;
