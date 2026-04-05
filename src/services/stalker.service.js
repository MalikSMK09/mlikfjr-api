// Stalker Service - Social media profile lookup
export const stalkerService = {
  // TikTok user info (demo data)
  tiktok: {
    getProfile: async (username) => {
      // Demo data - in production, use TikTok API or scraper
      const profiles = {
        'khaby.lame': {
          username: 'khaby.lame',
          displayName: 'Khabane Lame',
          followers: '130M+',
          following: '150+',
          bio: 'Senegalese born🇸🇳 living in Italy🇮🇹 H2O artist🎨 Business: khabylame@添金.com',
          verified: true,
          profilePic: 'https://p16-sign.tiktokcdn.com/tos-maliva-avt-0068/4f6c7c6b7c7c7c7c7c7c7c7c7c7c7c7c~c5_100x100.jpeg',
          posts: 1120,
          likes: '2.3B+'
        },
        'charlidamelio': {
          username: 'charlidamelio',
          displayName: 'Charli D\'Amelio',
          followers: '150M+',
          following: '1400+',
          bio: ' dancer & content creator 🌟 business@chelcie.com',
          verified: true,
          profilePic: 'https://p16-sign.tiktokcdn.com/tos-maliva-avt-0068/1234567890~c5_100x100.jpeg',
          posts: 3450,
          likes: '10B+'
        },
        'mrbeast': {
          username: 'mrbeast',
          displayName: 'MrBeast',
          followers: '70M+',
          following: '200+',
          bio: 'I want to make the world a better place before I die',
          verified: true,
          profilePic: 'https://p16-sign.tiktokcdn.com/tos-maliva-avt-0068/abcdef1234~c5_100x100.jpeg',
          posts: 780,
          likes: '8B+'
        }
      };

      const normalizedUsername = username.toLowerCase().replace('@', '');
      const profile = profiles[normalizedUsername];

      if (!profile) {
        // Return generic profile for demo
        return {
          success: true,
          data: {
            username: normalizedUsername,
            displayName: normalizedUsername.charAt(0).toUpperCase() + normalizedUsername.slice(1),
            followers: '0',
            following: '0',
            bio: 'User not found in demo database',
            verified: false,
            profilePic: null,
            posts: 0,
            likes: '0',
            note: 'This is demo data. Connect to TikTok API for real data.'
          }
        };
      }

      return { success: true, data: profile };
    }
  },

  // Instagram user info (demo data)
  instagram: {
    getProfile: async (username) => {
      // Demo data - in production, use Instagram API or scraper
      const profiles = {
        'instagram': {
          username: 'instagram',
          fullName: 'Instagram',
          followers: '500M+',
          following: '100+',
          bio: 'Creating and sharing what brings people together. #InstagramForGood',
          verified: true,
          profilePic: 'https://instagram.com/static/images/ico/xxhdpi.png',
          posts: 12500
        },
        'instagram': {
          username: 'instagram',
          fullName: 'Instagram',
          followers: '500M+',
          following: '100+',
          bio: 'Creating and sharing what brings people together. #InstagramForGood',
          verified: true,
          profilePic: 'https://instagram.com/static/images/ico/xxhdpi.png',
          posts: 12500
        },
        'therock': {
          username: 'therock',
          fullName: 'Dwayne Johnson',
          followers: '390M+',
          following: '1000+',
          bio: 'Southern\'s 6th Generation 🐂 Texas Kid 👊🏾🥋🤴🏿',
          verified: true,
          profilePic: 'https://instagram.com/static/images/ico/xxhdpi.png',
          posts: 7850
        },
        'selenagomez': {
          username: 'selenagomez',
          fullName: 'Selena Gomez',
          followers: '420M+',
          following: '1000+',
          bio: 'Rare Beauty | Maybelline | Wondermind',
          verified: true,
          profilePic: 'https://instagram.com/static/images/ico/xxhdpi.png',
          posts: 1920
        }
      };

      const normalizedUsername = username.toLowerCase().replace('@', '');
      const profile = profiles[normalizedUsername];

      if (!profile) {
        return {
          success: true,
          data: {
            username: normalizedUsername,
            fullName: normalizedUsername.charAt(0).toUpperCase() + normalizedUsername.slice(1),
            followers: '0',
            following: '0',
            bio: 'User not found in demo database',
            verified: false,
            profilePic: null,
            posts: 0,
            note: 'This is demo data. Connect to Instagram API for real data.'
          }
        };
      }

      return { success: true, data: profile };
    }
  }
};

export default stalkerService;
