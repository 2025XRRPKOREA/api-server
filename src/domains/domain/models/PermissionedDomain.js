import mongoose from 'mongoose';

const permissionedDomainSchema = new mongoose.Schema({
  domain: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  issuerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: true
  },
  issuerAddress: {
    type: String,
    required: true
  },
  domainType: {
    type: String,
    enum: ['whitelist', 'blacklist', 'kyc_required'],
    default: 'whitelist'
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'active'
  },
  description: {
    type: String,
    trim: true
  },
  // 허용된 계정 목록 (화이트리스트용)
  allowedAccounts: [{
    address: {
      type: String,
      required: true
    },
    email: String,
    kycStatus: {
      type: String,
      enum: ['pending', 'verified', 'rejected'],
      default: 'pending'
    },
    approvedAt: Date,
    approvedBy: String
  }],
  // 차단된 계정 목록 (블랙리스트용)
  blockedAccounts: [{
    address: {
      type: String,
      required: true
    },
    reason: String,
    blockedAt: {
      type: Date,
      default: Date.now
    },
    blockedBy: String
  }],
  // Domain 설정
  settings: {
    requireKYC: {
      type: Boolean,
      default: false
    },
    maxTrustLineAmount: {
      type: String,
      default: "1000000"
    },
    autoApproval: {
      type: Boolean,
      default: false
    },
    requireEmailVerification: {
      type: Boolean,
      default: true
    }
  }
}, {
  timestamps: true
});

// 인덱스 설정
permissionedDomainSchema.index({ domain: 1, issuerAddress: 1 });
permissionedDomainSchema.index({ 'allowedAccounts.address': 1 });
permissionedDomainSchema.index({ 'blockedAccounts.address': 1 });

// 계정이 허용되었는지 확인
permissionedDomainSchema.methods.isAccountAllowed = function(accountAddress) {
  if (this.domainType === 'blacklist') {
    return !this.blockedAccounts.some(blocked => blocked.address === accountAddress);
  }

  if (this.domainType === 'whitelist') {
    return this.allowedAccounts.some(allowed =>
      allowed.address === accountAddress &&
      (!this.settings.requireKYC || allowed.kycStatus === 'verified')
    );
  }

  return true; // kyc_required의 경우 별도 검증 로직
};

// 계정을 화이트리스트에 추가
permissionedDomainSchema.methods.addToWhitelist = function(accountAddress, email, approvedBy) {
  const existingIndex = this.allowedAccounts.findIndex(acc => acc.address === accountAddress);

  if (existingIndex >= 0) {
    // 기존 계정 업데이트
    this.allowedAccounts[existingIndex].email = email;
    this.allowedAccounts[existingIndex].approvedAt = new Date();
    this.allowedAccounts[existingIndex].approvedBy = approvedBy;
  } else {
    // 새 계정 추가
    this.allowedAccounts.push({
      address: accountAddress,
      email: email,
      kycStatus: this.settings.requireKYC ? 'pending' : 'verified',
      approvedAt: new Date(),
      approvedBy: approvedBy
    });
  }
};

// 계정을 블랙리스트에 추가
permissionedDomainSchema.methods.addToBlacklist = function(accountAddress, reason, blockedBy) {
  const existingIndex = this.blockedAccounts.findIndex(acc => acc.address === accountAddress);

  if (existingIndex < 0) {
    this.blockedAccounts.push({
      address: accountAddress,
      reason: reason,
      blockedAt: new Date(),
      blockedBy: blockedBy
    });
  }
};

// KYC 상태 업데이트
permissionedDomainSchema.methods.updateKYCStatus = function(accountAddress, status) {
  const account = this.allowedAccounts.find(acc => acc.address === accountAddress);
  if (account) {
    account.kycStatus = status;
    if (status === 'verified') {
      account.approvedAt = new Date();
    }
  }
};

export default mongoose.model('PermissionedDomain', permissionedDomainSchema);