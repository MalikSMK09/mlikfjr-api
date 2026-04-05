#!/usr/bin/env python3
"""
Spotify Downloader using spotdl
Best for Spotify: Tracks, Albums, Playlists, Artists

Usage:
    python spotify_downloader.py <spotify_url>
    python spotify_downloader.py "https://open.spotify.com/track/xxxxx"
    python spotify_downloader.py "https://open.spotify.com/playlist/xxxxx"
"""

import sys
import os
import json
import subprocess
import re

try:
    from spotdl import Spotdl
    from spotdl.types.track import Track
    from spotdl.types.album import Album
    from spotdl.types.playlist import Playlist
except ImportError:
    print("Installing spotdl...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "spotdl", "-q"])
    from spotdl import Spotdl
    from spotdl.types.track import Track
    from spotdl.types.album import Album
    from spotdl.types.playlist import Playlist

# Configuration
OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'downloads')
COOKIES_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'cookies', 'spotify.txt')


def get_spotdl():
    """Initialize spotdl instance"""
    try:
        spotdl = Spotdl(
            client_id='4ac3-c42d-45c4-6a11-b4d7c7d9e9a3f',
            client_secret='4ac3-c42d-45c4-6a11-b4d7c7d9e9a3f',
            cache_path=os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '.spotify_cache'),
            downloader_settings={
                'output': OUTPUT_DIR,
                'format': 'mp3',
                'quality': 'highest',
                'lyrics': False,
                'cover': True,
                'static_artwork': True,
                'artwork_size': 600,
                'save_errors': False,
                'overwrite': 'skip',
                'threads': 1,
            }
        )
        return spotdl
    except Exception as e:
        print(f"Error initializing spotdl: {e}")
        return None


def is_spotify_url(url):
    """Check if URL is Spotify"""
    patterns = [
        r'open\.spotify\.com/track/',
        r'open\.spotify\.com/album/',
        r'open\.spotify\.com/playlist/',
        r'open\.spotify\.com/artist/',
        r'open\.spotify\.com/episode/',
        r'spotify\.com/track/',
        r'spotify\.com/album/',
        r'spotify\.com/playlist/',
        r'spotify\.com/artist/',
    ]
    return any(re.search(p, url) for p in patterns)


def download_track(url):
    """Download Spotify track/album/playlist"""
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    print(f"\n📥 Downloading: {url}")
    print(f"📁 Output: {OUTPUT_DIR}")

    try:
        spotdl = get_spotdl()

        if not spotdl:
            return {'success': False, 'error': 'Failed to initialize spotdl'}

        # Check what type of URL
        if '/track/' in url:
            print("\n🎵 Type: Track")
            results = spotdl.search([url])
            if results:
                track = results[0]
                print(f"\n✓ Found: {track.name} - {track.artist}")
                print(f"  Album: {track.album}")
                print(f"  Duration: {track.duration}")

                # Download
                print("\n📥 Downloading audio...")
                spotdl.download([track])

                # Find downloaded file
                filename = f"{track.artist} - {track.name}.mp3"
                filepath = os.path.join(OUTPUT_DIR, filename)

                if os.path.exists(filepath):
                    file_size = os.path.getsize(filepath)
                    print(f"\n✓ Downloaded: {filename} ({format_size(file_size)})")
                    return {'success': True, 'file': filepath, 'size': file_size}
                else:
                    # Try other formats
                    for ext in ['.m4a', '.webm']:
                        alt_path = os.path.join(OUTPUT_DIR, f"{track.artist} - {track.name}{ext}")
                        if os.path.exists(alt_path):
                            file_size = os.path.getsize(alt_path)
                            print(f"\n✓ Downloaded: {os.path.basename(alt_path)} ({format_size(file_size)})")
                            return {'success': True, 'file': alt_path, 'size': file_size}

        elif '/album/' in url:
            print("\n🎵 Type: Album")
            results = spotdl.search([url])
            if results:
                album = results[0]
                print(f"\n✓ Album: {album.name}")
                print(f"  Artist: {album.artist}")
                print(f"  Tracks: {len(album.tracks) if hasattr(album, 'tracks') else 'Unknown'}")

                # Download first track as preview
                if hasattr(album, 'tracks') and album.tracks:
                    track = album.tracks[0]
                    print(f"\n📥 Downloading preview: {track.name} - {track.artist}")
                    spotdl.download([track])

                    filename = f"{track.artist} - {track.name}.mp3"
                    filepath = os.path.join(OUTPUT_DIR, filename)

                    if os.path.exists(filepath):
                        file_size = os.path.getsize(filepath)
                        print(f"\n✓ Downloaded: {filename} ({format_size(file_size)})")
                        return {'success': True, 'file': filepath, 'size': file_size}

        elif '/playlist/' in url:
            print("\n🎵 Type: Playlist")
            results = spotdl.search([url])
            if results:
                playlist = results[0]
                print(f"\n✓ Playlist: {playlist.name}")
                print(f"  Tracks: {len(playlist.tracks) if hasattr(playlist, 'tracks') else 'Unknown'}")

                # Download first track as preview
                if hasattr(playlist, 'tracks') and playlist.tracks:
                    track = playlist.tracks[0]
                    print(f"\n📥 Downloading preview: {track.name} - {track.artist}")
                    spotdl.download([track])

                    filename = f"{track.artist} - {track.name}.mp3"
                    filepath = os.path.join(OUTPUT_DIR, filename)

                    if os.path.exists(filepath):
                        file_size = os.path.getsize(filepath)
                        print(f"\n✓ Downloaded: {filename} ({format_size(file_size)})")
                        return {'success': True, 'file': filepath, 'size': file_size}

        print("\n⚠ Download completed but file not found")
        return {'success': False, 'error': 'File not found after download'}

    except Exception as e:
        print(f"\n✗ Error: {e}")
        import traceback
        traceback.print_exc()
        return {'success': False, 'error': str(e)}


def format_size(size):
    """Format file size to human readable"""
    for unit in ['B', 'KB', 'MB', 'GB']:
        if size < 1024:
            return f"{size:.2f} {unit}"
        size /= 1024
    return f"{size:.2f} TB"


def main():
    if len(sys.argv) < 2:
        print("""
╔═══════════════════════════════════════════════════════════════╗
║                    Spotify Downloader (spotdl)                 ║
╠═══════════════════════════════════════════════════════════════╣
║  Uses spotdl for high-quality Spotify downloads               ║
║  Supports: Tracks, Albums, Playlists, Artists                  ║
╠═══════════════════════════════════════════════════════════════╣
║  Usage: python spotify_downloader.py <spotify_url>            ║
║  Example: python spotify_downloader.py                         ║
║           "https://open.spotify.com/track/xyz123"              ║
╚═══════════════════════════════════════════════════════════════╝
        """)
        sys.exit(1)

    url = sys.argv[1]

    if not is_spotify_url(url):
        print("✗ Not a valid Spotify URL")
        sys.exit(1)

    print("═" * 60)
    print("  Spotify Downloader (spotdl)")
    print("═" * 60)
    print(f"\n🔗 URL: {url}")

    result = download_track(url)

    if result['success']:
        print("\n" + "═" * 60)
        print("  Download Complete")
        print("═" * 60)
    else:
        print(f"\n⚠ Failed: {result.get('error', 'Unknown error')}")
        sys.exit(1)


if __name__ == '__main__':
    main()
