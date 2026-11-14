#!/bin/sh
F10='{"hp":138,"dmg":32,"acc":39,"xp":16,"mor":26}'; A10='{"hp":89,"dmg":48,"acc":48,"xp":39,"mor":12,"range":250}'
F20='{"hp":163,"dmg":42,"acc":43,"xp":27,"mor":37}'; A20='{"hp":109,"dmg":64,"acc":53,"xp":77,"mor":12,"range":292}'
MIX='"orc","orc","orc","orc","goblin","goblin","orc_archer","orc_archer","berserker","dark_knight"'
for w in 10 20; do
  eval F=\$F$w; eval A=\$A$w
  PF="{\"type\":\"footman\"},{\"type\":\"footman\"},{\"type\":\"footman\"},{\"type\":\"footman\"},{\"type\":\"footman\"},{\"type\":\"footman\"},{\"type\":\"archer\"},{\"type\":\"archer\"},{\"type\":\"archer\"},{\"type\":\"archer\"}"
  PV="{\"type\":\"footman\",\"line\":$F},{\"type\":\"footman\",\"line\":$F},{\"type\":\"footman\",\"line\":$F},{\"type\":\"footman\",\"line\":$F},{\"type\":\"footman\",\"line\":$F},{\"type\":\"footman\",\"line\":$F},{\"type\":\"archer\",\"line\":$A},{\"type\":\"archer\",\"line\":$A},{\"type\":\"archer\",\"line\":$A},{\"type\":\"archer\",\"line\":$A}"
  node duel.mjs "{\"label\":\"10v10 vet (live rules)\",\"wave\":$w,\"players\":[$PV],\"enemies\":[$MIX],\"trials\":5}"
  node duel.mjs "{\"label\":\"10v10 fresh (live rules)\",\"wave\":$w,\"players\":[$PF],\"enemies\":[$MIX],\"trials\":5}"
  node duel.mjs "{\"label\":\"10v10 vet (enemy never routs)\",\"wave\":$w,\"players\":[$PV],\"enemies\":[$MIX],\"trials\":5,\"patches\":[\"noEnemyRout\"]}"
  node duel.mjs "{\"label\":\"10v10 fresh (enemy never routs)\",\"wave\":$w,\"players\":[$PF],\"enemies\":[$MIX],\"trials\":5,\"patches\":[\"noEnemyRout\"]}"
done
