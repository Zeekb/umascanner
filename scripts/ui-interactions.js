// scripts/ui-interactions.js

import { state } from './state.js';
import { debounce, findRunnerByDetails, showTimedMessage, cleanName } from './utils.js';
import { filterAndRender, sortAndRender } from './filter.js';
import { showDetailModal, resetTabSpecificFilters, resetLegaciesPlannerParents } from './ui-renderer.js';
import { returnToFileUploader, saveDataToFile, updateEntriesCount } from './main.js';

export function setupEventListeners() {
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
            target.textContent = isDisabled ? '-' : '✓';
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

        const tableBody = document.getElementById('grandparent-summary-body');
        if (tableBody && !e.target.closest('#grandparent-summary-body')) {
            tableBody.querySelectorAll('tr.selected').forEach(r => r.classList.remove('selected'));
            
            const descendantList = document.getElementById('descendant-list-body');
            if (descendantList) {
                descendantList.innerHTML = 'Click a grandparent to see their descendants.';
            }
        }
    });

    state.elements.parentSummaryBody.addEventListener('click', handleDeleteRunner);

    [state.elements.parentSummaryBody, state.elements.whiteSparksBody, state.elements.skillsSummaryBody].forEach(body => {
        body.addEventListener('click', handleDetailView);
    });

    state.elements.saveDataButton.addEventListener('click', saveDataToFile); 

    const clearParentsButton = document.getElementById('clear-parent-selections');
    if(clearParentsButton) {
        clearParentsButton.addEventListener('click', resetLegaciesPlannerParents);
    }

    const grandparentContent = document.getElementById('grandparent-analysis-content');
    if (grandparentContent) {
        grandparentContent.addEventListener('click', handleGrandparentClick);
    }

    const inheritanceContent = document.getElementById('inheritance-log-content');
    if (inheritanceContent) {
        inheritanceContent.addEventListener('click', handleInheritanceNodeClick);
    }

    document.querySelectorAll('#affinity-selection, #spark-select, .runner-select, .min-spark-select, .spark-count-select').forEach(sel => {
        sel.addEventListener('wheel', handleSelectWheelScroll, { passive: false });
    });
    
    updateRemoveButtonVisibility();
    updateRemoveSkillButtonVisibility();

    document.getElementById('legacies-planner-content').addEventListener('click', (e) => {
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
}

export function isDarkModeActive() {
    return document.body.classList.contains('dark-mode');
}

export function setupDarkMode() {
    const isDarkMode = localStorage.getItem('darkMode') === 'true';
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

export function createSearchableSelect(inputElement, optionsArray) {
    const container = inputElement.closest('.searchable-select-container');
    if (!container) return;

    const optionsContainer = container.querySelector('.options-container');
    if (!optionsContainer) return;

    optionsContainer.addEventListener('wheel', (event) => {
        event.stopPropagation();
    }, { passive: false });

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

        optionsContainer.style.position = 'absolute';
        optionsContainer.style.top = '100%'; 
        optionsContainer.style.left = '0';
        optionsContainer.style.width = 'auto'; 
        optionsContainer.style.minWidth = `${container.getBoundingClientRect().width}px`;

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

    inputElement.addEventListener('wheel', (event) => {
        
        if (optionsContainer.style.display === 'block') {
            event.preventDefault(); 
            event.stopPropagation(); 
            return;
        }
        
        event.preventDefault(); 
        event.stopPropagation();

        const currentValue = inputElement.value;
        let currentIndex = optionsArray.indexOf(currentValue);
        
        if (currentIndex === -1) {
            currentIndex = -1;
        }

        let newIndex;
        if (event.deltaY < 0) { 
            newIndex = Math.max(-1, currentIndex - 1); 
        } else { 
            newIndex = Math.min(optionsArray.length - 1, currentIndex + 1); 
        }
        
        if (newIndex !== currentIndex) {
            const newValue = (newIndex === -1) ? '' : optionsArray[newIndex];
            inputElement.value = newValue;
            
            inputElement.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }, { passive: false });
}

export function handleTabChange(activeTabId) {
    state.elements.tabButtons.forEach(b => b.classList.toggle('active', b.dataset.tab === activeTabId));
    state.elements.tabContents.forEach(c => c.classList.toggle('active', c.id === activeTabId));

    if (state.allRunners.length > 0) {
        filterAndRender();
    }
}

export function handleDetailView(event) {
    const clickedCell = event.target.closest('td');
    if (!clickedCell) return;
    let runnerNameForLookup = null;
    let sparksToFind = null;
    let isClickable = false;

    const tableRow = event.target.closest('tr');
    const mainRunner = state.allRunners.find(r => String(r.entry_id) === tableRow?.dataset.entryId);
    if (!mainRunner) return;

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

export function handleGrandparentClick(event) {
    const target = event.target;
    if (target.matches('.descendant-list .gp-link[data-entry-id]')) {
        const entryId = target.dataset.entryId;
        const runner = state.allRunners.find(r => String(r.entry_id) === entryId);
        if (runner) {
            showDetailModal(runner);
        }
    }
}

export function handleInheritanceNodeClick(event) {
    const target = event.target;
    if (target.matches('#inheritance-graph .gp-link[data-entry-id]')) {
        const entryId = target.dataset.entryId;
        const runner = state.allRunners.find(r => String(r.entry_id) === entryId);
        if (runner) {
            showDetailModal(runner);
        }
    }
}

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

    updateRemoveButtonVisibility();
    state.elements.filterElements.sortDir.value = 'desc';
    document.querySelectorAll('.stat-input').forEach(updateStatInputPlaceholder);
    document.querySelectorAll('.aptitude-select').forEach(updateSelectPlaceholder);
    resetTabSpecificFilters();
    filterAndRender();
}

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

export function updateSelectPlaceholder(selectElement) {
    if (!selectElement) return;
    selectElement.classList.toggle('placeholder-selected', selectElement.value === "");
}

export function updateStatInputPlaceholder(inputElement) {
    if (!inputElement) return;
    inputElement.classList.toggle('placeholder-value', inputElement.value === '0');
}