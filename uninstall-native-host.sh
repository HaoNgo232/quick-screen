#!/usr/bin/env bash
set -e

echo "==> Gỡ cài đặt quick-screen Native Messaging Host trên Linux..."

rm -f "$HOME/.local/bin/quick-screen-host"
echo "    ✓ Đã xóa $HOME/.local/bin/quick-screen-host"

for config_dir in "$HOME/.config/google-chrome" "$HOME/.config/chromium" "$HOME/.config/BraveSoftware/Brave-Browser"; do
  manifest="$config_dir/NativeMessagingHosts/com.quickscreen.host.json"
  if [ -f "$manifest" ]; then
    rm -f "$manifest"
    echo "    ✓ Đã xóa $manifest"
  fi
done

echo "==> Đã gỡ bỏ hoàn toàn Native Host khỏi hệ thống!"
