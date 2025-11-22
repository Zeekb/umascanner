// scripts/bulk-actions.js - Handles bulk operations on runners.

import { state } from './state.js';
import { filterAndRender } from './filter.js';
import { showTimedMessage, saveStateToLocalStorage, saveCollections, showInputModal } from './utils.js';
import { updateEntriesCount, updateLastUpdated } from './main.js';

export function setupBulkActions() {
    // Delegate event listener for individual checkboxes
    document.addEventListener('change', (e) => {
        if (e.target.classList.contains('runner-select-checkbox')) {
            const entryId = e.target.dataset.entryId;
            if (e.target.checked) {
                state.selectedRunners.add(entryId);
            } else {
                state.selectedRunners.delete(entryId);
            }
            updateBulkToolbar();
            updateSelectAllCheckboxState();
        }
        
        if (e.target.classList.contains('select-all-checkbox')) {
            handleSelectAll(e.target.checked);
        }
    });

    // Toolbar Buttons
    document.getElementById('bulk-clear-selection').addEventListener('click', clearSelection);
    document.getElementById('bulk-action-transfer').addEventListener('click', handleBulkTransfer);
    document.getElementById('bulk-action-tag').addEventListener('click', handleBulkTag);
    document.getElementById('bulk-action-collection').addEventListener('click', handleBulkCollection);
}

export function updateBulkToolbar() {
    const toolbar = document.getElementById('bulk-actions-toolbar');
    const countSpan = document.getElementById('bulk-count');
    const count = state.selectedRunners.size;

    countSpan.textContent = count;

    if (count > 0) {
        toolbar.classList.remove('hidden');
    } else {
        toolbar.classList.add('hidden');
    }
}

export function updateSelectAllCheckboxState() {
    const checkboxes = document.querySelectorAll('.select-all-checkbox');
    const visibleRunners = state.lastFilteredData || [];
    
    if (visibleRunners.length === 0) {
        checkboxes.forEach(cb => { cb.checked = false; cb.indeterminate = false; });
        return;
    }

    const allSelected = visibleRunners.every(r => state.selectedRunners.has(String(r.entry_id)));
    const someSelected = visibleRunners.some(r => state.selectedRunners.has(String(r.entry_id)));

    checkboxes.forEach(cb => {
        cb.checked = allSelected;
        cb.indeterminate = someSelected && !allSelected;
    });
}

function handleSelectAll(isChecked) {
    const visibleRunners = state.lastFilteredData || [];
    
    visibleRunners.forEach(r => {
        if (isChecked) {
            state.selectedRunners.add(String(r.entry_id));
        } else {
            state.selectedRunners.delete(String(r.entry_id));
        }
    });

    // Update UI checkboxes
    document.querySelectorAll('.runner-select-checkbox').forEach(cb => {
        cb.checked = state.selectedRunners.has(cb.dataset.entryId);
    });

    updateBulkToolbar();
    updateSelectAllCheckboxState(); // Sync multiple headers if any
}

function clearSelection() {
    state.selectedRunners.clear();
    document.querySelectorAll('.runner-select-checkbox').forEach(cb => cb.checked = false);
    updateBulkToolbar();
    updateSelectAllCheckboxState();
}

function handleBulkTransfer() {
    const count = state.selectedRunners.size;
    if (count === 0) return;

    if (confirm(`Are you sure you want to transfer (delete) ${count} runners? This cannot be undone.`)) {
        state.allRunners = state.allRunners.filter(r => !state.selectedRunners.has(String(r.entry_id)));
        state.selectedRunners.clear();
        
        saveStateToLocalStorage();
        updateEntriesCount();
        updateLastUpdated();
        filterAndRender(); // Re-render list
        updateBulkToolbar();
        showTimedMessage(`${count} runners transferred.`);
    }
}

function handleBulkTag() {
    const count = state.selectedRunners.size;
    if (count === 0) return;

    showInputModal({
        title: 'Add Tag',
        message: `Enter tag to add to ${count} runners:`,
        placeholder: 'Tag name',
        confirmText: 'Add Tag',
        onConfirm: (tag) => {
            if (tag && tag.trim()) {
                const tagToAdd = tag.trim();
                let updatedCount = 0;

                state.allRunners.forEach(r => {
                    if (state.selectedRunners.has(String(r.entry_id))) {
                        if (!r.tags) r.tags = [];
                        if (!r.tags.includes(tagToAdd)) {
                            r.tags.push(tagToAdd);
                            updatedCount++;
                        }
                    }
                });

                if (updatedCount > 0) {
                    state.allTags.add(tagToAdd);
                    saveStateToLocalStorage();
                    filterAndRender(); // Re-render to show tags
                    showTimedMessage(`Added tag "${tagToAdd}" to ${updatedCount} runners.`);
                } else {
                    showTimedMessage("All selected runners already have this tag.");
                }
            }
        }
    });
}

function handleBulkCollection() {
    const count = state.selectedRunners.size;
    if (count === 0) return;

    const options = state.collections.map(c => ({ value: c.name, label: c.name }));
    options.unshift({ value: '__new__', label: '+ Create New Collection' });

    showInputModal({
        title: 'Add to Collection',
        message: `Select collection for ${count} runners:`,
        inputType: 'select',
        options: options,
        confirmText: 'Add',
        onConfirm: (collectionName) => {
            if (collectionName === '__new__') {
                showInputModal({
                    title: 'New Collection',
                    message: 'Enter name for the new collection:',
                    placeholder: 'Collection Name',
                    confirmText: 'Create & Add',
                    onConfirm: (newCollectionName) => {
                        if (newCollectionName && newCollectionName.trim()) {
                            const name = newCollectionName.trim();
                            if (state.collections.some(c => c.name === name)) {
                                showTimedMessage("Collection already exists.");
                                return;
                            }
                            const newCollection = { name: name, runnerIds: [] };
                            state.collections.push(newCollection);
                            addToCollection(name);
                        }
                    }
                });
            } else {
                addToCollection(collectionName);
            }
        }
    });

    function addToCollection(name) {
        const collection = state.collections.find(c => c.name === name);
        if (collection) {
            let addedCount = 0;
            state.selectedRunners.forEach(id => {
                if (!collection.runnerIds.includes(id)) {
                    collection.runnerIds.push(id);
                    addedCount++;
                }
            });

            if (addedCount > 0) {
                saveCollections();
                showTimedMessage(`Added ${addedCount} runners to "${name}".`);
            } else {
                showTimedMessage("All selected runners are already in this collection.");
            }
        }
    }
}
