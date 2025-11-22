// scripts/state.js - Defines the global state object and constants for the application, managing data, UI element references, and configuration.

export const state = {
    allRunners: [],
    skillData: {},
    runnerUniqueSkills: {},
    orderedSparks: {},
    inheritanceModel: {},
    lastFilteredData: [],

    blueSparkNames: [],
    greenSparkNames: [],
    pinkSparkNames: [],
    whiteSparkNames: [],
    orderedSkills: [],
    allRunnerNamesSet: new Set(),
    allTags: new Set(),

    savedParentSetups: [],
    
    gpExistenceCache: new Map(),
    sparkFilterCounter: 1,
    skillFilterCounter: 1,
    maxTotalWhiteSparks: 0,
    maxParentWhiteSparks: 0,
    showParentSparksOnly: false,
    skillCategoryFilter: 'all',
    filterPresets: [],
    collections: [],
    changeLog: null,
    selectedRunners: new Set(),
    uiSettings: null, // Will be initialized by ui-settings.js

    elements: {},
};

export const CONSTANTS = {
    APTITUDE_RANK_MAP: {'S': 9, 'A': 8, 'B': 7, 'C': 6, 'D': 5, 'E': 4, 'F': 3, 'G': 2, '': -100, 'N/A': -100},
    UMA_TEXT_DARK: '#8C4410',
    APTITUDE_COLORS: {
        'S': '#f0bd1a', 'A': '#f48337', 'B': '#e56487', 'C': '#61c340',
        'D': '#49ace2', 'E': '#d477f2', 'F': '#766ad6', 'G': '#b3b2b3', 'N/A': '#dddddd'
    },
    STAT_ICONS: {
        'speed': 'speed.png', 'stamina': 'stamina.png', 'power': 'power.png', 
        'guts': 'guts.png', 'wit': 'wit.png'
    },
    SKILL_ICONS: {
        'acceleration_active_gold': 'acceleration_active_gold.png',
        'acceleration_active_normal': 'acceleration_active_normal.png',
        'acceleration_debuff_gold': 'acceleration_debuff_gold.png',
        'acceleration_debuff_normal': 'acceleration_debuff_normal.png',
        'acceleration_detrimental_passive_normal': 'acceleration_detrimental_passive_normal.png',
        'allRounder_passive_gold': 'allRounder_passive_gold.png',
        'allRounder_passive_normal': 'allRounder_passive_normal.png',
        'best_in_japan': 'best_in_japan.png',
        'carnival': 'carnival.png',
        'guts_detrimental_passive_normal': 'guts_detrimental_passive_normal.png',
        'guts_passive_normal': 'guts_passive_normal.png',
        'laneChange_active_gold': 'laneChange_active_gold.png',
        'laneChange_active_normal': 'laneChange_active_normal.png',
        'observation_active_gold': 'observation_active_gold.png',
        'observation_active_normal': 'observation_active_normal.png',
        'observation_debuff_gold': 'observation_debuff_gold.png',
        'observation_debuff_normal': 'observation_debuff_normal.png',
        'panic_debuff_normal': 'panic_debuff_normal.png',
        'power_detrimental_passive_normal': 'power_detrimental_passive_normal.png',
        'power_passive_normal': 'power_passive_normal.png',
        'recovery_active_gold': 'recovery_active_gold.png',
        'recovery_active_normal': 'recovery_active_normal.png',
        'runaway': 'runaway.png',
        'speed_active_gold': 'speed_active_gold.png',
        'speed_active_normal': 'speed_active_normal.png',
        'speed_debuff_gold': 'speed_debuff_gold.png',
        'speed_debuff_normal': 'speed_debuff_normal.png',
        'speed_detrimental_active_normal': 'speed_detrimental_active_normal.png',
        'speed_detrimental_passive_gold': 'speed_detrimental_passive_gold.png',
        'speed_detrimental_passive_normal': 'speed_detrimental_passive_normal.png',
        'speed_passive_normal': 'speed_passive_normal.png',
        'stamina_debuff_gold': 'stamina_debuff_gold.png',
        'stamina_debuff_normal': 'stamina_debuff_normal.png',
        'stamina_detrimental_active_normal': 'stamina_detrimental_active_normal.png',
        'stamina_detrimental_passive_normal': 'stamina_detrimental_passive_normal.png',
        'stamina_passive_normal': 'stamina_passive_normal.png',
        'star': 'star.png',
        'star_gold': 'star_gold.png',
        'startingGate_active_gold': 'startingGate_active_gold.png',
        'startingGate_active_normal': 'startingGate_active_normal.png',
        'startingGate_detrimental_passive_normal': 'startingGate_detrimental_passive_normal.png',
        'unique_acceleration_normal': 'unique_acceleration_normal.png',
        'unique_recovery_normal': 'unique_recovery_normal.png',
        'unique_speed_normal': 'unique_speed_normal.png',
        'wit_detrimental_passive_normal': 'wit_detrimental_passive_normal.png',
        'wit_passive_normal': 'wit_passive_normal.png'
    }
};
