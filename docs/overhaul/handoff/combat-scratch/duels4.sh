#!/bin/sh
F10='{"hp":138,"dmg":32,"acc":39,"xp":16,"mor":26}'; F20='{"hp":163,"dmg":42,"acc":43,"xp":27,"mor":37}'
for w in 10 20; do
  eval F=\$F$w
  node duel.mjs "{\"label\":\"1v1 fresh footman v orc (no rout)\",\"wave\":$w,\"players\":[{\"type\":\"footman\"}],\"enemies\":[\"orc\"],\"trials\":10,\"patches\":[\"noEnemyRout\",\"noPlayerRout\"]}"
  node duel.mjs "{\"label\":\"1v1 vet footman v orc (no rout)\",\"wave\":$w,\"players\":[{\"type\":\"footman\",\"line\":$F}],\"enemies\":[\"orc\"],\"trials\":10,\"patches\":[\"noEnemyRout\",\"noPlayerRout\"]}"
done
