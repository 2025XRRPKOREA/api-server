# XRP Wallet & KRW IOU Server

XRP 지갑 관리 및 KRW IOU(I Owe You) 거래 시스템을 제공하는 Node.js 백엔드 서버입니다.

## 🏗️ 패키지 구조 (Domain-Driven Design)

```
src/
├── domains/                    # 도메인별 비즈니스 로직 구분
│   ├── auth/                  # 인증/인가 도메인
│   │   ├── routes/           # 인증 관련 라우팅
│   │   ├── services/         # 인증 서비스 로직
│   │   └── models/           # 인증 관련 데이터 모델
│   ├── admin/                # 관리자 도메인
│   │   ├── routes/           # 관리자 전용 라우팅
│   │   ├── services/         # 시스템 관리 서비스
│   │   └── models/           # 관리자 관련 모델
│   ├── user/                 # 사용자 도메인
│   │   ├── routes/           # 사용자 관련 라우팅
│   │   ├── services/         # 사용자 서비스 로직
│   │   └── models/           # 사용자 데이터 모델
│   ├── wallet/               # 지갑 도메인
│   │   ├── routes/           # 지갑 관련 API
│   │   ├── services/         # XRP 지갑 관리 서비스
│   │   └── models/           # 지갑 관련 모델
│   ├── swap/                 # 스왑/환율 도메인
│   │   ├── routes/           # 스왑 및 환율 API
│   │   ├── services/         # 환율/수수료 관리 서비스
│   │   └── models/           # 환율/수수료 설정 모델
│   ├── transaction/          # 거래 도메인
│   │   ├── routes/           # P2P 거래 API
│   │   ├── services/         # 거래 매칭 서비스
│   │   └── models/           # 거래 관련 모델
│   ├── domain/               # 도메인 관리
│   │   ├── routes/           # Permissioned Domain API
│   │   ├── services/         # 도메인 접근 제어 서비스
│   │   └── models/           # 도메인 설정 모델
│   └── iou/                  # IOU 토큰 도메인
│       ├── routes/           # IOU 발행/관리 API
│       ├── services/         # IOU 발행 로직
│       └── models/           # IOU 관련 모델
├── shared/                   # 공통 모듈
│   ├── services/            # 공유 서비스 (XRPL, 검증 등)
│   ├── middleware/          # 공통 미들웨어
│   └── utils/               # 유틸리티 함수
└── server.js                # 메인 서버 파일
```

## 📋 도메인별 책임

### 🔐 Auth (인증/인가)
- 사용자 로그인/로그아웃
- JWT 토큰 관리
- 권한 검증 미들웨어

### 👑 Admin (관리자)
- 시스템 초기화 및 관리
- 어드민 계정 관리 (admin/123123)
- 시스템 전체 설정

### 👤 User (사용자)
- 사용자 계정 관리
- 회원가입/프로필 관리
- 사용자별 설정

### 💼 Wallet (지갑)
- XRP 지갑 생성/관리
- Trust Line 관리
- 잔액 조회
- 지갑 보안

### 🔄 Swap (스왑/환율)
- XRP ↔ KRW 스왑 처리
- 동적 환율 관리 (기본: 1 XRP = 4,197 KRW)
- 스왑 수수료 관리 (기본: 0.3%)
- 환율 히스토리 및 통계

### 📊 Transaction (거래)
- P2P IOU 전송
- 오더북 관리
- 거래 매칭 및 실행
- 거래 내역 조회

### 🏛️ Domain (도메인 관리)
- Permissioned Domain 설정
- 화이트리스트/블랙리스트 관리
- KYC/AML 상태 관리
- 접근 권한 제어

### 🏦 IOU (토큰 관리)
- KRW IOU 발행/소각
- IOU 발행량 관리
- IOU 메타데이터 관리

## 시스템 개요

### 아키텍처
```
Admin (krw-iou.local Domain)
├── IOU 발행 권한
├── 동적 환율/수수료 관리
├── 화이트리스트 관리
├── KYC 상태 관리
└── RequireAuth 플래그 설정

User (화이트리스트 검증)
├── Domain 권한 확인
├── Trust Line 생성
├── XRP ↔ IOU 스왑 (실시간 환율 적용)
└── P2P 거래 (오더북)
```

### 주요 기능

1. **사용자 관리**: 회원가입, 로그인, XRP 지갑 자동 생성
2. **어드민 계정**: admin/123123 고정 계정 (최초 1회 생성)
3. **동적 환율 관리**: 실시간 XRP/KRW 환율 조정 (기본: 4,197 KRW)
4. **동적 수수료**: 스왑 타입별 수수료 설정 관리
5. **KRW IOU 발행**: 사용자에게 KRW 토큰 발행
6. **양방향 스왑**: XRP ↔ IOU 상호 교환 (실시간 환율 적용)
7. **유저간 거래**: 오더북을 통한 P2P 거래
8. **Permissioned Domains**: 화이트리스트/블랙리스트 기반 접근 제어
9. **KYC/AML 지원**: 규제 준수를 위한 사용자 검증

## API 엔드포인트

### 인증 관련 API (`/api/auth`)

| 메소드 | 엔드포인트 | 설명 | 인증 필요 |
|--------|------------|------|-----------|
| POST | `/api/auth/register` | 사용자 회원가입 및 XRP 지갑 생성 | ❌ |
| POST | `/api/auth/login` | 사용자 로그인 | ❌ |

### 지갑 API (`/api/wallet`)

| 메소드 | 엔드포인트 | 설명 | 인증 필요 |
|--------|------------|------|-----------|
| GET | `/api/wallet/balance` | XRP 잔액 조회 | ✅ |
| GET | `/api/wallet/account` | 계정 정보 조회 | ✅ |
| GET | `/api/wallet/summary` | 지갑 요약 정보 | ✅ |
| POST | `/api/wallet/validate-address` | XRP 주소 유효성 검증 | ❌ |
| POST | `/api/wallet/krw/create-trustline` | KRW Trust Line 생성 | ✅ |
| GET | `/api/wallet/krw/balance` | KRW 잔액 조회 | ✅ |
| GET | `/api/wallet/trustlines` | 모든 Trust Line 조회 | ✅ |
| GET | `/api/wallet/krw/check-permission` | Trust Line 권한 확인 | ✅ |
| GET | `/api/wallet/krw/can-trade` | IOU 거래 가능 여부 확인 | ✅ |

### 스왑 API (`/api/swap`)

| 메소드 | 엔드포인트 | 설명 | 인증 필요 |
|--------|------------|------|-----------|
| POST | `/api/swap/xrp-to-krw` | XRP → KRW 스왑 | ✅ |
| POST | `/api/swap/krw-to-xrp` | KRW → XRP 스왑 | ✅ |
| POST | `/api/swap/calculate-fee` | 수수료 계산 (swapType 필수) | ❌ |
| POST | `/api/swap/convert/xrp-to-krw` | XRP→KRW 환산 (실시간 환율) | ❌ |
| POST | `/api/swap/convert/krw-to-xrp` | KRW→XRP 환산 (실시간 환율) | ❌ |
| GET | `/api/swap/exchange-rate` | 현재 환율 조회 | ❌ |

### 거래 API (`/api/transaction`)

| 메소드 | 엔드포인트 | 설명 | 인증 필요 |
|--------|------------|------|-----------|
| POST | `/api/transaction/transfer` | IOU 전송 (P2P) | ✅ |
| GET | `/api/transaction/orderbook` | 오더북 조회 | ❌ |
| POST | `/api/transaction/offer/create` | 오퍼 생성 | ✅ |
| GET | `/api/transaction/offers` | 사용자 활성 오퍼 조회 | ✅ |
| POST | `/api/transaction/offer/cancel` | 오퍼 취소 | ✅ |
| GET | `/api/transaction/market/price` | 시장 가격 조회 | ❌ |
| GET | `/api/transaction/market/pairs` | 거래 가능한 통화 쌍 | ❌ |
| GET | `/api/transaction/market/info` | IOU 시장 정보 | ❌ |
| GET | `/api/transaction/history` | IOU 거래 내역 | ✅ |
| GET | `/api/transaction/stats` | 거래 통계 | ✅ |

### 관리자 IOU API (`/api/admin/iou`)

| 메소드 | 엔드포인트 | 설명 | 인증 필요 | 권한 |
|--------|------------|------|-----------|------|
| POST | `/api/admin/iou/issue` | KRW IOU 직접 발행 | ✅ | 🔒 |
| POST | `/api/admin/iou/process-swap` | 외부 스왑 처리 | ✅ | 🔒 |
| GET | `/api/admin/iou/total-issued` | 총 발행량 조회 | ✅ | 🔒 |
| GET | `/api/admin/iou/settings` | IOU 설정 정보 | ✅ | 🔒 |
| POST | `/api/admin/iou/calculate-fee` | 수수료 계산 (어드민용) | ✅ | 🔒 |
| POST | `/api/admin/iou/batch-issue` | 대량 IOU 발행 | ✅ | 🔒 |
| POST | `/api/admin/iou/batch-process-swap` | 대량 스왑 처리 | ✅ | 🔒 |

### 관리자 Domain API (`/api/admin/domain`)

| 메소드 | 엔드포인트 | 설명 | 인증 필요 | 권한 |
|--------|------------|------|-----------|------|
| GET | `/api/admin/domain/settings` | Domain 설정 조회 | ✅ | 🔒 |
| PUT | `/api/admin/domain/settings` | Domain 설정 업데이트 | ✅ | 🔒 |
| POST | `/api/admin/domain/whitelist/add` | 화이트리스트 추가 | ✅ | 🔒 |
| GET | `/api/admin/domain/whitelist` | 허용된 계정 목록 | ✅ | 🔒 |
| POST | `/api/admin/domain/blacklist/add` | 블랙리스트 추가 | ✅ | 🔒 |
| GET | `/api/admin/domain/blacklist` | 차단된 계정 목록 | ✅ | 🔒 |
| POST | `/api/admin/domain/kyc/update` | KYC 상태 업데이트 | ✅ | 🔒 |
| POST | `/api/admin/domain/check-permission` | Trust Line 권한 확인 | ✅ | 🔒 |
| POST | `/api/admin/domain/whitelist/batch-add` | 대량 화이트리스트 추가 | ✅ | 🔒 |
| POST | `/api/admin/domain/kyc/batch-update` | 대량 KYC 업데이트 | ✅ | 🔒 |
| GET | `/api/admin/domain/stats` | Domain 통계 정보 | ✅ | 🔒 |

### 관리자 스왑비 관리 API (`/api/admin/swap-fee`)

| 메소드 | 엔드포인트 | 설명 | 인증 필요 | 권한 |
|--------|------------|------|-----------|------|
| GET | `/api/admin/swap-fee/configs` | 모든 수수료 설정 조회 | ✅ | 🔒 |
| GET | `/api/admin/swap-fee/configs/:id` | 특정 수수료 설정 조회 | ✅ | 🔒 |
| GET | `/api/admin/swap-fee/current/:swapType` | 현재 활성 수수료 설정 | ✅ | 🔒 |
| POST | `/api/admin/swap-fee/configs` | 수수료 설정 생성 | ✅ | 🔒 |
| PUT | `/api/admin/swap-fee/configs/:id` | 수수료 설정 업데이트 | ✅ | 🔒 |
| POST | `/api/admin/swap-fee/configs/:id/deactivate` | 수수료 설정 비활성화 | ✅ | 🔒 |
| POST | `/api/admin/swap-fee/calculate` | 수수료 계산 시뮬레이션 | ✅ | 🔒 |
| POST | `/api/admin/swap-fee/batch-create` | 대량 수수료 설정 생성 | ✅ | 🔒 |
| GET | `/api/admin/swap-fee/stats` | 수수료 설정 통계 | ✅ | 🔒 |

### 관리자 환율 관리 API (`/api/admin/exchange-rate`)

| 메소드 | 엔드포인트 | 설명 | 인증 필요 | 권한 |
|--------|------------|------|-----------|------|
| GET | `/api/admin/exchange-rate/rates` | 모든 환율 설정 조회 | ✅ | 🔒 |
| GET | `/api/admin/exchange-rate/current/:base/:quote` | 현재 환율 조회 | ✅ | 🔒 |
| POST | `/api/admin/exchange-rate/rates` | 환율 생성/업데이트 | ✅ | 🔒 |
| PUT | `/api/admin/exchange-rate/rates/:id` | 환율 업데이트 | ✅ | 🔒 |
| POST | `/api/admin/exchange-rate/rates/:id/deactivate` | 환율 비활성화 | ✅ | 🔒 |
| POST | `/api/admin/exchange-rate/convert` | 환율 계산 시뮬레이션 | ✅ | 🔒 |
| POST | `/api/admin/exchange-rate/batch-update` | 대량 환율 설정 | ✅ | 🔒 |
| GET | `/api/admin/exchange-rate/stats` | 환율 통계 | ✅ | 🔒 |

### 시스템 API

| 메소드 | 엔드포인트 | 설명 | 인증 필요 |
|--------|------------|------|-----------|
| GET | `/health` | 서버 상태 확인 | ❌ |

## 사용 예제

### 1. 사용자 등록 및 Trust Line 생성
```bash
# 1. 회원가입
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}'

# 2. 로그인
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}'

# 3. Trust Line 생성
curl -X POST http://localhost:3000/api/user/wallet/krw/create-trustline \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"limitAmount":"1000000"}'
```

### 2. XRP ↔ KRW 스왑
```bash
# XRP → KRW 스왑
curl -X POST http://localhost:3000/api/user/trading/swap/xrp-to-krw \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"xrpAmount":100}'

# KRW → XRP 스왑
curl -X POST http://localhost:3000/api/user/trading/swap/krw-to-xrp \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"iouAmount":100}'
```

### 3. P2P 거래
```bash
# 오더북 조회
curl -X GET "http://localhost:3000/api/user/trading/orderbook?base=XRP&counter=KRW"

# 오퍼 생성
curl -X POST http://localhost:3000/api/user/trading/offer/create \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "takerGets": "1000000",
    "takerPays": {
      "currency": "KRW",
      "value": "100",
      "issuer": "admin_address"
    }
  }'
```

### 4. 관리자 Domain 관리
```bash
# 화이트리스트에 사용자 추가 (관리자만)
curl -X POST http://localhost:3000/api/admin/domain/whitelist/add \
  -H "Authorization: Bearer <ADMIN_JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "userAddress": "rXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    "email": "user@example.com"
  }'

# KYC 상태 업데이트 (관리자만)
curl -X POST http://localhost:3000/api/admin/domain/kyc/update \
  -H "Authorization: Bearer <ADMIN_JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "userAddress": "rXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    "status": "verified"
  }'

# IOU 직접 발행 (관리자만)
curl -X POST http://localhost:3000/api/admin/iou/issue \
  -H "Authorization: Bearer <ADMIN_JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "userAddress": "rXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    "amount": 1000
  }'
```

## 설치 및 실행

### 필수 요구사항
- Node.js 16.x 이상
- MongoDB 4.x 이상
- npm 또는 yarn

### 설치
```bash
git clone <repository>
cd xrp-server
npm install
```

### 환경 변수 설정
```bash
# .env 파일 생성
PORT=3000
MONGODB_URI=mongodb://admin:password123@localhost:27017/xrp_wallet?authSource=admin
JWT_SECRET=your-jwt-secret-key-here
NODE_ENV=development
```

### 실행
```bash
# 개발 모드
npm run dev

# 프로덕션 모드
npm start

# 테스트
npm test
```

## 프로젝트 구조

```
src/
├── server.js                          # 메인 서버 (시스템 초기화 포함)
├── krw-iou-example.js                 # 사용 예제
├── models/
│   ├── Admin.js                       # 어드민 모델 (Domain 설정 포함)
│   ├── User.js                        # 사용자 모델
│   └── PermissionedDomain.js          # Permissioned Domain 모델
├── services/
│   ├── shared/                        # 공통 서비스
│   │   ├── xrplService.js            # XRPL 연결 서비스
│   │   └── validationService.js      # 검증 서비스
│   ├── admin/                         # 관리자 전용 서비스
│   │   ├── adminSystemService.js     # 시스템 관리
│   │   ├── adminIOUService.js        # IOU 발행 관리
│   │   └── adminDomainService.js     # Domain 관리
│   ├── user/                          # 사용자 전용 서비스
│   │   ├── userWalletService.js      # 지갑 관리
│   │   ├── userIOUService.js         # IOU 거래
│   │   └── userTradingService.js     # 거래 서비스
│   └── walletService.js               # 기존 지갑 서비스
├── routes/
│   ├── auth.js                        # 인증 라우터
│   ├── user/                          # 사용자 라우터
│   │   ├── userWallet.js             # 지갑 관련 API
│   │   └── userTrading.js            # 거래 관련 API
│   └── admin/                         # 관리자 라우터
│       ├── adminIOU.js               # IOU 관리 API
│       └── adminDomain.js            # Domain 관리 API
├── middleware/
│   └── auth.js                        # JWT 인증 미들웨어
└── README.md                          # 이 문서
```

## 설정 값

- **네트워크**: XRP Testnet (`wss://s.altnet.rippletest.net:51233/`)
- **수수료율**: 0.3% (SWAP_FEE_RATE = 0.003)
- **통화 코드**: "KRW"
- **어드민 계정**: admin/123123 (고정)
- **Domain**: krw-iou.local (자동 설정)
- **Domain 타입**: whitelist (기본값)

## 워크플로우

### 1. 시스템 초기화
1. 서버 시작시 admin/123123 계정 확인/생성
2. DB에 어드민 정보 저장
3. Permissioned Domain 초기화 (krw-iou.local)
4. XRPL에 Domain 설정 및 RequireAuth 플래그 활성화

### 2. 사용자 등록 및 Trust Line
1. 사용자 회원가입 및 XRPL 지갑 생성
2. 자동 화이트리스트 추가 (설정된 경우)
3. Permissioned Domain 권한 확인
4. admin에 대한 KRW Trust Line 생성

### 3. XRP ↔ IOU 스왑
1. 사용자가 스왑 요청
2. Domain 권한 재확인
3. 수수료(0.3%) 계산
4. 스왑 실행 및 수수료 차감된 금액 전달

### 4. 유저간 거래
1. 오더북 조회
2. 오퍼 생성 (화이트리스트 사용자만)
3. XRPL 자동 매칭 및 거래 체결

### 5. Domain 관리
1. 관리자가 화이트리스트/블랙리스트 관리
2. KYC 상태 업데이트
3. 권한 기반 접근 제어

## 보안 고려사항

1. **어드민 계정**: admin/123123은 개발용, 운영시 변경 필요
2. **Private Key**: 사용자 시드는 암호화 저장 권장
3. **네트워크**: 운영시 메인넷으로 변경
4. **인증**: JWT 토큰 기반 API 보안
5. **Permissioned Domain**: 화이트리스트로 접근 제어
6. **Domain 검증**: XRPL에 Domain 설정으로 신뢰성 확보
7. **KYC/AML**: 규제 준수를 위한 사용자 검증 프로세스

## 에러 처리

모든 API는 일관된 응답 형식을 사용합니다:

```javascript
// 성공
{
    success: true,
    data: { ... },
    txHash: "transaction_hash" // 블록체인 트랜잭션인 경우
}

// 실패
{
    success: false,
    error: "error_message"
}
```

## 개발 참고사항

- XRP Ledger의 Trust Line 개념 이해 필요
- IOU는 발행자(어드민)를 신뢰하는 관계에서 성립
- 트랜잭션 수수료(XRP)는 별도 고려 필요
- 모든 스왑에서 0.3% 수수료 자동 차감
- Permissioned Domain으로 규제 준수 가능