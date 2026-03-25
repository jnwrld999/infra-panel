#!/bin/bash
# Setup XDG autostart for Ubuntu login
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AUTOSTART_DIR="$HOME/.config/autostart"
mkdir -p "$AUTOSTART_DIR"

cat > "$AUTOSTART_DIR/infra-panel.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=InfraPanel
Comment=Server Management & Discord Integration
Exec=bash -c "cd $PROJECT_DIR && ./scripts/start-electron.sh"
Icon=$PROJECT_DIR/scripts/assets/icon.png
Terminal=false
X-GNOME-Autostart-enabled=true
EOF

echo "✓ Autostart eingerichtet: $AUTOSTART_DIR/infra-panel.desktop"
echo "  InfraPanel startet automatisch beim Ubuntu-Login."
