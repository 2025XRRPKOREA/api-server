import mongoose from 'mongoose';

const permissionedDomainSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true,
  },
  issuerAddress: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'active'
  },
}, {
  timestamps: true
});

export default mongoose.model('PermissionedDomain', permissionedDomainSchema);