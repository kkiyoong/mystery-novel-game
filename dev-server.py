#!/usr/bin/env python3
"""
Mystery Novel Game - Local Development Server with Auto-Save API
Allows the in-game Author Editor to directly write changes to js/data/*.js files.
"""

import http.server
import json
import os
import re
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Target directories to keep 100% in sync
TARGET_DIRS = [BASE_DIR]
DESKTOP_DIR = '/Users/ram/Desktop/mystery-novel-game'
if os.path.exists(DESKTOP_DIR) and os.path.abspath(DESKTOP_DIR) != os.path.abspath(BASE_DIR):
    TARGET_DIRS.append(DESKTOP_DIR)

class GameHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BASE_DIR, **kwargs)

    def end_headers(self):
        # Force no-cache on all files so dev edits are loaded immediately
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_GET(self):
        if self.path == '/api/save':
            resp = json.dumps({'status': 'ok', 'dev_server': True, 'targets': TARGET_DIRS}).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(resp)))
            self.end_headers()
            self.wfile.write(resp)
            return
        super().do_GET()

    def do_POST(self):
        if self.path == '/api/save':
            try:
                length = int(self.headers.get('Content-Length', 0))
                body = self.rfile.read(length).decode('utf-8')
                data = json.loads(body)

                saved_files = []
                errors = []

                for target_dir in TARGET_DIRS:
                    try:
                        data_dir = os.path.join(target_dir, 'js', 'data')
                        os.makedirs(data_dir, exist_ok=True)

                        # 1. storyData.js
                        if 'storyEpisodes' in data and 'storyNodes' in data:
                            story_path = os.path.join(data_dir, 'storyData.js')
                            story_code = (
                                "/**\n"
                                " * Branching Story Data for the Playable Korean Scenario\n"
                                " * Updated via Author Editor\n"
                                " */\n\n"
                                f"export const STORY_EPISODES = {json.dumps(data['storyEpisodes'], ensure_ascii=False, indent=2)};\n\n"
                                f"export const STORY_NODES = {json.dumps(data['storyNodes'], ensure_ascii=False, indent=2)};\n"
                            )
                            with open(story_path, 'w', encoding='utf-8') as f:
                                f.write(story_code)
                            saved_files.append(story_path)

                        # 2. mapData.js
                        if 'mapLocations' in data and 'investigationScenes' in data:
                            map_path = os.path.join(data_dir, 'mapData.js')
                            map_code = (
                                "/**\n"
                                " * Map and Investigation Scene Data\n"
                                " * Updated via Author Editor\n"
                                " */\n\n"
                                f"export const MAP_LOCATIONS = {json.dumps(data['mapLocations'], ensure_ascii=False, indent=2)};\n\n"
                                f"export const INVESTIGATION_SCENES = {json.dumps(data['investigationScenes'], ensure_ascii=False, indent=2)};\n\n"
                                f"export const EPISODE_DATA = {json.dumps(data.get('episodeData', {}), ensure_ascii=False, indent=2)};\n"
                            )
                            with open(map_path, 'w', encoding='utf-8') as f:
                                f.write(map_code)
                            saved_files.append(map_path)

                        # 3. codexData.js
                        if 'codexCategories' in data:
                            codex_path = os.path.join(data_dir, 'codexData.js')
                            codex_code = (
                                "/**\n"
                                " * Codex / Encyclopedia Data\n"
                                " * Updated via Author Editor\n"
                                " */\n\n"
                                f"export const CODEX_CATEGORIES = {json.dumps(data.get('codexCategories', []), ensure_ascii=False, indent=2)};\n\n"
                                f"export const CODEX_DATA = {json.dumps(data.get('codexData', []), ensure_ascii=False, indent=2)};\n\n"
                                f"export const CLUE_RECIPES = {json.dumps(data.get('clueRecipes', {}), ensure_ascii=False, indent=2)};\n\n"
                                f"export const INVENTORY_ITEMS = {json.dumps(data.get('inventoryItems', []), ensure_ascii=False, indent=2)};\n"
                            )
                            with open(codex_path, 'w', encoding='utf-8') as f:
                                f.write(codex_code)
                            saved_files.append(codex_path)

                        # 4. isometricMap.js MAP_TILES
                        if 'mapTiles' in data:
                            iso_path = os.path.join(target_dir, 'js', 'isometricMap.js')
                            if os.path.exists(iso_path):
                                with open(iso_path, 'r', encoding='utf-8') as f:
                                    iso_text = f.read()
                                new_tiles = f"export const MAP_TILES = {json.dumps(data['mapTiles'], ensure_ascii=False, indent=2)};"
                                new_text = re.sub(r'export const MAP_TILES\s*=\s*\[[\s\S]*?\];', new_tiles, iso_text, count=1)
                                if new_text != iso_text:
                                    with open(iso_path, 'w', encoding='utf-8') as f:
                                        f.write(new_text)
                                    saved_files.append(iso_path)
                    except Exception as dir_err:
                        print(f"[dev-server] Directory sync warning for {target_dir}: {dir_err}")
                        errors.append(f"{target_dir}: {dir_err}")

                if saved_files:
                    response = json.dumps({'success': True, 'savedFiles': saved_files, 'warnings': errors}).encode('utf-8')
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/json; charset=utf-8')
                    self.send_header('Content-Length', str(len(response)))
                    self.end_headers()
                    self.wfile.write(response)
                    print(f"[dev-server] Successfully wrote changes to {len(saved_files)} files!")
                else:
                    raise Exception("; ".join(errors) or "No files could be saved")

            except Exception as e:
                err_resp = json.dumps({'error': str(e)}).encode('utf-8')
                self.send_response(500)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.send_header('Content-Length', str(len(err_resp)))
                self.end_headers()
                self.wfile.write(err_resp)
                print(f"[dev-server] Error saving: {e}")
        else:
            self.send_response(404)
            self.end_headers()

def run():
    addr = ('', PORT)
    try:
        server = http.server.ThreadingHTTPServer(addr, GameHandler)
        print(f"==================================================")
        print(f"🚀 Mystery Novel Game Dev Server Running!")
        print(f"👉 Local URL: http://localhost:{PORT}")
        print(f"📂 Syncing directories: {TARGET_DIRS}")
        print(f"✨ Feature: Changes in Author Editor will auto-save to disk!")
        print(f"==================================================")
        server.serve_forever()
    except OSError as e:
        if "Address already in use" in str(e):
            print(f"Port {PORT} is already in use. Trying {PORT + 1}...")
            sys.argv[1:] = [str(PORT + 1)]
            run()
        else:
            raise

if __name__ == '__main__':
    run()
