// scripts/ui-settings.js - Manages UI settings for progressive disclosure and feature toggles

import { state } from './state.js';

// Default settings for each mode
export const UI_MODES = {
    minimal: {
        name: 'Minimal',
        description: 'Essential features only, clean interface',
        settings: {
            showSparkTooltips: false,
            showStatTooltips: false,
            showColumnHelp: false,
            showFilterHelp: false,
            showTabHelp: false,
            showGrandparentColumns: true,
            showEntryIdColumn: false,
            showAdvancedSparkFilters: false,
            showAdvancedSkillFilters: false
        }
    },
    standard: {
        name: 'Standard',
        description: 'Balanced view with helpful tooltips',
        settings: {
            showSparkTooltips: true,
            showStatTooltips: true,
            showColumnHelp: true,
            showFilterHelp: true,
            showTabHelp: true,
            showGrandparentColumns: true,
            showEntryIdColumn: false,
            showAdvancedSparkFilters: true,
            showAdvancedSkillFilters: true
        }
    },
    advanced: {
        name: 'Advanced',
        description: 'All features and information visible',
        settings: {
            showSparkTooltips: true,
            showStatTooltips: true,
            showColumnHelp: true,
            showFilterHelp: true,
            showTabHelp: true,
            showGrandparentColumns: true,
            showEntryIdColumn: true,
            showAdvancedSparkFilters: true,
            showAdvancedSkillFilters: true
        }
    }
};

// Initialize settings from localStorage or use standard as default
export function initializeSettings() {
    const saved = localStorage.getItem('uiSettings');
    if (saved) {
        try {
            state.uiSettings = JSON.parse(saved);
        } catch (e) {
            console.error('Failed to load UI settings:', e);
            state.uiSettings = {
                mode: 'standard',
                ...UI_MODES.standard.settings
            };
        }
    } else {
        state.uiSettings = {
            mode: 'standard',
            ...UI_MODES.standard.settings
        };
    }
    applySettings();
}

// Save settings to localStorage
export function saveSettings() {
    localStorage.setItem('uiSettings', JSON.stringify(state.uiSettings));
}

// Apply current settings to the UI
export function applySettings() {
    const settings = state.uiSettings;
    
    // Apply tooltip visibility
    applyTooltipSettings(settings);
    
    // Apply tab help visibility
    applyTabHelpVisibility(settings);
    
    // Apply column visibility
    applyColumnVisibility(settings);
    
    // Apply filter section visibility
    applyFilterVisibility(settings);
}

// Toggle tooltips based on settings
function applyTooltipSettings(settings) {
    // Spark tooltips
    const sparkElements = document.querySelectorAll('.spark-button, .spark-item');
    sparkElements.forEach(el => {
        if (settings.showSparkTooltips) {
            // Restore original title if it was saved
            if (el.dataset.originalTitle) {
                el.title = el.dataset.originalTitle;
            }
        } else {
            // Save original title and remove it
            if (el.title && !el.dataset.originalTitle) {
                el.dataset.originalTitle = el.title;
            }
            el.title = '';
        }
    });

    // Stat tooltips
    const statElements = document.querySelectorAll('.stat-cell, .modal-stat-grade');
    statElements.forEach(el => {
        if (settings.showStatTooltips) {
            if (el.dataset.originalTitle) {
                el.title = el.dataset.originalTitle;
            }
        } else {
            if (el.title && !el.dataset.originalTitle) {
                el.dataset.originalTitle = el.title;
            }
            el.title = '';
        }
    });

    // Column header help
    const headerElements = document.querySelectorAll('th[title]');
    headerElements.forEach(el => {
        if (settings.showColumnHelp) {
            if (el.dataset.originalTitle) {
                el.title = el.dataset.originalTitle;
            }
        } else {
            if (el.title && !el.dataset.originalTitle) {
                el.dataset.originalTitle = el.title;
            }
            el.title = '';
        }
    });
}

// Toggle tab help button visibility
function applyTabHelpVisibility(settings) {
    const tabHelpElements = document.querySelectorAll('.tab-help');
    tabHelpElements.forEach(el => {
        el.style.display = settings.showTabHelp ? '' : 'none';
    });
}

// Toggle column visibility
function applyColumnVisibility(settings) {
    // Find GP columns by iterating through headers
    const headers = document.querySelectorAll('thead th');
    const gpIndices = [];
    
    headers.forEach((header, index) => {
        const text = header.textContent.trim();
        if (text === 'GP1' || text === 'GP2') {
            gpIndices.push(index);
            // Hide/show header
            header.style.display = settings.showGrandparentColumns ? '' : 'none';
        }
    });
    
    // Hide/show corresponding cells in each row
    if (gpIndices.length > 0) {
        document.querySelectorAll('tbody tr').forEach(row => {
            const cells = row.querySelectorAll('td');
            gpIndices.forEach(index => {
                if (cells[index]) {
                    cells[index].style.display = settings.showGrandparentColumns ? '' : 'none';
                }
            });
        });
    }
    
    // Entry ID column (typically the 2nd column after checkbox)
    // Find it by checking for numeric content or specific class
    const entryIdIndex = Array.from(headers).findIndex(h => 
        h.textContent.trim() === 'Entry ID' || h.textContent.trim() === 'ID'
    );
    
    if (entryIdIndex !== -1) {
        headers[entryIdIndex].style.display = settings.showEntryIdColumn ? '' : 'none';
        document.querySelectorAll('tbody tr').forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells[entryIdIndex]) {
                cells[entryIdIndex].style.display = settings.showEntryIdColumn ? '' : 'none';
            }
        });
    }
}

// Toggle filter section visibility
function applyFilterVisibility(settings) {
    const sparkFilters = document.getElementById('spark-filters-container');
    const skillFilters = document.getElementById('skill-filters-container');
    
    if (sparkFilters) {
        sparkFilters.style.display = settings.showAdvancedSparkFilters ? '' : 'none';
    }
    
    if (skillFilters) {
        skillFilters.style.display = settings.showAdvancedSkillFilters ? '' : 'none';
    }
}

// Set mode and apply its preset settings
export function setMode(mode) {
    if (!UI_MODES[mode]) {
        console.error('Invalid mode:', mode);
        return;
    }
    
    state.uiSettings = {
        mode: mode,
        ...UI_MODES[mode].settings
    };
    
    saveSettings();
    applySettings();
}

// Toggle individual setting
export function toggleSetting(settingName) {
    if (state.uiSettings.hasOwnProperty(settingName)) {
        state.uiSettings[settingName] = !state.uiSettings[settingName];
        state.uiSettings.mode = 'custom'; // Mark as custom when individual settings are changed
        saveSettings();
        applySettings();
    }
}
