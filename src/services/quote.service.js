// Random Quote Service - Inspirational and funny quotes
export const quoteService = {
  quotes: {
    inspirational: [
      { quote: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
      { quote: "In the middle of difficulty lies opportunity.", author: "Albert Einstein" },
      { quote: "It is during our darkest moments that we must focus to see the light.", author: "Aristotle" },
      { quote: "The future belongs to those who believe in the beauty of their dreams.", author: "Eleanor Roosevelt" },
      { quote: "Success is not final, failure is not fatal: it is the courage to continue that counts.", author: "Winston Churchill" },
      { quote: "Believe you can and you're halfway there.", author: "Theodore Roosevelt" },
      { quote: "The only impossible journey is the one you never begin.", author: "Tony Robbins" },
      { quote: "Success usually comes to those who are too busy to be looking for it.", author: "Henry David Thoreau" },
      { quote: "Don't watch the clock; do what it does. Keep going.", author: "Sam Levenson" },
      { quote: "The best way to predict the future is to create it.", author: "Peter Drucker" }
    ],
    funny: [
      { quote: "I'm not lazy, I'm just on energy-saving mode.", author: "Unknown" },
      { quote: "I put my phone on airplane mode, but it's not flying. Worst. Phone. Ever.", author: "Unknown" },
      { quote: "My bed is a magical place where I suddenly remember everything I forgot to do.", author: "Unknown" },
      { quote: "I'm not saying I'm Batman, I'm just saying no one has ever seen me and Batman in a room together. That's a coincidence?", author: "Unknown" },
      { quote: "I'm on a seafood diet. I see food and I eat it.", author: "Unknown" },
      { quote: "Adulting is just inventing a person called 'me' to blame everything on.", author: "Unknown" },
      { quote: "My bed and I have a close relationship. It's always there for me, even when I try to leave it.", author: "Unknown" },
      { quote: "Sarcasm helps me deal with people I don't want to punch in the face.", author: "Unknown" },
      { quote: "I'm not a complete idiot, some parts are missing.", author: "Unknown" },
      { quote: "Why do they call it a 'building' if it's already built?", author: "Unknown" }
    ],
    life: [
      { quote: "Life is what happens when you're busy making other plans.", author: "John Lennon" },
      { quote: "The purpose of our lives is to be happy.", author: "Dalai Lama" },
      { quote: "Get busy living or get busy dying.", author: "Stephen King" },
      { quote: "You only live once, but if you do it right, once is enough.", author: "Mae West" },
      { quote: "Many of life's failures are people who did not realize how close they were to success when they gave up.", author: "Thomas A. Edison" },
      { quote: "If you want to live a happy life, tie it to a goal, not to people or things.", author: "Albert Einstein" },
      { quote: "Your time is limited, so don't waste it living someone else's life.", author: "Steve Jobs" },
      { quote: "The unexamined life is not worth living.", author: "Socrates" },
      { quote: "Turn your wounds into wisdom.", author: "Oprah Winfrey" },
      { quote: "Happiness depends upon ourselves.", author: "Aristotle" }
    ]
  },

  getRandom(category = 'all') {
    const categories = category ? [category.toLowerCase()] : ['inspirational', 'funny', 'life'];
    const allQuotes = [];

    categories.forEach(cat => {
      if (this.quotes[cat]) {
        allQuotes.push(...this.quotes[cat]);
      }
    });

    const quote = allQuotes[Math.floor(Math.random() * allQuotes.length)];

    return {
      success: true,
      data: {
        ...quote,
        category: category === 'all' ? categories[Math.floor(Math.random() * categories.length)] : category
      }
    };
  },

  getAllByCategory(category) {
    const cat = category.toLowerCase();
    if (!this.quotes[cat]) {
      return { success: false, error: 'Category not found' };
    }

    return {
      success: true,
      data: {
        category: cat,
        quotes: this.quotes[cat]
      }
    };
  },

  getCategories() {
    return {
      success: true,
      data: {
        categories: Object.keys(this.quotes)
      }
    };
  }
};

export default quoteService;
