let allRunners = [];
let blueSparkNames = [];
let greenSparkNames = [];
let pinkSparkNames = [];
let whiteSparkNames = [];
let skillTypes = {}; // To store skill type mappings
let sparkFilterCounter = 1; // Counter for unique IDs for new filter rows

// --- DOM Element References ---
const filterElements = {
    runner: document.getElementById('filter-runner'),
    sort: document.getElementById('filter-sort'),
    sortDir: document.getElementById('filter-sort-direction'),
    repOnly: document.getElementById('filter-rep'),
    speed: document.getElementById('filter-speed'),
    stamina: document.getElementById('filter-stamina'),
    power: document.getElementById('filter-power'),
    guts: document.getElementById('filter-guts'),
    wit: document.getElementById('filter-wit'),
    aptMinTurf: document.getElementById('apt-min-turf'),
    aptMinDirt: document.getElementById('apt-min-dirt'),
    aptMinSprint: document.getElementById('apt-min-sprint'),
    aptMinMile: document.getElementById('apt-min-mile'),
    aptMinMedium: document.getElementById('apt-min-medium'),
    aptMinLong: document.getElementById('apt-min-long'),
    aptMinFront: document.getElementById('apt-min-front'),
    aptMinPace: document.getElementById('apt-min-pace'),
    aptMinLate: document.getElementById('apt-min-late'),
    aptMinEnd: document.getElementById('apt-min-end'),
};

const tabButtons = document.querySelectorAll('.tab-button');
const tabContents = document.querySelectorAll('.tab-content');
const parentSummaryBody = document.getElementById('parent-summary-body');
const aptitudeSummaryBody = document.getElementById('aptitude-summary-body');
const whiteSparksBody = document.getElementById('white-sparks-body');
const skillsSummaryBody = document.getElementById('skills-summary-body');

const aptitudeFiltersContainer = document.getElementById('aptitude-filters');
const resetFiltersButton = document.getElementById('reset-filters-button');
const addSparkFilterButton = document.getElementById('add-spark-filter-button');
const sparkFiltersContainer = document.getElementById('spark-filters-container');


// --- Constants (Ported from Python) ---
const APTITUDE_RANK_MAP = {'S': 5, 'A': 4, 'B': 3, 'C': 2, 'D': 1, 'E': 0, 'F': -1, 'G': -2, '': -100, 'N/A': -100};
const UMA_TEXT_DARK = '#8C4410';
const APTITUDE_COLORS = {
    'S': '#f0bd1a',
    'A': '#f48337',
    'B': '#e56487',
    'C': '#61c340',
    'D': '#49ace2',
    'E': '#d477f2',
    'F': '#766ad6',
    'G': '#b3b2b3',
    'N/A': '#dddddd'
};
const STAT_ICONS = {
    'speed': 'speed.png', 
    'stamina': 'stamina.png', 
    'power': 'power.png', 
    'guts': 'guts.png', 
    'wit': 'wit.png'
};

document.addEventListener('DOMContentLoaded', async () => {
    try {
        allRunners = await window.api.loadRunners();
        skillTypes = await window.api.loadSkillTypes();
        orderedSkills = await window.api.loadOrderedSkills();
        runnerUniqueSkills = await window.api.loadRunnerSkills();

        if (!allRunners || allRunners.length === 0) {
            console.warn("No runner data loaded.");
            const noDataMsg = '<tr><td colspan="18">No runner data found. Load data (all_runners.json) and restart.</td></tr>';
            parentSummaryBody.innerHTML = noDataMsg;
            aptitudeSummaryBody.innerHTML = noDataMsg;
            whiteSparksBody.innerHTML = noDataMsg;
            skillsSummaryBody.innerHTML = noDataMsg;
            return;
        }
        if (!orderedSkills) {
            console.error("Failed to load ordered skills. Sorting will be incorrect.");
            orderedSkills = [];
        }
        if (!runnerUniqueSkills) {
            console.error("Failed to load runner unique skills. Styling will be incorrect.");
            runnerUniqueSkills = {};
        }

        allRunners.forEach(runner => {
            if (typeof runner.sparks === 'string') {
                try { runner.sparks = JSON.parse(runner.sparks); }
                catch (e) { runner.sparks = {}; }
            } else if (runner.sparks === null || typeof runner.sparks !== 'object') {
                 runner.sparks = {};
            }
            if (typeof runner.skills === 'string') {
                runner.skills = runner.skills.split('|').map(s => s.trim()).filter(s => s);
            } else if (!Array.isArray(runner.skills)) {
                runner.skills = [];
            }
            Object.keys(APTITUDE_RANK_MAP).forEach(aptKey => {
                const rankKey = `${aptKey.toLowerCase()}`;
                if (runner[rankKey]) {
                    runner[rankKey] = runner[rankKey].toUpperCase();
                }
            });
        });


        extractSparkNames();
        populateFilters();
        setupEventListeners();

        handleTabChange('parent-summary');

    } catch (error) {
        console.error("Initialization failed:", error);
         const errorMsg = `<tr><td colspan="18">Error during initialization: ${error.message}. Check console.</td></tr>`;
            parentSummaryBody.innerHTML = errorMsg;
            aptitudeSummaryBody.innerHTML = errorMsg;
            whiteSparksBody.innerHTML = errorMsg;
            skillsSummaryBody.innerHTML = errorMsg;
    }
});

// --- Setup ---
function extractSparkNames() {
    const blue = new Set(), green = new Set(), pink = new Set(), white = new Set();
    allRunners.forEach(runner => {
        ['parent', 'gp1', 'gp2'].forEach(source => {
            if (Array.isArray(runner.sparks?.[source])) {
                runner.sparks[source].forEach(spark => {
                    if (spark?.spark_name) {
                        switch (spark.color) {
                            case 'blue': blue.add(spark.spark_name); break;
                            case 'green': green.add(spark.spark_name); break;
                            case 'pink': pink.add(spark.spark_name); break;
                            case 'white': white.add(spark.spark_name); break;
                        }
                    }
                });
            }
        });
    });
    blueSparkNames = [...blue].sort();
    greenSparkNames = [...green].sort();
    pinkSparkNames = [...pink].sort();
    whiteSparkNames = [...white].sort();
}

function populateFilters() {
    // Runner names
    const runnerNames = [...new Set(allRunners.map(r => r.name))].filter(Boolean).sort();
    filterElements.runner.innerHTML = '<option value="">All Runners</option>' + runnerNames.map(n => `<option value="${n}">${n}</option>`).join('');

    // Spark Names (for the first row)
    const firstSparkRow = document.querySelector('.spark-filters');
    firstSparkRow.querySelector('#filter-blue-spark').innerHTML = '<option value="">Any Blue</option>' + blueSparkNames.map(n => `<option value="${n}">${n}</option>`).join('');
    firstSparkRow.querySelector('#filter-green-spark').innerHTML = '<option value="">Any Green</option>' + greenSparkNames.map(n => `<option value="${n}">${n}</option>`).join('');
    firstSparkRow.querySelector('#filter-pink-spark').innerHTML = '<option value="">Any Pink</option>' + pinkSparkNames.map(n => `<option value="${n}">${n}</option>`).join('');
    firstSparkRow.querySelector('#filter-white-spark').innerHTML = '<option value="">Any White</option>' + whiteSparkNames.map(n => `<option value="${n}">${n}</option>`).join('');

    // Min Spark Counts
    let options1to9 = '';
    for(let i = 1; i <= 9; i++) { options1to9 += `<option value="${i}">${i}★</option>`; }
    firstSparkRow.querySelector('#min-blue').innerHTML = '<option value="0"></option>' + options1to9;
    firstSparkRow.querySelector('#min-green').innerHTML = '<option value="0"></option>' + options1to9;
    firstSparkRow.querySelector('#min-pink').innerHTML = '<option value="0"></option>' + options1to9;
    
    let maxWhiteSparks = 0;
    allRunners.forEach(runner => {
        let currentRunnerWhiteCount = 0;
        if (runner.sparks && typeof runner.sparks === 'object') {
            ['parent', 'gp1', 'gp2'].forEach(source => {
                if (Array.isArray(runner.sparks[source])) {
                    currentRunnerWhiteCount += runner.sparks[source].filter(s => s?.color === 'white').length;
                }
            });
        }
        maxWhiteSparks = Math.max(maxWhiteSparks, currentRunnerWhiteCount);
    });

    let whiteSparkOptions = '';
    for (let i = 1; i <= maxWhiteSparks; i++) {
        whiteSparkOptions += `<option value="${i}">${i}</option>`;
    }
    firstSparkRow.querySelector('#min-white').innerHTML = '<option value="0"></option>' + whiteSparkOptions;

    // Aptitude Grades
    const aptGrades = ['S', 'A', 'B', 'C', 'D'];
    const aptGradeOptions = aptGrades.map(g => `<option value="${g}">≥ ${g}</option>`).join('');
    [filterElements.aptMinTurf, filterElements.aptMinDirt, filterElements.aptMinSprint,
     filterElements.aptMinMile, filterElements.aptMinMedium, filterElements.aptMinLong,
     filterElements.aptMinFront, filterElements.aptMinPace, filterElements.aptMinLate,
     filterElements.aptMinEnd]
     .forEach(sel => {
        const placeholder = sel.innerHTML;
        sel.innerHTML = placeholder + aptGradeOptions;
     });

    filterElements.sortDir.value = 'desc';
}

function debounce(func, delay) {
    let timeoutId;
    return function(...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            func.apply(this, args);
        }, delay);
    };
}

function setupEventListeners() {
    const debouncedFilterAndRender = debounce(filterAndRender, 250);

    // Standard filters
    Object.values(filterElements).forEach(el => {
        if (el.id !== 'filter-rep' && el.type !== 'range') {
            el.addEventListener('change', filterAndRender);
        }
    });

    // Event listeners for the initial, static spark filter row
    document.querySelectorAll('.spark-filters select').forEach(el => {
        el.addEventListener('change', filterAndRender);
    });
    
    // Stat sliders
    ['speed', 'stamina', 'power', 'guts', 'wit'].forEach(stat => {
        const slider = filterElements[stat];
        const numInput = document.getElementById(`val-${stat}`);
        if (slider && numInput) {
            slider.addEventListener('input', () => {
                numInput.value = slider.value;
                debouncedFilterAndRender();
            });
            numInput.addEventListener('change', () => {
                let value = parseInt(numInput.value, 10) || 0;
                const min = parseInt(slider.min, 10);
                const max = parseInt(slider.max, 10);
                if (value < min) value = min;
                if (value > max) value = max;
                numInput.value = value;
                slider.value = value;
                filterAndRender();
            });
            numInput.value = slider.value;
        }
    });

    filterElements.repOnly.addEventListener('change', () => {
        updateSparkDropdowns(filterElements.repOnly.checked);
        filterAndRender(); 
    });

    tabButtons.forEach(button => {
        button.addEventListener('click', () => handleTabChange(button.dataset.tab));
    });

    resetFiltersButton.addEventListener('click', resetFilters);

    // --- NEW: Event listeners for adding/removing spark filters ---
    addSparkFilterButton.addEventListener('click', addSparkFilterRow);

    sparkFiltersContainer.addEventListener('click', (event) => {
        if (event.target.classList.contains('remove-spark-filter-button')) {
            event.target.closest('.spark-filters').remove();
            filterAndRender();
        }
    });
    
    parentSummaryBody.addEventListener('dblclick', handleDetailView);
    aptitudeSummaryBody.addEventListener('dblclick', handleDetailView);
    whiteSparksBody.addEventListener('dblclick', handleDetailView);
    skillsSummaryBody.addEventListener('dblclick', handleDetailView);
}

// --- NEW/MODIFIED DYNAMIC FILTER FUNCTIONS ---
function addSparkFilterRow() {
    const firstRow = document.querySelector('#spark-filters-container .spark-filters');
    if (!firstRow) return;

    const newRow = firstRow.cloneNode(true);
    newRow.querySelectorAll('select').forEach(select => select.selectedIndex = 0);

    const suffix = `-${sparkFilterCounter}`;
    newRow.querySelectorAll('label, select').forEach(el => {
        if (el.tagName === 'SELECT' && el.id) el.id += suffix;
        if (el.tagName === 'LABEL' && el.htmlFor) el.htmlFor += suffix;
    });

    newRow.querySelectorAll('select').forEach(el => el.addEventListener('change', filterAndRender));

    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.className = 'remove-spark-filter-button';
    removeButton.textContent = 'X';
    removeButton.title = 'Remove this filter row';
    newRow.appendChild(removeButton);
    
    sparkFiltersContainer.appendChild(newRow);
    sparkFilterCounter++;
    // Ensure the new dropdowns have the correct star counts if 'rep only' is checked
    updateSparkDropdowns(filterElements.repOnly.checked);
}

function getAllSparkFilterCriteria() {
    const criteria = [];
    const sparkFilterRows = document.querySelectorAll('#spark-filters-container .spark-filters');
    sparkFilterRows.forEach(row => {
        const rowCriteria = {
            blueSpark: row.querySelector('[id^="filter-blue-spark"]').value,
            minBlue: Number(row.querySelector('[id^="min-blue"]').value),
            greenSpark: row.querySelector('[id^="filter-green-spark"]').value,
            minGreen: Number(row.querySelector('[id^="min-green"]').value),
            pinkSpark: row.querySelector('[id^="filter-pink-spark"]').value,
            minPink: Number(row.querySelector('[id^="min-pink"]').value),
            whiteSpark: row.querySelector('[id^="filter-white-spark"]').value,
            minWhite: Number(row.querySelector('[id^="min-white"]').value)
        };
        // Only add criteria if at least one filter in the row is active
        if (Object.values(rowCriteria).some(val => val)) {
            criteria.push(rowCriteria);
        }
    });
    return criteria;
}

// --- Tab and Sort Logic ---
function handleTabChange(activeTabId) {
    tabButtons.forEach(b => b.classList.toggle('active', b.dataset.tab === activeTabId));
    tabContents.forEach(c => c.classList.toggle('active', c.id === activeTabId));

    const parentSort = ['score', 'name', 'speed', 'stamina', 'power', 'guts', 'wit', 'whites (parent)', 'whites (total)'];
    const aptSort = ['score', 'name', 'speed', 'stamina', 'power', 'guts', 'wit', 'turf', 'dirt', 'sprint', 'mile', 'medium', 'long', 'front', 'pace', 'late', 'end'];
    const whiteSparkSort = ['score', 'name', 'whites (parent)', 'whites (total)'];
    const skillsSort = ['score', 'name'];

    let options = [];
    switch (activeTabId) {
        case 'parent-summary': options = parentSort; break;
        case 'aptitude-summary': options = aptSort; break;
        case 'white-sparks': options = whiteSparkSort; break;
        case 'skills-summary': options = skillsSort; break;
        default: options = ['score', 'name'];
    }

    const currentSort = filterElements.sort.value;
    filterElements.sort.innerHTML = options.map(o => `<option value="${o}" ${o === currentSort ? 'selected' : ''}>${o.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>`).join('');
    if (!options.includes(currentSort)) {
         filterElements.sort.value = options.includes('score') ? 'score' : (options.includes('name') ? 'name' : options[0]);
    }

    aptitudeFiltersContainer.style.display = activeTabId === 'aptitude-summary' ? 'flex' : 'none';
    filterAndRender();
}

// --- Core Filtering Logic ---
function filterAndRender() {
    const filters = {};
    for (const key in filterElements) {
        const el = filterElements[key];
        filters[key] = el.type === 'checkbox' ? el.checked : el.value;
    }

    let filteredData = [...allRunners];

    if (filters.runner) filteredData = filteredData.filter(r => r.name === filters.runner);

    filteredData = filteredData.filter(r =>
        (parseInt(r.speed || 0)) >= parseInt(filters.speed) &&
        (parseInt(r.stamina || 0)) >= parseInt(filters.stamina) &&
        (parseInt(r.power || 0)) >= parseInt(filters.power) &&
        (parseInt(r.guts || 0)) >= parseInt(filters.guts) &&
        (parseInt(r.wit || 0)) >= parseInt(filters.wit)
    );

    // MODIFIED: Spark Filters Logic
    const sparkFilterRows = document.querySelectorAll('#spark-filters-container .spark-filters');
    const isRepOnly = filters.repOnly;

    sparkFilterRows.forEach(row => {
        const blueSpark = row.querySelector('[id^="filter-blue-spark"]').value;
        const minBlue = Number(row.querySelector('[id^="min-blue"]').value);
        const greenSpark = row.querySelector('[id^="filter-green-spark"]').value;
        const minGreen = Number(row.querySelector('[id^="min-green"]').value);
        const pinkSpark = row.querySelector('[id^="filter-pink-spark"]').value;
        const minPink = Number(row.querySelector('[id^="min-pink"]').value);
        const whiteSpark = row.querySelector('[id^="filter-white-spark"]').value;
        const minWhite = Number(row.querySelector('[id^="min-white"]').value);

        if (blueSpark || minBlue > 0) {
            filteredData = filteredData.filter(r => checkSpark(r, 'blue', blueSpark, minBlue, isRepOnly));
        }
        if (greenSpark || minGreen > 0) {
            filteredData = filteredData.filter(r => checkSpark(r, 'green', greenSpark, minGreen, isRepOnly));
        }
        if (pinkSpark || minPink > 0) {
            filteredData = filteredData.filter(r => checkSpark(r, 'pink', pinkSpark, minPink, isRepOnly));
        }
        if (whiteSpark || minWhite > 0) {
            filteredData = filteredData.filter(r => checkWhiteSpark(r, whiteSpark, minWhite, isRepOnly));
        }
    });

    // Aptitude Filters
    const aptFiltersToCheck = {
        'aptMinTurf': 'turf', 'aptMinDirt': 'dirt', 'aptMinSprint': 'sprint',
        'aptMinMile': 'mile', 'aptMinMedium': 'medium', 'aptMinLong': 'long',
        'aptMinFront': 'front', 'aptMinPace': 'pace', 'aptMinLate': 'late',
        'aptMinEnd': 'end'
    };
    for (const filterKey in aptFiltersToCheck) {
        const minGrade = filters[filterKey];
        if (minGrade) {
            const dataKey = aptFiltersToCheck[filterKey];
            const minRankValue = APTITUDE_RANK_MAP[minGrade];
            filteredData = filteredData.filter(r => (APTITUDE_RANK_MAP[r[dataKey]?.toUpperCase() || ''] || -100) >= minRankValue);
        }
    }

    const sortBy = filterElements.sort.value;
    const sortDir = filterElements.sortDir.value;
    sortData(filteredData, sortBy, sortDir);

    const activeTabId = document.querySelector('.tab-content.active')?.id;

    parentSummaryBody.innerHTML = '';
    aptitudeSummaryBody.innerHTML = '';
    whiteSparksBody.innerHTML = '';
    skillsSummaryBody.innerHTML = '';
    
    const allSparkCriteria = getAllSparkFilterCriteria();

    if (activeTabId === 'parent-summary') {
        renderParentSummary(filteredData, allSparkCriteria, isRepOnly);
    } else if (activeTabId === 'aptitude-summary') {
        renderAptitudeSummary(filteredData);
    } else if (activeTabId === 'white-sparks') {
         renderWhiteSparksSummary(filteredData, allSparkCriteria);
    } else if (activeTabId === 'skills-summary') {
         renderSkillsSummary(filteredData);
    }
}

function checkSpark(runner, color, nameFilter, minStars, repOnly) {
    if (!nameFilter && minStars === 0) return true;
    const sparkSources = repOnly ? ['parent'] : ['parent', 'gp1', 'gp2'];
    if (nameFilter) {
        let totalStars = 0;
        let foundSpecificSpark = false;
        for (const source of sparkSources) {
            if (Array.isArray(runner.sparks?.[source])) {
                for (const spark of runner.sparks[source]) {
                    if (spark?.color === color && spark.spark_name === nameFilter) {
                        totalStars += parseInt(spark.count || 0);
                        foundSpecificSpark = true;
                    }
                }
            }
        }
        return foundSpecificSpark && totalStars >= minStars;
    } 
    else { 
        const sparkTotals = {};
        for (const source of sparkSources) {
            if (Array.isArray(runner.sparks?.[source])) {
                for (const spark of runner.sparks[source]) {
                    if (spark?.color === color && spark.spark_name) {
                        const name = spark.spark_name;
                        const count = parseInt(spark.count || 0);
                        sparkTotals[name] = (sparkTotals[name] || 0) + count;
                    }
                }
            }
        }
        for (const total of Object.values(sparkTotals)) {
            if (total >= minStars) return true; 
        }
        return false;
    }
}

function checkWhiteSpark(runner, nameFilter, minCount, repOnly) {
    const sparkSources = repOnly ? ['parent'] : ['parent', 'gp1', 'gp2'];
    let matchingSparksCount = 0;
    let foundSpecificSpark = false;
    const countedSparks = new Set();

    for (const source of sparkSources) {
         if (Array.isArray(runner.sparks?.[source])) {
            for (const spark of runner.sparks[source]) {
                 if (spark?.color === 'white') {
                    if (!nameFilter) {
                        const sparkIdentifier = repOnly ? spark.spark_name : `${source}-${spark.spark_name}`;
                        if (spark.spark_name && !countedSparks.has(sparkIdentifier)) {
                            matchingSparksCount++;
                            countedSparks.add(sparkIdentifier);
                        }
                    } else if (spark.spark_name === nameFilter) {
                         matchingSparksCount++;
                         foundSpecificSpark = true;
                    }
                }
            }
        }
    }

     if (!nameFilter && minCount === 0) return true;
     if (nameFilter) return foundSpecificSpark && matchingSparksCount >= minCount;
     if (!nameFilter) return matchingSparksCount >= minCount;
    return false;
}


function sortData(data, sortBy, sortDir) {
    data.sort((a, b) => {
        let valA, valB;

        if (sortBy === 'whites (parent)' || sortBy === 'whites (total)') {
            const getWhiteCount = (runner, type) => {
                 if (!runner.sparks || typeof runner.sparks !== 'object') return 0;
                 let count = 0;
                 const sources = type === 'parent' ? ['parent'] : ['parent', 'gp1', 'gp2'];
                 sources.forEach(source => {
                     if (Array.isArray(runner.sparks[source])) {
                         count += runner.sparks[source].filter(s => s?.color === 'white').length;
                     }
                 });
                 return count;
            };
            valA = getWhiteCount(a, sortBy === 'whites (parent)' ? 'parent' : 'total');
            valB = getWhiteCount(b, sortBy === 'whites (parent)' ? 'parent' : 'total');
        } else if (['turf', 'dirt', 'sprint', 'mile', 'medium', 'long', 'front', 'pace', 'late', 'end'].includes(sortBy)) {
            const dataKey = `${sortBy}`;
            valA = APTITUDE_RANK_MAP[a[dataKey]?.toUpperCase() || ''] ?? -100;
            valB = APTITUDE_RANK_MAP[b[dataKey]?.toUpperCase() || ''] ?? -100;
        } else {
            valA = a[sortBy] ?? (sortBy === 'name' ? '' : 0);
            valB = b[sortBy] ?? (sortBy === 'name' ? '' : 0);
        }

        if (typeof valA === 'string' && typeof valB === 'string') {
            return sortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        } else {
            const numA = Number(valA) || 0;
            const numB = Number(valB) || 0;
            return sortDir === 'asc' ? numA - numB : numB - numA;
        }
    });
}

// --- Rendering ---
function renderParentSummary(runners, allSparkCriteria, isRepOnly) {
    if (!runners.length) {
        parentSummaryBody.innerHTML = '<tr><td colspan="14">No runners match filters.</td></tr>';
        return;
    }
    const html = runners.map(r => {
        let whiteTotal = 0, whiteParent = 0;
         if (r.sparks && typeof r.sparks === 'object'){
             ['parent', 'gp1', 'gp2'].forEach(source => {
                 if(Array.isArray(r.sparks[source])) {
                    const count = r.sparks[source].filter(s => s?.color === 'white').length;
                    whiteTotal += count;
                    if (source === 'parent') whiteParent = count;
                 }
             });
         }
        const whiteDisplay = `${whiteTotal}(${whiteParent})`;

        return `
        <tr data-entry-id="${r.entry_id || ''}">
            <td>${r.entry_id || 'N/A'}</td>
            <td class="left-align"><span class="outline-label">${r.name || 'N/A'}</span></td>
            <td>${(r.score || 0).toLocaleString()}</td>
            <td class="aptitude-${getStatGrade(r.speed)}">${r.speed || 0}</td>
            <td class="aptitude-${getStatGrade(r.stamina)}">${r.stamina || 0}</td>
            <td class="aptitude-${getStatGrade(r.power)}">${r.power || 0}</td>
            <td class="aptitude-${getStatGrade(r.guts)}">${r.guts || 0}</td>
            <td class="aptitude-${getStatGrade(r.wit)}">${r.wit || 0}</td>
            <td class="spark-cell">${formatSparks(r, 'blue', allSparkCriteria, isRepOnly)}</td>
            <td class="spark-cell">${formatSparks(r, 'green', allSparkCriteria, isRepOnly)}</td>
            <td class="spark-cell">${formatSparks(r, 'pink', allSparkCriteria, isRepOnly)}</td>
            <td>${whiteDisplay}</td>
            <td >${(r.gp1 || 'N/A').replace(/ c$/, '')}</td>
            <td >${(r.gp2 || 'N/A').replace(/ c$/, '')}</td>
        </tr>
    `}).join('');
    parentSummaryBody.innerHTML = html;
    hideEntryIdColumn('parent-summary');
}


function renderAptitudeSummary(runners) {
     if (!runners.length) {
        aptitudeSummaryBody.innerHTML = '<tr><td colspan="18">No runners match filters.</td></tr>';
        return;
    }
     const html = runners.map(r => `
        <tr data-entry-id="${r.entry_id || ''}">
            <td>${r.entry_id || 'N/A'}</td>
            <td class="left-align"><span class="outline-label">${r.name || 'N/A'}</span></td>
            <td>${(r.score || 0).toLocaleString()}</td>
            <td class="aptitude-${getStatGrade(r.speed)}">${r.speed || 0}</td>
            <td class="aptitude-${getStatGrade(r.stamina)}">${r.stamina || 0}</td>
            <td class="aptitude-${getStatGrade(r.power)}">${r.power || 0}</td>
            <td class="aptitude-${getStatGrade(r.guts)}">${r.guts || 0}</td>
            <td class="aptitude-${getStatGrade(r.wit)}">${r.wit || 0}</td>
            ${['turf', 'dirt', 'sprint', 'mile', 'medium', 'long', 'front', 'pace', 'late', 'end']
                .map(apt => {
                    const grade = r[`${apt}`]?.toUpperCase() || 'G';
                    return `<td class="aptitude aptitude-${grade}">${grade}</td>`;
                 }).join('')}
        </tr>
    `).join('');
    aptitudeSummaryBody.innerHTML = html;
    hideEntryIdColumn('aptitude-summary');
}

function renderWhiteSparksSummary(runners, allSparkCriteria) {
     if (!runners.length) {
        whiteSparksBody.innerHTML = '<tr><td colspan="5">No runners match filters.</td></tr>';
        return;
    }
     const html = runners.map(r => {
        let whiteTotal = 0, whiteParent = 0;
        let parentSparkDetails = [], totalSparkDetails = [];

        if (r.sparks && typeof r.sparks === 'object'){
             ['parent', 'gp1', 'gp2'].forEach(source => {
                 if(Array.isArray(r.sparks[source])) {
                    r.sparks[source].forEach(spark => {
                        if (spark?.color === 'white' && spark.spark_name) {
                             whiteTotal++;
                             totalSparkDetails.push(spark.spark_name);
                             if (source === 'parent') {
                                 whiteParent++;
                                 parentSparkDetails.push(spark.spark_name);
                             }
                        }
                    });
                 }
             });
         }
        const whiteParentDisplay = `${whiteParent} (${parentSparkDetails.slice(0, 3).join(', ')}${parentSparkDetails.length > 3 ? '...' : ''})`;
        const whiteTotalDisplay = `${whiteTotal} (${totalSparkDetails.slice(0, 3).join(', ')}${totalSparkDetails.length > 3 ? '...' : ''})`;

        let parentHtml = whiteParentDisplay, totalHtml = whiteTotalDisplay;
        
        const whiteSparkFilter = allSparkCriteria.map(c => c.whiteSpark).find(f => f);
        if (whiteSparkFilter) {
            const regex = new RegExp(escapeRegExp(whiteSparkFilter), 'gi');
            parentHtml = parentHtml.replace(regex, '<b>$&</b>');
            totalHtml = totalHtml.replace(regex, '<b>$&</b>');
        }

        return `
        <tr data-entry-id="${r.entry_id || ''}">
            <td>${r.entry_id || 'N/A'}</td>
            <td class="left-align"><span class="outline-label">${r.name || 'N/A'}</span></td>
            <td>${(r.score || 0).toLocaleString()}</td>
            <td class="left-align spark-cell">${parentHtml}</td>
            <td class="left-align spark-cell">${totalHtml}</td>
        </tr>
    `}).join('');
    whiteSparksBody.innerHTML = html;
    hideEntryIdColumn('white-sparks');
}


function renderSkillsSummary(runners) {
     if (!runners.length) {
        skillsSummaryBody.innerHTML = '<tr><td colspan="4">No runners match filters.</td></tr>';
        return;
    }
    const html = runners.map(r => `
        <tr data-entry-id="${r.entry_id || ''}">
             <td>${r.entry_id || 'N/A'}</td>
            <td class="left-align"><span class="outline-label">${r.name || 'N/A'}</span></td>
            <td>${(r.score || 0).toLocaleString()}</td>
            <td class="left-align spark-cell">${(Array.isArray(r.skills) ? r.skills.join(', ') : '') || 'N/A'}</td>
        </tr>
    `).join('');
    skillsSummaryBody.innerHTML = html;
     hideEntryIdColumn('skills-summary');
}

function formatSparks(runner, color, allCriteria, repOnly) {
    const sparks = {}, parentSparks = {};
    ['parent', 'gp1', 'gp2'].forEach(source => {
        if (Array.isArray(runner.sparks?.[source])) {
            runner.sparks[source].forEach(spark => {
                 if (spark?.color === color && spark.spark_name) {
                    const name = spark.spark_name;
                    const count = parseInt(spark.count || 0);
                    sparks[name] = (sparks[name] || 0) + count;
                    if (source === 'parent') {
                        parentSparks[name] = (parentSparks[name] || 0) + count;
                    }
                }
            });
        }
    });

    const parts = Object.entries(sparks)
        .sort(([nameA], [nameB]) => nameA.localeCompare(nameB))
        .map(([name, totalCount]) => {
            const parentCount = parentSparks[name] || 0;
            let displayPart = `${name} ${totalCount}`;
            if (parentCount > 0) displayPart += `(${parentCount})`;

            let shouldHighlight = false;
            const countToCheck = repOnly ? parentCount : totalCount;

            for (const criteria of allCriteria) {
                const nameFilter = criteria[`${color}Spark`];
                const minCount = criteria[`min${color.charAt(0).toUpperCase() + color.slice(1)}`];

                if (nameFilter) {
                    if (name === nameFilter && countToCheck >= minCount) {
                        shouldHighlight = true;
                        break;
                    }
                } else if (minCount > 0) {
                     if (countToCheck >= minCount) {
                        shouldHighlight = true;
                        break;
                    }
                }
            }
            return shouldHighlight ? `<b>${displayPart}</b>` : displayPart;
        });

    return parts.join(', ') || '<span style="color: #888;">N/A</span>';
}

// --- Detail View (Modal) Logic ---

function handleDetailView(event) {
    const tableRow = event.target.closest('tr');
    if (!tableRow || !tableRow.dataset.entryId) return;

    const entryId = tableRow.dataset.entryId;
    const runner = allRunners.find(r => String(r.entry_id) === String(entryId));

    if (runner) {
        showDetailModal(runner);
    } else {
        console.warn(`Runner data not found for entry ID: ${entryId}`);
        alert(`Error: Could not find data for runner with ID ${entryId}.`);
    }
}

function showDetailModal(runner) {
    const existingModal = document.getElementById('detail-modal-overlay');
    if (existingModal) existingModal.remove();

    const overlay = document.createElement('div');
    overlay.id = 'detail-modal-overlay';
    overlay.onclick = (e) => {
        if (e.target.id === 'detail-modal-overlay') {
             overlay.remove();
        }
    };

    const modal = document.createElement('div');
    modal.id = 'detail-modal';

    const header = document.createElement('div');
    header.className = 'modal-header';
    const runnerName = runner.name || 'N/A';
    const runnerImgName = runnerName.replace(/ /g, '_');
    const runnerImgPath = `../assets/profile_images/${runnerImgName}.png`;

    const score = runner.score || 0;
    const rankGrade = calculateRank(score);
    
    const rankColor = getAptitudeColor(rankGrade);
    const rankTopColor = adjustColor(rankColor, 40);
    const rankRibbonColor = adjustColor(rankColor, -25);
    const rankStyle = `
        --rank-base-color: ${rankColor};
        --rank-top-color: ${rankTopColor};
        --rank-ribbon-color: ${rankRibbonColor};
    `;

    header.innerHTML = `
        <div class="modal-header-left">
            <div class="modal-profile-frame">
                <div class="modal-profile-frame-outline">
                    <div class="modal-profile-img" style="background-image: url('${runnerImgPath}')"></div>
                </div>
            </div>
            <div class="modal-score">${score.toLocaleString()}</div>
        </div>
        <div class="modal-header-right">
            <div class="modal-identity">
                <div class="modal-rank-container" style="${rankStyle}">
                    <div class="modal-rank-badge">
                        <div class="modal-rank-grade">${rankGrade}</div>
                        <div class="modal-rank-text">RANK</div>
                    </div>
                </div>
                <div class="modal-runner-name">${runnerName.replace(' ', '<br>')}</div>
            </div>
        </div>
    `;

    const content = document.createElement('div');
    content.id = 'detail-modal-content';

    const statsBar = document.createElement('div');
    statsBar.className = 'modal-stats-bar';
    let statsHtml = '';
    ['speed', 'stamina', 'power', 'guts', 'wit'].forEach(stat => {
        const value = runner[stat] || 0;
        const grade = getStatGrade(value);
        const { gradeColor, topColor, bottomColor, outlineColor } = getGradeColors(grade);

        statsHtml += `
            <div class="modal-stat-column">
                <div class="modal-stat-header">
                    <img class="stat-icon" src="../assets/stat_icons/${STAT_ICONS[stat]}" alt="${stat}">
                    <span class="stat-text">${stat.charAt(0).toUpperCase() + stat.slice(1)}</span>
                </div>
                <div class="modal-stat-content">
                    <div class="modal-stat-grade stat-outline" style="--stat-outline-color: ${outlineColor}; background-image: linear-gradient(to bottom, ${topColor}, ${bottomColor});">
                        ${formatGradeForDisplay(grade)}
                    </div>
                    <div class="modal-stat-value">${value}</div>
                </div>
            </div>
        `;
    });
    statsBar.innerHTML = statsHtml;
    content.appendChild(statsBar);

    const aptitudes = document.createElement('div');
    aptitudes.className = 'modal-aptitudes';
    let aptsHtml = '';
    const aptTypes = {
        'Track': ['turf', 'dirt'],
        'Distance': ['sprint', 'mile', 'medium', 'long'],
        'Style': ['front', 'pace', 'late', 'end']
    };

    Object.entries(aptTypes).forEach(([typeLabel, aptKeys]) => {
        aptsHtml += `<div class="modal-apt-label">${typeLabel}</div>`;
        aptKeys.forEach(key => {
            const grade = runner[`${key}`]?.toUpperCase() || 'G';
            const { gradeColor, topColor, bottomColor, outlineColor } = getGradeColors(grade);
            
            aptsHtml += `
                <div class="modal-apt-button">
                    <div class="modal-apt-name">${key.charAt(0).toUpperCase() + key.slice(1)}</div>
                    <div class="modal-apt-grade apt-outline" style="--apt-outline-color: ${outlineColor}; background-image: linear-gradient(to bottom, ${topColor}, ${bottomColor});">
                        ${formatGradeForDisplay(grade)}
                    </div>
                </div>
            `;
        });
        if (aptKeys.length < 4) {
            aptsHtml += `<div style="grid-column: span ${4 - aptKeys.length};"></div>`;
        }
    });
    aptitudes.innerHTML = aptsHtml;
    content.appendChild(aptitudes);

    const skillsSection = document.createElement('div');
    skillsSection.className = 'modal-skills-section';
    const skillsList = document.createElement('div');
    skillsList.className = 'modal-skills-list';

    skillsList.style.display = 'grid';
    skillsList.style.gridTemplateColumns = 'repeat(2, 1fr)';
    skillsList.style.gap = '8px 12px';

    let skillsHtml = '';
    const runnerSkills = runner.skills || [];

    if (runnerSkills.length > 0) {
        const sortedSkills = [...runnerSkills].sort((a, b) => {
            const indexA = orderedSkills.indexOf(a);
            const indexB = orderedSkills.indexOf(b);
            if (indexA === -1) return 1;
            if (indexB === -1) return -1;
            return indexA - indexB;
        });

        sortedSkills.forEach((skillName, index) => {
            const skillType = skillTypes[skillName] || null;
            let itemClass = 'modal-skill-item';
            if (skillType) {
                const uniqueSkillName = runnerUniqueSkills[runner.name];
                if (skillType.startsWith('unique') || (uniqueSkillName && uniqueSkillName === skillName)) {
                    itemClass += ' unique';
                } else if (skillType.endsWith('g')) {
                    itemClass += ' gold';
                }
            }

            const iconPath = skillType ? `../assets/skill_icons/${skillType}.png` : '';
            const iconStyle = iconPath ? `background-image: url('${iconPath}')` : '';

            skillsHtml += `
                <div class="${itemClass}">
                    <div class="modal-skill-icon" style="${iconStyle}"></div>
                    <div class="modal-skill-name">${formatSkillName(skillName)}</div>
                </div>
            `;
        });

    } else {
        skillsHtml = '<div style="grid-column: span 2; text-align: center; color: #888;">No skills listed.</div>';
    }
    skillsList.innerHTML = skillsHtml;

    skillsSection.innerHTML = '<div class="modal-skills-title">Skills</div>';
    skillsSection.appendChild(skillsList);
    content.appendChild(skillsSection);
    
    const footer = document.createElement('div');
    footer.className = 'modal-footer';
    footer.innerHTML = '<button id="modal-close-button">Close</button>';
    footer.querySelector('#modal-close-button').onclick = () => overlay.remove();

    modal.appendChild(header);
    modal.appendChild(content);
    modal.appendChild(footer);
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
}

// --- Modal Helper Functions (Ported from Python) ---

function updateSparkDropdowns(isRepOnly) {
    const maxStars = isRepOnly ? 3 : 9;
    const allMinDropdowns = document.querySelectorAll('[id^="min-blue"], [id^="min-green"], [id^="min-pink"]');

    allMinDropdowns.forEach(dropdown => {
        const currentValue = parseInt(dropdown.value, 10);
        let newOptions = '<option value="0"></option>';
        for (let i = 1; i <= maxStars; i++) {
            newOptions += `<option value="${i}">${i}★</option>`;
        }
        dropdown.innerHTML = newOptions;

        if (currentValue > maxStars) {
            dropdown.value = maxStars;
        } else {
            dropdown.value = currentValue;
        }
    });
}

function getStatGrade(value) {
    value = parseInt(value || 0);
    if (value >= 1150) return 'SS+';
    if (value >= 1100) return 'SS';
    if (value >= 1050) return 'S+';
    if (value >= 1000) return 'S';
    if (value >= 900) return 'A+';
    if (value >= 800) return 'A';
    if (value >= 700) return 'B+';
    if (value >= 600) return 'B';
    if (value >= 500) return 'C+';
    if (value >= 400) return 'C';
    if (value >= 350) return 'D+';
    if (value >= 300) return 'D';
    if (value >= 250) return 'E+';
    if (value >= 200) return 'E';
    if (value >= 150) return 'F+';
    if (value >= 100) return 'F';
    return 'G';
}

function calculateRank(score) {
    if (score >= 19200) return 'SS<sup>+</sup>';
    if (score >= 17500) return 'SS';
    if (score >= 15900) return 'S<sup>+</sup>';
    if (score >= 14500) return 'S';
    if (score >= 12100) return 'A<sup>+</sup>';
    if (score >= 10000) return 'A';
    if (score >= 8200) return 'B<sup>+</sup>';
    if (score >= 6500) return 'B';
    if (score >= 4900) return 'C<sup>+</sup>';
    if (score >= 3500) return 'C';
    if (score >= 2900) return 'D<sup>+</sup>';
    if (score >= 2300) return 'D';
    if (score >= 1800) return 'E<sup>+</sup>';
    if (score >= 1300) return 'E';
    if (score >= 900) return 'F<sup>+</sup>';
    if (score >= 600) return 'F';
    if (score >= 300) return 'G<sup>+</sup>';
    return 'G';
}

function formatGradeForDisplay(grade) {
    if (!grade) return 'G';
    if (grade.endsWith('+')) {
        return `${grade.slice(0, -1)}<sup>+</sup>`;
    }
    return grade;
}

function getAptitudeColor(grade) {
    const baseGrade = grade?.replace('<sup>+</sup>', '').replace('+', '').replace('SS', 'S');
    return APTITUDE_COLORS[baseGrade] || '#b3b2b3';
}

function mixColors(color1, color2, ratio = 0.5) {
    const hexToRgb = (hex) => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return { r, g, b };
    };
    const rgbToHex = (r, g, b) => '#' + [r, g, b].map(x => {
        const hex = x.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    }).join('');

    try {
        const c1 = hexToRgb(color1);
        const c2 = hexToRgb(color2);
        const r = Math.round(c1.r * (1 - ratio) + c2.r * ratio);
        const g = Math.round(c1.g * (1 - ratio) + c2.g * ratio);
        const b = Math.round(c1.b * (1 - ratio) + c2.b * ratio);
        return rgbToHex(r, g, b);
    } catch (e) {
        return color1;
    }
}

function adjustColor(hex, percent) {
     const hexToRgb = (hex) => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return { r, g, b };
    };
    const rgbToHex = (r, g, b) => '#' + [r, g, b].map(x => {
        const val = Math.round(Math.min(255, Math.max(0, x)));
        const hex = val.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    }).join('');

    try {
        const { r, g, b } = hexToRgb(hex);
        const factor = 1 + (percent / 100); 
        return rgbToHex(r * factor, g * factor, b * factor);
    } catch (e) {
        console.warn(`Error adjusting color ${hex}: ${e}`);
        return hex;
    }
}

function getGradeColors(grade) {
    const gradeColor = getAptitudeColor(grade);
    const outlineColor = mixColors(gradeColor, UMA_TEXT_DARK, 0.7);
    const topColor = adjustColor(gradeColor, 150);
    const bottomColor = adjustColor(gradeColor, 0);
    return { gradeColor, topColor, bottomColor, outlineColor };
}

function formatSkillName(skillName) {
    if (!skillName) return "";
    return skillName.replace(/(◎|○|×)/g, '<span style="font-size: 1.1em;">$1</span>');
}

// --- Other Helper Functions ---
function hideEntryIdColumn(tabId) {
    const table = document.querySelector(`#${tabId} table`);
    if (!table) return;
    const headerCell = table.querySelector('thead th:first-child');
    const bodyCells = table.querySelectorAll('tbody td:first-child');
    if (headerCell) headerCell.style.display = 'none';
    bodyCells.forEach(cell => cell.style.display = 'none');
}

function resetFilters() {
    for (const key in filterElements) {
        const el = filterElements[key];
        if (el.type === 'checkbox') el.checked = false;
        else if (el.type === 'range') {
            el.value = 0;
            const display = document.getElementById(`val-${key}`);
            if (display) display.value = '0';
        } 
        else if (el.tagName === 'SELECT') el.selectedIndex = 0;
        else el.value = '';
    }
    
    // MODIFIED: Reset dynamic spark filters
    sparkFiltersContainer.querySelectorAll('.spark-filters:not(:first-child)').forEach(row => row.remove());
    const firstRow = sparkFiltersContainer.querySelector('.spark-filters');
    if (firstRow) {
        firstRow.querySelectorAll('select').forEach(select => select.selectedIndex = 0);
    }

    updateSparkDropdowns(false);

    filterElements.sortDir.value = 'desc';
    filterAndRender();
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}