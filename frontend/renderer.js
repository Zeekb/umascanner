let allRunners = [];
let blueSparkNames = [];
let greenSparkNames = [];
let pinkSparkNames = [];
let whiteSparkNames = [];
let skillTypes = {};
let orderedSkills = [];
let runnerUniqueSkills = {};
let orderedSparks = {};
let allRunnerNamesSet = new Set();
let sparkFilterCounter = 1;
const gpExistenceCache = new Map();
const cleanName = (name) => name ? name.replace(/ c$/, '').trim() : '';

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
const whiteSparksBody = document.getElementById('white-sparks-body');
// skillsSummaryBody has been removed

const aptitudeFiltersContainer = document.getElementById('aptitude-filters');
const resetFiltersButton = document.getElementById('reset-filters-button');
const addSparkFilterButton = document.getElementById('add-spark-filter-button');
const sparkFiltersContainer = document.getElementById('spark-filters-container');


// --- Constants ---
const APTITUDE_RANK_MAP = {'S': 5, 'A': 4, 'B': 3, 'C': 2, 'D': 1, 'E': 0, 'F': -1, 'G': -2, '': -100, 'N/A': -100};
const UMA_TEXT_DARK = '#8C4410';
const APTITUDE_COLORS = {
    'S': '#f0bd1a', 'A': '#f48337', 'B': '#e56487', 'C': '#61c340',
    'D': '#49ace2', 'E': '#d477f2', 'F': '#766ad6', 'G': '#b3b2b3', 'N/A': '#dddddd'
};
const STAT_ICONS = {
    'speed': 'speed.png', 'stamina': 'stamina.png', 'power': 'power.png', 
    'guts': 'guts.png', 'wit': 'wit.png'
};

document.addEventListener('DOMContentLoaded', async () => {
    try {
        [allRunners, skillTypes, orderedSkills, runnerUniqueSkills, orderedSparks] = await Promise.all([
            window.api.loadRunners(),
            window.api.loadSkillTypes(),
            window.api.loadOrderedSkills(),
            window.api.loadRunnerSkills(),
            window.api.loadOrderedSparks()
        ]);

        if (!allRunners || allRunners.length === 0) {
            console.warn("No runner data loaded.");
            const noDataMsg = '<tr><td colspan="18">No runner data found.</td></tr>';
            [parentSummaryBody, whiteSparksBody].forEach(body => body.innerHTML = noDataMsg);
            return;
        }
        
        if (!orderedSparks) {
            console.warn("ordered sparks data (sparks.json) not found. Falling back to alphabetical order.");
            orderedSparks = {};
        }

        allRunners.forEach(runner => {
            runner.sparks = (typeof runner.sparks === 'string') ? JSON.parse(runner.sparks) : runner.sparks || {};
            runner.skills = (typeof runner.skills === 'string') ? runner.skills.split('|').map(s => s.trim()).filter(s => s) : runner.skills || [];
        });

        extractSparkNames();
        populateFilters();
        setupEventListeners();
        handleTabChange('parent-summary');
    } catch (error) {
        console.error("Initialization failed:", error);
        const errorMsg = `<tr><td colspan="18">Error: ${error.message}.</td></tr>`;
        [parentSummaryBody, whiteSparksBody].forEach(body => body.innerHTML = errorMsg);
    }
});

function createSearchableSelect(inputElement, optionsArray) {
    const container = inputElement.parentElement;
    const optionsContainer = container.querySelector('.options-container');

    const populateOptions = (filter = '') => {
        const lowerCaseFilter = filter.toLowerCase();
        optionsContainer.innerHTML = '';
        const anyOption = document.createElement('div');
        anyOption.className = 'option-item';
        anyOption.textContent = inputElement.placeholder;
        anyOption.dataset.value = '';
        optionsContainer.appendChild(anyOption);
        optionsArray.forEach(option => {
            if (option.toLowerCase().includes(lowerCaseFilter)) {
                const optionEl = document.createElement('div');
                optionEl.className = 'option-item';
                optionEl.textContent = option;
                optionEl.dataset.value = option;
                optionsContainer.appendChild(optionEl);
            }
        });
        optionsContainer.style.display = optionsContainer.children.length > 1 ? 'block' : 'none';
    };

    inputElement.addEventListener('focus', () => populateOptions(''));
    inputElement.addEventListener('input', () => populateOptions(inputElement.value));
    
    optionsContainer.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('option-item')) {
            inputElement.value = e.target.dataset.value;
            optionsContainer.style.display = 'none';
            filterAndRender();
        }
    });
}

function extractSparkNames() {
    const extracted = { blue: new Set(), green: new Set(), pink: new Set(), white: new Set() };
    allRunners.forEach(runner => {
        ['parent', 'gp1', 'gp2'].forEach(source => {
            if (Array.isArray(runner.sparks?.[source])) {
                runner.sparks[source].forEach(spark => {
                    if (spark?.spark_name && extracted[spark.color]) {
                        extracted[spark.color].add(spark.spark_name);
                    }
                });
            }
        });
    });

    if (orderedSparks?.blue && Array.isArray(orderedSparks.blue)) {
        blueSparkNames = orderedSparks.blue.filter(name => extracted.blue.has(name));
    } else {
        blueSparkNames = [...extracted.blue].sort();
    }
    if (orderedSparks?.pink && Array.isArray(orderedSparks.pink)) {
        pinkSparkNames = orderedSparks.pink.filter(name => extracted.pink.has(name));
    } else {
        pinkSparkNames = [...extracted.pink].sort();
    }
    greenSparkNames = [...extracted.green].sort();
    whiteSparkNames = [...extracted.white].sort();
}

function populateFilters() {
    const runnerNames = [...new Set(allRunners.map(r => r.name))].filter(Boolean).sort();
    filterElements.runner.innerHTML = '<option value="">All Runners</option>' + runnerNames.map(n => `<option value="${n}">${n}</option>`).join('');

    const firstSparkRow = document.querySelector('.spark-filters');
    createSearchableSelect(firstSparkRow.querySelector('#filter-blue-spark'), blueSparkNames);
    createSearchableSelect(firstSparkRow.querySelector('#filter-green-spark'), greenSparkNames);
    createSearchableSelect(firstSparkRow.querySelector('#filter-pink-spark'), pinkSparkNames);
    createSearchableSelect(firstSparkRow.querySelector('#filter-white-spark'), whiteSparkNames);

    let options1to9 = '';
    for(let i = 1; i <= 9; i++) { options1to9 += `<option value="${i}">${i}★</option>`; }
    firstSparkRow.querySelector('#min-blue').innerHTML = '<option value="0"></option>' + options1to9;
    firstSparkRow.querySelector('#min-green').innerHTML = '<option value="0"></option>' + options1to9;
    firstSparkRow.querySelector('#min-pink').innerHTML = '<option value="0"></option>' + options1to9;
    
    let maxWhiteSparks = allRunners.reduce((max, runner) => {
        let count = 0;
        if (runner.sparks && typeof runner.sparks === 'object') {
            ['parent', 'gp1', 'gp2'].forEach(source => {
                if (Array.isArray(runner.sparks[source])) {
                    count += runner.sparks[source].filter(s => s?.color === 'white').length;
                }
            });
        }
        return Math.max(max, count);
    }, 0);

    let whiteSparkOptions = '';
    for (let i = 1; i <= maxWhiteSparks; i++) { whiteSparkOptions += `<option value="${i}">${i}</option>`; }
    firstSparkRow.querySelector('#min-white').innerHTML = '<option value="0"></option>' + whiteSparkOptions;

    const aptGrades = ['S', 'A', 'B'];
    const aptGradeOptions = aptGrades.map(g => `<option value="${g}">${g !== 'S' ? g + '+' : g}</option>`).join('');
    Object.values(filterElements)
    .filter(el => el.id.startsWith('apt-min-'))
    .forEach(sel => {
        const aptitudeName = sel.id.replace('apt-min-', '');
        const placeholderText = aptitudeName.charAt(0).toUpperCase() + aptitudeName.slice(1);
        const placeholderOption = `<option value="" selected>All ${placeholderText}</option>`;
        sel.innerHTML = placeholderOption + aptGradeOptions;
    });

    filterElements.sortDir.value = 'desc';
}

function debounce(func, delay) {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
}

function setupEventListeners() {
    const debouncedFilterAndRender = debounce(filterAndRender, 250);

    Object.values(filterElements).forEach(el => {
        if (el.type !== 'range') el.addEventListener('change', filterAndRender);
    });

    document.querySelectorAll('.spark-filters select').forEach(el => {
        el.addEventListener('change', filterAndRender);
    });

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
                slider.value = Math.max(slider.min, Math.min(slider.max, value));
                numInput.value = slider.value;
                filterAndRender();
            });
            numInput.value = slider.value;
        }
    });

    filterElements.repOnly.addEventListener('change', () => {
        updateSparkDropdowns(filterElements.repOnly.checked);
        filterAndRender(); 
    });

    tabButtons.forEach(button => button.addEventListener('click', () => handleTabChange(button.dataset.tab)));
    resetFiltersButton.addEventListener('click', resetFilters);
    addSparkFilterButton.addEventListener('click', addSparkFilterRow);

    sparkFiltersContainer.addEventListener('click', (event) => {
        if (event.target.classList.contains('remove-spark-filter-button')) {
            event.target.closest('.spark-filters').remove();
            filterAndRender();
        }
    });
    
    document.addEventListener('click', (e) => {
        document.querySelectorAll('.options-container').forEach(container => {
            if (!container.parentElement.contains(e.target)) {
                container.style.display = 'none';
            }
        });
    });

    [parentSummaryBody, whiteSparksBody].forEach(body => {
        body.addEventListener('dblclick', handleDetailView);
    });
}

function addSparkFilterRow() {
    const firstRow = document.querySelector('#spark-filters-container .spark-filters');
    if (!firstRow) return;
    const newRow = firstRow.cloneNode(true);
    sparkFilterCounter++;
    newRow.querySelectorAll('input[type="text"]').forEach(input => {
        input.value = '';
        input.id += `-${sparkFilterCounter}`;
    });
    newRow.querySelectorAll('select').forEach(select => {
        select.selectedIndex = 0;
        select.id += `-${sparkFilterCounter}`;
    });
    newRow.querySelectorAll('label').forEach(label => {
        if (label.htmlFor) label.htmlFor += `-${sparkFilterCounter}`;
    });
    createSearchableSelect(newRow.querySelector('[id^="filter-blue-spark"]'), blueSparkNames);
    createSearchableSelect(newRow.querySelector('[id^="filter-green-spark"]'), greenSparkNames);
    createSearchableSelect(newRow.querySelector('[id^="filter-pink-spark"]'), pinkSparkNames);
    createSearchableSelect(newRow.querySelector('[id^="filter-white-spark"]'), whiteSparkNames);
    newRow.querySelectorAll('select').forEach(el => el.addEventListener('change', filterAndRender));
    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.className = 'remove-spark-filter-button';
    removeButton.textContent = 'X';
    removeButton.title = 'Remove this filter row';
    newRow.appendChild(removeButton);
    sparkFiltersContainer.appendChild(newRow);
    updateSparkDropdowns(filterElements.repOnly.checked);
}

function handleTabChange(activeTabId) {
    tabButtons.forEach(b => b.classList.toggle('active', b.dataset.tab === activeTabId));
    tabContents.forEach(c => c.classList.toggle('active', c.id === activeTabId));

    const sortOptions = {
        'parent-summary': ['score', 'name', 'speed', 'stamina', 'power', 'guts', 'wit', 'whites (parent)', 'whites (total)'],
        'white-sparks': ['score', 'name', 'whites (parent)', 'whites (gp1)', 'whites (gp2)', 'whites (grandparents)']
    };
    const options = sortOptions[activeTabId] || ['score', 'name'];

    const currentSort = filterElements.sort.value;
    filterElements.sort.innerHTML = options.map(o => `<option value="${o}" ${o === currentSort ? 'selected' : ''}>${o.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>`).join('');
    if (!options.includes(currentSort)) {
         filterElements.sort.value = options[0];
    }

    aptitudeFiltersContainer.style.display = 'flex';
    filterAndRender();
}

// --- MODIFIED: RENDER FUNCTIONS NOW ADD .gp-link CLASS ---

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

        const gp1Exists = !!findRunnerByDetails(r.gp1, r.sparks?.gp1);
        const gp2Exists = !!findRunnerByDetails(r.gp2, r.sparks?.gp2);
        
        const gp1Class = gp1Exists ? 'gp-link' : 'gp-borrowed';
        const gp2Class = gp2Exists ? 'gp-link' : 'gp-borrowed';

        return `
        <tr data-entry-id="${r.entry_id || ''}">
            <td>${r.entry_id || 'N/A'}</td>
            <td class="left-align"><span class="outline-label">${r.name || 'N/A'}</span></td>
            <td>${(r.score || 0).toLocaleString()}</td>
            <td class="stat-cell aptitude-${getStatGrade(r.speed)}">${r.speed || 0}</td>
            <td class="stat-cell aptitude-${getStatGrade(r.stamina)}">${r.stamina || 0}</td>
            <td class="stat-cell aptitude-${getStatGrade(r.power)}">${r.power || 0}</td>
            <td class="stat-cell aptitude-${getStatGrade(r.guts)}">${r.guts || 0}</td>
            <td class="stat-cell aptitude-${getStatGrade(r.wit)}">${r.wit || 0}</td>
            <td class="spark-cell">${formatSparks(r, 'blue', allSparkCriteria, isRepOnly)}</td>
            <td class="spark-cell">${formatSparks(r, 'green', allSparkCriteria, isRepOnly)}</td>
            <td class="spark-cell">${formatSparks(r, 'pink', allSparkCriteria, isRepOnly)}</td>
            <td>${whiteDisplay}</td>
            <td class="${gp1Class}">${cleanName(r.gp1 || 'N/A')}</td>
            <td class="${gp2Class}">${cleanName(r.gp2 || 'N/A')}</td>
        </tr>
    `}).join('');
    parentSummaryBody.innerHTML = html;
    hideEntryIdColumn('parent-summary');
}

function renderWhiteSparksSummary(runners, allSparkCriteria) {
    if (!runners.length) {
       whiteSparksBody.innerHTML = '<tr><td colspan="8">No runners match filters.</td></tr>';
       return;
    }
    const html = runners.map(r => {
        let totalCounts = { parent: 0, gp1: 0, gp2: 0 };
        let individualCounts = { parent: {}, gp1: {}, gp2: {} };

        if (r.sparks){
            ['parent', 'gp1', 'gp2'].forEach(source => {
                if(Array.isArray(r.sparks[source])) {
                   r.sparks[source].forEach(spark => {
                       if (spark?.color === 'white' && spark.spark_name) {
                            // --- CHANGE START ---
                            // Read the count from the spark object, default to 1 if not present
                            const sparkCount = parseInt(spark.count, 10) || 1; 
                            
                            totalCounts[source] += sparkCount; // Add the spark's count to the total
                            const name = spark.spark_name;
                            individualCounts[source][name] = (individualCounts[source][name] || 0) + sparkCount; // Add to the individual spark's total
                            // --- CHANGE END ---
                       }
                   });
                }
            });
        }
        
        // --- START: NEW HIGHLIGHTING LOGIC ---

        const formatWhiteSparkDisplay = (sourceTotal, sourceDetails) => {
            let shouldHighlightTotal = false;
            for (const criteria of allSparkCriteria) {
                if (criteria.minWhite > 0 && sourceTotal >= criteria.minWhite) {
                    shouldHighlightTotal = true;
                    break;
                }
            }

            const totalDisplay = shouldHighlightTotal ? `(<b>${sourceTotal}</b>)` : `(<b>${sourceTotal}</b>)`;

            const detailsStr = Object.entries(sourceDetails)
                .map(([name, value]) => { // 'value' holds the count you just summed
                    let shouldHighlightName = false;
                    for (const criteria of allSparkCriteria) {
                        if (criteria.whiteSpark && name === criteria.whiteSpark) {
                            shouldHighlightName = true;
                            break;
                        }
                    }
                    // --- BUG FIX ---
                    // Changed 'count' to 'value' to correctly display the summed total
                    const formattedText = `${name} ${value}`; 
                    // --- BUG FIX END ---
                    return shouldHighlightName ? `<b>${formattedText}</b>` : formattedText;
                })
                .join(', ');

            return totalDisplay + (detailsStr ? ` ${detailsStr}` : '');
        };

        const parentDisplay = formatWhiteSparkDisplay(totalCounts.parent, individualCounts.parent);
        const gp1Display = formatWhiteSparkDisplay(totalCounts.gp1, individualCounts.gp1);
        const gp2Display = formatWhiteSparkDisplay(totalCounts.gp2, individualCounts.gp2);

        // --- END: NEW HIGHLIGHTING LOGIC ---


        const gp1Exists = !!findRunnerByDetails(r.gp1, r.sparks?.gp1);
        const gp2Exists = !!findRunnerByDetails(r.gp2, r.sparks?.gp2);

        const gp1NameClass = gp1Exists ? 'gp-link' : 'gp-borrowed';
        const gp2NameClass = gp2Exists ? 'gp-link' : 'gp-borrowed';
        const gp1SkillsClass = gp1Exists ? 'gp-skills-link' : 'gp-borrowed';
        const gp2SkillsClass = gp2Exists ? 'gp-skills-link' : 'gp-borrowed';

       return `
       <tr data-entry-id="${r.entry_id || ''}">
           <td>${r.entry_id || 'N/A'}</td>
           <td class="left-align gp-link"><span class="outline-label">${r.name || 'N/A'}</span></td>
           <td class="gp-link">${(r.score || 0).toLocaleString()}</td>
           <td class="left-align spark-cell gp-skills-link">${parentDisplay}</td>
           <td class="${gp1NameClass}">${cleanName(r.gp1 || 'N/A')}</td>
           <td class="left-align spark-cell ${gp1SkillsClass}" data-gp-name="${r.gp1 || ''}">${gp1Display}</td>
           <td class="${gp2NameClass}">${cleanName(r.gp2 || 'N/A')}</td>
           <td class="left-align spark-cell ${gp2SkillsClass}" data-gp-name="${r.gp2 || ''}">${gp2Display}</td>
       </tr>
   `}).join('');
   whiteSparksBody.innerHTML = html;
   hideEntryIdColumn('white-sparks');
}

// --- MODIFIED: `handleDetailView` IS NOW SMARTER ---

function handleDetailView(event) {
    const clickedCell = event.target.closest('td');
    if (!clickedCell) return;

    let runnerNameToFindRaw = null;
    let isClickable = false;

    if (clickedCell.classList.contains('gp-skills-link')) {
        runnerNameToFindRaw = clickedCell.dataset.gpName;
        isClickable = true;
    } else if (clickedCell.classList.contains('gp-link')) {
        runnerNameToFindRaw = clickedCell.textContent.trim();
        isClickable = true;
    }
    else if (clickedCell.classList.contains('gp-borrowed')) {
        showTimedMessage("Borrowed or not in data");
        return;
    }

    if (isClickable && runnerNameToFindRaw && runnerNameToFindRaw !== 'N/A') {
        const tableRow = event.target.closest('tr');
        const mainRunner = allRunners.find(r => String(r.entry_id) === tableRow.dataset.entryId);
        if (!mainRunner) return;

        // Determine if we're looking for gp1 or gp2 based on the cell content
        const sparksToFind = cleanName(mainRunner.gp1) === runnerNameToFindRaw ? mainRunner.sparks?.gp1 : mainRunner.sparks?.gp2;
        
        const targetRunner = findRunnerByDetails(runnerNameToFindRaw, sparksToFind);
        
        if (targetRunner) {
            showDetailModal(targetRunner);
        } else {
            console.warn(`Runner named "${runnerNameToFindRaw}" not found despite being marked as a link.`);
            showTimedMessage("Could not find entry");
        }
        return;
    }

    const tableRow = event.target.closest('tr');
    if (tableRow && tableRow.dataset.entryId && !clickedCell.dataset.gpName && !clickedCell.classList.contains('gp-link') && !clickedCell.classList.contains('gp-borrowed')) {
        const entryId = tableRow.dataset.entryId;
        const runner = allRunners.find(r => String(r.entry_id) === String(entryId));
        if (runner) {
            showDetailModal(runner);
        } else {
            console.warn(`Runner with entry ID "${entryId}" not found.`);
        }
    }
}


// --- All other functions from here on are unchanged ---
// (filterAndRender, sortData, modal logic, etc., omitted for brevity)
function filterAndRender() {
    const baseFilters = {};
    for (const key in filterElements) {
        const el = filterElements[key];
        baseFilters[key] = el.type === 'checkbox' ? el.checked : el.value;
    }

    let filteredData = [...allRunners];

    if (baseFilters.runner) filteredData = filteredData.filter(r => r.name === baseFilters.runner);

    filteredData = filteredData.filter(r =>
        (parseInt(r.speed || 0)) >= parseInt(baseFilters.speed) &&
        (parseInt(r.stamina || 0)) >= parseInt(baseFilters.stamina) &&
        (parseInt(r.power || 0)) >= parseInt(baseFilters.power) &&
        (parseInt(r.guts || 0)) >= parseInt(baseFilters.guts) &&
        (parseInt(r.wit || 0)) >= parseInt(baseFilters.wit)
    );

    const sparkFilterRows = document.querySelectorAll('#spark-filters-container .spark-filters');
    const isRepOnly = baseFilters.repOnly;

    sparkFilterRows.forEach(row => {
        const rowCriteria = {
            blue: { name: row.querySelector('[id^="filter-blue-spark"]').value, min: Number(row.querySelector('[id^="min-blue"]').value) },
            green: { name: row.querySelector('[id^="filter-green-spark"]').value, min: Number(row.querySelector('[id^="min-green"]').value) },
            pink: { name: row.querySelector('[id^="filter-pink-spark"]').value, min: Number(row.querySelector('[id^="min-pink"]').value) },
            white: { name: row.querySelector('[id^="filter-white-spark"]').value, min: Number(row.querySelector('[id^="min-white"]').value) }
        };

        if (rowCriteria.blue.name || rowCriteria.blue.min > 0) filteredData = filteredData.filter(r => checkSpark(r, 'blue', rowCriteria.blue.name, rowCriteria.blue.min, isRepOnly));
        if (rowCriteria.green.name || rowCriteria.green.min > 0) filteredData = filteredData.filter(r => checkSpark(r, 'green', rowCriteria.green.name, rowCriteria.green.min, isRepOnly));
        if (rowCriteria.pink.name || rowCriteria.pink.min > 0) filteredData = filteredData.filter(r => checkSpark(r, 'pink', rowCriteria.pink.name, rowCriteria.pink.min, isRepOnly));
        if (rowCriteria.white.name || rowCriteria.white.min > 0) filteredData = filteredData.filter(r => checkWhiteSpark(r, rowCriteria.white.name, rowCriteria.white.min, isRepOnly));
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
            const minRankValue = APTITUDE_RANK_MAP[minGrade];
            filteredData = filteredData.filter(r => (APTITUDE_RANK_MAP[r[dataKey]?.toUpperCase() || ''] || -100) >= minRankValue);
        }
    }

    sortData(filteredData, baseFilters.sort, baseFilters.sortDir);

    const activeTabId = document.querySelector('.tab-content.active')?.id;
    parentSummaryBody.innerHTML = '';
    whiteSparksBody.innerHTML = '';
    
    const allSparkCriteria = getAllSparkFilterCriteria();

    // CORRECTED FUNCTION CALLS
    if (activeTabId === 'parent-summary') {
        renderParentSummary(filteredData, allSparkCriteria, isRepOnly);
    } 
    else if (activeTabId === 'white-sparks') {
        renderWhiteSparksSummary(filteredData, allSparkCriteria);
    }
}

function getAllSparkFilterCriteria() {
    const criteria = [];
    document.querySelectorAll('#spark-filters-container .spark-filters').forEach(row => {
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
        if (Object.values(rowCriteria).some(val => val)) {
            criteria.push(rowCriteria);
        }
    });
    return criteria;
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
            'whites (gp1)': ['gp1'],
            'whites (gp2)': ['gp2'],
            'whites (grandparents)': ['gp1', 'gp2'],
            'whites (total)': ['parent', 'gp1', 'gp2']
        };
        if (whiteSortKeys[sortBy]) {
            valA = getWhiteCount(a, whiteSortKeys[sortBy]);
            valB = getWhiteCount(b, whiteSortKeys[sortBy]);
        } else if (['turf', 'dirt', 'sprint', 'mile', 'medium', 'long', 'front', 'pace', 'late', 'end'].includes(sortBy)) {
            valA = APTITUDE_RANK_MAP[a[sortBy]?.toUpperCase() || ''] ?? -100;
            valB = APTITUDE_RANK_MAP[b[sortBy]?.toUpperCase() || ''] ?? -100;
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

function formatSparks(runner, color, allSparkCriteria, repOnly) {
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
        .map(([name, grandparentsCount]) => {
            const parentCount = parentSparks[name] || 0;
            let displayPart = `${name} ${grandparentsCount}`;
            if (parentCount > 0) displayPart += `(${parentCount})`;

            let shouldHighlight = false;
            const countToCheck = repOnly ? parentCount : grandparentsCount;

            // This loop requires allSparkCriteria to be a valid array
            for (const criteria of allSparkCriteria) {
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
        dropdown.value = Math.min(currentValue, maxStars);
    });
}
function resetFilters() {
    // --- Step 1: Reset all the main filters (this part is correct) ---
    for (const key in filterElements) {
        const el = filterElements[key];
        if (el.type === 'checkbox') {
            el.checked = false;
        } else if (el.type === 'range') {
            el.value = 0;
            const display = document.getElementById(`val-${key}`);
            if (display) display.value = '0';
        } else if (el.tagName === 'SELECT') {
            el.selectedIndex = 0;
        } else {
            el.value = '';
        }
    }

    // --- Step 2: Clear all spark filter rows without deleting them ---
    // MODIFIED SECTION
    const allSparkRows = sparkFiltersContainer.querySelectorAll('.spark-filters');
    allSparkRows.forEach((row, index) => {
        // For every row AFTER the first one, remove it.
        if (index > 0) {
            row.remove();
        } 
        // For the very first row, just clear its values.
        else {
            row.querySelectorAll('input[type="text"]').forEach(input => input.value = '');
            row.querySelectorAll('select').forEach(select => select.selectedIndex = 0);
        }
    });
    // END MODIFIED SECTION

    // --- Step 3: Finalize the reset (this part is also correct) ---
    updateSparkDropdowns(false); // Reset star dropdowns to max 9
    filterElements.sortDir.value = 'desc'; // Set sort direction to default
    filterAndRender(); // Re-render the table with cleared filters
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
function hideEntryIdColumn(tabId) {
    const table = document.querySelector(`#${tabId} table`);
    if (!table) return;
    const headerCell = table.querySelector('thead th:first-child');
    const bodyCells = table.querySelectorAll('tbody td:first-child');
    if (headerCell) headerCell.style.display = 'none';
    bodyCells.forEach(cell => cell.style.display = 'none');
} 
/**
 * A cached function to find a runner by name AND matching sparks.
 * This is the new, more accurate way to check if a grandparent exists as an entry.
 */
/**
 * A cached function to find a runner by name AND matching sparks, ignoring spark order.
 */
function findRunnerByDetails(name, gpSparksArray) {
    if (!name || !gpSparksArray || gpSparksArray.length === 0) {
        return null;
    }

    const cleanedName = cleanName(name);
    // Use a composite key for the cache to handle multiple versions of the same character
    const cacheKey = `${cleanedName}-${JSON.stringify(gpSparksArray)}`;
    if (gpExistenceCache.has(cacheKey)) {
        return gpExistenceCache.get(cacheKey);
    }

    // Helper to create a sorted, comparable string from a sparks array
    const createComparableString = (arr) => {
        if (!arr) return null;
        // Create a copy to avoid modifying original data
        const sortedArr = [...arr].sort((a, b) => {
            // Sort primarily by spark_name, then by count as a tie-breaker
            if (a.spark_name < b.spark_name) return -1;
            if (a.spark_name > b.spark_name) return 1;
            return (a.count || 0) - (b.count || 0);
        });
        return JSON.stringify(sortedArr);
    };

    const gpSparksString = createComparableString(gpSparksArray);
    if (!gpSparksString) {
        gpExistenceCache.set(cacheKey, null);
        return null;
    }

    const foundRunner = allRunners.find(runner => {
        if (cleanName(runner.name) !== cleanedName) return false;
        if (!runner.sparks?.parent) return false;

        const parentSparksString = createComparableString(runner.sparks.parent);
        return parentSparksString === gpSparksString;
    });

    const result = foundRunner || null;
    gpExistenceCache.set(cacheKey, result);
    return result;
}

function showTimedMessage(message) {
    // Remove any existing message first
    const existingPopup = document.getElementById('timed-message-popup');
    if (existingPopup) {
        existingPopup.remove();
    }

    // Create the new popup element
    const popup = document.createElement('div');
    popup.id = 'timed-message-popup';
    popup.textContent = message;

    document.body.appendChild(popup);

    // Set a timer to fade out and remove the popup
    setTimeout(() => {
        popup.style.opacity = '0';
        setTimeout(() => {
            popup.remove();
        }, 500); // Wait for fade-out transition to finish
    }, 2000); // Message stays visible for 2 seconds
}