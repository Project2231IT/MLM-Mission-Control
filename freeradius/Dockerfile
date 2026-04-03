FROM freeradius/freeradius-server:latest

# Copy our custom config
COPY clients.conf /etc/freeradius/clients.conf
COPY authorize /etc/freeradius/mods-config/files/authorize
COPY default /etc/freeradius/sites-enabled/default

EXPOSE 1812/udp 1813/udp

CMD ["freeradius", "-f"]
