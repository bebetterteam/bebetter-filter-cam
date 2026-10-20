#!/bin/bash
# 💙 Cute Cam launcher — double-click in Finder before a meeting.
# Starts the filter server, opens the meeting-mode window, and starts the OBS Virtual Camera.
# Close this Terminal window (or press Ctrl+C) to stop the server.

cd "$(dirname "$0")" || exit 1

PORT=5173
URL="http://127.0.0.1:$PORT/?clean=1&filter=bluecat"
PROFILE="$HOME/Library/Application Support/CuteCam/chrome"   # own profile → remembers camera permission
LOG="${TMPDIR:-/tmp}/cutecam-server.log"
CHROME="/Applications/Google Chrome.app"
OBS="/Applications/OBS.app"

say_step() { printf "\n\033[1;35m💙 %s\033[0m\n" "$1"; }
fail() { printf "\n\033[1;31m😿 %s\033[0m\n" "$1"; read -rp "กด Enter เพื่อปิด…"; exit 1; }

# Finder-launched scripts may miss Node from nvm/Homebrew — load them if needed
if ! command -v npm >/dev/null; then
  export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  # shellcheck disable=SC1091
  [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
fi

[ -d "$CHROME" ] || fail "ไม่พบ Google Chrome ใน /Applications"
command -v npm >/dev/null || fail "ไม่พบ Node.js/npm — ติดตั้งจาก https://nodejs.org ก่อนนะ"

if [ ! -d node_modules ]; then
  say_step "ติดตั้ง dependencies ครั้งแรก…"
  npm install || fail "npm install ไม่สำเร็จ"
fi

# 1) filter server (reuse if it's already running)
SERVER_PID=""
if curl -sf -o /dev/null "http://127.0.0.1:$PORT/"; then
  say_step "เซิร์ฟเวอร์รันอยู่แล้ว ใช้ตัวเดิม"
else
  say_step "เปิดเซิร์ฟเวอร์ฟิลเตอร์…"
  npm run dev >"$LOG" 2>&1 &
  SERVER_PID=$!
  for _ in $(seq 1 60); do
    curl -sf -o /dev/null "http://127.0.0.1:$PORT/" && break
    kill -0 "$SERVER_PID" 2>/dev/null || fail "เซิร์ฟเวอร์เปิดไม่ขึ้น ดู log: $LOG"
    sleep 0.5
  done
  curl -sf -o /dev/null "http://127.0.0.1:$PORT/" || fail "เซิร์ฟเวอร์ไม่ตอบภายใน 30 วิ ดู log: $LOG"
fi

cleanup() {
  if [ -n "$SERVER_PID" ]; then
    kill "$SERVER_PID" 2>/dev/null
    pkill -P "$SERVER_PID" 2>/dev/null
  fi
}
trap cleanup EXIT INT TERM HUP

# 2) meeting-mode window (separate Chrome instance; flags keep it rendering when covered)
say_step "เปิดหน้าต่างแมวฟ้า…"
mkdir -p "$PROFILE"
open -na "$CHROME" --args \
  --app="$URL" \
  --user-data-dir="$PROFILE" \
  --window-size=1280,760 \
  --disable-backgrounding-occluded-windows \
  --disable-renderer-backgrounding \
  --disable-background-timer-throttling

# 3) OBS + virtual camera
if [ -d "$OBS" ]; then
  if pgrep -iqx obs; then
    say_step "OBS เปิดอยู่แล้ว — ถ้ายังไม่ได้กด Start Virtual Camera ให้กดใน OBS นะ"
  else
    say_step "เปิด OBS + Start Virtual Camera…"
    open -a "$OBS" --args --startvirtualcam --minimize-to-tray
  fi
else
  printf "\n\033[1;33m⚠️  ยังไม่ได้ติดตั้ง OBS — โหลดฟรีที่ https://obsproject.com แล้วตั้งค่าครั้งแรกตาม README\033[0m\n"
fi

printf "\n\033[1;32m✅ พร้อมแล้ว! ใน Discord/Teams เลือกกล้อง \"OBS Virtual Camera\"\033[0m\n"
printf "   ปิดหน้าต่าง Terminal นี้ (หรือกด Ctrl+C) เมื่อประชุมเสร็จ\n"

if [ -n "$SERVER_PID" ]; then
  wait "$SERVER_PID"
else
  read -rp "กด Enter เพื่อปิด…"
fi
