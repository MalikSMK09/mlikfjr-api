import { jest } from '@jest/globals';
import { parseRedditJsonForMedia, isValidRedditUrl, getJsonUrl } from './reddit.service.js';

describe('Reddit Service', () => {

  describe('parseRedditJsonForMedia', () => {

    test('should extract reddit video URL', () => {
      const mockData = [{
        data: {
          children: [{
            data: {
              title: 'Test Video Post',
              preview: { images: [] },
              media: {
                reddit_video: {
                  fallback_url: 'https://v.redd.it/test123/DASH_720.mp4',
                  width: 1280,
                  height: 720,
                  dash_url: 'https://v.redd.it/test123/DASH_720.mpd',
                  hls_url: 'https://v.redd.it/test123/HLS.m3u8'
                }
              }
            }
          }]
        }
      }];

      const result = parseRedditJsonForMedia(mockData);

      expect(result.mediaUrls.length).toBe(1);
      expect(result.mediaUrls[0].url).toContain('v.redd.it');
      expect(result.mediaUrls[0].type).toBe('video');
      expect(result.postType).toBe('video');
    });

    test('should extract preview images', () => {
      const mockData = [{
        data: {
          children: [{
            data: {
              title: 'Test Image Post',
              preview: {
                images: [{
                  source: {
                    url: 'https://i.redd.it/test.jpg?width=1080&height=720',
                    width: 1080,
                    height: 720
                  }
                }]
              },
              media: null
            }
          }]
        }
      }];

      const result = parseRedditJsonForMedia(mockData);

      expect(result.mediaUrls.length).toBe(1);
      expect(result.mediaUrls[0].type).toBe('image');
      expect(result.mediaUrls[0].url).toContain('i.redd.it');
      expect(result.isImage).toBe(true);
    });

    test('should handle gallery posts', () => {
      const mockData = [{
        data: {
          children: [{
            data: {
              title: 'Test Gallery',
              gallery_data: {
                items: [
                  { media_id: 'img1', outbound_gallery_index: 0 },
                  { media_id: 'img2', outbound_gallery_index: 1 }
                ]
              },
              media_metadata: {
                img1: { s: { u: 'https://i.redd.it/gallery1.jpg' }, p: [{ u: 'preview1.jpg' }] },
                img2: { s: { u: 'https://i.redd.it/gallery2.jpg' }, p: [{ u: 'preview2.jpg' }] }
              },
              preview: { images: [] },
              media: null
            }
          }]
        }
      }];

      const result = parseRedditJsonForMedia(mockData);

      expect(result.isGallery).toBe(true);
      expect(result.mediaUrls.length).toBe(2);
    });

    test('should return error for invalid data', () => {
      const result = parseRedditJsonForMedia([{ data: { children: [] } }]);

      expect(result.mediaUrls.length).toBe(0);
      expect(result.error).toBeDefined();
    });

  });

  describe('isValidRedditUrl', () => {

    test('should validate correct Reddit post URLs', () => {
      expect(isValidRedditUrl('https://www.reddit.com/r/indonesia/comments/1q3nbgl/test/')).toBe(true);
      expect(isValidRedditUrl('https://old.reddit.com/r/videos/comments/abc123/test/')).toBe(true);
    });

    test('should reject invalid URLs', () => {
      expect(isValidRedditUrl('https://youtube.com/watch?v=abc')).toBe(false);
      expect(isValidRedditUrl('https://www.reddit.com/r/indonesia/')).toBe(false);
      expect(isValidRedditUrl('not-a-url')).toBe(false);
    });

  });

  describe('getJsonUrl', () => {

    test('should convert post URL to JSON endpoint', () => {
      const jsonUrl = getJsonUrl('https://www.reddit.com/r/indonesia/comments/1q3nbgl/test/?utm_source=share');
      expect(jsonUrl).toBe('https://www.reddit.com/r/indonesia/comments/1q3nbgl/test/.json');
    });

  });

});
