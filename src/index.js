import mlRoutes from './routes/ml.js';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import rolesRoutes from './routes/roles.js';
import produceRoutes from './routes/produce.js';
import blockchainRoutes from './routes/blockchain.js';
import blockchainActions from './routes/blockchainActions.js';
import authRoutes from './routes/auth.routes.js';
import transferRoutes from './routes/transferRoutes.js';
import bodyParser from 'body-parser';
import { GoogleGenerativeAI } from '@google/generative-ai';
import connectDB from "./config/database.js";

dotenv.config();

const app = express();

// ✅ Proper CORS setup (remove any duplicate `app.use(cors())`)
app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
  })
);


// ✅ Handle preflight requests (important!)
app.options('*', cors());

connectDB(); // ✅ Connect to MongoDB using the new connectDB function

// ✅ Middleware
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ✅ Routes
app.use('/api/roles', rolesRoutes);
app.use('/api/produce', produceRoutes);
app.use('/api/blockchain', blockchainRoutes);
app.use('/api/transfer', transferRoutes);
app.use('/api/ml', mlRoutes);
app.use('/api/auth', authRoutes);

// ✅ Gemini Chat Route
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    const result = await model.generateContent(message);
    const reply = result.response.text();

    // ✅ Explicitly include CORS headers in response
   
   
    res.json({ reply });
  } catch (error) {
    console.error('Gemini error:', error);
    res.status(500).json({ error: 'Failed to fetch Gemini response' });
  }
});

// ✅ MongoDB Connection
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/agritrace';

mongoose
  .connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('✅ MongoDB connected'))
  .catch((err) => console.error('❌ MongoDB connection error:', err));

// ✅ Root route
app.get('/', (req, res) => {
  res.send('AgriTrace Backend API');
});

// ✅ Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
