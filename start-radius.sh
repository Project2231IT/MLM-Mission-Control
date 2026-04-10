#!/bin/bash
# Start FreeRADIUS with proper config - run as: sudo bash start-radius.sh

CONTAINER_NAME="freeradius-radius-1"
NETWORK="guest-analytics_default"
POSTGRES_IP="10.200.5.2"
CONFIG_DIR="/home/jake/guest-wifi/radius-config"

echo "Stopping any existing FreeRADIUS container..."
docker stop $CONTAINER_NAME 2>/dev/null
docker rm $CONTAINER_NAME 2>/dev/null

echo "Starting FreeRADIUS container..."
docker run -d \
  --name $CONTAINER_NAME \
  --network $NETWORK \
  --dns $POSTGRES_IP \
  -v $CONFIG_DIR/clients.conf:/etc/freeradius/clients.conf:ro \
  -v $CONFIG_DIR/authorize:/etc/freeradius/mods-config/files/authorize:ro \
  -v $CONFIG_DIR/sites-enabled/default:/etc/freeradius/sites-enabled/default:ro \
  -v $CONFIG_DIR/mods-enabled/sql:/etc/freeradius/mods-enabled/sql:ro \
  -p 1812:1812/udp \
  -p 1813:1813/udp \
  --restart unless-stopped \
  freeradius/freeradius-server:latest \
  /bin/sh -c "sed -i 's/server = \"postgres\"/server = \"$POSTGRES_IP\"/' /etc/freeradius/mods-enabled/sql && /docker-entrypoint.sh freeradius -f -l stdout && sleep infinity"

echo "Waiting 10s for container to start..."
sleep 10

echo "Checking logs..."
docker logs $CONTAINER_NAME --tail 20

echo ""
echo "Testing SQL connection from inside container..."
docker exec $CONTAINER_NAME psql -h $POSTGRES_IP -U guestadmin -d guest_wifi -c 'SELECT 1;' 2>&1 | head -5
