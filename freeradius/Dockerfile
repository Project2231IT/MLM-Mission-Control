FROM freeradius/freeradius-server:latest

# Fix the SQL config to use IP instead of hostname "postgres"
RUN sed -i 's/server = "postgres"/server = "10.200.5.2"/' /etc/freeradius/mods-enabled/sql

# Copy our custom config (overrides whatever was in the image)
COPY clients.conf /etc/freeradius/clients.conf
COPY authorize /etc/freeradius/mods-config/files/authorize
COPY default /etc/freeradius/sites-enabled/default
RUN sed -i 's/server = "postgres"/server = "10.200.5.2"/' /etc/freeradius/mods-enabled/sql

# Ensure PostgreSQL client is available
RUN apt-get update && apt-get install -y postgresql-client && rm -rf /var/lib/apt/lists/*

EXPOSE 1812/udp 1813/udp

CMD ["/bin/sh", "-c", "/docker-entrypoint.sh freeradius -f -l stdout && sleep infinity"]
