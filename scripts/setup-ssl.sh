#!/bin/bash
# Setup Let's Encrypt SSL on remote server
SERVER="root@45.13.227.179"
EMAIL="${1:-admin@galaxycraft.cc}"

echo "=== SSL-Zertifikat für panel.galaxycraft.cc ==="
echo ""
echo "Voraussetzung: DNS A-Record panel.galaxycraft.cc → 45.13.227.179 muss aktiv sein!"
echo "E-Mail: $EMAIL"
echo ""
read -p "Weiter? (j/n) " confirm
[ "$confirm" != "j" ] && exit 1

ssh "$SERVER" "
  apt-get install -y certbot python3-certbot-nginx -q
  certbot --nginx -d panel.galaxycraft.cc --non-interactive --agree-tos -m $EMAIL
  systemctl reload nginx
  echo 'SSL: OK'
"
echo "✓ HTTPS aktiv: https://panel.galaxycraft.cc"
