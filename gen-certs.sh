#!/bin/bash

# Create directory for certificates if it doesn't exist
mkdir -p certs

# Generate private key
openssl genrsa -out certs/dev-key.pem 2048

# Generate certificate signing request
openssl req -new -key certs/dev-key.pem -out certs/dev-csr.pem -subj "/CN=localhost/O=Development/C=US"

# Generate self-signed certificate (valid for 365 days)
openssl x509 -req -days 365 -in certs/dev-csr.pem -signkey certs/dev-key.pem -out certs/dev-cert.pem

# Remove CSR as it's no longer needed
rm certs/dev-csr.pem

# Set permissions
chmod 600 certs/dev-key.pem
chmod 644 certs/dev-cert.pem

echo "Self-signed certificates generated successfully!"
echo "- Certificate: certs/dev-cert.pem"
echo "- Private Key: certs/dev-key.pem"
echo ""
echo "Remember to add these certificates to your browser/system trust store for development use."
echo "This is a development-only certificate and should not be used in production." 