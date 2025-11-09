// scripts/main.js
import { state } from './state.js';
import { handleFileLoad, handleTestFileLoad, loadFromSavedData, extractSparkNames } from './data-loader.js';
import { filterAndRender } from './filter.js';
import { handleTabChange } from './ui-interactions.js';
import { 
    setupEventListeners, setupDarkMode, createSearchableSelect, updateSparkCountDropdown, 
    updateTotalWhiteDropdown, updateSelectPlaceholder
} from './ui-interactions.js';

// --- App Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    // Initial element references
    state.elements.uploaderContainer = document.getElementById('uploader-container');
    state.elements.fileInput = document.getElementById('file-input');
    state.elements.loadDataButton = document.getElementById('load-data-button');
    state.elements.loadingMessage = document.getElementById('loading-message');
    state.elements.errorMessage = document.getElementById('error-message');
    state.elements.appWrapper = document.getElementById('app-wrapper');
    const loadTestDataButton = document.getElementById('load-test-data-button');

    setupDarkMode(); 

    state.elements.loadDataButton.addEventListener('click', handleFileLoad);
    loadTestDataButton.addEventListener('click', handleTestFileLoad);

    const savedData = localStorage.getItem('savedRunnerData');
    if (savedData) {
        console.log("Found saved data, attempting to load...");
        setTimeout(() => {
            loadFromSavedData(savedData);
        }, 100);
    } 
});

export function showError(message) {
    state.elements.loadingMessage.style.display = 'none';
    state.elements.errorMessage.innerHTML = message;
    state.elements.errorMessage.style.display = 'block';
}

export function initializeApp() {
    // Get all necessary element references for the main app
    state.elements.filterElements = {
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
    state.elements.tabButtons = document.querySelectorAll('.tab-button');
    state.elements.tabContents = document.querySelectorAll('.tab-content');
    state.elements.parentSummaryBody = document.getElementById('parent-summary-body');
    state.elements.whiteSparksBody = document.getElementById('white-sparks-body');
    state.elements.skillsSummaryBody = document.getElementById('skills-summary-body');
    state.elements.legaciesPlannerBody = document.getElementById('legacies-planner-content');
    state.elements.grandparentAnalysisBody = document.getElementById('grandparent-summary-body');
    state.elements.inheritanceLogBody = document.getElementById('inheritance-log-content');
    state.elements.resetFiltersButton = document.getElementById('reset-filters-button');
    state.elements.addSparkFilterButton = document.getElementById('add-spark-filter-button');
    state.elements.sparkFiltersContainer = document.getElementById('spark-filters-container');
    state.elements.skillFiltersContainer = document.getElementById('skill-filters-container');
    state.elements.addSkillFilterButton = document.getElementById('add-skill-filter-button');
    state.elements.loadNewFileButton = document.getElementById('load-new-file-button');
    state.elements.saveDataButton = document.getElementById('save-data-button');
    state.elements.lastUpdatedDisplay = document.getElementById('last-updated-display'); 
    state.elements.entriesDisplay = document.getElementById('entries-display');

    if (!state.allRunners || state.allRunners.length === 0) {
        const noDataMsg = '<tr><td colspan="18">No runner data found.</td></tr>';
        [state.elements.parentSummaryBody, state.elements.whiteSparksBody, state.elements.skillsSummaryBody].forEach(body => body.innerHTML = noDataMsg);
        return;
    }

    // Process loaded data
    state.allRunners.forEach(runner => {
        if (runner.name) state.allRunnerNamesSet.add(runner.name);
        runner.sparks = (typeof runner.sparks === 'string') ? JSON.parse(runner.sparks) : runner.sparks || {};
        runner.skills = (typeof runner.skills === 'string') ? runner.skills.split('|').map(s => s.trim()).filter(s => s) : runner.skills || [];
    });
    
    // Calculate max white sparks for filters
    state.allRunners.forEach(runner => {
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
        if (parentCount > state.maxParentWhiteSparks) state.maxParentWhiteSparks = parentCount;
        if (totalCount > state.maxTotalWhiteSparks) state.maxTotalWhiteSparks = totalCount;
    });

    extractSparkNames();
    populateFilters();
    
    const firstSkillRow = document.querySelector('.skill-filters');
    if (firstSkillRow) {
        createSearchableSelect(firstSkillRow.querySelector('.skill-name-input'), state.orderedSkills);
    }
    
    setupEventListeners();
    handleTabChange('parent-summary');

    state.elements.uploaderContainer.style.display = 'none';
    state.elements.appWrapper.style.display = 'flex';

    state.elements.loadNewFileButton.addEventListener('click', returnToFileUploader);

    updateLastUpdated();
    updateEntriesCount();
    preloadRunnerImages(); 
}

function populateFilters() {
    const runnerNames = [...state.allRunnerNamesSet].sort();
    state.elements.filterElements.runner.innerHTML = '<option value="">All Runners</option>' + runnerNames.map(n => `<option value="${n}">${n}</option>`).join('');

    const currentSort = state.elements.filterElements.sort.value || 'score';
    const allSortOptions = [
        'score', 'name', 'speed', 'stamina', 'power', 'guts', 'wit', 
        'whites (total)', 'whites (parent)', 'whites (gp1)', 'whites (gp2)'
    ];

    state.elements.filterElements.sort.innerHTML = allSortOptions.map(o => {
        const label = o.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        return `<option value="${o}">${label}</option>`;
    }).join('');
    
    state.elements.filterElements.sort.value = allSortOptions.includes(currentSort) ? currentSort : 'score';

    const firstSparkRow = document.querySelector('.spark-filters');
    createSearchableSelect(firstSparkRow.querySelector('#filter-blue-spark'), state.blueSparkNames);
    createSearchableSelect(firstSparkRow.querySelector('#filter-green-spark'), state.greenSparkNames);
    createSearchableSelect(firstSparkRow.querySelector('#filter-pink-spark'), state.pinkSparkNames);
    createSearchableSelect(firstSparkRow.querySelector('#filter-white-spark'), state.whiteSparkNames);

    updateSparkCountDropdown(firstSparkRow.querySelector('#min-blue'), 9);
    updateSparkCountDropdown(firstSparkRow.querySelector('#min-green'), 3);
    updateSparkCountDropdown(firstSparkRow.querySelector('#min-pink'), 9);
    updateSparkCountDropdown(firstSparkRow.querySelector('#min-white'), 9);
    updateTotalWhiteDropdown(firstSparkRow, false);
    
    let totalWhiteSparkOptions = '';
    for (let i = 1; i <= state.maxTotalWhiteSparks; i++) { totalWhiteSparkOptions += `<option value="${i}">${i}</option>`; }
    firstSparkRow.querySelector('#min-total-white').innerHTML = '<option value="0"></option>' + totalWhiteSparkOptions;

    const aptGrades = ['S', 'A', 'B', 'C', 'D'];
    const aptGradeOptions = aptGrades.map(g => `<option value="${g}">${g !== 'S' ? g + '+' : g}</option>`).join('');
    
    Object.values(state.elements.filterElements)
    .filter(el => el.id.startsWith('apt-min-'))
    .forEach(sel => {
        sel.innerHTML += aptGradeOptions;
    });

    document.querySelectorAll('.aptitude-select').forEach(updateSelectPlaceholder);
    state.elements.filterElements.sortDir.value = 'desc';
}

function preloadRunnerImages() {
    const preloadedImages = new Set();
    
    state.allRunners.forEach(runner => {
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
}

export function returnToFileUploader() {
    if (!window.confirm("Are you sure you want to load a new file?\n\nThis will clear the current data.")) {
        return; 
    }

    localStorage.removeItem('savedRunnerData');

    // Reset state
    state.allRunners = [];
    state.blueSparkNames = [];
    state.greenSparkNames = [];
    state.pinkSparkNames = [];
    state.whiteSparkNames = [];
    state.skillData = {};
    state.orderedSkills = [];
    state.allRunnerNamesSet.clear();
    state.gpExistenceCache.clear();

    state.elements.appWrapper.style.display = 'none';
    state.elements.uploaderContainer.style.display = 'flex';
    state.elements.fileInput.value = '';

    state.elements.errorMessage.style.display = 'none';
    state.elements.loadingMessage.style.display = 'none';
    if (state.elements.entriesDisplay) state.elements.entriesDisplay.textContent = '';
}

export function saveDataToFile() {
    try {
        const jsonData = JSON.stringify(state.allRunners, null, 2);
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'all_runners.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (err) {
        console.error("Failed to save data:", err);
    }
}

export function lastUpdated() {
    if (!state.allRunners || state.allRunners.length === 0) {
    return "No data loaded";
  }

  let latestDate = null;
  let currentDateCount = 0;

  try {
    for (const runner of state.allRunners) {
      if (runner.last_updated) {
        const currentDate = new Date(runner.last_updated);

        if (!latestDate || currentDate > latestDate) {
          latestDate = currentDate;
          currentDateCount = 1;
        }
        else if (currentDate.getTime() === latestDate.getTime()) {
          currentDateCount++;
        }
      }
    }

    const h = String(latestDate.getHours()).padStart(2, '0');
    const m = String(latestDate.getMinutes()).padStart(2, '0');
    const period = String(Number(h) >= 12 ? 'PM' : 'AM');
    const dd = String(latestDate.getDate()).padStart(2, '0');
    const mm = String(latestDate.getMonth() + 1).padStart(2, '0');
    const yyyy = latestDate.getFullYear();

    return `${h}:${m}${period} ${dd}/${mm}/${yyyy}, ${currentDateCount} added/updated`;

  } catch (error) {
    console.error("Error in lastUpdated function:", error);
    return "Error parsing dates";
  }
}

export function updateLastUpdated() {
    if (state.elements.lastUpdatedDisplay) {
        state.elements.lastUpdatedDisplay.textContent = `Last Updated: ${lastUpdated()}`;
    }
}

export function updateEntriesCount() {
    if (state.elements.entriesDisplay) {
        state.elements.entriesDisplay.textContent = `Entries count: ${state.allRunners.length}/230`;
    }
}