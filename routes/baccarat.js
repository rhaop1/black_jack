const express = require('express');
const router = express.Router();
const db = require('../database/db');

// 카드 생성
function createDeck() {
  const suits = ['♠', '♥', '♦', '♣'];
  const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  const deck = [];

  for (let i = 0; i < 8; i++) {  // 8덱
    for (const suit of suits) {
      for (const rank of ranks) {
        deck.push({ suit, rank });
      }
    }
  }

  return deck.sort(() => Math.random() - 0.5);
}

// 카드 점수 계산
function getCardValue(card) {
  const rank = card.rank;
  if (rank === 'J' || rank === 'Q' || rank === 'K' || rank === '10') return 0;
  if (rank === 'A') return 1;
  return parseInt(rank);
}

// 손의 점수 계산 (일의 자리만 사용)
function calculateHandValue(hand) {
  let total = 0;
  for (const card of hand) {
    total += getCardValue(card);
  }
  return total % 10;
}

// 바카라 게임 세션 저장소
const baccaratStates = {};

// 게임 시작
router.post('/start', (req, res) => {
  const { playerName, betType, betAmount } = req.body;

  // 입력 검증
  if (!playerName || !betType || !betAmount) {
    return res.status(400).json({ error: '필수 정보가 누락되었습니다' });
  }

  if (!['player', 'banker', 'tie'].includes(betType)) {
    return res.status(400).json({ error: '유효하지 않은 베팅 타입입니다' });
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

    // 게임 초기화
    const deck = createDeck();
    const playerHand = [];
    const bankerHand = [];

    // 카드 분배 (플레이어 2장, 뱅커 2장)
    for (let i = 0; i < 2; i++) {
      playerHand.push(deck.pop());
      bankerHand.push(deck.pop());
    }

    baccaratStates[playerName] = {
      deck: deck,
      playerHand: playerHand,
      bankerHand: bankerHand,
      betAmount: bet,
      betType: betType,
      gameOver: false,
      deckUsed: 4
    };

    // 플레이어 칩 차감
    db.updatePlayerChips(playerName, player.chips - bet);

    const playerValue = calculateHandValue(playerHand);
    const bankerValue = calculateHandValue(bankerHand);

    // 자연 판정 (Natural 8, 9)
    let result = null;
    if ((playerValue === 8 || playerValue === 9) || (bankerValue === 8 || bankerValue === 9)) {
      // 자동 종료
      if (playerValue > bankerValue) {
        result = 'player';
      } else if (bankerValue > playerValue) {
        result = 'banker';
      } else {
        result = 'tie';
      }
    }

    res.json({
      success: true,
      playerHand: playerHand,
      bankerHand: bankerHand,
      playerValue: playerValue,
      bankerValue: bankerValue,
      gameOver: result !== null,
      result: result,
      chips: player.chips - bet
    });
  } catch (error) {
    console.error('바카라 게임 시작 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

// 게임 진행 (3번째 카드)
router.post('/draw', (req, res) => {
  const { playerName } = req.body;

  if (!baccaratStates[playerName]) {
    return res.status(400).json({ error: '진행 중인 게임이 없습니다' });
  }

  const gameState = baccaratStates[playerName];
  const player = db.getPlayer(playerName);

  try {
    const playerValue = calculateHandValue(gameState.playerHand);
    const bankerValue = calculateHandValue(gameState.bankerHand);

    // 플레이어 3번째 카드 규칙
    let playerDrew = false;
    if (playerValue <= 5) {
      gameState.playerHand.push(gameState.deck.pop());
      gameState.deckUsed++;
      playerDrew = true;
    }

    // 뱅커 3번째 카드 규칙 (플레이어의 3번째 카드를 고려)
    // Tableau 규칙: https://en.wikipedia.org/wiki/Baccarat#Tableau_of_drawing_rules
    if (playerDrew) {
      const playerThirdCard = gameState.playerHand[2].rank;
      let playerThirdNumValue = 0;
      
      // 카드의 실제 숫자 값 계산 (modulo 10 전에)
      if (playerThirdCard === 'J' || playerThirdCard === 'Q' || playerThirdCard === 'K' || playerThirdCard === '10') {
        playerThirdNumValue = 10;
      } else if (playerThirdCard === 'A') {
        playerThirdNumValue = 1;
      } else {
        playerThirdNumValue = parseInt(playerThirdCard);
      }
      
      // 플레이어가 3번째 카드를 받은 경우 복잡한 규칙 적용
      if (bankerValue === 0 || bankerValue === 1 || bankerValue === 2) {
        gameState.bankerHand.push(gameState.deck.pop());
        gameState.deckUsed++;
      } else if (bankerValue === 3) {
        // 플레이어 3번째 카드가 8이 아니면 뱅커도 받음
        if (playerThirdNumValue !== 8) {
          gameState.bankerHand.push(gameState.deck.pop());
          gameState.deckUsed++;
        }
      } else if (bankerValue === 4) {
        // 플레이어 3번째 카드가 2-7이면 뱅커도 받음
        if (playerThirdNumValue >= 2 && playerThirdNumValue <= 7) {
          gameState.bankerHand.push(gameState.deck.pop());
          gameState.deckUsed++;
        }
      } else if (bankerValue === 5) {
        // 플레이어 3번째 카드가 4-7이면 뱅커도 받음
        if (playerThirdNumValue >= 4 && playerThirdNumValue <= 7) {
          gameState.bankerHand.push(gameState.deck.pop());
          gameState.deckUsed++;
        }
      } else if (bankerValue === 6) {
        // 플레이어 3번째 카드가 6-7이면 뱅커도 받음
        if (playerThirdNumValue >= 6 && playerThirdNumValue <= 7) {
          gameState.bankerHand.push(gameState.deck.pop());
          gameState.deckUsed++;
        }
      }
      // bankerValue === 7: 스탠드 (아무것도 안함)
    } else {
      // 플레이어가 3번째 카드를 받지 않은 경우 (값 6-7)
      // 뱅커는 플레이어와 같은 규칙 적용: 5 이하면 받음
      if (bankerValue <= 5) {
        gameState.bankerHand.push(gameState.deck.pop());
        gameState.deckUsed++;
      }
    }

    const finalPlayerValue = calculateHandValue(gameState.playerHand);
    const finalBankerValue = calculateHandValue(gameState.bankerHand);

    // 결과 판정
    let result = 'tie';
    let payout = 0;

    if (finalPlayerValue > finalBankerValue) {
      result = 'player';
      if (gameState.betType === 'player') {
        payout = gameState.betAmount * 2;  // 플레이어: 2배 배당
      }
    } else if (finalBankerValue > finalPlayerValue) {
      result = 'banker';
      if (gameState.betType === 'banker') {
        payout = gameState.betAmount * 1.9;  // 뱅커: 1.9배 배당
      }
    } else {
      result = 'tie';
      if (gameState.betType === 'tie') {
        payout = gameState.betAmount * 3;  // 타이: 3배 배당
      }
    }

    gameState.gameOver = true;

    // 게임 히스토리 저장
    db.addBaccaratHistory(
      playerName,
      gameState.betType,
      gameState.betAmount,
      result,
      finalPlayerValue,
      finalBankerValue,
      payout
    );

    // 플레이어 통계 업데이트
    db.updateBaccaratStats(playerName, result, payout);
    db.updatePlayerChips(playerName, player.chips + payout);

    const updatedPlayer = db.getPlayer(playerName);

    res.json({
      success: true,
      playerHand: gameState.playerHand,
      bankerHand: gameState.bankerHand,
      playerValue: finalPlayerValue,
      bankerValue: finalBankerValue,
      gameOver: true,
      result: result,
      payout: payout,
      chips: updatedPlayer.chips
    });

    // 덱 25% 이하면 재생성
    if (gameState.deckUsed / (gameState.deckUsed + gameState.deck.length) > 0.75) {
      gameState.deck = createDeck();
      gameState.deckUsed = 0;
    }
  } catch (error) {
    console.error('바카라 게임 진행 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

// 게임 상태 조회
router.get('/state/:playerName', (req, res) => {
  const { playerName } = req.params;

  if (!baccaratStates[playerName]) {
    return res.status(404).json({ error: '진행 중인 게임이 없습니다' });
  }

  const gameState = baccaratStates[playerName];
  res.json({
    success: true,
    playerHand: gameState.playerHand,
    bankerHand: gameState.bankerHand,
    playerValue: calculateHandValue(gameState.playerHand),
    bankerValue: calculateHandValue(gameState.bankerHand),
    gameOver: gameState.gameOver,
    betAmount: gameState.betAmount
  });
});

module.exports = router;
