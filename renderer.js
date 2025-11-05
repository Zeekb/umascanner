// --- Global Variables ---
let allRunners = [];
let blueSparkNames = [];
let greenSparkNames = [];
let pinkSparkNames = [];
let whiteSparkNames = [];
let skillData = {};
let orderedSkills = [];
let runnerUniqueSkills = {};
let orderedSparks = {};
let allRunnerNamesSet = new Set();
let sparkFilterCounter = 1;
let skillFilterCounter = 1;
const gpExistenceCache = new Map();
let maxTotalWhiteSparks = 0;
let maxParentWhiteSparks = 0;
const cleanName = (name) => name ? name.replace(/ c$/, '').trim() : '';

// --- Element References ---
let filterElements = {};
let tabButtons, tabContents, parentSummaryBody, whiteSparksBody, skillsSummaryBody;
let aptitudeFiltersContainer, resetFiltersButton, addSparkFilterButton, sparkFiltersContainer;
let skillFiltersContainer, addSkillFilterButton;
let uploaderContainer, fileInput, loadDataButton, loadingMessage, errorMessage, appWrapper;
let loadNewFileButton;
let saveDataButton;
let legaciesPlannerBody, grandparentAnalysisBody, inheritanceLogBody;

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

// --- App Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    uploaderContainer = document.getElementById('uploader-container');
    fileInput = document.getElementById('file-input');
    loadDataButton = document.getElementById('load-data-button');
    const loadTestDataButton = document.getElementById('load-test-data-button');
    loadingMessage = document.getElementById('loading-message');
    errorMessage = document.getElementById('error-message');
    appWrapper = document.getElementById('app-wrapper');

    setupDarkMode(); 

    loadDataButton.addEventListener('click', handleFileLoad);
    loadTestDataButton.addEventListener('click', handleTestFileLoad);

    const savedData = localStorage.getItem('savedRunnerData');
    if (savedData) {
        console.log("Found saved data, attempting to load...");
        setTimeout(() => {
            loadFromSavedData(savedData);
        }, 100);
    } 
});

async function handleFileLoad() {
    const file = fileInput.files[0];

    loadingMessage.style.display = 'block';
    errorMessage.style.display = 'none';

    if (!file) {
        showError('Please select a file first.');
        return;
    }

    let fileContent;
    let allRunnersData;

    try {
        fileContent = await file.text();
        allRunnersData = JSON.parse(fileContent);
    } catch (err) {
        showError(`Error reading file: ${err.message}`);
        return;
    }

    if (!Array.isArray(allRunnersData)) {
        showError('Invalid file format. The JSON file must contain an array of runners.');
        return;
    }
    
    try {
        localStorage.setItem('savedRunnerData', fileContent);
    } catch (e) {
        console.error("Could not save to localStorage:", e);
    }

    allRunners = allRunnersData;

    try {
        const [loadedSkillData, uniqueSkillsData, loadedOrderedSparks] = await Promise.all([
            fetch('./data/skills.json').then(res => res.json()),
            fetch('./data/runner_skills.json').then(res => res.json()),
            fetch('./data/sparks.json').then(res => res.json()),
        ]);

        skillData = loadedSkillData || {};
        runnerUniqueSkills = uniqueSkillsData || {};
        orderedSparks = loadedOrderedSparks || {};
        orderedSkills = Object.keys(skillData);

    } catch (err) {
        showError(`Failed to load game data (skills.json, etc.): ${err.message}`);
        return;
    }

    try {
        initializeApp();
    } catch (err) {
         showError(`Error initializing app: ${err.message}`);
         console.error("Initialization failed:", err);
    }
}

async function handleTestFileLoad() {
    loadingMessage.style.display = 'block';
    errorMessage.style.display = 'none';

    let fileContent;
    let allRunnersData;

    try {
        const response = await fetch('./assets/all_runners_Zeek.json');
        if (!response.ok) {
            throw new Error(`Could not find file: ${response.statusText}`);
        }
        fileContent = await response.text();
        allRunnersData = JSON.parse(fileContent);

    } catch (err) {
        showError(`Error loading test file (all_runners_Zeek.json): ${err.message}. <br>Make sure the file is in the 'assets' folder.`);
        return;
    }

    if (!Array.isArray(allRunnersData)) {
        showError('Invalid test file format. The JSON file must contain an array of runners.');
        return;
    }
    
    try {
        localStorage.setItem('savedRunnerData', fileContent);
    } catch (e) {
        console.error("Could not save to localStorage:", e);
    }

    allRunners = allRunnersData;

    try {
        const [loadedSkillData, uniqueSkillsData, loadedOrderedSparks] = await Promise.all([
            fetch('./data/skills.json').then(res => res.json()),
            fetch('./data/runner_skills.json').then(res => res.json()),
            fetch('./data/sparks.json').then(res => res.json()),
        ]);

        skillData = loadedSkillData || {};
        runnerUniqueSkills = uniqueSkillsData || {};
        orderedSparks = loadedOrderedSparks || {};
        orderedSkills = Object.keys(skillData);

    } catch (err) {
        showError(`Failed to load game data (skills.json, etc.): ${err.message}`);
        return;
    }

    try {
        initializeApp();
    } catch (err) {
         showError(`Error initializing app: ${err.message}`);
         console.error("Initialization failed:", err);
    }
}

async function loadFromSavedData(jsonData) {
    loadingMessage.style.display = 'block';
    errorMessage.style.display = 'none';
    
    try {
        allRunners = JSON.parse(jsonData);
    } catch (e) {
        showError('Error parsing saved data. Please load a file again.');
        localStorage.removeItem('savedRunnerData');
        loadDataButton.addEventListener('click', handleFileLoad);
        return;
    }

    try {
        const [loadedSkillData, uniqueSkillsData, loadedOrderedSparks] = await Promise.all([
            fetch('./data/skills.json').then(res => res.json()),
            fetch('./data/runner_skills.json').then(res => res.json()),
            fetch('./data/sparks.json').then(res => res.json()),
        ]);

        skillData = loadedSkillData || {};
        runnerUniqueSkills = uniqueSkillsData || {};
        orderedSparks = loadedOrderedSparks || {};
        orderedSkills = Object.keys(skillData);

        initializeApp();
    } catch (err) {
        showError(`Failed to load game data (skills.json, etc.): ${err.message}`);
    }
}

function showError(message) {
    loadingMessage.style.display = 'none';
    errorMessage.innerHTML = message;
    errorMessage.style.display = 'block';
}

function preloadRunnerImages() {
    const preloadedImages = new Set();
    
    allRunners.forEach(runner => {
        const hasGreenParentSpark = runner.sparks?.parent?.some(s => s.color === 'green');
        let nameForImage = hasGreenParentSpark ? runner.name : `${runner.name} c`;
        nameForImage = (nameForImage || 'N/A').trim().replace(/ /g, '_');
        const imagePath = `./assets/profile_images/${nameForImage}.png`;

        if (!preloadedImages.has(imagePath)) {
            const img = new Image();
            img.src = imagePath;
            preloadedImages.add(imagePath);
        }
    });
    console.log(`Preloading ${preloadedImages.size} unique runner images...`);
}

function returnToFileUploader() {
    const userConfirmed = window.confirm(
        "Are you sure you want to load a new file?\n\nThis will clear the current data."
    );

    if (!userConfirmed) {
        return; 
    }

    localStorage.removeItem('savedRunnerData');

    allRunners = [];
    blueSparkNames = [];
    greenSparkNames = [];
    pinkSparkNames = [];
    whiteSparkNames = [];
    skillData = {};
    orderedSkills = [];
    allRunnerNamesSet.clear();
    gpExistenceCache.clear();

    appWrapper.style.display = 'none';
    uploaderContainer.style.display = 'flex';
    fileInput.value = '';

    errorMessage.style.display = 'none';
    loadingMessage.style.display = 'none';
    if (entriesCountDisplay) entriesCountDisplay.textContent = '';
}

function initializeApp() {
    filterElements = {
        runner: document.getElementById('filter-runner'),
        sort: document.getElementById('filter-sort'),
        sortDir: document.getElementById('filter-sort-direction'),
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

    tabButtons = document.querySelectorAll('.tab-button');
    tabContents = document.querySelectorAll('.tab-content');
    parentSummaryBody = document.getElementById('parent-summary-body');
    whiteSparksBody = document.getElementById('white-sparks-body');
    skillsSummaryBody = document.getElementById('skills-summary-body');
    legaciesPlannerBody = document.getElementById('legacies-planner-content');
    grandparentAnalysisBody = document.getElementById('grandparent-summary-body');
    inheritanceLogBody = document.getElementById('inheritance-log-content');
    aptitudeFiltersContainer = document.getElementById('aptitude-filters');
    resetFiltersButton = document.getElementById('reset-filters-button');
    addSparkFilterButton = document.getElementById('add-spark-filter-button');
    sparkFiltersContainer = document.getElementById('spark-filters-container');
    skillFiltersContainer = document.getElementById('skill-filters-container');
    addSkillFilterButton = document.getElementById('add-skill-filter-button');
    loadNewFileButton = document.getElementById('load-new-file-button');
    saveDataButton = document.getElementById('save-data-button');
    entriesCountDisplay = document.getElementById('entries-count-display');

    if (!allRunners || allRunners.length === 0) {
        console.warn("No runner data loaded.");
        const noDataMsg = '<tr><td colspan="18">No runner data found.</td></tr>';
        [parentSummaryBody, whiteSparksBody, skillsSummaryBody].forEach(body => body.innerHTML = noDataMsg);
        return;
    }
    
    if (!orderedSparks) {
        console.warn("ordered sparks data (sparks.json) not found. Falling back to alphabetical order.");
        orderedSparks = {};
    }

    allRunners.forEach(runner => {
        if (runner.name) allRunnerNamesSet.add(runner.name);
        runner.sparks = (typeof runner.sparks === 'string') ? JSON.parse(runner.sparks) : runner.sparks || {};
        runner.skills = (typeof runner.skills === 'string') ? runner.skills.split('|').map(s => s.trim()).filter(s => s) : runner.skills || [];
    });

    allRunners.forEach(runner => {
        let totalCount = 0;
        let parentCount = 0;
        if (runner.sparks && typeof runner.sparks === 'object') {
            if (Array.isArray(runner.sparks.parent)) {
                parentCount = runner.sparks.parent.filter(s => s?.color === 'white').length;
            }
            ['parent', 'gp1', 'gp2'].forEach(source => {
                if (Array.isArray(runner.sparks[source])) {
                    totalCount += runner.sparks[source].filter(s => s?.color === 'white').length;
                }
            });
        }
        if (parentCount > maxParentWhiteSparks) {
            maxParentWhiteSparks = parentCount;
        }
        if (totalCount > maxTotalWhiteSparks) {
            maxTotalWhiteSparks = totalCount;
        }
    });

    extractSparkNames();
    populateFilters();
    
    const firstSkillRow = document.querySelector('.skill-filters');
    if (firstSkillRow) {
        createSearchableSelect(firstSkillRow.querySelector('.skill-name-input'), orderedSkills);
    }
    setupEventListeners();
    handleTabChange('parent-summary');

    uploaderContainer.style.display = 'none';
    appWrapper.style.display = 'flex';

    loadNewFileButton.addEventListener('click', returnToFileUploader);

    updateEntriesCount();
    preloadRunnerImages(); 
}

function isDarkModeActive() {
    return document.body.classList.contains('dark-mode');
}

function setupDarkMode() {
    const isDarkMode = localStorage.getItem('darkMode') === 'true';
    const body = document.body;
    const toggleButton = document.getElementById('dark-mode-toggle');
    const iconSpan = document.getElementById('dark-mode-icon');
    
    if (isDarkMode) {
        body.classList.add('dark-mode');
        if (iconSpan) iconSpan.textContent = '🌙';
        if (toggleButton) toggleButton.title = 'Toggle Light Mode';
    } else {
        body.classList.remove('dark-mode');
        if (iconSpan) iconSpan.textContent = '☀️';
        if (toggleButton) toggleButton.title = 'Toggle Dark Mode';
    }

    if (toggleButton) {
        toggleButton.addEventListener('click', () => {
            const currentlyDark = body.classList.toggle('dark-mode');
            localStorage.setItem('darkMode', currentlyDark);
            
            if (currentlyDark) {
                if (iconSpan) iconSpan.textContent = '🌙';
                if (toggleButton) toggleButton.title = 'Toggle Light Mode';
            } else {
                if (iconSpan) iconSpan.textContent = '☀️';
                if (toggleButton) toggleButton.title = 'Toggle Dark Mode';
            }
            if (allRunners.length > 0) {
                 filterAndRender();
            }
        });
    }
}

function createSearchableSelect(inputElement, optionsArray) {
    const container = inputElement.closest('.searchable-select-container');
    if (!container) {
        console.error("Could not find a '.searchable-select-container' for input:", inputElement);
        return;
    }

    const optionsContainer = container.querySelector('.options-container');
    if (!optionsContainer) {
        console.error("Could not find an '.options-container' within:", container);
        return;
    }

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
    if (orderedSparks?.green && Array.isArray(orderedSparks.green)) {
        greenSparkNames = orderedSparks.green.filter(name => extracted.green.has(name));
    } else {
        greenSparkNames = [...extracted.green].sort();
    }
    if (orderedSparks?.white && Array.isArray(orderedSparks.white.race) && Array.isArray(orderedSparks.white.skill)) {
        const orderedWhiteSparks = [...orderedSparks.white.race, ...orderedSparks.white.skill];
        whiteSparkNames = orderedWhiteSparks.filter(name => extracted.white.has(name));
    } else {
        whiteSparkNames = [...extracted.white].sort();
    }
}

function populateFilters() {
    const runnerNames = [...allRunnerNamesSet].sort();
    filterElements.runner.innerHTML = '<option value="">All Runners</option>' + runnerNames.map(n => `<option value="${n}">${n}</option>`).join('');

    const currentSort = filterElements.sort.value || 'score';
    const allSortOptions = [
        'score', 'name', 'speed', 'stamina', 'power', 'guts', 'wit', 
        'whites (total)', 'whites (parent)', 'whites (gp1)', 'whites (gp2)'
    ];

    filterElements.sort.innerHTML = allSortOptions.map(o => {
        const label = o.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        return `<option value="${o}">${label}</option>`;
    }).join('');
    
    filterElements.sort.value = allSortOptions.includes(currentSort) ? currentSort : 'score';

    const firstSparkRow = document.querySelector('.spark-filters');
    createSearchableSelect(firstSparkRow.querySelector('#filter-blue-spark'), blueSparkNames);
    createSearchableSelect(firstSparkRow.querySelector('#filter-green-spark'), greenSparkNames);
    createSearchableSelect(firstSparkRow.querySelector('#filter-pink-spark'), pinkSparkNames);
    createSearchableSelect(firstSparkRow.querySelector('#filter-white-spark'), whiteSparkNames);

    updateSparkCountDropdown(firstSparkRow.querySelector('#min-blue'), 9);
    updateSparkCountDropdown(firstSparkRow.querySelector('#min-green'), 3);
    updateSparkCountDropdown(firstSparkRow.querySelector('#min-pink'), 9);
    updateSparkCountDropdown(firstSparkRow.querySelector('#min-white'), 9);
    updateTotalWhiteDropdown(firstSparkRow, false);
    
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

    let totalWhiteSparkOptions = '';
    for (let i = 1; i <= maxWhiteSparks; i++) { totalWhiteSparkOptions += `<option value="${i}">${i}</option>`; }
    firstSparkRow.querySelector('#min-total-white').innerHTML = '<option value="0"></option>' + totalWhiteSparkOptions;

    if (firstSparkRow) {
        if (!firstSparkRow.querySelector('.disable-spark-filter-button')) {
            const disableButton = document.createElement('button');
            disableButton.type = 'button';
            disableButton.className = 'disable-spark-filter-button';
            disableButton.textContent = '✓'; 
            disableButton.title = 'Disable this filter row';
            firstSparkRow.appendChild(disableButton);
        }
        if (!firstSparkRow.querySelector('.remove-spark-filter-button')) {
            const removeButton = document.createElement('button');
            removeButton.type = 'button';
            removeButton.className = 'remove-spark-filter-button';
            removeButton.textContent = 'X';
            removeButton.title = 'Remove this filter row';
            firstSparkRow.appendChild(removeButton);
        }
    }

    const aptGrades = ['S', 'A', 'B', 'C', 'D'];
    const aptGradeOptions = aptGrades.map(g => `<option value="${g}">${g !== 'S' ? g + '+' : g}</option>`).join('');
    
    Object.values(filterElements)
    .filter(el => el.id.startsWith('apt-min-'))
    .forEach(sel => {
        sel.innerHTML += aptGradeOptions;
    });

    document.querySelectorAll('.aptitude-select').forEach(updateSelectPlaceholder);

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

    document.querySelectorAll('.aptitude-select').forEach(sel => {
        sel.addEventListener('change', () => updateSelectPlaceholder(sel));
    });

    skillFiltersContainer.addEventListener('input', (event) => {
        if (event.target.classList.contains('skill-name-input')) {
            debouncedFilterAndRender();
        }
    });
    
    sparkFiltersContainer.addEventListener('input', (event) => {
        if (event.target.classList.contains('spark-search-input')) {
            debouncedFilterAndRender();
        }
    });

    sparkFiltersContainer.addEventListener('change', (event) => {
        if (event.target.classList.contains('rep-only-checkbox')) {
            const row = event.target.closest('.spark-filters');
            if (row) {
                const isParentOnly = event.target.checked;
                const maxStars = isParentOnly ? 3 : 9;

                updateSparkCountDropdown(row.querySelector('[id^="min-blue"]'), maxStars);
                updateSparkCountDropdown(row.querySelector('[id^="min-green"]'), maxStars);
                updateSparkCountDropdown(row.querySelector('[id^="min-pink"]'), maxStars);
                updateSparkCountDropdown(row.querySelector('[id^="min-white"]'), maxStars);
                updateTotalWhiteDropdown(row, isParentOnly);
            }
        }
        filterAndRender();
    });

    skillFiltersContainer.addEventListener('click', (event) => {
        if (event.target.classList.contains('remove-skill-filter-button')) {
            event.target.closest('.skill-filters').remove();
            updateRemoveSkillButtonVisibility();
            filterAndRender();
        }
    });

    ['speed', 'stamina', 'power', 'guts', 'wit'].forEach(stat => {
        const slider = filterElements[stat];
        const numInput = document.getElementById(`val-${stat}`);
        if (slider && numInput) {
            slider.addEventListener('input', () => {
                numInput.value = slider.value;
                updateStatInputPlaceholder(numInput);
                debouncedFilterAndRender();
            });
            numInput.addEventListener('change', () => {
                let value = parseInt(numInput.value, 10) || 0;
                slider.value = Math.max(slider.min, Math.min(slider.max, value));
                numInput.value = slider.value;
                updateStatInputPlaceholder(numInput);
                filterAndRender();
            });
            numInput.value = slider.value;
            updateStatInputPlaceholder(numInput); 
        }
    });

    tabButtons.forEach(button => button.addEventListener('click', () => handleTabChange(button.dataset.tab)));
    resetFiltersButton.addEventListener('click', resetFilters);
    const toggleFilterButton = document.getElementById('toggle-filter-panel');
    const filterPanel = document.querySelector('.filter-panel');

    if (toggleFilterButton && filterPanel) {
        toggleFilterButton.addEventListener('click', () => {
            const isCollapsed = filterPanel.classList.toggle('collapsed');
            
            if (isCollapsed) {
                toggleFilterButton.textContent = '+';
                toggleFilterButton.title = 'Show Filters';
            } else {
                toggleFilterButton.textContent = '−';
                toggleFilterButton.title = 'Collapse Filters';
            }
        });
    }
    addSparkFilterButton.addEventListener('click', addSparkFilterRow);
    addSkillFilterButton.addEventListener('click', addSkillFilterRow);

    sparkFiltersContainer.addEventListener('click', (event) => {
        const target = event.target;
        const row = target.closest('.spark-filters');
        if (!row) return;

        if (target.classList.contains('remove-spark-filter-button')) {
            row.remove();
            updateRemoveButtonVisibility();
            filterAndRender();
        } else if (target.classList.contains('disable-spark-filter-button')) {
            const isDisabled = row.classList.toggle('disabled');
            target.textContent = isDisabled ? '-' : '✓';
            target.title = isDisabled ? 'Enable this filter row' : 'Disable this filter row';
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

    parentSummaryBody.addEventListener('click', handleDeleteRunner);

    [parentSummaryBody, whiteSparksBody, skillsSummaryBody].forEach(body => {
        body.addEventListener('dblclick', handleDetailView);
    });

    saveDataButton.addEventListener('click', saveDataToFile); 

    // Event listeners for new tabs
    const grandparentContent = document.getElementById('grandparent-analysis-content');
    if (grandparentContent) {
        grandparentContent.addEventListener('click', handleGrandparentClick);
    }

    const inheritanceContent = document.getElementById('inheritance-log-content');
    if (inheritanceContent) {
        inheritanceContent.addEventListener('click', handleInheritanceNodeClick);
    }
    
    updateRemoveButtonVisibility();
    updateRemoveSkillButtonVisibility();
}

function addSparkFilterRow() {
    const firstRow = document.querySelector('#spark-filters-container .spark-filters');
    if (!firstRow) return;
    const newRow = firstRow.cloneNode(true);
    sparkFilterCounter++;

    newRow.classList.remove('disabled');
    const disableBtn = newRow.querySelector('.disable-spark-filter-button');
    if (disableBtn) {
        disableBtn.textContent = '✓';
        disableBtn.title = 'Disable this filter row';
    }

    newRow.querySelectorAll('input[type="text"]').forEach(input => {
        input.value = '';
        input.id += `-${sparkFilterCounter}`;
    });
    newRow.querySelectorAll('select').forEach(select => {
        select.selectedIndex = 0;
        select.id += `-${sparkFilterCounter}`;
    });
    newRow.querySelector('.rep-only-checkbox').checked = false;
    newRow.querySelectorAll('label').forEach(label => {
        if (label.htmlFor) label.htmlFor += `-${sparkFilterCounter}`;
    });
    createSearchableSelect(newRow.querySelector('[id^="filter-blue-spark"]'), blueSparkNames);
    createSearchableSelect(newRow.querySelector('[id^="filter-green-spark"]'), greenSparkNames);
    createSearchableSelect(newRow.querySelector('[id^="filter-pink-spark"]'), pinkSparkNames);
    createSearchableSelect(newRow.querySelector('[id^="filter-white-spark"]'), whiteSparkNames);

    newRow.querySelectorAll('select').forEach(el => el.addEventListener('change', filterAndRender));

    updateSparkCountDropdown(newRow.querySelector('[id^="min-blue"]'), 9);
    updateSparkCountDropdown(newRow.querySelector('[id^="min-green"]'), 3);
    updateSparkCountDropdown(newRow.querySelector('[id^="min-pink"]'), 9);
    updateSparkCountDropdown(newRow.querySelector('[id^="min-white"]'), 9);
    updateTotalWhiteDropdown(newRow, false);

    sparkFiltersContainer.appendChild(newRow);
    updateRemoveButtonVisibility(); 
}

function addSkillFilterRow() {
    const firstRow = document.querySelector('#skill-filters-container .skill-filters');
    if (!firstRow) return;

    skillFilterCounter++;
    const newRow = firstRow.cloneNode(true);
    
    const input = newRow.querySelector('.skill-name-input');
    const label = newRow.querySelector('label');

    const newId = `filter-skill-name-${skillFilterCounter}`;
    input.id = newId;
    input.value = '';
    if (label) {
        label.htmlFor = newId;
    }
    
    createSearchableSelect(input, orderedSkills);
    
    const addButton = document.getElementById('add-skill-filter-button');
    skillFiltersContainer.insertBefore(newRow, addButton);

    updateRemoveSkillButtonVisibility();
}

function updateRemoveSkillButtonVisibility() {
    const allSkillRows = skillFiltersContainer.querySelectorAll('.skill-filters');
    const shouldShowRemove = allSkillRows.length > 1;
    allSkillRows.forEach(row => {
        const removeBtn = row.querySelector('.remove-skill-filter-button');
        if (removeBtn) {
            removeBtn.style.display = shouldShowRemove ? 'inline-block' : 'none';
        }
    });
}

function handleTabChange(activeTabId) {
    tabButtons.forEach(b => b.classList.toggle('active', b.dataset.tab === activeTabId));
    tabContents.forEach(c => c.classList.toggle('active', c.id === activeTabId));

    if (allRunners.length > 0) {
        filterAndRender();
    }
}

function renderSkillsSummary(runners) {
    if (!runners.length) {
        skillsSummaryBody.innerHTML = '<tr><td colspan="8">No runners match filters.</td></tr>';
        return;
    }
    const formatSkillCell = (skillsArray, category) => {
        if (!skillsArray || skillsArray.length === 0) {
            return '';
        }
        skillsArray.sort((a, b) => {
            const getPriority = (skillName) => {
                const type = skillData[skillName] || '';
                if (type.endsWith('_gold')) return 0;
                if (type.startsWith('unique_')) return 1;
                return 2;
            };
            const priorityA = getPriority(a);
            const priorityB = getPriority(b);
            if (priorityA !== priorityB) {
                return priorityA - priorityB;
            }
            return a.localeCompare(b);
        });

        return skillsArray.map(skillName => {
            const skillType = skillData[skillName] || '';
            let content = formatSkillName(skillName);
            const baseClassName = `skill-${category}`;
            let tierClassName = '';

            if (skillType.endsWith('_gold')) {
                tierClassName = 'skill-gold';
                content = `<b>${content}</b>`; 
            } else if (skillType.startsWith('unique_')) {
                tierClassName = 'skill-unique';
                content = `<b>${content}</b>`;
            }
            
            const combinedClassName = tierClassName ? `${baseClassName} ${tierClassName}` : baseClassName;
            return `<span class="${combinedClassName}">${content}</span>`;
        }).join(', ');
    };

    const html = runners.map(r => {
        const categorizedSkills = {
            recovery: [],
            passive: [],
            speed: [],
            debuff: [],
            detrimental: []
        };
        const speedCats = ['speed', 'acceleration', 'observation', 'startingGate', 'laneChange', 'unique', 'allRounder'];

        if (r.skills) {
            r.skills.forEach(skillName => {
                const skillType = skillData[skillName];
                if (!skillType) return;
                const parts = skillType.split('_');
                const category = parts[0];
                const type = parts.length > 1 ? parts[1] : '';

                if (skillType.includes('detrimental')) {
                    categorizedSkills.detrimental.push(skillName);
                } else if (skillType.includes('debuff')) {
                    categorizedSkills.debuff.push(skillName);
                } else if (category === 'recovery' || skillType.startsWith('unique_recovery')) {
                    categorizedSkills.recovery.push(skillName);
                } else if (type === 'passive') {
                    categorizedSkills.passive.push(skillName);
                } else if (speedCats.includes(category)) {
                    categorizedSkills.speed.push(skillName);
                }
            });
        }

        const recoveryCell = categorizedSkills.recovery.length > 0 ? `(<b>${categorizedSkills.recovery.length}</b>) ${formatSkillCell(categorizedSkills.recovery, 'recovery')}` : '';
        const passiveCell = categorizedSkills.passive.length > 0 ? `(<b>${categorizedSkills.passive.length}</b>) ${formatSkillCell(categorizedSkills.passive, 'passive')}` : '';
        const speedCell = categorizedSkills.speed.length > 0 ? `(<b>${categorizedSkills.speed.length}</b>) ${formatSkillCell(categorizedSkills.speed, 'speed')}` : '';
        const debuffCell = categorizedSkills.debuff.length > 0 ? `(<b>${categorizedSkills.debuff.length}</b>) ${formatSkillCell(categorizedSkills.debuff, 'debuff')}` : '';
        const detrimentalCell = categorizedSkills.detrimental.length > 0 ? `(<b>${categorizedSkills.detrimental.length}</b>) ${formatSkillCell(categorizedSkills.detrimental, 'detrimental')}` : '';

        return `
            <tr data-entry-id="${r.entry_id || ''}">
                <td>${r.entry_id || 'N/A'}</td>
                <td><span class="outline-label">${r.name || 'N/A'}</span></td>
                <td>${(r.score || 0).toLocaleString()}</td>
                <td class="left-align skill-cell">${recoveryCell}</td>
                <td class="left-align skill-cell">${passiveCell}</td>
                <td class="left-align skill-cell">${speedCell}</td>
                <td class="left-align skill-cell">${debuffCell}</td>
                <td class="left-align skill-cell">${detrimentalCell}</td>
            </tr>
        `;
    }).join('');

    skillsSummaryBody.innerHTML = html;
    hideEntryIdColumn('skills-summary');
}

function renderParentSummary(runners, allSparkCriteria) {
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
            <td ><span class="outline-label">${r.name || 'N/A'}</span></td>
            <td>${(r.score || 0).toLocaleString()}</td>
            <td class="stat-cell aptitude-${getStatGrade(r.speed)}">${r.speed || 0}</td>
            <td class="stat-cell aptitude-${getStatGrade(r.stamina)}">${r.stamina || 0}</td>
            <td class="stat-cell aptitude-${getStatGrade(r.power)}">${r.power || 0}</td>
            <td class="stat-cell aptitude-${getStatGrade(r.guts)}">${r.guts || 0}</td>
            <td class="stat-cell aptitude-${getStatGrade(r.wit)}">${r.wit || 0}</td>
            <td class="spark-cell">${formatSparks(r, 'blue', allSparkCriteria)}</td>
            <td class="spark-cell">${formatSparks(r, 'green', allSparkCriteria)}</td>
            <td class="spark-cell">${formatSparks(r, 'pink', allSparkCriteria)}</td>
            <td>${whiteDisplay}</td>
            <td class="${gp1Class}">${cleanName(r.gp1 || 'N/A')}</td>
            <td class="${gp2Class}">${cleanName(r.gp2 || 'N/A')}</td>
            <td><button class="delete-button" data-entry-id="${r.entry_id || ''}">Transfer</button></td>
            </tr>
    `}).join('');
    parentSummaryBody.innerHTML = html;
    hideEntryIdColumn('parent-summary');
}

function renderWhiteSparksSummary(runners, allSparkCriteria) {
    if (!runners.length) {
       whiteSparksBody.innerHTML = '<tr><td colspan="9">No runners match filters.</td></tr>';
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
                            const sparkCount = parseInt(spark.count, 10) || 1; 
                            totalCounts[source] += 1;
                            const name = spark.spark_name;
                            individualCounts[source][name] = (individualCounts[source][name] || 0) + sparkCount;
                       }
                   });
                }
            });
        }
        const whiteDisplay = `${totalCounts.parent + totalCounts.gp1 + totalCounts.gp2}(${totalCounts.parent})`;
        
        const formatWhiteSparkDisplay = (sourceTotal, sourceDetails, runner) => {
            
            if (sourceTotal === 0) {
                return '';
            }

            const highlightColor = '#e08b3e';
            const highlightStyle = isDarkModeActive() ? ` style="color: ${highlightColor}; font-weight: bold;"` : '';
            
            let shouldHighlightTotal = false;
            for (const criteria of allSparkCriteria) {
                if (criteria.minTotalWhite > 0 && sourceTotal >= criteria.minTotalWhite) {
                    shouldHighlightTotal = true;
                    break;
                }
            }

            const totalDisplay = shouldHighlightTotal 
                ? `<b${highlightStyle}>${sourceTotal}</b>` 
                : `<b>${sourceTotal}</b>`; 

            const detailsStr = Object.entries(sourceDetails)
                .map(([name, value]) => { 
                    let shouldHighlightName = false;
                    if (runner._passingWhiteSparks && runner._passingWhiteSparks.has(name)) {
                        shouldHighlightName = true;
                    }
                    
                    const formattedText = `${name} ${value}`; 
                    return shouldHighlightName ? `<b${highlightStyle}>${formattedText}</b>` : formattedText;
                })
                .join(', ');

            return `(${totalDisplay})${detailsStr ? ` ${detailsStr}` : ''}`;
        };

        const parentDisplay = formatWhiteSparkDisplay(totalCounts.parent, individualCounts.parent, r);
        const gp1Display = formatWhiteSparkDisplay(totalCounts.gp1, individualCounts.gp1, r);
        const gp2Display = formatWhiteSparkDisplay(totalCounts.gp2, individualCounts.gp2, r);

        const gp1Exists = !!findRunnerByDetails(r.gp1, r.sparks?.gp1);
        const gp2Exists = !!findRunnerByDetails(r.gp2, r.sparks?.gp2);

        const gp1NameClass = gp1Exists ? 'gp-link' : 'gp-borrowed';
        const gp2NameClass = gp2Exists ? 'gp-link' : 'gp-borrowed';
        const gp1SkillsClass = gp1Exists ? '' : 'gp-borrowed';
        const gp2SkillsClass = gp2Exists ? '' : 'gp-borrowed';

       return `
       <tr data-entry-id="${r.entry_id || ''}">
           <td>${r.entry_id || 'N/A'}</td>
           <td ><span class="outline-label">${r.name || 'N/A'}</span></td>
           <td >${(r.score || 0).toLocaleString()}</td>
           <td>${whiteDisplay}</td>
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

function handleDetailView(event) {
    const clickedCell = event.target.closest('td');
    if (!clickedCell) return;

    let runnerNameForLookup = null;
    let sparksToFind = null;
    let isClickable = false;

    const tableRow = event.target.closest('tr');
    const mainRunner = allRunners.find(r => String(r.entry_id) === tableRow?.dataset.entryId);
    if (!mainRunner) {
        return;
    }

    if (tableRow.closest('#white-sparks') && clickedCell.classList.contains('gp-link') && clickedCell.textContent.trim() === cleanName(mainRunner.name)) {
        showDetailModal(mainRunner);
        return;
    }

    if (clickedCell.classList.contains('gp-skills-link')) {
        runnerNameForLookup = clickedCell.dataset.gpName; 
        isClickable = true;
    } else if (clickedCell.classList.contains('gp-link')) {
        const clickedNameClean = clickedCell.textContent.trim();
        isClickable = true;
        
        if (cleanName(mainRunner.gp1) === clickedNameClean) {
             runnerNameForLookup = mainRunner.gp1;
        } else if (cleanName(mainRunner.gp2) === clickedNameClean) {
             runnerNameForLookup = mainRunner.gp2;
        }
    }
    else if (clickedCell.classList.contains('gp-borrowed')) {
        showTimedMessage("Borrowed or not in data");
        return;
    }

    if (isClickable && runnerNameForLookup && runnerNameForLookup !== 'N/A') {
        const nameToCompare = cleanName(runnerNameForLookup);
        
        if (cleanName(mainRunner.gp1) === nameToCompare) {
             sparksToFind = mainRunner.sparks?.gp1;
        } else if (cleanName(mainRunner.gp2) === nameToCompare) {
             sparksToFind = mainRunner.sparks?.gp2;
        }

        if (!sparksToFind) {
             showTimedMessage("Could not find entry");
             return;
        }

        const targetRunner = findRunnerByDetails(runnerNameForLookup, sparksToFind); 
        
        if (targetRunner) {
            showDetailModal(targetRunner, runnerNameForLookup);
        } else {
            console.warn(`Runner named "${runnerNameForLookup}" not found in allRunners with matching sparks.`);
            showTimedMessage("Could not find entry");
        }
        return;
    }

    if (tableRow && tableRow.dataset.entryId && !clickedCell.dataset.gpName && !clickedCell.classList.contains('gp-link') && !clickedCell.classList.contains('gp-borrowed')) {
        const entryId = tableRow.dataset.entryId;
        const runner = allRunners.find(r => String(r.entry_id) === String(entryId));
        if (runner) {
            showDetailModal(runner);
        } else {
            console.warn(`Runner with entry ID "${entryId}" not found.`);
            showTimedMessage("Could not find entry"); 
        }
    }
}

function filterAndRender() {
    allRunners.forEach(r => delete r._passingWhiteSparks);

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
            const minRankValue = APTITUDE_RANK_MAP[minGrade];
            filteredData = filteredData.filter(r => (APTITUDE_RANK_MAP[r[dataKey]?.toUpperCase() || ''] || -100) >= minRankValue);
        }
    }

    sortData(filteredData, baseFilters.sort, baseFilters.sortDir);

    const allSparkCriteria = getAllSparkFilterCriteria();
    const activeTabId = document.querySelector('.tab-content.active')?.id;

    if (activeTabId === 'parent-summary') {
        renderParentSummary(filteredData, allSparkCriteria);
    } 
    else if (activeTabId === 'white-sparks') {
        renderWhiteSparksSummary(filteredData, allSparkCriteria);
    }
    else if (activeTabId === 'skills-summary') {
        renderSkillsSummary(filteredData);
    }
    else if (activeTabId === 'legacies-planner') {
        renderLegaciesPlanner();
    }
    else if (activeTabId === 'grandparent-analysis') {
        renderGrandparentAnalysis(filteredData);
    }
    else if (activeTabId === 'inheritance-log') {
        renderInheritanceLog();
    }
}

// --- NEW ---
// You must fetch and populate this variable with the inspiration_chance.json data
// Example:
// let inspirationData = {};
// fetch('inspiration_chance.json').then(res => res.json()).then(data => inspirationData = data);
//
// For this example, I will hardcode it so the functions work.
const inspirationData = {
  "base_chances": {
    "blue": [0.70, 0.80, 0.90],
    "green": [0.05, 0.10, 0.15],
    "white_skill": [0.03, 0.06, 0.09], // Assuming 'white' color in your data maps to this
    "white_g1": [0.01, 0.02, 0.03],
    "pink": [0.01, 0.03, 0.05]
  },
  "affinity_bonuses": {
    "stat_multiplier": {
      "description": "A multiplier applied to the stats gained from all inherited Blue (Stat) sparks during an inspiration event.",
      "multipliers": {
        "triangle": 1.0,
        "circle": 1.2,
        "double_circle": 1.6
      }
    },
    "roll_bonus": {
      "description": "High affinity increases the *total number* of sparks inherited per event, improving practical odds.",
      "effect": "Increases total quantity of inherited sparks per event."
    }
  }
};

// --- NEW HELPER FUNCTION ---
/**
 * Gets the base inheritance chance from the loaded inspiration data.
 * @param {string} color - Spark color (blue, green, pink, white)
 * @param {number} stars - Star rating (1, 2, or 3)
 */
function getBaseChance(color, stars) {
    if (!inspirationData.base_chances) return 0;
    
    let type = color;
    // Simple logic to map 'white' to 'white_skill'. 
    // Your spark data would need to be more specific to differentiate G1 vs Skill.
    if (color === 'white') {
        type = 'white_skill'; 
    }

    const chances = inspirationData.base_chances[type];
    if (!chances) return 0;
    
    return chances[stars - 1] || 0;
}


// --- ADJUSTED FUNCTION ---
function renderLegaciesPlanner() {
    const runnerNames = [...allRunnerNamesSet].sort();
    const selects = document.querySelectorAll('#legacies-planner .runner-select');

    selects.forEach((select) => {
        const currentVal = select.value;
        const defaultOption = '<option value="">Select a runner</option>';
        select.innerHTML = defaultOption + runnerNames.map(n => `<option value="${n}">${n}</option>`).join('');
        if (runnerNames.includes(currentVal)) {
            select.value = currentVal;
        }
    });

    const parent1Select = document.querySelector('#parent1-selection .runner-select');
    const parent2Select = document.querySelector('#parent2-selection .runner-select');
    
    // --- NEW ---
    // Assumes an HTML select with id "affinity-selection" exists
    const affinitySelect = document.querySelector('#affinity-selection');
    const affinity = affinitySelect ? affinitySelect.value : 'double_circle'; // Default to 'double_circle'

    displayParentDetails(parent1Select, document.querySelector('#parent1-selection .runner-details'));
    displayParentDetails(parent2Select, document.querySelector('#parent2-selection .runner-details'));

    if (parent1Select.value && parent2Select.value) {
        // --- ADJUSTED CALL ---
        calculateOffspringPotential(parent1Select.value, parent2Select.value, affinity);
    } else {
        document.querySelector('.offspring-potential .spark-pool').innerHTML = '';
    }

    if (!legaciesPlannerBody.dataset.initialized) {
        selects.forEach((select) => {
            select.addEventListener('change', renderLegaciesPlanner);
        });
        
        // --- NEW ---
        // Add event listener for the new affinity dropdown
        if (affinitySelect) {
            affinitySelect.addEventListener('change', renderLegaciesPlanner);
        }
        
        legaciesPlannerBody.dataset.initialized = 'true';
    }
}

// --- UNCHANGED FUNCTION ---
function displayParentDetails(selectElement, detailsElement) {
    const runnerName = selectElement.value;
    const runner = allRunners.find(r => r.name === runnerName);
    if (runner) {
        const hasGreenParentSpark = runner.sparks?.parent?.some(s => s.color === 'green');
        let nameForImage = hasGreenParentSpark ? runner.name : `${runner.name} c`;
        nameForImage = (nameForImage || 'N/A').trim().replace(/ /g, '_');
        const runnerImgPath = `./assets/profile_images/${nameForImage}.png`;

        let sparksHtml = '';
        if(runner.sparks && runner.sparks.parent) {
            sparksHtml = runner.sparks.parent.map(s => `${s.spark_name} ${s.count}★`).join(', ');
        }

        detailsElement.innerHTML = `
            <img src="${runnerImgPath}" class="breeder-image" onerror="this.onerror=null; this.src='./assets/icon.png'; this.style.opacity=0.5;">
            <p><b>Score:</b> ${(runner.score || 0).toLocaleString()}</p>
            <div><b>Sparks:</b> ${sparksHtml || 'None'}</div>
        `;
    } else {
        detailsElement.innerHTML = '';
    }
}

// --- HEAVILY ADJUSTED FUNCTION ---
/**
 * Calculates and displays the inheritance potential.
 * @param {string} parent1Name
 * @param {string} parent2Name
 * @param {string} affinity - 'triangle', 'circle', or 'double_circle'
 */
function calculateOffspringPotential(parent1Name, parent2Name, affinity) {
    const parent1 = allRunners.find(r => r.name === parent1Name);
    const parent2 = allRunners.find(r => r.name === parent2Name);
    if (!parent1 || !parent2) return;

    const sparkPool = {};
    const ancestorList = {};

    const addSparksToPool = (runner, role) => {
        if (!runner || !runner.sparks || !runner.sparks.parent) {
            ancestorList[role] = { name: role, found: false };
            return;
        }
        ancestorList[role] = { name: runner.name, found: true, entry_id: runner.entry_id };
        
        runner.sparks.parent.forEach(spark => {
            if (!spark.spark_name) return;
            
            // Create pool entry if it doesn't exist
            if (!sparkPool[spark.spark_name]) {
                sparkPool[spark.spark_name] = { 
                    name: spark.spark_name, 
                    color: spark.color, 
                    instances: [] // Store individual instances
                };
            }
            
            // Add this instance
            sparkPool[spark.spark_name].instances.push({
                role: role,
                stars: parseInt(spark.count, 10)
            });
        });
    };

    // Add Parents
    addSparksToPool(parent1, 'Parent 1');
    addSparksToPool(parent2, 'Parent 2');

    // Find and Add Grandparents
    const gp1_1 = findRunnerByDetails(parent1.gp1, parent1.sparks?.gp1);
    const gp1_2 = findRunnerByDetails(parent1.gp2, parent1.sparks?.gp2);
    const gp2_1 = findRunnerByDetails(parent2.gp1, parent2.sparks?.gp1);
    const gp2_2 = findRunnerByDetails(parent2.gp2, parent2.sparks?.gp2);

    addSparksToPool(gp1_1, parent1.gp1 || 'P1-GP1');
    addSparksToPool(gp1_2, parent1.gp2 || 'P1-GP2');
    addSparksToPool(gp2_1, parent2.gp1 || 'P2-GP1');
    addSparksToPool(gp2_2, parent2.gp2 || 'P2-GP2');
    
    // Sort sparks by number of instances (most common)
    const sortedSparks = Object.values(sparkPool).sort((a, b) => b.instances.length - a.instances.length);

    // Get affinity stat bonus
    const statMultiplier = inspirationData.affinity_bonuses.stat_multiplier.multipliers[affinity] || 1.0;

    let html = sortedSparks.map(spark => {
        let probOfNotInheriting = 1.0;
        let totalStars = 0;

        spark.instances.forEach(instance => {
            const isParent = instance.role.startsWith('Parent');
            const baseChance = getBaseChance(spark.color, instance.stars);
            
            // Parent has full chance, Grandparent has half
            const effectiveChance = isParent ? baseChance : (baseChance / 2);
            
            probOfNotInheriting *= (1 - effectiveChance);
            totalStars += instance.stars;
        });

        // Chance to get it AT LEAST ONCE in a SINGLE event
        const probPerEvent = (1 - probOfNotInheriting);
        
        // Chance to get it AT LEAST ONCE over ALL 3 events (1 - (chance of missing all 3 times))
        const probOverThreeEvents = (1 - Math.pow(probOfNotInheriting, 3));
        const chancePercent = (probOverThreeEvents * 100).toFixed(1);

        // Add bonus info for Blue sparks
        let bonusInfo = '';
        if (spark.color === 'blue') {
            bonusInfo = ` <span class.="spark-bonus-info">(+${((statMultiplier - 1) * 100).toFixed(0)}% stat bonus)</span>`;
        }

        return `<div class="spark-potential spark-color-${spark.color}">
            <b>${spark.name}</b>${bonusInfo}
            <div class="spark-details">
                (Total: ${totalStars}★ from ${spark.instances.length} contributors)
                <b>Total Chance: ~${chancePercent}%</b>
            </div>
        </div>`;
    }).join('');

    // Add note about affinity
    const affinityNote = `<p class="affinity-note"><b>Note:</b> ${inspirationData.affinity_bonuses.roll_bonus.description}</p>`;

    document.querySelector('.spark-pool').innerHTML = `<h4>Combined Spark Pool</h4>${affinityNote}${html || '<p>No inheritable sparks found from parents or known grandparents.</p>'}`;
}

function renderGrandparentAnalysis(filteredRunners) {
    const grandparentData = {};

    (filteredRunners || allRunners).forEach(runner => {
        const processGrandparent = (gpName, gpSparks, role) => {
            if (!gpName || gpName === 'N/A') return;
            const cleanedName = cleanName(gpName);
            if (!grandparentData[cleanedName]) {
                const gpAsRunner = findRunnerByDetails(gpName, gpSparks);
                grandparentData[cleanedName] = { 
                    name: cleanedName, 
                    total: 0, 
                    asGP1: 0, 
                    asGP2: 0, 
                    sparks: gpSparks || [],
                    runner: gpAsRunner
                };
            }
            grandparentData[cleanedName].total++;
            grandparentData[cleanedName][role]++;
        };
        processGrandparent(runner.gp1, runner.sparks?.gp1, 'asGP1');
        processGrandparent(runner.gp2, runner.sparks?.gp2, 'asGP2');
    });

    const sortedGrandparents = Object.values(grandparentData).sort((a, b) => b.total - a.total);
    const tableBody = document.getElementById('grandparent-summary-body');
    
    let html = sortedGrandparents.map(gp => {
        const topSparks = (gp.sparks)
            .filter(s => parseInt(s.count, 10) >= 3 || s.color === 'white')
            .map(s => `${s.spark_name} ${s.count}★`)
            .join(', ');
        
        const nameClass = gp.runner ? 'gp-link' : 'gp-borrowed';
        const entryIdAttr = gp.runner ? `data-entry-id="${gp.runner.entry_id}"` : '';

        return `
            <tr data-gp-name="${gp.name}" style="cursor: pointer;">
                <td class="${nameClass}" ${entryIdAttr}>${gp.name}</td>
                <td>${gp.total}</td>
                <td>${gp.asGP1}</td>
                <td>${gp.asGP2}</td>
                <td class="left-align">${topSparks}</td>
            </tr>
        `;
    }).join('');

    tableBody.innerHTML = html;
    document.getElementById('descendant-list-body').innerHTML = 'Click a grandparent to see their descendants.';

    if (!tableBody.dataset.initialized) {
        tableBody.addEventListener('click', (e) => {
            const row = e.target.closest('tr');
            if (!row) return;

            // Handle clicking on a grandparent's name to open their modal
            if (e.target.matches('.gp-link[data-entry-id]')) {
                const runner = allRunners.find(r => String(r.entry_id) === e.target.dataset.entryId);
                if (runner) showDetailModal(runner);
                return;
            }

            tableBody.querySelectorAll('tr').forEach(r => r.classList.remove('selected'));
            row.classList.add('selected');

            const gpName = row.dataset.gpName;
            const descendants = allRunners.filter(r => cleanName(r.gp1) === gpName || cleanName(r.gp2) === gpName);
            let descendantHtml = descendants.map(d => 
                `<li class="gp-link" data-entry-id="${d.entry_id}">
                    ${d.name} (Score: ${(d.score || 0).toLocaleString()})
                </li>`
            ).join('');
            document.getElementById('descendant-list-body').innerHTML = `<h5>Descendants of ${gpName}</h5><ul>${descendantHtml || '<li>None found in data.</li>'}</ul>`;
        });
        tableBody.dataset.initialized = 'true';
    }
}

function handleGrandparentClick(event) {
    const target = event.target;
    if (target.matches('.descendant-list .gp-link[data-entry-id]')) {
        const entryId = target.dataset.entryId;
        const runner = allRunners.find(r => String(r.entry_id) === entryId);
        if (runner) {
            showDetailModal(runner);
        }
    }
}

function renderInheritanceLog() {
    const allSparks = new Set();
    allRunners.forEach(runner => {
        if (!runner.sparks) return;
        ['parent', 'gp1', 'gp2'].forEach(source => {
            if (Array.isArray(runner.sparks[source])) {
                runner.sparks[source].forEach(spark => {
                    if(spark.spark_name) allSparks.add(spark.spark_name);
                });
            }
        });
    });

    const sortedSparks = [...allSparks].sort();
    const sparkSelect = document.getElementById('spark-select');
    
    const currentVal = sparkSelect.value;
    sparkSelect.innerHTML = '<option value="">Select a spark to trace</option>' + sortedSparks.map(s => `<option value="${s}">${s}</option>`).join('');
    if (sortedSparks.includes(currentVal)) {
        sparkSelect.value = currentVal;
    }

    if (!sparkSelect.dataset.initialized) {
        sparkSelect.addEventListener('change', renderInheritanceLog);
        sparkSelect.dataset.initialized = 'true';
    }
    
    const selectedSpark = sparkSelect.value;
    const graphContainer = document.getElementById('inheritance-graph');
    if (selectedSpark) {
        const chains = traceInheritance(selectedSpark);
        renderInheritanceGraph(chains, graphContainer);
    } else {
        graphContainer.innerHTML = '';
    }
}

/**
 * [REVISED] Renders the entire Inheritance Log tab, including the selection dropdown,
 * the graph, and a new explanation panel.
 */
function renderInheritanceLog() {
    const contentContainer = document.getElementById('inheritance-log-content');
    
    // Check if the explanation panel has been added. If not, set up the layout.
    if (!contentContainer.querySelector('.inheritance-explanation')) {
        contentContainer.style.display = 'flex';
        contentContainer.style.gap = '20px';

        const mainContent = document.createElement('div');
        mainContent.className = 'inheritance-main';
        mainContent.style.flex = '3'; // Main content takes up 3/4 of the space

        // Move the existing selector and graph divs into the new main container
        const selector = contentContainer.querySelector('.spark-selector');
        const graph = contentContainer.querySelector('#inheritance-graph');
        if (selector) mainContent.appendChild(selector);
        if (graph) mainContent.appendChild(graph);
        contentContainer.innerHTML = ''; // Clear the container
        contentContainer.appendChild(mainContent);

        const explanationDiv = document.createElement('div');
        explanationDiv.className = 'inheritance-explanation';
        explanationDiv.style.flex = '1'; // Explanation takes up 1/4 of the space
        explanationDiv.style.padding = '15px';
        explanationDiv.style.border = '1px solid var(--uma-border-color)';
        explanationDiv.style.borderRadius = '5px';
        explanationDiv.style.alignSelf = 'flex-start'; // Keeps it aligned to the top
        explanationDiv.innerHTML = `
            <h4 style="margin-top: 0;">What is this?</h4>
            <p style="font-size: 0.9em; line-height: 1.4;">
                The Inheritance Log visualizes the lineage of a single spark through your collection, creating a "family tree" for that specific trait.
            </p>
            <h4>How to Use</h4>
            <p style="font-size: 0.9em; line-height: 1.4;">
                Select a spark from the dropdown. The graph will show all runners who have that spark and who they inherited it from.
            </p>
            <ul style="font-size: 0.9em; line-height: 1.4; padding-left: 20px;">
                <li>Each list is a distinct inheritance chain.</li>
                <li>The runner at the top is the earliest known source of the spark in that chain within your data.</li>
                <li>The <b>Score</b> and the spark's star-level (<b>★</b>) are shown for each runner.</li>
                <li>Click any runner's name to view their full details.</li>
            </ul>
        `;
        contentContainer.appendChild(explanationDiv);
    }

    const allSparks = new Set();
    allRunners.forEach(runner => {
        if (!runner.sparks) return;
        ['parent', 'gp1', 'gp2'].forEach(source => {
            if (Array.isArray(runner.sparks[source])) {
                runner.sparks[source].forEach(spark => {
                    if(spark.spark_name) allSparks.add(spark.spark_name);
                });
            }
        });
    });

    const sortedSparks = [...allSparks].sort();
    const sparkSelect = document.getElementById('spark-select');
    
    const currentVal = sparkSelect.value;
    sparkSelect.innerHTML = '<option value="">Select a spark to trace</option>' + sortedSparks.map(s => `<option value="${s}">${s}</option>`).join('');
    if (sortedSparks.includes(currentVal)) {
        sparkSelect.value = currentVal;
    }

    if (!sparkSelect.dataset.initialized) {
        sparkSelect.addEventListener('change', renderInheritanceLog);
        sparkSelect.dataset.initialized = 'true';
    }
    
    const selectedSpark = sparkSelect.value;
    const graphContainer = document.getElementById('inheritance-graph');
    if (selectedSpark) {
        const chains = traceInheritance(selectedSpark);
        renderInheritanceGraph(chains, graphContainer);
    } else {
        graphContainer.innerHTML = 'Select a spark from the dropdown to see its inheritance chains.';
    }
}

/**
 * [REVISED] Traces the inheritance of a specific spark, building accurate parent-child chains.
 * Returns an array of chains, where each link contains the runner, their score, and the spark level.
 */
function traceInheritance(sparkName) {
    const nodes = new Map(); // Key: entry_id, Value: { runner, sparkLevel, children: [] }

    // 1. Find all runners with the target spark in their *parent* sparks and get its level
    allRunners.forEach(r => {
        const parentSparks = r.sparks?.parent || [];
        const sparkInstance = parentSparks.find(s => s.spark_name === sparkName);
        if (sparkInstance) {
            nodes.set(r.entry_id, { 
                runner: r, 
                sparkLevel: parseInt(sparkInstance.count, 10) || 1, 
                children: [] 
            });
        }
    });

    if (nodes.size === 0) return [];

    const hasParentInSet = new Set(); // Stores entry_ids of runners who are children

    // 2. Iterate through nodes to link them to their parents (if the parent is also in the node set)
    nodes.forEach(node => {
        const runner = node.runner;

        const checkAndLinkParent = (gpName, gpSparks) => {
            const parentRunner = findRunnerByDetails(gpName, gpSparks);
            // Check if the found parent also has the spark (is in our nodes map)
            if (parentRunner && nodes.has(parentRunner.entry_id)) {
                nodes.get(parentRunner.entry_id).children.push(node);
                hasParentInSet.add(runner.entry_id); // Mark this runner as a child
            }
        };

        checkAndLinkParent(runner.gp1, runner.sparks?.gp1);
        checkAndLinkParent(runner.gp2, runner.sparks?.gp2);
    });

    // 3. The "sources" are the nodes that were never marked as children
    const sources = [...nodes.values()].filter(node => !hasParentInSet.has(node.runner.entry_id));

    // 4. Build the final chain arrays by traversing from each source
    const chains = [];
    function buildChain(node, currentChain) {
        const newChain = [...currentChain, { 
            runner: node.runner, 
            score: node.runner.score || 0,
            sparkLevel: node.sparkLevel 
        }];
        
        if (node.children.length === 0) {
            chains.push(newChain); // End of a chain
        } else {
            // Sort children to have a consistent order, e.g., by highest score
            node.children.sort((a, b) => (b.runner.score || 0) - (a.runner.score || 0));
            node.children.forEach(child => buildChain(child, newChain));
        }
    }

    sources.forEach(sourceNode => buildChain(sourceNode, []));

    return chains;
}

/**
 * [REVISED] Renders the inheritance graph from the traced chains, now including score and spark level.
 */
function renderInheritanceGraph(chains, container) {
    if (!chains || chains.length === 0) {
        container.innerHTML = "<p>No inheritance chains found for this spark in your collection.</p>";
        return;
    }

    // Sort chains by length to show the most developed lineages first
    chains.sort((a, b) => b.length - a.length);

    let html = chains.map(chain => {
        const listItems = chain.map(link => {
            const { runner, score, sparkLevel } = link;
            return `<li class="gp-link" data-entry-id="${runner.entry_id}">
                        ${runner.name} 
                        (Score: ${score.toLocaleString()}) - 
                        <b>${sparkLevel}★</b>
                    </li>`;
        }).join('');
        return `<ul>${listItems}</ul>`;
    }).join('');

    container.innerHTML = `<h4>Inheritance Chains (Source → Descendant)</h4>${html}`;
}

/**
 * Handles clicks within the inheritance graph to open the detail modal for a runner.
 */
function handleInheritanceNodeClick(event) {
    const target = event.target;
    // Ensure the click is on a list item within the graph
    if (target.matches('#inheritance-graph .gp-link[data-entry-id]')) {
        const entryId = target.dataset.entryId;
        const runner = allRunners.find(r => String(r.entry_id) === entryId);
        if (runner) {
            showDetailModal(runner);
        }
    }
}

function getAllSparkFilterCriteria() {
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
            return sortDir === 'asc' ? numA - numA : numB - numA;
        }
    });
}

function formatSparks(runner, color, allSparkCriteria) {
    const sparks = {}, parentSparks = {};
    const highlightStyle = isDarkModeActive() ? ` style="color: #e08b3e; font-weight: bold;"` : '';
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
            for (const criteria of allSparkCriteria) {
                const countToCheck = criteria.isRepOnly ? parentCount : grandparentsCount;
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
            return shouldHighlight ? `<b${highlightStyle}>${displayPart}</b>` : displayPart;
        });

    return parts.join(' ') || '';
}

/**
 * [REVISED] Displays a detailed modal for a runner with a tabbed interface
 * for "Skills" and "Inspiration" (Sparks), mimicking the in-game UI.
 */
function showDetailModal(runner, displayName) {
    const existingModal = document.getElementById('detail-modal-overlay');
    if (existingModal) existingModal.remove();

    // --- Main Modal Structure ---
    const overlay = document.createElement('div');
    overlay.id = 'detail-modal-overlay';
    overlay.onclick = (e) => {
        if (e.target.id === 'detail-modal-overlay') {
             overlay.remove();
        }
    };

    const modal = document.createElement('div');
    modal.id = 'detail-modal';

    // --- Header (Identical to before) ---
    const header = document.createElement('div');
    header.className = 'modal-header';
    
    let nameForImage;
    if (displayName) {
        nameForImage = displayName;
    } else {
        const hasGreenParentSpark = runner.sparks?.parent?.some(s => s.color === 'green');
        nameForImage = hasGreenParentSpark ? runner.name : runner.name + ' c';
    }
    nameForImage = nameForImage || 'N/A';
    
    const runnerName = runner.name || 'N/A';
    const runnerImgName = nameForImage.trim().replace(/ /g, '_');
    const runnerImgPath = `./assets/profile_images/${runnerImgName}.png`;
    
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
    const baseGradeLetter = rankGrade.replace('<sup>+</sup>', '').replace('+', '').replace('SS', 'S');
    const rankClass = `modal-rank-grade rank-fix-${baseGradeLetter}`;

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
                        <div class="${rankClass}">${rankGrade}</div>
                        <div class="modal-rank-text">RANK</div>
                    </div>
                </div>
                <div class="modal-runner-name">${runnerName.replace(' ', '<br>')}</div>
            </div>
        </div>
    `;

    // --- Content Area ---
    const content = document.createElement('div');
    content.id = 'detail-modal-content';

    // --- Stats Bar and Aptitudes (Identical to before) ---
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
                    <img class="stat-icon" src="./assets/stat_icons/${STAT_ICONS[stat]}" alt="${stat}">
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
    
    // --- NEW: Tabbed Section for Skills/Inspiration ---
    const modalTabs = document.createElement('div');
    modalTabs.className = 'modal-tabs';
    modalTabs.innerHTML = `
        <button class="modal-tab-button active" data-tab="skills">Skills</button>
        <button class="modal-tab-button" data-tab="inspiration">Inspiration</button>
    `;
    content.appendChild(modalTabs);

    const tabContentContainer = document.createElement('div');
    tabContentContainer.className = 'modal-tab-content-container';

    // Panel 1: Skills
    const skillsPanel = document.createElement('div');
    skillsPanel.id = 'modal-skills-panel';
    skillsPanel.className = 'modal-tab-panel active'; // Show by default
    
    const skillsList = document.createElement('div');
    skillsList.className = 'modal-skills-list';
    let skillsHtml = '';
    const runnerSkills = runner.skills || [];
    if (runnerSkills.length > 0) {
        let unique_set = false;
        runnerSkills.forEach(skillName => {
            const skillType = skillData[skillName] || null;
            let itemClass = 'modal-skill-item';
            if (skillType) {
                if (skillType.startsWith('unique') && !unique_set) {
                    unique_set = true
                    itemClass += ' unique';
                } else if (skillType.endsWith('_gold')) { 
                    itemClass += ' gold';
                }
            }
            const iconPath = skillType ? `./assets/skill_icons/${skillType}.png` : '';
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
    skillsPanel.appendChild(skillsList);
    tabContentContainer.appendChild(skillsPanel);

    // Panel 2: Inspiration (Sparks)
    const sparksPanel = document.createElement('div');
    sparksPanel.id = 'modal-inspiration-panel';
    sparksPanel.className = 'modal-tab-panel'; // Hidden by default
    sparksPanel.innerHTML = generateSparksHtml(runner); // New helper function
    tabContentContainer.appendChild(sparksPanel);
    content.appendChild(tabContentContainer);

    // --- Footer (Identical to before) ---
    const footer = document.createElement('div');
    footer.className = 'modal-footer';
    footer.innerHTML = '<button id="modal-close-button">Close</button>';
    footer.querySelector('#modal-close-button').onclick = () => overlay.remove();

    // --- Assemble Modal ---
    modal.appendChild(header);
    modal.appendChild(content);
    modal.appendChild(footer);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // --- NEW: Add Tab Switching Logic ---
    modal.querySelectorAll('.modal-tab-button').forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.dataset.tab;
            // Update button styles
            modal.querySelectorAll('.modal-tab-button').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            // Show the correct content panel
            modal.querySelectorAll('.modal-tab-panel').forEach(panel => {
                if (panel.id === `modal-${tabName}-panel`) {
                    panel.classList.add('active');
                } else {
                    panel.classList.remove('active');
                }
            });
        });
    });
}

function resetFilters() {
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

    const allSkillRows = skillFiltersContainer.querySelectorAll('.skill-filters');
    allSkillRows.forEach((row, index) => {
        if (index > 0) {
            row.remove();
        } else {
            row.querySelector('.skill-name-input').value = '';
        }
    });
    updateRemoveSkillButtonVisibility();

    const allSparkRows = sparkFiltersContainer.querySelectorAll('.spark-filters');
    allSparkRows.forEach((row, index) => {
        if (index > 0) {
            row.remove();
        } 
        else {
            row.querySelectorAll('input[type="text"]').forEach(input => input.value = '');
            row.querySelectorAll('select').forEach(select => select.selectedIndex = 0);
            row.querySelector('.rep-only-checkbox').checked = false;
            row.classList.remove('disabled');
            const disableBtn = row.querySelector('.disable-spark-filter-button');
            if(disableBtn) {
                disableBtn.textContent = '✓';
                disableBtn.title = 'Disable this filter row';
            }
            updateSparkCountDropdown(row.querySelector('[id^="min-blue"]'), 9);
            updateSparkCountDropdown(row.querySelector('[id^="min-green"]'), 3);
            updateSparkCountDropdown(row.querySelector('[id^="min-pink"]'), 9);
            updateSparkCountDropdown(row.querySelector('[id^="min-white"]'), 9);
            updateTotalWhiteDropdown(row, false);
        }
    });

    updateRemoveButtonVisibility();
    filterElements.sortDir.value = 'desc';
    document.querySelectorAll('.stat-input').forEach(updateStatInputPlaceholder);
    document.querySelectorAll('.aptitude-select').forEach(updateSelectPlaceholder);
    filterAndRender();
}

function updateSparkCountDropdown(selectElement, maxStars) {
    if (!selectElement) return;
    const currentValue = selectElement.value;
    let optionsHtml = '<option value="0"></option>';
    for (let i = 1; i <= maxStars; i++) {
        optionsHtml += `<option value="${i}">${i}★</option>`;
    }
    selectElement.innerHTML = optionsHtml;
    if (parseInt(currentValue, 10) <= maxStars) {
        selectElement.value = currentValue;
    } 
    else if (parseInt(currentValue, 10) > 3) {
        selectElement.value = "3";
    } else {
        selectElement.value = "0";
    }
}

function updateTotalWhiteDropdown(rowElement, isParentOnly) {
    const select = rowElement.querySelector('[id^="min-total-white"]');
    if (!select) return;
    const currentValue = select.value;
    const max = isParentOnly ? maxParentWhiteSparks : maxTotalWhiteSparks;
    let optionsHtml = '<option value="0"></option>';
    for (let i = 1; i <= max; i++) {
        optionsHtml += `<option value="${i}">${i}</option>`;
    }
    select.innerHTML = optionsHtml;
    if (currentValue > max) {
        select.value = max.toString();
    } else {
        select.value = currentValue.toString();
    }
}

function updateRemoveButtonVisibility() {
    const allSparkRows = sparkFiltersContainer.querySelectorAll('.spark-filters');
    const shouldShowRemove = allSparkRows.length > 1;
    allSparkRows.forEach(row => {
        const removeBtn = row.querySelector('.remove-spark-filter-button');
        if (removeBtn) {
            removeBtn.style.display = shouldShowRemove ? 'block' : 'none';
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

function hideEntryIdColumn(tabId) {
    const table = document.querySelector(`#${tabId} table`);
    if (!table) return;
    const headerCell = table.querySelector('thead th:first-child');
    const bodyCells = table.querySelectorAll('tbody td:first-child');
    if (headerCell) headerCell.style.display = 'none';
    bodyCells.forEach(cell => cell.style.display = 'none');
} 

function findRunnerByDetails(name, gpSparksArray) {
    if (!name || !gpSparksArray || gpSparksArray.length === 0) {
        return null;
    }
    const cacheKey = `${name}-${JSON.stringify(gpSparksArray)}`;
    if (gpExistenceCache.has(cacheKey)) {
        return gpExistenceCache.get(cacheKey);
    }
    const createComparableString = (arr) => {
        if (!arr) return null;
        const sortedArr = [...arr].sort((a, b) => {
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

    const isCVersionLookup = name.endsWith(' c');
    const baseName = cleanName(name);

    const foundRunner = allRunners.find(runner => {
        if (runner.name !== baseName) {
            return false;
        }
        const hasGreenParentSpark = runner.sparks?.parent?.some(s => s.color === 'green');
        if (isCVersionLookup) {
            if (hasGreenParentSpark) {
                return false;
            }
        }
        if (!runner.sparks?.parent) return false;
        const parentSparksString = createComparableString(runner.sparks.parent);
        return parentSparksString === gpSparksString;
    });

    const result = foundRunner || null;
    gpExistenceCache.set(cacheKey, result);
    return result;
}

function showTimedMessage(message) {
    const existingPopup = document.getElementById('timed-message-popup');
    if (existingPopup) {
        existingPopup.remove();
    }
    const popup = document.createElement('div');
    popup.id = 'timed-message-popup';
    popup.textContent = message;
    document.body.appendChild(popup);
    setTimeout(() => {
        popup.style.opacity = '0';
        setTimeout(() => {
            popup.remove();
        }, 500);
    }, 2000);
}

function handleDeleteRunner(event) {
    const target = event.target;
    if (target.classList.contains('delete-button')) {
        const entryId = target.dataset.entryId;
        if (!entryId) return;

        const runnerIndex = allRunners.findIndex(r => String(r.entry_id) === String(entryId));
        
        if (runnerIndex > -1) {
            const runnerName = allRunners[runnerIndex].name || 'this runner';
            const confirmed = window.confirm(`Are you sure you want to transfer ${runnerName} ${allRunners[runnerIndex].score}?`);
            
            if (confirmed) {
                allRunners.splice(runnerIndex, 1);
                
                try {
                    localStorage.setItem('savedRunnerData', JSON.stringify(allRunners));
                } catch (e) {
                    console.error("Could not update localStorage after deletion:", e);
                    showTimedMessage("Runner removed, but failed to update local storage.");
                }
                
                filterAndRender();
                updateEntriesCount();
                showTimedMessage(`${runnerName} transferred (deleted).`);
            }
        } else {
            console.warn(`Could not find runner with entry ID ${entryId} to delete.`);
            showTimedMessage("Error: Could not find runner to delete.");
        }
    }
}

function saveDataToFile() {
    try {
        const jsonData = JSON.stringify(allRunners, null, 2);
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'all_runners.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showTimedMessage("Data saved to all_runners.json");

    } catch (err) {
        console.error("Failed to save data:", err);
        showTimedMessage("Error: Could not save file.");
    }
}

function updateEntriesCount() {
    if (entriesCountDisplay) {
        entriesCountDisplay.textContent = `Entries count: ${allRunners.length}/200`;
    }
}

function updateSelectPlaceholder(selectElement) {
    if (!selectElement) return;

    if (selectElement.value === "") {
        selectElement.classList.add('placeholder-selected');
    } else {
        selectElement.classList.remove('placeholder-selected');
    }
}

function updateStatInputPlaceholder(inputElement) {
    if (!inputElement) return;

    if (inputElement.value === '0') {
        inputElement.classList.add('placeholder-value');
    } else {
        inputElement.classList.remove('placeholder-value');
    }
}

/**
 * [Definitive Version] Generates the HTML for the "Inspiration" tab, applying a
 * 'not-in-data' class to the profile image if findRunnerByDetails() returns null.
 */
function generateSparksHtml(runner) {
    let html = '<div class="modal-sparks-list">';

    const createSection = (sourceRunner, sparks, fallbackName) => {
        if (!sparks || sparks.length === 0) return '';

        // Determine the correct image for the source runner
        let sourceImgPath = './assets/icon.png'; // Default image
        let nameForImage = '';

        if (sourceRunner) { // If the runner exists in our data
            const hasGreen = sourceRunner.sparks?.parent?.some(s => s.color === 'green');
            nameForImage = hasGreen ? sourceRunner.name : `${sourceRunner.name} c`;
        } else if (fallbackName) { // For grandparents not in data, use their name
            nameForImage = fallbackName;
        }

        if (nameForImage) {
            const runnerImgName = nameForImage.trim().replace(/ /g, '_');
            sourceImgPath = `./assets/profile_images/${runnerImgName}.png`;
        }

        // This is the crucial check. If sourceRunner (the result of findRunnerByDetails)
        // is null, the 'not-in-data' class is added.
        const profileImgClass = sourceRunner ? 'modal-profile-img' : 'modal-profile-img not-in-data';

        let sectionHtml = `
            <div class="spark-legacy-section">
                <div class="spark-legacy-image-container">
                    <div class="spark-legacy-frame-scaler"> 
                        <div class="modal-profile-frame">
                            <div class="modal-profile-frame-outline">
                                <div class="${profileImgClass}" style="background-image: url('${sourceImgPath}');">
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="spark-items-grid">
        `;

        sparks.forEach(spark => {
            const stars = '★'.repeat(parseInt(spark.count, 10) || 1);
            sectionHtml += `
            <div class="spark-item spark-${spark.color}">
                <span class="spark-item-name">${spark.spark_name}</span>
                <span class="spark-item-stars">${stars}</span>
            </div>
            `;
        });

        sectionHtml += `</div></div>`;
        return sectionHtml;
    };

    // The logic is applied to each call here:
    // Parent section will never be grayed out because 'runner' always exists.
    html += createSection(runner, runner.sparks?.parent, runner.name);

    // Grandparent 1 Section
    const gp1 = findRunnerByDetails(runner.gp1, runner.sparks?.gp1);
    html += createSection(gp1, runner.sparks?.gp1, runner.gp1); // 'gp1' will be null if not found

    // Grandparent 2 Section
    const gp2 = findRunnerByDetails(runner.gp2, runner.sparks?.gp2);
    html += createSection(gp2, runner.sparks?.gp2, runner.gp2); // 'gp2' will be null if not found

    html += '</div>';
    return html;
}