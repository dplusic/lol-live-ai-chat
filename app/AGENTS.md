# LOL Live AI Chat (Last Updated: 2026-02-19)

* League of Legends 현재 게임 상태를 AI Chat 메시지로 입력해주는 어플리케이션
* ChatGPT/Gemini 등 사람이 입력하는 자연어 형태로 전송 (텍스트)

## 화면

* 2단 horizontal layout (좌: 메인 웹뷰, 우: 조작 패널)
* 화면 전체 resize 가능, 윈도우 크기 및 위치 저장/복원 (Debounce 적용)
    * Windows Snap도 `isMaximized: true`로 인식되므로 maximize 상태는 저장하지 않음
    * 항상 `getBounds()`로 실제 크기/위치 저장, 재실행 시 `maximize()` 호출 없음
    * 창 중심점 기준으로 디스플레이 범위 벗어나면 x/y만 초기화 (크기 유지)
* 왼쪽 패널 (CenterPane):
    * AI 서비스 웹페이지 로딩 (단일 `persist:shared` partition, User-Agent: Chrome 144)
    * 모든 서비스가 같은 세션을 공유하므로 Google 로그인 한 번으로 Gemini 등 접근 가능
    * 마지막 방문 URL 기억 및 복원 (서비스별)
    * 서비스 버튼 더블클릭 시 해당 서비스 최초 URL로 이동 (`webview.loadURL`)
* 오른쪽 패널 (RightPane):
    * 상단: AI 서비스 선택 — 3열 grid, 클릭으로 전환, 더블클릭으로 최초 URL 이동
    * 중단: 조작 버튼 그룹
        * 가이드 입력: AI 초기화 및 가이드 메시지 전송
        * 챔피언 선택: 픽창 상태(우리팀, 벤치) 전송하여 추천 요청 (모든 모드 지원)
        * 게임 시작: 게임 시작 정보 수동 전송
        * 인게임 업데이트: 현재 게임 상태(KDA, CS, 아이템, 레벨) 전송
* 메뉴 (커스텀 애플리케이션 메뉴):
    * 메뉴 > 가이드 메시지 수정: 모달 팝업으로 가이드 메시지 편집 (textarea, 기본값 복원 버튼)
    * 메뉴 > 웹 데이터 초기화: `persist:shared` 세션 스토리지 삭제
    * DEV > 개발자 도구 (F12): `app.isPackaged`가 false일 때만 표시

### 구현

* src/ui 디렉터리 내 구현
    * CenterPane: webview로 AI 서비스 로딩 (partition: `persist:shared`, User-Agent: Chrome 144)
    * RightPane: AI 서비스 선택(3열 grid) + 조작 버튼

### 모듈 구조

- `src/ui/App.tsx` — UI 엔트리 + 상태 관리; 커스텀 훅으로 분리:
    - `useWebviewNavigation(webviewRef, activeServiceId)` — webview 내비게이션 추적 + lastUrls 관리
    - `useGameEvents(opts)` — `window.lolApi.onEvent` 구독, autoSendEnabledRef/lastGameStartKeyRef 내부 관리
    - Google OAuth: `will-navigate`에서 `accounts.google.com` URL 감지 → `openAuthWindow` IPC 호출
    - `authComplete` 이벤트 수신 시 500ms 후 서비스 초기 URL로 `loadURL`
    - `menu:editGuide` 이벤트 수신 시 가이드 메시지 편집 모달 표시
- `src/ui/CenterPane.tsx` — AI 서비스 webview 패널
- `src/ui/RightPane.tsx` — 서비스 선택(3열 grid), 조작 버튼
- `src/ui/services.ts` — **서비스 정의 집중 관리**: `ServiceConfig` 타입 (Service + buildScript), 스크립트 빌더 함수, `SERVICES` 배열. **서비스 추가 시 이 파일만 수정**
- `src/ui/chatMessages.ts` — `DEFAULT_INIT_TEMPLATE`, `buildInitMessage(template, version)`, `buildGameStartMessage(data)`
    - `GameStartMessageData`: `{ mode, myTeam, enemyTeam, teamDetails? }`
    - `teamDetails`가 있으면 우리팀/상대팀 요약줄 대신 룬/스펠 상세 정보로 대체
- `src/ui/chatSenders.ts` — `sendMessageToService()`: SERVICES에서 buildScript 조회 후 executeJavaScript 실행, retry 로직 포함
- `src/ui/types.ts` — `Service`, `GameViewState` 타입; `HTMLWebViewElement` (executeJavaScript, loadURL, reload), `Window.lolApi` global 선언

### 지원 AI 서비스

| 서비스 | URL | 스크립트 방식 |
|---|---|---|
| Gemini | gemini.google.com | Generic |
| ChatGPT | chatgpt.com | ProseMirror (execCommand) |
| Claude | claude.ai | ProseMirror (execCommand) |
| Grok | grok.com | 커스텀 (nativeSet + 휴리스틱 버튼 탐색) |
| Perplexity | perplexity.ai | Generic |
| Copilot | copilot.microsoft.com | Generic |

**스크립트 방식:**
- `buildGenericScript`: textarea/input value 직접 설정 + 이벤트 dispatch
- `buildProseMirrorScript`: `execCommand('insertText')` — React ProseMirror 에디터용 (ChatGPT, Claude)
- Grok 커스텀: `nativeSet`으로 React state 우회, 휴리스틱(주변 마지막 활성 버튼) fallback

### localStorage 저장 항목

| 키 | 내용 |
|---|---|
| `activeServiceId` | 선택된 AI 서비스 |
| `autoSendEnabled` | 자동 전송 ON/OFF |
| `lastUrls` | 서비스별 마지막 방문 URL |
| `ddragonVersion` | DDragon 최신 버전 (앱 재시작 후에도 유지) |
| `initTemplate` | 사용자 편집 가이드 메시지 템플릿 |

## background

- 게임 단계 변화 감지 및 자동/수동 메시지 전송
- DDragon API를 이용한 챔피언/아이템 한글 데이터 로딩
- LCU 및 Live Client Data API 연동

### 주요 기능 동작

1.  **초기화 및 데이터 로딩**:
    *   앱 실행 시 DDragon API (`ko_KR`)에서 챔피언 및 아이템 데이터 동시 로딩 (`loadDDragonData`). DDragon 요청 타임아웃: 10초.
    *   로딩 완료 시 `ddragonVersion` 이벤트 emit → UI에서 localStorage에 저장.
    *   윈도우 크기/위치 복원 (maximize 상태 복원 없음).
2.  **가이드 입력**:
    *   사용자가 편집한 `initTemplate`에서 `{version}`을 실제 DDragon 버전으로 치환하여 전송.
    *   버전 미로딩 시 localStorage에 캐시된 버전 사용, 없으면 '알 수 없음'.
    *   가이드 메시지는 AI에게 패치 변경사항 선제적 파악을 지시함 (게임 중 실시간 검색 방지).
3.  **챔피언 선택 (`handleRecommendChamp`)**:
    *   `/lol-champ-select/v1/session` 직접 조회 (최신 상태 반영).
    *   모드(칼바람/협곡)에 따라 적절한 프롬프트 생성 (칼바람: 벤치 포함, 그 외: 현재 픽만).
4.  **게임 시작 (`handleGameStart` / `handleManualGameStart`)**:
    *   앱을 게임 도중 실행한 경우(`midGameStartup`), `suppressEmit=true`로 호출 → 전송하지 않고 `pendingTeams = null` 처리.
    *   팀 구성 확정 시 즉시 Live Client Data API 시도:
        *   **Live API 응답 있으면**: 룬/스펠 포함한 `loadingTeams` 이벤트 즉시 전송.
        *   **Live API 미응답이면**: `state.pendingTeams`에 팀 데이터 저장 → `handleInProgress`에서 Live API 첫 응답 시 합쳐서 전송 (fallback).
    *   수동 버튼 클릭(`handleManualGameStart`): Live API 있으면 룬/스펠 포함, 없으면 팀 구성만 전송 (`manual: true` 플래그).
    *   전송 포맷 (`teamDetails` 있을 때):
        ```
        [게임 시작]
        모드: {모드명}
        우리팀:
        (나) {챔피언}: {키스톤}({주트리}/{부트리}) {스펠1}+{스펠2}
        {챔피언}: ...
        상대팀:
        {챔피언}: ...
        ```
    *   팀 구분: `allPlayers`에서 activePlayer의 이름으로 본인 엔트리 찾아 팀 태그 확인 → `splitTeams`. 이름 매칭 fallback 포함.
5.  **인게임 자동 알림 (`handleInProgress`)**:
    *   1분 주기로 `/liveclientdata/allgamedata` 조회.
    *   Live API 첫 응답 시(`!state.liveReady`): `state.pendingTeams`가 있으면 룬/스펠 데이터 합쳐 `loadingTeams` 전송 (게임 시작 fallback).
    *   이후: `items`, `kda` 이벤트를 UI에 전달 (표시용, 자동 채팅 전송 없음).
6.  **인게임 업데이트 (`handleIngameUpdate`)**:
    *   `/liveclientdata/allgamedata` 조회.
    *   팀 구분: `activePlayer` 기준으로 `allPlayers`에서 로컬 플레이어 식별 후 팀 태그로 분류. (이름 매칭 fallback 포함)
    *   전송 포맷:
        ```
        [인게임 업데이트]
        {분}:{초}
        우리팀:
        (나) {챔피언} L{레벨} CS{CS수} {K}/{D}/{A} [{아이템1,아이템2...}]
        ...
        상대팀:
        ...
        ```
    *   아이템 필터링: `FILTERED_ITEM_NAMES` (포로간식/포로 간식).

### 모듈 구조

- `src/game/index.ts` — 메인 루프, IPC 명령 처리
- `src/game/handlers.ts` — 핵심 로직 (픽창, 게임시작, 인게임 업데이트 등)
    - `buildRuneSpellLines(live, myTeamNames, state)`: Live API 데이터로 전체 플레이어 룬/스펠 포맷팅
- `src/game/ddragon.ts` — DDragon 챔피언/아이템 데이터 로딩 및 버전 이벤트 emit
- `src/game/lifecycle.ts` — 게임 단계 감지 (`updatePhase`)
- `src/game/events.ts` — 이벤트 버스 (`emitEvent`, `setEventSink`, `startNativeMessageListener`)
- `src/game/logger.ts` — 로깅 유틸 (`logInfo`, `logWarn`, `logError`)
- `src/game/live.ts` — Live Client Data API 호출
    - `LivePlayer`: `runes` (keystone/primaryRuneTree/secondaryRuneTree displayName), `summonerSpells` (summonerSpellOne/Two displayName), `scores.creepScore` 포함
- `src/game/lcu.ts` — LCU 연결 및 API 호출
- `src/game/format.ts` — 데이터 포맷팅 헬퍼; `GameMode` 유니온 타입, `ChampMap`/`ItemMap` 타입 별칭, `classifyQueue()`, `displayMode()`, `FILTERED_ITEM_NAMES` 상수 정의
- `src/game/state.ts` — 상태 타입 정의 및 초기화/리셋
    - `pendingTeams: PendingTeams | null`: 게임 로딩 중 Live API 미응답 시 팀 데이터 임시 저장

### 사용 엔드포인트

* LCU (127.0.0.1, 인증 필요):
    - `/lol-gameflow/v1/gameflow-phase`
    - `/lol-gameflow/v1/session`
    - `/lol-champ-select/v1/session`
    - `/lol-champ-select/v1/pickable-champions`
    - `/lol-summoner/v1/current-summoner`
* Live Client Data (127.0.0.1:2999):
    - `/liveclientdata/allgamedata` — 룬/스펠/아이템/KDA/CS 포함
* DDragon (https):
    - `/api/versions.json`
    - `/cdn/{version}/data/ko_KR/champion.json`
    - `/cdn/{version}/data/ko_KR/item.json`

## 개발

* 기술 스택: electron, typescript, react
* 하나의 함수나 하나의 파일이 너무 길어지지 않게 유지

### 모듈 구조

- `src/preload.ts` — IPC 브릿지 (`window.lolApi`: `onEvent`, `sendCommand`, `openAuthWindow`)
- `src/index.ts` — main 프로세스 창 관리(상태 저장/복원), IPC 연결, 메뉴
    - `patchSessionHeaders(sess)`: Sec-Ch-Ua 헤더를 Chrome 144 값으로 패치 (모든 요청 대상). Google이 Electron을 임베디드 브라우저로 감지하는 것을 방지.
    - `app.on('session-created', patchSessionHeaders)` + ready 시 `defaultSession` 패치
    - Google OAuth: `open-auth-window` IPC → 별도 BrowserWindow 생성 (`persist:shared` 파티션 공유), `accounts.google.com`에서 벗어나면 자동 닫힘 + `authComplete` 이벤트 전송
    - `clearStorage` 명령: `persist:shared` 파티션 스토리지 삭제
    - 메뉴 → `menu:clearCache`/`menu:editGuide` 이벤트 → renderer에서 처리
    - DEV 메뉴(`개발자 도구`, F12): `!app.isPackaged`일 때만 표시
- `update-electron-app`: 앱 시작 시 자동 업데이트 확인 (GitHub Releases 기반)
    - `forge.config.ts`의 `@electron-forge/publisher-github`로 배포
    - `update.electronjs.org` 서비스 사용 → public repo 필요, draft/prerelease 릴리즈 미인식

## AI Agent 참고 사항

- 수정 전에는 반드시, 기존 파일 내용을 `read_file`로 확인하고 진행할 것.
- 사용자 요청에 따라 UI/기능이 빈번하게 변경되므로 최신 상태 파악 중요.
- **서비스 추가**: `src/ui/services.ts`의 `SERVICES` 배열에만 항목 추가하면 됨.
