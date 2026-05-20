const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// 데이터베이스 경로 설정
const dbPath = process.env.DB_PATH || path.join(__dirname, '../database/blackjack.db');

// 디렉토리 생성
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// 데이터베이스 연결
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// 테이블 초기화
function initializeDatabase() {
  // 플레이어 테이블 (블랙잭 + 바카라 통계)
  db.exec(`
    CREATE TABLE IF NOT EXISTS players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      chips INTEGER DEFAULT 0,
      balance INTEGER DEFAULT 0,
      -- 블랙잭 통계
      bj_total_games INTEGER DEFAULT 0,
      bj_total_wins INTEGER DEFAULT 0,
      bj_total_losses INTEGER DEFAULT 0,
      bj_total_pushes INTEGER DEFAULT 0,
      bj_biggest_win INTEGER DEFAULT 0,
      -- 바카라 통계
      bc_total_games INTEGER DEFAULT 0,
      bc_player_wins INTEGER DEFAULT 0,
      bc_banker_wins INTEGER DEFAULT 0,
      bc_ties INTEGER DEFAULT 0,
      bc_biggest_win INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_played DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 칩 로그 테이블
  db.exec(`
    CREATE TABLE IF NOT EXISTS chip_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player_name TEXT NOT NULL,
      action TEXT NOT NULL,
      amount INTEGER NOT NULL,
      before_chips INTEGER,
      after_chips INTEGER,
      admin_note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 게임 히스토리 테이블 (블랙잭)
  db.exec(`
    CREATE TABLE IF NOT EXISTS game_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player_name TEXT NOT NULL,
      bet_amount INTEGER NOT NULL,
      result TEXT NOT NULL,
      player_hand TEXT,
      dealer_hand TEXT,
      payout INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 바카라 게임 히스토리 테이블
  db.exec(`
    CREATE TABLE IF NOT EXISTS baccarat_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player_name TEXT NOT NULL,
      bet_type TEXT NOT NULL,
      bet_amount INTEGER NOT NULL,
      result TEXT NOT NULL,
      player_score INTEGER,
      banker_score INTEGER,
      payout INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

// 플레이어 조회 또는 생성
function getOrCreatePlayer(name) {
  const stmt = db.prepare('SELECT * FROM players WHERE name = ?');
  let player = stmt.get(name);

  if (!player) {
    const insert = db.prepare(`
      INSERT INTO players (
        name, chips, balance,
        bj_total_games, bj_total_wins, bj_total_losses, bj_total_pushes, bj_biggest_win,
        bc_total_games, bc_player_wins, bc_banker_wins, bc_ties, bc_biggest_win
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insert.run(name, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
    player = stmt.get(name);
  }

  return player;
}

// 플레이어 정보 조회
function getPlayer(name) {
  const stmt = db.prepare('SELECT * FROM players WHERE name = ?');
  return stmt.get(name);
}

// 모든 플레이어 조회
function getAllPlayers() {
  const stmt = db.prepare('SELECT * FROM players ORDER BY last_played DESC');
  return stmt.all();
}

// 플레이어 칩 업데이트
function updatePlayerChips(name, chips) {
  const stmt = db.prepare('UPDATE players SET chips = ? WHERE name = ?');
  return stmt.run(chips, name);
}

// 플레이어 잔액 업데이트
function updatePlayerBalance(name, balance) {
  const stmt = db.prepare('UPDATE players SET balance = ? WHERE name = ?');
  return stmt.run(balance, name);
}

// 칩 로그 추가
function addChipLog(playerName, action, amount, beforeChips, afterChips, adminNote = '') {
  const stmt = db.prepare(`
    INSERT INTO chip_logs (player_name, action, amount, before_chips, after_chips, admin_note)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  return stmt.run(playerName, action, amount, beforeChips, afterChips, adminNote);
}

// 칩 로그 조회
function getChipLogs(limit = 100) {
  const stmt = db.prepare('SELECT * FROM chip_logs ORDER BY created_at DESC LIMIT ?');
  return stmt.all(limit);
}

// 게임 히스토리 추가
function addGameHistory(playerName, betAmount, result, playerHand, dealerHand, payout) {
  const stmt = db.prepare(`
    INSERT INTO game_history (player_name, bet_amount, result, player_hand, dealer_hand, payout)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  return stmt.run(playerName, betAmount, result, playerHand, dealerHand, payout);
}

// 플레이어 게임 히스토리 조회
function getPlayerGameHistory(playerName, limit = 10) {
  const stmt = db.prepare(`
    SELECT * FROM game_history WHERE player_name = ? ORDER BY created_at DESC LIMIT ?
  `);
  return stmt.all(playerName, limit);
}

// 플레이어 통계 업데이트 (블랙잭)
function updatePlayerStats(name, result, payout) {
  const player = getPlayer(name);
  if (!player) return null;

  const newTotalGames = (player.bj_total_games || 0) + 1;
  let newTotalWins = player.bj_total_wins || 0;
  let newTotalLosses = player.bj_total_losses || 0;
  let newTotalPushes = player.bj_total_pushes || 0;
  let newBiggestWin = player.bj_biggest_win || 0;
  let newBalance = player.balance + payout;

  if (result === 'win' || result === 'blackjack') {
    newTotalWins++;
    if (payout > newBiggestWin) {
      newBiggestWin = payout;
    }
  } else if (result === 'loss') {
    newTotalLosses++;
  } else if (result === 'push') {
    newTotalPushes++;
  }

  const stmt = db.prepare(`
    UPDATE players SET 
      bj_total_games = ?, 
      bj_total_wins = ?, 
      bj_total_losses = ?, 
      bj_total_pushes = ?, 
      bj_biggest_win = ?,
      balance = ?,
      last_played = CURRENT_TIMESTAMP
    WHERE name = ?
  `);
  
  return stmt.run(newTotalGames, newTotalWins, newTotalLosses, newTotalPushes, newBiggestWin, newBalance, name);
}

// 바카라 게임 히스토리 추가
function addBaccaratHistory(playerName, betType, betAmount, result, playerScore, bankerScore, payout) {
  const stmt = db.prepare(`
    INSERT INTO baccarat_history (player_name, bet_type, bet_amount, result, player_score, banker_score, payout)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  return stmt.run(playerName, betType, betAmount, result, playerScore, bankerScore, payout);
}

// 플레이어 바카라 히스토리 조회
function getPlayerBaccaratHistory(playerName, limit = 10) {
  const stmt = db.prepare(`
    SELECT * FROM baccarat_history WHERE player_name = ? ORDER BY created_at DESC LIMIT ?
  `);
  return stmt.all(playerName, limit);
}

// 플레이어 통계 업데이트 (바카라)
function updateBaccaratStats(name, result, payout) {
  const player = getPlayer(name);
  if (!player) return null;

  const newTotalGames = (player.bc_total_games || 0) + 1;
  let newPlayerWins = player.bc_player_wins || 0;
  let newBankerWins = player.bc_banker_wins || 0;
  let newTies = player.bc_ties || 0;
  let newBiggestWin = player.bc_biggest_win || 0;
  let newBalance = player.balance + payout;

  if (result === 'player') {
    newPlayerWins++;
    if (payout > newBiggestWin) {
      newBiggestWin = payout;
    }
  } else if (result === 'banker') {
    newBankerWins++;
    if (payout > newBiggestWin) {
      newBiggestWin = payout;
    }
  } else if (result === 'tie') {
    newTies++;
  }

  const stmt = db.prepare(`
    UPDATE players SET 
      bc_total_games = ?, 
      bc_player_wins = ?, 
      bc_banker_wins = ?, 
      bc_ties = ?, 
      bc_biggest_win = ?,
      balance = ?,
      last_played = CURRENT_TIMESTAMP
    WHERE name = ?
  `);
  
  return stmt.run(newTotalGames, newPlayerWins, newBankerWins, newTies, newBiggestWin, newBalance, name);
}

// 플레이어 삭제
function deletePlayer(name) {
  const stmt = db.prepare('DELETE FROM players WHERE name = ?');
  return stmt.run(name);
}

// 통계 조회
function getStats() {
  const totalPlayers = db.prepare('SELECT COUNT(*) as count FROM players').get().count;
  const todayPlayers = db.prepare(`
    SELECT COUNT(*) as count FROM players WHERE DATE(last_played) = DATE('now')
  `).get().count;
  // 블랙잭 + 바카라 전체 게임 수
  const totalGames = db.prepare('SELECT SUM(bj_total_games + bc_total_games) as count FROM players').get().count || 0;
  const totalChips = db.prepare('SELECT SUM(chips) as count FROM players').get().count || 0;

  return {
    total_players: totalPlayers,
    today_players: todayPlayers,
    total_games: totalGames,
    total_chips: totalChips
  };
}

// 데이터베이스 초기화 실행
initializeDatabase();

module.exports = {
  db,
  getOrCreatePlayer,
  getPlayer,
  getAllPlayers,
  updatePlayerChips,
  updatePlayerBalance,
  addChipLog,
  getChipLogs,
  addGameHistory,
  getPlayerGameHistory,
  updatePlayerStats,
  addBaccaratHistory,
  getPlayerBaccaratHistory,
  updateBaccaratStats,
  deletePlayer,
  getStats
};
