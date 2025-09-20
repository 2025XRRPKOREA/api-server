import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
  isSuccess:{
    type: Boolean,
    default: false
  },
  price: {
    type: Number,
    required: true
  },
  iou: {
    type: String,
    required: true,
    trim: true
  },
  qrCode: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  senderWallet:{
    address: {
      type: String,
      required: false,
    },
    seed: {
      type: String,
      required: false
    },
    publicKey: {
      type: String,
      required: false
    },
    privateKey: {
      type: String,
      required: false
    }
  },
  receiverWallet:{
    address: {
      type: String,
      required: true,
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
  }
}, {
  timestamps: true
});

// Remove sensitive data when converting to JSON
transactionSchema.methods.toJSON = function() {
  const transaction = this.toObject();
  return transaction;
};

export default mongoose.model('Transaction', transactionSchema);