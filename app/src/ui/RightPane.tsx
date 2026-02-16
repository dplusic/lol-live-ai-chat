import React from 'react';
import type { Service } from './types';

type RightPaneProps = {
  autoSendEnabled: boolean;
  onToggleAutoSend: () => void;
  onInputGuide: () => void;
  onSendIngameUpdate: () => void;
  onRecommendChamp: () => void;
  onManualGameStart: () => void;
  services: Service[];
  activeServiceId: string;
  onSelectService: (id: string) => void;
  onDoubleClickService: (id: string) => void;
};

export function RightPane({
  autoSendEnabled,
  onToggleAutoSend,
  onInputGuide,
  onSendIngameUpdate,
  onRecommendChamp,
  onManualGameStart,
  services,
  activeServiceId,
  onSelectService,
  onDoubleClickService,
}: RightPaneProps) {
  return (
    <aside className="right-pane" style={{ display: 'flex', flexDirection: 'column', height: '100%', boxSizing: 'border-box' }}>
      <section className="panel-card">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
          {services.map((service) => (
            <button
              key={service.id}
              onClick={() => onSelectService(service.id)}
              onDoubleClick={() => onDoubleClickService(service.id)}
              style={{
                padding: '8px',
                border: activeServiceId === service.id ? `2px solid ${service.accent}` : '1px solid #ddd',
                borderRadius: '6px',
                backgroundColor: activeServiceId === service.id ? '#fff' : '#f5f5f5',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: activeServiceId === service.id ? '600' : '400',
                color: activeServiceId === service.id ? '#333' : '#666',
              }}
            >
              {service.label}
            </button>
          ))}
        </div>
        <div className="ai-services-description">
          Google 로그인할 때는 팝업에서 로그인해주세요.<br/>
          Claude 의 경우 '이메일로 계속하기'를 이용해주세요.
        </div>
      </section>

      <section className="panel-card control-panel">
        <div className="control-row">
          <button className="control-button ghost" onClick={onInputGuide}>
            가이드 입력
          </button>
          <div className="control-description">
            새로운 AI 채팅에 가이드를 입력합니다.
          </div>
        </div>
        <div className="control-row">
          <button className="control-button ghost" onClick={onRecommendChamp}>
            챔피언 선택
          </button>
          <div className="control-description">
            현재 플레이어들이 선택한 챔피언을 입력합니다.
          </div>
        </div>
        <div className="control-row">
          <div style={{ display: 'flex', flexDirection: 'row' }}>
            <button className="control-button ghost" style={{ width: '100%' }} onClick={onManualGameStart}>
              게임 시작
            </button>
            <button
              className={`toggle-button ${autoSendEnabled ? 'is-on' : ''}`}
              onClick={onToggleAutoSend}
            >
              <span className="toggle-label">자동</span>
              <span className="toggle-track" aria-hidden="true">
                <span className="toggle-knob" />
              </span>
            </button>
          </div>
          <div className="control-description">
            우리팀과 상대팀 챔피언 목록을 입력합니다.
          </div>
        </div>
        <div className="control-row">
          <button className="control-button ghost" onClick={onSendIngameUpdate}>
            인게임 업데이트
          </button>
          <div className="control-description">
            현재의 인게임 상황(KDA, 아이템 등)을 입력합니다.
          </div>
        </div>
      </section>

    </aside>
  );
}
