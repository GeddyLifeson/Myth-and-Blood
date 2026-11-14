#!/bin/sh
# wait for earlier queue, then run a job file: name|args
while pgrep -f "xargs -P2" >/dev/null; do sleep 5; done
cat "$1" | xargs -P2 -I{} sh -c 'n=$(echo "{}" | cut -d"|" -f1); a=$(echo "{}" | cut -d"|" -f2); node bot.mjs $a > out/$n.json 2>&1'
