#!/bin/bash
# Bash script to start Cloudflare Quick Tunnel (no auth required)
# This is the easiest way to get a public URL for local development
# The URL changes each time you restart the tunnel

echo "Starting Cloudflare Quick Tunnel for Agent Service (port 4002)..."
echo ""
echo "This will create a temporary public URL that forwards to localhost:4002"
echo "The URL will be displayed below. Copy it and use it in LiveKit webhook configuration."
echo ""
echo "Webhook endpoint format: https://<tunnel-url>/api/call-recordings/egress-webhook"
echo ""
echo "Press Ctrl+C to stop the tunnel"
echo ""

# Start quick tunnel (no authentication required)
cloudflared tunnel --url http://localhost:4002


