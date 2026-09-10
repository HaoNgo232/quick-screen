#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BIN_PATH="$HOME/.local/bin/quick-shot-host"

echo "==> Cài đặt script quick-shot-host vào $BIN_PATH"
mkdir -p "$HOME/.local/bin"

cp "$DIR/native-host/quick_screen_host.py" "$BIN_PATH"

chmod +x "$BIN_PATH"

# Auto-detect extension IDs from browser preferences
DETECTED_IDS=()
for pref in "$HOME/.config/google-chrome"/*/Preferences "$HOME/.config/chromium"/*/Preferences "$HOME/.config/BraveSoftware/Brave-Browser"/*/Preferences; do
  if [ -f "$pref" ]; then
    FOUND_IDS=$(python3 -c "
import json, sys
try:
    data = json.load(open('$pref'))
    for ext_id, ext in data.get('extensions', {}).get('settings', {}).items():
        path = ext.get('path', '')
        if 'quick-shot' in path or 'quick-screen' in path:
            print(ext_id)
except Exception:
    pass
" 2>/dev/null || true)
    for id in $FOUND_IDS; do
      if [ -n "$id" ]; then
        DETECTED_IDS+=("$id")
      fi
    done
  fi
done

# Base known IDs
ALLOWED_ORIGINS_JSON="    \"chrome-extension://lfjkmkbgdkejeefmjkcgakkeeajkccdo/\",
    \"chrome-extension://gnamflndgdnmkpjnkbocgkffdkmmbieh/\",
    \"chrome-extension://lmpelmbldegmgokigphaahjdbcnkmcci/\""

for id in "${DETECTED_IDS[@]}"; do
  ALLOWED_ORIGINS_JSON="$ALLOWED_ORIGINS_JSON,
    \"chrome-extension://$id/\""
done

echo "==> Đăng ký NativeMessagingHosts cho các trình duyệt Chromium/Chrome/Brave..."
for config_dir in "$HOME/.config/google-chrome" "$HOME/.config/chromium" "$HOME/.config/BraveSoftware/Brave-Browser"; do
  if [ -d "$config_dir" ] || [ "$config_dir" = "$HOME/.config/google-chrome" ]; then
    mkdir -p "$config_dir/NativeMessagingHosts"
    cat << JSON_EOF > "$config_dir/NativeMessagingHosts/com.quickscreen.host.json"
{
  "name": "com.quickscreen.host",
  "description": "quick-shot Native Messaging Host for automatic saving to /tmp",
  "path": "$BIN_PATH",
  "type": "stdio",
  "allowed_origins": [
$ALLOWED_ORIGINS_JSON
  ]
}
JSON_EOF
    echo "    ✓ Đã tạo $config_dir/NativeMessagingHosts/com.quickscreen.host.json"
  fi
done

echo "==> Hoàn tất! Native host đã sẵn sàng."
