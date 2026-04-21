# HPWD Studio

TRNSYS 스타일의 Heat Pump Washer-Dryer(HPWD) 1D 시스템 시뮬레이션 환경.
블록 다이어그램으로 컴포넌트를 연결하고, Quasi-steady sequential substitution 방식으로
시스템 전체의 시계열 거동을 확인할 수 있는 프로토타입입니다.

**🌐 Live Demo:** https://kimjy2576.github.io/hpwd-studio/

## 주요 기능

- **TRNSYS 스타일 3-패널 레이아웃:** Type Library / Canvas / Properties
- **드래그 앤 드롭 블록 배치**와 포트 기반 연결
- **직각 라우팅 연결선** — 3-세그먼트(L→R) 또는 5-세그먼트(루프 역참조) 자동 선택
- **연결선 편집** — 각 세그먼트를 좌우/상하로 드래그해서 경로 조정 (더블클릭 리셋)
- **키보드 단축키** — `Delete`/`Backspace`로 선택된 블록 또는 연결선 삭제, `Esc` 선택 해제
- **Run / Stop / Reset / Save / Load** — 프로젝트를 JSON으로 저장/복원
- **실시간 플롯 & 시뮬레이션 로그**

## 내장 Type 라이브러리 (8종)

| Category | Type | No | 주요 파라미터 |
|---|---|---|---|
| SRC | Ambient | 1 | T, RH, P_atm |
| REF | Compressor | 100 | V_disp, RPM, η_v, η_is, PR |
| REF | Condenser | 101 | UA, ΔP_ref |
| REF | Expansion Valve | 102 | A_orifice, opening, Cd |
| REF | Evaporator | 103 | UA, ΔP_ref, SH |
| AIR | Fan | 200 | RPM, V_max, η, ΔP_max |
| AIR | Drum (stateful) | 201 | m_fabric, MC_init, hA |
| OUT | Plotter | 900 | y1/y2/y3 |

> 현재 물리 계산은 **데모용 간이 모델**입니다. 각 Type을 기존 HPWD 컴포넌트
> 시뮬레이터(`compressor-sim`, `HX-Sim`, `EVSim`, `fan-sim`, `dryer-drum-sim`)와
> 연결하는 작업은 로드맵에 있습니다.

## 로컬 실행

빌드 과정 없이 정적 파일만 열면 됩니다.

```bash
# 방법 1: 파이썬 내장 서버
cd hpwd-studio
python3 -m http.server 8000
# → http://localhost:8000 에서 확인

# 방법 2: 그냥 index.html을 브라우저로 열기
open index.html
```

## GitHub Pages 배포

이 저장소의 `Settings → Pages`에서 다음을 설정하면 자동 배포됩니다:

- **Source:** `Deploy from a branch`
- **Branch:** `main` · `/ (root)`

push 후 약 1–2분이면 `https://USERNAME.github.io/REPO_NAME/` 주소로 접속 가능합니다.

## 빠른 사용법

1. 좌측 Type Library에서 블록을 Canvas로 드래그
2. 블록의 **출력 포트(우측)** 클릭 → 대상 블록의 **입력 포트(좌측)** 클릭 → 연결 생성
3. 우측 Properties 패널에서 파라미터 편집
4. 툴바에서 `Run` 클릭 → 시뮬레이션 시작
5. Plotter 블록의 `y1/y2/y3` 입력에 원하는 신호를 연결하면 하단 차트에 시계열 표시

### 추천 시나리오

- **공기 루프 건조 곡선:** `Ambient → Fan → Drum → Plotter`
  - Plotter `y1`에 `Drum.MC`, `y2`에 `Drum.T_air_out`을 연결하고 `Run`
- **히트펌프 사이클:** Compressor → Condenser → ExpansionValve → Evaporator를 배치한 뒤,
  Evaporator 출력을 Compressor 입력으로 연결(5-세그먼트 우회 라우팅이 자동 적용됨)

## 아키텍처 (현재 & 로드맵)

현재는 순수 프론트엔드 프로토타입(React + Tailwind CDN, Babel standalone)으로
빌드 과정 없이 실행됩니다. 시뮬레이션 루프는 `setInterval(50ms)`로 타임스텝을 전진시키며,
각 블록의 `compute(inputs, params, t, state, dt)` 함수를 순차 호출합니다(Sequential
Substitution, 1-pass/step).

### 로드맵

- [ ] FastAPI 백엔드 + Python 물리 모델 통합 (Type Registry 패턴)
- [ ] 기존 5개 HPWD 시뮬레이터(`fan-sim` 등)를 Type으로 편입
- [ ] 블록 더블클릭 → 기존 컴포넌트 UI를 URL 파라미터 인젝션으로 띄움
- [ ] 루프 토폴로지용 tear variable + Picard/Wegstein iteration
- [ ] CoolProp 물성치 연동 (WASM 또는 백엔드 호출)

## 라이선스

MIT
