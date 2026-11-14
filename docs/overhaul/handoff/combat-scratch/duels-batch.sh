#!/bin/sh
# Fresh vs veteran skirmishes. Veteran lines: oldest footman (Normal seed 4262) and a low-kill oldest archer (Baby seed 4000).
F5='{"hp":127,"dmg":27,"acc":36,"xp":11,"mor":20}';  A5='{"hp":70,"dmg":34,"acc":42,"xp":18,"mor":12,"range":223}'
F10='{"hp":138,"dmg":32,"acc":39,"xp":16,"mor":26}'; A10='{"hp":89,"dmg":48,"acc":48,"xp":39,"mor":12,"range":250}'
F15='{"hp":149,"dmg":37,"acc":41,"xp":22,"mor":31}'; A15='{"hp":100,"dmg":56,"acc":51,"xp":52,"mor":12,"range":274}'
F20='{"hp":163,"dmg":42,"acc":43,"xp":27,"mor":37}'; A20='{"hp":109,"dmg":64,"acc":53,"xp":77,"mor":12,"range":292}'
MIX='"orc","orc","orc","orc","goblin","goblin","orc_archer","orc_archer","berserker","dark_knight"'
for w in 5 10 15 20; do
  eval F=\$F$w; eval A=\$A$w
  node duel.mjs "{\"label\":\"1v1 fresh footman v orc (no rout)\",\"wave\":$w,\"players\":[{\"type\":\"footman\"}],\"enemies\":[\"orc\"],\"trials\":20,\"patches\":[\"noEnemyRout\",\"noPlayerRout\"]}"
  node duel.mjs "{\"label\":\"1v1 vet footman v orc (no rout)\",\"wave\":$w,\"players\":[{\"type\":\"footman\",\"line\":$F}],\"enemies\":[\"orc\"],\"trials\":20,\"patches\":[\"noEnemyRout\",\"noPlayerRout\"]}"
  node duel.mjs "{\"label\":\"1v1 fresh archer v orc (no rout)\",\"wave\":$w,\"players\":[{\"type\":\"archer\"}],\"enemies\":[\"orc\"],\"trials\":20,\"patches\":[\"noEnemyRout\",\"noPlayerRout\"]}"
  node duel.mjs "{\"label\":\"1v1 vet archer v orc (no rout)\",\"wave\":$w,\"players\":[{\"type\":\"archer\",\"line\":$A}],\"enemies\":[\"orc\"],\"trials\":20,\"patches\":[\"noEnemyRout\",\"noPlayerRout\"]}"
  PF="{\"type\":\"footman\"},{\"type\":\"footman\"},{\"type\":\"footman\"},{\"type\":\"footman\"},{\"type\":\"footman\"},{\"type\":\"footman\"},{\"type\":\"archer\"},{\"type\":\"archer\"},{\"type\":\"archer\"},{\"type\":\"archer\"}"
  PV="{\"type\":\"footman\",\"line\":$F},{\"type\":\"footman\",\"line\":$F},{\"type\":\"footman\",\"line\":$F},{\"type\":\"footman\",\"line\":$F},{\"type\":\"footman\",\"line\":$F},{\"type\":\"footman\",\"line\":$F},{\"type\":\"archer\",\"line\":$A},{\"type\":\"archer\",\"line\":$A},{\"type\":\"archer\",\"line\":$A},{\"type\":\"archer\",\"line\":$A}"
  node duel.mjs "{\"label\":\"10v10 fresh (live rules)\",\"wave\":$w,\"players\":[$PF],\"enemies\":[$MIX],\"trials\":12}"
  node duel.mjs "{\"label\":\"10v10 fresh (enemy never routs)\",\"wave\":$w,\"players\":[$PF],\"enemies\":[$MIX],\"trials\":12,\"patches\":[\"noEnemyRout\"]}"
  node duel.mjs "{\"label\":\"10v10 vet (live rules)\",\"wave\":$w,\"players\":[$PV],\"enemies\":[$MIX],\"trials\":12}"
  node duel.mjs "{\"label\":\"10v10 vet (enemy never routs)\",\"wave\":$w,\"players\":[$PV],\"enemies\":[$MIX],\"trials\":12,\"patches\":[\"noEnemyRout\"]}"
  node duel.mjs "{\"label\":\"10 vet v 20 (enemy never routs)\",\"wave\":$w,\"players\":[$PV],\"enemies\":[$MIX,$MIX],\"trials\":12,\"patches\":[\"noEnemyRout\"]}"
  node duel.mjs "{\"label\":\"10 vet v 30 (enemy never routs)\",\"wave\":$w,\"players\":[$PV],\"enemies\":[$MIX,$MIX,$MIX],\"trials\":12,\"patches\":[\"noEnemyRout\"]}"
  node duel.mjs "{\"label\":\"10 fresh v 20 (enemy never routs)\",\"wave\":$w,\"players\":[$PF],\"enemies\":[$MIX,$MIX],\"trials\":12,\"patches\":[\"noEnemyRout\"]}"
done
