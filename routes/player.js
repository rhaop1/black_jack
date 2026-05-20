const express = require('express');
const router = express.Router();
const db = require('../database/db');

// 플레이어 생성 또는 로그인
router.post('/login', (req, res) => {
  const { name } = req.body;

  // 입력 검증
  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: '이름을 입력하세요' });
  }

  const trimmedName = name.trim();

  // 이름 길이 및 문자 검증 (2-20자, 한글/영문/숫자만)
  if (trimmedName.length < 2 || trimmedName.length > 20) {
    return res.status(400).json({ error: '이름은 2~20자여야 합니다' });
  }

  if (!/^[가-힣a-zA-Z0-9]+$/.test(trimmedName)) {
    return res.status(400).json({ error: '한글, 영문, 숫자만 사용 가능합니다' });
  }

  try {
    const player = db.getOrCreatePlayer(trimmedName);
    res.json({
      success: true,
      player: {
        id: player.id,
        name: player.name,
        chips: player.chips,
        balance: player.balance,
        total_games: player.total_games,
        total_wins: player.total_wins,
        total_losses: player.total_losses,
        total_pushes: player.total_pushes
      }
    });
  } catch (error) {
    console.error('플레이어 로그인 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

// 플레이어 정보 조회
router.get('/:name', (req, res) => {
  const { name } = req.params;

  try {
    const player = db.getPlayer(name);
    if (!player) {
      return res.status(404).json({ error: '플레이어를 찾을 수 없습니다' });
    }

    res.json({
      success: true,
      player: {
        id: player.id,
        name: player.name,
        chips: player.chips,
        balance: player.balance,
        total_games: player.total_games,
        total_wins: player.total_wins,
        total_losses: player.total_losses,
        total_pushes: player.total_pushes,
        biggest_win: player.biggest_win,
        created_at: player.created_at,
        last_played: player.last_played
      }
    });
  } catch (error) {
    console.error('플레이어 조회 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

// 플레이어 게임 히스토리 조회
router.get('/:name/history', (req, res) => {
  const { name } = req.params;
  const limit = parseInt(req.query.limit) || 10;

  try {
    const history = db.getPlayerGameHistory(name, limit);
    res.json({
      success: true,
      history: history
    });
  } catch (error) {
    console.error('게임 히스토리 조회 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

module.exports = router;
