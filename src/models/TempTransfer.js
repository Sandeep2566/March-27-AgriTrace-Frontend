import mongoose from 'mongoose';

const TempTransferSchema = new mongoose.Schema({
  orderId: { type: String, required: true, unique: true },
  amount: { type: Number, required: true }, // amount in paise
  batchId: { type: String, required: true },
  to: { type: String, required: true },
  noteCID: { type: String },
  createdAt: { type: Date, default: Date.now, expires: 300 } // auto-delete after 5 minutes
});

export default mongoose.model('TempTransfer', TempTransferSchema);
