#!/bin/bash
# Create .desktop file for application menu
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DESKTOP_FILE="$HOME/.local/share/applications/infra-panel.desktop"
mkdir -p "$(dirname "$DESKTOP_FILE")"

cat > "$DESKTOP_FILE" <<DESKTOP
[Desktop Entry]
Version=1.0
Type=Application
Name=InfraPanel
GenericName=Server Management
Comment=Zentrale Verwaltungs- und Synchronisationsplattform
Exec=bash -c "cd $PROJECT_DIR && ./scripts/start-electron.sh"
Icon=$PROJECT_DIR/scripts/assets/icon.png
Terminal=false
Categories=System;Network;
Keywords=server;management;ssh;discord;
StartupWMClass=InfraPanel
StartupNotify=true
DESKTOP

chmod +x "$DESKTOP_FILE"
echo "✓ Desktop-Eintrag: $DESKTOP_FILE"
echo "  InfraPanel erscheint jetzt im Anwendungsmenü."
