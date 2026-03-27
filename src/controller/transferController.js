import fs from "fs";
import path from "path";
import crypto from "crypto";
import { ethers } from "ethers";

import createRazorpayInstance from '../utils/razorpay.js';
import TempTransfer from '../models/TempTransfer.js';

const key_id = process.env.RAZORPAY_KEY_ID;
const key_secret = process.env.RAZORPAY_KEY_SECRET;
const rpcUrl = process.env.RPC_URL || process.env.PROVIDER_URL;
const privateKey = process.env.PRIVATE_KEY;
const contractAddress = process.env.CONTRACT_ADDRESS;
const contractAbiPath = process.env.CONTRACT_ABI_PATH || './contracts/YourContract.json';

const razorpay = createRazorpayInstance(key_id, key_secret);

// load ABI in ESM-friendly way
let contractAbi;
try {
  const abiPath = path.resolve(contractAbiPath);
  const raw = fs.readFileSync(abiPath, 'utf-8');
  const abiJson = JSON.parse(raw);
  contractAbi = abiJson.abi || abiJson;
} catch (e) {
  console.error('Failed to load contract ABI at', contractAbiPath, e.message);
  contractAbi = null;
}

// Helper to get contract instance (connected to signer)
function getContract() {
  if (!contractAbi) throw new Error('Contract ABI not loaded. Check CONTRACT_ABI_PATH.');
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);
  const contract = new ethers.Contract(contractAddress, contractAbi, wallet);
  return contract;
}

// 1) create-payment route: create razorpay order & save temp transfer
export const createPayment = async (req, res) => {
  try {
    const { amount, batchId, to, noteCID } = req.body;
    if (!amount || !batchId || !to) {
      return res.status(400).json({ error: 'amount, batchId and to are required' });
    }

    // amount (frontend sends rupees, e.g., 499.00). Convert to paise:
    const amountInPaise = Math.round(parseFloat(amount) * 100);
    if (isNaN(amountInPaise) || amountInPaise <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    const options = {
      amount: amountInPaise,
      currency: 'INR',
      receipt: `transfer_rcpt_${Date.now()}`,
      payment_capture: 1
    };

    const rOrder = await razorpay.orders.create(options);

    // Save temporary transfer details
    const temp = await TempTransfer.create({
      orderId: rOrder.id,
      amount: amountInPaise,
      batchId,
      to,
      noteCID
    });

    return res.json({
      success: true,
      orderId: rOrder.id,
      amount: rOrder.amount,
      currency: rOrder.currency,
      keyId: key_id,
      tempId: temp._id
    });
  } catch (err) {
    console.error('createPayment err', err);
    res.status(500).json({ error: err.message });
  }
};

// 2) verify-payment route: verify signature and execute contract.transfer
export const verifyAndTransfer = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: 'Missing params' });
    }

    // verify signature
    const expected = crypto.createHmac('sha256', key_secret)
      .update(razorpay_order_id + '|' + razorpay_payment_id)
      .digest('hex');

    if (expected !== razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Invalid signature' });
    }

    // Find temp transfer
    const temp = await TempTransfer.findOne({ orderId: razorpay_order_id });
    if (!temp) return res.status(404).json({ error: 'Transfer session not found' });

    // Execute blockchain transfer
    const contract = getContract();

    // Call recordTransfer(batchId, to, noteCID)
    // Adjust function name and params if your contract differs
    const tx = await contract.recordTransfer(temp.batchId, temp.to, temp.noteCID || '');
    const receipt = await tx.wait();

    // Delete temp
    await TempTransfer.deleteOne({ orderId: razorpay_order_id });

    return res.json({
      success: true,
      txHash: receipt.transactionHash || receipt.hash || tx.hash,
      receipt
    });
  } catch (err) {
    console.error('verifyAndTransfer err', err);
    return res.status(500).json({ error: err.message });
  }
};
