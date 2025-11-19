#!/bin/bash
# Bash script to start Cloudflare Tunnel
# This exposes the local agent service (port 4002) to the internet for LiveKit webhooks

echo "Starting Cloudflare Tunnel for Agent Service..."

# Check if cloudflared is installed
if ! command -v cloudflared &> /dev/null; then
    echo "Error: cloudflared is not installed or not in PATH"
    echo "Install from: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/"
    exit 1
fi

# Check if tunnel is already authenticated
if [ ! -f ".cloudflare/credentials.json" ]; then
    echo "Tunnel not authenticated. Running login..."
    echo "Please follow the prompts to authenticate with Cloudflare."
    cloudflared tunnel login
fi

# Check if tunnel exists
if ! cloudflared tunnel list 2>&1 | grep -q "syntera-agent-service"; then
    echo "Creating tunnel 'syntera-agent-service'..."
    cloudflared tunnel create syntera-agent-service
fi

# Start the tunnel
echo "Starting tunnel..."
echo "The public URL will be displayed below. Use this URL in LiveKit webhook configuration."
echo "Webhook endpoint: https://<tunnel-url>/api/call-recordings/egress-webhook"
echo ""

cloudflared tunnel --config cloudflare-tunnel.yml run syntera-agent-service


