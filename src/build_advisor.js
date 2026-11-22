/**
 * Dynamic In-Game Build Analyzer & Situational Item Recommender for PoroMac Overlay
 * Evaluates current champion, owned items (slot 0-6), current gold, enemy team composition,
 * enemy items, and fed enemy threats from Live Client Data API (Port 2999).
 */

const ITEM_CATALOG = {
  // Starter, Potions, Trinkets & Basic Components
  1056: { id: 1056, name: "Doran's Ring", cost: 400, type: 'starter' },
  1055: { id: 1055, name: "Doran's Blade", cost: 450, type: 'starter' },
  1054: { id: 1054, name: "Doran's Shield", cost: 450, type: 'starter' },
  1082: { id: 1082, name: 'Dark Seal', cost: 350, type: 'starter' },
  2003: { id: 2003, name: 'Health Potion', cost: 50, type: 'consumable' },
  2031: { id: 2031, name: 'Refillable Potion', cost: 150, type: 'consumable' },
  2055: { id: 2055, name: 'Control Ward', cost: 75, type: 'consumable' },
  3340: { id: 3340, name: 'Stealth Ward (Trinket)', cost: 0, type: 'trinket' },
  3363: { id: 3363, name: 'Farsight Alteration', cost: 0, type: 'trinket' },
  3364: { id: 3364, name: 'Oracle Lens', cost: 0, type: 'trinket' },

  // Basic & Epic Components
  1001: { id: 1001, name: 'Boots', cost: 300, type: 'boots_tier1' },
  1052: { id: 1052, name: 'Amplifying Tome', cost: 400, type: 'component' },
  1026: { id: 1026, name: 'Blasting Wand', cost: 850, type: 'component' },
  1058: { id: 1058, name: 'Needlessly Large Rod', cost: 1200, type: 'component' },
  1036: { id: 1036, name: 'Long Sword', cost: 350, type: 'component' },
  1037: { id: 1037, name: 'Pickaxe', cost: 875, type: 'component' },
  1038: { id: 1038, name: 'B. F. Sword', cost: 1300, type: 'component' },
  1028: { id: 1028, name: 'Ruby Crystal', cost: 400, type: 'component' },
  1029: { id: 1029, name: 'Cloth Armor', cost: 300, type: 'component', tags: ['armor'] },
  1031: { id: 1031, name: 'Chain Vest', cost: 800, type: 'component', tags: ['armor'] },
  1033: { id: 1033, name: 'Null-Magic Mantle', cost: 400, type: 'component', tags: ['mr'] },
  1057: { id: 1057, name: 'Negatron Cloak', cost: 850, type: 'component', tags: ['mr'] },
  3802: { id: 3802, name: 'Lost Chapter', cost: 1200, type: 'component', components: [1052] },
  3145: { id: 3145, name: 'Hextech Alternator', cost: 1100, type: 'component', components: [1052, 1052] },
  2508: { id: 2508, name: 'Fated Ashes', cost: 900, type: 'component', components: [1052] },
  4630: { id: 4630, name: 'Blighting Jewel', cost: 1100, type: 'component', tags: ['mpen'], components: [1052] },
  4632: { id: 4632, name: 'Verdant Barrier', cost: 1600, type: 'component', tags: ['mr'], components: [1033, 1052] },
  3108: { id: 3108, name: 'Fiendish Codex', cost: 850, type: 'component', components: [1052] },
  3133: { id: 3133, name: "Caulfield's Warhammer", cost: 1050, type: 'component', components: [1036, 1036] },
  3134: { id: 3134, name: 'Serrated Dirk', cost: 1000, type: 'component', components: [1036, 1036] },
  3057: { id: 3057, name: 'Sheen', cost: 900, type: 'component' },
  3044: { id: 3044, name: 'Phage', cost: 1100, type: 'component', components: [1028, 1036] },
  3067: { id: 3067, name: 'Kindlegem', cost: 800, type: 'component', components: [1028] },
  2021: { id: 2021, name: 'Tunneler', cost: 1150, type: 'component', components: [1036, 1028] },
  2019: { id: 2019, name: 'Steel Sigil', cost: 1100, type: 'component', tags: ['armor'], components: [1036, 1029] },
  3035: { id: 3035, name: 'Last Whisper', cost: 1450, type: 'component', tags: ['apen'], components: [1036, 1036] },
  3916: { id: 3916, name: 'Oblivion Orb', cost: 800, type: 'component', tags: ['antiheal'], components: [1052] },
  3123: { id: 3123, name: "Executioner's Calling", cost: 800, type: 'component', tags: ['antiheal'], components: [1036] },
  3076: { id: 3076, name: 'Bramble Vest', cost: 800, type: 'component', tags: ['antiheal', 'armor'], components: [1029, 1029] },
  2420: { id: 2420, name: "Seeker's Armguard", cost: 1600, type: 'component', tags: ['armor'], components: [1052, 1029, 1052] },
  3155: { id: 3155, name: 'Hexdrinker', cost: 1300, type: 'component', tags: ['mr'], components: [1036, 1033] },
  3140: { id: 3140, name: 'Quicksilver Sash', cost: 1300, type: 'component', tags: ['qss', 'mr'], components: [1033] },
  3082: { id: 3082, name: "Warden's Mail", cost: 1000, type: 'component', tags: ['armor'], components: [1029, 1029] },
  3211: { id: 3211, name: "Spectre's Cowl", cost: 1250, type: 'component', tags: ['mr'], components: [1028, 1033] },

  // Tier 2 Boots
  3020: { id: 3020, name: "Sorcerer's Shoes", cost: 1100, type: 'boots', stats: '+15 Magic Pen, +45 MS', components: [1001] },
  3111: { id: 3111, name: "Mercury's Treads", cost: 1250, type: 'boots', stats: '+25 MR, +30% Tenacity', tags: ['mr', 'tenacity'], components: [1001, 1033] },
  3047: { id: 3047, name: 'Plated Steelcaps', cost: 1200, type: 'boots', stats: '+25 Armor, -10% Auto Dmg', tags: ['armor'], components: [1001, 1029] },
  3006: { id: 3006, name: "Berserker's Greaves", cost: 1100, type: 'boots', stats: '+35% Attack Speed, +45 MS', components: [1001] },
  3158: { id: 3158, name: 'Ionian Boots of Lucidity', cost: 900, type: 'boots', stats: '+15 Ability Haste, +45 MS', components: [1001] },
  3009: { id: 3009, name: 'Boots of Swiftness', cost: 1000, type: 'boots', stats: '+60 MS, 25% Slow Resist', components: [1001] },

  // AP / Mage Items
  3118: { id: 3118, name: 'Malignance', cost: 2700, type: 'legendary', stats: '85 AP, 600 Mana, Ult Haste', components: [3802, 1026] },
  6655: { id: 6655, name: "Luden's Companion", cost: 2750, type: 'legendary', stats: '95 AP, 600 Mana, Burst', components: [3802, 3145] },
  2503: { id: 2503, name: 'Blackfire Torch', cost: 2800, type: 'legendary', stats: '80 AP, 600 Mana, Burn', components: [3802, 2508] },
  4645: { id: 4645, name: 'Shadowflame', cost: 3200, type: 'legendary', stats: '110 AP, +15 Magic Pen, Crit Low HP', components: [3145, 1058] },
  3157: { id: 3157, name: "Zhonya's Hourglass", cost: 3250, type: 'legendary', stats: '105 AP, 50 Armor, Stasis Active', tags: ['armor', 'anti_burst'], components: [2420, 1058] },
  3102: { id: 3102, name: "Banshee's Veil", cost: 3000, type: 'legendary', stats: '105 AP, 40 MR, Spell Shield', tags: ['mr', 'anti_cc'], components: [4632, 1058] },
  3089: { id: 3089, name: "Rabadon's Deathcap", cost: 3500, type: 'legendary', stats: '130 AP, +30% Total AP', components: [1058, 1058] },
  3135: { id: 3135, name: 'Void Staff', cost: 3000, type: 'legendary', stats: '95 AP, +40% Magic Pen', tags: ['mpen'], components: [4630, 1026] },
  3165: { id: 3165, name: 'Morellonomicon', cost: 2850, type: 'legendary', stats: '75 AP, 15 AH, 40% Grievous Wounds', tags: ['antiheal'], components: [3916, 1026, 3067] },
  6653: { id: 6653, name: "Liandry's Torment", cost: 3000, type: 'legendary', stats: '70 AP, 300 HP, % Max HP Burn', tags: ['anti_tank'], components: [2508] },
  3100: { id: 3100, name: 'Lich Bane', cost: 2900, type: 'legendary', stats: '100 AP, 15 AH, Spellblade', components: [3057, 1026] },
  4628: { id: 4628, name: 'Horizon Focus', cost: 2700, type: 'legendary', stats: '75 AP, 25 AH, Long-Range Reveal', components: [3108, 3108] },

  // Fighter / Bruiser Items
  6692: { id: 6692, name: 'Eclipse', cost: 2900, type: 'legendary', stats: '60 AD, 15 AH, % HP Shield Proc', components: [3133, 1037] },
  6610: { id: 6610, name: 'Sundered Sky', cost: 3100, type: 'legendary', stats: '45 AD, 400 HP, First-Hit Crit & Heal', components: [2021, 3133] },
  3071: { id: 3071, name: 'Black Cleaver', cost: 3000, type: 'legendary', stats: '40 AD, 400 HP, 30% Armor Shred', tags: ['anti_tank', 'apen'], components: [3044, 3067, 1037] },
  3053: { id: 3053, name: "Sterak's Gage", cost: 3200, type: 'legendary', stats: '+400 HP, Base AD, Lifeline Shield', tags: ['anti_burst', 'tenacity'], components: [1037, 2021] },
  6333: { id: 6333, name: "Death's Dance", cost: 3300, type: 'legendary', stats: '60 AD, 50 Armor, 30% Bleed Mitigation', tags: ['armor', 'anti_burst'], components: [2019, 3133, 1037] },
  3156: { id: 3156, name: 'Maw of Malmortius', cost: 3100, type: 'legendary', stats: '60 AD, 40 MR, Magic Lifeline Shield', tags: ['mr'], components: [3155, 3133] },
  3078: { id: 3078, name: 'Trinity Force', cost: 3333, type: 'legendary', stats: '36 AD, 30% AS, 333 HP, 200% Spellblade', components: [3057, 3044] },
  3161: { id: 3161, name: 'Spear of Shojin', cost: 3100, type: 'legendary', stats: '45 AD, 450 HP, +Basic Ability Haste', components: [1037, 2021] },
  3026: { id: 3026, name: 'Guardian Angel', cost: 3200, type: 'legendary', stats: '55 AD, 45 Armor, Rebirth Passive', tags: ['armor'], components: [2019, 1038] },
  6609: { id: 6609, name: 'Chempunk Chainsword', cost: 3000, type: 'legendary', stats: '45 AD, 450 HP, 40% Grievous Wounds', tags: ['antiheal'], components: [3123, 3133] },

  // ADC / Marksman Items
  6672: { id: 6672, name: 'Kraken Slayer', cost: 3000, type: 'legendary', stats: '50 AD, 40% AS, 3-Hit Bonus Dmg' },
  3031: { id: 3031, name: 'Infinity Edge', cost: 3500, type: 'legendary', stats: '80 AD, 25% Crit, +40% Crit Dmg', components: [1038, 1037] },
  3085: { id: 3085, name: "Runaan's Hurricane", cost: 2650, type: 'legendary', stats: '40% AS, 25% Crit, AoE Bolts' },
  3094: { id: 3094, name: 'Rapid Firecannon', cost: 2650, type: 'legendary', stats: '35% AS, 25% Crit, +150 Energized Range' },
  3036: { id: 3036, name: "Lord Dominik's Regards", cost: 3300, type: 'legendary', stats: '45 AD, 25% Crit, +40% Armor Pen', tags: ['anti_tank', 'apen'], components: [3035] },
  3033: { id: 3033, name: 'Mortal Reminder', cost: 3000, type: 'legendary', stats: '35 AD, 35% Armor Pen, 40% Grievous Wounds', tags: ['antiheal', 'apen'], components: [3123, 3035] },
  3072: { id: 3072, name: 'Bloodthirster', cost: 3400, type: 'legendary', stats: '80 AD, 15% Lifesteal, Overshield', components: [1038, 1037] },
  3153: { id: 3153, name: 'Blade of the Ruined King', cost: 3200, type: 'legendary', stats: '40 AD, 25% AS, % Current HP On-Hit', tags: ['anti_tank'], components: [1037] },

  // Assassin Items
  3142: { id: 3142, name: "Youmuu's Ghostblade", cost: 2800, type: 'legendary', stats: '60 AD, +18 Lethality, Out-of-Combat MS', components: [3134] },
  6701: { id: 6701, name: 'Opportunity', cost: 2700, type: 'legendary', stats: '55 AD, +18 Lethality, Takedown MS', components: [3134, 1037] },
  3814: { id: 3814, name: 'Edge of Night', cost: 3000, type: 'legendary', stats: '50 AD, +15 Lethality, Spell Shield', tags: ['anti_cc'], components: [3134, 2021] },
  6694: { id: 6694, name: "Serylda's Grudge", cost: 3000, type: 'legendary', stats: '45 AD, 15 AH, Armor Pen & Ability Slow', tags: ['apen'], components: [3133, 3035] },

  // Tank & Support Items
  3190: { id: 3190, name: 'Locket of the Iron Solari', cost: 2200, type: 'legendary', stats: '200 HP, 30 Armor, 30 MR, Team Shield Active', tags: ['armor', 'mr', 'anti_burst'], components: [3067, 1029, 1033] },
  3109: { id: 3109, name: "Knight's Vow", cost: 2300, type: 'legendary', stats: '200 HP, 40 Armor, Redirect Carry Dmg', tags: ['armor'], components: [3067, 1031] },
  3107: { id: 3107, name: 'Redemption', cost: 2300, type: 'legendary', stats: '200 HP, 15 AH, AoE Heal Active', components: [3067] },
  3075: { id: 3075, name: 'Thornmail', cost: 2450, type: 'legendary', stats: '150 HP, 75 Armor, 40% Grievous Wounds', tags: ['antiheal', 'armor'], components: [3076, 1031] },
  3110: { id: 3110, name: 'Frozen Heart', cost: 2500, type: 'legendary', stats: '65 Armor, 400 Mana, -20% Enemy Attack Speed', tags: ['armor', 'anti_auto'], components: [3082] },
  2504: { id: 2504, name: 'Kaenic Rookern', cost: 2900, type: 'legendary', stats: '400 HP, 80 MR, 18% Max HP Magic Shield', tags: ['mr'], components: [3211, 1057] },
  3065: { id: 3065, name: 'Spirit Visage', cost: 2700, type: 'legendary', stats: '400 HP, 50 MR, +25% Heal & Shield Power', tags: ['mr'], components: [3211, 3067] },
  3143: { id: 3143, name: "Randuin's Omen", cost: 2700, type: 'legendary', stats: '350 HP, 75 Armor, -30% Crit Damage Taken', tags: ['armor', 'anti_crit'], components: [3082] }
};

// Champion Classification Database (Damage Profile, Healer, Tank, Hard CC, Crit)
const CHAMPION_TRAITS = {
  // Mages / AP
  Ahri: { dmg: 'AP', archetype: 'MAGE', cc: true },
  Lux: { dmg: 'AP', archetype: 'MAGE', cc: true },
  Syndra: { dmg: 'AP', archetype: 'MAGE', cc: true },
  Orianna: { dmg: 'AP', archetype: 'MAGE', cc: true },
  Viktor: { dmg: 'AP', archetype: 'MAGE', cc: false },
  Sylas: { dmg: 'AP', archetype: 'MAGE', healer: true, cc: true },
  Katarina: { dmg: 'AP', archetype: 'MAGE', burst: true },
  Akali: { dmg: 'AP', archetype: 'MAGE', burst: true },
  Diana: { dmg: 'AP', archetype: 'MAGE', burst: true },
  Evelynn: { dmg: 'AP', archetype: 'MAGE', burst: true },
  LeBlanc: { dmg: 'AP', archetype: 'MAGE', burst: true, cc: true },
  Veigar: { dmg: 'AP', archetype: 'MAGE', burst: true, cc: true },
  Brand: { dmg: 'AP', archetype: 'MAGE' },
  Lissandra: { dmg: 'AP', archetype: 'MAGE', cc: true },
  Swain: { dmg: 'AP', archetype: 'MAGE', healer: true, tank: true },
  Vladimir: { dmg: 'AP', archetype: 'MAGE', healer: true },
  Mordekaiser: { dmg: 'AP', archetype: 'BRUISER', tank: true },

  // Assassins / AD Burst
  Zed: { dmg: 'AD', archetype: 'ASSASSIN', burst: true },
  Talon: { dmg: 'AD', archetype: 'ASSASSIN', burst: true },
  Qiyana: { dmg: 'AD', archetype: 'ASSASSIN', burst: true, cc: true },
  KhaZix: { dmg: 'AD', archetype: 'ASSASSIN', burst: true },
  "Kha'Zix": { dmg: 'AD', archetype: 'ASSASSIN', burst: true },
  Rengar: { dmg: 'AD', archetype: 'ASSASSIN', burst: true },
  Pyke: { dmg: 'AD', archetype: 'ASSASSIN', burst: true, cc: true },
  Naafiri: { dmg: 'AD', archetype: 'ASSASSIN', burst: true },

  // Fighters / Bruisers
  Aatrox: { dmg: 'AD', archetype: 'BRUISER', healer: true },
  Darius: { dmg: 'AD', archetype: 'BRUISER', healer: true, tank: true },
  'Lee Sin': { dmg: 'AD', archetype: 'BRUISER', burst: true },
  LeeSin: { dmg: 'AD', archetype: 'BRUISER', burst: true },
  Kayn: { dmg: 'AD', archetype: 'BRUISER', healer: true, burst: true },
  Briar: { dmg: 'AD', archetype: 'BRUISER', healer: true, cc: true },
  Warwick: { dmg: 'MIXED', archetype: 'BRUISER', healer: true, cc: true },
  Irelia: { dmg: 'AD', archetype: 'BRUISER', healer: true, auto: true },
  Fiora: { dmg: 'AD', archetype: 'BRUISER', healer: true },
  Camille: { dmg: 'AD', archetype: 'BRUISER', burst: true },
  Jax: { dmg: 'MIXED', archetype: 'BRUISER', auto: true, cc: true },
  Renekton: { dmg: 'AD', archetype: 'BRUISER', healer: true, cc: true },
  Viego: { dmg: 'AD', archetype: 'BRUISER', healer: true, auto: true },
  Yasuo: { dmg: 'AD', archetype: 'ADC', crit: true, auto: true },
  Yone: { dmg: 'MIXED', archetype: 'ADC', crit: true, auto: true, burst: true },
  Garen: { dmg: 'AD', archetype: 'BRUISER', tank: true },
  Sett: { dmg: 'AD', archetype: 'BRUISER', tank: true, cc: true },
  Illaoi: { dmg: 'AD', archetype: 'BRUISER', healer: true, tank: true },

  // ADCs / Marksmen
  Jinx: { dmg: 'AD', archetype: 'ADC', crit: true, auto: true },
  Vayne: { dmg: 'AD', archetype: 'ADC', auto: true },
  Caitlyn: { dmg: 'AD', archetype: 'ADC', crit: true, auto: true },
  KaiSa: { dmg: 'MIXED', archetype: 'ADC', auto: true },
  "Kai'Sa": { dmg: 'MIXED', archetype: 'ADC', auto: true },
  Ezreal: { dmg: 'AD', archetype: 'ADC' },
  Jhin: { dmg: 'AD', archetype: 'ADC', crit: true },
  Draven: { dmg: 'AD', archetype: 'ADC', crit: true, auto: true, healer: true },
  Lucian: { dmg: 'AD', archetype: 'ADC', crit: true, auto: true },
  Samira: { dmg: 'AD', archetype: 'ADC', crit: true, healer: true },
  Ashe: { dmg: 'AD', archetype: 'ADC', auto: true, cc: true },
  Tristana: { dmg: 'AD', archetype: 'ADC', crit: true, auto: true },

  // Tanks & Supports
  Thresh: { dmg: 'AP', archetype: 'SUPPORT_TANK', tank: true, cc: true },
  Nautilus: { dmg: 'AP', archetype: 'SUPPORT_TANK', tank: true, cc: true },
  Leona: { dmg: 'AP', archetype: 'SUPPORT_TANK', tank: true, cc: true },
  Blitzcrank: { dmg: 'AP', archetype: 'SUPPORT_TANK', tank: true, cc: true },
  Malphite: { dmg: 'AP', archetype: 'TANK', tank: true, cc: true },
  Ornn: { dmg: 'AP', archetype: 'TANK', tank: true, cc: true },
  Sion: { dmg: 'AD', archetype: 'TANK', tank: true, cc: true },
  'Dr. Mundo': { dmg: 'AP', archetype: 'TANK', tank: true, healer: true },
  DrMundo: { dmg: 'AP', archetype: 'TANK', tank: true, healer: true },
  Zac: { dmg: 'AP', archetype: 'TANK', tank: true, healer: true, cc: true },
  Sejuani: { dmg: 'AP', archetype: 'TANK', tank: true, cc: true },
  Amumu: { dmg: 'AP', archetype: 'TANK', tank: true, cc: true },
  Soraka: { dmg: 'AP', archetype: 'SUPPORT_ENCHANTER', healer: true },
  Yuumi: { dmg: 'AP', archetype: 'SUPPORT_ENCHANTER', healer: true },
  Nami: { dmg: 'AP', archetype: 'SUPPORT_ENCHANTER', healer: true, cc: true },
  Lulu: { dmg: 'AP', archetype: 'SUPPORT_ENCHANTER', cc: true }
};

// Core Build Templates per Champion / Archetype
const ARCHETYPE_BUILDS = {
  MAGE: {
    boots: 3020, // Sorcerer's Shoes
    core: [3118, 4645, 3157, 3089, 3135],
    situational: {
      anti_ad_burst: { id: 3157, reason: 'Stasis-Schutz gegen AD-Burst & Assassinen' },
      anti_ap_burst: { id: 3102, reason: 'Spell-Shield gegen gefährlichen AP-Burst / CC' },
      anti_heal: { id: 3165, reason: 'Grievous Wounds gegen starke Gegner-Heilung' },
      anti_tank: { id: 3135, reason: '40% Magic Pen gegen hohe Magieresistenz' }
    }
  },
  BRUISER: {
    boots: 3047, // Plated Steelcaps (or 3111 Mercs)
    core: [6692, 6610, 3071, 6333, 3053],
    situational: {
      anti_ad_burst: { id: 6333, reason: '30% Schadensverzögerung gegen schweren AD-Burst' },
      anti_ap_burst: { id: 3156, reason: 'Magischer Lifeline-Schild gegen AP-Carry' },
      anti_heal: { id: 6609, reason: 'Anti-Heal gegen starke Selbstheiler' },
      anti_tank: { id: 3071, reason: '30% Rüstungs-Shred für lange Fights gegen Tanks' }
    }
  },
  ADC: {
    boots: 3006, // Berserker's Greaves
    core: [6672, 3031, 3085, 3036, 3072],
    situational: {
      anti_ad_burst: { id: 3026, reason: 'Wiederbelebung gegen feindliche Dive-Assassinen' },
      anti_ap_burst: { id: 3156, reason: 'Lifeline-Schild gegen AP-One-Shots' },
      anti_heal: { id: 3033, reason: 'Rüstungsdurchdringung + Anti-Heal in einem Slot' },
      anti_tank: { id: 3036, reason: '40% Armor Pen gegen gepanzerte Frontline' }
    }
  },
  ASSASSIN: {
    boots: 3158, // Ionian Boots
    core: [3142, 6701, 3814, 6694, 3026],
    situational: {
      anti_ad_burst: { id: 6333, reason: 'Überlebe Counter-Burst nach deinem All-In' },
      anti_ap_burst: { id: 3814, reason: 'Spell-Shield blockt CC & AP-Peel beim Engage' },
      anti_heal: { id: 6609, reason: 'Reduziert Heilung deines Ziel-Carrys um 40%' },
      anti_tank: { id: 6694, reason: 'Armor Pen gegen gegnerische Rüstungs-Käufe' }
    }
  },
  SUPPORT_TANK: {
    boots: 3111, // Mercury's Treads
    core: [3190, 3109, 3075, 2504, 3110],
    situational: {
      anti_ad_burst: { id: 3110, reason: 'Senkt gegnerisches Angriffstempo um 20%' },
      anti_ap_burst: { id: 2504, reason: 'Massiver Magie-Schild gegen AP-Poke & Burst' },
      anti_heal: { id: 3075, reason: 'Reflektiert Schaden & wendet Anti-Heal an' },
      anti_tank: { id: 3109, reason: 'Schützt deinen gefeedeten Carry im Front-to-Back' }
    }
  },
  TANK: {
    boots: 3047,
    core: [3075, 2504, 3143, 3065, 3110],
    situational: {
      anti_ad_burst: { id: 3143, reason: '-30% erlittener Krit-Schaden gegen AD-Carrys' },
      anti_ap_burst: { id: 2504, reason: 'Stärkste MR-Barriere gegen Magier' },
      anti_heal: { id: 3075, reason: '40% Klaffende Wunden bei gegnerischen Auto-Attacks' },
      anti_tank: { id: 3065, reason: 'Verstärkt eigene Schilde & Heilung im Tank-Duell' }
    }
  }
};

class BuildAdvisor {
  constructor(ddragonVersion = '16.22.1') {
    this.ddragonVersion = ddragonVersion;
  }

  setVersion(version) {
    if (version) this.ddragonVersion = version;
  }

  getItemIcon(itemId) {
    return `https://ddragon.leagueoflegends.com/cdn/${this.ddragonVersion}/img/item/${itemId}.png`;
  }

  getItemMeta(itemId) {
    const numId = Number(itemId);
    const meta = ITEM_CATALOG[numId] || {
      id: numId,
      name: `Item #${numId}`,
      cost: 1000,
      type: 'component',
      stats: ''
    };
    return {
      ...meta,
      icon: this.getItemIcon(numId)
    };
  }

  /**
   * Normalizes raw items array from Riot Live Client API (or Demo) into 6 main inventory slots + trinket slot
   */
  normalizePlayerInventory(rawItems = []) {
    const slots = [null, null, null, null, null, null];
    let trinket = null;
    const ownedList = [];

    rawItems.forEach((raw, idx) => {
      if (!raw) return;
      const itemId = Number(raw.itemID || raw.id || 0);
      if (!itemId) return;

      const meta = this.getItemMeta(itemId);
      const slotIndex = typeof raw.slot === 'number' ? raw.slot : idx;
      const entry = {
        ...meta,
        id: itemId,
        name: raw.displayName || raw.name || meta.name,
        count: raw.count || 1,
        slot: slotIndex
      };

      if (slotIndex === 6 || meta.type === 'trinket' || [3340, 3363, 3364].includes(itemId)) {
        trinket = entry;
      } else if (slotIndex >= 0 && slotIndex < 6 && !slots[slotIndex]) {
        slots[slotIndex] = entry;
        ownedList.push(entry);
      } else {
        const freeIdx = slots.findIndex((s) => s === null);
        if (freeIdx !== -1) {
          entry.slot = freeIdx;
          slots[freeIdx] = entry;
        }
        ownedList.push(entry);
      }
    });

    return {
      slots,
      trinket,
      ownedList
    };
  }

  inferArchetype(championName, position) {
    const trait = CHAMPION_TRAITS[championName];
    if (trait && trait.archetype && ARCHETYPE_BUILDS[trait.archetype]) {
      return trait.archetype;
    }
    const pos = (position || '').toUpperCase();
    if (pos === 'BOTTOM') return 'ADC';
    if (pos === 'UTILITY') return 'SUPPORT_TANK';
    if (pos === 'TOP') return 'BRUISER';
    if (pos === 'JUNGLE') return 'BRUISER';
    return 'MAGE';
  }

  /**
   * Analyzes enemy team composition, enemy items & live KDA to identify key threats
   */
  analyzeEnemyThreats(enemyTeam = []) {
    let adCount = 0;
    let apCount = 0;
    let tankCount = 0;
    let healerCount = 0;
    let ccCount = 0;
    let critCount = 0;
    let enemyStackingMr = 0;
    let enemyStackingArmor = 0;

    let fedThreat = null;
    let maxThreatScore = -1;

    const healingChamps = [];
    const burstThreats = [];

    for (const enemy of enemyTeam) {
      const champ = enemy.championName || '';
      const trait = CHAMPION_TRAITS[champ] || { dmg: 'AD', archetype: 'BRUISER' };
      const kills = enemy.kills || 0;
      const assists = enemy.assists || 0;
      const deaths = enemy.deaths || 0;

      // Inspect enemy's actual purchased items if available
      const enemyItems = Array.isArray(enemy.items) ? enemy.items : [];
      for (const eq of enemyItems) {
        const eqMeta = ITEM_CATALOG[Number(eq.itemID || eq.id)];
        if (eqMeta && Array.isArray(eqMeta.tags)) {
          if (eqMeta.tags.includes('mr')) enemyStackingMr++;
          if (eqMeta.tags.includes('armor')) enemyStackingArmor++;
        }
      }

      // Weight damage profile by how fed the enemy is
      const weight = 1 + Math.max(0, kills - deaths) * 0.25;
      if (trait.dmg === 'AP') apCount += weight;
      else if (trait.dmg === 'MIXED') {
        adCount += weight * 0.5;
        apCount += weight * 0.5;
      } else {
        adCount += weight;
      }

      if (trait.tank) tankCount++;
      if (trait.healer) {
        healerCount++;
        healingChamps.push(champ);
      }
      if (trait.cc) ccCount++;
      if (trait.crit) critCount++;

      // Calculate threat score
      const threatScore = kills * 3 + assists * 1 - deaths * 1.2 + (enemy.csPerMin || 5) * 0.5;
      if (threatScore > maxThreatScore) {
        maxThreatScore = threatScore;
        fedThreat = {
          championName: champ,
          kills,
          deaths,
          assists,
          dmg: trait.dmg || 'AD',
          burst: Boolean(trait.burst),
          healer: Boolean(trait.healer)
        };
      }

      if ((trait.burst || kills >= 3) && kills > deaths) {
        burstThreats.push({ championName: champ, kills, deaths, dmg: trait.dmg || 'AD' });
      }
    }

    const totalDmgWeight = Math.max(1, adCount + apCount);
    const adPercent = Math.round((adCount / totalDmgWeight) * 100);
    const apPercent = 100 - adPercent;

    const alerts = [];
    if (fedThreat && fedThreat.kills >= 3) {
      alerts.push({
        type: 'danger',
        label: `Fed ${fedThreat.championName} (${fedThreat.kills}/${fedThreat.deaths})`,
        detail: `${fedThreat.dmg}-Threat`
      });
    } else if (burstThreats.length > 0) {
      const b = burstThreats[0];
      alerts.push({
        type: 'warning',
        label: `${b.championName} Burst-Gefahr`,
        detail: `${b.dmg}-Assassine/Diver`
      });
    }

    if (
      healerCount >= 2 ||
      (healerCount >= 1 &&
        healingChamps.some((c) =>
          ['Aatrox', 'Darius', 'Soraka', 'Dr. Mundo', 'Sylas', 'Warwick', 'Briar', 'Kayn'].includes(c)
        ))
    ) {
      alerts.push({
        type: 'antiheal',
        label: `Anti-Heal nötig (${healingChamps.slice(0, 2).join(', ')})`,
        detail: '40% Klaffende Wunden'
      });
    }

    if (tankCount >= 2 || enemyStackingMr >= 2 || enemyStackingArmor >= 2) {
      alerts.push({
        type: 'pen',
        label:
          enemyStackingMr >= 2
            ? 'Gegner baut Magieresistenz'
            : enemyStackingArmor >= 2
              ? 'Gegner baut Rüstung'
              : `${tankCount}x Frontline / Tanks`,
        detail: '%-Penetration einplanen'
      });
    } else if (ccCount >= 3) {
      alerts.push({
        type: 'tenacity',
        label: 'Hohe CC-Kette',
        detail: 'Tenacity / Spell-Shield stark'
      });
    }

    return {
      adPercent,
      apPercent,
      tankCount,
      healerCount,
      ccCount,
      critCount,
      enemyStackingMr,
      enemyStackingArmor,
      healingChamps,
      fedThreat,
      burstThreats,
      alerts: alerts.slice(0, 3)
    };
  }

  /**
   * Generates a complete situational build recommendation for the active player
   */
  generateRecommendations({ championName, position, currentGold = 0, ownedItems = [], enemyTeam = [] }) {
    const archetype = this.inferArchetype(championName, position);
    const template = ARCHETYPE_BUILDS[archetype] || ARCHETYPE_BUILDS.MAGE;
    const threatAnalysis = this.analyzeEnemyThreats(enemyTeam);

    // Normalize 6 inventory slots + trinket
    const inventory = this.normalizePlayerInventory(ownedItems);
    const nonTrinketOwned = inventory.ownedList;

    // Count how many of each item ID we currently own in inventory (for component deduction)
    const ownedCountById = {};
    for (const item of nonTrinketOwned) {
      ownedCountById[item.id] = (ownedCountById[item.id] || 0) + (item.count || 1);
    }
    const ownedIds = new Set(nonTrinketOwned.map((i) => i.id));

    // Check if player already has Tier 2 boots
    const tier2BootsIds = [3020, 3111, 3047, 3006, 3158, 3009];
    const hasTier2Boots = nonTrinketOwned.some((i) => tier2BootsIds.includes(i.id));
    const hasTier1Boots = ownedIds.has(1001);

    // Check if player already has Anti-Heal
    const antiHealIds = [3916, 3165, 3123, 6609, 3033, 3076, 3075];
    const hasAntiHeal = nonTrinketOwned.some((i) => antiHealIds.includes(i.id));

    // Build candidate recommendations list with priority & situational reasons
    const candidates = [];

    // 1. Recommended Boots (if not owned yet)
    if (!hasTier2Boots) {
      let bootId = template.boots;
      let bootReason = 'Standard-Powerspike für Mobilität & Tempo';

      if (threatAnalysis.ccCount >= 3 || threatAnalysis.apPercent >= 65) {
        if (archetype === 'BRUISER' || archetype === 'TANK' || archetype === 'SUPPORT_TANK') {
          bootId = 3111; // Mercs
          bootReason = `30% Zähigkeit & MR gegen ${threatAnalysis.apPercent}% AP / viel CC`;
        }
      } else if (threatAnalysis.adPercent >= 70) {
        if (archetype === 'BRUISER' || archetype === 'TANK' || archetype === 'SUPPORT_TANK') {
          bootId = 3047; // Steelcaps
          bootReason = `Blockt 10% Auto-Attack Schaden gegen ${threatAnalysis.adPercent}% AD-Team`;
        }
      }

      candidates.push({
        id: bootId,
        priority: nonTrinketOwned.length >= 2 ? 95 : 82,
        category: 'SCHUHE',
        reason: bootReason
      });
    }

    // 2. Situational Counter Items based on Enemy Threats & Enemy Items
    const hasAdBurstThreat =
      (threatAnalysis.fedThreat && threatAnalysis.fedThreat.dmg === 'AD' && threatAnalysis.fedThreat.kills >= 3) ||
      threatAnalysis.burstThreats.some((b) => b.dmg === 'AD') ||
      threatAnalysis.adPercent >= 65;

    const hasApBurstThreat =
      (threatAnalysis.fedThreat && threatAnalysis.fedThreat.dmg === 'AP' && threatAnalysis.fedThreat.kills >= 3) ||
      threatAnalysis.burstThreats.some((b) => b.dmg === 'AP') ||
      threatAnalysis.apPercent >= 60;

    if (hasAdBurstThreat && template.situational.anti_ad_burst) {
      const sit = template.situational.anti_ad_burst;
      const adNames = threatAnalysis.burstThreats
        .filter((b) => b.dmg === 'AD')
        .map((b) => b.championName)
        .join(' & ');
      candidates.push({
        id: sit.id,
        priority: 92,
        category: 'DEFENSIV VS AD',
        reason: adNames ? `Kontert ${adNames} Burst (${sit.reason})` : sit.reason
      });
    }

    if (hasApBurstThreat && template.situational.anti_ap_burst) {
      const sit = template.situational.anti_ap_burst;
      candidates.push({
        id: sit.id,
        priority: 90,
        category: 'DEFENSIV VS AP',
        reason: sit.reason
      });
    }

    if (threatAnalysis.healerCount >= 1 && !hasAntiHeal && template.situational.anti_heal) {
      const sit = template.situational.anti_heal;
      const healers = threatAnalysis.healingChamps.slice(0, 2).join(', ');
      const compId =
        archetype === 'MAGE' ? 3916 : archetype === 'TANK' || archetype === 'SUPPORT_TANK' ? 3076 : 3123;
      candidates.push({
        id: sit.id,
        priority: 88,
        category: 'ANTI-HEAL KONTER',
        reason: `Reduziert Heilung von ${healers || 'Gegnern'} um 40%`,
        fastComponentId: compId
      });
    }

    if (
      (threatAnalysis.tankCount >= 2 ||
        (archetype === 'MAGE' && threatAnalysis.enemyStackingMr >= 2) ||
        (archetype !== 'MAGE' && threatAnalysis.enemyStackingArmor >= 2)) &&
      template.situational.anti_tank
    ) {
      const sit = template.situational.anti_tank;
      candidates.push({
        id: sit.id,
        priority: 89,
        category: 'ANTI-TANK PEN',
        reason: sit.reason
      });
    }

    // 3. Fill remaining slots from Champion Core Progression
    template.core.forEach((coreId, idx) => {
      candidates.push({
        id: coreId,
        priority: 85 - idx * 6,
        category: idx === 0 ? '1. CORE SPIKE' : 'CORE BUILD',
        reason:
          idx === 0
            ? `Wichtigster 1-Item Powerspike für ${championName}`
            : `Starker Skalierungs-Spike für ${championName} im Mid/Late-Game`
      });
    });

    // Deduplicate & remove already owned completed items
    const seen = new Set();
    const filtered = [];
    for (const c of candidates) {
      if (ownedIds.has(c.id) || seen.has(c.id)) continue;
      seen.add(c.id);

      const meta = this.getItemMeta(c.id);
      let discount = 0;
      const ownedComponents = [];
      const missingComponents = [];

      // Check direct components and sub-components in player's inventory
      const tempOwnedCounts = { ...ownedCountById };
      if (Array.isArray(meta.components)) {
        for (const compId of meta.components) {
          const compMeta = this.getItemMeta(compId);
          if (tempOwnedCounts[compId] > 0) {
            tempOwnedCounts[compId]--;
            discount += compMeta.cost || 0;
            ownedComponents.push(compMeta.name);
          } else {
            // Check if player owns a basic sub-component of this epic component (e.g. Amplifying Tome for Seeker's)
            let subDiscount = 0;
            if (Array.isArray(compMeta.components)) {
              for (const subId of compMeta.components) {
                if (tempOwnedCounts[subId] > 0) {
                  tempOwnedCounts[subId]--;
                  const subMeta = this.getItemMeta(subId);
                  subDiscount += subMeta.cost || 0;
                  ownedComponents.push(subMeta.name);
                }
              }
            }
            discount += subDiscount;
            missingComponents.push({
              ...compMeta,
              remainingCompCost: Math.max(0, (compMeta.cost || 0) - subDiscount)
            });
          }
        }
      }

      const remainingCost = Math.max(0, (meta.cost || 2800) - discount);
      const canAffordFull = currentGold >= remainingCost;
      const goldNeeded = Math.max(0, remainingCost - currentGold);

      // Determine best immediate component buy if full item isn't affordable yet
      let nextComponentBuy = null;
      if (!canAffordFull) {
        if (c.fastComponentId && !ownedIds.has(c.fastComponentId)) {
          const fc = this.getItemMeta(c.fastComponentId);
          nextComponentBuy = {
            ...fc,
            canAfford: currentGold >= fc.cost,
            goldDiff: Math.max(0, fc.cost - currentGold)
          };
        } else if (missingComponents.length > 0) {
          const mc = missingComponents[0];
          const effCost = mc.remainingCompCost ?? mc.cost;
          nextComponentBuy = {
            ...mc,
            cost: effCost,
            canAfford: currentGold >= effCost,
            goldDiff: Math.max(0, effCost - currentGold)
          };
        }
      }

      filtered.push({
        ...meta,
        category: c.category,
        reason: c.reason,
        priority: c.priority + (ownedComponents.length > 0 ? 15 : 0), // Prioritize items we already started building!
        remainingCost,
        canAffordFull,
        goldNeeded,
        ownedComponents,
        nextComponentBuy
      });
    }

    // Sort by priority descending
    filtered.sort((a, b) => b.priority - a.priority);

    const nextItems = filtered.slice(0, 3);

    // Determine immediate Recall / Shop Action Advice based on currentGold
    const primaryTarget = nextItems[0] || null;
    let recallAdvice = {
      status: 'FARM',
      headline: 'Weiter farmen für nächsten Spike',
      subtext: ''
    };

    if (primaryTarget) {
      if (primaryTarget.canAffordFull) {
        recallAdvice = {
          status: 'BUY_NOW',
          headline: `KAUFBEREIT: ${primaryTarget.name} (${primaryTarget.remainingCost} G)`,
          subtext: 'Perfekter Recall-Zeitpunkt! Du kannst dein nächstes Voll-Item direkt fertigstellen.'
        };
      } else if (primaryTarget.nextComponentBuy && primaryTarget.nextComponentBuy.canAfford) {
        const comp = primaryTarget.nextComponentBuy;
        recallAdvice = {
          status: 'COMPONENT_READY',
          headline: `Teil-Item kaufbar: ${comp.name} (${comp.cost} G)`,
          subtext: `Noch ${primaryTarget.goldNeeded} G bis ${primaryTarget.name} komplett ist.`
        };
      } else {
        const wavesNeeded = Math.max(1, Math.ceil(primaryTarget.goldNeeded / 125));
        recallAdvice = {
          status: 'FARM',
          headline: `Noch ${primaryTarget.goldNeeded} G für ${primaryTarget.name}`,
          subtext: `Entspricht ca. ${wavesNeeded} Minion-Wave${wavesNeeded > 1 ? 's' : ''} (${primaryTarget.remainingCost} G Restkosten).`
        };
      }
    }

    return {
      archetype,
      inventorySlots: inventory.slots,
      trinketSlot: inventory.trinket,
      currentItems: nonTrinketOwned,
      threatAnalysis,
      recallAdvice,
      nextItems
    };
  }
}

module.exports = { BuildAdvisor, ITEM_CATALOG };
