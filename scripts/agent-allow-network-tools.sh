#!/usr/bin/env bash
#
# agent-allow-network-tools.sh
#
# 把 Near-RT RIC Validation Agent 的 .claude/settings.json 換掉，加入
# 網路 / SSH / kubectl / 抓包 等驗測常用 bash 指令的允許清單。
#
# 為什麼這份要使用者自己跑：Claude Code 的安全閘擋了 AI 自己改
# .claude/settings.json（防 self-modify 提權）—— 合理保守。改完
# script 會順手提示要不要 commit + push。
#
# 用法：
#   bash scripts/agent-allow-network-tools.sh
#

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SETTINGS="$REPO_ROOT/near-rt-ric-validation-agent/.claude/settings.json"

if [[ ! -f "$SETTINGS" ]]; then
  echo "✗ 找不到 $SETTINGS"
  echo "  確認 near-rt-ric-validation-agent submodule 有 init："
  echo "    git submodule update --init near-rt-ric-validation-agent"
  exit 1
fi

echo "─── 備份舊 settings ───"
cp "$SETTINGS" "$SETTINGS.bak.$(date +%s)"
ls -la "$SETTINGS"*

echo
echo "─── 寫入新 allow list ───"
cat > "$SETTINGS" <<'JSON'
{
  "permissions": {
    "allow": [
      "Read", "Write", "Edit", "Glob", "Grep",

      "Bash(mkdir:*)", "Bash(cp:*)", "Bash(mv:*)", "Bash(sed:*)",
      "Bash(ls:*)", "Bash(cat:*)", "Bash(find:*)", "Bash(grep:*)",
      "Bash(jq:*)", "Bash(python3:*)", "Bash(awk:*)", "Bash(tail:*)",
      "Bash(head:*)", "Bash(wc:*)", "Bash(sort:*)", "Bash(uniq:*)",
      "Bash(tr:*)", "Bash(xxd:*)", "Bash(date:*)", "Bash(echo:*)",
      "Bash(printf:*)",

      "Bash(ping:*)", "Bash(traceroute:*)", "Bash(curl:*)", "Bash(wget:*)",
      "Bash(nc:*)", "Bash(ncat:*)", "Bash(nmap:*)", "Bash(dig:*)",
      "Bash(host:*)", "Bash(ss:*)", "Bash(netstat:*)", "Bash(ip:*)",

      "Bash(sctp_test:*)", "Bash(sctp_darn:*)",

      "Bash(ssh:*)", "Bash(scp:*)", "Bash(sshpass:*)",

      "Bash(kubectl:*)", "Bash(helm:*)", "Bash(docker:*)",

      "Bash(tshark:*)", "Bash(tcpdump:*)", "Bash(capinfos:*)"
    ]
  }
}
JSON

echo "  ✓ wrote $SETTINGS"

echo
echo "─── 驗證是合法 JSON ───"
if command -v jq >/dev/null 2>&1; then
  jq . "$SETTINGS" > /dev/null && echo "  ✓ JSON valid (jq parsed)"
else
  python3 -c "import json; json.load(open('$SETTINGS'))" && echo "  ✓ JSON valid (python parsed)"
fi

echo
echo "─── 重啟 agent backend 讓 Claude CLI 重新讀 settings ───"
if docker ps --format '{{.Names}}' | grep -q '^near_rt_ric_validation_agent-backend$'; then
  docker restart near_rt_ric_validation_agent-backend > /dev/null
  echo "  ✓ near_rt_ric_validation_agent-backend restarted"
else
  echo "  ⚠️  near_rt_ric_validation_agent-backend 沒在跑，略過 restart"
fi

echo
echo "─── 下一步：要 commit + push 嗎？ ───"
echo
echo "  cd near-rt-ric-validation-agent"
echo "  git diff .claude/settings.json"
echo "  git add .claude/settings.json"
echo "  git commit -m 'feat(claude): allow network / ssh / kubectl tools'"
echo "  git push"
echo
echo "  # 然後回主 repo bump submodule pointer"
echo "  cd .."
echo "  git add near-rt-ric-validation-agent"
echo "  git commit -m 'chore: bump agent submodule (allow network tools)'"
echo "  git push"
echo
echo "完工。"
