const express = require('express');
const router = express.Router();
const db = require('../database/db');

// 카드 값 계산
function getCardValue(card) {
  const rank = card.rank;
  if (rank === 'J' || rank === 'Q' || rank === 'K') return 10;
  if (rank === 'A') return 11;
  return parseInt(rank);
}

// 손의 최적 점수 계산
function calculateHandValue(hand) {
  let total = 0;
  let aces = 0;

  for (const card of hand) {
    const value = getCardValue(card);
    if (card.rank === 'A') aces++;
    total += value;
  }

  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }

  return total;
}

// 덱 생성
function createDeck() {
  const suits = ['♠', '♥', '♦', '♣'];
  const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  const deck = [];

  for (let i = 0; i < 2; i++) {
    for (const suit of suits) {
      for (const rank of ranks) {
        deck.push({ suit, rank });
      }
    }
  }

  return deck.sort(() => Math.random() - 0.5);
}

// 게임 세션 저장소 (메모리)
const gameStates = {};

// 게임 시작
router.post('/start', (req, res) => {
  const { playerName, betAmount } = req.body;

  // 입력 검증
  if (!playerName || !betAmount) {
    return res.status(400).json({ error: '플레이어 이름과 베팅액이 필요합니다' });
  }

  try {
    const player = db.getPlayer(playerName);
    if (!player) {
      return res.status(404).json({ error: '플레이어를 찾을 수 없습니다' });
    }

    const bet = parseInt(betAmount);
    if (bet <= 0 || bet > player.chips) {
      return res.status(400).json({ error: '유효한 베팅액이 아닙니다' });
    }

    // 게임 상태 초기화
    const deck = createDeck();
    const playerHand = [deck.pop(), deck.pop()];
    const dealerHand = [deck.pop(), deck.pop()];

    gameStates[playerName] = {
      deck: deck,
      playerHand: playerHand,
      dealerHand: dealerHand,
      betAmount: bet,
      gameOver: false,
      doubleDown: false,
      deckUsed: 4
    };

    // 플레이어 칩 차감
    db.updatePlayerChips(playerName, player.chips - bet);

    // 블랙잭 체크
    const playerValue = calculateHandValue(playerHand);
    const dealerValue = calculateHandValue(dealerHand);

    let result = null;
    if (playerValue === 21 && dealerValue === 21) {
      result = 'push';
    } else if (playerValue === 21) {
      result = 'blackjack';
    }

    res.json({
      success: true,
      playerHand: playerHand,
      dealerHand: [dealerHand[0], { suit: 'hidden', rank: '?' }],
      playerValue: playerValue,
      dealerValue: getCardValue(dealerHand[0]),
      betAmount: bet,
      gameOver: result !== null,
      result: result,
      chips: player.chips - bet
    });
  } catch (error) {
    console.error('게임 시작 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

// 게임 액션 (Hit, Stand, Double, Split)
router.post('/action', (req, res) => {
  const { playerName, action } = req.body;

  if (!gameStates[playerName]) {
    return res.status(400).json({ error: '진행 중인 게임이 없습니다' });
  }

  const gameState = gameStates[playerName];
  const player = db.getPlayer(playerName);

  try {
    if (action === 'hit') {
      gameState.playerHand.push(gameState.deck.pop());
      gameState.deckUsed++;

      const playerValue = calculateHandValue(gameState.playerHand);
      const bust = playerValue > 21;

      if (bust) {
        gameState.gameOver = true;
        const betAmount = gameState.betAmount;
        db.addGameHistory(playerName, betAmount, 'loss', JSON.stringify(gameState.playerHand), '', 0);
        db.updatePlayerStats(playerName, 'loss', 0);

        const updatedPlayer = db.getPlayer(playerName);
        res.json({
          success: true,
          playerHand: gameState.playerHand,
          dealerHand: gameState.dealerHand,
          playerValue: playerValue,
          bust: true,
          gameOver: true,
          result: 'loss',
          chips: updatedPlayer.chips
        });
      } else {
        res.json({
          success: true,
          playerHand: gameState.playerHand,
          dealerHand: [gameState.dealerHand[0], { suit: 'hidden', rank: '?' }],
          playerValue: playerValue,
          bust: false,
          gameOver: false
        });
      }
    } else if (action === 'stand') {
      // 딜러 플레이
      let dealerValue = calculateHandValue(gameState.dealerHand);
      gameState.deckUsed++;

      while (dealerValue < 17) {
        gameState.dealerHand.push(gameState.deck.pop());
        gameState.deckUsed++;
        dealerValue = calculateHandValue(gameState.dealerHand);
      }

      const playerValue = calculateHandValue(gameState.playerHand);
      const dealerBust = dealerValue > 21;
      let result = 'loss';
      let payout = 0;

      if (dealerBust) {
        result = 'win';
        payout = gameState.betAmount * 2;
      } else if (playerValue > dealerValue) {
        result = 'win';
        payout = gameState.betAmount * 2;
      } else if (playerValue === dealerValue) {
        result = 'push';
        payout = gameState.betAmount;
      }

      gameState.gameOver = true;
      db.addGameHistory(playerName, gameState.betAmount, result, JSON.stringify(gameState.playerHand), JSON.stringify(gameState.dealerHand), payout);
      db.updatePlayerStats(playerName, result, payout);
      db.updatePlayerChips(playerName, player.chips + payout);

      const updatedPlayer = db.getPlayer(playerName);
      res.json({
        success: true,
        playerHand: gameState.playerHand,
        dealerHand: gameState.dealerHand,
        playerValue: playerValue,
        dealerValue: dealerValue,
        gameOver: true,
        result: result,
        payout: payout,
        chips: updatedPlayer.chips
      });
    } else if (action === 'double') {
      if (gameState.playerHand.length !== 2) {
        return res.status(400).json({ error: '더블다운은 초기 2장에만 가능합니다' });
      }

      if (player.chips < gameState.betAmount) {
        return res.status(400).json({ error: '칩이 부족합니다' });
      }

      gameState.betAmount *= 2;
      gameState.doubleDown = true;
      db.updatePlayerChips(playerName, player.chips - gameState.betAmount / 2);
      gameState.playerHand.push(gameState.deck.pop());
      gameState.deckUsed++;

      const playerValue = calculateHandValue(gameState.playerHand);
      const bust = playerValue > 21;

      if (bust) {
        gameState.gameOver = true;
        db.addGameHistory(playerName, gameState.betAmount, 'loss', JSON.stringify(gameState.playerHand), '', 0);
        db.updatePlayerStats(playerName, 'loss', 0);

        const updatedPlayer = db.getPlayer(playerName);
        res.json({
          success: true,
          playerHand: gameState.playerHand,
          dealerHand: gameState.dealerHand,
          playerValue: playerValue,
          bust: true,
          gameOver: true,
          result: 'loss',
          chips: updatedPlayer.chips
        });
      } else {
        // 자동으로 스탠드
        let dealerValue = calculateHandValue(gameState.dealerHand);
        gameState.deckUsed++;

        while (dealerValue < 17) {
          gameState.dealerHand.push(gameState.deck.pop());
          gameState.deckUsed++;
          dealerValue = calculateHandValue(gameState.dealerHand);
        }

        let result = 'loss';
        let payout = 0;
        const dealerBust = dealerValue > 21;

        if (dealerBust) {
          result = 'win';
          payout = gameState.betAmount;
        } else if (playerValue > dealerValue) {
          result = 'win';
          payout = gameState.betAmount;
        } else if (playerValue === dealerValue) {
          result = 'push';
          payout = gameState.betAmount / 2;
        }

        gameState.gameOver = true;
        db.addGameHistory(playerName, gameState.betAmount, result, JSON.stringify(gameState.playerHand), JSON.stringify(gameState.dealerHand), payout);
        db.updatePlayerStats(playerName, result, payout);
        db.updatePlayerChips(playerName, player.chips - gameState.betAmount / 2 + payout);

        const updatedPlayer = db.getPlayer(playerName);
        res.json({
          success: true,
          playerHand: gameState.playerHand,
          dealerHand: gameState.dealerHand,
          playerValue: playerValue,
          dealerValue: dealerValue,
          gameOver: true,
          result: result,
          payout: payout,
          chips: updatedPlayer.chips
        });
      }
    }

    // 덱 25% 이하면 재생성
    if (gameState.deckUsed / (gameState.deckUsed + gameState.deck.length) > 0.75) {
      gameState.deck = createDeck();
      gameState.deckUsed = 0;
    }
  } catch (error) {
    console.error('게임 액션 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

// 게임 상태 조회
router.get('/state/:playerName', (req, res) => {
  const { playerName } = req.params;

  if (!gameStates[playerName]) {
    return res.status(404).json({ error: '진행 중인 게임이 없습니다' });
  }

  const gameState = gameStates[playerName];
  res.json({
    success: true,
    playerHand: gameState.playerHand,
    dealerHand: gameState.dealerHand,
    playerValue: calculateHandValue(gameState.playerHand),
    dealerValue: calculateHandValue(gameState.dealerHand),
    gameOver: gameState.gameOver,
    betAmount: gameState.betAmount
  });
});

module.exports = router;
