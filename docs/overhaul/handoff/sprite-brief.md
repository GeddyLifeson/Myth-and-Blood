# Sprite brief: the champions and the thirteen free companies

For the art agent (js/sprites.js is not touched by the cast pass). One silhouette family per
company; bone, ash and iron bodies as now, with the crest colour used only as a small accent
(a sash, a plume, a shield boss). Crest colours are `CrossoverFactions[key].crest` and
`CHAMPION_FACTION.crest` in js/crossover.js. Nothing here should resemble a character from any
other work: no visors, power armour, spiky hair, masks with logos, capes with emblems.

`UNIT_STYLE` keys `roster_<key>` and `doomslayer_hero` are sprite lookups only (also a
`data-sprite` attribute in js/ux.js:576); no screen prints them. They can be renamed with the
ids later (id-migration.json).

| key (`roster_…`) | company                 | silhouette                                                                                                | headgear                                                                     | weapon                                                             | accent                              |
| ---------------- | ----------------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------ | ----------------------------------- |
| wwe              | Bloodsand Champions     | bare-armed, broad, one shoulder guard, wrapped forearms; no two the same height                           | bare head or leather skull-cap                                               | whatever the pit gave them: maul, spade, banner pole, sling, fists | blood red `#b03028` sash            |
| ultimis          | Powderhorn Company      | stocky, slung satchels and a powder horn on the hip, scorched apron                                       | wide-brimmed soot hat                                                        | clay fuse-pot in the off hand, short hanger                        | burnt orange `#c06030` fuse cord    |
| primis           | The Pale Vigil          | tall plate knight, long tabard to the knee, lantern hung from the belt                                    | flat-topped great helm                                                       | hand-and-a-half sword, kite shield                                 | bone white `#d8d0b8` tabard         |
| halo             | The Greywatch           | heavy coat of plates, tall pavise slung on the back                                                       | kettle helm with a mail aventail                                             | windlass crossbow; the captain a pavise and short sword            | slate `#708090` shield stripe       |
| gears            | Sawtooth Company        | hunched under a plank mantlet, mud to the thigh, stake bundle on the back                                 | padded coif under an iron cap                                                | saw-backed glaive or stirrup crossbow                              | rust brown `#8a5a30` neck-cloth     |
| lotr             | Thornroad Company       | cloaked, travel-worn, pack and bedroll, pilgrim badges on the hood                                        | hood, or a battered sallet for the captain                                   | longbow, wood-axe, quarterstaff, boar spear                        | hedge green `#4a7040` cloak edge    |
| baki             | Knucklebone Lodge       | stripped to the waist, very wide shoulders, string of knucklebones at the belt                            | shaved head, cloth wraps                                                     | none: wrapped fists                                                | bone tan `#b89868` wraps            |
| jojo             | The Marrow Choir        | cassock and surplice, a reliquary box on a neck chain; four are mounted                                   | cowl or choir cap; the headsman fully hooded                                 | censer on a chain, sling, thin blade, lance for the outriders      | violet `#8050a0` stole              |
| fotns            | Order of the Quiet Hand | lean, barefoot, short robe tied at the waist, prayer cord round one arm                                   | tonsure or bare head                                                         | none: open hand                                                    | dusk blue `#506898` cord            |
| dragonball       | Emberblood Warband      | fur mantle, bare chest painted with ash, coal pouch at the hip, faint heat shimmer                        | braids bound with copper wire, no helm                                       | leather sling with a glowing coal, or bare burning hands           | ember orange `#e07030` glow         |
| imperium         | Order of the Iron Psalm | boxy brigandine under a surcoat, psalm book chained to the belt; one carries a bronze bombard on his back | visored bascinet; the levy a plain iron cap                                  | crossbow, flanged mace, tower shield                               | dried-blood red `#802828` surcoat   |
| crystal          | Saltglass Guild         | leather apron and long gauntlets, blowpipe or lens frame carried over the shoulder                        | smoked-glass goggles pushed up on a felt cap                                 | glass-headed bolts, flask of furnace-fire, vaulting lance          | sea-glass teal `#60b0c0` lens glint |
| warp             | Cult of the Open Wound  | ragged robes, bandaged limbs, a red weal painted across the chest                                         | cloth blindfold or bare scarred scalp                                        | hooked knife, bone cup, crossbow with a smouldering quarrel        | wound crimson `#903050` bandage     |
| tes              | Rimehowl Warband        | round shield, heavy fur cloak, frost on the shoulders                                                     | nasal helm with a horsehair crest; the chanter bare-headed with a long beard | bearded axe, seax, carved chanting staff                           | ice blue `#4068a0` shield rim       |

Individuals who should read differently from their company at a glance:

- Big Oddo of Cragfoot (`andre_giant`): half again the height of the other champions.
- Old Mother Sedge (`bray_wyatt`): bent, shawled, a pale marsh-light on a pole.
- Brother Halvec (`undertaker`): tall and narrow, a hand-bell in the off hand.
- Tobiah Bronzeback (`dreadnought`): a bell-shaped bronze gun on a back frame, braced on one knee to fire.
- Hulbrand Oxbow (`noble_jorge`): a cart-sized bolt-thrower on one shoulder.
- The four Marrow Choir outriders (`johnny_joestar`, `gyro_zeppeli`, `diego_brando`, `lucy_steel`): mounted; a lance, a flail, two hounds, a banner.
- Corbet Highvault (`dragoon_knight`): mounted, a lance long enough to vault on.
- Morgash Skullhand (`yujiro_hanma`) and Tunn Oxhide (`oliva_biscuit`): the two largest of the lodge.
- Mother Scoria (`beerus`): small, old, wrapped in a scorched blanket; the strongest glow.
