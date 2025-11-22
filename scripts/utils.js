// scripts/utils.js - Provides a collection of utility functions used across the application for common tasks like data manipulation, UI helpers, and calculations.

import { state, CONSTANTS } from './state.js';
import { filterAndRender } from './filter.js';

// Cleans a runner's name by removing trailing ' c' and trimming whitespace.
export const cleanName = (name) => name ? name.replace(/ c$/, '').trim() : '';

// Debounces a function call, ensuring it's only executed after a specified delay.
export const debounce = (func, delay) => {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
};

// Finds a runner by name and a comparable set of grandparent sparks, utilizing a cache for performance.
export function findRunnerByDetails(name, gpSparksArray) {
    if (!name || !gpSparksArray || gpSparksArray.length === 0) {
        return null;
    }
    const cacheKey = `${name}-${JSON.stringify(gpSparksArray)}`;
    if (state.gpExistenceCache.has(cacheKey)) {
        return state.gpExistenceCache.get(cacheKey);
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
        state.gpExistenceCache.set(cacheKey, null);
        return null;
    }

    const isCVersionLookup = name.endsWith(' c');
    const baseName = cleanName(name);

    const foundRunner = state.allRunners.find(runner => {
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
    state.gpExistenceCache.set(cacheKey, result);
    return result;
}

// Displays a temporary, timed message popup to the user.
export function showTimedMessage(message) {
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

// Determines the grade (e.g., S+, A) for a given stat value.
export function getStatGrade(value) {
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

// Calculates the overall rank (e.g., SS+, A) for a given runner score.
export function calculateRank(score) {
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

// Retrieves the color associated with a given aptitude grade.
export function getAptitudeColor(grade) {
    const baseGrade = grade?.replace('<sup>+</sup>', '').replace('+', '').replace('SS', 'S');
    return CONSTANTS.APTITUDE_COLORS[baseGrade] || '#b3b2b3';
}

// Adjusts the brightness of a given hexadecimal color by a percentage.
export function adjustColor(hex, percent) {
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

// Mixes two hexadecimal colors by a given ratio.
export function mixColors(color1, color2, ratio = 0.5) {
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

// Returns a set of colors (base, top, bottom, outline) for a given grade.
export function getGradeColors(grade) {
    const gradeColor = getAptitudeColor(grade);
    const outlineColor = 'rgba(0, 0, 0, 0.9)'; 
    const topColor = adjustColor(gradeColor, 150);
    const bottomColor = adjustColor(gradeColor, 0);
    return { gradeColor, topColor, bottomColor, outlineColor };
}

// Formats a skill name for display, handling special characters.
export function formatSkillName(skillName) {
    if (!skillName) return "";
    return skillName.replace(/(◎|○|×)/g, '<span style="font-size: 1.1em;">$1</span>');
}

// Formats a grade string for display, converting '+' to superscript.
export function formatGradeForDisplay(grade) {
    if (!grade) return 'G';
    if (grade.endsWith('+')) {
        return `${grade.slice(0, -1)}<sup>+</sup>`;
    }
    return grade;
}

// Retrieves the base chance for inspiration based on spark color and stars.
export function getBaseChance(color, stars) {
    if (!state.inspirationData.base_chances) return 0;
    
    let type = color;
    if (color === 'white') {
        type = 'white_skill'; 
    }

    const chances = state.inspirationData.base_chances[type];
    if (!chances) return 0;
    
    return chances[stars - 1] || 0;
}

// Creates a searchable select dropdown component.
export function createSearchableSelect(inputElement, optionsArray, onSelectCallback = null) {
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
    inputElement.addEventListener('input', () => {
        if (inputElement._isProgrammatic) {
            inputElement._isProgrammatic = false;
            return;
        }
        populateOptions(inputElement.value);
    });
    
    optionsContainer.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('option-item')) {
            inputElement.value = e.target.dataset.value;
            optionsContainer.style.display = 'none';
            if (onSelectCallback) {
                onSelectCallback();
            } else {
                filterAndRender();
            }
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
            if (onSelectCallback) {
                onSelectCallback();
            } else {
                filterAndRender();
            }
        }
    }, { passive: false });
}

// Saves the current runner data to local storage.
export function saveStateToLocalStorage() {
    try {
        const jsonData = JSON.stringify(state.allRunners);
        localStorage.setItem('savedRunnerData', jsonData);
    } catch (e) {
        console.error("Could not save to localStorage:", e);
    }
}

// Helper to load collections from localStorage
export function loadCollections() {
    const stored = localStorage.getItem('collections');
    if (stored) {
        try {
            state.collections = JSON.parse(stored);
        } catch (e) {
            console.error("Failed to parse collections", e);
            state.collections = [];
        }
    }
    updateCollectionsDropdown();
}

// Helper to save collections to localStorage
export function saveCollections() {
    localStorage.setItem('collections', JSON.stringify(state.collections));
    updateCollectionsDropdown();
}

// Helper to update collections dropdown
export function updateCollectionsDropdown() {
    const select = document.getElementById('filter-collection');
    if (!select) return;

    const currentValue = select.value;
    select.innerHTML = '<option value="">All Collections</option>';

    state.collections.forEach((collection) => {
        const option = document.createElement('option');
        option.value = collection.name;
        option.textContent = `${collection.name} (${collection.runnerIds.length})`;
        select.appendChild(option);
    });

    if (currentValue !== "" && state.collections.some(c => c.name === currentValue)) {
        select.value = currentValue;
    }
}

// Displays a generic input modal (replacing prompt/confirm).
export function showInputModal({ title, message, inputType = 'text', options = [], placeholder = '', confirmText = 'Confirm', cancelText = 'Cancel', onConfirm }) {
    const existingOverlay = document.getElementById('input-modal-overlay');
    if (existingOverlay) existingOverlay.remove();

    const overlay = document.createElement('div');
    overlay.id = 'input-modal-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.right = '0';
    overlay.style.bottom = '0';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    overlay.style.zIndex = '2000';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';

    const modal = document.createElement('div');
    modal.id = 'input-modal';
    modal.className = 'input-modal';
    modal.style.backgroundColor = 'var(--uma-medium-bg, #fff)';
    modal.style.padding = '20px';
    modal.style.borderRadius = '8px';
    modal.style.minWidth = '300px';
    modal.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
    modal.style.display = 'flex';
    modal.style.flexDirection = 'column';
    modal.style.gap = '15px';
    modal.style.border = '1px solid var(--uma-border-color, #ccc)';

    const header = document.createElement('div');
    header.className = 'input-modal-header';
    header.style.fontSize = '1.2em';
    header.style.fontWeight = 'bold';
    header.style.color = 'var(--uma-text-dark, #333)';
    header.textContent = title;

    const body = document.createElement('div');
    body.className = 'input-modal-body';
    body.style.display = 'flex';
    body.style.flexDirection = 'column';
    body.style.gap = '10px';
    
    if (message) {
        const msgP = document.createElement('p');
        msgP.textContent = message;
        msgP.style.margin = '0';
        msgP.style.color = 'var(--uma-text-dark, #333)';
        body.appendChild(msgP);
    }

    let inputElement;
    if (inputType === 'select') {
        inputElement = document.createElement('select');
        inputElement.className = 'input-modal-select';
        inputElement.style.padding = '8px';
        inputElement.style.borderRadius = '4px';
        inputElement.style.border = '1px solid #ccc';
        inputElement.style.backgroundColor = 'var(--uma-light-bg, #fff)';
        inputElement.style.color = 'var(--uma-text-dark, #000)';
        options.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt.value;
            option.textContent = opt.label;
            inputElement.appendChild(option);
        });
    } else {
        inputElement = document.createElement('input');
        inputElement.type = 'text';
        inputElement.className = 'input-modal-text';
        inputElement.placeholder = placeholder;
        inputElement.style.padding = '8px';
        inputElement.style.borderRadius = '4px';
        inputElement.style.border = '1px solid #ccc';
        inputElement.style.width = '100%';
        inputElement.style.boxSizing = 'border-box';
        inputElement.style.backgroundColor = 'var(--uma-light-bg, #fff)';
        inputElement.style.color = 'var(--uma-text-dark, #000)';
    }
    body.appendChild(inputElement);

    const footer = document.createElement('div');
    footer.className = 'input-modal-footer';
    footer.style.display = 'flex';
    footer.style.justifyContent = 'flex-end';
    footer.style.gap = '10px';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'input-modal-cancel';
    cancelBtn.textContent = cancelText;
    cancelBtn.style.padding = '6px 12px';
    cancelBtn.style.cursor = 'pointer';
    cancelBtn.style.borderRadius = '4px';
    cancelBtn.style.border = '1px solid #ccc';
    cancelBtn.onclick = () => overlay.remove();

    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'input-modal-confirm';
    confirmBtn.textContent = confirmText;
    confirmBtn.style.padding = '6px 12px';
    confirmBtn.style.cursor = 'pointer';
    confirmBtn.style.backgroundColor = 'var(--uma-accent-blue, #2196F3)';
    confirmBtn.style.color = 'white';
    confirmBtn.style.border = 'none';
    confirmBtn.style.borderRadius = '4px';
    
    confirmBtn.onclick = () => {
        const value = inputElement.value;
        if (value) {
            onConfirm(value);
            overlay.remove();
        }
    };

    footer.appendChild(cancelBtn);
    footer.appendChild(confirmBtn);

    modal.appendChild(header);
    modal.appendChild(body);
    modal.appendChild(footer);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    inputElement.focus();
    
    // Allow Enter key to confirm
    inputElement.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            confirmBtn.click();
        }
    });
    
    // Close on overlay click
    overlay.onclick = (e) => {
        if (e.target === overlay) {
            overlay.remove();
        }
    };
}
