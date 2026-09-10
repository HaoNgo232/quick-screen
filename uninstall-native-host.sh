#!/usr/bin/env bash
set -e

echo "==> Uninstalling quick-shot Native Messaging Host on Linux..."

rm -f "$HOME/.local/bin/quick-shot-host"
echo "    [OK] Removed $HOME/.local/bin/quick-shot-host"

for config_dir in "$HOME/.config/google-chrome" "$HOME/.config/chromium" "$HOME/.config/BraveSoftware/Brave-Browser"; do
  manifest="$config_dir/NativeMessagingHosts/com.quickscreen.host.json"
  if [ -f "$manifest" ]; then
    rm -f "$manifest"
    echo "    [OK] Removed $manifest"
  fi
done

echo "==> Native host successfully uninstalled from system!"
