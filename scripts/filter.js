// filter.js - Contains core logic for filtering and sorting runner data based on user-defined criteria.

import { state, CONSTANTS } from './state.js';
import { renderActiveTab } from './ui-renderer.js';

// Sorts the current filtered data and re-renders the active tab.
export function sortAndRender() {
    const sortBy = state.elements.filterElements.sort.value;
    const sortDir = state.elements.filterElements.sortDir.value;
    sortData(state.lastFilteredData, sortBy, sortDir);
    const allSparkCriteria = getAllSparkFilterCriteria();
    const activeTabId = document.querySelector('.tab-content.active')?.id;
    renderActiveTab(activeTabId, state.lastFilteredData, allSparkCriteria);
}

// Applies all active filters to the runner data and then triggers sorting and rendering.
export function filterAndRender() {
    state.allRunners.forEach(r => delete r._passingWhiteSparks);

    const baseFilters = {};
    for (const key in state.elements.filterElements) {
        const el = state.elements.filterElements[key];
        baseFilters[key] = el.type === 'checkbox' ? el.checked : el.value;
    }

    let filteredData = [...state.allRunners];

    if (baseFilters.runner) filteredData = filteredData.filter(r => r.name === baseFilters.runner);

    filteredData = filteredData.filter(r =>
        (parseInt(r.speed || 0)) >= parseInt(baseFilters.speed) &&
        (parseInt(r.stamina || 0)) >= parseInt(baseFilters.stamina) &&
        (parseInt(r.power || 0)) >= parseInt(baseFilters.power) &&
        (parseInt(r.guts || 0)) >= parseInt(baseFilters.guts) &&
        (parseInt(r.wit || 0)) >= parseInt(baseFilters.wit)
    );

    // Global Search Filter
    const globalSearchInput = document.getElementById('global-search-input');
    if (globalSearchInput && globalSearchInput.value.trim()) {
        const query = globalSearchInput.value.toLowerCase().trim();
        filteredData = filteredData.filter(r => {
            // Check Name
            if (r.name && r.name.toLowerCase().includes(query)) return true;
            
            // Check Grandparents
            if (r.gp1 && r.gp1.toLowerCase().includes(query)) return true;
            if (r.gp2 && r.gp2.toLowerCase().includes(query)) return true;

            // Check Skills
            if (r.skills && r.skills.some(s => s.toLowerCase().includes(query))) return true;

            // Check Sparks
            if (r.sparks && typeof r.sparks === 'object') {
                const sources = ['parent', 'gp1', 'gp2'];
                for (const source of sources) {
                    if (Array.isArray(r.sparks[source])) {
                        if (r.sparks[source].some(s => s.spark_name && s.spark_name.toLowerCase().includes(query))) {
                            return true;
                        }
                    }
                }
            }
            
            return false;
        });
    }

    const skillNameFilters = Array.from(document.querySelectorAll('.skill-name-input'))
        .map(input => input.value.toLowerCase().trim())
        .filter(val => val);

    if (skillNameFilters.length > 0) {
        filteredData = filteredData.filter(runner => {
            return skillNameFilters.every(filterText => 
                (runner.skills || []).some(runnerSkill => 
                    runnerSkill.toLowerCase().includes(filterText)
                )
            );
        });
    }

    const sparkFilterRows = document.querySelectorAll('#spark-filters-container .spark-filters');

    sparkFilterRows.forEach(row => {
        if (row.classList.contains('disabled')) {
            return; 
        }

        const isRepOnly = row.querySelector('.rep-only-checkbox').checked;

        const rowCriteria = {
            blue: { name: row.querySelector('[id^="filter-blue-spark"]').value, min: Number(row.querySelector('[id^="min-blue"]').value) },
            green: { name: row.querySelector('[id^="filter-green-spark"]').value, min: Number(row.querySelector('[id^="min-green"]').value) },
            pink: { name: row.querySelector('[id^="filter-pink-spark"]').value, min: Number(row.querySelector('[id^="min-pink"]').value) },
            white: { name: row.querySelector('[id^="filter-white-spark"]').value, min: Number(row.querySelector('[id^="min-white"]').value) },
            minTotalWhite: Number(row.querySelector('[id^="min-total-white"]').value)
        };

        if (rowCriteria.blue.name || rowCriteria.blue.min > 0) filteredData = filteredData.filter(r => checkSpark(r, 'blue', rowCriteria.blue.name, rowCriteria.blue.min, isRepOnly));
        if (rowCriteria.green.name || rowCriteria.green.min > 0) filteredData = filteredData.filter(r => checkSpark(r, 'green', rowCriteria.green.name, rowCriteria.green.min, isRepOnly));
        if (rowCriteria.pink.name || rowCriteria.pink.min > 0) filteredData = filteredData.filter(r => checkSpark(r, 'pink', rowCriteria.pink.name, rowCriteria.pink.min, isRepOnly));
        
        if (rowCriteria.white.name || rowCriteria.white.min > 0) {
            filteredData = filteredData.filter(r => {
                const result = checkWhiteSpark(r, rowCriteria.white.name, rowCriteria.white.min, isRepOnly);
                if (result.pass) {
                    if (!r._passingWhiteSparks) r._passingWhiteSparks = new Set();
                    result.passingSparks.forEach(sparkName => r._passingWhiteSparks.add(sparkName));
                }
                return result.pass;
            });
        }
        
        if (rowCriteria.minTotalWhite > 0) {
            filteredData = filteredData.filter(r => {
                const sparkSources = isRepOnly ? ['parent'] : ['parent', 'gp1', 'gp2'];
                let totalWhiteCount = 0;
                sparkSources.forEach(source => {
                    if (Array.isArray(r.sparks?.[source])) {
                        totalWhiteCount += r.sparks[source].filter(s => s?.color === 'white').length;
                    }
                });
                return totalWhiteCount >= rowCriteria.minTotalWhite;
            });
        }
    });

    const aptFiltersToCheck = {
        'aptMinTurf': 'turf', 'aptMinDirt': 'dirt', 'aptMinSprint': 'sprint', 'aptMinMile': 'mile',
        'aptMinMedium': 'medium', 'aptMinLong': 'long', 'aptMinFront': 'front', 'aptMinPace': 'pace',
        'aptMinLate': 'late', 'aptMinEnd': 'end'
    };
    for (const filterKey in aptFiltersToCheck) {
        const minGrade = baseFilters[filterKey];
        if (minGrade) {
            const dataKey = aptFiltersToCheck[filterKey];
            const minRankValue = CONSTANTS.APTITUDE_RANK_MAP[minGrade];
            filteredData = filteredData.filter(r => (CONSTANTS.APTITUDE_RANK_MAP[r[dataKey]?.toUpperCase() || ''] || -100) >= minRankValue);
        }
    }
    state.lastFilteredData = filteredData;
    sortAndRender();
}


// Helper function to check if a runner meets the criteria for a specific colored spark.
function checkSpark(runner, color, nameFilter, minStars, repOnly) {
    if (!nameFilter && minStars === 0) return true;

    const effectiveMinStars = (nameFilter && minStars === 0) ? 1 : minStars;
    const sparkSources = repOnly ? ['parent'] : ['parent', 'gp1', 'gp2'];
    const sparkTotals = {};

    for (const source of sparkSources) {
        if (Array.isArray(runner.sparks?.[source])) {
            for (const spark of runner.sparks[source]) {
                if (spark?.color === color && spark.spark_name) {
                    const name = spark.spark_name;
                    const count = parseInt(spark.count || 0, 10);
                    sparkTotals[name] = (sparkTotals[name] || 0) + count;
                }
            }
        }
    }

    if (nameFilter) {
        const lowerCaseNameFilter = nameFilter.toLowerCase();
        for (const [sparkName, totalStars] of Object.entries(sparkTotals)) {
            if (sparkName.toLowerCase().includes(lowerCaseNameFilter) && totalStars >= effectiveMinStars) {
                return true;
            }
        }
        return false;
    } else {
        for (const total of Object.values(sparkTotals)) {
            if (total >= effectiveMinStars) return true;
        }
        return false;
    }
}

// Helper function to check if a runner meets the criteria for a specific white spark.
function checkWhiteSpark(runner, nameFilter, minCount, repOnly) {
    const result = { pass: false, passingSparks: new Set() };

    if (!nameFilter && minCount === 0) {
        result.pass = true;
        return result;
    }
    
    const effectiveMinCount = (nameFilter && minCount === 0) ? 1 : minCount;
    const sparkSources = repOnly ? ['parent'] : ['parent', 'gp1', 'gp2'];
    const sparkTotals = {};

    for (const source of sparkSources) {
        if (Array.isArray(runner.sparks?.[source])) {
            for (const spark of runner.sparks[source]) {
                if (spark?.color === 'white' && spark.spark_name) {
                    const name = spark.spark_name;
                    const count = parseInt(spark.count, 10) || 0;
                    sparkTotals[name] = (sparkTotals[name] || 0) + count;
                }
            }
        }
    }

    if (nameFilter) {
        const lowerCaseNameFilter = nameFilter.toLowerCase();
        for (const [name, total] of Object.entries(sparkTotals)) {
            if (name.toLowerCase().includes(lowerCaseNameFilter) && total >= effectiveMinCount) {
                result.pass = true;
                result.passingSparks.add(name);
            }
        }
    } else {
        for (const [name, total] of Object.entries(sparkTotals)) {
            if (total >= effectiveMinCount) {
                result.pass = true;
                result.passingSparks.add(name);
            }
        }
    }
    return result;
}

// Sorts the provided data array based on the specified key and direction.
function sortData(data, sortBy, sortDir) {
    const getWhiteCount = (runner, sources) => {
        if (!runner.sparks || typeof runner.sparks !== 'object') return 0;
        let count = 0;
        sources.forEach(source => {
            if (Array.isArray(runner.sparks[source])) {
                count += runner.sparks[source].filter(s => s?.color === 'white').length;
            }
        });
        return count;
    };
    data.sort((a, b) => {
        let valA, valB;
        const whiteSortKeys = {
            'whites (parent)': ['parent'],
            'whites (total)': ['parent', 'gp1', 'gp2']
        };
        if (whiteSortKeys[sortBy]) {
            valA = getWhiteCount(a, whiteSortKeys[sortBy]);
            valB = getWhiteCount(b, whiteSortKeys[sortBy]);
        } else if (['turf', 'dirt', 'sprint', 'mile', 'medium', 'long', 'front', 'pace', 'late', 'end'].includes(sortBy)) {
            valA = CONSTANTS.APTITUDE_RANK_MAP[a[sortBy]?.toUpperCase() || ''] ?? -100;
            valB = CONSTANTS.APTITUDE_RANK_MAP[b[sortBy]?.toUpperCase() || ''] ?? -100;
        } else {
            valA = a[sortBy] ?? (sortBy === 'name' ? '' : 0);
            valB = b[sortBy] ?? (sortBy === 'name' ? '' : 0);
        }
        const numA = Number(valA) || 0;
        const numB = Number(valB) || 0;
        if (typeof valA === 'string' && typeof valB === 'string') {
            return sortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        } else {
            return sortDir === 'asc' ? numA - numB : numB - numA;
        }
    });
}

// Gathers all active spark filter criteria from the UI.
export function getAllSparkFilterCriteria() {
    const criteria = [];
    document.querySelectorAll('#spark-filters-container .spark-filters').forEach(row => {
        if (row.classList.contains('disabled')) {
            return;
        }
        const isRepOnly = row.querySelector('.rep-only-checkbox').checked;
        const rowCriteria = {
            blueSpark: row.querySelector('[id^="filter-blue-spark"]').value,
            minBlue: Number(row.querySelector('[id^="min-blue"]').value),
            greenSpark: row.querySelector('[id^="filter-green-spark"]').value,
            minGreen: Number(row.querySelector('[id^="min-green"]').value),
            pinkSpark: row.querySelector('[id^="filter-pink-spark"]').value,
            minPink: Number(row.querySelector('[id^="min-pink"]').value),
            whiteSpark: row.querySelector('[id^="filter-white-spark"]').value,
            minWhite: Number(row.querySelector('[id^="min-white"]').value),
            minTotalWhite: Number(row.querySelector('[id^="min-total-white"]').value),
            isRepOnly: isRepOnly 
        };
        if (Object.values(rowCriteria).some(val => val)) {
            criteria.push(rowCriteria);
        }
    });
    return criteria;
}
