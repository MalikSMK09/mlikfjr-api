// Random Meme Service - Gets random memes from various sources
export const memeService = {
  memes: [
    {
      title: "When the code finally works",
      imageUrl: "https://i.imgflip.com/1g8my4.jpg",
      source: "imgflip",
      upvotes: 5420
    },
    {
      title: "Programmers when they see a null pointer",
      imageUrl: "https://i.imgflip.com/261o3j.jpg",
      source: "imgflip",
      upvotes: 8942
    },
    {
      title: "It works on my machine",
      imageUrl: "https://i.imgflip.com/1ur9b0.jpg",
      source: "imgflip",
      upvotes: 12300
    },
    {
      title: "Debugging in production",
      imageUrl: "https://i.imgflip.com/wxica.jpg",
      source: "imgflip",
      upvotes: 7823
    },
    {
      title: "Merge conflict",
      imageUrl: "https://i.imgflip.com/1h7in3.jpg",
      source: "imgflip",
      upvotes: 15600
    },
    {
      title: "I will find you and I will fix you",
      imageUrl: "https://i.imgflip.com/24y43o.jpg",
      source: "imgflip",
      upvotes: 6321
    },
    {
      title: "Not sure if junior or senior",
      imageUrl: "https://i.imgflip.com/1bij.jpg",
      source: "imgflip",
      upvotes: 9876
    },
    {
      title: "First time submitting PR",
      imageUrl: "https://i.imgflip.com/1otk96.jpg",
      source: "imgflip",
      upvotes: 4532
    },
    {
      title: "When you forget a semicolon",
      imageUrl: "https://i.imgflip.com/3l60ph.jpg",
      source: "imgflip",
      upvotes: 7654
    },
    {
      title: "Boss walks in while I'm debugging",
      imageUrl: "https://i.imgflip.com/22bdq6.jpg",
      source: "imgflip",
      upvotes: 5432
    }
  ],

  getRandom() {
    const meme = this.memes[Math.floor(Math.random() * this.memes.length)];
    return {
      success: true,
      data: {
        ...meme,
        id: Math.random().toString(36).substring(7)
      }
    };
  },

  getAll() {
    return {
      success: true,
      data: {
        total: this.memes.length,
        memes: this.memes
      }
    };
  }
};

export default memeService;
