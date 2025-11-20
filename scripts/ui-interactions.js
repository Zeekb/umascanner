// ui-interactions.js - Manages all user interactions with the UI, including setting up event listeners, handling dynamic UI updates, and managing dark mode.

import { state } from './state.js';
import { debounce, findRunnerByDetails, showTimedMessage, cleanName, createSearchableSelect } from './utils.js';
import { filterAndRender, sortAndRender } from './filter.js';
import { showDetailModal, resetTabSpecificFilters, resetCareerPlannerParents } from './ui-renderer.js';
import { returnToFileUploader, saveDataToFile, updateEntriesCount } from './main.js';

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

// Sets up all global event listeners for UI interactions.
export function setupEventListeners() {
    loadSavedSetups(); // Initialize saved setups on load

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

    const legacyContent = document.getElementById('legacy-analysis-content');
    if (legacyContent) {
        legacyContent.addEventListener('click', handleLegacyClick);
    }

    const sparkTracerContent = document.getElementById('spark-tracer-content');
    if (sparkTracerContent) {
        sparkTracerContent.addEventListener('click', handleSparkTracerNodeClick);
    }

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
            showTimedMessage(`Removed filter: ${value}`);
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
            showTimedMessage(`Removed spark filter: ${value}`);
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
