/**
 * Roster ids renamed in November 2026 (old id -> current id). Saves and stored profiles made
 * by older builds are moved onto the current ids here; no other code may use the old ids.
 * Loaded right after save-registry.js, before any module reads its own store.
 */
const RenamedIds = (() => {
  const TABLE = {
    unit: {
      stone_cold: 'hadrek_quarryborn',
      the_rock: 'osmar_tallgrave',
      ric_flair: 'lord_corvane_ashgilt',
      hulk_hogan: 'brunhal_oxmantle',
      macho_man: 'jorun_kestrelhand',
      sting: 'maldrick_sootgate',
      john_cena: 'alder_wynfast',
      bautista: 'gorvan_hullbreaker',
      roman_reigns: 'ulvar_deepmoor',
      shawn_michaels: 'sennet_quickheel',
      bret_hart: 'hestor_grindlaw',
      undertaker: 'brother_halvec',
      kane: 'varn_thistlehide',
      andre_giant: 'big_oddo_of_cragfoot',
      razor_ramon: 'ilvane_whetstone',
      kevin_nash: 'durgan_beamshoulder',
      roddy_piper: 'fenrick_barbtongue',
      hacksaw_duggan: 'old_garth_bannerpole',
      junkyard_dog: 'brask_ironbrow',
      rey_mysterio: 'pip_wrenfall',
      eddie_guerrero: 'jessom_magpie',
      chris_benoit: 'orrin_clampjaw',
      oba_femi: 'tharn_ringholder',
      brock_lesnar: 'gundrek_oxblood',
      cm_punk: 'kerrin_ashvow',
      seth_rollins: 'merrow_slingstone',
      sheamus: 'hulder_rustbeard',
      bray_wyatt: 'old_mother_sedge',
      randy_orton: 'hallec_stillwater',
      tank_dempsey: 'dunmar_fusewick',
      richtofen: 'aldous_verdigris',
      nikolai: 'otmar_caskwright',
      takeo: 'isen_quillon',
      primis_tank: 'ser_wulmar_dray',
      primis_nikolai: 'ser_hadwin_morrow',
      primis_takeo: 'dame_ysolt_kerne',
      primis_richtofen: 'brother_odrin_wick',
      master_chief: 'torvald_greyhame',
      noble_six: 'ashka_lonefell',
      sgt_johnson: 'bertram_hobnail',
      noble_carter: 'emric_dawnhollow',
      noble_kat: 'kesta_wirewright',
      noble_emile: 'rask_notchblade',
      noble_jorge: 'hulbrand_oxbow',
      noble_jun: 'jessa_stillbreath',
      spartan_soldier: 'greywatch_arbalester',
      marcus_fenix: 'hale_brandreth',
      dom_santiago: 'derrow_fenn',
      damon_baird: 'pell_rivetson',
      augustus_cole: 'jorram_brakeless',
      anthony_carmine: 'tam_nockley',
      clayton_carmine: 'garrow_twinstring',
      benjamin_carmine: 'odo_perch',
      cog_soldier: 'sawtooth_pavisier',
      aragorn: 'halvard_roadwarden',
      legolas: 'wenna_marshbow',
      gimli: 'dorn_quarrykin',
      gandalf: 'father_tolland',
      frodo: 'nib_thimblewick',
      boromir: 'gerent_gatesby',
      eowyn: 'marta_hobblethorn',
      baki_hanma: 'kell_splitlip',
      yujiro_hanma: 'morgash_skullhand',
      doppo_orochi: 'hesk_hardpalm',
      jack_hanma: 'grudd_filetooth',
      oliva_biscuit: 'tunn_oxhide',
      kaku_kaioh: 'wend_reedhand',
      pickle: 'uggar_no_tongue',
      jonathan_joestar: 'ser_anselm_dawnmere',
      dio_brando_p1: 'veyra_coldcloister',
      zeppeli: 'tiber_wellspring',
      joseph_joestar_p2: 'dallow_tripwire',
      caesar_zeppeli: 'cael_slingsong',
      stroheim: 'gaunt_ironrib',
      jotaro_kujo: 'corvin_stonepsalm',
      kakyoin: 'neve_shardglass',
      polnareff: 'aubrin_needlepoint',
      avdol: 'hesper_brazier',
      josuke_higashikata: 'brother_linden_salve',
      okuyasu: 'dunnock_heavyhand',
      rohan_kishibe: 'sister_quillane',
      kira_yoshikage: 'hollis_greyglove',
      giorno_giovanna: 'aurel_thornbloom',
      bruno_bucciarati: 'marrec_tallcandle',
      guido_mista: 'tobble_skipstone',
      diavolo: 'serrec_hoodwell',
      jolyne_cujoh: 'wren_catgut',
      weather_report: 'harrow_cloudcall',
      ermes_costello: 'brannet_doublet',
      johnny_joestar: 'ilsa_longspur',
      gyro_zeppeli: 'garrin_flailwheel',
      diego_brando: 'hask_wolfsaddle',
      lucy_steel: 'pella_ribbonmane',
      kenshiro: 'sevrin_palmquiet',
      raoh: 'gorhame_the_unbowed',
      toki: 'ellit_softpalm',
      rei: 'sorrel_scytheheel',
      jaggi: 'lorn_spitgravel',
      shin: 'castrel_spearhand',
      goku: 'tavish_coalheart',
      vegeta: 'raddoc_proudflame',
      piccolo: 'varrow_cindersight',
      gohan: 'emmet_kindling',
      trunks: 'isk_farflame',
      frieza: 'selka_whiteash',
      cell: 'gulch_the_glutton',
      beerus: 'mother_scoria',
      chapter_captain: 'ivo_harrowgate',
      chaplain: 'brother_malloch',
      librarian: 'sister_ottoline_reed',
      commissar: 'provost_kerrick',
      guardsman: 'iron_psalm_levy',
      terminator: 'brother_hulm',
      dreadnought: 'tobiah_bronzeback',
      soldier_of_light: 'davin_glasswright',
      black_mage: 'obsidia_kiln',
      white_mage: 'elowen_saltmere',
      dragoon_knight: 'corbet_highvault',
      summoner: 'thessaly_prism',
      limit_striker: 'harl_crackglaze',
      crystal_sentinel: 'guild_shardbow',
      chaos_champion: 'hesker_rawhand',
      plague_cultist: 'pox_sister_marrin',
      warp_magus: 'ezrin_splitveil',
      daemon_knight: 'ser_culloch_the_flensed',
      heretic_acolyte: 'nym_bloodcup',
      possessed_marine: 'brannoc_ashquarrel',
      dragonborn: 'hrafna_stormthroat',
      greybeard_sage: 'skegga_hoarfrost',
      nord_huscarl: 'bodmar_lindenshield',
      battlemage: 'sigrith_hailcaller',
      nightingale: 'yrsel_nightfoot',
      restoration_saint: 'hervild_hearthmender',
    },
    building: {
      wwe_academy: 'champions_hall',
      element_barracks: 'powderhorn_magazine',
      primis_shrine: 'pale_vigil_shrine',
      spartan_academy: 'greywatch_hall',
      cog_academy: 'sawtooth_camp',
      rivendell_camp: 'thornroad_camp',
      hanma_dojo: 'knucklebone_lodge',
      stand_arrow_shrine: 'marrow_reliquary',
      north_star_dojo: 'quiet_hand_cloister',
      capsule_corp: 'emberblood_hearth',
      astartes_chapel: 'iron_psalm_chapel',
      crystal_sanctum: 'saltglass_furnace',
      warp_shrine: 'open_wound_shrine',
      dragon_moot: 'rimehowl_longhouse',
      // The fourteen academies became one Training Ground; old saves keep the building.
      academy_footman: 'training_ground',
      academy_archer: 'training_ground',
      academy_mage: 'training_ground',
      academy_cavalry: 'training_ground',
      academy_knight: 'training_ground',
      academy_sapper: 'training_ground',
      academy_healer: 'training_ground',
      academy_builder: 'training_ground',
      academy_courier: 'training_ground',
      academy_general: 'training_ground',
      academy_scout: 'training_ground',
      academy_bard: 'training_ground',
      academy_ballista: 'training_ground',
      academy_pikeman: 'training_ground',
    },
    faction: {
      wwe: 'champions',
      ultimis: 'powderhorn',
      primis: 'pale_vigil',
      halo: 'greywatch',
      gears: 'sawtooth',
      lotr: 'thornroad',
      baki: 'knucklebone',
      jojo: 'marrow_choir',
      fotns: 'quiet_hand',
      dragonball: 'emberblood',
      imperium: 'iron_psalm',
      crystal: 'saltglass',
      warp: 'open_wound',
      tes: 'rimehowl',
    },
    ability: {
      619: 'rope_dancers_leap',
      stunner: 'keystone_blow',
      rock_bottom: 'cairn_fall',
      woo: 'heralds_boast',
      hulk_up: 'stubborn_blood',
      elbow_drop: 'stooping_cast',
      scorpion: 'chain_hold',
      attitude: 'sworn_stand',
      batista_bomb: 'goring_sweep',
      spear: 'shoulder_ram',
      sweet_chin: 'spinning_heel',
      sharpshooter: 'lockwrights_hold',
      tombstone: 'passing_bell',
      chokeslam: 'barbed_hide',
      giant_strength: 'keep_breaker',
      razors_edge: 'whetted_edge',
      jackknife: 'roof_fall',
      piper_pit: 'barbed_tongue',
      usa: 'raise_the_colours',
      headbutt: 'rams_brow',
      lie_cheat_steal: 'magpies_due',
      crippler: 'tightening_grip',
      nigerian_nightmare: 'ringed_in',
      f5: 'carcass_throw',
      go_to_sleep: 'last_word',
      curb_stomp: 'poachers_cast',
      brogue_kick: 'turf_cutters_sweep',
      lantern: 'corpse_candle_omen',
      rko: 'sudden_fall',
      frag_out: 'fused_pot',
      wunderwaffe: 'bottled_storm',
      vodka_rage: 'hooped_iron',
      bushido: 'first_cut',
      apothicon_slam: 'barrow_sweep',
      iron_curtain: 'sealed_door',
      katana_fury: 'mercy_stroke',
      summoning_key: 'candle_and_lancet',
      spartan_rage: 'pavise_line',
      lone_wolf: 'far_from_the_fire',
      oorah: 'barrack_roar',
      noble_leader: 'call_the_mark',
      tech_ops: 'hobbling_bolt',
      energy_sword: 'scaling_knife',
      grenadier: 'springald_shot',
      sniper_cover: 'held_breath',
      spartan_training: 'steady_crank',
      lancer_burst: 'sawback_glaive',
      brothers_in_arms: 'stand_with_me',
      tech_head: 'pry_and_spike',
      cole_train: 'downhill_charge',
      carmine_curse: 'flag_bolt',
      heavy_lancer: 'bolt_storm',
      carmine_brother: 'spotters_whistle',
      lancer_drill: 'dug_in',
      anduril: 'riders_bane',
      elven_archer: 'long_draw',
      axe_cleave: 'splitting_stroke',
      you_shall_not_pass: 'ward_of_salt',
      ring_bearer: 'underfoot',
      horn_of_gondor: 'hold_the_gate',
      no_man: 'hamstring_thrust',
      demon_back: 'blooded',
      ogre: 'bare_handed_ruin',
      goudou: 'callus_strike',
      bite: 'gnaw',
      iron_body: 'anvil_flesh',
      aiki: 'yield_and_break',
      primitive_fury: 'feral_hunger',
      hamon_overdrive: 'dawn_hymn',
      vaporization_freeze: 'cold_antiphon',
      sunlight_yellow: 'mending_verse',
      hermit_purple: 'snare_verse',
      bubble_cutter: 'whistling_stone',
      german_science: 'rams_canticle',
      star_platinum: 'hammered_verse',
      hierophant_green: 'shard_rain',
      silver_chariot: 'needle_verse',
      magicians_red: 'burning_censer',
      crazy_diamond: 'knitting_hymn',
      the_hand: 'tolling_blow',
      heavens_door: 'written_curse',
      killer_queen: 'unsung_end',
      gold_experience: 'alms_of_blood',
      sticky_fingers: 'leading_voice',
      sex_pistols: 'skipping_stone',
      king_crimson: 'final_amen',
      stone_free: 'gut_string_snare',
      weather_stand: 'thunder_response',
      kiss: 'refrain',
      tusk_act4: 'couched_lance',
      steel_ball: 'wheeling_flail',
      scary_monsters: 'run_to_ground',
      ticket_to_ride: 'riding_hymn',
      hidan_shinken: 'stopped_breath',
      hokuto_kaioh: 'heavy_tread',
      hakke_shou: 'laying_on_of_hands',
      nanto_suicho: 'scything_step',
      dirty_tricks: 'grit_in_the_eye',
      nanto_hakuro: 'spear_hand',
      kamehameha: 'ember_burst',
      galick_gun: 'banked_fury',
      special_beam: 'lancing_ember',
      hidden_potential: 'slow_burn',
      burning_attack: 'thrown_coals',
      death_beam: 'ashen_needle',
      perfect_form: 'feeding_fire',
      hakai: 'pyres_end',
      bolter_discipline: 'ordered_volley',
      litany_of_hate: 'psalm_of_wrath',
      smite: 'unbinding',
      summary_execution: 'deserters_wage',
      lasgun_volley: 'levy_volley',
      storm_shield: 'tower_shield',
      autocannon: 'bronze_bombard',
      cross_slash: 'crosswise_cut',
      firaga: 'kiln_burst',
      curaga: 'clear_glass',
      jump_attack: 'vaulting_lance',
      aeon_strike: 'burning_lens',
      limit_break: 'shatter_point',
      aether_shot: 'shard_bolt',
      warp_fury: 'red_frenzy',
      festering_curse: 'weeping_sore',
      warp_bolt: 'forked_curse',
      unholy_armor: 'scabbed_plate',
      blood_pact: 'blood_tithe',
      daemon_fire: 'wound_fire_bolts',
      fus_ro_dah: 'breaking_howl',
      thuum_echo: 'echoing_chant',
      shield_wall: 'hold_fast',
      dragon_aspect: 'hail_call',
      shadow_strike: 'knife_in_the_dark',
      mara_blessing: 'hearth_blessing',
    },
    mastery: {
      wwe_show: 'champions_four_on_the_sand',
      halo_noble: 'greywatch_unbroken_watch',
      lotr_fellowship: 'thornroad_full_company',
      jojo_sbr: 'marrow_choir_outriders',
    },
    tag: {
      ki: 'ember',
      dragon: 'skald',
    },
    node: {
      champions: {
        showmanship: 'play_to_the_crowd',
        hulk_up: 'second_wind',
        finisher: 'finishing_blow',
        tag_team: 'fight_in_pairs',
      },
      powderhorn: {
        frag_drill: 'fuse_drill',
        vodka_tank: 'barrel_banded',
        wunder_chain: 'forked_storm',
        moon_op: 'master_of_the_horn',
      },
      pale_vigil: {
        aether_guard: 'barrow_ward',
        curtain: 'sealed_door',
        summoning_key: 'candle_and_lancet',
        cycle_break: 'last_door',
      },
      greywatch: {
        mjolnir: 'citadel_drill',
        noble_team: 'volley_line',
        spartan_rage: 'wall_clearing',
        chief: 'warden_captain',
      },
      sawtooth: {
        lancer_disc: 'crossbow_drill',
        chainsaw: 'saw_edge',
        carmine_bond: 'engine_breaking',
        last_jacinto: 'last_in_the_ditch',
      },
      thornroad: {
        fellowship: 'road_sworn',
        ranger_eye: 'fowlers_eye',
        dwarf_axe: 'quarry_axe',
        king_returned: 'shrines_avenged',
      },
      knucklebone: {
        demon_back: 'blooded',
        iron_body: 'anvil_flesh',
        ogre_slayer: 'one_blow_taught',
        hanma_blood: 'knucklebones_won',
      },
      marrow_choir: {
        stand_awaken: 'first_verse',
        sunbreath: 'dawn_office',
        spin: 'whistling_stones',
        made_in_heaven: 'full_choir',
      },
    },
  };

  const DONE_KEY = 'myth-and-blood-ids-renamed-v1';
  // Run saves are migrated on load (SaveFormat); these other stores hold no roster ids.
  const SKIP_STORE =
    /saves|quicksave|settings|keys|error-log|analytics|mods|online|onboarding|ids-renamed/;
  // A unit flag shares this hero id's word; never rename it as a key.
  const KEEP_KEYS = new Set(['summoner']);
  const has = (t, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(t, k);
  const PLAIN = { ...TABLE.unit, ...TABLE.building, ...TABLE.faction, ...TABLE.mastery };

  function rename(kind, id) {
    return has(TABLE[kind], id) ? TABLE[kind][id] : id;
  }

  /** An old unit, building, faction or mastery id, or a faction-derived key, renamed. */
  function renameString(s) {
    if (has(PLAIN, s)) return PLAIN[s];
    const m =
      typeof s === 'string' && /^(roster_|creative_skin_|mastery\.|order_)(\w+?)(_\d+)?$/.exec(s);
    return m && has(TABLE.faction, m[2]) ? m[1] + TABLE.faction[m[2]] + (m[3] || '') : s;
  }

  /** Copy of plain data with every old id renamed, as a string value or as an object key. */
  function renameDeep(v) {
    if (typeof v === 'string') return renameString(v);
    if (Array.isArray(v)) return v.map(renameDeep);
    if (!v || typeof v !== 'object') return v;
    const out = {};
    for (const [k, x] of Object.entries(v))
      out[KEEP_KEYS.has(k) ? k : renameString(k)] = renameDeep(x);
    return out;
  }

  /** Save format 3 -> 4. Core unit/building types also go through SaveRegistry aliases. */
  function migrateSave(s) {
    for (const u of s.units || []) {
      if (!u) continue;
      u.type = rename('unit', u.type);
      if (u.wweAbility) u.wweAbility = rename('ability', u.wweAbility);
      if (u.combatTag) u.combatTag = rename('tag', u.combatTag);
      if (u.spriteType) u.spriteType = renameString(u.spriteType);
      if (u.crossoverFaction) u.crossoverFaction = rename('faction', u.crossoverFaction);
    }
    for (const b of s.buildings || []) {
      if (!b) continue;
      b.type = rename('building', b.type);
      if (b.academyUnit) b.academyUnit = rename('unit', b.academyUnit);
      if (b.crossoverFaction) b.crossoverFaction = rename('faction', b.crossoverFaction);
    }
    if (s.modules && typeof s.modules === 'object') s.modules = renameDeep(s.modules);
    return s;
  }

  /** Skill-tree store: tree keys are faction ids, node ids are scoped to their tree. */
  function migrateSkills(data) {
    const purchased = {};
    for (const [fid, nodes] of Object.entries(data.purchased || {})) {
      const tree = rename('faction', fid);
      const map = TABLE.node[tree] || {};
      purchased[tree] = Array.isArray(nodes) ? nodes.map((n) => (has(map, n) ? map[n] : n)) : nodes;
    }
    return { ...data, purchased };
  }

  /** One pass over the browser's stores, once per profile. */
  function migrateStorage(store) {
    if (!store || store.getItem(DONE_KEY)) return 0;
    let changed = 0;
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i);
      if (!key || !key.startsWith('myth-and-blood-') || SKIP_STORE.test(key)) continue;
      try {
        const raw = store.getItem(key);
        const data = JSON.parse(raw);
        const next = JSON.stringify(
          key === 'myth-and-blood-operative-skills-v1' ? migrateSkills(data) : renameDeep(data)
        );
        if (next !== raw) {
          store.setItem(key, next);
          changed++;
        }
      } catch (_) {
        /* not JSON or storage full: leave that store as it was */
      }
    }
    store.setItem(DONE_KEY, '1');
    return changed;
  }

  if (typeof SaveRegistry !== 'undefined') {
    for (const kind of ['unit', 'building', 'faction']) {
      for (const [from, to] of Object.entries(TABLE[kind])) SaveRegistry.alias(kind, from, to);
    }
  }
  try {
    if (typeof localStorage !== 'undefined') migrateStorage(localStorage);
  } catch (_) {
    /* storage blocked (private window): nothing stored to migrate */
  }

  return { TABLE, rename, renameString, renameDeep, migrateSave, migrateSkills, migrateStorage };
})();
