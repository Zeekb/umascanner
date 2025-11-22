// ui-interactions.js - Manages all user interactions with the UI, including setting up event listeners, handling dynamic UI updates, and managing dark mode.

import { state } from './state.js';
import { debounce, findRunnerByDetails, showTimedMessage, cleanName, createSearchableSelect, loadCollections } from './utils.js';
import { showChangeLogModal } from './change-log.js';
import { setupBulkActions } from './bulk-actions.js';
import { filterAndRender, sortAndRender } from './filter.js';
import { showDetailModal, resetTabSpecificFilters, resetCareerPlannerParents } from './ui-renderer.js';
import { returnToFileUploader, saveDataToFile, updateEntriesCount } from './main.js';
import { UI_MODES, setMode, toggleSetting, applySettings } from './ui-settings.js';

// Helper to load saved setups from local storage
function loadSavedSetups() {
    const stored = localStorage.getItem('savedParentSetups');
    if (stored) {
        try {
            state.savedParentSetups = JSON.parse(stored);
        } catch (e) {
            console.error("Failed to parse saved parent setups", e);
            state.savedParentSetups = [];
        }
    }
    updateSavedSetupsDropdown();
}

// Helper to update the dropdown UI
function updateSavedSetupsDropdown() {
    const select = document.getElementById('saved-setups-select');
    if (!select) return;

    const currentValue = select.value;
    select.innerHTML = '<option value="">Load Saved Setup...</option>';
    
    state.savedParentSetups.forEach((setup, index) => {
        const option = document.createElement('option');
        option.value = index; // Use index as ID for simplicity
        option.textContent = setup.name;
        select.appendChild(option);
    });

    // Restore selection if it still exists (and name matches, ideally ID based but index is ok for simple list)
    if (currentValue !== "" && state.savedParentSetups[currentValue]) {
        select.value = currentValue;
    }
}

// Helper to load filter presets from localStorage
function loadFilterPresets() {
    const stored = localStorage.getItem('filterPresets');
    if (stored) {
        try {
            state.filterPresets = JSON.parse(stored);
        } catch (e) {
            console.error("Failed to parse filter presets", e);
            state.filterPresets = [];
        }
    }
    updateFilterPresetsDropdown();
}

// Helper to update filter presets dropdown
function updateFilterPresetsDropdown() {
    const select = document.getElementById('filter-presets-select');
    if (!select) return;

    const currentValue = select.value;
    select.innerHTML = '<option value="">Load Filter...</option>';
    
    state.filterPresets.forEach((preset, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = preset.name;
        select.appendChild(option);
    });

    if (currentValue !== "" && state.filterPresets[currentValue]) {
        select.value = currentValue;
    }
}

// Capture current filter state
function captureFilterState() {
    const filterState = {
        runner: state.elements.filterElements.runner.value,
        tags: state.elements.filterElements.tags ? state.elements.filterElements.tags.value : '',
        sort: state.elements.filterElements.sort.value,
        sortDir: state.elements.filterElements.sortDir.value,
        stats: {
            speed: state.elements.filterElements.speed.value,
            stamina: state.elements.filterElements.stamina.value,
            power: state.elements.filterElements.power.value,
            guts: state.elements.filterElements.guts.value,
            wit: state.elements.filterElements.wit.value
        },
        aptitudes: {
            turf: state.elements.filterElements.aptMinTurf.value,
            dirt: state.elements.filterElements.aptMinDirt.value,
            sprint: state.elements.filterElements.aptMinSprint.value,
            mile: state.elements.filterElements.aptMinMile.value,
            medium: state.elements.filterElements.aptMinMedium.value,
            long: state.elements.filterElements.aptMinLong.value,
            front: state.elements.filterElements.aptMinFront.value,
            pace: state.elements.filterElements.aptMinPace.value,
            late: state.elements.filterElements.aptMinLate.value,
            end: state.elements.filterElements.aptMinEnd.value
        },
        skills: [],
        sparks: [],
        showParentSparksOnly: state.showParentSparksOnly,
        showParentSparksOnly: state.showParentSparksOnly,
        skillCategoryFilter: state.skillCategoryFilter,
        globalSearch: document.getElementById('global-search-input')?.value || ''
    };

    // Capture skills
    document.querySelectorAll('#skill-filters-container .skill-name-input').forEach(input => {
        if (input.value) {
            filterState.skills.push(input.value);
        }
    });

    // Capture spark filters
    document.querySelectorAll('#spark-filters-container .spark-filters').forEach(row => {
        const sparkFilter = {
            repOnly: row.querySelector('.rep-only-checkbox').checked,
            disabled: row.classList.contains('disabled'),
            blue: row.querySelector('[id^="filter-blue-spark"]').value,
            minBlue: row.querySelector('[id^="min-blue"]').value,
            pink: row.querySelector('[id^="filter-pink-spark"]').value,
            minPink: row.querySelector('[id^="min-pink"]').value,
            green: row.querySelector('[id^="filter-green-spark"]').value,
            minGreen: row.querySelector('[id^="min-green"]').value,
            white: row.querySelector('[id^="filter-white-spark"]').value,
            minWhite: row.querySelector('[id^="min-white"]').value,
            minTotalWhite: row.querySelector('[id^="min-total-white"]').value
        };
        filterState.sparks.push(sparkFilter);
    });

    return filterState;
}

// Apply saved filter state
function applyFilterState(filterState) {
    // Apply basic filters
    state.elements.filterElements.runner.value = filterState.runner || '';
    if (state.elements.filterElements.tags) state.elements.filterElements.tags.value = filterState.tags || '';
    state.elements.filterElements.sort.value = filterState.sort || 'score';
    state.elements.filterElements.sortDir.value = filterState.sortDir || 'desc';

    // Apply stats
    ['speed', 'stamina', 'power', 'guts', 'wit'].forEach(stat => {
        const value = filterState.stats?.[stat] || 0;
        state.elements.filterElements[stat].value = value;
        document.getElementById(`val-${stat}`).value = value;
    });

    // Apply aptitudes
    const aptMap = {
        turf: 'aptMinTurf', dirt: 'aptMinDirt', sprint: 'aptMinSprint',
        mile: 'aptMinMile', medium: 'aptMinMedium', long: 'aptMinLong',
        front: 'aptMinFront', pace: 'aptMinPace', late: 'aptMinLate', end: 'aptMinEnd'
    };
    Object.keys(aptMap).forEach(key => {
        state.elements.filterElements[aptMap[key]].value = filterState.aptitudes?.[key] || '';
    });

    // Apply toggles
    state.showParentSparksOnly = filterState.showParentSparksOnly || false;
    state.skillCategoryFilter = filterState.skillCategoryFilter || 'all';

    // Update toggle buttons
    const whiteSparksToggle = document.getElementById('white-sparks-parent-only-toggle');
    const overviewToggle = document.getElementById('overview-sparks-parent-only-toggle');
    const skillsFilter = document.getElementById('skills-category-filter');
    
    if (whiteSparksToggle) {
        whiteSparksToggle.textContent = state.showParentSparksOnly ? '[Parent Only]' : '[All Sparks]';
        whiteSparksToggle.classList.toggle('active', state.showParentSparksOnly);
    }
    if (overviewToggle) {
        overviewToggle.textContent = state.showParentSparksOnly ? '[Parent Only]' : '[All Sparks]';
        overviewToggle.classList.toggle('active', state.showParentSparksOnly);
    }
    if (skillsFilter) {
        const categoryLabels = {
            'all': 'All', 'recovery': 'Recovery', 'passive': 'Passive',
            'speed': 'Speed+',
            'debuff': 'Debuff', 'detrimental': 'Detrimental'
        };
        skillsFilter.textContent = `[${categoryLabels[state.skillCategoryFilter]}]`;
        skillsFilter.classList.toggle('active', state.skillCategoryFilter !== 'all');
        
        skillsFilter.classList.remove('skill-recovery', 'skill-passive', 'skill-speed', 'skill-debuff', 'skill-detrimental');
        if (state.skillCategoryFilter !== 'all') {
            skillsFilter.classList.add(`skill-${state.skillCategoryFilter}`);
        }
    }

    // Apply global search
    const globalSearchInput = document.getElementById('global-search-input');
    if (globalSearchInput) {
        globalSearchInput.value = filterState.globalSearch || '';
    }

    // Apply Skills
    const skillContainer = state.elements.skillFiltersContainer;
    const skillRows = skillContainer.querySelectorAll('.skill-filters');
    skillRows.forEach((row, index) => {
        if (index > 0) row.remove();
        else row.querySelector('.skill-name-input').value = '';
    });
    updateRemoveSkillButtonVisibility();

    if (filterState.skills && filterState.skills.length > 0) {
        filterState.skills.forEach((skillName, index) => {
            if (index === 0) {
                const firstInput = skillContainer.querySelector('.skill-name-input');
                if (firstInput) firstInput.value = skillName;
            } else {
                addSkillFilterRow();
                const newRows = skillContainer.querySelectorAll('.skill-filters');
                const lastRow = newRows[newRows.length - 1];
                const input = lastRow.querySelector('.skill-name-input');
                if (input) input.value = skillName;
            }
        });
    }

    // Apply Sparks
    const sparkContainer = state.elements.sparkFiltersContainer;
    const sparkRows = sparkContainer.querySelectorAll('.spark-filters');
    sparkRows.forEach((row, index) => {
        if (index > 0) row.remove();
        else {
            // Reset first row
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

    if (filterState.sparks && filterState.sparks.length > 0) {
        filterState.sparks.forEach((sparkFilter, index) => {
            let targetRow;
            if (index === 0) {
                targetRow = sparkContainer.querySelector('.spark-filters');
            } else {
                addSparkFilterRow();
                const newRows = sparkContainer.querySelectorAll('.spark-filters');
                targetRow = newRows[newRows.length - 1];
            }

            if (targetRow) {
                targetRow.querySelector('.rep-only-checkbox').checked = sparkFilter.repOnly;
                if (sparkFilter.disabled) {
                    targetRow.classList.add('disabled');
                    const disableBtn = targetRow.querySelector('.disable-spark-filter-button');
                    if (disableBtn) {
                        disableBtn.textContent = '✕';
                        disableBtn.title = 'Enable this filter row';
                    }
                }
                
                targetRow.querySelector('[id^="filter-blue-spark"]').value = sparkFilter.blue;
                targetRow.querySelector('[id^="min-blue"]').value = sparkFilter.minBlue;
                targetRow.querySelector('[id^="filter-pink-spark"]').value = sparkFilter.pink;
                targetRow.querySelector('[id^="min-pink"]').value = sparkFilter.minPink;
                targetRow.querySelector('[id^="filter-green-spark"]').value = sparkFilter.green;
                targetRow.querySelector('[id^="min-green"]').value = sparkFilter.minGreen;
                targetRow.querySelector('[id^="filter-white-spark"]').value = sparkFilter.white;
                targetRow.querySelector('[id^="min-white"]').value = sparkFilter.minWhite;
                targetRow.querySelector('[id^="min-total-white"]').value = sparkFilter.minTotalWhite;
            }
        });
    }
    
    filterAndRender();
}



// Sets up all global event listeners for UI interactions.
export function setupEventListeners() {
    loadSavedSetups(); // Initialize saved setups on load
    loadFilterPresets(); // Initialize filter presets on load
    loadCollections(); // Initialize collections on load
    setupBulkActions(); // Initialize bulk actions

    const changeLogBtn = document.getElementById('change-log-button');
    if (changeLogBtn) {
        changeLogBtn.addEventListener('click', showChangeLogModal);
    }

    // --- Career Planner Save/Load Logic ---

    const saveSetupBtn = document.getElementById('save-setup-button');
    const setupNameInput = document.getElementById('setup-name-input');
    const savedSetupsSelect = document.getElementById('saved-setups-select');
    const deleteSetupBtn = document.getElementById('delete-setup-button');
    const overwriteSetupBtn = document.getElementById('overwrite-setup-button');

    // SAVE NEW
    if (saveSetupBtn) {
        saveSetupBtn.addEventListener('click', () => {
            const parent1Select = document.querySelector('#career-planner-parent1-selection .runner-entry-select');
            const parent2Select = document.querySelector('#career-planner-parent2-selection .runner-entry-select');
            const affinityInput = document.getElementById('affinity-number-input');
            
            const p1 = parent1Select ? parent1Select.value : "";
            const p2 = parent2Select ? parent2Select.value : "";
            const aff = affinityInput ? affinityInput.value : 150;
            const name = setupNameInput.value.trim();

            if (!p1 && !p2) {
                showTimedMessage("Select at least one parent.");
                return;
            }
            if (!name) {
                showTimedMessage("Enter a name.");
                return;
            }

            // Always create new
            state.savedParentSetups.push({
                name: name,
                parent1Id: p1,
                parent2Id: p2,
                affinity: aff
            });

            localStorage.setItem('savedParentSetups', JSON.stringify(state.savedParentSetups));
            updateSavedSetupsDropdown();
            // Select the new item (last one)
            savedSetupsSelect.value = state.savedParentSetups.length - 1;
            
            showTimedMessage("Saved as new setup!");
        });
    }

    // OVERWRITE (formerly Rename)
    if (overwriteSetupBtn) {
        overwriteSetupBtn.addEventListener('click', () => {
            const index = savedSetupsSelect.value;
            if (index === "") {
                showTimedMessage("Select a setup to overwrite.");
                return;
            }

            const parent1Select = document.querySelector('#career-planner-parent1-selection .runner-entry-select');
            const parent2Select = document.querySelector('#career-planner-parent2-selection .runner-entry-select');
            const affinityInput = document.getElementById('affinity-number-input');
            
            const p1 = parent1Select ? parent1Select.value : "";
            const p2 = parent2Select ? parent2Select.value : "";
            const aff = affinityInput ? affinityInput.value : 150;
            const name = setupNameInput.value.trim();

            if (!name) {
                showTimedMessage("Setup name cannot be empty.");
                return;
            }

            if (confirm(`Overwrite "${state.savedParentSetups[index].name}" with current settings?`)) {
                state.savedParentSetups[index] = {
                    name: name,
                    parent1Id: p1,
                    parent2Id: p2,
                    affinity: aff
                };
                localStorage.setItem('savedParentSetups', JSON.stringify(state.savedParentSetups));
                updateSavedSetupsDropdown();
                savedSetupsSelect.value = index; // Keep selected
                showTimedMessage("Setup overwritten!");
            }
        });
    }

    // LOAD
    if (savedSetupsSelect) {
        savedSetupsSelect.addEventListener('change', () => {
            const index = savedSetupsSelect.value;

            if (index === "") {
                resetCareerPlannerParents();
                setupNameInput.value = "";
                return;
            }

            const setup = state.savedParentSetups[index];
            if (!setup) return;

            // 1. Set Affinity
            const affinitySlider = document.getElementById('affinity-slider');
            const affinityNumber = document.getElementById('affinity-number-input');
            const affinitySelect = document.getElementById('affinity-selection');
            
            if (affinityNumber) {
                affinityNumber.value = setup.affinity;
                affinityNumber.dispatchEvent(new Event('input'));
                affinityNumber.dispatchEvent(new Event('change')); // Triggers slider/select updates in other listener
            }

            // 2. Set Parents
            // We need to find the runners first to set the name dropdowns, then the entry dropdowns
            const p1Runner = state.allRunners.find(r => String(r.entry_id) === String(setup.parent1Id));
            const p2Runner = state.allRunners.find(r => String(r.entry_id) === String(setup.parent2Id));

            const p1NameSelect = document.querySelector('#career-planner-parent1-selection .runner-name-select');
            const p1EntrySelect = document.querySelector('#career-planner-parent1-selection .runner-entry-select');
            
            const p2NameSelect = document.querySelector('#career-planner-parent2-selection .runner-name-select');
            const p2EntrySelect = document.querySelector('#career-planner-parent2-selection .runner-entry-select');

            // Helper to set a parent set
            const setParent = (runner, nameSel, entrySel) => {
                if (runner && nameSel && entrySel) {
                    nameSel.value = runner.name;
                    nameSel.dispatchEvent(new Event('change')); // Populates entry select
                    entrySel.value = runner.entry_id;
                    entrySel.dispatchEvent(new Event('change')); // Triggers details rendering
                } else if (nameSel && entrySel) {
                    nameSel.value = "";
                    entrySel.style.display = 'none';
                    entrySel.value = "";
                    // Clear details manually or via event if needed, usually change event handles it
                    nameSel.dispatchEvent(new Event('change'));
                }
            };

            setParent(p1Runner, p1NameSelect, p1EntrySelect);
            setParent(p2Runner, p2NameSelect, p2EntrySelect);

            // Populate input name
            setupNameInput.value = setup.name;
        });
    }

    // CLEAR (Updated to reset dropdown)
    const clearParentsButton = document.getElementById('clear-parent-selections');
    if(clearParentsButton) {
        clearParentsButton.addEventListener('click', () => {
            resetCareerPlannerParents();
            if (savedSetupsSelect) savedSetupsSelect.value = "";
            if (setupNameInput) setupNameInput.value = "";
        });
    }

    // DELETE
    if (deleteSetupBtn) {
        deleteSetupBtn.addEventListener('click', () => {
            const index = savedSetupsSelect.value;
            if (index === "") {
                showTimedMessage("Select a setup to delete.");
                return;
            }
            
            const setupName = state.savedParentSetups[index].name;
            if(confirm(`Delete saved setup "${setupName}"?`)) {
                state.savedParentSetups.splice(index, 1);
                localStorage.setItem('savedParentSetups', JSON.stringify(state.savedParentSetups));
                updateSavedSetupsDropdown();
                setupNameInput.value = "";
                showTimedMessage("Setup deleted.");
            }
        });
    }

    const debouncedFilterAndRender = debounce(filterAndRender, 150);

    const debouncedSortAndRender = debounce(sortAndRender, 50);

    const handleSelectWheelScroll = (event) => {
        const select = event.currentTarget;
        if (document.activeElement === select) {
            event.stopPropagation();
            return;
        }
        
        event.preventDefault(); 
        event.stopPropagation()
        
        let newIndex = select.selectedIndex;
        
        if (event.deltaY < 0) { 
            newIndex = Math.max(0, newIndex - 1);
        } else { 
            newIndex = Math.min(select.options.length - 1, newIndex + 1);
        }
        
        if (select.selectedIndex !== newIndex) {
            select.selectedIndex = newIndex;
            select.dispatchEvent(new Event('change', { bubbles: true }));
        }
    };

    Object.values(state.elements.filterElements).forEach(el => {
        if (el.id === 'filter-sort' || el.id === 'filter-sort-direction') {
            el.addEventListener('change', debouncedSortAndRender); 
        } else {
            if (el.type !== 'range') el.addEventListener('change', filterAndRender);
        }
        if (el.tagName === 'SELECT') {
            el.addEventListener('wheel', handleSelectWheelScroll, { passive: false });
        }
    });

    document.querySelectorAll('.aptitude-select').forEach(sel => {
        sel.addEventListener('change', () => updateSelectPlaceholder(sel));
    });

    state.elements.skillFiltersContainer.addEventListener('input', (event) => {
        if (event.target.classList.contains('skill-name-input')) {
            debouncedFilterAndRender();
        }
    });
    
    state.elements.sparkFiltersContainer.addEventListener('input', (event) => {
        if (event.target.classList.contains('spark-search-input')) {
            debouncedFilterAndRender();
        }
    });

    state.elements.sparkFiltersContainer.addEventListener('change', (event) => {
        if (event.target.classList.contains('rep-only-checkbox')) {
            const row = event.target.closest('.spark-filters');
            if (row) {
                const isParentOnly = event.target.checked;
                const maxStars = isParentOnly ? 3 : 9;

                updateSparkCountDropdown(row.querySelector('[id^="min-blue"]'), maxStars);
                updateSparkCountDropdown(row.querySelector('[id^="min-green"]'), 3);
                updateSparkCountDropdown(row.querySelector('[id^="min-pink"]'), maxStars);
                updateSparkCountDropdown(row.querySelector('[id^="min-white"]'), maxStars);
                updateTotalWhiteDropdown(row, isParentOnly);
            }
        }
        filterAndRender();
    });

    state.elements.sparkFiltersContainer.addEventListener('wheel', (event) => {
        if (event.target.classList.contains('min-spark-select') || event.target.classList.contains('spark-count-select')) {
            handleSelectWheelScroll(event);
        }
    }, { passive: false });

    state.elements.sparkFiltersContainer.addEventListener('wheel', (event) => {
        if (event.target.classList.contains('min-spark-select') || event.target.classList.contains('spark-count-select')) {
            handleSelectWheelScroll(event);
        }
    }, { passive: false });

    // Global Search Input
    // Global Search Input
    const globalSearchInput = document.getElementById('global-search-input');
    if (globalSearchInput) {
        globalSearchInput.addEventListener('input', debouncedFilterAndRender);
    }

    if (state.elements.filterElements.runner) {
        state.elements.filterElements.runner.addEventListener('change', filterAndRender);
    }

    if (state.elements.filterElements.collection) {
        state.elements.filterElements.collection.addEventListener('change', filterAndRender);
    }

    // Tags Filter Input
    if (state.elements.filterElements.tags) {
        state.elements.filterElements.tags.addEventListener('input', debouncedFilterAndRender);
        // Initialize autocomplete for filter
        createSearchableSelect(state.elements.filterElements.tags, Array.from(state.allTags).sort(), () => {
            filterAndRender();
        });
        
        // Update autocomplete options when tags change (using a custom event or just re-init when needed)
        // For now, we can re-init on focus to get latest tags
        state.elements.filterElements.tags.addEventListener('focus', () => {
            createSearchableSelect(state.elements.filterElements.tags, Array.from(state.allTags).sort(), () => {
                filterAndRender();
            });
        });
    }

    state.elements.skillFiltersContainer.addEventListener('click', (event) => {
        if (event.target.classList.contains('remove-skill-filter-button')) {
            event.target.closest('.skill-filters').remove();
            updateRemoveSkillButtonVisibility();
            filterAndRender();
        }
    });

    ['speed', 'stamina', 'power', 'guts', 'wit'].forEach(stat => {
        const slider = state.elements.filterElements[stat];
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

    state.elements.tabButtons.forEach(button => button.addEventListener('click', () => handleTabChange(button.dataset.tab)));
    state.elements.resetFiltersButton.addEventListener('click', resetFilters);
    
    const toggleFilterButton = document.getElementById('toggle-filter-panel');
    const filterPanel = document.querySelector('.filter-panel');

    if (toggleFilterButton && filterPanel) {
        toggleFilterButton.addEventListener('click', () => {
            const isCollapsed = filterPanel.classList.toggle('collapsed');
            toggleFilterButton.textContent = isCollapsed ? '+' : '−';
            toggleFilterButton.title = isCollapsed ? 'Show Filters' : 'Collapse Filters';
        });
    }
    state.elements.addSparkFilterButton.addEventListener('click', addSparkFilterRow);
    state.elements.addSkillFilterButton.addEventListener('click', addSkillFilterRow);

    state.elements.sparkFiltersContainer.addEventListener('click', (event) => {
        const target = event.target;
        const row = target.closest('.spark-filters');
        if (!row) return;

        if (target.classList.contains('remove-spark-filter-button')) {
            row.remove();
            updateRemoveButtonVisibility();
            filterAndRender();
        } else if (target.classList.contains('disable-spark-filter-button')) {
            const isDisabled = row.classList.toggle('disabled');
            target.textContent = isDisabled ? '−' : '+';
            target.title = isDisabled ? 'Enable this filter row' : 'Disable this filter row';
            filterAndRender();
        }
    });
    
    const closeAllDropdowns = () => {
        document.querySelectorAll('.options-container').forEach(container => {
            container.style.display = 'none';
        });
    };

    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.addEventListener('scroll', closeAllDropdowns);
    });

    window.addEventListener('resize', closeAllDropdowns);

    document.addEventListener('click', (e) => {
        const isSearchableSelect = e.target.closest('.searchable-select-container');
        if (!isSearchableSelect) {
            closeAllDropdowns();
        }

        document.querySelectorAll('.options-container').forEach(container => {
            if (!container.parentElement.contains(e.target)) {
                container.style.display = 'none';
            }
        });

        const tableBody = document.getElementById('legacy-summary-body');
        if (tableBody) {
            const descendantListContainer = document.querySelector('.descendant-list');

            if (!e.target.closest('#legacy-summary-body') &&
                (!descendantListContainer || !e.target.closest('.descendant-list')) &&
                !e.target.closest('#detail-modal-overlay')
            ) {
                tableBody.querySelectorAll('tr.selected').forEach(r => r.classList.remove('selected'));

                const descendantList = document.getElementById('descendant-list-body');
                if (descendantList) {
                    descendantList.innerHTML = 'Click a grandparent to see their descendants.';
                }
            }
        }
    });

    state.elements.runnerOverviewBody.addEventListener('click', handleDeleteRunner);

    [state.elements.runnerOverviewBody, state.elements.runnerWhiteSparksBody, state.elements.skillsOverviewBody].forEach(body => {
        body.addEventListener('click', handleDetailView);
    });

    state.elements.saveDataButton.addEventListener('click', saveDataToFile); 



    // Header Toggle Buttons (Event Delegation)
    document.addEventListener('click', (e) => {
        // Overview sparks parent-only toggle
        const overviewToggle = e.target.closest('#overview-sparks-parent-only-toggle');
        if (overviewToggle) {
            state.showParentSparksOnly = !state.showParentSparksOnly;
            
            // Update UI for both toggles
            const toggles = [
                document.getElementById('overview-sparks-parent-only-toggle'),
                document.getElementById('white-sparks-parent-only-toggle')
            ];
            
            toggles.forEach(btn => {
                if (btn) {
                    btn.textContent = state.showParentSparksOnly ? '[Parent Only]' : '[All Sparks]';
                    btn.classList.toggle('active', state.showParentSparksOnly);
                    btn.title = state.showParentSparksOnly 
                        ? 'Toggle: Show all sparks / Parent sparks only (Currently: Parent only)'
                        : 'Toggle: Show all sparks / Parent sparks only (Currently: All sparks)';
                }
            });
            
            filterAndRender();
            return;
        }

        // White sparks parent-only toggle
        const whiteToggle = e.target.closest('#white-sparks-parent-only-toggle');
        if (whiteToggle) {
            state.showParentSparksOnly = !state.showParentSparksOnly;
            
            // Update UI for both toggles
            const toggles = [
                document.getElementById('overview-sparks-parent-only-toggle'),
                document.getElementById('white-sparks-parent-only-toggle')
            ];
            
            toggles.forEach(btn => {
                if (btn) {
                    btn.textContent = state.showParentSparksOnly ? '[Parent Only]' : '[All Sparks]';
                    btn.classList.toggle('active', state.showParentSparksOnly);
                    btn.title = state.showParentSparksOnly 
                        ? 'Toggle: Show all sparks / Parent sparks only (Currently: Parent only)'
                        : 'Toggle: Show all sparks / Parent sparks only (Currently: All sparks)';
                }
            });
            
            filterAndRender();
            return;
        }

        // Skills category filter cycling button
        const skillsFilter = e.target.closest('#skills-category-filter');
        if (skillsFilter) {
            const categories = ['all', 'recovery', 'passive', 'speed', 'debuff', 'detrimental'];
            const categoryLabels = {
                'all': 'All',
                'recovery': 'Recovery',
                'passive': 'Passive',
                'speed': 'Speed+', // Shortened from long list
                'debuff': 'Debuff',
                'detrimental': 'Detrimental'
            };
            
            const currentIndex = categories.indexOf(state.skillCategoryFilter);
            const nextIndex = (currentIndex + 1) % categories.length;
            state.skillCategoryFilter = categories[nextIndex];
            
            skillsFilter.textContent = `[${categoryLabels[state.skillCategoryFilter]}]`;
            skillsFilter.classList.toggle('active', state.skillCategoryFilter !== 'all');

            skillsFilter.classList.remove('skill-recovery', 'skill-passive', 'skill-speed', 'skill-debuff', 'skill-detrimental');
            if (state.skillCategoryFilter !== 'all') {
                skillsFilter.classList.add(`skill-${state.skillCategoryFilter}`);
            }
            
            filterAndRender();
            return;
        }
    });

    // Filter presets - Load preset
    const filterPresetsSelect = document.getElementById('filter-presets-select');
    const presetNameInput = document.getElementById('filter-preset-name-input');
    
    if (filterPresetsSelect) {
        filterPresetsSelect.addEventListener('change', () => {
            const index = filterPresetsSelect.value;
            if (index !== "" && state.filterPresets[index]) {
                applyFilterState(state.filterPresets[index].filterState);
                if (presetNameInput) {
                    presetNameInput.value = state.filterPresets[index].name;
                }
                showTimedMessage(`Loaded preset: ${state.filterPresets[index].name}`);
            }
        });
    }

    // Filter presets - Save new preset
    const savePresetBtn = document.getElementById('save-filter-preset-button');
    if (savePresetBtn && presetNameInput) {
        savePresetBtn.addEventListener('click', () => {
            const name = presetNameInput.value.trim();
            if (!name) {
                showTimedMessage('Please enter a preset name');
                return;
            }
            const preset = {
                name: name,
                filterState: captureFilterState(),
                created: new Date().toISOString()
            };
            state.filterPresets.push(preset);
            localStorage.setItem('filterPresets', JSON.stringify(state.filterPresets));
            updateFilterPresetsDropdown();
            presetNameInput.value = '';
            showTimedMessage(`Saved preset: ${name}`);
        });
    }

    // Filter presets - Overwrite existing preset
    const overwritePresetBtn = document.getElementById('overwrite-filter-preset-button');
    if (overwritePresetBtn && filterPresetsSelect) {
        overwritePresetBtn.addEventListener('click', () => {
            const index = filterPresetsSelect.value;
            if (index === "" || !state.filterPresets[index]) {
                showTimedMessage('Please select a preset to overwrite');
                return;
            }
            const preset = state.filterPresets[index];
            preset.filterState = captureFilterState();
            preset.modified = new Date().toISOString();
            localStorage.setItem('filterPresets', JSON.stringify(state.filterPresets));
            showTimedMessage(`Overwrote preset: ${preset.name}`);
        });
    }

    // Filter presets - Delete preset
    const deletePresetBtn = document.getElementById('delete-filter-preset-button');
    if (deletePresetBtn && filterPresetsSelect) {
        deletePresetBtn.addEventListener('click', () => {
            const index = filterPresetsSelect.value;
            if (index !== "" && state.filterPresets[index]) {
                const presetName = state.filterPresets[index].name;
                state.filterPresets.splice(index, 1);
                localStorage.setItem('filterPresets', JSON.stringify(state.filterPresets));
                updateFilterPresetsDropdown();
                if (presetNameInput) {
                    presetNameInput.value = '';
                }
                showTimedMessage(`Deleted preset: ${presetName}`);
            }
        });
    }

    const legacyContent = document.getElementById('legacy-analysis-content');
    if (legacyContent) {
        legacyContent.addEventListener('click', handleLegacyClick);
    }

    const sparkTracerContent = document.getElementById('spark-tracer-content');
    if (sparkTracerContent) {
        sparkTracerContent.addEventListener('click', handleSparkTracerNodeClick);
    }

    // Global keyboard shortcuts
    const helpMenuBtn = document.getElementById('help-menu-button');
    if (helpMenuBtn) {
        helpMenuBtn.addEventListener('click', showKeyboardShortcutsHelp);
    }

    document.addEventListener('keydown', (e) => {
        // Don't trigger shortcuts when typing in input fields
        const isTyping = e.target.tagName === 'INPUT' || 
                         e.target.tagName === 'TEXTAREA' || 
                         e.target.tagName === 'SELECT' ||
                         e.target.isContentEditable;
        
        if (isTyping && e.key !== 'Escape') return;

        // Tab navigation (1-7)
        if (e.key >= '1' && e.key <= '7' && !e.ctrlKey && !e.altKey && !e.metaKey) {
            const tabs = ['runner-overview', 'runner-white-sparks', 'skills-overview', 
                         'career-planner', 'legacy-analysis', 'spark-tracer', 'useful-links'];
            const tabIndex = parseInt(e.key) - 1;
            if (tabs[tabIndex]) {
                handleTabChange(tabs[tabIndex]);
                e.preventDefault();
            }
        }
        
        // Reset filters (Esc)
        else if (e.key === 'Escape') {
            if (isTyping) {
                e.target.blur(); // Unfocus input fields
            } else {
                resetFilters();
                e.preventDefault();
            }
        }
        
        // Toggle dark mode (D)
        else if (e.key === 'd' || e.key === 'D') {
            const darkModeToggle = document.getElementById('dark-mode-toggle');
            if (darkModeToggle) {
                darkModeToggle.click();
                e.preventDefault();
            }
        }
        
        // Show keyboard shortcuts help (?)
        else if (e.key === '?' || e.key === '/') {
            showKeyboardShortcutsHelp();
            e.preventDefault();
        }
    });

    document.querySelectorAll('#affinity-selection, #spark-select, .runner-select, .min-spark-select, .spark-count-select').forEach(sel => {
        sel.addEventListener('wheel', handleSelectWheelScroll, { passive: false });
    });
    
    updateRemoveButtonVisibility();
    updateRemoveSkillButtonVisibility();

    document.getElementById('career-planner-content').addEventListener('click', (e) => {
        const profileContainer = e.target.closest('.clickable-profile-image');
        if (profileContainer) {
            const entryId = profileContainer.dataset.entryId;
            if (entryId) {
                const runner = state.allRunners.find(r => String(r.entry_id) === entryId);
                if (runner) {
                    showDetailModal(runner);
                }
            }
        }
    });

    document.addEventListener('click', (e) => {
        const target = e.target.closest('.add-filter-click');
        if (target) {
            const type = target.dataset.filterType;
            const value = target.dataset.filterValue;
            const color = target.dataset.filterColor;
            if (type && value) {
                addFilter(type, value, color);
            }
        }
    });
}

// Adds a filter based on type and value.
function addFilter(type, value, color) {
    if (type === 'skill') {
        const existingInputs = Array.from(state.elements.skillFiltersContainer.querySelectorAll('.skill-name-input'));
        const existingInput = existingInputs.find(input => input.value.toLowerCase() === value.toLowerCase());
        
        if (existingInput) {
            existingInput.value = '';
            const row = existingInput.closest('.skill-filters');
            const allRows = state.elements.skillFiltersContainer.querySelectorAll('.skill-filters');
            
            if (allRows.length > 1) {
                row.remove();
                updateRemoveSkillButtonVisibility();
            }
            
            filterAndRender();
            return;
        }

        let emptyInput = existingInputs.find(input => input.value.trim() === '');
        
        if (!emptyInput) {
             addSkillFilterRow();
             const newInputs = Array.from(state.elements.skillFiltersContainer.querySelectorAll('.skill-name-input'));
             emptyInput = newInputs[newInputs.length - 1];
        }

        if (emptyInput) {
            emptyInput.value = value;
            filterAndRender();
        }
    } else if (type === 'spark') {
        const rows = Array.from(state.elements.sparkFiltersContainer.querySelectorAll('.spark-filters'));
        
        // Check if filter already exists
        let existingInput = null;
        for (const row of rows) {
            const inputIdPrefix = `filter-${color}-spark`;
            const input = row.querySelector(`[id^="${inputIdPrefix}"]`);
            if (input && input.value.toLowerCase() === value.toLowerCase()) {
                existingInput = input;
                break;
            }
        }

        if (existingInput) {
            existingInput.value = '';
            const row = existingInput.closest('.spark-filters');
            
            // Reset the count dropdown for this color
            const countSelect = row.querySelector(`[id^="min-${color}"]`);
            if (countSelect) {
                countSelect.selectedIndex = 0;
            }

            // Check if row is completely empty
            const inputs = Array.from(row.querySelectorAll('input[type="text"]'));
            const isRowEmpty = inputs.every(input => input.value.trim() === '');
            
            if (isRowEmpty && rows.length > 1) {
                row.remove();
                updateRemoveButtonVisibility();
            }

            filterAndRender();
            return;
        }

        let targetRow = rows.find(row => {
            const inputs = Array.from(row.querySelectorAll('input[type="text"]'));
            return inputs.every(input => input.value.trim() === '');
        });

        if (!targetRow) {
            addSparkFilterRow();
            const newRows = state.elements.sparkFiltersContainer.querySelectorAll('.spark-filters');
            targetRow = newRows[newRows.length - 1];
        }

        if (targetRow && color) {
            const inputIdPrefix = `filter-${color}-spark`;
            const input = targetRow.querySelector(`[id^="${inputIdPrefix}"]`);
            
            if (input) {
                input.value = value;
                input.dispatchEvent(new Event('change', { bubbles: true }));
                filterAndRender();
            }
        }
    }
}

export function isDarkModeActive() {
    return document.body.classList.contains('dark-mode');
}

// Initializes and toggles dark mode functionality.
export function setupDarkMode() {
    const isDarkMode = localStorage.getItem('darkMode') !== 'false';
    const body = document.body;
    const toggleButton = document.getElementById('dark-mode-toggle');
    const iconImg = document.getElementById('dark-mode-icon');
    
    if (isDarkMode) {
        body.classList.add('dark-mode');
        if (iconImg) iconImg.src = 'assets/gui_icons/day-icon.png';
        if (toggleButton) toggleButton.title = 'Toggle Light Mode';
    } else {
        body.classList.remove('dark-mode');
        if (iconImg) iconImg.src = 'assets/gui_icons/night-icon.png';
        if (toggleButton) toggleButton.title = 'Toggle Dark Mode';
    }

    if (toggleButton) {
        toggleButton.addEventListener('click', () => {
            const currentlyDark = body.classList.toggle('dark-mode');
            localStorage.setItem('darkMode', currentlyDark);
            
            if (currentlyDark) {
                if (iconImg) iconImg.src = 'assets/gui_icons/day-icon.png';
                if (toggleButton) toggleButton.title = 'Toggle Light Mode';
            } else {
                if (iconImg) iconImg.src = 'assets/gui_icons/night-icon.png';
                if (toggleButton) toggleButton.title = 'Toggle Dark Mode';
            }
            if (state.allRunners.length > 0) {
                 filterAndRender();
            }
        });
    }
}

// Handles the changing of active tabs in the UI.
export function handleTabChange(activeTabId) {
    state.elements.tabButtons.forEach(b => b.classList.toggle('active', b.dataset.tab === activeTabId));
    state.elements.tabContents.forEach(c => c.classList.toggle('active', c.id === activeTabId));

    if (state.allRunners.length > 0) {
        filterAndRender();
    }
}

// Handles clicks on table rows to display detailed runner information in a modal.
export function handleDetailView(event) {
    const clickedCell = event.target.closest('td');
    if (!clickedCell) return;
    
    // Prevent modal opening if clicking in filter columns or on filter bubbles
    if (clickedCell.classList.contains('spark-cell') || 
        clickedCell.classList.contains('whites-cell') || 
        clickedCell.classList.contains('skill-cell') ||
        clickedCell.classList.contains('checkbox-cell') ||
        event.target.closest('.add-filter-click')) {
        return;
    }

    let runnerNameForLookup = null;
    let sparksToFind = null;
    let isClickable = false;

    const tableRow = event.target.closest('tr');
    const mainRunner = state.allRunners.find(r => String(r.entry_id) === tableRow?.dataset.entryId);
    if (!mainRunner) return;

    if (tableRow.closest('#runner-white-sparks') && clickedCell.classList.contains('gp-link') && clickedCell.textContent.trim() === cleanName(mainRunner.name)) {
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
            showTimedMessage("Could not find entry");
        }
        return;
    }

    if (tableRow && tableRow.dataset.entryId && !clickedCell.dataset.gpName && !clickedCell.classList.contains('gp-link') && !clickedCell.classList.contains('gp-borrowed')) {
        const entryId = tableRow.dataset.entryId;
        const runner = state.allRunners.find(r => String(r.entry_id) === String(entryId));
        if (runner) {
            showDetailModal(runner);
        } else {
            showTimedMessage("Could not find entry"); 
        }
    }
}

// Handles clicks within the legacy analysis section, typically for navigating to runner details.
export function handleLegacyClick(event) {
    const target = event.target;
    if (target.matches('.descendant-list .gp-link[data-entry-id]')) {
        const entryId = target.dataset.entryId;
        const runner = state.allRunners.find(r => String(r.entry_id) === entryId);
        if (runner) {
            showDetailModal(runner);
        }
    }
}

// Handles clicks on nodes within the spark tracer graph to display runner details.
export function handleSparkTracerNodeClick(event) {
    const target = event.target;
    if (target.matches('#spark-tracer-graph .gp-link[data-entry-id]')) {
        const entryId = target.dataset.entryId;
        const runner = state.allRunners.find(r => String(r.entry_id) === entryId);
        if (runner) {
            showDetailModal(runner);
        }
    }
}

// Handles the deletion (transfer) of a runner from the dataset.
export function handleDeleteRunner(event) {
    const target = event.target;
    if (target.classList.contains('delete-button')) {
        const entryId = target.dataset.entryId;
        if (!entryId) return;

        const runnerIndex = state.allRunners.findIndex(r => String(r.entry_id) === String(entryId));
        
        if (runnerIndex > -1) {
            const runnerName = state.allRunners[runnerIndex].name || 'this runner';
            const confirmed = window.confirm(`Are you sure you want to transfer ${runnerName} ${state.allRunners[runnerIndex].score}?`);
            
            if (confirmed) {
                state.allRunners.splice(runnerIndex, 1);
                
                try {
                    localStorage.setItem('savedRunnerData', JSON.stringify(state.allRunners));
                } catch (e) {
                    console.error("Could not update localStorage after deletion:", e);
                    showTimedMessage("Runner removed, but failed to update local storage.");
                }
                
                filterAndRender();
                updateEntriesCount();
                showTimedMessage(`${runnerName} transferred (deleted).`);
            }
        } else {
            showTimedMessage("Error: Could not find runner to delete.");
        }
    }
}

// Shows a modal with keyboard shortcuts help
function showKeyboardShortcutsHelp() {
    const existingModal = document.getElementById('shortcuts-help-modal');
    if (existingModal) {
        existingModal.remove();
    }

    const modal = document.createElement('div');
    modal.id = 'shortcuts-help-modal';
    modal.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background-color: var(--uma-light-bg);
        border: 2px solid var(--uma-border-color);
        border-radius: 8px;
        padding: 20px;
        z-index: 10000;
        max-width: 500px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    `;

    modal.innerHTML = `
        <h2 style="margin-top: 0; color: var(--uma-text-dark);">Keyboard Shortcuts</h2>
        <div style="color: var(--uma-text-dark); line-height: 1.8;">
            <p><kbd>1-7</kbd> Switch between tabs</p>
            <p><kbd>Esc</kbd> Reset filters / Unfocus inputs</p>
            <p><kbd>D</kbd> Toggle dark mode</p>
            <p><kbd>?</kbd> Show this help</p>
        </div>
        <div style="margin-top: 15px; display: flex; gap: 10px;">
            <button id="open-settings-button" style="
                padding: 8px 16px;
                background-color: var(--uma-accent-blue);
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-weight: bold;
                flex: 1;
            ">⚙️ Settings</button>
            <button id="close-shortcuts-help" style="
                padding: 8px 16px;
                background-color: var(--uma-accent-pink);
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-weight: bold;
                flex: 1;
            ">Close</button>
        </div>
    `;

    const overlay = document.createElement('div');
    overlay.id = 'shortcuts-help-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.5);
        z-index: 9999;
    `;

    document.body.appendChild(overlay);
    document.body.appendChild(modal);

    const closeModal = () => {
        modal.remove();
        overlay.remove();
    };

    document.getElementById('close-shortcuts-help').addEventListener('click', closeModal);
    document.getElementById('open-settings-button').addEventListener('click', () => {
        closeModal();
        showSettingsModal();
    });
    overlay.addEventListener('click', closeModal);
    
    // Close on Escape
    const escapeHandler = (e) => {
        if (e.key === 'Escape') {
            closeModal();
            document.removeEventListener('keydown', escapeHandler);
        }
    };
    document.addEventListener('keydown', escapeHandler);
}

// Shows the UI settings modal
function showSettingsModal() {
    const existingModal = document.getElementById('settings-modal-overlay');
    if (existingModal) existingModal.remove();

    const overlay = document.createElement('div');
    overlay.id = 'settings-modal-overlay';

    const modal = document.createElement('div');
    modal.id = 'settings-modal';

    // Header
    const header = document.createElement('div');
    header.className = 'settings-header';
    header.innerHTML = '<h2>UI Settings</h2><span class="close-modal">&times;</span>';

    // Content
    const content = document.createElement('div');
    content.className = 'settings-content';

    // Mode Selection Section
    const modeSection = document.createElement('div');
    modeSection.className = 'settings-section';
    modeSection.innerHTML = '<h3>Display Mode</h3>';

    const modeSelector = document.createElement('div');
    modeSelector.className = 'mode-selector';

    Object.keys(UI_MODES).forEach(modeKey => {
        const mode = UI_MODES[modeKey];
        const button = document.createElement('div');
        button.className = 'mode-button';
        if (state.uiSettings.mode === modeKey) {
            button.classList.add('active');
        }
        button.innerHTML = `
            <div class="mode-name">${mode.name}</div>
            <div class="mode-desc">${mode.description}</div>
        `;
        button.onclick = () => {
            setMode(modeKey);
            showSettingsModal(); // Refresh modal to show updated settings
        };
        modeSelector.appendChild(button);
    });

    modeSection.appendChild(modeSelector);
    content.appendChild(modeSection);

    // Individual Toggles Section
    const togglesSection = document.createElement('div');
    togglesSection.className = 'settings-section';
    togglesSection.innerHTML = '<h3>Individual Settings</h3>';

    const toggles = [
        { key: 'showTabHelp', label: 'Show Tab Help Buttons', tooltip: 'Display the "?" help buttons next to tab names' },
        { key: 'showSparkTooltips', label: 'Show Spark Tooltips', tooltip: 'Display helpful information when hovering over spark bubbles' },
        { key: 'showStatTooltips', label: 'Show Stat Grade Tooltips', tooltip: 'Show grade information when hovering over stat values' },
        { key: 'showColumnHelp', label: 'Show Column Header Help', tooltip: 'Display tooltips on table column headers explaining what they contain' },
        { key: 'showFilterHelp', label: 'Show Filter Help Text', tooltip: 'Show helper text and tooltips in the filter section' },
        { key: 'showGrandparentColumns', label: 'Show Grandparent Columns (GP1/GP2)', tooltip: 'Display GP1 and GP2 columns in the main table' },
        { key: 'showEntryIdColumn', label: 'Show Entry ID Column', tooltip: 'Display the Entry ID column in tables' },
        { key: 'showAdvancedSparkFilters', label: 'Show Advanced Spark Filters', tooltip: 'Display the detailed spark filtering section' },
        { key: 'showAdvancedSkillFilters', label: 'Show Advanced Skill Filters', tooltip: 'Display the detailed skill filtering section' }
    ];

    toggles.forEach(toggle => {
        const toggleDiv = document.createElement('div');
        toggleDiv.className = 'settings-toggle';

        const labelContainer = document.createElement('div');
        labelContainer.style.display = 'flex';
        labelContainer.style.alignItems = 'center';
        labelContainer.style.gap = '8px';

        const label = document.createElement('span');
        label.className = 'toggle-label';
        label.textContent = toggle.label;

        const helpIcon = document.createElement('span');
        helpIcon.className = 'tab-help';
        helpIcon.textContent = '?';
        helpIcon.title = toggle.tooltip;
        helpIcon.style.fontSize = '0.85em';
        helpIcon.style.marginLeft = '5px';

        labelContainer.appendChild(label);
        labelContainer.appendChild(helpIcon);

        const switchLabel = document.createElement('label');
        switchLabel.className = 'toggle-switch';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = state.uiSettings[toggle.key];
        checkbox.onchange = () => {
            toggleSetting(toggle.key);
        };

        const slider = document.createElement('span');
        slider.className = 'toggle-slider';

        switchLabel.appendChild(checkbox);
        switchLabel.appendChild(slider);

        toggleDiv.appendChild(labelContainer);
        toggleDiv.appendChild(switchLabel);
        togglesSection.appendChild(toggleDiv);
    });

    content.appendChild(togglesSection);

    // Footer
    const footer = document.createElement('div');
    footer.className = 'settings-footer';
    footer.innerHTML = '<button class="btn-primary">Done</button>';

    modal.appendChild(header);
    modal.appendChild(content);
    modal.appendChild(footer);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Event listeners
    const closeModal = () => overlay.remove();
    header.querySelector('.close-modal').addEventListener('click', closeModal);
    footer.querySelector('.btn-primary').addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal();
    });

    // Close on Escape
    const escapeHandler = (e) => {
        if (e.key === 'Escape') {
            closeModal();
            document.removeEventListener('keydown', escapeHandler);
        }
    };
    document.addEventListener('keydown', escapeHandler);
}

// Adds a new row of spark filter inputs to the UI.
export function addSparkFilterRow() {
    const firstRow = document.querySelector('#spark-filters-container .spark-filters');
    if (!firstRow) return;
    const newRow = firstRow.cloneNode(true);
    state.sparkFilterCounter++;

    newRow.classList.remove('disabled');
    const disableBtn = newRow.querySelector('.disable-spark-filter-button');
    if (disableBtn) {
        disableBtn.textContent = '✓';
        disableBtn.title = 'Disable this filter row';
    }

    newRow.querySelectorAll('input[type="text"]').forEach(input => {
        input.value = '';
        input.id += `-${state.sparkFilterCounter}`;
    });
    newRow.querySelectorAll('select').forEach(select => {
        select.selectedIndex = 0;
        select.id += `-${state.sparkFilterCounter}`;
    });
    newRow.querySelector('.rep-only-checkbox').checked = false;
    newRow.querySelectorAll('label').forEach(label => {
        if (label.htmlFor) label.htmlFor += `-${state.sparkFilterCounter}`;
    });
    createSearchableSelect(newRow.querySelector('[id^="filter-blue-spark"]'), state.blueSparkNames);
    createSearchableSelect(newRow.querySelector('[id^="filter-green-spark"]'), state.greenSparkNames);
    createSearchableSelect(newRow.querySelector('[id^="filter-pink-spark"]'), state.pinkSparkNames);
    createSearchableSelect(newRow.querySelector('[id^="filter-white-spark"]'), state.whiteSparkNames);

    newRow.querySelectorAll('select').forEach(el => el.addEventListener('change', filterAndRender));

    updateSparkCountDropdown(newRow.querySelector('[id^="min-blue"]'), 9);
    updateSparkCountDropdown(newRow.querySelector('[id^="min-green"]'), 3);
    updateSparkCountDropdown(newRow.querySelector('[id^="min-pink"]'), 9);
    updateSparkCountDropdown(newRow.querySelector('[id^="min-white"]'), 9);
    updateTotalWhiteDropdown(newRow, false);

    state.elements.sparkFiltersContainer.appendChild(newRow);
    updateRemoveButtonVisibility(); 
}

// Adds a new row of skill filter inputs to the UI.
export function addSkillFilterRow() {
    const firstRow = document.querySelector('#skill-filters-container .skill-filters');
    if (!firstRow) return;

    state.skillFilterCounter++;
    const newRow = firstRow.cloneNode(true);
    
    const input = newRow.querySelector('.skill-name-input');
    const label = newRow.querySelector('label');

    const newId = `filter-skill-name-${state.skillFilterCounter}`;
    input.id = newId;
    input.value = '';
    if (label) {
        label.htmlFor = newId;
    }
    
    createSearchableSelect(input, state.orderedSkills);
    
    const addButton = document.getElementById('add-skill-filter-button');
    state.elements.skillFiltersContainer.insertBefore(newRow, addButton);

    updateRemoveSkillButtonVisibility();
}

// Resets all filter inputs to their default states.
export function resetFilters() {
    for (const key in state.elements.filterElements) {
        const el = state.elements.filterElements[key];
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

    const allSkillRows = state.elements.skillFiltersContainer.querySelectorAll('.skill-filters');
    allSkillRows.forEach((row, index) => {
        if (index > 0) {
            row.remove();
        } else {
            row.querySelector('.skill-name-input').value = '';
        }
    });
    updateRemoveSkillButtonVisibility();

    const allSparkRows = state.elements.sparkFiltersContainer.querySelectorAll('.spark-filters');
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

    const savedSetupsSelect = document.getElementById('saved-setups-select');
    const setupNameInput = document.getElementById('setup-name-input');
    if (savedSetupsSelect) savedSetupsSelect.value = "";
    if (setupNameInput) setupNameInput.value = "";

    updateRemoveButtonVisibility();
    state.elements.filterElements.sortDir.value = 'desc';
    document.querySelectorAll('.stat-input').forEach(updateStatInputPlaceholder);
    document.querySelectorAll('.aptitude-select').forEach(updateSelectPlaceholder);
    resetTabSpecificFilters();
    filterAndRender();
}

// Updates the visibility of 'remove' buttons for spark filter rows.
export function updateRemoveButtonVisibility() {
    const allSparkRows = state.elements.sparkFiltersContainer.querySelectorAll('.spark-filters');
    const shouldShowRemove = allSparkRows.length > 1;
    allSparkRows.forEach(row => {
        const removeBtn = row.querySelector('.remove-spark-filter-button');
        if (removeBtn) {
            removeBtn.style.display = shouldShowRemove ? 'block' : 'none';
        }
    });
}

// Updates the visibility of 'remove' buttons for skill filter rows.
export function updateRemoveSkillButtonVisibility() {
    const allSkillRows = state.elements.skillFiltersContainer.querySelectorAll('.skill-filters');
    const shouldShowRemove = allSkillRows.length > 1;
    allSkillRows.forEach(row => {
        const removeBtn = row.querySelector('.remove-skill-filter-button');
        if (removeBtn) {
            removeBtn.style.display = shouldShowRemove ? 'inline-block' : 'none';
        }
    });
}

// Populates a spark count dropdown with options up to a maximum number of stars.
export function updateSparkCountDropdown(selectElement, maxStars) {
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

// Updates the total white spark count dropdown based on parent-only filtering.
export function updateTotalWhiteDropdown(rowElement, isParentOnly) {
    const select = rowElement.querySelector('[id^="min-total-white"]');
    if (!select) return;
    const currentValue = select.value;
    const max = isParentOnly ? state.maxParentWhiteSparks : state.maxTotalWhiteSparks;
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

// Toggles a placeholder class for select elements based on their value.
export function updateSelectPlaceholder(selectElement) {
    if (!selectElement) return;
    selectElement.classList.toggle('placeholder-selected', selectElement.value === "");
}

// Toggles a placeholder class for stat input elements based on their value.
export function updateStatInputPlaceholder(inputElement) {
    if (!inputElement) return;
    inputElement.classList.toggle('placeholder-value', inputElement.value === '0');
}
