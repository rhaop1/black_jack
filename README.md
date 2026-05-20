# 🎰 블랙잭 카지노 게임

완전한 풀스택 블랙잭 웹 애플리케이션입니다. Node.js + Express + SQLite로 구성되었으며, Railway에 즉시 배포 가능합니다.

## ✨ 주요 기능

### 플레이어 시스템
- **회원가입 없는 이름 기반 로그인**: 이름을 입력하면 자동으로 계정 생성
- **자동 데이터 복원**: localStorage를 통한 자동 이름 입력
- **실시간 칩/잔액 관리**: 게임 결과에 따른 자동 업데이트
- **게임 통계**: 총 게임 수, 승패 기록, 승률, 최대 승리 금액

### 게임 로직
- **완전한 블랙잭 규칙**: Hit, Stand, Double Down, Split 지원
- **서버사이드 검증**: 클라이언트 조작 불가능하게 보안 처리
- **자동 덱 셔플**: 덱 25% 이하 남으면 자동 재생성
- **실시간 점수 계산**: Ace 자동 계산 (11 또는 1)

### 관리자 시스템
- **플레이어 관리**: 전체 플레이어 목록 및 통계 조회
- **칩 관리**: 지급, 차감, 설정, 초기화
- **칩 로그**: 모든 칩 거래 기록
- **플레이어 삭제**: 불필요한 계정 삭제 가능
- **검색 기능**: 플레이어 실시간 검색

### UI/UX
- **카지노 테마**: 어두운 초록색 펠트 배경
- **카드 애니메이션**: 3D 카드 딜링 애니메이션
- **반응형 디자인**: 모바일/태블릿/PC 완벽 지원
- **실시간 히스토리**: 최근 게임 10판 표시

## 🛠️ 기술 스택

- **백엔드**: Node.js 18+, Express.js
- **데이터베이스**: SQLite3 (better-sqlite3)
- **인증**: express-session + bcryptjs
- **프론트엔드**: Pure HTML5, CSS3, Vanilla JavaScript
- **배포**: Railway (railwayup.com)

## 📁 프로젝트 구조

```
├── server.js                 # Express 서버 메인 파일
├── package.json              # 의존성 관리
├── .env.example              # 환경변수 예시
├── railway.toml              # Railway 배포 설정
├── database/
│   └── db.js                 # SQLite 설정 및 쿼리 함수
├── routes/
│   ├── player.js             # 플레이어 API 라우터
│   ├── game.js               # 게임 로직 API 라우터
│   └── admin.js              # 관리자 API 라우터
└── public/
    ├── index.html            # 플레이어 로그인 페이지
    ├── game.html             # 게임 페이지
    ├── admin.html            # 관리자 대시보드
    ├── style.css             # 공통 스타일
    └── game.js               # 프론트엔드 게임 로직
```

## 🚀 로컬 실행

### 1. 프로젝트 설정

```bash
# 의존성 설치
npm install

# .env 파일 생성
cp .env.example .env
```

### 2. 환경변수 설정 (.env)

```
PORT=3000
SESSION_SECRET=your-secret-key-change-this
ADMIN_ID=admin
ADMIN_PASSWORD=admin1234
DB_PATH=./database/blackjack.db
NODE_ENV=development
```

### 3. 서버 실행

```bash
# 개발 모드 (nodemon 사용)
npm run dev

# 프로덕션 모드
npm start
```

### 4. 접속

- **플레이어**: http://localhost:3000
- **관리자**: http://localhost:3000/admin.html

## 🚀 Railway 배포

### 1. Railway 계정 생성

[railwayup.com](https://railwayup.com)에서 계정을 생성하세요.

### 2. Git 저장소 설정

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin <your-github-repo-url>
git push -u origin main
```

### 3. Railway 연동

Railway에서:
1. "New Project" → "Deploy from GitHub" 선택
2. GitHub 저장소 선택
3. 자동 배포 설정

### 4. 환경변수 설정

Railway 대시보드에서:
```
PORT=3000
SESSION_SECRET=your-super-secret-key
ADMIN_ID=admin
ADMIN_PASSWORD=admin1234
DB_PATH=./database/blackjack.db
NODE_ENV=production
```

### 5. 퍼시스턴트 볼륨 설정

Railway 대시보드에서:
- **Volume Path**: `/app/database`
- **Mount Path**: `./database`

이렇게 하면 데이터베이스가 재배포 후에도 유지됩니다.

## 📊 API 명세

### 플레이어 API

```
POST   /api/player/login         # 플레이어 생성/로그인
GET    /api/player/:name         # 플레이어 정보 조회
GET    /api/player/:name/history # 게임 히스토리 조회
```

### 게임 API

```
POST   /api/game/start           # 게임 시작
POST   /api/game/action          # 게임 액션 (hit/stand/double)
GET    /api/game/state/:playerName # 게임 상태 조회
```

### 관리자 API

```
POST   /api/admin/login          # 관리자 로그인
POST   /api/admin/logout         # 관리자 로그아웃
GET    /api/admin/status         # 인증 상태 확인
GET    /api/admin/players        # 전체 플레이어 목록
POST   /api/admin/chips          # 칩 조작
GET    /api/admin/logs           # 칩 로그 조회
GET    /api/admin/stats          # 전체 통계
DELETE /api/admin/player/:name   # 플레이어 삭제
```

## 🎮 게임 규칙

1. **카드 값**
   - 숫자: 액면가 (2-10)
   - 얼굴: 10 (J, Q, K)
   - Ace: 1 또는 11 (자동 계산)

2. **게임 플로우**
   - 베팅 선택 → 게임 시작
   - 플레이어: Hit, Stand, Double 선택
   - 딜러: 자동으로 규칙에 따라 플레이
   - 결과: 자동 처리 및 보상

3. **승패 판정**
   - 플레이어 21 > 딜러: 승리
   - 딜러 버스트 (>21): 플레이어 승리
   - 플레이어 버스트: 패배
   - 같은 점수: 무승부
   - 블랙잭 (첫 2장=21): 1.5배 배팅

4. **특수 기능**
   - **Double Down**: 베팅을 2배로 하고 카드 1장만 추가
   - **Split**: 같은 카드 2개로 2개의 손 생성

## 🔒 보안 사항

- ✅ 게임 로직은 서버에서 처리 (클라이언트 조작 불가)
- ✅ express-session으로 관리자 인증 관리
- ✅ 환경변수로 민감한 정보 보호
- ✅ 입력값 검증 (SQL Injection 방지)
- ✅ 데이터베이스 안전하게 저장

## 🐛 문제 해결

### npm install 오류
```bash
# 캐시 삭제 후 재설치
npm cache clean --force
npm install
```

### 포트 이미 사용 중
```bash
# 다른 포트 사용
PORT=3001 npm start
```

### 데이터베이스 초기화
```bash
# database 폴더의 .db 파일 삭제 후 재실행
rm -rf database/*.db*
npm start
```

## 📝 관리자 기본 정보

- **기본 ID**: admin
- **기본 비밀번호**: admin1234

**⚠️ 중요**: 프로덕션 환경에서는 반드시 `.env` 파일에서 관리자 계정을 변경하세요!

## 💾 데이터 저장소

- **players**: 플레이어 정보 및 통계
- **chip_logs**: 칩 거래 기록
- **game_history**: 게임 결과 기록

## 🌟 확장 기능 아이디어

- [ ] 다양한 게임 모드 (토너먼트, 싯앤고)
- [ ] 랭킹 시스템
- [ ] 리더보드
- [ ] 게임 라운드 기록 동영상
- [ ] 채팅 기능
- [ ] 소셜 미디어 연동

## 📄 라이선스

이 프로젝트는 자유롭게 사용할 수 있습니다.

---

**문제가 있거나 질문이 있으신가요?** 이슈를 등록해주세요! 🎰
