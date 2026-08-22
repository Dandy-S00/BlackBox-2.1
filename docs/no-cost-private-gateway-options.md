# No-Cost Private Gateway Options

## Recommended default: Tailscale Personal + self-hosted operator gateway

Use the zero-cost Tailscale Personal plan to create a private mesh between the Android device and an operator-controlled Linux host. Tailscale’s published Personal plan is free and supports up to six users, unlimited user devices, three ACL groups, and fifty tagged resources. The gateway remains reachable only on the private mesh; do not expose analyzer, database, executor, or tool ports to the public internet.

The operator host must still run the gateway service, expose only authenticated `/v1/health` and approved `/v1/jobs` routes, validate schema and bearer authentication, and preserve independent HMAC, target-scope, allowed-module, and idempotency enforcement. Enter the private HTTPS endpoint and operator token through the app’s named gateway-profile form only after the health response is available.

## Alternative: Cloudflare Tunnel edge for a self-hosted gateway

Cloudflare Tunnel can provide an outbound-only connector from the operator host, avoiding an inbound public IP or router port-forwarding. It is suitable only when an authenticated access policy is configured and only the gateway’s fixed routes are published. It is not a substitute for the gateway service, executor policy, or module tooling, and it should never be used to publish underlying analyzer ports.

## Alternative: Caddy on an operator-controlled host

Caddy is a self-hosted reverse proxy that can obtain HTTPS certificates automatically when it has a valid hostname and public DNS/port routing. Use it only as an HTTPS edge in front of the gateway service and restrict routing to the gateway’s health and approved-job endpoints. This option requires an operator-controlled host, domain, DNS, and inbound edge configuration; it does not create a free hosted gateway.

## Sources

1. Cloudflare Tunnel documentation: https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/
2. Tailscale pricing: https://tailscale.com/pricing
3. Caddy reverse-proxy quick-start: https://caddyserver.com/docs/quick-starts/reverse-proxy
