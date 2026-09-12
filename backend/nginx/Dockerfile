FROM nginx:latest

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /etc/ssl/certs /etc/ssl/private

# Self-signed certificate — replace with a real one (e.g. via certbot) for a
# public-facing deployment. Fine for a LAN-only supervision tool in the
# meantime, same as the reference MPPT platform's approach.
RUN openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -subj "/C=CA/ST=QC/L=City/O=OrangeTraffic/CN=orange-traffic" \
  -keyout /etc/ssl/private/selfsigned.key \
  -out /etc/ssl/certs/selfsigned.crt

COPY backend/nginx/default.conf /etc/nginx/conf.d/default.conf

EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]
