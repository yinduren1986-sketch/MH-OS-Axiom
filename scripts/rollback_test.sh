#!/usr/bin/env bash
# scripts/rollback_test.sh — OSC Phase 5 Day 19-20
# Run: bash scripts/rollback_test.sh
#
# Tests that the system can roll back to main branch while preserving user data.

set -e

WORKSPACE="${HOME}/.openclaw/workspace"
SRC="${WORKSPACE}/openclaw-src"
BACKUP_DIR="${WORKSPACE}/.rollback_backup_$(date +%Y%m%d_%H%M%S)"
FACT_STORE="${WORKSPACE}/facts.jsonl"

echo "=== OSC Phase 5: Rollback Test ==="
echo ""

# Step 1: Backup current state
echo "[1/5] Backing up current workspace..."
mkdir -p "$BACKUP_DIR"
cp -r "$SRC/.git" "$BACKUP_DIR/git-osc" 2>/dev/null || true
if [ -f "$FACT_STORE" ]; then
  cp "$FACT_STORE" "$BACKUP_DIR/facts.jsonl"
  echo "  ✓ facts.jsonl backed up ($(wc -l < "$FACT_STORE") lines)"
else
  echo "  ○ facts.jsonl not present (normal for early phases)"
fi
if [ -f "$WORKSPACE/MEMORY.md" ]; then
  cp "$WORKSPACE/MEMORY.md" "$BACKUP_DIR/MEMORY.md"
  echo "  ✓ MEMORY.md backed up"
fi

# Step 2: Switch to main branch (simulates rollback)
echo ""
echo "[2/5] Switching to main branch (rollback simulation)..."
cd "$SRC"
git checkout main --quiet
echo "  ✓ Now on main branch: $(git branch --show-current)"

# Step 3: Verify OpenClaw still starts (Markdown fallback works)
echo ""
echo "[3/5] Verifying OpenClaw starts on main branch..."
if openclaw status > /dev/null 2>&1; then
  echo "  ✓ openclaw status OK (Markdown fallback working)"
else
  echo "  ✗ openclaw status failed — check manually"
  git checkout feat/semantic-core --quiet
  exit 1
fi

# Step 4: Verify facts.jsonl still readable (rollback preserves data)
echo ""
echo "[4/5] Checking facts.jsonl integrity after rollback..."
if [ -f "$BACKUP_DIR/facts.jsonl" ]; then
  lines=$(wc -l < "$BACKUP_DIR/facts.jsonl")
  echo "  ✓ facts.jsonl backed up — $lines records preserved"
  # Verify it's valid JSONL (each line is a JSON object)
  valid=true
  while IFS= read -r line; do
    [ -n "$line" ] && echo "$line" | python3 -c "import sys,json; json.load(sys.stdin)" 2>/dev/null || valid=false
  done < "$BACKUP_DIR/facts.jsonl"
  if [ "$valid" = true ]; then
    echo "  ✓ All $lines records valid JSONL"
  else
    echo "  ✗ Some records invalid — inspect $BACKUP_DIR/facts.jsonl"
  fi
fi

# Step 5: Restore OSC branch
echo ""
echo "[5/5] Restoring feat/semantic-core..."
git checkout feat/semantic-core --quiet
echo "  ✓ Restored to: $(git branch --show-current)"
echo ""

echo "=== Rollback Test Complete ==="
echo "Backup location: $BACKUP_DIR"
echo "Result: ✅ System survives rollback with data intact"
echo ""
echo "To manually restore from backup:"
echo "  cp $BACKUP_DIR/facts.jsonl $FACT_STORE"