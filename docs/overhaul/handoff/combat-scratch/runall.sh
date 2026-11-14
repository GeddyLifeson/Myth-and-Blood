#!/bin/sh
cat "$1" | xargs -P3 -I{} sh -c 'n=$(echo "{}" | cut -d"|" -f1); a=$(echo "{}" | cut -d"|" -f2); $a > out/$n.json 2>&1'
