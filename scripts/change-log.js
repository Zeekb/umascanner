// scripts/change-log.js - Handles the generation and display of change logs between data imports.

import { state } from './state.js';
import { cleanName, getStatGrade, formatGradeForDisplay } from './utils.js';

// Generates a change log object by comparing old and new runner data.
export function generateChangeLog(oldRunners, newRunners) {
    const oldMap = new Map(oldRunners.map(r => [String(r.entry_id), r]));
    const newMap = new Map(newRunners.map(r => [String(r.entry_id), r]));

    const added = [];
    const removed = [];
    const modified = [];

    // Identify Added and Modified
    newRunners.forEach(newRunner => {
        const id = String(newRunner.entry_id);
        if (!oldMap.has(id)) {
            added.push(newRunner);
        } else {
            const oldRunner = oldMap.get(id);
            const changes = compareRunners(oldRunner, newRunner);
            if (changes.length > 0) {
                modified.push({ runner: newRunner, changes });
            }
        }
    });

    // Identify Removed
    oldRunners.forEach(oldRunner => {
        if (!newMap.has(String(oldRunner.entry_id))) {
            removed.push(oldRunner);
        }
    });

    return {
        timestamp: new Date().toISOString(),
        added,
        removed,
        modified
    };
}

// Compares two runner objects and returns a list of specific changes.
function compareRunners(oldR, newR) {
    const changes = [];

    // Compare Stats
    ['speed', 'stamina', 'power', 'guts', 'wit'].forEach(stat => {
        if (oldR[stat] !== newR[stat]) {
            changes.push({ type: 'stat', stat, old: oldR[stat], new: newR[stat] });
        }
    });

    // Compare Skills (simple count/content check)
    const oldSkills = new Set(oldR.skills || []);
    const newSkills = new Set(newR.skills || []);
    const addedSkills = [...newSkills].filter(x => !oldSkills.has(x));
    const removedSkills = [...oldSkills].filter(x => !newSkills.has(x));

    if (addedSkills.length > 0 || removedSkills.length > 0) {
        changes.push({ type: 'skills', added: addedSkills, removed: removedSkills });
    }

    // Compare Sparks (simple count check for now, deep comparison is complex)
    const countSparks = (runner) => {
        let count = 0;
        ['parent', 'gp1', 'gp2'].forEach(src => {
            if (runner.sparks?.[src]) count += runner.sparks[src].length;
        });
        return count;
    };
    
    const oldSparkCount = countSparks(oldR);
    const newSparkCount = countSparks(newR);
    
    if (oldSparkCount !== newSparkCount) {
        changes.push({ type: 'sparks', old: oldSparkCount, new: newSparkCount });
    }

    return changes;
}

// Gets runners that were updated on the most recent date
function getRecentUpdates() {
    if (!state.allRunners || state.allRunners.length === 0) {
        return [];
    }

    // Find the most recent last_updated timestamp
    let latestDate = null;
    state.allRunners.forEach(runner => {
        if (runner.last_updated) {
            const currentDate = new Date(runner.last_updated);
            if (!latestDate || currentDate > latestDate) {
                latestDate = currentDate;
            }
        }
    });

    if (!latestDate) {
        return [];
    }

    // Get all runners with that timestamp
    const recentRunners = state.allRunners.filter(runner => {
        if (!runner.last_updated) return false;
        const runnerDate = new Date(runner.last_updated);
        return runnerDate.getTime() === latestDate.getTime();
    });

    // Sort by score descending
    return recentRunners.sort((a, b) => (b.score || 0) - (a.score || 0));
}

// Displays the change log in a modal.
export function showChangeLogModal() {
    const existingModal = document.getElementById('change-log-modal-overlay');
    if (existingModal) existingModal.remove();

    const overlay = document.createElement('div');
    overlay.id = 'change-log-modal-overlay';
    overlay.className = 'modal-overlay'; // Reuse existing modal overlay class if possible, or define new
    // Note: modal.css defines #detail-modal-overlay, let's reuse similar styles or add new ones.
    // For now, I'll use inline styles or rely on a new class I'll add to modal.css

    const modal = document.createElement('div');
    modal.id = 'change-log-modal';
    
    const header = document.createElement('div');
    header.className = 'change-log-header';
    header.innerHTML = `<h2>Change Log</h2><span class="close-modal">&times;</span>`;
    
    const content = document.createElement('div');
    content.className = 'change-log-content';

    // If there's a change log from file import, show it
    if (state.changeLog && (state.changeLog.added.length > 0 || state.changeLog.removed.length > 0 || state.changeLog.modified.length > 0)) {
        const { added, removed, modified, timestamp } = state.changeLog;
        const dateStr = new Date(timestamp).toLocaleString();

        content.innerHTML = `<p class="change-log-meta">Comparison generated at: ${dateStr}</p>`;

        if (added.length > 0) {
            content.innerHTML += `<h3>New Runners (${added.length})</h3>`;
            const list = document.createElement('ul');
            added.forEach(r => {
                const li = document.createElement('li');
                li.textContent = r.name;
                list.appendChild(li);
            });
            content.appendChild(list);
        }

        if (modified.length > 0) {
            content.innerHTML += `<h3>Modified Runners (${modified.length})</h3>`;
            const list = document.createElement('ul');
            modified.forEach(item => {
                const li = document.createElement('li');
                let changeText = `<strong>${item.runner.name}</strong>: `;
                const details = [];
                item.changes.forEach(c => {
                    if (c.type === 'stat') details.push(`${c.stat.toUpperCase()} ${c.old}→${c.new}`);
                    if (c.type === 'skills') details.push(`Skills (+${c.added.length}/-${c.removed.length})`);
                    if (c.type === 'sparks') details.push(`Sparks (${c.old}→${c.new})`);
                });
                changeText += details.join(', ');
                li.innerHTML = changeText;
                list.appendChild(li);
            });
            content.appendChild(list);
        }

        if (removed.length > 0) {
            content.innerHTML += `<h3>Removed Runners (${removed.length})</h3>`;
            const list = document.createElement('ul');
            removed.forEach(r => {
                const li = document.createElement('li');
                li.textContent = r.name;
                list.appendChild(li);
            });
            content.appendChild(list);
        }
    } else {
        // Show recent updates based on last_updated timestamp
        const recentUpdates = getRecentUpdates();
        
        if (recentUpdates.length === 0) {
            content.innerHTML = '<p>No recent updates found.</p>';
        } else {
            const latest = recentUpdates[0];
            const latestDate = new Date(latest.last_updated);
            const dateStr = latestDate.toLocaleString();
            
            content.innerHTML = `<p class="change-log-meta">Most recent update: ${dateStr}</p>`;
            content.innerHTML += `<h3>Recently Updated Runners (${recentUpdates.length})</h3>`;
            
            const list = document.createElement('ul');
            recentUpdates.forEach(r => {
                const li = document.createElement('li');
                const updateDate = new Date(r.last_updated).toLocaleString();
                const score = (r.score || 0).toLocaleString();
                li.innerHTML = `<strong>${r.name}</strong> (${score}) - ${updateDate}`;
                list.appendChild(li);
            });
            content.appendChild(list);
        }
    }

    modal.appendChild(header);
    modal.appendChild(content);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Event Listeners
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
    });
    header.querySelector('.close-modal').addEventListener('click', () => overlay.remove());
}
