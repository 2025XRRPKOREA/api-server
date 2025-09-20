import mongoose from 'mongoose';

const SwapFeeConfigSchema = new mongoose.Schema({
  // 스왑 종류
  swapType: {
    type: String,
    required: true,
    enum: ['XRP_TO_KRW', 'KRW_TO_XRP', 'IOU_TRANSFER'],
    index: true
  },

  // 수수료 타입
  feeType: {
    type: String,
    required: true,
    enum: ['PERCENTAGE', 'FIXED', 'TIERED'],
    default: 'PERCENTAGE'
  },

  // 기본 수수료 (퍼센트 또는 고정 금액)
  baseFee: {
    type: Number,
    required: true,
    min: 0,
    default: 0.003 // 0.3%
  },

  // 최소 수수료
  minFee: {
    type: Number,
    default: 0,
    min: 0
  },

  // 최대 수수료
  maxFee: {
    type: Number,
    default: null
  },

  // 단계별 수수료 (TIERED 타입용)
  tieredRates: [{
    minAmount: {
      type: Number,
      required: true,
      min: 0
    },
    maxAmount: {
      type: Number,
      default: null
    },
    feeRate: {
      type: Number,
      required: true,
      min: 0
    }
  }],

  // 활성 상태
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },

  // 적용 시작일
  effectiveFrom: {
    type: Date,
    default: Date.now,
    index: true
  },

  // 적용 종료일 (null이면 무제한)
  effectiveTo: {
    type: Date,
    default: null
  },

  // 설명
  description: {
    type: String,
    default: ''
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
SwapFeeConfigSchema.pre('save', function(next) {
  if (this.isModified() && !this.isNew) {
    this.updatedAt = new Date()
  }
  next()
})

// 특정 스왑 타입의 현재 활성 수수료 설정 조회
SwapFeeConfigSchema.statics.getCurrentFeeConfig = async function(swapType) {
  const now = new Date()

  const config = await this.findOne({
    swapType: swapType,
    isActive: true,
    effectiveFrom: { $lte: now },
    $or: [
      { effectiveTo: null },
      { effectiveTo: { $gte: now } }
    ]
  }).sort({ effectiveFrom: -1 })

  return config
}

// 수수료 계산 메서드
SwapFeeConfigSchema.methods.calculateFee = function(amount) {
  let fee = 0

  switch (this.feeType) {
    case 'PERCENTAGE':
      fee = amount * this.baseFee
      break

    case 'FIXED':
      fee = this.baseFee
      break

    case 'TIERED':
      // 단계별 수수료 계산
      for (const tier of this.tieredRates) {
        if (amount >= tier.minAmount &&
            (tier.maxAmount === null || amount <= tier.maxAmount)) {
          fee = amount * tier.feeRate
          break
        }
      }
      break
  }

  // 최소/최대 수수료 적용
  if (this.minFee && fee < this.minFee) {
    fee = this.minFee
  }

  if (this.maxFee && fee > this.maxFee) {
    fee = this.maxFee
  }

  return {
    grossAmount: amount,
    fee: fee,
    netAmount: amount - fee,
    feeRate: this.feeType === 'PERCENTAGE' ? this.baseFee : null,
    feeType: this.feeType,
    configId: this._id
  }
}

// 인덱스 설정
SwapFeeConfigSchema.index({ swapType: 1, isActive: 1, effectiveFrom: -1 })
SwapFeeConfigSchema.index({ effectiveFrom: 1, effectiveTo: 1 })

export default mongoose.model('SwapFeeConfig', SwapFeeConfigSchema);