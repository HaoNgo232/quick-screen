#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BIN_PATH="$HOME/.local/bin/quick-shot-host"

echo "==> Cài đặt script quick-shot-host vào $BIN_PATH"
mkdir -p "$HOME/.local/bin"

cp "$DIR/native-host/quick_screen_host.py" "$BIN_PATH"

chmod +x "$BIN_PATH"

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
    "chrome-extension://lfjkmkbgdkejeefmjkcgakkeeajkccdo/",
    "chrome-extension://gnamflndgdnmkpjnkbocgkffdkmmbieh/"
  ]
}
JSON_EOF
    echo "    ✓ Đã tạo $config_dir/NativeMessagingHosts/com.quickscreen.host.json"
  fi
done

echo "==> Hoàn tất! Native host đã sẵn sàng."
