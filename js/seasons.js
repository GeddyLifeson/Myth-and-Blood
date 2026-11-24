/**
 * Seasons follow the day counter: each wave is one day, 25 days to a season, Spring first.
 * Effects are read by dawn pay (tpMult, dawnHeal), movement (speedMult), night prep
 * (nightPrepMult) and the weather clock (snow only in Winter).
 */
const Seasons = (() => {
  const DAYS_PER_SEASON = 25;
  const LIST = [
    {
      id: 'spring',
      name: 'Spring',
      tpMult: 1,
      speedMult: 1,
      nightPrepMult: 1,
      dawnHeal: 0.15,
      effects: ['Wounded mend 15% at dawn'],
    },
    {
      id: 'summer',
      name: 'Summer',
      tpMult: 1.2,
      speedMult: 1.05,
      nightPrepMult: 0.9,
      dawnHeal: 0,
      effects: ['Harvest: +20% dawn TP', '+5% march speed', 'Short nights: -10% prep time'],
    },
    {
      id: 'autumn',
      name: 'Autumn',
      tpMult: 1.1,
      speedMult: 0.95,
      nightPrepMult: 1.1,
      dawnHeal: 0,
      effects: ['Stores in: +10% dawn TP', 'Mud: -5% march speed', 'Long nights: +10% prep time'],
    },
    {
      id: 'winter',
      name: 'Winter',
      tpMult: 0.8,
      speedMult: 0.85,
      nightPrepMult: 1.2,
      dawnHeal: 0,
      effects: [
        'Lean stores: -20% dawn TP',
        'Snow: -15% march speed, both sides',
        'Long nights: +20% prep time',
      ],
    },
  ];

  function index(day) {
    const d = Math.max(1, Math.floor(Number(day) || 1)) - 1;
    return Math.floor(d / DAYS_PER_SEASON) % LIST.length;
  }

  /** Static season def for a day; safe in hot paths (no allocation). */
  function forDay(day) {
    return LIST[index(day)];
  }

  function dayOfSeason(day) {
    return ((Math.max(1, Math.floor(Number(day) || 1)) - 1) % DAYS_PER_SEASON) + 1;
  }

  /** True on the first day of every season after the opening Spring. */
  function isTurnDay(day) {
    return day > 1 && dayOfSeason(day) === 1;
  }

  function describe(day) {
    const s = forDay(day);
    return `${s.name}, day ${dayOfSeason(day)} of ${DAYS_PER_SEASON}: ${s.effects.join('; ')}.`;
  }

  return { DAYS_PER_SEASON, LIST, forDay, dayOfSeason, isTurnDay, describe };
})();

globalThis.Seasons = Seasons;
