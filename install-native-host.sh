#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BIN_PATH="$HOME/.local/bin/quick-screen-host"

echo "==> Cài đặt script quick-screen-host vào $BIN_PATH"
mkdir -p "$HOME/.local/bin"

cat << 'SCRIPT_EOF' > "$BIN_PATH"
#!/usr/bin/env python3
import sys
import json
import struct
import base64
import os
import subprocess

TARGET_DIR = "/tmp/quick-screen"

def read_message():
    raw_length = sys.stdin.buffer.read(4)
    if len(raw_length) < 4:
        return None
    message_length = struct.unpack('@I', raw_length)[0]
    message = sys.stdin.buffer.read(message_length).decode('utf-8')
    return json.loads(message)

def send_message(response):
    encoded = json.dumps(response).encode('utf-8')
    sys.stdout.buffer.write(struct.pack('@I', len(encoded)))
    sys.stdout.buffer.write(encoded)
    sys.stdout.buffer.flush()

def copy_to_clipboard(text):
    try:
        subprocess.run(['xclip', '-selection', 'clipboard'], input=text.encode('utf-8'), check=False)
    except Exception:
        try:
            subprocess.run(['wl-copy'], input=text.encode('utf-8'), check=False)
        except Exception:
            pass

def main():
    os.makedirs(TARGET_DIR, exist_ok=True)
    while True:
        try:
            msg = read_message()
            if msg is None:
                break
            
            action = msg.get('action')
            if action == 'ping':
                send_message({'status': 'ok', 'pong': True})
            elif action == 'copy_text':
                text = msg.get('text', '')
                copy_to_clipboard(text)
                send_message({'status': 'ok'})
            elif action == 'copy_image':
                filepath = msg.get('filepath', '')
                if not filepath or not os.path.exists(filepath):
                    filename = msg.get('filename', '')
                    filepath = os.path.join(TARGET_DIR, filename)
                
                if os.path.exists(filepath):
                    try:
                        subprocess.run(['xclip', '-selection', 'clipboard', '-t', 'image/png', '-i', filepath], check=False)
                        send_message({'status': 'ok', 'filepath': filepath})
                    except Exception:
                        try:
                            with open(filepath, 'rb') as img_f:
                                subprocess.run(['wl-copy', '-t', 'image/png'], input=img_f.read(), check=False)
                            send_message({'status': 'ok', 'filepath': filepath})
                        except Exception as wle:
                            send_message({'status': 'error', 'error': str(wle)})
                else:
                    send_message({'status': 'error', 'error': 'File not found'})
            elif action == 'save':
                filename = msg.get('filename', 'screenshot.png')
                base64_data = msg.get('base64Data', '')
                should_copy = msg.get('copyClipboard', True)
                if ',' in base64_data:
                    base64_data = base64_data.split(',', 1)[1]
                
                raw_bytes = base64.b64decode(base64_data)
                filepath = os.path.join(TARGET_DIR, filename)
                with open(filepath, 'wb') as f:
                    f.write(raw_bytes)
                
                if should_copy:
                    copy_to_clipboard(filepath)
                
                send_message({
                    'status': 'ok',
                    'absolutePath': filepath,
                    'filename': filename,
                    'size': len(raw_bytes)
                })
            elif action == 'save_batch':
                items = msg.get('items', [])
                paths = []
                for it in items:
                    fname = it.get('filename', 'tab.png')
                    b64 = it.get('base64Data', '')
                    if ',' in b64:
                        b64 = b64.split(',', 1)[1]
                    b = base64.b64decode(b64)
                    fpath = os.path.join(TARGET_DIR, fname)
                    with open(fpath, 'wb') as f:
                        f.write(b)
                    paths.append(fpath)
                
                combined_paths = '\n'.join(paths)
                copy_to_clipboard(combined_paths)
                
                send_message({
                    'status': 'ok',
                    'paths': paths,
                    'combinedPaths': combined_paths
                })
            else:
                send_message({'status': 'error', 'error': f'Unknown action: {action}'})
        except Exception as e:
            send_message({'status': 'error', 'error': str(e)})

if __name__ == '__main__':
    main()
SCRIPT_EOF

chmod +x "$BIN_PATH"

echo "==> Đăng ký NativeMessagingHosts cho các trình duyệt Chromium/Chrome/Brave..."
for config_dir in "$HOME/.config/google-chrome" "$HOME/.config/chromium" "$HOME/.config/BraveSoftware/Brave-Browser"; do
  if [ -d "$config_dir" ] || [ "$config_dir" = "$HOME/.config/google-chrome" ]; then
    mkdir -p "$config_dir/NativeMessagingHosts"
    cat << JSON_EOF > "$config_dir/NativeMessagingHosts/com.quickscreen.host.json"
{
  "name": "com.quickscreen.host",
  "description": "quick-screen Native Messaging Host for automatic saving to /tmp",
  "path": "$BIN_PATH",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://lfjkmkbgdkejeefmjkcgakkeeajkccdo/",
    "chrome-extension://gnamflndgdnmkpjnkbocgkffdkmmbieh/"
  ]
}
JSON_EOF
    echo "    ✓ Đã tạo $config_dir/NativeMessagingHosts/com.quickscreen.host.json"
  fi
done

echo "==> Hoàn tất! Native host đã sẵn sàng."
