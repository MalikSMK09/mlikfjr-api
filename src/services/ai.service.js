// Simple AI Service - provides caption and paraphrase functionality
// Uses heuristics and templates for basic generation
// For production, integrate with OpenAI, Anthropic, or other AI APIs

export const aiService = {
  // Generate caption for images/content
  generateCaption(text, tone = 'funny') {
    const tones = {
      funny: ['#vibes', '#mood', '#lit', '#no-cap', '#fr'],
      inspirational: ['#inspiration', '#motivation', '#dream', '#believe', '#goals'],
      professional: ['#update', '#insight', '#news', '#tech', '#innovation'],
      casual: ['#life', '#moment', '#today', '#goodvibes', '#relatable']
    };

    const hashtags = tones[tone] || tones.casual;

    // Simple heuristic-based caption generation
    const captionTemplates = {
      funny: [
        `When ${text} hits different 😅 ${hashtags.slice(0, 3).join(' ')}`,
        `Nobody: \nMe: ${text} 🤡 ${hashtags.slice(0, 2).join(' ')}`,
        `Plot twist: ${text} 🎭 ${hashtags.join(' ')}`
      ],
      inspirational: [
        `${text.charAt(0).toUpperCase() + text.slice(1)}. ✨ ${hashtags.slice(0, 3).join(' ')}`,
        `Remember: ${text} 💫 ${hashtags.slice(0, 2).join(' ')}`,
        `${text} — The journey begins here. 🚀 ${hashtags.join(' ')}`
      ],
      professional: [
        `${text}. 📢 ${hashtags.slice(0, 3).join(' ')}`,
        `Update: ${text} 💼 ${hashtags.slice(0, 2).join(' ')}`,
        `${text} — Read more below. 🔗 ${hashtags.join(' ')}`
      ],
      casual: [
        `${text} ✌️ ${hashtags.slice(0, 3).join(' ')}`,
        `Just a thought: ${text} 🤔 ${hashtags.slice(0, 2).join(' ')}`,
        `${text} ☀️ ${hashtags.join(' ')}`
      ]
    };

    const templates = captionTemplates[tone] || captionTemplates.casual;
    const selectedCaption = templates[Math.floor(Math.random() * templates.length)];

    return {
      success: true,
      data: {
        input: text,
        tone,
        caption: selectedCaption,
        hashtags,
        suggestion: 'For better results, consider integrating with OpenAI API'
      }
    };
  },

  // Paraphrase text
  paraphrase(text, style = 'simple') {
    // Simple word replacement heuristics
    const replacements = {
      good: ['great', 'excellent', 'amazing', 'wonderful'],
      bad: ['poor', 'terrible', 'awful', 'disappointing'],
      big: ['large', 'huge', 'enormous', 'massive'],
      small: ['tiny', 'little', 'compact', 'minor'],
      happy: ['joyful', 'delighted', 'pleased', 'cheerful'],
      sad: ['unhappy', 'sorrowful', 'melancholy', 'down'],
      like: ['appreciate', 'enjoy', 'favor', 'prefer'],
      think: ['believe', 'consider', 'feel', 'opine'],
      want: ['desire', 'wish', 'crave', 'long for'],
      use: ['utilize', 'employ', 'apply', 'make use of']
    };

    let paraphrased = text;
    let replacementCount = 0;

    for (const [word, alternatives] of Object.entries(replacements)) {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      if (regex.test(paraphrased) && Math.random() > 0.5) {
        const alt = alternatives[Math.floor(Math.random() * alternatives.length)];
        paraphrased = paraphrased.replace(regex, alt);
        replacementCount++;
      }
    }

    return {
      success: true,
      data: {
        original: text,
        paraphrased,
        style,
        replacements: replacementCount,
        note: 'Simple heuristic-based paraphrasing. For better results, integrate with OpenAI or similar.'
      }
    };
  },

  // Sentiment analysis (basic)
  analyzeSentiment(text) {
    const positiveWords = ['good', 'great', 'excellent', 'amazing', 'love', 'happy', 'joy', 'beautiful', 'best', 'wonderful'];
    const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'sad', 'angry', 'worst', 'horrible', 'disappointing', 'poor'];

    const words = text.toLowerCase().split(/\s+/);
    let positive = 0;
    let negative = 0;

    words.forEach(word => {
      if (positiveWords.some(pw => word.includes(pw))) positive++;
      if (negativeWords.some(nw => word.includes(nw))) negative++;
    });

    let sentiment = 'neutral';
    if (positive > negative) sentiment = 'positive';
    if (negative > positive) sentiment = 'negative';

    return {
      success: true,
      data: {
        text,
        sentiment,
        score: positive - negative,
        positiveCount: positive,
        negativeCount: negative
      }
    };
  }
};

export default aiService;
