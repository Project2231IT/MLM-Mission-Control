#!/bin/bash
# Deploy Guest WiFi Analytics to Docker VM
# Run this ON the Docker VM (172.16.201.15)

cd /opt/guest-wifi-analytics
docker compose down 2>/dev/null
docker compose up -d --build
echo "Done! Access at http://$(hostname -I | awk '{print $1}'):3700"
