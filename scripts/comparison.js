// Comparison tab rendering and logic

import { state } from './state.js';
import { getAptitudeColor, getGradeColors, formatGradeForDisplay } from './utils.js';

/**
 * Populate the four runner selection dropdowns.
 * The list is sorted according to the selected sort option (name or score).
 */
export function populateComparisonDropdowns() {
    const selects = [
        document.getElementById('comparison-runner-1'),
        document.getElementById('comparison-runner-2'),
        document.getElementById('comparison-runner-3'),
        document.getElementById('comparison-runner-4')
    ];

    const sortBy = document.getElementById('comparison-sort-by')?.value || 'name';
    let runners = [...state.allRunners];
    if (sortBy === 'score') {
        runners.sort((a, b) => (b.score || 0) - (a.score || 0));
    } else {
        runners.sort((a, b) => {
            const nameA = (a.name || '').toLowerCase();
            const nameB = (b.name || '').toLowerCase();
            return nameA.localeCompare(nameB);
        });
    }

    selects.forEach(select => {
        if (!select) return;
        const current = select.value;
        // Placeholder option
        select.innerHTML = '<option value="">Select Runner...</option>';
        runners.forEach(runner => {
            const opt = document.createElement('option');
            opt.value = runner.entry_id;
            opt.textContent = `${runner.name} (Score: ${runner.score || 0})`;
            select.appendChild(opt);
        });
        if (current) select.value = current;
    });
}

/**
 * Render the side‑by‑side comparison table inside #comparison-table-container.
 */
export function renderComparisonTable() {
    const container = document.getElementById('comparison-table-container');
    if (!container) return;

    const selectedIds = [
        document.getElementById('comparison-runner-1')?.value,
        document.getElementById('comparison-runner-2')?.value,
        document.getElementById('comparison-runner-3')?.value,
        document.getElementById('comparison-runner-4')?.value
    ].filter(id => id);

    if (selectedIds.length < 2) {
        container.innerHTML = '<p style="text-align:center;color:var(--uma-text-dark);padding:40px;">Please select at least 2 runners to compare.</p>';
        return;
    }

    const runners = selectedIds
        .map(id => state.allRunners.find(r => String(r.entry_id) === String(id)))
        .filter(r => r);

    if (runners.length < 2) {
        container.innerHTML = '<p style="text-align:center;color:var(--uma-text-dark);padding:40px;">Selected runners not found.</p>';
        return;
    }

    // Begin table
    let html = '<table class="comparison-table" style="width:100%;border-collapse:collapse;table-layout:fixed;">';
    // Header
    const attributeColWidth = '15%';
    const runnerColWidth = `${85 / runners.length}%`;
    
    html += `<thead><tr><th style="width:${attributeColWidth};text-align:left;padding:12px;border:1px solid var(--uma-border-color);background-color:var(--uma-medium-bg);">Attribute</th>`;
    runners.forEach(r => {
        html += `<th style="width:${runnerColWidth};padding:12px;border:1px solid var(--uma-border-color);background-color:var(--uma-medium-bg);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${r.name}<br><small>(Score: ${r.score || 0})</small></th>`;
    });
    html += '</tr></thead><tbody>';

    // Core stats (including score)
    html += addComparisonRow('Score', runners, r => r.score || 0, true);
    html += addComparisonRow('Speed', runners, r => r.speed || 0, true);
    html += addComparisonRow('Stamina', runners, r => r.stamina || 0, true);
    html += addComparisonRow('Power', runners, r => r.power || 0, true);
    html += addComparisonRow('Guts', runners, r => r.guts || 0, true);
    html += addComparisonRow('Wit', runners, r => r.wit || 0, true);

    // Aptitudes header
    html += `<tr><td colspan="${runners.length + 1}" style="padding:12px;border:1px solid var(--uma-border-color);background-color:var(--uma-dark-bg);font-weight:bold;color:var(--uma-text-dark);">Aptitudes</td></tr>`;
    const aptitudes = ['turf', 'dirt', 'sprint', 'mile', 'medium', 'long', 'front', 'pace', 'late', 'end'];
    const aptLabels = ['Turf', 'Dirt', 'Sprint', 'Mile', 'Medium', 'Long', 'Front', 'Pace', 'Late', 'End'];
    aptitudes.forEach((apt, i) => {
        html += addComparisonRow(aptLabels[i], runners, r => r[apt] || 'G', false);
    });

    // Sparks header
    html += `<tr><td colspan="${runners.length + 1}" style="padding:12px;border:1px solid var(--uma-border-color);background-color:var(--uma-dark-bg);font-weight:bold;color:var(--uma-text-dark);">Sparks (Parent + GP)</td></tr>`;
    const sparkColors = ['blue', 'pink', 'green', 'white'];
    const sparkLabels = { blue: 'Blue', pink: 'Pink', green: 'Green', white: 'White' };
    
    sparkColors.forEach(color => {
        html += `<tr><td class="spark-${color}" style="padding:12px;border:1px solid var(--uma-border-color);background-color:var(--uma-light-bg);font-weight:bold;">${sparkLabels[color]} Sparks</td>`;
        runners.forEach(runner => {
            // Collect sparks from all sources (parent, gp1, gp2)
            const allSparks = [];
            ['parent', 'gp1', 'gp2'].forEach(section => {
                const sparks = (runner.sparks?.[section] || []).filter(s => s.color === color);
                allSparks.push(...sparks);
            });

            if (color === 'white') {
                // White sparks: Count entries
                const totalWhiteCount = allSparks.length;
                const parentSparks = (runner.sparks?.parent || []).filter(s => s.color === 'white');
                const parentCount = parentSparks.length;
                const names = allSparks.map(s => s.spark_name).join(', ') || 'No sparks';
                const parentCountDisplay = parentCount > 0 ? ` <span class="parent-count">(${parentCount})</span>` : '';
                
                html += `<td style="padding:8px;border:1px solid var(--uma-border-color);text-align:center;background-color:#f5f5f5;color:black;white-space:normal;word-wrap:break-word;" title="${names}">${totalWhiteCount}${parentCountDisplay}</td>`;
            } else {
                // Colored sparks: Aggregate by name and sum values (stars)
                const aggregated = {};
                ['parent', 'gp1', 'gp2'].forEach(section => {
                    const sparks = (runner.sparks?.[section] || []).filter(s => s.color === color);
                    sparks.forEach(s => {
                        if (!aggregated[s.spark_name]) {
                            aggregated[s.spark_name] = { total: 0, parent: 0 };
                        }
                        const count = parseInt(s.count || 0, 10);
                        aggregated[s.spark_name].total += count;
                        if (section === 'parent') {
                            aggregated[s.spark_name].parent += count;
                        }
                    });
                });

                const values = Object.entries(aggregated).map(([name, data]) => {
                    const parentDisplay = data.parent > 0 ? ` <span class="parent-count">(${data.parent})</span>` : '';
                    return `${data.total} ${name}${parentDisplay}`;
                }).join(', ') || '-';

                const names = Object.keys(aggregated).join(', ') || 'No sparks';
                
                html += `<td class="spark-${color}" style="padding:8px;border:1px solid var(--uma-border-color);text-align:center;text-shadow: 1px 1px 0 rgba(255,255,255,0.7);color:black;white-space:normal;word-wrap:break-word;" title="${names}">${values}</td>`;
            }
        });
        html += '</tr>';
    });

    html += '</tbody></table>';
    container.innerHTML = html;
}

/** Helper to create a table row. */
function addComparisonRow(label, runners, getValue, isNumeric) {
    const values = runners.map(getValue);
    let row = `<tr><td style="padding:12px;border:1px solid var(--uma-border-color);background-color:var(--uma-light-bg);font-weight:bold;">${label}</td>`;
    if (isNumeric) {
        const max = Math.max(...values.filter(v => typeof v === 'number'));
        const min = Math.min(...values.filter(v => typeof v === 'number'));
        values.forEach(val => {
            let style = 'padding:12px;border:1px solid var(--uma-border-color);text-align:center;';
            if (val === max && max !== min) style += 'background-color:rgba(76,175,80,0.2);font-weight:bold;';
            else if (val === min && max !== min) style += 'background-color:rgba(244,67,54,0.1);';
            row += `<td style="${style}">${val.toLocaleString()}</td>`;
        });
    } else {
        values.forEach(val => {
            const { gradeColor, topColor, bottomColor, outlineColor } = getGradeColors(val);
            const formattedGrade = formatGradeForDisplay(val);
            
            // Style matching .modal-apt-grade
            const style = `
                padding:12px;
                border:1px solid var(--uma-border-color);
                text-align:center;
                background-color:var(--uma-light-bg);
                font-weight:bold;
                font-size:1.4em;
                background-image: linear-gradient(to bottom, ${topColor}, ${gradeColor} 45%, ${bottomColor});
                -webkit-background-clip: text;
                background-clip: text;
                color: transparent;
                -webkit-text-stroke: 1px ${outlineColor};
                line-height: 1.1;
            `;
            
            row += `<td style="${style.replace(/\s+/g, ' ')}">${formattedGrade}</td>`;
        });
    }
    row += '</tr>';
    return row;
}
