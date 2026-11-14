#!/bin/sh
while [ ! -s out/cf-noHealerRank-4131.json ]; do sleep 10; done
while pgrep -f "xargs -P2" >/dev/null; do sleep 5; done
cat "$1" | xargs -P2 -I{} sh -c 'n=$(echo "{}" | cut -d"|" -f1); a=$(echo "{}" | cut -d"|" -f2); node bot.mjs $a > out/$n.json 2>&1'
