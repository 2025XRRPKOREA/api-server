import mongoose from 'mongoose';

const systemConfigSchema = new mongoose.Schema({
  // 단 하나의 설정 문서만 존재하도록 보장하는 고유 키
  configKey: {
    type: String,
    default: 'main',
    unique: true
  },
  // Permissioned Domain 설정
  domain: {
    name: {
      type: String,
      default: 'krw-iou.local'
    },
    verified: {
      type: Boolean,
      default: false
    },
    verificationMethod: {
      type: String,
      enum: ['dns', 'https', 'manual'],
      default: 'manual'
    }
  },
  // IOU 발행 권한 설정
  permissions: {
    requireDomainVerification: {
      type: Boolean,
      default: true
    },
    allowedDomains: [{
      type: String
    }],
    maxIssueAmount: {
      type: String,
      default: "10000000" // 최대 발행량
    },
    dailyIssueLimit: {
      type: String,
      default: "1000000" // 일일 발행 한도
    }
  },
  // 시스템 관리자 지갑 정보
  adminWallet: {
      address: String,
      seed: String,
      publicKey: String,
      privateKey: String
  }
}, {
  timestamps: true
});

export default mongoose.model('SystemConfig', systemConfigSchema);
