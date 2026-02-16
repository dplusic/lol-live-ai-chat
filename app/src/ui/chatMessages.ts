export type GameStartMessageData = {
  mode: string;
  myTeam: string;
  enemyTeam: string;
  teamDetails?: string;
};

export const DEFAULT_INIT_TEMPLATE =
`# 내 롤 게임을 도와줘

## 스타일
* 답변은 짧고 간결하게

## phase
### 챔피언 선택
* 어떤 챔피언을 선택하면 좋을지 짧은 이유만 간단하게
### 게임 시작
* 양팀 챔프 분석
* 내 챔프 기본적으로 숙지할 것 알려줘
* 이 조합에서 신경 쓸거 알려줘

## mode
### 칼바람
* 아이템 6코어까지 알려줘

## 패치 준비
현재 LoL 패치는 {version}이야.
네가 확실히 알고 있는 마지막 패치부터 {version}까지, 그 사이 모든 패치의 변경사항을 지금 즉시 검색해서 파악해둬.
이후 실시간 게임 중에 빠르게 질문할 거라 그때마다 검색할 시간이 없어. 지금 이 시점에 준비를 완료해줘.
완료되면 아래 항목별로 빠짐없이 정리해줘:
- 신규/리워크 챔피언
- 챔피언 수치 변경 (버프/너프)
- 아이템 추가/삭제/변경
- 최신 랭겜 및 칼바람 아이템 빌드 메타 파악
나중에 빠르게 참조할 수 있도록 구조화해서 정리해줘.`;

export function buildInitMessage(template: string, version: string): string {
  return template.replace(/\{version\}/g, version || '알 수 없음');
}

export function buildGameStartMessage(data: GameStartMessageData): string {
  const lines = ['[게임 시작]', `모드: ${data.mode || 'Unknown'}`];
  if (data.teamDetails) {
    lines.push(data.teamDetails);
  } else {
    lines.push(`우리팀: ${data.myTeam || '-'}`);
    lines.push(`상대팀: ${data.enemyTeam || '-'}`);
  }
  return lines.join('\n');
}
