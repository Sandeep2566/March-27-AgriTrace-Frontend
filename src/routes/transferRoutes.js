import express from "express";
const router = express.Router();
import {createPayment,verifyAndTransfer} from "../controller/transferController.js";

// create a razorpay order and store temp transfer
router.post("/create-payment", createPayment);

// verify payment after checkout success and then execute blockchain transfer
router.post("/verify", verifyAndTransfer);

export default router;
