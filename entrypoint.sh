#!/usr/bin/env bash
set -euo pipefail
# Start the agent pieces you need
/opt/datadog-agent/bin/agent/agent run -c /etc/datadog-agent &
sleep 5
# 2) Wait until the Agent’s IPC (port 5001) responds to the CLI
for i in {1..120}; do
  if /opt/datadog-agent/bin/agent/agent status >/dev/null 2>&1; then
    echo "[ok] Datadog Agent IPC is up"
    break
  fi
  sleep 1
  if [[ $i -eq 120 ]]; then
    echo "[err] Agent did not come up in time" >&2
    tail -n 100 /var/log/dd-agent.log || true
    exit 1
  fi
done
# Start system-probe (no eBPF programs loaded in this mode; it just brokers events)
# If Datadog’s package expects it:
if command -v /opt/datadog-agent/embedded/bin/system-probe >/dev/null; then
  /opt/datadog-agent/embedded/bin/system-probe &
fi
# Start system-probe (no eBPF programs loaded in this mode; it just brokers events)
# If Datadog’s package expects it:
if command -v /opt/datadog-agent/embedded/bin/security-agent >/dev/null; then
  /opt/datadog-agent/embedded/bin/security-agent start &
fi
# Wrap your app so ptrace can observe it (recommended "wrap" mode)
exec /opt/datadog-agent/embedded/bin/cws-instrumentation trace -- bun run start