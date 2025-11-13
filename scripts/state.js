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

    savedParentSetups: [],
    
    gpExistenceCache: new Map(),
    sparkFilterCounter: 1,
    skillFilterCounter: 1,
    maxTotalWhiteSparks: 0,
    maxParentWhiteSparks: 0,

    elements: {},
};

export const CONSTANTS = {
    APTITUDE_RANK_MAP: {'S': 5, 'A': 4, 'B': 3, 'C': 2, 'D': 1, 'E': 0, 'F': -1, 'G': -2, '': -100, 'N/A': -100},
    UMA_TEXT_DARK: '#8C4410',
    APTITUDE_COLORS: {
        'S': '#f0bd1a', 'A': '#f48337', 'B': '#e56487', 'C': '#61c340',
        'D': '#49ace2', 'E': '#d477f2', 'F': '#766ad6', 'G': '#b3b2b3', 'N/A': '#dddddd'
    },
    STAT_ICONS: {
        'speed': 'speed.png', 'stamina': 'stamina.png', 'power': 'power.png', 
        'guts': 'guts.png', 'wit': 'wit.png'
    }
};
