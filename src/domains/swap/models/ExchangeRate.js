const mongoose = require('mongoose')

const ExchangeRateSchema = new mongoose.Schema({
  // 기준 통화 (예: XRP)
  baseCurrency: {
    type: String,
    required: true,
    uppercase: true,
    index: true
  },

  // 대상 통화 (예: KRW)
  quoteCurrency: {
    type: String,
    required: true,
    uppercase: true,
    index: true
  },

  // 환율 (1 baseCurrency = rate quoteCurrency)
  rate: {
    type: Number,
    required: true,
    min: 0
  },

  // 매수 환율 (스프레드 적용)
  bidRate: {
    type: Number,
    min: 0
  },

  // 매도 환율 (스프레드 적용)
  askRate: {
    type: Number,
    min: 0
  },

  // 스프레드 (퍼센트)
  spread: {
    type: Number,
    default: 0.001, // 0.1%
    min: 0
  },

  // 활성 상태
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },

  // 데이터 소스
  source: {
    type: String,
    enum: ['MANUAL', 'API', 'EXCHANGE', 'SYSTEM'],
    default: 'MANUAL'
  },

  // 외부 API에서 가져온 경우의 메타데이터
  sourceMetadata: {
    provider: String,
    lastUpdated: Date,
    confidence: Number
  },

  // 유효성 기간
  validFrom: {
    type: Date,
    default: Date.now,
    index: true
  },

  validTo: {
    type: Date,
    default: null
  },

  // 생성자 정보
  createdBy: {
    type: String,
    required: true
  },

  // 생성일시
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },

  // 수정일시
  updatedAt: {
    type: Date,
    default: Date.now
  }
})

// 수정 시 updatedAt 자동 업데이트
ExchangeRateSchema.pre('save', function(next) {
  if (this.isModified() && !this.isNew) {
    this.updatedAt = new Date()
  }

  // 스프레드를 적용한 매수/매도 환율 자동 계산
  if (this.rate && this.spread !== undefined) {
    const spreadAmount = this.rate * this.spread
    this.bidRate = this.rate - spreadAmount // 낮은 가격으로 매수
    this.askRate = this.rate + spreadAmount // 높은 가격으로 매도
  }

  next()
})

// 특정 통화쌍의 현재 환율 조회
ExchangeRateSchema.statics.getCurrentRate = async function(baseCurrency, quoteCurrency) {
  const now = new Date()

  const rate = await this.findOne({
    baseCurrency: baseCurrency.toUpperCase(),
    quoteCurrency: quoteCurrency.toUpperCase(),
    isActive: true,
    validFrom: { $lte: now },
    $or: [
      { validTo: null },
      { validTo: { $gte: now } }
    ]
  }).sort({ validFrom: -1 })

  return rate
}

// 환율 계산 메서드
ExchangeRateSchema.methods.convertAmount = function(amount, direction = 'base_to_quote') {
  if (direction === 'base_to_quote') {
    // baseCurrency를 quoteCurrency로 변환 (예: XRP → KRW)
    return {
      originalAmount: amount,
      originalCurrency: this.baseCurrency,
      convertedAmount: amount * this.rate,
      convertedCurrency: this.quoteCurrency,
      rate: this.rate,
      direction: 'base_to_quote'
    }
  } else {
    // quoteCurrency를 baseCurrency로 변환 (예: KRW → XRP)
    return {
      originalAmount: amount,
      originalCurrency: this.quoteCurrency,
      convertedAmount: amount / this.rate,
      convertedCurrency: this.baseCurrency,
      rate: this.rate,
      direction: 'quote_to_base'
    }
  }
}

// 스왑을 위한 환율 계산 (스프레드 적용)
ExchangeRateSchema.methods.getSwapRate = function(swapDirection) {
  if (swapDirection === 'base_to_quote') {
    // 기준통화를 팔고 대상통화를 사는 것 -> bid rate 사용
    return this.bidRate || this.rate
  } else {
    // 대상통화를 팔고 기준통화를 사는 것 -> ask rate 사용
    return this.askRate || this.rate
  }
}

// 복합 인덱스
ExchangeRateSchema.index({ baseCurrency: 1, quoteCurrency: 1, isActive: 1, validFrom: -1 })
ExchangeRateSchema.index({ validFrom: 1, validTo: 1 })

module.exports = mongoose.model('ExchangeRate', ExchangeRateSchema)