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

  // 이름 길이 및 문자 검증 (2-20자, 한글/영문/숫자/언더스코어)
  if (trimmedName.length < 2 || trimmedName.length > 20) {
    return res.status(400).json({ error: '이름은 2~20자여야 합니다' });
  }

  if (!/^[가-힣a-zA-Z0-9_]+$/.test(trimmedName)) {
    return res.status(400).json({ error: '한글, 영문, 숫자, 언더스코어만 사용 가능합니다' });
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
        // 블랙잭 통계
        bj_total_games: player.bj_total_games || 0,
        bj_total_wins: player.bj_total_wins || 0,
        bj_total_losses: player.bj_total_losses || 0,
        bj_total_pushes: player.bj_total_pushes || 0,
        // 바카라 통계
        bc_total_games: player.bc_total_games || 0,
        bc_player_wins: player.bc_player_wins || 0,
        bc_banker_wins: player.bc_banker_wins || 0,
        bc_ties: player.bc_ties || 0
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
        // 블랙잭 통계
        bj_total_games: player.bj_total_games || 0,
        bj_total_wins: player.bj_total_wins || 0,
        bj_total_losses: player.bj_total_losses || 0,
        bj_total_pushes: player.bj_total_pushes || 0,
        bj_biggest_win: player.bj_biggest_win || 0,
        // 바카라 통계
        bc_total_games: player.bc_total_games || 0,
        bc_player_wins: player.bc_player_wins || 0,
        bc_banker_wins: player.bc_banker_wins || 0,
        bc_ties: player.bc_ties || 0,
        bc_biggest_win: player.bc_biggest_win || 0,
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

// 플레이어 바카라 히스토리 조회
router.get('/:name/baccarat-history', (req, res) => {
  const { name } = req.params;
  const limit = parseInt(req.query.limit) || 10;

  try {
    const history = db.getPlayerBaccaratHistory(name, limit);
    res.json({
      success: true,
      history: history
    });
  } catch (error) {
    console.error('바카라 히스토리 조회 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

module.exports = router;
