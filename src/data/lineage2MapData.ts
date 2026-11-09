export type RegionId = 'aden' | 'elmore';

export type NodeCategory =
  | 'gatekeeper'
  | 'one_way_destination'
  | 'custodian_destination'
  | 'landmark';

export interface TeleportNode {
  id: string;
  name: string;
  bookName: string;
  mapLabel: string;
  gatekeeper?: string;
  custodians?: string;
  region: RegionId;
  category: NodeCategory;
  /** Percentage X (0..100) within its region map image (aden-c1.jpg or elmore-c1.jpg) */
  localPctX: number;
  /** Percentage Y (0..100) within its region map image (aden-c1.jpg or elmore-c1.jpg) */
  localPctY: number;
  /** Computed unified world X coordinate (0..1642) */
  worldX: number;
  /** Computed unified world Y coordinate (0..2506) */
  worldY: number;
  /** Grid coordinate code matching 179.webp (e.g. "Aden G6", "Elmore F3") */
  gridRef: string;
  description: string;
  isUnlabeledOnMap?: boolean;
}

export interface TeleportEdge {
  id: string;
  from: string;
  to: string;
  cost: number;
  /** True if this is a 2-way link in 179.webp (solid black line with two arrowheads) */
  isTwoWay: boolean;
  /** If isTwoWay is true, the cost of the reverse direction (e.g. Gludin->Orc is 6000, Orc->Gludin is 3000) */
  reverseCost?: number;
  /** True if this is a Clan Hall Custodian teleport (500 adena) from 178.webp */
  isCustodian?: boolean;
  /** Exact destination label printed in 178.webp under the origin's Gatekeeper */
  bookDestinationLabel: string;
}

export interface DataClarificationNote {
  id: string;
  title: string;
  status: 'resolved' | 'inferred_from_diagram' | 'optional_toggle';
  summary: string;
  details: string;
  relatedNodeIds: string[];
}

/**
 * High-resolution image dimensions and unified canvas layout matching 179.webp:
 * - elmore-c1_5a1cedc9.jpg is 1312 x 984 (8 columns x 6 rows of 164px grid squares)
 * - aden-c1_71f8b02e.jpg is 1642 x 1476 (10 columns x 9 rows of 164.2px x 164px grid squares)
 * In 179.webp, Elmore's 8 columns align horizontally with Columns 3..10 of Aden (offset = 2 * 164.2 = 328.4px).
 */
export const MAP_ASSETS = {
  adenMapUrl: '/assets/aistudio/aden-c1_71f8b02e.jpg',
  elmoreMapUrl: '/assets/aistudio/elmore-c1_5a1cedc9.jpg',
  diagramRefUrl: '/assets/aistudio/179_bc5ea794.webp',
  priceTableRefUrl: '/assets/aistudio/178_24361917.webp',
};

export const WORLD_GEOMETRY = {
  width: 1642,
  height: 2506,
  gridSizeX: 164.2,
  gridSizeY: 164.0,
  elmore: {
    x: 328.4,
    y: 0,
    width: 1312,
    height: 984,
    cols: 8,
    rows: 6,
  },
  aden: {
    x: 0,
    y: 1030,
    width: 1642,
    height: 1476,
    cols: 10,
    rows: 9,
  },
};

export function computeWorldCoords(
  region: RegionId,
  localPctX: number,
  localPctY: number
): { worldX: number; worldY: number; gridRef: string } {
  const rect = region === 'elmore' ? WORLD_GEOMETRY.elmore : WORLD_GEOMETRY.aden;
  const worldX = Math.round((rect.x + (localPctX / 100) * rect.width) * 10) / 10;
  const worldY = Math.round((rect.y + (localPctY / 100) * rect.height) * 10) / 10;

  const colIndex = Math.min(
    rect.cols,
    Math.max(1, Math.floor((localPctX / 100) * rect.cols) + 1)
  );
  const rowIndex = Math.min(
    rect.rows,
    Math.max(1, Math.floor((localPctY / 100) * rect.rows) + 1)
  );
  const colLetter = String.fromCharCode(64 + colIndex);
  const prefix = region === 'elmore' ? 'Elmore' : 'Aden';

  return {
    worldX,
    worldY,
    gridRef: `${prefix} ${colLetter}${rowIndex}`,
  };
}

interface RawNodeInput {
  id: string;
  name: string;
  bookName: string;
  mapLabel: string;
  gatekeeper?: string;
  custodians?: string;
  region: RegionId;
  category: NodeCategory;
  localPctX: number;
  localPctY: number;
  description: string;
  isUnlabeledOnMap?: boolean;
}

const RAW_NODES: RawNodeInput[] = [
  // ===========================================================================
  // 15 GATEKEEPER ORIGINS & DESTINATIONS (from 178.webp & 179.webp)
  // ===========================================================================
  {
    id: 'talking_island',
    name: 'Talking Island Village',
    bookName: 'Talking Island Village',
    mapLabel: 'Talking Island Village',
    gatekeeper: 'Gatekeeper Roxxy',
    region: 'aden',
    category: 'gatekeeper',
    localPctX: 14.1,
    localPctY: 93.3,
    description:
      'Human starting island village in southwestern Aden. Connected solely to Gludin Village via an 18,000 Adena two-way teleport.',
  },
  {
    id: 'gludin',
    name: 'Gludin Village',
    bookName: 'The Village of Gludin',
    mapLabel: 'Gludin Village',
    gatekeeper: 'Gatekeeper Richlin',
    custodians: 'Custodians Bremmer, Calis, Horner, Ruben, Winker',
    region: 'aden',
    category: 'gatekeeper',
    localPctX: 15.3,
    localPctY: 62.6,
    description:
      'Major western port hub connecting Talking Island, Elmore (Orc & Dwarven Villages), Elven & Dark Elven Villages, Gludio, and the Southern Wastelands.',
  },
  {
    id: 'gludio',
    name: 'Gludio Castle Town',
    bookName: 'The Town of Gludio',
    mapLabel: 'Gludio Castle Town',
    gatekeeper: 'Gatekeeper Bella',
    custodians: 'Custodians Black, Boyer, Dillon, Tim',
    region: 'aden',
    category: 'gatekeeper',
    localPctX: 35.5,
    localPctY: 52.8,
    description:
      'Central western crossroads linking Gludin, Dion, Elven Village, and Dark Elven Village, plus one-way teleports to Orc and Dwarven Villages.',
  },
  {
    id: 'dark_elven_village',
    name: 'Dark Elven Village',
    bookName: 'The Dark Elven Village',
    mapLabel: 'Dark Elven Village',
    gatekeeper: 'Gatekeeper Jasmine',
    region: 'aden',
    category: 'gatekeeper',
    localPctX: 43.1,
    localPctY: 16.3,
    description:
      'Subterranean sanctuary of the Dark Elves west of the Temple of Shilen. Connects two-way with Gludio and Gludin, plus a one-way route to the Southern Dark Elven Forest.',
  },
  {
    id: 'elven_village',
    name: 'Elven Village',
    bookName: 'The Elven Village',
    mapLabel: 'Elven Village',
    gatekeeper: 'Gatekeeper Mirabel',
    region: 'aden',
    category: 'gatekeeper',
    localPctX: 53.6,
    localPctY: 28.0,
    description:
      'Ancestral home of the Elves beneath the Mother Tree Glade. Offers two-way teleports to Gludio Castle Town (3,700a) and Gludin Village (6,400a).',
  },
  {
    id: 'dion',
    name: 'Dion Castle Town',
    bookName: 'The Town of Dion',
    mapLabel: 'Dion Castle Town',
    gatekeeper: 'Gatekeeper Trisha',
    custodians: 'Custodians Flynn, Ron, Seth',
    region: 'aden',
    category: 'gatekeeper',
    localPctX: 45.7,
    localPctY: 60.0,
    description:
      'Agricultural heartland town south of Cruma Tower. Bridges western Aden (Gludio) with eastern Aden (Giran Castle Town and Giran Harbor).',
  },
  {
    id: 'giran_harbor',
    name: 'Giran Harbor',
    bookName: 'Giran Harbor / Entrance to Giran',
    mapLabel: 'Giran Harbor',
    gatekeeper: 'Gatekeeper Angelina',
    region: 'aden',
    category: 'gatekeeper',
    localPctX: 54.4,
    localPctY: 74.8,
    description:
      'Southern coastal trade port. Listed as "Entrance to Giran" in Dion and Giran gatekeeper menus (6,500a to Dion, 6,300a to Giran).',
  },
  {
    id: 'giran',
    name: 'Giran Castle Town',
    bookName: 'The Town of Giran',
    mapLabel: 'Giran Castle Town',
    gatekeeper: 'Gatekeeper Clarissa',
    region: 'aden',
    category: 'gatekeeper',
    localPctX: 64.9,
    localPctY: 60.2,
    description:
      'Commercial capital of Aden Kingdom. Major hub linking Dion, Giran Harbor, Town of Oren, Hunters’ Village, and Hardin’s Private Academy.',
  },
  {
    id: 'hardins_academy',
    name: "Hardin's Private Academy",
    bookName: "Hardin's Private Academy",
    mapLabel: "Hardin's Private Academy (Unlabeled on C1 Map)",
    gatekeeper: 'Gatekeeper Minerva',
    region: 'aden',
    category: 'gatekeeper',
    localPctX: 69.5,
    localPctY: 48.0,
    isUnlabeledOnMap: true,
    description:
      'Necromancer Hardin’s cavern northeast of Death Pass. Acts as a key relay between Giran (5,300a), Hunters’ Village (4,100a), and Oren (7,300a).',
  },
  {
    id: 'oren',
    name: 'Town of Oren',
    bookName: 'Oren Castle Town',
    mapLabel: 'Town of Oren',
    gatekeeper: 'Gatekeeper Valentina',
    region: 'aden',
    category: 'gatekeeper',
    localPctX: 64.8,
    localPctY: 29.5,
    description:
      'Northern militarized frontier town near the Sea of Spores. Connects directly to Giran, Ivory Tower, Hunters’ Village, Hardin’s Academy, and Aden.',
  },
  {
    id: 'ivory_tower',
    name: 'Ivory Tower',
    bookName: 'Ivory Tower',
    mapLabel: 'Ivory Tower',
    gatekeeper: 'Gatekeeper Verona',
    region: 'aden',
    category: 'gatekeeper',
    localPctX: 65.7,
    localPctY: 15.8,
    description:
      'Center of mystic research standing inside a meteor crater north of Oren. Offers two-way teleports to Oren (4,400a), Hunters’ Village (8,200a), and Aden (12,000a).',
  },
  {
    id: 'hunters_village',
    name: "Hunters' Village",
    bookName: "Hunters' Village",
    mapLabel: 'Hunters Village',
    gatekeeper: 'Gatekeeper Esmeralda',
    region: 'aden',
    category: 'gatekeeper',
    localPctX: 75.3,
    localPctY: 36.8,
    description:
      'Settlement of bounty hunters and archers between Oren, Aden, and Dragon Valley. Links to Giran, Oren, Ivory Tower, Hardin’s Academy, and Aden.',
  },
  {
    id: 'aden',
    name: 'Town of Aden',
    bookName: 'Aden Castle Town',
    mapLabel: 'Town of Aden',
    gatekeeper: 'Gatekeeper Elisabeth',
    region: 'aden',
    category: 'gatekeeper',
    localPctX: 84.8,
    localPctY: 19.6,
    description:
      'Grand eastern capital of the Aden Kingdom. Connects two-way with Hunters’ Village (11,000a), Ivory Tower (12,000a), and Town of Oren (13,000a).',
  },
  {
    id: 'orc_village',
    name: 'Orc Village',
    bookName: 'Orc Village',
    mapLabel: 'Orc Village',
    gatekeeper: 'Gatekeeper Tamil',
    region: 'elmore',
    category: 'gatekeeper',
    localPctX: 7.4,
    localPctY: 73.8,
    description:
      'Fortified plateau of the Orc race in western Elmore near the Temple of Paagrio. Receives teleports from Gludin and Gludio; returns directly to Gludin for 3,000 Adena.',
  },
  {
    id: 'dwarven_village',
    name: 'Dwarven Village',
    bookName: 'Dwarven Village',
    mapLabel: 'Dwarven Village',
    gatekeeper: 'Gatekeeper Wirphy',
    region: 'elmore',
    category: 'gatekeeper',
    localPctX: 69.6,
    localPctY: 40.2,
    description:
      'Industrial mountain settlement in the Spine Mountains of Elmore. Returns to Gludin for 3,000 Adena and offers a 700 Adena one-way teleport to the Northeast Coast.',
  },

  // ===========================================================================
  // 3 ONE-WAY GATEKEEPER HUNTING DESTINATIONS (from 178.webp & 179.webp dotted arrows)
  // ===========================================================================
  {
    id: 'northeast_coast',
    name: 'The Northeast Coast',
    bookName: 'The Northeast Coast',
    mapLabel: 'The Northeast Coast (Elmore 1-Way)',
    region: 'elmore',
    category: 'one_way_destination',
    localPctX: 89.0,
    localPctY: 27.0,
    isUnlabeledOnMap: true,
    description:
      'One-way coastal hunting ground drop-off in northeastern Elmore from Dwarven Village (700 Adena). No Gatekeeper is present for return travel.',
  },
  {
    id: 'southern_dark_elven_forest',
    name: 'Southern Part of the Dark Elven Forest',
    bookName: 'The Southern Part of the Dark Elven Forest',
    mapLabel: 'Southern Dark Elven Forest (1-Way)',
    region: 'aden',
    category: 'one_way_destination',
    localPctX: 21.5,
    localPctY: 36.1,
    isUnlabeledOnMap: true,
    description:
      'One-way hunting ground drop-off south of Swampland and School of Dark Arts from Dark Elven Village (1,100 Adena). No return Gatekeeper.',
  },
  {
    id: 'southern_wastelands',
    name: 'Southern Entrance of the Wastelands',
    bookName: 'The Southern Entrance of the Wastelands',
    mapLabel: 'Southern Entrance of the Wastelands (1-Way)',
    region: 'aden',
    category: 'one_way_destination',
    localPctX: 34.2,
    localPctY: 81.8,
    isUnlabeledOnMap: true,
    description:
      'One-way hunting ground drop-off at the southern edge of the Wasteland from Gludin Village (2,400 Adena). No return Gatekeeper.',
  },

  // ===========================================================================
  // 11 CLAN HALL CUSTODIAN DESTINATIONS (500 Adena each from 178.webp)
  // ===========================================================================
  {
    id: 'cust_turek_orc_camp',
    name: 'Entrance to Turek Orc Camp (Orc Barracks)',
    bookName: 'Entrance to Turek Orc Camp',
    mapLabel: 'Orc Barracks',
    region: 'aden',
    category: 'custodian_destination',
    localPctX: 11.7,
    localPctY: 49.4,
    description:
      'Clan Hall Custodian one-way teleport from Gludin Village (500 Adena) to the entrance of Orc Barracks (Turek Orc Camp).',
  },
  {
    id: 'cust_forgotten_temple',
    name: 'Entrance to Forgotten Temple',
    bookName: 'Entrance to Forgotten Temple',
    mapLabel: 'Forgotten Temple',
    region: 'aden',
    category: 'custodian_destination',
    localPctX: 24.0,
    localPctY: 74.5,
    description:
      'Clan Hall Custodian one-way teleport from Gludin Village (500 Adena) to the elemental dungeon Forgotten Temple.',
  },
  {
    id: 'cust_wasteland',
    name: 'Entrance to the Wasteland',
    bookName: 'Entrance to the Wasteland',
    mapLabel: 'the Wasteland',
    region: 'aden',
    category: 'custodian_destination',
    localPctX: 31.0,
    localPctY: 73.0,
    description:
      'Clan Hall Custodian one-way teleport from Gludin Village (500 Adena) to the northern/western entrance of the Wasteland.',
  },
  {
    id: 'cust_abandoned_camp',
    name: 'Entrance to Abandoned Camp',
    bookName: 'Entrance to Abandoned Camp',
    mapLabel: 'Abandoned Camp',
    region: 'aden',
    category: 'custodian_destination',
    localPctX: 22.3,
    localPctY: 58.2,
    description:
      'Clan Hall Custodian one-way teleport from Gludin Village (500 Adena) to the Ol Mahum stronghold at Abandoned Camp.',
  },
  {
    id: 'cust_neutral_zone',
    name: 'Neutral Zone',
    bookName: 'Neutral Zone',
    mapLabel: 'Neutral Zone (Road Bridge)',
    region: 'aden',
    category: 'custodian_destination',
    localPctX: 43.5,
    localPctY: 32.0,
    isUnlabeledOnMap: true,
    description:
      'Clan Hall Custodian one-way teleport from Gludio Castle Town (500 Adena) to the Neutral Zone border between Elven and Dark Elven territories.',
  },
  {
    id: 'cust_gludio_east_road',
    name: 'Eastern Road toward Giran',
    bookName: 'Eastern Road toward Giran',
    mapLabel: 'Eastern Road toward Giran',
    region: 'aden',
    category: 'custodian_destination',
    localPctX: 39.8,
    localPctY: 55.8,
    isUnlabeledOnMap: true,
    description:
      'Clan Hall Custodian one-way teleport from Gludio Castle Town (500 Adena) along the eastern highway toward Dion and Giran.',
  },
  {
    id: 'cust_gludio_west_road',
    name: 'Western Road toward Gludin Village',
    bookName: 'Western Road toward Gludin Village',
    mapLabel: 'Western Road toward Gludin',
    region: 'aden',
    category: 'custodian_destination',
    localPctX: 28.0,
    localPctY: 56.5,
    isUnlabeledOnMap: true,
    description:
      'Clan Hall Custodian one-way teleport from Gludio Castle Town (500 Adena) along the western highway toward Gludin Village.',
  },
  {
    id: 'cust_cruma_marshlands',
    name: 'Entrance to Cruma Marshlands (Cruma Tower)',
    bookName: 'Entrance to Cruma Marshlands',
    mapLabel: 'Cruma Tower',
    region: 'aden',
    category: 'custodian_destination',
    localPctX: 45.4,
    localPctY: 49.0,
    description:
      'Clan Hall Custodian one-way teleport from Dion Castle Town (500 Adena) to the Cruma Marshlands surrounding Cruma Tower.',
  },
  {
    id: 'cust_execution_ground',
    name: 'Entrance to Execution Ground',
    bookName: 'Entrance to Execution Ground',
    mapLabel: 'Execution Ground',
    region: 'aden',
    category: 'custodian_destination',
    localPctX: 54.8,
    localPctY: 58.6,
    description:
      'Clan Hall Custodian one-way teleport from Dion Castle Town (500 Adena) to the undead hunting ground at Execution Ground.',
  },
  {
    id: 'cust_partisan_hideaway',
    name: 'Entrance to Partisan Hideaway',
    bookName: 'Entrance to Partisan Hideaway',
    mapLabel: 'The Partisan Hideaway',
    region: 'aden',
    category: 'custodian_destination',
    localPctX: 54.8,
    localPctY: 47.8,
    description:
      'Clan Hall Custodian one-way teleport from Dion Castle Town (500 Adena) to the Ol Mahum Partisan Hideaway.',
  },
  {
    id: 'cust_floran_village',
    name: 'Entrance to Floran Village',
    bookName: 'Entrance to Floran Village',
    mapLabel: 'Floran Village',
    region: 'aden',
    category: 'custodian_destination',
    localPctX: 45.2,
    localPctY: 66.8,
    description:
      'Clan Hall Custodian one-way teleport from Dion Castle Town (500 Adena) to the lawless settlement of Floran Village.',
  },

  // ===========================================================================
  // ADDITIONAL CHRONICLE 1 WORLD LANDMARKS (from aden-c1.jpg & elmore-c1.jpg)
  // ===========================================================================
  {
    id: 'lm_temple_of_paagrio',
    name: 'Temple of Paagrio',
    bookName: 'Temple of Paagrio',
    mapLabel: 'Temple of Paagrio',
    region: 'elmore',
    category: 'landmark',
    localPctX: 4.6,
    localPctY: 75.5,
    description: 'Sacred flame temple west of Orc Village in Elmore.',
  },
  {
    id: 'lm_frozen_waterfalls',
    name: 'Frozen Waterfalls',
    bookName: 'Frozen Waterfalls',
    mapLabel: 'Frozen Waterfalls',
    region: 'elmore',
    category: 'landmark',
    localPctX: 30.3,
    localPctY: 61.5,
    description: 'Northern landmark on the Immortal Plateau in Elmore.',
  },
  {
    id: 'lm_cave_of_trials',
    name: 'Cave of Trials',
    bookName: 'Cave of Trials',
    mapLabel: 'Cave of Trials',
    region: 'elmore',
    category: 'landmark',
    localPctX: 31.8,
    localPctY: 77.2,
    description: 'Orc trial dungeon in southeastern Immortal Plateau (free dungeon entrance).',
  },
  {
    id: 'lm_strip_mine',
    name: 'Strip Mine',
    bookName: 'Strip Mine',
    mapLabel: 'Strip Mine',
    region: 'elmore',
    category: 'landmark',
    localPctX: 65.2,
    localPctY: 43.5,
    description: 'Mining complex immediately southwest of Dwarven Village.',
  },
  {
    id: 'lm_coal_mines',
    name: 'Abandoned Coal Mines',
    bookName: 'Abandoned Coal Mines',
    mapLabel: 'Abandoned Coal Mines',
    region: 'elmore',
    category: 'landmark',
    localPctX: 80.8,
    localPctY: 42.6,
    description: 'Multi-level dungeon east of Dwarven Village.',
  },
  {
    id: 'lm_mithril_mines',
    name: 'Mithril Mines',
    bookName: 'Mithril Mines',
    mapLabel: 'Mithril Mines',
    region: 'elmore',
    category: 'landmark',
    localPctX: 93.4,
    localPctY: 43.2,
    description: 'Deep eastern mine in the Dwarven territory of Elmore.',
  },
  {
    id: 'lm_elven_ruins',
    name: 'Elven Ruins',
    bookName: 'Elven Ruins',
    mapLabel: 'Elven Ruins',
    region: 'aden',
    category: 'landmark',
    localPctX: 5.6,
    localPctY: 90.5,
    description: 'Subterranean dungeon on northwestern Talking Island.',
  },
  {
    id: 'lm_obelisk_of_victory',
    name: 'Obelisk of Victory',
    bookName: 'Obelisk of Victory',
    mapLabel: 'Obelisk of Victory',
    region: 'aden',
    category: 'landmark',
    localPctX: 8.9,
    localPctY: 90.0,
    description: 'Historical monument on Talking Island.',
  },
  {
    id: 'lm_ti_harbor',
    name: 'Talking Island Harbor',
    bookName: 'Talking Island Harbor',
    mapLabel: 'Talking Island Harbor',
    region: 'aden',
    category: 'landmark',
    localPctX: 10.8,
    localPctY: 98.2,
    description: 'Passenger ferry dock connecting Talking Island and Gludin Harbor.',
  },
  {
    id: 'lm_gludin_harbor',
    name: 'Gludin Harbor',
    bookName: 'Gludin Harbor',
    mapLabel: 'Gludin Harbor',
    region: 'aden',
    category: 'landmark',
    localPctX: 10.8,
    localPctY: 61.3,
    description: 'Main western maritime port adjacent to Gludin Village.',
  },
  {
    id: 'lm_fellmere_lake',
    name: 'Fellmere Lake',
    bookName: 'Fellmere Lake',
    mapLabel: 'Fellmere Lake',
    region: 'aden',
    category: 'landmark',
    localPctX: 21.6,
    localPctY: 54.0,
    description: 'Scenic lake north of Abandoned Camp in Gludin territory.',
  },
  {
    id: 'lm_ruins_of_agony',
    name: 'The Ruins of Agony',
    bookName: 'The Ruins of Agony',
    mapLabel: 'The Ruins of Agony',
    region: 'aden',
    category: 'landmark',
    localPctX: 25.8,
    localPctY: 49.2,
    description: 'War-torn undead ruins west of Gludio Castle.',
  },
  {
    id: 'lm_ruins_of_despair',
    name: 'Ruins of Despair',
    bookName: 'Ruins of Despair',
    mapLabel: 'Ruins of Despair',
    region: 'aden',
    category: 'landmark',
    localPctX: 34.2,
    localPctY: 59.3,
    description: 'Haunted ruins south of Gludio Castle Town.',
  },
  {
    id: 'lm_ant_nest',
    name: 'The Ant Nest',
    bookName: 'the Ant Nest',
    mapLabel: 'the Ant Nest',
    region: 'aden',
    category: 'landmark',
    localPctX: 34.7,
    localPctY: 70.0,
    description: 'Underground cavern complex home to the Queen Ant raid boss.',
  },
  {
    id: 'lm_altar_of_rites',
    name: 'Altar of Rites',
    bookName: 'Altar of Rites',
    mapLabel: 'Altar of Rites',
    region: 'aden',
    category: 'landmark',
    localPctX: 26.8,
    localPctY: 37.8,
    description: 'Dark Elven ceremonial altar near the Southern Dark Elven Forest teleport point.',
  },
  {
    id: 'lm_school_of_dark_arts',
    name: 'School of Dark Arts',
    bookName: 'School of Dark Arts',
    mapLabel: 'School of Dark Arts',
    region: 'aden',
    category: 'landmark',
    localPctX: 26.8,
    localPctY: 28.5,
    description: 'Ancient dungeon in western Dark Elven Forest.',
  },
  {
    id: 'lm_swampland',
    name: 'Swampland',
    bookName: 'Swampland',
    mapLabel: 'Swampland',
    region: 'aden',
    category: 'landmark',
    localPctX: 34.6,
    localPctY: 26.8,
    description: 'Marsh hunting grounds southwest of Dark Elven Village.',
  },
  {
    id: 'lm_temple_of_shilen',
    name: 'Temple of Shilen',
    bookName: 'Temple of Shilen',
    mapLabel: 'Temple of Shilen',
    region: 'aden',
    category: 'landmark',
    localPctX: 49.6,
    localPctY: 14.0,
    description: 'Sanctuary of the goddess Shilen east of Dark Elven Village.',
  },
  {
    id: 'lm_sea_of_spores',
    name: 'Sea of Spores',
    bookName: 'Sea of Spores',
    mapLabel: 'Sea of Spores',
    region: 'aden',
    category: 'landmark',
    localPctX: 55.8,
    localPctY: 17.5,
    description: 'Contaminated magical barrier zone housing the Orfen raid boss.',
  },
  {
    id: 'lm_mother_tree_glade',
    name: 'The Mother Tree Glade',
    bookName: 'the Mother Tree Glade',
    mapLabel: 'the Mother Tree Glade',
    region: 'aden',
    category: 'landmark',
    localPctX: 53.8,
    localPctY: 23.0,
    description: 'Sacred grove immediately north of Elven Village.',
  },
  {
    id: 'lm_elven_fortress',
    name: 'Elven Fortress',
    bookName: 'Elven Fortress',
    mapLabel: 'Elven Fortress',
    region: 'aden',
    category: 'landmark',
    localPctX: 46.8,
    localPctY: 35.8,
    description: 'Underground fortress dungeon southwest of Elven Village.',
  },
  {
    id: 'lm_gludio_castle',
    name: 'Gludio Castle',
    bookName: 'Gludio Castle',
    mapLabel: 'Gludio Castle',
    region: 'aden',
    category: 'landmark',
    localPctX: 34.6,
    localPctY: 48.0,
    description: 'Fortress overlooking Gludio Castle Town.',
  },
  {
    id: 'lm_dion_castle',
    name: 'Dion Castle',
    bookName: 'Dion Castle',
    mapLabel: 'Dion Castle',
    region: 'aden',
    category: 'landmark',
    localPctX: 47.6,
    localPctY: 63.8,
    description: 'Fortress perched on the hills south of Dion Castle Town.',
  },
  {
    id: 'lm_giran_castle',
    name: 'Giran Castle',
    bookName: 'Giran Castle',
    mapLabel: 'Giran Castle',
    region: 'aden',
    category: 'landmark',
    localPctX: 75.2,
    localPctY: 59.5,
    description: 'Eastern stronghold of the Giran province.',
  },
  {
    id: 'lm_oren_castle',
    name: 'Oren Castle',
    bookName: 'Oren Castle',
    mapLabel: 'Oren Castle',
    region: 'aden',
    category: 'landmark',
    localPctX: 64.6,
    localPctY: 23.2,
    description: 'Northern border fortress situated north of the Town of Oren.',
  },
  {
    id: 'lm_aden_castle',
    name: 'Aden Castle',
    bookName: 'Aden Castle',
    mapLabel: 'Aden Castle',
    region: 'aden',
    category: 'landmark',
    localPctX: 84.8,
    localPctY: 13.0,
    description: 'Royal capital fortress north of the Town of Aden.',
  },
  {
    id: 'lm_death_pass',
    name: 'Death Pass',
    bookName: 'Death Pass',
    mapLabel: 'Death Pass',
    region: 'aden',
    category: 'landmark',
    localPctX: 61.2,
    localPctY: 53.0,
    description: 'Treacherous mountain corridor connecting Giran and Oren.',
  },
  {
    id: 'lm_dragon_valley',
    name: 'Dragon Valley',
    bookName: 'Dragon Valley',
    mapLabel: 'Dragon Valley',
    region: 'aden',
    category: 'landmark',
    localPctX: 70.8,
    localPctY: 50.5,
    description: 'High-level canyon hunting ground east of Hardin’s Private Academy.',
  },
  {
    id: 'lm_lair_of_antharas',
    name: 'The Lair of Antharas',
    bookName: 'the Lair of Antharas',
    mapLabel: 'the Lair of Antharas',
    region: 'aden',
    category: 'landmark',
    localPctX: 84.2,
    localPctY: 50.2,
    description: 'Deep cavern complex leading to the earth dragon Antharas.',
  },
  {
    id: 'lm_antharas_nest',
    name: "Antharas's Nest",
    bookName: "Antharas's Nest",
    mapLabel: "Antharas's Nest",
    region: 'aden',
    category: 'landmark',
    localPctX: 94.6,
    localPctY: 50.2,
    description: 'Innermost chamber of the earth dragon Antharas in eastern Giran.',
  },
  {
    id: 'lm_border_outpost',
    name: 'Border Outpost',
    bookName: 'Border Outpost',
    mapLabel: 'Border Outpost',
    region: 'aden',
    category: 'landmark',
    localPctX: 74.2,
    localPctY: 4.8,
    description: 'Northernmost military garrison guarding the Aden-Elmore border.',
  },
  {
    id: 'lm_blazing_swamp',
    name: 'Blazing Swamp',
    bookName: 'Blazing Swamp',
    mapLabel: 'Blazing Swamp',
    region: 'aden',
    category: 'landmark',
    localPctX: 84.4,
    localPctY: 7.2,
    description: 'Volcanic marshland north of Aden Castle.',
  },
  {
    id: 'lm_tower_of_insolence',
    name: 'Tower of Insolence',
    bookName: 'Tower of Insolence',
    mapLabel: 'Tower of Insolence',
    region: 'aden',
    category: 'landmark',
    localPctX: 74.8,
    localPctY: 16.4,
    description: 'Monumental multi-floor spire constructed by Emperor Baium between Oren and Aden.',
  },
  {
    id: 'lm_enchanted_valley',
    name: 'The Enchanted Valley',
    bookName: 'The Enchanted Valley',
    mapLabel: 'The Enchanted Valley',
    region: 'aden',
    category: 'landmark',
    localPctX: 74.8,
    localPctY: 27.6,
    description: 'Tiered fairy valley located immediately north of Hunters’ Village.',
  },
  {
    id: 'lm_cemetery',
    name: 'The Cemetery',
    bookName: 'The Cemetery',
    mapLabel: 'The Cemetery',
    region: 'aden',
    category: 'landmark',
    localPctX: 93.2,
    localPctY: 17.6,
    description: 'Royal burial grounds east of the Town of Aden leading to the Forbidden Gateway.',
  },
  {
    id: 'lm_giants_cave',
    name: "The Giants' Cave",
    bookName: "The Giants' Cave",
    mapLabel: "The Giants' Cave",
    region: 'aden',
    category: 'landmark',
    localPctX: 95.0,
    localPctY: 29.0,
    description: 'Ancient subterranean ruin of the Giants southeast of the Town of Aden.',
  },
  {
    id: 'lm_forest_of_mirrors',
    name: 'The Forest of Mirrors',
    bookName: 'The Forest of Mirrors',
    mapLabel: 'The Forest of Mirrors',
    region: 'aden',
    category: 'landmark',
    localPctX: 85.8,
    localPctY: 39.5,
    description: 'Haunted woodland east of Hunters’ Village leading toward Anghel Waterfall.',
  },
];

export const TELEPORT_NODES: TeleportNode[] = RAW_NODES.map((n) => {
  const { worldX, worldY, gridRef } = computeWorldCoords(
    n.region,
    n.localPctX,
    n.localPctY
  );
  return {
    ...n,
    worldX,
    worldY,
    gridRef,
  };
});

export const NODE_MAP: Record<string, TeleportNode> = Object.fromEntries(
  TELEPORT_NODES.map((n) => [n.id, n])
);

/**
 * Complete directed teleport edges from 178_24361917.webp & 179_bc5ea794.webp.
 * Every single entry in the Prima Guide table is represented here.
 */
export interface DirectedRouteEdge {
  id: string;
  from: string;
  to: string;
  cost: number;
  gatekeeper: string;
  bookDestinationLabel: string;
  /** True if only 1-way (dotted line with single arrowhead in 179.webp) */
  isOneWay: boolean;
  /** True if reverse route exists but has a different price (e.g. Gludin<->Orc is 6000/3000) */
  isAsymmetricCost?: boolean;
  reverseCost?: number;
  /** True if Clan Hall Custodian teleport (500 Adena) */
  isCustodian: boolean;
}

export const DIRECTED_TELEPORT_ROUTES: DirectedRouteEdge[] = [
  // 1. Aden (Gatekeeper Elisabeth)
  {
    id: 'aden__ivory_tower',
    from: 'aden',
    to: 'ivory_tower',
    cost: 12000,
    gatekeeper: 'Gatekeeper Elisabeth',
    bookDestinationLabel: 'Ivory Tower',
    isOneWay: false,
    reverseCost: 12000,
    isCustodian: false,
  },
  {
    id: 'aden__oren',
    from: 'aden',
    to: 'oren',
    cost: 13000,
    gatekeeper: 'Gatekeeper Elisabeth',
    bookDestinationLabel: 'Oren Castle Town',
    isOneWay: false,
    reverseCost: 13000,
    isCustodian: false,
  },
  {
    id: 'aden__hunters_village',
    from: 'aden',
    to: 'hunters_village',
    cost: 11000,
    gatekeeper: 'Gatekeeper Elisabeth',
    bookDestinationLabel: "Hunters' Village",
    isOneWay: false,
    reverseCost: 11000,
    isCustodian: false,
  },

  // 2. Dark Elven Village (Gatekeeper Jasmine)
  {
    id: 'dark_elven_village__gludin',
    from: 'dark_elven_village',
    to: 'gludin',
    cost: 6400,
    gatekeeper: 'Gatekeeper Jasmine',
    bookDestinationLabel: 'The Village of Gludin',
    isOneWay: false,
    reverseCost: 6400,
    isCustodian: false,
  },
  {
    id: 'dark_elven_village__gludio',
    from: 'dark_elven_village',
    to: 'gludio',
    cost: 3700,
    gatekeeper: 'Gatekeeper Jasmine',
    bookDestinationLabel: 'The Town of Gludio',
    isOneWay: false,
    reverseCost: 3700,
    isCustodian: false,
  },
  {
    id: 'dark_elven_village__southern_dark_elven_forest',
    from: 'dark_elven_village',
    to: 'southern_dark_elven_forest',
    cost: 1100,
    gatekeeper: 'Gatekeeper Jasmine',
    bookDestinationLabel: 'The Southern Part of the Dark Elven Forest',
    isOneWay: true,
    isCustodian: false,
  },

  // 3. Dion (Gatekeeper Trisha)
  {
    id: 'dion__gludio',
    from: 'dion',
    to: 'gludio',
    cost: 4100,
    gatekeeper: 'Gatekeeper Trisha',
    bookDestinationLabel: 'The Town of Gludio',
    isOneWay: false,
    reverseCost: 4100,
    isCustodian: false,
  },
  {
    id: 'dion__giran',
    from: 'dion',
    to: 'giran',
    cost: 8100,
    gatekeeper: 'Gatekeeper Trisha',
    bookDestinationLabel: 'The Town of Giran',
    isOneWay: false,
    reverseCost: 8100,
    isCustodian: false,
  },
  {
    id: 'dion__giran_harbor',
    from: 'dion',
    to: 'giran_harbor',
    cost: 6500,
    gatekeeper: 'Gatekeeper Trisha',
    bookDestinationLabel: 'Entrance to Giran (Giran Harbor)',
    isOneWay: false,
    reverseCost: 6500,
    isCustodian: false,
  },

  // 4. Dwarven Village (Gatekeeper Wirphy)
  {
    id: 'dwarven_village__gludin',
    from: 'dwarven_village',
    to: 'gludin',
    cost: 3000,
    gatekeeper: 'Gatekeeper Wirphy',
    bookDestinationLabel: 'The Village of Gludin',
    isOneWay: false,
    isAsymmetricCost: true,
    reverseCost: 6000,
    isCustodian: false,
  },
  {
    id: 'dwarven_village__northeast_coast',
    from: 'dwarven_village',
    to: 'northeast_coast',
    cost: 700,
    gatekeeper: 'Gatekeeper Wirphy',
    bookDestinationLabel: 'The Northeast Coast',
    isOneWay: true,
    isCustodian: false,
  },

  // 5. Elven Village (Gatekeeper Mirabel)
  {
    id: 'elven_village__gludin',
    from: 'elven_village',
    to: 'gludin',
    cost: 6400,
    gatekeeper: 'Gatekeeper Mirabel',
    bookDestinationLabel: 'The Village of Gludin',
    isOneWay: false,
    reverseCost: 6400,
    isCustodian: false,
  },
  {
    id: 'elven_village__gludio',
    from: 'elven_village',
    to: 'gludio',
    cost: 3700,
    gatekeeper: 'Gatekeeper Mirabel',
    bookDestinationLabel: 'The Town of Gludio',
    isOneWay: false,
    reverseCost: 3700,
    isCustodian: false,
  },

  // 6. Giran (Gatekeeper Clarissa)
  {
    id: 'giran__dion',
    from: 'giran',
    to: 'dion',
    cost: 8100,
    gatekeeper: 'Gatekeeper Clarissa',
    bookDestinationLabel: 'The Town of Dion',
    isOneWay: false,
    reverseCost: 8100,
    isCustodian: false,
  },
  {
    id: 'giran__oren',
    from: 'giran',
    to: 'oren',
    cost: 11000,
    gatekeeper: 'Gatekeeper Clarissa',
    bookDestinationLabel: 'Oren Castle Town',
    isOneWay: false,
    reverseCost: 11000,
    isCustodian: false,
  },
  {
    id: 'giran__hunters_village',
    from: 'giran',
    to: 'hunters_village',
    cost: 9400,
    gatekeeper: 'Gatekeeper Clarissa',
    bookDestinationLabel: "Hunters' Village",
    isOneWay: false,
    reverseCost: 9400,
    isCustodian: false,
  },
  {
    id: 'giran__giran_harbor',
    from: 'giran',
    to: 'giran_harbor',
    cost: 6300,
    gatekeeper: 'Gatekeeper Clarissa',
    bookDestinationLabel: 'Entrance to Giran (Giran Harbor)',
    isOneWay: false,
    reverseCost: 6300,
    isCustodian: false,
  },
  {
    id: 'giran__hardins_academy',
    from: 'giran',
    to: 'hardins_academy',
    cost: 5300,
    gatekeeper: 'Gatekeeper Clarissa',
    bookDestinationLabel: "Hardin's Private Academy",
    isOneWay: false,
    reverseCost: 5300,
    isCustodian: false,
  },

  // 7. Giran Harbor (Gatekeeper Angelina)
  {
    id: 'giran_harbor__giran',
    from: 'giran_harbor',
    to: 'giran',
    cost: 6300,
    gatekeeper: 'Gatekeeper Angelina',
    bookDestinationLabel: 'The Town of Giran',
    isOneWay: false,
    reverseCost: 6300,
    isCustodian: false,
  },
  {
    id: 'giran_harbor__dion',
    from: 'giran_harbor',
    to: 'dion',
    cost: 6500,
    gatekeeper: 'Gatekeeper Angelina',
    bookDestinationLabel: 'The Town of Dion',
    isOneWay: false,
    reverseCost: 6500,
    isCustodian: false,
  },

  // 8. Gludin (Gatekeeper Richlin)
  {
    id: 'gludin__talking_island',
    from: 'gludin',
    to: 'talking_island',
    cost: 18000,
    gatekeeper: 'Gatekeeper Richlin',
    bookDestinationLabel: 'Talking Island Village',
    isOneWay: false,
    reverseCost: 18000,
    isCustodian: false,
  },
  {
    id: 'gludin__elven_village',
    from: 'gludin',
    to: 'elven_village',
    cost: 6400,
    gatekeeper: 'Gatekeeper Richlin',
    bookDestinationLabel: 'The Elven Village',
    isOneWay: false,
    reverseCost: 6400,
    isCustodian: false,
  },
  {
    id: 'gludin__dark_elven_village',
    from: 'gludin',
    to: 'dark_elven_village',
    cost: 6400,
    gatekeeper: 'Gatekeeper Richlin',
    bookDestinationLabel: 'The Dark Elven Village',
    isOneWay: false,
    reverseCost: 6400,
    isCustodian: false,
  },
  {
    id: 'gludin__gludio',
    from: 'gludin',
    to: 'gludio',
    cost: 2900,
    gatekeeper: 'Gatekeeper Richlin',
    bookDestinationLabel: 'The Town of Gludio',
    isOneWay: false,
    reverseCost: 2900,
    isCustodian: false,
  },
  {
    id: 'gludin__orc_village',
    from: 'gludin',
    to: 'orc_village',
    cost: 6000,
    gatekeeper: 'Gatekeeper Richlin',
    bookDestinationLabel: 'Orc Village',
    isOneWay: false,
    isAsymmetricCost: true,
    reverseCost: 3000,
    isCustodian: false,
  },
  {
    id: 'gludin__dwarven_village',
    from: 'gludin',
    to: 'dwarven_village',
    cost: 6000,
    gatekeeper: 'Gatekeeper Richlin',
    bookDestinationLabel: 'Dwarven Village',
    isOneWay: false,
    isAsymmetricCost: true,
    reverseCost: 3000,
    isCustodian: false,
  },
  {
    id: 'gludin__southern_wastelands',
    from: 'gludin',
    to: 'southern_wastelands',
    cost: 2400,
    gatekeeper: 'Gatekeeper Richlin',
    bookDestinationLabel: 'The Southern Entrance of the Wastelands',
    isOneWay: true,
    isCustodian: false,
  },

  // 9. Gludio (Gatekeeper Bella)
  {
    id: 'gludio__elven_village',
    from: 'gludio',
    to: 'elven_village',
    cost: 3700,
    gatekeeper: 'Gatekeeper Bella',
    bookDestinationLabel: 'The Elven Village',
    isOneWay: false,
    reverseCost: 3700,
    isCustodian: false,
  },
  {
    id: 'gludio__dark_elven_village',
    from: 'gludio',
    to: 'dark_elven_village',
    cost: 3700,
    gatekeeper: 'Gatekeeper Bella',
    bookDestinationLabel: 'The Dark Elven Village',
    isOneWay: false,
    reverseCost: 3700,
    isCustodian: false,
  },
  {
    id: 'gludio__gludin',
    from: 'gludio',
    to: 'gludin',
    cost: 2900,
    gatekeeper: 'Gatekeeper Bella',
    bookDestinationLabel: 'The Village of Gludin',
    isOneWay: false,
    reverseCost: 2900,
    isCustodian: false,
  },
  {
    id: 'gludio__dion',
    from: 'gludio',
    to: 'dion',
    cost: 4100,
    gatekeeper: 'Gatekeeper Bella',
    bookDestinationLabel: 'The Town of Dion',
    isOneWay: false,
    reverseCost: 4100,
    isCustodian: false,
  },
  {
    id: 'gludio__orc_village',
    from: 'gludio',
    to: 'orc_village',
    cost: 6000,
    gatekeeper: 'Gatekeeper Bella',
    bookDestinationLabel: 'Orc Village',
    isOneWay: true,
    isCustodian: false,
  },
  {
    id: 'gludio__dwarven_village',
    from: 'gludio',
    to: 'dwarven_village',
    cost: 6000,
    gatekeeper: 'Gatekeeper Bella',
    bookDestinationLabel: 'Dwarven Village',
    isOneWay: true,
    isCustodian: false,
  },

  // 10. Hardin's Private Academy (Gatekeeper Minerva)
  {
    id: 'hardins_academy__giran',
    from: 'hardins_academy',
    to: 'giran',
    cost: 5300,
    gatekeeper: 'Gatekeeper Minerva',
    bookDestinationLabel: 'The Town of Giran',
    isOneWay: false,
    reverseCost: 5300,
    isCustodian: false,
  },
  {
    id: 'hardins_academy__oren',
    from: 'hardins_academy',
    to: 'oren',
    cost: 7300,
    gatekeeper: 'Gatekeeper Minerva',
    bookDestinationLabel: 'Oren Castle Town',
    isOneWay: false,
    reverseCost: 7300,
    isCustodian: false,
  },
  {
    id: 'hardins_academy__hunters_village',
    from: 'hardins_academy',
    to: 'hunters_village',
    cost: 4100,
    gatekeeper: 'Gatekeeper Minerva',
    bookDestinationLabel: "Hunters' Village",
    isOneWay: false,
    reverseCost: 4100,
    isCustodian: false,
  },

  // 11. Hunters' Village (Gatekeeper Esmeralda)
  {
    id: 'hunters_village__giran',
    from: 'hunters_village',
    to: 'giran',
    cost: 9400,
    gatekeeper: 'Gatekeeper Esmeralda',
    bookDestinationLabel: 'The Town of Giran',
    isOneWay: false,
    reverseCost: 9400,
    isCustodian: false,
  },
  {
    id: 'hunters_village__oren',
    from: 'hunters_village',
    to: 'oren',
    cost: 4900,
    gatekeeper: 'Gatekeeper Esmeralda',
    bookDestinationLabel: 'Oren Castle Town',
    isOneWay: false,
    reverseCost: 4900,
    isCustodian: false,
  },
  {
    id: 'hunters_village__ivory_tower',
    from: 'hunters_village',
    to: 'ivory_tower',
    cost: 8200,
    gatekeeper: 'Gatekeeper Esmeralda',
    bookDestinationLabel: 'Ivory Tower',
    isOneWay: false,
    reverseCost: 8200,
    isCustodian: false,
  },
  {
    id: 'hunters_village__hardins_academy',
    from: 'hunters_village',
    to: 'hardins_academy',
    cost: 4100,
    gatekeeper: 'Gatekeeper Esmeralda',
    bookDestinationLabel: "Hardin's Private Academy",
    isOneWay: false,
    reverseCost: 4100,
    isCustodian: false,
  },
  {
    id: 'hunters_village__aden',
    from: 'hunters_village',
    to: 'aden',
    cost: 11000,
    gatekeeper: 'Gatekeeper Esmeralda',
    bookDestinationLabel: 'Aden Castle Town',
    isOneWay: false,
    reverseCost: 11000,
    isCustodian: false,
  },

  // 12. Ivory Tower (Gatekeeper Verona)
  {
    id: 'ivory_tower__oren',
    from: 'ivory_tower',
    to: 'oren',
    cost: 4400,
    gatekeeper: 'Gatekeeper Verona',
    bookDestinationLabel: 'Oren Castle Town',
    isOneWay: false,
    reverseCost: 4400,
    isCustodian: false,
  },
  {
    id: 'ivory_tower__hunters_village',
    from: 'ivory_tower',
    to: 'hunters_village',
    cost: 8200,
    gatekeeper: 'Gatekeeper Verona',
    bookDestinationLabel: "Hunters' Village",
    isOneWay: false,
    reverseCost: 8200,
    isCustodian: false,
  },
  {
    id: 'ivory_tower__aden',
    from: 'ivory_tower',
    to: 'aden',
    cost: 12000,
    gatekeeper: 'Gatekeeper Verona',
    bookDestinationLabel: 'Aden Castle Town',
    isOneWay: false,
    reverseCost: 12000,
    isCustodian: false,
  },

  // 13. Orc Village (Gatekeeper Tamil)
  {
    id: 'orc_village__gludin',
    from: 'orc_village',
    to: 'gludin',
    cost: 3000,
    gatekeeper: 'Gatekeeper Tamil',
    bookDestinationLabel: 'The Village of Gludin',
    isOneWay: false,
    isAsymmetricCost: true,
    reverseCost: 6000,
    isCustodian: false,
  },

  // 14. Oren (Gatekeeper Valentina)
  {
    id: 'oren__giran',
    from: 'oren',
    to: 'giran',
    cost: 11000,
    gatekeeper: 'Gatekeeper Valentina',
    bookDestinationLabel: 'The Town of Giran',
    isOneWay: false,
    reverseCost: 11000,
    isCustodian: false,
  },
  {
    id: 'oren__ivory_tower',
    from: 'oren',
    to: 'ivory_tower',
    cost: 4400,
    gatekeeper: 'Gatekeeper Valentina',
    bookDestinationLabel: 'Ivory Tower',
    isOneWay: false,
    reverseCost: 4400,
    isCustodian: false,
  },
  {
    id: 'oren__hunters_village',
    from: 'oren',
    to: 'hunters_village',
    cost: 4900,
    gatekeeper: 'Gatekeeper Valentina',
    bookDestinationLabel: "Hunters' Village",
    isOneWay: false,
    reverseCost: 4900,
    isCustodian: false,
  },
  {
    id: 'oren__hardins_academy',
    from: 'oren',
    to: 'hardins_academy',
    cost: 7300,
    gatekeeper: 'Gatekeeper Valentina',
    bookDestinationLabel: "Hardin's Private Academy",
    isOneWay: false,
    reverseCost: 7300,
    isCustodian: false,
  },
  {
    id: 'oren__aden',
    from: 'oren',
    to: 'aden',
    cost: 13000,
    gatekeeper: 'Gatekeeper Valentina',
    bookDestinationLabel: 'Aden Castle Town',
    isOneWay: false,
    reverseCost: 13000,
    isCustodian: false,
  },

  // 15. Talking Island Village (Gatekeeper Roxxy)
  {
    id: 'talking_island__gludin',
    from: 'talking_island',
    to: 'gludin',
    cost: 18000,
    gatekeeper: 'Gatekeeper Roxxy',
    bookDestinationLabel: 'The Village of Gludin',
    isOneWay: false,
    reverseCost: 18000,
    isCustodian: false,
  },

  // ===========================================================================
  // CLAN HALL CUSTODIAN TELEPORTS (500 Adena each from 178.webp)
  // ===========================================================================
  // Gludin Custodians (Bremmer, Calis, Horner, Ruben, Winker)
  {
    id: 'cust_gludin__turek_orc_camp',
    from: 'gludin',
    to: 'cust_turek_orc_camp',
    cost: 500,
    gatekeeper: 'Custodians Bremmer, Calis, Horner, Ruben, Winker',
    bookDestinationLabel: 'Entrance to Turek Orc Camp',
    isOneWay: true,
    isCustodian: true,
  },
  {
    id: 'cust_gludin__forgotten_temple',
    from: 'gludin',
    to: 'cust_forgotten_temple',
    cost: 500,
    gatekeeper: 'Custodians Bremmer, Calis, Horner, Ruben, Winker',
    bookDestinationLabel: 'Entrance to Forgotten Temple',
    isOneWay: true,
    isCustodian: true,
  },
  {
    id: 'cust_gludin__wasteland',
    from: 'gludin',
    to: 'cust_wasteland',
    cost: 500,
    gatekeeper: 'Custodians Bremmer, Calis, Horner, Ruben, Winker',
    bookDestinationLabel: 'Entrance to the Wasteland',
    isOneWay: true,
    isCustodian: true,
  },
  {
    id: 'cust_gludin__abandoned_camp',
    from: 'gludin',
    to: 'cust_abandoned_camp',
    cost: 500,
    gatekeeper: 'Custodians Bremmer, Calis, Horner, Ruben, Winker',
    bookDestinationLabel: 'Entrance to Abandoned Camp',
    isOneWay: true,
    isCustodian: true,
  },

  // Gludio Custodians (Black, Boyer, Dillon, Tim)
  {
    id: 'cust_gludio__neutral_zone',
    from: 'gludio',
    to: 'cust_neutral_zone',
    cost: 500,
    gatekeeper: 'Custodians Black, Boyer, Dillon, Tim',
    bookDestinationLabel: 'Neutral Zone',
    isOneWay: true,
    isCustodian: true,
  },
  {
    id: 'cust_gludio__east_road',
    from: 'gludio',
    to: 'cust_gludio_east_road',
    cost: 500,
    gatekeeper: 'Custodians Black, Boyer, Dillon, Tim',
    bookDestinationLabel: 'Eastern Road toward Giran',
    isOneWay: true,
    isCustodian: true,
  },
  {
    id: 'cust_gludio__west_road',
    from: 'gludio',
    to: 'cust_gludio_west_road',
    cost: 500,
    gatekeeper: 'Custodians Black, Boyer, Dillon, Tim',
    bookDestinationLabel: 'Western Road toward Gludin Village',
    isOneWay: true,
    isCustodian: true,
  },

  // Dion Custodians (Flynn, Ron, Seth)
  {
    id: 'cust_dion__cruma_marshlands',
    from: 'dion',
    to: 'cust_cruma_marshlands',
    cost: 500,
    gatekeeper: 'Custodians Flynn, Ron, Seth',
    bookDestinationLabel: 'Entrance to Cruma Marshlands',
    isOneWay: true,
    isCustodian: true,
  },
  {
    id: 'cust_dion__execution_ground',
    from: 'dion',
    to: 'cust_execution_ground',
    cost: 500,
    gatekeeper: 'Custodians Flynn, Ron, Seth',
    bookDestinationLabel: 'Entrance to Execution Ground',
    isOneWay: true,
    isCustodian: true,
  },
  {
    id: 'cust_dion__partisan_hideaway',
    from: 'dion',
    to: 'cust_partisan_hideaway',
    cost: 500,
    gatekeeper: 'Custodians Flynn, Ron, Seth',
    bookDestinationLabel: 'Entrance to Partisan Hideaway',
    isOneWay: true,
    isCustodian: true,
  },
  {
    id: 'cust_dion__floran_village',
    from: 'dion',
    to: 'cust_floran_village',
    cost: 500,
    gatekeeper: 'Custodians Flynn, Ron, Seth',
    bookDestinationLabel: 'Entrance to Floran Village',
    isOneWay: true,
    isCustodian: true,
  },
];

/**
 * Unique visual links for rendering lines on the SVG canvas so 2-way edges aren't double-drawn.
 */
export interface VisualTeleportLine {
  id: string;
  from: string;
  to: string;
  forwardCost: number;
  reverseCost?: number;
  isTwoWay: boolean;
  isCustodian: boolean;
}

export function getVisualTeleportLines(includeCustodians: boolean): VisualTeleportLine[] {
  const seenPairs = new Set<string>();
  const lines: VisualTeleportLine[] = [];

  for (const edge of DIRECTED_TELEPORT_ROUTES) {
    if (!includeCustodians && edge.isCustodian) continue;
    const pairKey = [edge.from, edge.to].sort().join('__');
    if (seenPairs.has(pairKey)) continue;
    seenPairs.add(pairKey);

    const reverseEdge = DIRECTED_TELEPORT_ROUTES.find(
      (e) => e.from === edge.to && e.to === edge.from && e.isCustodian === edge.isCustodian
    );

    lines.push({
      id: pairKey,
      from: edge.from,
      to: edge.to,
      forwardCost: edge.cost,
      reverseCost: reverseEdge?.cost,
      isTwoWay: Boolean(reverseEdge),
      isCustodian: edge.isCustodian,
    });
  }

  return lines;
}

/**
 * Documentation of cross-file reconciliation across the 4 uploaded images:
 * - aden-c1.jpg
 * - elmore-c1.jpg
 * - 178.webp (Teleport price list)
 * - 179.webp (Combined world map with teleport arrows)
 */
export const DATA_CLARIFICATION_NOTES: DataClarificationNote[] = [
  {
    id: 'entrance_to_giran',
    title: '"Entrance to Giran" in 178.webp corresponds to Giran Harbor',
    status: 'resolved',
    summary: 'Resolved via 179.webp arrow topology & matching 6,500 / 6,300 Adena prices.',
    details:
      'In 178.webp, Dion (Gatekeeper Trisha) lists "Entrance to Giran (6,500)" and Giran (Gatekeeper Clarissa) lists "Entrance to Giran (6,300)", while "Giran Harbor (Gatekeeper Angelina)" lists return trips to The Town of Giran (6,300) and The Town of Dion (6,500). In 179.webp, solid two-way arrows connect Giran Harbor with both Dion and Giran, confirming "Entrance to Giran" and "Giran Harbor" are the exact same node.',
    relatedNodeIds: ['giran_harbor', 'dion', 'giran'],
  },
  {
    id: 'hardins_private_academy',
    title: "Hardin's Private Academy is unlabeled on aden-c1.jpg",
    status: 'inferred_from_diagram',
    summary: 'Placed at the exact 3-way arrow vertex in 179.webp (Aden G5, north of Death Pass).',
    details:
      '178.webp lists Hardin’s Private Academy (Gatekeeper Minerva) with two-way connections to Giran (5,300a), Oren (7,300a), and Hunters’ Village (4,100a). While the text label "Hardin’s Private Academy" is omitted on the C1 world map image (aden-c1.jpg), 179.webp clearly plots its 3-way vertex at Grid G5 (69.5% X, 48.0% Y) along the mountain pass north of Death Pass.',
    relatedNodeIds: ['hardins_academy', 'giran', 'oren', 'hunters_village'],
  },
  {
    id: 'asymmetric_elmore_prices',
    title: 'Asymmetric Two-Way Prices between Gludin and Elmore Villages',
    status: 'resolved',
    summary: 'Gludin -> Orc/Dwarven Village costs 6,000 Adena; returning to Gludin costs 3,000 Adena.',
    details:
      'In 179.webp, Gludin <-> Orc Village and Gludin <-> Dwarven Village are drawn as solid two-way lines, while Gludio -> Orc Village and Gludio -> Dwarven Village are dotted one-way lines (6,000a). Per 178.webp, departing Gludin for Orc or Dwarven Village costs 6,000 Adena, whereas Gatekeeper Tamil (Orc) and Gatekeeper Wirphy (Dwarven) charge only 3,000 Adena to return to Gludin.',
    relatedNodeIds: ['gludin', 'gludio', 'orc_village', 'dwarven_village'],
  },
  {
    id: 'one_way_hunting_grounds',
    title: 'Three One-Way Gatekeeper Drop-offs Have No Text Labels on the Maps',
    status: 'inferred_from_diagram',
    summary: 'Coordinates extracted directly from the dotted arrowhead endpoints in 179.webp.',
    details:
      'The three one-way hunting ground teleports—"The Northeast Coast" (700a from Dwarven Village), "The Southern Part of the Dark Elven Forest" (1,100a from Dark Elven Village), and "The Southern Entrance of the Wastelands" (2,400a from Gludin)—are unnamed road drop-offs on aden-c1.jpg and elmore-c1.jpg. Their coordinates are mapped directly from the terminal arrowheads of the dotted lines in 179.webp.',
    relatedNodeIds: ['northeast_coast', 'southern_dark_elven_forest', 'southern_wastelands'],
  },
  {
    id: 'custodian_teleports',
    title: 'Clan Hall Custodian Teleports (178.webp bottom-right section)',
    status: 'optional_toggle',
    summary: '11 low-cost (500 Adena) hunting ground teleports from Gludin, Gludio, and Dion.',
    details:
      '178.webp includes a secondary "Custodians" table for Clan Hall owners in Gludin, Gludio, and Dion (500 Adena each). Most correspond to labeled landmarks (Orc Barracks, Forgotten Temple, Wasteland, Abandoned Camp, Cruma Tower, Execution Ground, Partisan Hideaway, Floran Village), while three Gludio Custodian targets ("Neutral Zone", "Eastern Road toward Giran", "Western Road toward Gludin Village") are road drop-offs not drawn in 179.webp. You can toggle Custodian routes on or off in the map toolbar.',
    relatedNodeIds: [
      'cust_turek_orc_camp',
      'cust_forgotten_temple',
      'cust_wasteland',
      'cust_abandoned_camp',
      'cust_neutral_zone',
      'cust_gludio_east_road',
      'cust_gludio_west_road',
      'cust_cruma_marshlands',
      'cust_execution_ground',
      'cust_partisan_hideaway',
      'cust_floran_village',
    ],
  },
];
