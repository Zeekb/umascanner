let allRunners = [];
let blueSparkNames = [];
let pinkSparkNames = [];

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
    blueSpark: document.getElementById('filter-blue-spark'),
    minBlue: document.getElementById('min-blue'),
    pinkSpark: document.getElementById('filter-pink-spark'),
    minPink: document.getElementById('min-pink'),
    aptTurf: document.getElementById('apt-turf'),
    aptDirt: document.getElementById('apt-dirt'),
    aptMile: document.getElementById('apt-mile'),
    aptLong: document.getElementById('apt-long'),
};

const tabButtons = document.querySelectorAll('.tab-button');
const tabContents = document.querySelectorAll('.tab-content');
const parentSummaryBody = document.getElementById('parent-summary-body');
const aptitudeSummaryBody = document.getElementById('aptitude-summary-body');

const APTITUDE_RANK_MAP = {'S': 5, 'A': 4, 'B': 3, 'C': 2, 'D': 1, 'E': 0, 'F': -1, 'G': -2};

// --- Initializer ---
document.addEventListener('DOMContentLoaded', async () => {
    try {
        allRunners = await window.api.loadRunners();
        if (!allRunners || allRunners.length === 0) {
            console.warn("No runner data loaded.");
            return;
        }
        
        // Pre-process data and populate filters
        extractSparkNames();
        populateFilters();
        setupEventListeners();
        
        // Initial render
        handleTabChange('parent-summary');
    } catch (error) {
        console.error("Initialization failed:", error);
    }
});

// --- Setup ---
function extractSparkNames() {
    const blue = new Set();
    const pink = new Set();
    allRunners.forEach(runner => {
        (runner.sparks?.parent || []).forEach(spark => {
            if (spark.color === 'blue') blue.add(spark.spark_name);
            if (spark.color === 'pink') pink.add(spark.spark_name);
        });
         (runner.sparks?.gp1 || []).forEach(spark => {
            if (spark.color === 'blue') blue.add(spark.spark_name);
            if (spark.color === 'pink') pink.add(spark.spark_name);
        });
         (runner.sparks?.gp2 || []).forEach(spark => {
            if (spark.color === 'blue') blue.add(spark.spark_name);
            if (spark.color === 'pink') pink.add(spark.spark_name);
        });
    });
    blueSparkNames = [...blue].sort();
    pinkSparkNames = [...pink].sort();
}

function populateFilters() {
    // Runner names
    const runnerNames = [...new Set(allRunners.map(r => r.name))].sort();
    filterElements.runner.innerHTML = '<option value="">All Runners</option>' + runnerNames.map(n => `<option value="${n}">${n}</option>`).join('');

    // Spark Names
    filterElements.blueSpark.innerHTML = '<option value="">Any Blue</option>' + blueSparkNames.map(n => `<option value="${n}">${n}</option>`).join('');
    filterElements.pinkSpark.innerHTML = '<option value="">Any Pink</option>' + pinkSparkNames.map(n => `<option value="${n}">${n}</option>`).join('');

    // Min Spark Counts
    for(let i = 1; i <= 9; i++) {
        const option = `<option value="${i}">${i}★</option>`;
        filterElements.minBlue.innerHTML += option;
        filterElements.minPink.innerHTML += option;
    }
    filterElements.minBlue.innerHTML = '<option value="0">Min ★</option>' + filterElements.minBlue.innerHTML;
    filterElements.minPink.innerHTML = '<option value="0">Min ★</option>' + filterElements.minPink.innerHTML;

    // Aptitude Grades
    const aptGrades = ['S', 'A', 'B', 'C', 'D'];
    [filterElements.aptTurf, filterElements.aptDirt, filterElements.aptMile, filterElements.aptLong].forEach(sel => {
        aptGrades.forEach(g => sel.innerHTML += `<option value="${g}">≥ ${g}</option>`);
    });
}

function setupEventListeners() {
    // Add listeners to all filters to trigger re-render
    Object.values(filterElements).forEach(el => el.addEventListener('input', () => filterAndRender()));

    // Tab switching logic
    tabButtons.forEach(button => {
        button.addEventListener('click', () => handleTabChange(button.dataset.tab));
    });
}

// --- Tab and Sort Logic ---
function handleTabChange(activeTabId) {
    tabButtons.forEach(b => b.classList.toggle('active', b.dataset.tab === activeTabId));
    tabContents.forEach(c => c.classList.toggle('active', c.id === activeTabId));
    
    // Update sort options based on active tab
    const parentSort = ['score', 'name', 'speed', 'stamina', 'power', 'guts', 'wit', 'whites'];
    const aptSort = ['score', 'name', 'turf', 'dirt', 'sprint', 'mile', 'medium', 'long'];
    const options = (activeTabId === 'parent-summary' ? parentSort : aptSort);
    
    filterElements.sort.innerHTML = options.map(o => `<option value="${o}">${o.charAt(0).toUpperCase() + o.slice(1)}</option>`).join('');
    
    document.getElementById('aptitude-filters').style.display = activeTabId === 'aptitude-summary' ? 'flex' : 'none';
    
    filterAndRender();
}

// --- Core Filtering Logic ---
function filterAndRender() {
    const filters = Object.fromEntries(Object.entries(filterElements).map(([key, el]) => [key, el.type === 'checkbox' ? el.checked : el.value]));
    let filteredData = [...allRunners];
    
    // Apply all filters
    if (filters.runner) filteredData = filteredData.filter(r => r.name === filters.runner);
    
    filteredData = filteredData.filter(r =>
        (r.speed || 0) >= filters.speed && (r.stamina || 0) >= filters.stamina &&
        (r.power || 0) >= filters.power && (r.guts || 0) >= filters.guts && (r.wit || 0) >= filters.wit
    );

    // Spark Filters
    if (filters.blueSpark || filters.minBlue > 0) {
        filteredData = filteredData.filter(r => checkSpark(r, 'blue', filters.blueSpark, filters.minBlue, filters.repOnly));
    }
     if (filters.pinkSpark || filters.minPink > 0) {
        filteredData = filteredData.filter(r => checkSpark(r, 'pink', filters.pinkSpark, filters.minPink, filters.repOnly));
    }

    // Aptitude Filters
    if (filters.aptTurf) filteredData = filteredData.filter(r => (APTITUDE_RANK_MAP[r.turf] || -1) >= APTITUDE_RANK_MAP[filters.aptTurf]);
    if (filters.aptDirt) filteredData = filteredData.filter(r => (APTITUDE_RANK_MAP[r.dirt] || -1) >= APTITUDE_RANK_MAP[filters.aptDirt]);
    if (filters.aptMile) filteredData = filteredData.filter(r => (APTITUDE_RANK_MAP[r.mile] || -1) >= APTITUDE_RANK_MAP[filters.aptMile]);
    if (filters.aptLong) filteredData = filteredData.filter(r => (APTITUDE_RANK_MAP[r.long] || -1) >= APTITUDE_RANK_MAP[filters.aptLong]);

    // Apply Sorting
    sortData(filteredData, filters.sort, filters.sortDir);

    // Render based on active tab
    const activeTabId = document.querySelector('.tab-content.active').id;
    if (activeTabId === 'parent-summary') {
        renderParentSummary(filteredData);
    } else {
        renderAptitudeSummary(filteredData);
    }
}

function checkSpark(runner, color, name, minStars, repOnly) {
    const sparkSources = repOnly ? ['parent'] : ['parent', 'gp1', 'gp2'];
    let sparksToCheck = [];
    sparkSources.forEach(source => {
        if (runner.sparks && runner.sparks[source]) {
            sparksToCheck.push(...runner.sparks[source]);
        }
    });

    const relevantSparks = sparksToCheck.filter(s => s.color === color);
    if (!name) { // If no specific spark name, check if ANY spark of that color meets the min star count
        return relevantSparks.some(s => s.count >= minStars);
    }

    const totalStars = relevantSparks
        .filter(s => s.spark_name === name)
        .reduce((sum, s) => sum + s.count, 0);
    
    return totalStars >= minStars;
}

function sortData(data, sortBy, sortDir) {
    data.sort((a, b) => {
        let valA, valB;
        if (sortBy === 'whites') {
            valA = (a.sparks?.parent || []).filter(s => s.color === 'white').length;
            valB = (b.sparks?.parent || []).filter(s => s.color === 'white').length;
        } else if (APTITUDE_RANK_MAP[a[sortBy]] !== undefined) {
             valA = APTITUDE_RANK_MAP[a[sortBy]] || -1;
             valB = APTITUDE_RANK_MAP[b[sortBy]] || -1;
        }else {
            valA = a[sortBy] || (sortBy === 'name' ? '' : 0);
            valB = b[sortBy] || (sortBy === 'name' ? '' : 0);
        }

        if (typeof valA === 'string') {
            return sortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        } else {
            return sortDir === 'asc' ? valA - valB : valB - valA;
        }
    });
}

// --- Rendering ---
function renderParentSummary(runners) {
    if (!runners.length) {
        parentSummaryBody.innerHTML = '<tr><td colspan="7">No runners found.</td></tr>';
        return;
    }
    const html = runners.map(r => `
        <tr>
            <td class="left-align"><span class="outline-label">${r.name}</span></td>
            <td>${r.score.toLocaleString()}</td>
            <td class="stats">${r.speed}/${r.stamina}/${r.power}/${r.guts}/${r.wit}</td>
            <td class="left-align">${formatSparks(r, 'blue')}</td>
            <td class="left-align">${formatSparks(r, 'pink')}</td>
            <td>${(r.sparks?.parent || []).filter(s => s.color === 'white').length}</td>
            <td class="left-align">${r.gp1 || 'N/A'}<br>${r.gp2 || 'N/A'}</td>
        </tr>
    `).join('');
    parentSummaryBody.innerHTML = html;
}

function renderAptitudeSummary(runners) {
    if (!runners.length) {
        aptitudeSummaryBody.innerHTML = '<tr><td colspan="13">No runners found.</td></tr>';
        return;
    }
     const html = runners.map(r => `
        <tr>
            <td class="left-align"><span class="outline-label">${r.name}</span></td>
            <td>${r.score.toLocaleString()}</td>
            <td class="stats">${r.speed}/${r.stamina}/${r.power}/${r.guts}/${r.wit}</td>
            ${['turf', 'dirt', 'sprint', 'mile', 'medium', 'long', 'front', 'pace', 'late', 'end']
                .map(apt => `<td class="aptitude aptitude-${r[apt]}">${r[apt] || 'G'}</td>`).join('')}
        </tr>
    `).join('');
    aptitudeSummaryBody.innerHTML = html;
}

function formatSparks(runner, color) {
    const sparks = {};
    ['parent', 'gp1', 'gp2'].forEach(source => {
        (runner.sparks?.[source] || []).forEach(spark => {
            if (spark.color === color) {
                sparks[spark.spark_name] = (sparks[spark.spark_name] || 0) + spark.count;
            }
        });
    });
    return Object.entries(sparks).map(([name, count]) => `${name} ${count}★`).join(', ') || 'N/A';
}