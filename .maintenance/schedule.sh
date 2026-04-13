#!/usr/bin/env bash
set -euo pipefail

#─────────────────────────────────────────────
# Install/uninstall the maintenance agent
# as a macOS LaunchAgent (runs every 6 hours)
#─────────────────────────────────────────────

PLIST_NAME="com.exigo.maintenance"
PLIST_PATH="$HOME/Library/LaunchAgents/$PLIST_NAME.plist"
SCRIPT="/Users/artemchmylenko/development/Exigo/.maintenance/run.sh"
LOG_DIR="/Users/artemchmylenko/development/Exigo/.maintenance/logs"

case "${1:-help}" in
  install)
    mkdir -p "$HOME/Library/LaunchAgents" "$LOG_DIR"

    cat > "$PLIST_PATH" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>$PLIST_NAME</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>$SCRIPT</string>
    </array>
    <key>StartInterval</key>
    <integer>21600</integer>
    <key>WorkingDirectory</key>
    <string>/Users/artemchmylenko/development/Exigo</string>
    <key>StandardOutPath</key>
    <string>$LOG_DIR/launchd-stdout.log</string>
    <key>StandardErrorPath</key>
    <string>$LOG_DIR/launchd-stderr.log</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
        <key>HOME</key>
        <string>/Users/artemchmylenko</string>
    </dict>
</dict>
</plist>
EOF

    launchctl unload "$PLIST_PATH" 2>/dev/null || true
    launchctl load "$PLIST_PATH"
    echo "Installed and loaded. Runs every 6 hours."
    echo "  Manual run:  .maintenance/run.sh"
    echo "  With target: .maintenance/run.sh convex"
    echo "  Logs:        .maintenance/logs/"
    echo "  Uninstall:   .maintenance/schedule.sh uninstall"
    ;;

  uninstall)
    launchctl unload "$PLIST_PATH" 2>/dev/null || true
    rm -f "$PLIST_PATH"
    echo "Uninstalled."
    ;;

  status)
    if launchctl list | grep -q "$PLIST_NAME"; then
      echo "Running."
      launchctl list "$PLIST_NAME" 2>/dev/null
    else
      echo "Not loaded."
    fi
    ;;

  run)
    echo "Triggering manual run..."
    exec "$SCRIPT" "${2:-}"
    ;;

  *)
    echo "Usage: $0 {install|uninstall|status|run [category]}"
    echo ""
    echo "Categories: convex, api-routes, learn-components, test-components,"
    echo "  space-components, shared-components, pages, actions, shared-utils, hooks"
    ;;
esac
