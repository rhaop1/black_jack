// 게임 상태
let currentPlayer = null;
let currentBet = 0;
let currentBetType = null;
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

// 베팅 타입 선택
function selectBet(type) {
  currentBetType = type;
  document.getElementById('currentBetType').textContent = 
    type === 'player' ? '플레이어' : type === 'banker' ? '뱅커' : '타이';
  
  document.getElementById('chipButtonsContainer').style.display = 'grid';
  
  // 버튼 스타일 업데이트
  document.querySelectorAll('.bet-type-btn').forEach(btn => btn.classList.remove('selected'));
  event.target.closest('.bet-type-btn')?.classList.add('selected');
}

// 베팅액 추가
function placeBet(amount) {
  if (!currentBetType) {
    alert('먼저 베팅 타입을 선택하세요');
    return;
  }

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

  if (!currentBetType) {
    alert('베팅 타입을 선택하세요');
    return;
  }

  if (currentBet > currentPlayer.chips) {
    alert('칩이 부족합니다');
    return;
  }

  try {
    const response = await fetch('/api/baccarat/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerName: currentPlayer.name,
        betType: currentBetType,
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
    displayCards(data.playerHand, data.bankerHand);
    updateScores(data.playerValue, data.bankerValue);
    document.getElementById('bettingPanel').style.display = 'none';
    document.getElementById('actionPanel').style.display = 'flex';
    document.getElementById('gameStatus').textContent = '';

    // 자연 판정 (Natural)
    if (data.gameOver) {
      handleGameResult(data.result, data.payout);
    }
  } catch (error) {
    console.error('게임 시작 오류:', error);
    alert('서버 오류가 발생했습니다');
  }
}

// 카드 표시
function displayCards(playerCards, bankerCards) {
  const playerCardsDiv = document.getElementById('playerCards');
  const bankerCardsDiv = document.getElementById('bankerCards');

  playerCardsDiv.innerHTML = playerCards.map(card => createCardElement(card)).join('');
  bankerCardsDiv.innerHTML = bankerCards.map(card => createCardElement(card)).join('');
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
function updateScores(playerValue, bankerValue) {
  document.getElementById('playerScore').textContent = playerValue;
  document.getElementById('bankerScore').textContent = bankerValue;
}

// 카드 드로우
async function drawCards() {
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

    displayCards(data.playerHand, data.bankerHand);
    updateScores(data.playerValue, data.bankerValue);
    handleGameResult(data.result, data.payout);
  } catch (error) {
    console.error('카드 드로우 오류:', error);
  }
}

// 게임 결과 처리
async function handleGameResult(result, payout) {
  gameInProgress = false;

  const statusDiv = document.getElementById('gameStatus');
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
  document.getElementById('actionPanel').style.display = 'none';
  document.getElementById('bettingPanel').style.display = 'block';
  currentBet = 0;
  currentBetType = null;
  document.getElementById('currentBet').textContent = currentBet;
  document.getElementById('currentBetType').textContent = '-';
  document.getElementById('chipButtonsContainer').style.display = 'none';
  document.querySelectorAll('.bet-type-btn').forEach(btn => btn.classList.remove('selected'));
}

// 게임 히스토리 로드
async function loadGameHistory() {
  try {
    const response = await fetch(`/api/player/${currentPlayer.name}/baccarat-history?limit=10`);
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
    historyDiv.innerHTML = '<p style="text-align: center; color: #888;">게임 기록이 없습니다</p>';
    return;
  }

  const resultEmoji = {
    'player': '🔵',
    'banker': '🔴',
    'tie': '⚪'
  };

  const resultText = {
    'player': '플레이어',
    'banker': '뱅커',
    'tie': '타이'
  };

  historyDiv.innerHTML = history.map(game => {
    const emoji = resultEmoji[game.result] || '❓';
    const text = resultText[game.result] || '?';
    return `
      <div class="history-item ${game.result}">
        <div>${emoji} ${text}</div>
        <div style="font-size: 0.85em;">베팅: ${game.bet_amount}칩 → +${game.payout}</div>
      </div>
    `;
  }).join('');
}

// 통계 표시
async function showStats() {
  const player = currentPlayer;
  const totalGames = (player.bc_total_games || 0);

  document.getElementById('statTotalGames').textContent = totalGames;
  document.getElementById('statPlayerWins').textContent = player.bc_player_wins || 0;
  document.getElementById('statBankerWins').textContent = player.bc_banker_wins || 0;
  document.getElementById('statTies').textContent = player.bc_ties || 0;
  document.getElementById('statBiggestWin').textContent = `$${((player.bc_biggest_win || 0) / 100).toFixed(2)}`;

  document.getElementById('statsModal').style.display = 'block';
}

// 통계 모달 닫기
function closeStats() {
  document.getElementById('statsModal').style.display = 'none';
}

// 게임 선택 화면으로 돌아가기
function goHome() {
  if (gameInProgress) {
    if (!confirm('게임이 진행 중입니다. 정말 나가시겠습니까?')) {
      return;
    }
  }
  window.location.href = '/';
}

// 모달 외부 클릭 시 닫기
window.addEventListener('click', (e) => {
  const modal = document.getElementById('statsModal');
  if (e.target === modal) {
    closeStats();
  }
});
