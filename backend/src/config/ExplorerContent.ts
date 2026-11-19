import { ProgressMetric } from '../types';

export type NpcRole = 'elder' | 'guard' | 'merchant' | 'villager' | 'trainer';

export interface NpcDef {
  id: string;
  name: string;
  role: NpcRole;
  icon: string;
  accessory?: string;
  at: { x: number; y: number };
  greeting: string;
  questId?: string;
  afterQuest?: string;
}

export interface QuestDef {
  id: string;
  kingdom: number;
  title: string;
  brief: string;
  metric: ProgressMetric;
  target: number;
  rewardStars: number;
  rewardXp: number;
  rewardEvoXp: number;
  unlocksQuest?: string;
  completesKingdom?: boolean;
}

export interface BossDef {
  id: string;
  kingdom: number;
  name: string;
  icon: string;
  intro: string;
  unlockLevel: number;
  hp: number;
  speed: number;
  radius: number;
  score: number;
}

export interface KingdomDef {
  n: number;
  id: string;
  name: string;
  theme: string;
  icon: string;
  intro: string;
  outro: string;
  unlockLevel: number;
  npcs: NpcDef[];
  quests: QuestDef[];
  boss?: BossDef;
}

export const KINGDOMS: KingdomDef[] = [
  {
    n: 1,
    id: 'emerald_hollow',
    name: 'Emerald Hollow',
    theme: 'forest',
    icon: '🌳',
    intro: 'A village of low green houses under the old trees. They have been waiting a long time for someone with your markings.',
    outro: 'Emerald Hollow stands. The bridge east is yours to cross.',
    unlockLevel: 1,
    npcs: [
      {
        id: 'npc_elder_moss', name: 'Elder Moss', role: 'elder', icon: '🐍', accessory: '🧙',
        at: { x: 0.50, y: 0.46 },
        greeting: 'You carry the old mark, little one. I did not think I would live to see it again. The Hollow is hungry — help us eat, and I will tell you what I know.',
        questId: 'q1_forage',
        afterQuest: 'The stores are full. Sit. The Crown was not lost, child — it was broken, and scattered on purpose.',
      },
      {
        id: 'npc_guard_bram', name: 'Guard Bram', role: 'guard', icon: '🐍', accessory: '🛡️',
        at: { x: 0.58, y: 0.52 },
        greeting: 'Stay behind me. The Venom Order sends scouts through the east treeline most nights, and I am one snake.',
        questId: 'q1_scouts',
        afterQuest: 'You fight like someone who has something to get back. Good. The bridge is clear.',
      },
      {
        id: 'npc_merchant_fen', name: 'Fen the Trader', role: 'merchant', icon: '🐍', accessory: '🎒',
        at: { x: 0.44, y: 0.54 },
        greeting: 'Star fragments, friend. I buy, I sell, I do not ask where they came from. Bring me some and we both eat.',
        questId: 'q1_fragments',
        afterQuest: 'Warm to the touch, still. Whatever the Crown was, it has not finished being it.',
      },
      {
        id: 'npc_villager_pip', name: 'Pip', role: 'villager', icon: '🐍', accessory: '🌸',
        at: { x: 0.53, y: 0.41 },
        greeting: 'Are you really the one from the egg? Elder Moss says not to bother you. I am bothering you.',
      },
      {
        id: 'npc_trainer_kess', name: 'Kess the Coil', role: 'trainer', icon: '🐍', accessory: '⚔️',
        at: { x: 0.47, y: 0.58 },
        greeting: 'Head to head is the only fight that matters out there. Bigger wins. So get bigger — that is the whole lesson.',
      },
    ],
    quests: [
      {
        id: 'q1_forage', kingdom: 1, title: 'Feed the Hollow',
        brief: 'Elder Moss needs the village stores filled before the cold.',
        metric: 'cherry', target: 25, rewardStars: 150, rewardXp: 120, rewardEvoXp: 40,
        unlocksQuest: 'q1_scouts',
      },
      {
        id: 'q1_scouts', kingdom: 1, title: 'Drive Back the Scouts',
        brief: 'Guard Bram cannot hold the east treeline alone.',
        metric: 'kill', target: 3, rewardStars: 250, rewardXp: 200, rewardEvoXp: 70,
        unlocksQuest: 'q1_fragments',
      },
      {
        id: 'q1_fragments', kingdom: 1, title: 'Fragments for Fen',
        brief: 'Fen trades in Star Fragments — and knows more than he admits.',
        metric: 'star', target: 8, rewardStars: 350, rewardXp: 280, rewardEvoXp: 100,
        completesKingdom: true,
      },
    ],
    boss: {
      id: 'boss_thornmaw', kingdom: 1, name: 'Thornmaw', icon: '🐲',
      intro: 'The treeline splits. What comes through it is not a scout.',
      unlockLevel: 50, hp: 600, speed: 200, radius: 30, score: 4000,
    },
  },
  {
    n: 2,
    id: 'sunken_reach',
    name: 'Sunken Reach',
    theme: 'riverlands',
    icon: '🌊',
    intro: 'Water over the old road. The Reach drowned slowly, and something stayed.',
    outro: 'The Reach breathes again. The basalt ridge rises ahead.',
    unlockLevel: 60,
    npcs: [
      {
        id: 'npc_reed_oracle', name: 'Oracle Reen', role: 'elder', icon: '🐍', accessory: '🔮',
        at: { x: 0.48, y: 0.48 },
        greeting: 'The river remembers every footstep that crossed the old bridge. Feed the marsh lanterns with river frogs and I shall part the reeds.',
        questId: 'q2_frogs',
        afterQuest: 'The lanterns burn azure once more. Tidecoil stirs in the deep eddy.',
      },
      {
        id: 'npc_captain_silt', name: 'Captain Silt', role: 'guard', icon: '🐍', accessory: '🔱',
        at: { x: 0.56, y: 0.45 },
        greeting: 'Venom Order raiders swim beneath the fog. Sink five of them before they cut the ferry ropes.',
        questId: 'q2_raiders',
        afterQuest: 'Good strike. Even armored coils crack when met head-on.',
      },
      {
        id: 'npc_ferryman_cor', name: 'Ferryman Cor', role: 'merchant', icon: '🐍', accessory: '⛵',
        at: { x: 0.43, y: 0.55 },
        greeting: 'My barge moves on Star power alone. Gather twelve fragments from the shoals and the crossing east is yours.',
        questId: 'q2_stars',
        afterQuest: 'Steam up and rudder true. Ashfall awaits across the dark water.',
      },
    ],
    quests: [
      {
        id: 'q2_frogs', kingdom: 2, title: 'Lanterns of the Marsh',
        brief: 'Oracle Reen needs silver marsh frogs to re-light the sunken beacons.',
        metric: 'frog', target: 12, rewardStars: 300, rewardXp: 240, rewardEvoXp: 90,
        unlocksQuest: 'q2_raiders',
      },
      {
        id: 'q2_raiders', kingdom: 2, title: 'Hold the Ferry Crossing',
        brief: 'Captain Silt asks you to clear five Venom Order raiders from the canal.',
        metric: 'kill', target: 5, rewardStars: 400, rewardXp: 320, rewardEvoXp: 120,
        unlocksQuest: 'q2_stars',
      },
      {
        id: 'q2_stars', kingdom: 2, title: 'Power the Stone Barge',
        brief: 'Ferryman Cor needs Star Fragments to restart the ancient stone barge.',
        metric: 'star', target: 15, rewardStars: 500, rewardXp: 400, rewardEvoXp: 150,
        completesKingdom: true,
      },
    ],
    boss: {
      id: 'boss_tidecoil', kingdom: 2, name: 'Tidecoil', icon: '🐉',
      intro: 'A whirlpool opens beneath the sunken arch. Ancient river scales gleam in the surf.',
      unlockLevel: 60, hp: 900, speed: 215, radius: 32, score: 5500,
    },
  },
  {
    n: 3,
    id: 'ashfall',
    name: 'Ashfall',
    theme: 'volcano',
    icon: '🔥',
    intro: 'Warm stone underfoot. Nothing grows here and everything watches.',
    outro: 'Ashfall cools behind you. Ahead, the first flakes begin to fall.',
    unlockLevel: 130,
    npcs: [
      {
        id: 'npc_smith_pyra', name: 'Forgemaster Pyra', role: 'trainer', icon: '🐍', accessory: '⚒️',
        at: { x: 0.50, y: 0.50 },
        greeting: 'Only tempered scales survive the obsidian rim. Collect Sun Apples from the cooling vents to stoke the ancient kiln.',
        questId: 'q3_apples',
        afterQuest: 'Your scales ring like bronze now. Ready for magma.',
      },
      {
        id: 'npc_warden_kag', name: 'Warden Kag', role: 'guard', icon: '🐍', accessory: '🔥',
        at: { x: 0.59, y: 0.51 },
        greeting: 'We hold the caldera bridge against Cinderfang’s pack. Thin their numbers cleanly.',
        questId: 'q3_vanguard',
        afterQuest: 'The rim breathes easier. Only Cinderfang himself still blocks the ascent.',
      },
      {
        id: 'npc_scholar_ash', name: 'Scholar Ignis', role: 'elder', icon: '🐍', accessory: '📜',
        at: { x: 0.42, y: 0.47 },
        greeting: 'Reach a high score within the heat — show the mountain the Crown’s fire still burns inside you.',
        questId: 'q3_trial',
        afterQuest: 'The volcanic obelisk hums in recognition.',
      },
    ],
    quests: [
      {
        id: 'q3_apples', kingdom: 3, title: 'Ember Orchard',
        brief: 'Gather 20 Sun Apples along the volcanic ridges for Forgemaster Pyra.',
        metric: 'apple', target: 20, rewardStars: 450, rewardXp: 360, rewardEvoXp: 140,
        unlocksQuest: 'q3_vanguard',
      },
      {
        id: 'q3_vanguard', kingdom: 3, title: 'Break the Ash Vanguard',
        brief: 'Eliminate 8 Venom Order vanguard snakes patrolling the crater.',
        metric: 'kill', target: 8, rewardStars: 550, rewardXp: 440, rewardEvoXp: 170,
        unlocksQuest: 'q3_trial',
      },
      {
        id: 'q3_trial', kingdom: 3, title: 'Trial of the Caldera',
        brief: 'Collect 25 Star Fragments crystallized in the obsidian glass.',
        metric: 'star', target: 25, rewardStars: 700, rewardXp: 550, rewardEvoXp: 220,
        completesKingdom: true,
      },
    ],
    boss: {
      id: 'boss_cinderfang', kingdom: 3, name: 'Cinderfang', icon: '🔥',
      intro: 'Magma fountains erupt around the central spire as Cinderfang uncoils.',
      unlockLevel: 130, hp: 1200, speed: 225, radius: 34, score: 7500,
    },
  },
  {
    n: 4,
    id: 'white_silence',
    name: 'White Silence',
    theme: 'ice',
    icon: '❄️',
    intro: 'Snow that has never been walked on. Your trail is the only one.',
    outro: 'The Silence lets you pass. Sunlight breaks over distant cherry blossoms.',
    unlockLevel: 220,
    npcs: [
      {
        id: 'npc_keeper_vey', name: 'Glacier Keeper Vey', role: 'elder', icon: '🐍', accessory: '🧊',
        at: { x: 0.50, y: 0.45 },
        greeting: 'Time slows in White Silence. Keep your blood warm with dashes and frost berries.',
        questId: 'q4_dash',
        afterQuest: 'You move swiftly even on black ice.',
      },
      {
        id: 'npc_scout_nora', name: 'Ice Scout Nora', role: 'guard', icon: '🐍', accessory: '🏹',
        at: { x: 0.55, y: 0.55 },
        greeting: 'Ten frost-armored prowlers stalk the frozen lake. Clear our patrol path.',
        questId: 'q4_prowlers',
        afterQuest: 'The ice bridge ahead is finally quiet.',
      },
      {
        id: 'npc_cartographer_lin', name: 'Lin the Chartmaker', role: 'merchant', icon: '🐍', accessory: '🧭',
        at: { x: 0.44, y: 0.52 },
        greeting: 'Survey the northern expanse for me — gather frozen cherries along every quadrant.',
        questId: 'q4_survey',
        afterQuest: 'Our map of the North is complete once more.',
      },
    ],
    quests: [
      {
        id: 'q4_dash', kingdom: 4, title: 'Heat of the Coil',
        brief: 'Use Dash 30 times to shatter the creeping frost around Glacier Keep.',
        metric: 'boost', target: 30, rewardStars: 550, rewardXp: 460, rewardEvoXp: 180,
        unlocksQuest: 'q4_prowlers',
      },
      {
        id: 'q4_prowlers', kingdom: 4, title: 'Clear the Frozen Lake',
        brief: 'Defeat 10 frost-armored Venom Order scouts.',
        metric: 'kill', target: 10, rewardStars: 650, rewardXp: 540, rewardEvoXp: 210,
        unlocksQuest: 'q4_survey',
      },
      {
        id: 'q4_survey', kingdom: 4, title: 'Harvest the Frost Orchards',
        brief: 'Collect 50 winter cherries across the ice sheets.',
        metric: 'cherry', target: 50, rewardStars: 800, rewardXp: 650, rewardEvoXp: 260,
        completesKingdom: true,
      },
    ],
    boss: {
      id: 'boss_frostscale', kingdom: 4, name: 'Frostscale', icon: '❄️',
      intro: 'An aurora splinters overhead as Frostscale rises from the glacier heart.',
      unlockLevel: 220, hp: 1500, speed: 230, radius: 36, score: 9500,
    },
  },
  {
    n: 5,
    id: 'bloomfall',
    name: 'Bloomfall',
    theme: 'tropical',
    icon: '🌸',
    intro: 'Colour after all that white. Bloomfall never heard the kingdom fell.',
    outro: 'Bloomfall remembers your name. Its petals march with you toward the shadow.',
    unlockLevel: 340,
    npcs: [
      {
        id: 'npc_botanist_sana', name: 'Botanist Sana', role: 'villager', icon: '🐍', accessory: '🌺',
        at: { x: 0.51, y: 0.47 },
        greeting: 'Breathe deep, wanderer. Gather bright frogs and canopy apples for our harvest festival!',
        questId: 'q5_feast',
        afterQuest: 'The whole canopy sings your praise.',
      },
      {
        id: 'npc_sentinel_orion', name: 'Sentinel Orion', role: 'guard', icon: '🐍', accessory: '🗡️',
        at: { x: 0.58, y: 0.49 },
        greeting: 'Don’t let the blossoms fool you — Venom Order spies hide among the vines.',
        questId: 'q5_spies',
        afterQuest: 'Not a single spy remains beneath the petals.',
      },
      {
        id: 'npc_weaver_mira', name: 'Sunweaver Mira', role: 'elder', icon: '🐍', accessory: '✨',
        at: { x: 0.43, y: 0.53 },
        greeting: 'Channel ancient Star Fragments to awaken the sleeping petals against the approaching dark.',
        questId: 'q5_bloom',
        afterQuest: 'The Golden Bloom stands ready to shield your march.',
      },
    ],
    quests: [
      {
        id: 'q5_feast', kingdom: 5, title: 'Festival of Petals',
        brief: 'Collect 25 tropical frogs from the lotus pools for Botanist Sana.',
        metric: 'frog', target: 25, rewardStars: 700, rewardXp: 600, rewardEvoXp: 240,
        unlocksQuest: 'q5_spies',
      },
      {
        id: 'q5_spies', kingdom: 5, title: 'Purge the Canopy Spies',
        brief: 'Eliminate 12 hidden Venom Order infiltrators.',
        metric: 'kill', target: 12, rewardStars: 850, rewardXp: 700, rewardEvoXp: 280,
        unlocksQuest: 'q5_bloom',
      },
      {
        id: 'q5_bloom', kingdom: 5, title: 'Pollen of Stars',
        brief: 'Gather 35 Star Fragments beneath the sacred blossom arches.',
        metric: 'star', target: 35, rewardStars: 1000, rewardXp: 820, rewardEvoXp: 320,
        completesKingdom: true,
      },
    ],
    boss: {
      id: 'boss_petalwyrm', kingdom: 5, name: 'Petalwyrm', icon: '🌺',
      intro: 'Ten thousand crimson blossoms swirl into a towering serpentine cyclone.',
      unlockLevel: 340, hp: 1850, speed: 235, radius: 38, score: 12000,
    },
  },
  {
    n: 6,
    id: 'the_hush',
    name: 'The Hush',
    theme: 'swamp',
    icon: '🌑',
    intro: 'No birds. No wind. The Venom Order made this quiet on purpose.',
    outro: 'The Hush is broken. The spires of your true home pierce the horizon.',
    unlockLevel: 500,
    npcs: [
      {
        id: 'npc_exile_draven', name: 'Exile Draven', role: 'trainer', icon: '🐍', accessory: '🦇',
        at: { x: 0.48, y: 0.49 },
        greeting: 'Keep low in the fog. Collect moon-apples to restore your sight through the mist.',
        questId: 'q6_sight',
        afterQuest: 'Now your eyes pierce even Duskshroud’s veil.',
      },
      {
        id: 'npc_captain_veil', name: 'Shadow-Captain Nyx', role: 'guard', icon: '🐍', accessory: '⚔️',
        at: { x: 0.56, y: 0.53 },
        greeting: 'Fifteen elite Venom Wardens guard the marsh causeway. Cut through them.',
        questId: 'q6_wardens',
        afterQuest: 'The causeway lies open. Crown Spire awaits.',
      },
      {
        id: 'npc_oracle_echo', name: 'Echo of the Marsh', role: 'elder', icon: '🐍', accessory: '🕯️',
        at: { x: 0.44, y: 0.43 },
        greeting: 'Survive five full minutes inside The Hush to break the Order’s silence curse.',
        questId: 'q6_endure',
        afterQuest: 'Listen... wind returns to the reeds.',
      },
    ],
    quests: [
      {
        id: 'q6_sight', kingdom: 6, title: 'Sight in the Mist',
        brief: 'Gather 30 Moon-Apples scattered across the dark bog.',
        metric: 'apple', target: 30, rewardStars: 900, rewardXp: 750, rewardEvoXp: 300,
        unlocksQuest: 'q6_wardens',
      },
      {
        id: 'q6_wardens', kingdom: 6, title: 'Shatter the Silent Guard',
        brief: 'Defeat 15 Venom Order swamp wardens.',
        metric: 'kill', target: 15, rewardStars: 1100, rewardXp: 900, rewardEvoXp: 360,
        unlocksQuest: 'q6_endure',
      },
      {
        id: 'q6_endure', kingdom: 6, title: 'Starlight Over the Bog',
        brief: 'Collect 50 Star Fragments to dispel the darkness before Crown Spire.',
        metric: 'star', target: 50, rewardStars: 1300, rewardXp: 1100, rewardEvoXp: 420,
        completesKingdom: true,
      },
    ],
    boss: {
      id: 'boss_duskshroud', kingdom: 6, name: 'Duskshroud', icon: '👁️',
      intro: 'All lanterns go out at once. Two amethyst eyes widen in the mist.',
      unlockLevel: 500, hp: 2200, speed: 245, radius: 40, score: 15000,
    },
  },
  {
    n: 7,
    id: 'crown_spire',
    name: 'Crown Spire',
    theme: 'royal_castle',
    icon: '👑',
    intro: 'Your castle. Ruined, occupied, and still standing — like you.',
    outro: 'The throne of Anaconda Park is yours. Long live the Sovereign of Coils!',
    unlockLevel: 700,
    npcs: [
      {
        id: 'npc_chamberlain_auric', name: 'Lord Chamberlain Auric', role: 'elder', icon: '🐍', accessory: '👑',
        at: { x: 0.50, y: 0.45 },
        greeting: 'Welcome home, Your Majesty. Gather the royal cherries of the courtyard and rally the banner.',
        questId: 'q7_courtyard',
        afterQuest: 'Every hall remembers its rightful sovereign.',
      },
      {
        id: 'npc_commander_rex', name: 'Commander Rex', role: 'guard', icon: '🐍', accessory: '🛡️',
        at: { x: 0.57, y: 0.50 },
        greeting: 'Twenty Imperial Guards of the Venom Emperor block the throne stair. Leave none standing.',
        questId: 'q7_imperial',
        afterQuest: 'The throne doors swing wide!',
      },
      {
        id: 'npc_keeper_crown', name: 'Keeper of the Crown', role: 'merchant', icon: '🐍', accessory: '💎',
        at: { x: 0.45, y: 0.55 },
        greeting: 'Reforge the shattered Crown itself with 75 Star Fragments before facing the Venom Emperor.',
        questId: 'q7_reforge',
        afterQuest: 'The Crown blazes whole upon your brow!',
      },
    ],
    quests: [
      {
        id: 'q7_courtyard', kingdom: 7, title: 'Reclaim the Courtyard',
        brief: 'Harvest 75 royal cherries within the ruined castle grounds.',
        metric: 'cherry', target: 75, rewardStars: 1200, rewardXp: 1000, rewardEvoXp: 400,
        unlocksQuest: 'q7_imperial',
      },
      {
        id: 'q7_imperial', kingdom: 7, title: 'Storm the Throne Stair',
        brief: 'Defeat 20 Imperial Guard snakes of the Venom Order.',
        metric: 'kill', target: 20, rewardStars: 1500, rewardXp: 1250, rewardEvoXp: 500,
        unlocksQuest: 'q7_reforge',
      },
      {
        id: 'q7_reforge', kingdom: 7, title: 'Reforge the Sovereign Crown',
        brief: 'Collect 75 Star Fragments to make the broken Crown whole once more.',
        metric: 'star', target: 75, rewardStars: 2500, rewardXp: 2000, rewardEvoXp: 800,
        completesKingdom: true,
      },
    ],
    boss: {
      id: 'boss_venom_emperor', kingdom: 7, name: 'Venom Emperor', icon: '👑',
      intro: 'The usurper rises from your shattered marble throne, armored in stolen Starlight.',
      unlockLevel: 700, hp: 3000, speed: 255, radius: 44, score: 20000,
    },
  },
];

// Additive Worlds 8–10 extending the 7 original Kingdoms into the 10-World, 1,000-Level Adventure Campaign.
// Kept in a separate export so legacy 7-kingdom contracts remain 100% intact while ALL_WORLDS powers Worlds 1–10.
export const CAMPAIGN_EXTRA_WORLDS: KingdomDef[] = [
  {
    n: 8,
    id: 'the_forgotten_wilds',
    name: 'The Forgotten Wilds',
    theme: 'ancient_ruins',
    icon: '🌿',
    intro: 'Overgrown monoliths beyond the Crown Spire where primal serpents guard lost runes.',
    outro: 'The Wilds bow to the Crown. Beneath the mossy arch, the descent to the Depths opens.',
    unlockLevel: 701,
    npcs: [
      {
        id: 'npc_druid_sylva', name: 'Rune Druid Sylva', role: 'elder', icon: '🐍', accessory: '🌿',
        at: { x: 0.49, y: 0.46 },
        greeting: 'Ancient roots remember languages older than the Crown. Gather wild crystals and awaken the monoliths.',
        questId: 'q8_monoliths',
        afterQuest: 'The monoliths sing again. The ancient path opens.',
      },
      {
        id: 'npc_ranger_tor', name: 'Wilds Ranger Tor', role: 'guard', icon: '🐍', accessory: '🏹',
        at: { x: 0.57, y: 0.52 },
        greeting: 'Feral shadow-vipers guard the vine crossings. Clear their patrols to open the ruin gate.',
        questId: 'q8_patrols',
        afterQuest: 'The overgrown causeway is safe once more.',
      },
      {
        id: 'npc_relic_kael', name: 'Relic Seeker Kael', role: 'merchant', icon: '🐍', accessory: '🧭',
        at: { x: 0.43, y: 0.54 },
        greeting: 'Star Fragments buried under centuries of moss still glow with royal memory.',
        questId: 'q8_relics',
        afterQuest: 'With these runes, we can read the seal to the Ancient Depths.',
      },
    ],
    quests: [
      {
        id: 'q8_monoliths', kingdom: 8, title: 'Awaken the Monoliths',
        brief: 'Collect 40 luminous crystals across the Forgotten Wilds.',
        metric: 'crystal', target: 40, rewardStars: 1600, rewardXp: 1300, rewardEvoXp: 520,
        unlocksQuest: 'q8_patrols',
      },
      {
        id: 'q8_patrols', kingdom: 8, title: 'Tame the Wilds',
        brief: 'Defeat 20 feral shadow-vipers patrolling the ruins.',
        metric: 'kill', target: 20, rewardStars: 1900, rewardXp: 1550, rewardEvoXp: 620,
        unlocksQuest: 'q8_relics',
      },
      {
        id: 'q8_relics', kingdom: 8, title: 'Runes of the Root',
        brief: 'Gather 80 Star Fragments hidden across the wild shrines.',
        metric: 'star', target: 80, rewardStars: 2600, rewardXp: 2100, rewardEvoXp: 840,
        completesKingdom: true,
      },
    ],
    boss: {
      id: 'boss_wyrmwood', kingdom: 8, name: 'Ancient Wyrmwood', icon: '🌳',
      intro: 'Stone roots erupt from the ruined temple as Ancient Wyrmwood awakens.',
      unlockLevel: 800, hp: 3600, speed: 260, radius: 44, score: 24000,
    },
  },
  {
    n: 9,
    id: 'the_ancient_depths',
    name: 'The Ancient Depths',
    theme: 'riverlands',
    icon: '🌀',
    intro: 'Subterranean glowing caverns beneath all seven kingdoms, lit by starlit trenches.',
    outro: 'The Abyssal Gate unlocks. Ahead shines the threshold of the Final Realm.',
    unlockLevel: 801,
    npcs: [
      {
        id: 'npc_diver_nara', name: 'Abyss Sage Nara', role: 'elder', icon: '🐍', accessory: '🔮',
        at: { x: 0.50, y: 0.45 },
        greeting: 'Down here, pressure tests every scale. Harvest luminous frogs from the crystal pools.',
        questId: 'q9_trench',
        afterQuest: 'The cavern lamps burn like submerged stars.',
      },
      {
        id: 'npc_warden_thal', name: 'Trench Warden Thal', role: 'guard', icon: '🐍', accessory: '🔱',
        at: { x: 0.58, y: 0.51 },
        greeting: 'Abyssal sentinels guard the sunken staircase. Break their formation.',
        questId: 'q9_sentinels',
        afterQuest: 'Not even the deep sentinels could hold you back.',
      },
      {
        id: 'npc_keeper_lume', name: 'Keeper Lume', role: 'merchant', icon: '🐍', accessory: '💎',
        at: { x: 0.44, y: 0.55 },
        greeting: 'Bring Star Fragments from the abyssal vents to ignite the ascent elevator.',
        questId: 'q9_ascent',
        afterQuest: 'The starlight column rises toward the Final Realm!',
      },
    ],
    quests: [
      {
        id: 'q9_trench', kingdom: 9, title: 'Lanterns of the Abyss',
        brief: 'Collect 45 luminous cavern frogs for Abyss Sage Nara.',
        metric: 'frog', target: 45, rewardStars: 2100, rewardXp: 1700, rewardEvoXp: 680,
        unlocksQuest: 'q9_sentinels',
      },
      {
        id: 'q9_sentinels', kingdom: 9, title: 'Shatter the Trench Guard',
        brief: 'Defeat 25 abyssal sentinels in the deep ruins.',
        metric: 'kill', target: 25, rewardStars: 2400, rewardXp: 1950, rewardEvoXp: 780,
        unlocksQuest: 'q9_ascent',
      },
      {
        id: 'q9_ascent', kingdom: 9, title: 'Ignite the Deep Spire',
        brief: 'Gather 90 Star Fragments to power the starlight ascent.',
        metric: 'star', target: 90, rewardStars: 3000, rewardXp: 2400, rewardEvoXp: 960,
        completesKingdom: true,
      },
    ],
    boss: {
      id: 'boss_abyssal_leviathan', kingdom: 9, name: 'Abyssal Leviathan', icon: '🌀',
      intro: 'Bioluminescent currents swirl into a vortex as Abyssal Leviathan rises.',
      unlockLevel: 900, hp: 4200, speed: 268, radius: 46, score: 28000,
    },
  },
  {
    n: 10,
    id: 'the_final_realm',
    name: 'The Final Realm',
    theme: 'royal_castle',
    icon: '🌟',
    intro: 'The Celestial Crown Sanctum where memory, wisdom, and sovereign mastery unite.',
    outro: 'All 1,000 trials conquered! You stand eternal as the Sovereign of CoilQuest!',
    unlockLevel: 901,
    npcs: [
      {
        id: 'npc_chronicle_sol', name: 'Chronicler Sol', role: 'elder', icon: '🐍', accessory: '📜',
        at: { x: 0.50, y: 0.45 },
        greeting: 'Every lesson, every puzzle, every guardian brought you here. Complete the celestial harvest.',
        questId: 'q10_celestial',
        afterQuest: 'The archives glow with your name across all ten worlds.',
      },
      {
        id: 'npc_marshal_vanguard', name: 'Grand Marshal Valen', role: 'guard', icon: '🐍', accessory: '⚔️',
        at: { x: 0.58, y: 0.50 },
        greeting: 'Face the Eternal Order’s champions before approaching the Celestial Throne.',
        questId: 'q10_champions',
        afterQuest: 'The final sanctum doors open to their true monarch.',
      },
      {
        id: 'npc_sovereign_herald', name: 'Crown Herald Lyra', role: 'merchant', icon: '🐍', accessory: '👑',
        at: { x: 0.44, y: 0.55 },
        greeting: 'Gather the final Star Fragments to awaken the Sovereign Crown for Level 1,000.',
        questId: 'q10_crown',
        afterQuest: 'Behold — the Sovereign Eclipse awaits your ultimate trial!',
      },
    ],
    quests: [
      {
        id: 'q10_celestial', kingdom: 10, title: 'Harvest of Eternity',
        brief: 'Gather 100 celestial fruits across the Final Realm.',
        metric: 'cherry', target: 100, rewardStars: 2600, rewardXp: 2100, rewardEvoXp: 850,
        unlocksQuest: 'q10_champions',
      },
      {
        id: 'q10_champions', kingdom: 10, title: 'Trial of the Champions',
        brief: 'Defeat 30 Eternal Order champions defending the sanctum.',
        metric: 'kill', target: 30, rewardStars: 3000, rewardXp: 2500, rewardEvoXp: 1000,
        unlocksQuest: 'q10_crown',
      },
      {
        id: 'q10_crown', kingdom: 10, title: 'Ascension of the Sovereign',
        brief: 'Collect 100 Star Fragments to unlock the Sovereign Eclipse Finale.',
        metric: 'star', target: 100, rewardStars: 4000, rewardXp: 3200, rewardEvoXp: 1300,
        completesKingdom: true,
      },
    ],
    boss: {
      id: 'boss_sovereign_eclipse', kingdom: 10, name: 'Sovereign Eclipse', icon: '🌟',
      intro: 'Starlight and shadow converge above the Celestial Throne for the Level 1,000 Finale.',
      unlockLevel: 1000, hp: 5000, speed: 275, radius: 48, score: 35000,
    },
  },
];

export const ALL_WORLDS: KingdomDef[] = [...KINGDOMS, ...CAMPAIGN_EXTRA_WORLDS];

export function kingdomByNumber(n: number): KingdomDef | undefined {
  return ALL_WORLDS.find(k => k.n === n);
}

export function questById(id: string): QuestDef | undefined {
  for (const k of ALL_WORLDS) {
    const q = k.quests.find(x => x.id === id);
    if (q) return q;
  }
  return undefined;
}

export function npcById(id: string): NpcDef | undefined {
  for (const k of ALL_WORLDS) {
    const n = k.npcs.find(x => x.id === id);
    if (n) return n;
  }
  return undefined;
}

export function bossById(id: string): BossDef | undefined {
  for (const k of ALL_WORLDS) {
    if (k.boss && k.boss.id === id) return k.boss;
  }
  return undefined;
}
