// ========== 공통 변수 ==========
let currentPlayer = null;
let currentGame = 'blackjack';  // 현재 게임 ('blackjack' 또는 'baccarat')

// 카드 효과음
const cardSound = new Audio('/card.mp3');
cardSound.volume = 1.0;  // 최대 볼륨 (0.0 ~ 1.0)

function playCardSound() {
  cardSound.currentTime = 0;  // 처음부터 재생
  cardSound.play().catch(e => console.log('음성 재생 실패:', e));
}

// ========== 블랙잭 변수 ==========
let bjCurrentBet = 0;
let bjGameInProgress = false;
let bjPlayerHand = [];
let bjDealerHand = [];

// ========== 바카라 변수 ==========
let bcCurrentBet = 0;
let bcCurrentBetType = null;
let bcGameInProgress = false;

// 페이지 로드 시 초기화
window.addEventListener('DOMContentLoaded', async () => {
  await initializeGame();
});

// 게임 초기화
async function initializeGame() {
  const playerData = localStorage.getItem('playerData');
  if (!playerData) {
    window.location.href = '/';
    return;
  }

  currentPlayer = JSON.parse(playerData);
  updatePlayerDisplay();
  await loadGameHistory();
}

// 플레이어 정보 업데이트
function updatePlayerDisplay() {
  document.getElementById('playerNameDisplay').textContent = currentPlayer.name;
  document.getElementById('chipsDisplay').textContent = currentPlayer.chips;
  document.getElementById('balanceDisplay').textContent = `$${(currentPlayer.balance / 100).toFixed(2)}`;
}

// ========== 게임 탭 전환 ==========
function switchGame(game) {
  currentGame = game;
  
  // 탭 버튼 스타일 업데이트
  document.getElementById('bjTab').classList.toggle('active', game === 'blackjack');
  document.getElementById('bcTab').classList.toggle('active', game === 'baccarat');
  
  // 게임 콘텐츠 표시/숨김
  document.getElementById('blackjackGame').classList.toggle('active', game === 'blackjack');
  document.getElementById('baccaratGame').classList.toggle('active', game === 'baccarat');
  
  // 히스토리 새로고침
  loadGameHistory();
}

// ========== 블랙잭 함수 ==========

// 블랙잭 베팅
function bjPlaceBet(amount) {
  if (bjGameInProgress) {
    alert('게임 진행 중에는 베팅할 수 없습니다');
    return;
  }

  if (currentPlayer.chips < bjCurrentBet + amount) {
    alert('칩이 부족합니다');
    return;
  }

  bjCurrentBet += amount;
  document.getElementById('bjCurrentBet').textContent = bjCurrentBet;
}

// 블랙잭 게임 시작
async function bjStartNewGame() {
  if (bjCurrentBet === 0) {
    alert('베팅액을 설정하세요');
    return;
  }

  if (bjCurrentBet > currentPlayer.chips) {
    alert('칩이 부족합니다');
    return;
  }

  try {
    const response = await fetch('/api/game/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerName: currentPlayer.name,
        betAmount: bjCurrentBet
      })
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.error || '게임 시작 실패');
      return;
    }

    bjGameInProgress = true;
    currentPlayer.chips = data.chips;
    updatePlayerDisplay();

    bjPlayerHand = data.playerHand;
    bjDealerHand = data.dealerHand;

    await bjDisplayCards();
    bjUpdateScores(data.playerScore, data.dealerScore);
    document.getElementById('bjBettingPanel').style.display = 'none';
    document.getElementById('bjActionPanel').style.display = 'flex';
    document.getElementById('bjGameStatus').textContent = '';

    // 자동 블랙잭 체크
    if (data.isBlackjack) {
      bjHandleGameResult(data.result, data.payout);
    }
  } catch (error) {
    console.error('블랙잭 시작 오류:', error);
    alert('서버 오류가 발생했습니다');
  }
}

// 블랙잭 카드 표시
async function bjDisplayCards() {
  const playerCardsDiv = document.getElementById('playerCards');
  const dealerCardsDiv = document.getElementById('dealerCards');

  playerCardsDiv.innerHTML = '';
  dealerCardsDiv.innerHTML = '';

  // 카드를 교대로 하나씩 표시: P1, D1, P2, D2
  // 최대 길이 구하기
  const maxLength = Math.max(bjPlayerHand.length, bjDealerHand.length);

  for (let i = 0; i < maxLength; i++) {
    // 플레이어 카드 표시
    if (i < bjPlayerHand.length) {
      const cardHTML = createCardElement(bjPlayerHand[i]);
      playerCardsDiv.innerHTML += cardHTML;
      playCardSound();
      await new Promise(resolve => setTimeout(resolve, 300));  // 300ms 딜레이
    }

    // 딜러 카드 표시
    if (i < bjDealerHand.length) {
      const cardHTML = createCardElement(bjDealerHand[i]);
      dealerCardsDiv.innerHTML += cardHTML;
      playCardSound();
      await new Promise(resolve => setTimeout(resolve, 300));  // 300ms 딜레이
    }
  }
}

// 블랙잭 점수 업데이트
function bjUpdateScores(playerScore, dealerScore) {
  document.getElementById('playerScore').textContent = playerScore;
  document.getElementById('dealerScore').textContent = dealerScore;
}

// 블랙잭 Hit
async function bjHit() {
  try {
    const response = await fetch('/api/game/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerName: currentPlayer.name,
        action: 'hit'
      })
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.error || '오류가 발생했습니다');
      return;
    }

    bjPlayerHand = data.playerHand;
    await bjDisplayCards();
    bjUpdateScores(data.playerScore, data.dealerScore);

    if (data.gameOver) {
      bjHandleGameResult(data.result, data.payout);
    }
  } catch (error) {
    console.error('Hit 오류:', error);
  }
}

// 블랙잭 Stand
async function bjStand() {
  try {
    const response = await fetch('/api/game/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerName: currentPlayer.name,
        action: 'stand'
      })
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.error || '오류가 발생했습니다');
      return;
    }

    bjPlayerHand = data.playerHand;
    bjDealerHand = data.dealerHand;
    await bjDisplayCards();
    bjUpdateScores(data.playerScore, data.dealerScore);
    bjHandleGameResult(data.result, data.payout);
  } catch (error) {
    console.error('Stand 오류:', error);
  }
}

// 블랙잭 더블다운
async function bjDoubleDown() {
  try {
    const response = await fetch('/api/game/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerName: currentPlayer.name,
        action: 'double'
      })
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.error || '오류가 발생했습니다');
      return;
    }

    currentPlayer.chips = data.chips;
    updatePlayerDisplay();

    bjPlayerHand = data.playerHand;
    bjDealerHand = data.dealerHand;
    await bjDisplayCards();
    bjUpdateScores(data.playerScore, data.dealerScore);
    bjHandleGameResult(data.result, data.payout);
  } catch (error) {
    console.error('더블다운 오류:', error);
  }
}

// 블랙잭 게임 결과 처리
async function bjHandleGameResult(result, payout) {
  bjGameInProgress = false;

  const statusDiv = document.getElementById('bjGameStatus');
  let statusText = '';
  let className = '';

  if (result === 'playerWin') {
    statusText = `✅ 플레이어 승리! +${payout}칩`;
    className = 'win';
  } else if (result === 'dealerWin') {
    statusText = `❌ 딜러 승리! -${bjCurrentBet}칩`;
    className = 'lose';
  } else if (result === 'push') {
    statusText = `🤝 무승부! 칩 반환`;
    className = 'push';
  } else if (result === 'blackjack') {
    statusText = `🎉 블랙잭! +${payout}칩`;
    className = 'win';
  }

  statusDiv.textContent = statusText;
  statusDiv.className = 'game-status ' + className;

  // 플레이어 정보 새로고침
  try {
    const response = await fetch(`/api/player/${currentPlayer.name}`);
    const data = await response.json();
    if (data.success) {
      currentPlayer = data.player;
      updatePlayerDisplay();
      await loadGameHistory();
    }
  } catch (error) {
    console.error('플레이어 정보 새로고침 오류:', error);
  }

  // UI 업데이트
  document.getElementById('bjActionPanel').style.display = 'none';
  document.getElementById('bjBettingPanel').style.display = 'block';
  bjCurrentBet = 0;
  document.getElementById('bjCurrentBet').textContent = bjCurrentBet;
}

// ========== 바카라 함수 ==========

// 바카라 베팅 타입 선택
function bcSelectBet(type) {
  bcCurrentBetType = type;
  document.getElementById('bcCurrentBetType').textContent = 
    type === 'player' ? '플레이어' : type === 'banker' ? '뱅커' : '타이';
  
  document.getElementById('bcChipButtonsContainer').style.display = 'grid';
  
  document.querySelectorAll('.bet-type-btn').forEach(btn => btn.classList.remove('selected'));
  event.target.closest('.bet-type-btn')?.classList.add('selected');
}

// 바카라 베팅
function bcPlaceBet(amount) {
  if (!bcCurrentBetType) {
    alert('먼저 베팅 타입을 선택하세요');
    return;
  }

  if (bcGameInProgress) {
    alert('게임 진행 중에는 베팅할 수 없습니다');
    return;
  }

  if (currentPlayer.chips < bcCurrentBet + amount) {
    alert('칩이 부족합니다');
    return;
  }

  bcCurrentBet += amount;
  document.getElementById('bcCurrentBet').textContent = bcCurrentBet;
}

// 바카라 게임 시작
async function bcStartNewGame() {
  if (bcCurrentBet === 0) {
    alert('베팅액을 설정하세요');
    return;
  }

  if (!bcCurrentBetType) {
    alert('베팅 타입을 선택하세요');
    return;
  }

  if (bcCurrentBet > currentPlayer.chips) {
    alert('칩이 부족합니다');
    return;
  }

  try {
    const response = await fetch('/api/baccarat/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerName: currentPlayer.name,
        betType: bcCurrentBetType,
        betAmount: bcCurrentBet
      })
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.error || '게임 시작 실패');
      return;
    }

    bcGameInProgress = true;
    currentPlayer.chips = data.chips;
    updatePlayerDisplay();

    // UI 업데이트
    await bcDisplayCards(data.playerHand, data.bankerHand);
    bcUpdateScores(data.playerValue, data.bankerValue);
    document.getElementById('bcBettingPanel').style.display = 'none';
    document.getElementById('bcActionPanel').style.display = 'flex';
    document.getElementById('bcGameStatus').textContent = '';

    // 자연 판정 (Natural)
    if (data.gameOver) {
      bcHandleGameResult(data.result, data.payout);
    }
  } catch (error) {
    console.error('바카라 시작 오류:', error);
    alert('서버 오류가 발생했습니다');
  }
}

// 바카라 카드 표시
async function bcDisplayCards(playerCards, bankerCards) {
  const playerCardsDiv = document.getElementById('playerCards-bc');
  const bankerCardsDiv = document.getElementById('bankerCards');

  playerCardsDiv.innerHTML = '';
  bankerCardsDiv.innerHTML = '';

  // 카드를 교대로 하나씩 표시: Pl1, B1, Pl2, B2
  const maxLength = Math.max(playerCards.length, bankerCards.length);

  for (let i = 0; i < maxLength; i++) {
    // 플레이어 카드 표시
    if (i < playerCards.length) {
      const cardHTML = createCardElement(playerCards[i]);
      playerCardsDiv.innerHTML += cardHTML;
      playCardSound();
      await new Promise(resolve => setTimeout(resolve, 300));  // 300ms 딜레이
    }

    // 뱅커 카드 표시
    if (i < bankerCards.length) {
      const cardHTML = createCardElement(bankerCards[i]);
      bankerCardsDiv.innerHTML += cardHTML;
      playCardSound();
      await new Promise(resolve => setTimeout(resolve, 300));  // 300ms 딜레이
    }
  }
}

// 바카라 점수 업데이트
function bcUpdateScores(playerValue, bankerValue) {
  document.getElementById('playerScore-bc').textContent = playerValue;
  document.getElementById('bankerScore').textContent = bankerValue;
}

// 바카라 카드 드로우
async function bcDrawCards() {
  try {
    const response = await fetch('/api/baccarat/draw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerName: currentPlayer.name
      })
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.error || '오류가 발생했습니다');
      return;
    }

    await bcDisplayCards(data.playerHand, data.bankerHand);
    bcUpdateScores(data.playerValue, data.bankerValue);
    bcHandleGameResult(data.result, data.payout);
  } catch (error) {
    console.error('카드 드로우 오류:', error);
  }
}

// 바카라 게임 결과 처리
async function bcHandleGameResult(result, payout) {
  bcGameInProgress = false;

  const statusDiv = document.getElementById('bcGameStatus');
  let statusText = '';
  let className = '';

  if (result === 'player') {
    statusText = `✅ 플레이어 승리! +${payout}칩`;
    className = 'win';
  } else if (result === 'banker') {
    statusText = `✅ 뱅커 승리! +${payout}칩`;
    className = 'win';
  } else if (result === 'tie') {
    statusText = `🤝 타이! +${payout}칩`;
    className = 'push';
  }

  statusDiv.textContent = statusText;
  statusDiv.className = 'game-status ' + className;

  // 플레이어 정보 새로고침
  try {
    const response = await fetch(`/api/player/${currentPlayer.name}`);
    const data = await response.json();
    if (data.success) {
      currentPlayer = data.player;
      updatePlayerDisplay();
      await loadGameHistory();
    }
  } catch (error) {
    console.error('플레이어 정보 새로고침 오류:', error);
  }

  // UI 업데이트
  document.getElementById('bcActionPanel').style.display = 'none';
  document.getElementById('bcBettingPanel').style.display = 'block';
  bcCurrentBet = 0;
  bcCurrentBetType = null;
  document.getElementById('bcCurrentBet').textContent = bcCurrentBet;
  document.getElementById('bcCurrentBetType').textContent = '-';
  document.getElementById('bcChipButtonsContainer').style.display = 'none';
  document.querySelectorAll('.bet-type-btn').forEach(btn => btn.classList.remove('selected'));
}

// ========== 공통 함수 ==========

// 카드 요소 생성
function createCardElement(card) {
  if (card.suit === 'hidden') {
    return '<div class="card hidden">?</div>';
  }

  const colors = {
    '♠': '#000',
    '♣': '#000',
    '♥': '#ff0000',
    '♦': '#ff0000'
  };

  const color = colors[card.suit] || '#000';
  return `<div class="card" style="color: ${color}"><span>${card.rank}${card.suit}</span></div>`;
}

// 게임 히스토리 로드
async function loadGameHistory() {
  try {
    const endpoint = currentGame === 'blackjack' 
      ? `/api/player/${currentPlayer.name}/history?limit=10`
      : `/api/player/${currentPlayer.name}/baccarat-history?limit=10`;
    
    const response = await fetch(endpoint);
    if (response.ok) {
      const data = await response.json();
      displayGameHistory(data.history || []);
    }
  } catch (error) {
    console.error('게임 히스토리 로드 오류:', error);
  }
}

// 게임 히스토리 표시
function displayGameHistory(history) {
  const historyDiv = document.getElementById('gameHistory');

  if (history.length === 0) {
    historyDiv.innerHTML = '<p class="no-history">아직 게임 기록이 없습니다</p>';
    return;
  }

  historyDiv.innerHTML = history.slice(0, 10).map((game, index) => {
    const result = game.result || game.game_result;
    const amount = game.payout || game.bet_amount || 0;
    
    let resultEmoji = '';
    if (result === 'playerWin' || result === 'player') resultEmoji = '✅';
    else if (result === 'dealerWin' || result === 'banker') resultEmoji = '✅';
    else if (result === 'tie' || result === 'push') resultEmoji = '🤝';
    else resultEmoji = '❌';

    return `
      <div class="history-item">
        <span class="history-result">${resultEmoji}</span>
        <span class="history-bet">${game.bet_amount || game.betAmount || 0}칩</span>
        <span class="history-payout">+${amount}</span>
        <span class="history-time">${new Date(game.played_at || game.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
    `;
  }).join('');
}

// 통계 표시
function showStats() {
  updateStatsDisplay();
  document.getElementById('statsModal').style.display = 'flex';
}

// 통계 업데이트
function updateStatsDisplay() {
  // 블랙잭 통계
  document.getElementById('statBjTotalGames').textContent = currentPlayer.bj_total_games || 0;
  document.getElementById('statBjWins').textContent = currentPlayer.bj_total_wins || 0;
  document.getElementById('statBjLosses').textContent = currentPlayer.bj_total_losses || 0;
  document.getElementById('statBjPushes').textContent = currentPlayer.bj_total_pushes || 0;
  document.getElementById('statBjBiggestWin').textContent = `$${((currentPlayer.bj_biggest_win || 0) / 100).toFixed(2)}`;

  // 바카라 통계
  document.getElementById('statBcTotalGames').textContent = currentPlayer.bc_total_games || 0;
  document.getElementById('statBcPlayerWins').textContent = currentPlayer.bc_player_wins || 0;
  document.getElementById('statBcBankerWins').textContent = currentPlayer.bc_banker_wins || 0;
  document.getElementById('statBcTies').textContent = currentPlayer.bc_ties || 0;
  document.getElementById('statBcBiggestWin').textContent = `$${((currentPlayer.bc_biggest_win || 0) / 100).toFixed(2)}`;
}

// 통계 닫기
function closeStats() {
  document.getElementById('statsModal').style.display = 'none';
}

// 홈으로 이동 (최신 데이터와 함께)
async function goHome() {
  try {
    // 최신 플레이어 정보 조회
    const response = await fetch(`/api/player/${currentPlayer.name}`);
    const data = await response.json();
    if (data.success) {
      // 최신 데이터 저장
      localStorage.setItem('playerData', JSON.stringify(data.player));
    }
  } catch (error) {
    console.error('플레이어 정보 조회 오류:', error);
  }
  window.location.href = '/';
}
