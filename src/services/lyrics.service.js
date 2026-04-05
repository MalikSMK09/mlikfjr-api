// Lyrics Search Service - Simple lyrics search (demo data)
export const lyricsService = {
  lyrics: [
    {
      title: "Hello",
      artist: "Adele",
      album: "25",
      lyrics: "Hello, it's me\nI was wondering if after all these years you'd like to meet\nTo go over everything\nThey say that time's supposed to heal ya\nBut I ain't done much healing\n\nHello, can you hear me?\nI'm in California dreaming about who we used to be\nWhen we were younger and free\nI've forgotten how it felt before the world fell at our feet\nThere's such a difference between us\nAnd a million miles"
    },
    {
      title: "Shape of You",
      artist: "Ed Sheeran",
      album: "Divide",
      lyrics: "The club isn't the best place to find a lover\nSo the bar is where I go\nMe and my friends at the table doing shots\nDrinking fast and then we talk slow\nAnd you come over and start up a conversation with me\nAnd eventually, be my lover\n\nDo you remember the last time we said 'See you again'?\nComing from the one side\nFrom the one side\nWe're happy to meet\nPlease, don't make us wait forever\nDo you remember the last time we said 'See you again'?"
    },
    {
      title: "Blinding Lights",
      artist: "The Weeknd",
      album: "After Hours",
      lyrics: "I blinded by the lights\nI can't sleep every night\nReaching for you, dear\nI can't see a thing in the dark\nThe lights are blinding me\nAgain I can't sleep\nI still see you in my dreams\nAnd I'm confused about what is real\n\nHeartless in the night\nI'm running out of time\nI can't find the light\nThe lights are blinding me\nI can't see what's right"
    },
    {
      title: "Bad Guy",
      artist: "Billie Eilish",
      album: "When We All Fall Asleep",
      lyrics: "White shirt now red, my bloody nose\nSleeping, you're on your tippy toes\nCreeping around like no one knows\nThink you're so criminal\n\nBruises on both my knees for you\nDon't say thank you or please\nI do what I want when I'm wanting to\nMy soul? Not so free\nAngry, my drug is my hobby\nBut when I'm sedated\nI'm not who I used to be"
    },
    {
      title: "Bohemian Rhapsody",
      artist: "Queen",
      album: "A Night at the Opera",
      lyrics: "Is this the real life? Is this just fantasy?\nCaught in a landslide, no escape from reality\nOpen your eyes, look up to the skies and see\nI'm just a poor boy, I need no sympathy\nBecause I'm easy come, easy go, little high, little low\nAny way the wind blows doesn't really matter to me, to me"
    },
    {
      title: "Imagine",
      artist: "John Lennon",
      album: "Imagine",
      lyrics: "Imagine there's no heaven\nIt's easy if you try\nNo hell below us\nAbove us only sky\nImagine all the people living for today\n\nImagine there's no countries\nIt isn't hard to do\nNothing to kill or die for\nAnd no religion too\nImagine all the people living life in peace"
    },
    {
      title: "Smells Like Teen Spirit",
      artist: "Nirvana",
      album: "Nevermind",
      lyrics: "Load up on guns, bring your friends\nIt's fun to lose and to pretend\nShe's over bored and self-assured\nOh no, I know a dirty word\n\nWith the lights out, it's less dangerous\nHere we are now, entertain us\nI feel stupid and contagious\nHere we are now, entertain us"
    },
    {
      title: "Rolling in the Deep",
      artist: "Adele",
      album: "21",
      lyrics: "There's a fire starting in my heart\nReaching a fever pitch and it's bringing me out the dark\nThe scars of your love remind me of us\nThey keep me believing that I don't need the rest\n\nSee how I'll leave with every piece of you\nDon't underestimate the things that I will do\nThere's a fire starting in my heart\nReaching a fever pitch and it's bringing me out the dark"
    }
  ],

  search(query, limit = 5) {
    const q = query.toLowerCase();
    const results = this.lyrics.filter(l =>
      l.title.toLowerCase().includes(q) ||
      l.artist.toLowerCase().includes(q) ||
      l.lyrics.toLowerCase().includes(q)
    ).slice(0, limit);

    return {
      success: true,
      data: {
        query,
        total: results.length,
        results: results.map(r => ({
          title: r.title,
          artist: r.artist,
          album: r.album,
          snippet: r.lyrics.substring(0, 100) + '...'
        }))
      }
    };
  },

  getByTitle(title) {
    const song = this.lyrics.find(l =>
      l.title.toLowerCase() === title.toLowerCase()
    );

    if (!song) {
      return { success: false, error: 'Song not found' };
    }

    return {
      success: true,
      data: song
    };
  },

  getRandom() {
    const song = this.lyrics[Math.floor(Math.random() * this.lyrics.length)];
    return {
      success: true,
      data: {
        ...song,
        snippet: song.lyrics.substring(0, 150) + '...'
      }
    };
  }
};

export default lyricsService;
