#!/bin/bash
# Quick test script to verify webhook endpoint is accessible

TUNNEL_URL="${1:-https://integrate-amendments-bias-winner.trycloudflare.com}"

echo "Testing webhook endpoint: ${TUNNEL_URL}/api/call-recordings/egress-webhook"
echo ""

# Test 1: Health check
echo "1. Testing health endpoint..."
HEALTH_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "${TUNNEL_URL}/health")
if [ "$HEALTH_RESPONSE" = "200" ]; then
  echo "✅ Health check passed (200)"
else
  echo "❌ Health check failed (${HEALTH_RESPONSE})"
fi
echo ""

# Test 2: Webhook endpoint (should return 401 - unauthorized)
echo "2. Testing webhook endpoint (should return 401 - unauthorized)..."
WEBHOOK_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "${TUNNEL_URL}/api/call-recordings/egress-webhook" \
  -H "Content-Type: application/webhook+json" \
  -H "Authorization: Bearer invalid-token" \
  -d '{"test": "data"}')

if [ "$WEBHOOK_RESPONSE" = "401" ]; then
  echo "✅ Webhook endpoint is accessible and verifying signatures (401 = unauthorized, which is expected)"
else
  echo "⚠️  Webhook endpoint returned ${WEBHOOK_RESPONSE} (expected 401)"
fi
echo ""

echo "If both tests passed, your tunnel is working correctly!"
echo "Next: Configure the webhook URL in LiveKit dashboard and start a test call."

