import express from 'express';
import { aiService } from '../services/ai.service.js';

const router = express.Router();

// POST /ai/caption
router.post('/caption', (req, res) => {
  const { text, tone = 'funny' } = req.body;

  if (!text) {
    return res.status(400).json({
      success: false,
      error: 'Text is required'
    });
  }

  const result = aiService.generateCaption(text, tone);
  res.json(result);
});

// POST /ai/paraphrase
router.post('/paraphrase', (req, res) => {
  const { text, style = 'simple' } = req.body;

  if (!text) {
    return res.status(400).json({
      success: false,
      error: 'Text is required'
    });
  }

  const result = aiService.paraphrase(text, style);
  res.json(result);
});

// POST /ai/sentiment
router.post('/sentiment', (req, res) => {
  const { text } = req.body;

  if (!text) {
    return res.status(400).json({
      success: false,
      error: 'Text is required'
    });
  }

  const result = aiService.analyzeSentiment(text);
  res.json(result);
});

export default router;
