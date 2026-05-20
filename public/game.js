// 게임 상태
let currentPlayer = null;
let currentBet = 0;
let gameInProgress = false;

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

// 베팅액 추가
function placeBet(amount) {
  if (gameInProgress) {
    alert('게임 진행 중에는 베팅할 수 없습니다');
    return;
  }

  if (currentPlayer.chips < currentBet + amount) {
    alert('칩이 부족합니다');
    return;
  }

  currentBet += amount;
  document.getElementById('currentBet').textContent = currentBet;
}

// 게임 시작
async function startNewGame() {
  if (currentBet === 0) {
    alert('베팅액을 설정하세요');
    return;
  }

  if (currentBet > currentPlayer.chips) {
    alert('칩이 부족합니다');
    return;
  }

  try {
    const response = await fetch('/api/game/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerName: currentPlayer.name,
        betAmount: currentBet
      })
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.error || '게임 시작 실패');
      return;
    }

    gameInProgress = true;
    currentPlayer.chips = data.chips;
    updatePlayerDisplay();

    // UI 업데이트
    displayCards(data.playerHand, data.dealerHand);
    updateScores(data.playerValue, data.dealerValue);
    document.getElementById('bettingPanel').style.display = 'none';
    document.getElementById('actionPanel').style.display = 'flex';
    document.getElementById('gameStatus').textContent = '';

    // 블랙잭 또는 기타 즉시 결과
    if (data.gameOver) {
      handleGameResult(data.result, data.payout);
    }
  } catch (error) {
    console.error('게임 시작 오류:', error);
    alert('서버 오류가 발생했습니다');
  }
}

// 카드 표시
function displayCards(playerCards, dealerCards) {
  const playerCardsDiv = document.getElementById('playerCards');
  const dealerCardsDiv = document.getElementById('dealerCards');

  playerCardsDiv.innerHTML = playerCards.map(card => createCardElement(card)).join('');
  dealerCardsDiv.innerHTML = dealerCards.map(card => createCardElement(card)).join('');
}

// 카드 요소 생성
function createCardElement(card) {
  const suits = { '♠': '♠', '♥': '♥', '♦': '♦', '♣': '♣' };
  const isHidden = card.suit === 'hidden';
  
  if (isHidden) {
    return '<div class="card hidden">?</div>';
  }

  const colors = {
    '♠': '#000',
    '♣': '#000',
    '♥': '#ff0000',
    '♦': '#ff0000'
  };

  const color = colors[card.suit] || '#000';
  return `
    <div class="card" style="color: ${color}">
      <span>${card.rank}${card.suit}</span>
    </div>
  `;
}

// 점수 업데이트
function updateScores(playerValue, dealerValue) {
  document.getElementById('playerScore').textContent = playerValue;
  document.getElementById('dealerScore').textContent = dealerValue;
}

// Hit
async function hit() {
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

    displayCards(data.playerHand, data.dealerHand);
    updateScores(data.playerValue, data.dealerValue || 0);

    if (data.bust) {
      handleGameResult('loss', 0);
    }
  } catch (error) {
    console.error('Hit 오류:', error);
  }
}

// Stand
async function stand() {
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

    displayCards(data.playerHand, data.dealerHand);
    updateScores(data.playerValue, data.dealerValue);
    handleGameResult(data.result, data.payout);
  } catch (error) {
    console.error('Stand 오류:', error);
  }
}

// Double Down
async function doubleDown() {
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

    currentBet *= 2;
    displayCards(data.playerHand, data.dealerHand);
    updateScores(data.playerValue, data.dealerValue);
    
    if (data.bust) {
      handleGameResult('loss', 0);
    } else {
      handleGameResult(data.result, data.payout);
    }
  } catch (error) {
    console.error('Double Down 오류:', error);
  }
}

// 게임 결과 처리
async function handleGameResult(result, payout) {
  gameInProgress = false;

  const statusDiv = document.getElementById('gameStatus');
  let statusText = '';
  let className = '';

  if (result === 'win') {
    statusText = `🎉 승리! +${payout}칩`;
    className = 'win';
  } else if (result === 'loss') {
    statusText = '😞 패배...';
    className = 'loss';
  } else if (result === 'push') {
    statusText = '🤝 무승부';
    className = 'push';
  } else if (result === 'blackjack') {
    statusText = `🎰 블랙잭! +${Math.floor(currentBet * 1.5)}칩`;
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
  document.getElementById('actionPanel').style.display = 'none';
  document.getElementById('bettingPanel').style.display = 'block';
  currentBet = 0;
  document.getElementById('currentBet').textContent = currentBet;
}

// 게임 히스토리 로드
async function loadGameHistory() {
  try {
    const response = await fetch(`/api/player/${currentPlayer.name}/history?limit=10`);
    const data = await response.json();

    if (data.success) {
      displayGameHistory(data.history);
    }
  } catch (error) {
    console.error('게임 히스토리 로드 오류:', error);
  }
}

// 게임 히스토리 표시
function displayGameHistory(history) {
  const historyDiv = document.getElementById('gameHistory');

  if (history.length === 0) {
    historyDiv.innerHTML = '<p style="text-align: center; color: #888;">게임 기록이 없습니다</p>';
    return;
  }

  const resultEmoji = {
    'win': '✅',
    'loss': '❌',
    'push': '🤝',
    'blackjack': '🎰'
  };

  historyDiv.innerHTML = history.map(game => {
    const emoji = resultEmoji[game.result] || '❓';
    const payout = game.payout > 0 ? `+${game.payout}` : game.result === 'loss' ? `-${game.bet_amount}` : '0';
    return `
      <div class="history-item ${game.result}">
        <div>${emoji} ${game.result === 'win' ? '승리' : game.result === 'loss' ? '패배' : game.result === 'blackjack' ? '블랙잭' : '무승부'}</div>
        <div style="font-size: 0.85em;">베팅: ${game.bet_amount}칩 → ${payout}</div>
      </div>
    `;
  }).join('');
}

// 통계 표시
async function showStats() {
  const player = currentPlayer;
  const totalGames = player.total_games || 0;
  const winRate = totalGames > 0 ? ((player.total_wins / totalGames) * 100).toFixed(1) : 0;

  document.getElementById('statTotalGames').textContent = totalGames;
  document.getElementById('statWins').textContent = player.total_wins || 0;
  document.getElementById('statLosses').textContent = player.total_losses || 0;
  document.getElementById('statPushes').textContent = player.total_pushes || 0;
  document.getElementById('statWinRate').textContent = winRate + '%';
  document.getElementById('statBiggestWin').textContent = `$${((player.biggest_win || 0) / 100).toFixed(2)}`;

  document.getElementById('statsModal').style.display = 'block';
}

// 통계 모달 닫기
function closeStats() {
  document.getElementById('statsModal').style.display = 'none';
}

// 홈으로 돌아가기
function goHome() {
  if (gameInProgress) {
    if (!confirm('게임이 진행 중입니다. 정말 나가시겠습니까?')) {
      return;
    }
  }
  localStorage.removeItem('playerData');
  window.location.href = '/';
}

// 모달 외부 클릭 시 닫기
window.addEventListener('click', (e) => {
  const modal = document.getElementById('statsModal');
  if (e.target === modal) {
    closeStats();
  }
});
