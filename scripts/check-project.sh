#!/usr/bin/env bash

set -u

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

ERRORS=0
WARNINGS=0

ok() {
  printf '  [OK]    %s\n' "$1"
}

error() {
  printf '  [ERROR] %s\n' "$1"
  ERRORS=$((ERRORS + 1))
}

warn() {
  printf '  [WARN]  %s\n' "$1"
  WARNINGS=$((WARNINGS + 1))
}

check_file() {
  if [ -f "$1" ]; then
    ok "文件存在: $1"
  else
    error "缺少文件: $1"
  fi
}

check_dir() {
  if [ -d "$1" ]; then
    ok "目录存在: $1"
  else
    error "缺少目录: $1"
  fi
}

check_json_field() {
  local file="$1"
  local field="$2"

  if [ ! -f "$file" ]; then
    error "$file 不存在，无法检查 $field"
    return
  fi

  if node -e "
    const fs = require('fs');
    const data = JSON.parse(fs.readFileSync('$file', 'utf8'));
    const parts = '$field'.split('.');
    let value = data;

    for (const part of parts) {
      if (value == null || !(part in value)) {
        process.exit(1);
      }
      value = value[part];
    }
  " 2>/dev/null; then
    ok "$file 包含字段: $field"
  else
    error "$file 缺少字段: $field"
  fi
}

check_package_script() {
  local file="$1"
  local script="$2"

  if [ ! -f "$file" ]; then
    error "$file 不存在，无法检查 script.$script"
    return
  fi

  if node -e "
    const fs = require('fs');
    const data = JSON.parse(fs.readFileSync('$file', 'utf8'));
    process.exit(data.scripts && data.scripts['$script'] ? 0 : 1);
  " 2>/dev/null; then
    ok "$file 存在 script: $script"
  else
    error "$file 缺少 script: $script"
  fi
}

check_tsconfig_reference() {
  local file="$1"
  local reference="$2"

  if node -e "
    const fs = require('fs');
    const data = JSON.parse(fs.readFileSync('$file', 'utf8'));

    const references = data.references || [];

    process.exit(
      references.some(item => item.path === '$reference')
        ? 0
        : 1
    );
  " 2>/dev/null; then
    ok "$file 包含 reference: $reference"
  else
    error "$file 缺少 reference: $reference"
  fi
}

echo
echo "========================================"
echo " UniDock Project Configuration Check"
echo "========================================"
echo

echo "[1] Root files"

check_file "package.json"
check_file "pnpm-workspace.yaml"
check_file "tsconfig.base.json"
check_file "tsconfig.json"

echo
echo "[2] Workspace packages"

for package in kernel content storage sdk; do
  check_dir "packages/$package"
  check_file "packages/$package/package.json"
  check_file "packages/$package/tsconfig.json"
  check_file "packages/$package/src/index.ts"
done

echo
echo "[3] Root package.json"

check_json_field "package.json" "scripts"
check_json_field "package.json" "scripts.build"
check_json_field "package.json" "scripts.typecheck"

echo
echo "[4] Package scripts"

for package in kernel content storage sdk; do
  FILE="packages/$package/package.json"

  check_package_script "$FILE" "build"
  check_package_script "$FILE" "typecheck"
done

echo
echo "[5] SDK dependencies"

check_json_field "packages/sdk/package.json" "dependencies.@unidock/kernel"
check_json_field "packages/sdk/package.json" "dependencies.@unidock/content"
check_json_field "packages/sdk/package.json" "dependencies.@unidock/storage"

echo
echo "[6] TypeScript references"

check_tsconfig_reference "packages/sdk/tsconfig.json" "../kernel"
check_tsconfig_reference "packages/sdk/tsconfig.json" "../content"
check_tsconfig_reference "packages/sdk/tsconfig.json" "../storage"

echo
echo "[7] TypeScript"

if command -v pnpm >/dev/null 2>&1; then
  ok "pnpm 可用"
else
  error "pnpm 不可用"
fi

if pnpm exec tsc --version >/dev/null 2>&1; then
  ok "TypeScript 可用: $(pnpm exec tsc --version)"
else
  error "TypeScript 不可用"
fi

echo
echo "[8] Workspace"

if pnpm list --depth 0 -r >/dev/null 2>&1; then
  ok "pnpm workspace 可正常读取"
else
  error "pnpm workspace 读取失败"
fi

echo
echo "========================================"

if [ "$ERRORS" -eq 0 ]; then
  printf 'RESULT: PASS'

  if [ "$WARNINGS" -gt 0 ]; then
    printf ' (%s warnings)' "$WARNINGS"
  fi

  printf '\n'
else
  printf 'RESULT: FAIL (%s errors' "$ERRORS"

  if [ "$WARNINGS" -gt 0 ]; then
    printf ', %s warnings' "$WARNINGS"
  fi

  printf ')\n'
fi

echo "========================================"
echo

if [ "$ERRORS" -gt 0 ]; then
  exit 1
fi
