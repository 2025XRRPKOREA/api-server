const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const adminSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    default: 'admin'
  },
  password: {
    type: String,
    required: true,
    default: '123123'
  },
  wallet: {
    address: {
      type: String,
      required: true,
      unique: true
    },
    seed: {
      type: String,
      required: true
    },
    publicKey: {
      type: String,
      required: true
    },
    privateKey: {
      type: String,
      required: true
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  role: {
    type: String,
    default: 'admin'
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
  }
}, {
  timestamps: true
});

// Hash password before saving
adminSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
adminSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Remove sensitive data when converting to JSON
adminSchema.methods.toJSON = function() {
  const admin = this.toObject();
  delete admin.password;
  delete admin.wallet.seed;
  delete admin.wallet.privateKey;
  return admin;
};

module.exports = mongoose.model('Admin', adminSchema);