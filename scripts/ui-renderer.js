// scripts/ui-renderer.js
import { state, CONSTANTS } from './state.js';
import { isDarkModeActive } from './ui-interactions.js';
import { 
    cleanName, findRunnerByDetails, getStatGrade, calculateRank, getAptitudeColor, 
    adjustColor, getGradeColors, formatGradeForDisplay, formatSkillName, getBaseChance 
} from './utils.js';

export function renderActiveTab(activeTabId, filteredData, allSparkCriteria) {
    if (activeTabId === 'parent-summary') {
        renderParentSummary(filteredData, allSparkCriteria);
    } 
    else if (activeTabId === 'white-sparks') {
        renderWhiteSparksSummary(filteredData, allSparkCriteria);
    }
    else if (activeTabId === 'skills-summary') {
        renderSkillsSummary(filteredData);
    }
    else if (activeTabId === 'legacies-planner') {
        renderLegaciesPlanner();
    }
    else if (activeTabId === 'grandparent-analysis') {
        renderGrandparentAnalysis(filteredData);
    }
    else if (activeTabId === 'inheritance-log') {
        renderInheritanceLog();
    }
    else if (activeTabId === 'useful-links') {
        renderUsefulLinks();
    }
}

function calculateMaxDepth(node) {
    if (!node.children || node.children.length === 0) {
        return 1;
    }

    const childDepths = node.children.map(child => calculateMaxDepth(child));
    return 1 + Math.max(...childDepths);
}

function renderParentSummary(runners, allSparkCriteria) {
    if (!runners.length) {
        state.elements.parentSummaryBody.innerHTML = '<tr><td colspan="14">No runners match filters.</td></tr>';
        return;
    }
    const html = runners.map(r => {
        let whiteTotal = 0, whiteParent = 0;
        if (r.sparks && typeof r.sparks === 'object'){
            ['parent', 'gp1', 'gp2'].forEach(source => {
                if(Array.isArray(r.sparks[source])) {
                    const count = r.sparks[source].filter(s => s?.color === 'white').length;
                    whiteTotal += count;
                    if (source === 'parent') whiteParent = count;
                }
            });
        }
        const whiteDisplay = `${whiteTotal}(${whiteParent})`;

        const gp1Exists = !!findRunnerByDetails(r.gp1, r.sparks?.gp1);
        const gp2Exists = !!findRunnerByDetails(r.gp2, r.sparks?.gp2);
        
        const gp1Class = gp1Exists ? 'gp-link' : 'gp-borrowed';
        const gp2Class = gp2Exists ? 'gp-link' : 'gp-borrowed';

        return `
        <tr data-entry-id="${r.entry_id || ''}">
            <td>${r.entry_id || 'N/A'}</td>
            <td ><span class="outline-label">${r.name || 'N/A'}</span></td>
            <td class="score-cell">${(r.score || 0).toLocaleString()}</td>
            <td class="stat-cell aptitude-${getStatGrade(r.speed)}">${r.speed || 0}</td>
            <td class="stat-cell aptitude-${getStatGrade(r.stamina)}">${r.stamina || 0}</td>
            <td class="stat-cell aptitude-${getStatGrade(r.power)}">${r.power || 0}</td>
            <td class="stat-cell aptitude-${getStatGrade(r.guts)}">${r.guts || 0}</td>
            <td class="stat-cell aptitude-${getStatGrade(r.wit)}">${r.wit || 0}</td>
            <td class="spark-cell">${formatSparks(r, allSparkCriteria)}</td>
            <td class="whites-cell">${whiteDisplay}</td>
            <td class="${gp1Class}">${cleanName(r.gp1 || 'N/A')}</td>
            <td class="${gp2Class}">${cleanName(r.gp2 || 'N/A')}</td>
            <td><button class="delete-button" data-entry-id="${r.entry_id || ''}">Transfer</button></td>
            </tr>
    `}).join('');
    state.elements.parentSummaryBody.innerHTML = html;
    hideEntryIdColumn('parent-summary');
}

function renderWhiteSparksSummary(runners, allSparkCriteria) {
    if (!runners.length) {
       state.elements.whiteSparksBody.innerHTML = '<tr><td colspan="7">No runners match filters.</td></tr>';
       return;
    }
 
    const raceSparks = state.orderedSparks?.white?.race || [];
    const skillSparks = state.orderedSparks?.white?.skill || [];
    const raceSparkOrder = new Map(raceSparks.map((name, index) => [name, index]));
    const skillSparkOffset = raceSparks.length;
    const skillSparkOrder = new Map(skillSparks.map((name, index) => [name, index + skillSparkOffset]));
    const unknownSparkOffset = skillSparkOffset + skillSparks.length;

    const getSparkSortValue = (sparkName) => {
        if (raceSparkOrder.has(sparkName)) {
            return raceSparkOrder.get(sparkName);
        }
        if (skillSparkOrder.has(sparkName)) {
            return skillSparkOrder.get(sparkName);
        }
        return unknownSparkOffset;
    };

    const html = runners.map(r => {
        let totalWhiteEntries = 0;
        let parentWhiteEntries = 0;
        
        const parentWhiteSparksLookup = {};
        if (Array.isArray(r.sparks?.parent)) {
            r.sparks.parent.forEach(spark => {
                if (spark?.color === 'white' && spark.spark_name) {
                    const name = spark.spark_name;
                    const count = parseInt(spark.count, 10) || 1;
                    parentWhiteSparksLookup[name] = (parentWhiteSparksLookup[name] || 0) + count;
                    parentWhiteEntries++;
                }
            });
        }
 
        const allWhiteSparksList = [];
        totalWhiteEntries = parentWhiteEntries;
 
        ['parent', 'gp1', 'gp2'].forEach(source => {
            if (Array.isArray(r.sparks?.[source])) {
                r.sparks[source].forEach(spark => {
                    if (spark?.color === 'white' && spark.spark_name) {
                        if (source !== 'parent') {
                            totalWhiteEntries++;
                        }
                        allWhiteSparksList.push({
                            name: spark.spark_name,
                            count: parseInt(spark.count, 10) || 1,
                            source: source 
                        });
                    }
                });
            }
        });
 
        const sourceOrder = { 'parent': 0, 'gp1': 1, 'gp2': 2 };
        allWhiteSparksList.sort((a, b) => {
            const aSourceOrder = sourceOrder[a.source];
            const bSourceOrder = sourceOrder[b.source];
            if (aSourceOrder !== bSourceOrder) {
                return aSourceOrder - bSourceOrder;
            }
 
            const aSortVal = getSparkSortValue(a.name);
            const bSortVal = getSparkSortValue(b.name);
            if (aSortVal !== bSortVal) {
                return aSortVal - bSortVal;
            }
            
            if (aSortVal === unknownSparkOffset && a.name !== b.name) {
                 return a.name.localeCompare(b.name);
            }
 
            return b.count - a.count;
        });

        let whiteSparksHtml = '';
        let previousSource = '';
        allWhiteSparksList.forEach(spark => {
            if (previousSource && spark.source !== previousSource) {
                whiteSparksHtml += '<div class="spark-separator"></div>';
            }
            previousSource = spark.source;

             let shouldHighlightName = false;
             if (r._passingWhiteSparks && r._passingWhiteSparks.has(spark.name)) {
                 shouldHighlightName = true;
             }
             const highlightClass = shouldHighlightName ? ' highlight' : '';
 
             let parentClass = '';
             let parentCountDisplay = '';
             let titleText = '';
 
             if (spark.source === 'parent') {
                 const parentTotalCount = parentWhiteSparksLookup[spark.name] || 0; 
                 parentClass = ' parent-spark';
                 parentCountDisplay = ` <span class="parent-count">(${parentTotalCount})</span>`;
                 titleText = `${r.name} (runner)`;
             } else if (spark.source === 'gp1') {
                titleText = `${cleanName(r.gp1) || 'Unknown'} (grandparent)`;
             } else if (spark.source === 'gp2') {
                titleText = `${cleanName(r.gp2) || 'Unknown'} (grandparent)`;
             }
 
             whiteSparksHtml += `
             <div class="spark-button white${highlightClass}" title="${titleText}">
                 <span>${spark.count}</span>
                 <span class="star${parentClass}">★</span>
                 <span class="spark-name">${spark.name}</span>
                 ${parentCountDisplay}
             </div>
             `;
         });
 
        const whiteDisplay = `${totalWhiteEntries}(${parentWhiteEntries})`;
        const gp1Exists = !!findRunnerByDetails(r.gp1, r.sparks?.gp1);
        const gp2Exists = !!findRunnerByDetails(r.gp2, r.sparks?.gp2);
        const gp1NameClass = gp1Exists ? 'gp-link' : 'gp-borrowed';
        const gp2NameClass = gp2Exists ? 'gp-link' : 'gp-borrowed';
 
       return `
       <tr data-entry-id="${r.entry_id || ''}">
           <td>${r.entry_id || 'N/A'}</td>
           <td ><span class="outline-label">${r.name || 'N/A'}</span></td>
           <td class="score-cell">${(r.score || 0).toLocaleString()}</td>
           <td class="whites-cell">${whiteDisplay}</td>
           <td class="spark-cell">
           <div class="spark-cell-container">${whiteSparksHtml || ''}</div>
           </td>
           <td class="${gp1NameClass}">${cleanName(r.gp1 || 'N/A')}</td>
           <td class="${gp2NameClass}">${cleanName(r.gp2 || 'N/A')}</td>
       </tr>
   `}).join('');
   state.elements.whiteSparksBody.innerHTML = html;
   hideEntryIdColumn('white-sparks');
}

function renderSkillsSummary(runners) {
    if (!runners.length) {
        state.elements.skillsSummaryBody.innerHTML = '<tr><td colspan="4">No runners match filters.</td></tr>';
        return;
    }

    const formatSkillBubbles = (runner) => {
        if (!runner.skills || runner.skills.length === 0) {
            return '';
        }

        const categorizedSkills = [];
        const speedCats = ['speed', 'acceleration', 'observation', 'startingGate', 'laneChange', 'unique', 'allRounder'];
        const categorySortOrder = {
            'recovery': 1,
            'passive': 2,
            'speed': 3,
            'debuff': 4,
            'detrimental': 5,
            'unknown': 6
        };
        runner.skills.forEach(skillName => {
            const skillType = state.skillData[skillName];
            let category = 'unknown';
            let tier = 'normal';

            if (skillType) {
                if (skillType.includes('detrimental')) category = 'detrimental';
                else if (skillType.includes('debuff')) category = 'debuff';
                else if (skillType.startsWith('recovery') || skillType.startsWith('unique_recovery')) category = 'recovery';
                else if (skillType.includes('passive')) category = 'passive';
                else if (speedCats.some(cat => skillType.startsWith(cat))) category = 'speed';
                
                if (skillType.endsWith('_gold')) tier = 'gold';
                else if (skillType.startsWith('unique_')) tier = 'unique';
            }
            
            categorizedSkills.push({
                name: skillName,
                category: category,
                tier: tier,
                sortOrder: categorySortOrder[category]
            });
        });

        categorizedSkills.sort((a, b) => {
            if (a.sortOrder !== b.sortOrder) {
                return a.sortOrder - b.sortOrder; 
            }
            const aTierSort = (a.tier === 'unique' || a.tier === 'gold') ? 0 : 1;
            const bTierSort = (b.tier === 'unique' || b.tier === 'gold') ? 0 : 1;
            if (aTierSort !== bTierSort) {
                return aTierSort - bTierSort;
            }
            return a.name.localeCompare(b.name); 
        });

        return categorizedSkills.map(skill => {
            const bubbleClasses = `skill-bubble ${skill.category} ${skill.tier}`;
            const formattedName = formatSkillName(skill.name); 
            return `<div class="${bubbleClasses}">${formattedName}</div>`;
        }).join('');
    };

    const html = runners.map(r => {
        const skillsHtml = formatSkillBubbles(r);

        return `
            <tr data-entry-id="${r.entry_id || ''}">
                <td>${r.entry_id || 'N/A'}</td>
                <td><span class="outline-label">${r.name || 'N/A'}</span></td>
                <td class="score-cell">${(r.score || 0).toLocaleString()}</td>
                <td class="left-align skill-cell">${skillsHtml}</td>
            </tr>
        `;
    }).join('');

    state.elements.skillsSummaryBody.innerHTML = html;
    hideEntryIdColumn('skills-summary');
}

function renderLegaciesPlanner() {
    const runnerNames = [...state.allRunnerNamesSet].sort();
    
    const parent1NameSelect = document.querySelector('#parent1-selection .runner-name-select');
    const parent1EntrySelect = document.querySelector('#parent1-selection .runner-entry-select');
    const parent1Details = document.querySelector('#parent1-selection .runner-details');

    const parent2NameSelect = document.querySelector('#parent2-selection .runner-name-select');
    const parent2EntrySelect = document.querySelector('#parent2-selection .runner-entry-select');
    const parent2Details = document.querySelector('#parent2-selection .runner-details');

    const affinitySelect = document.querySelector('#affinity-selection');
    const affinity = affinitySelect ? affinitySelect.value : 'double_circle';

    if (!state.elements.legaciesPlannerBody.dataset.initialized) {
        const defaultOption = '<option value="">Select a runner</option>';
        
        parent1NameSelect.innerHTML = defaultOption + runnerNames.map(n => `<option value="${n}">${n}</option>`).join('');
        parent2NameSelect.innerHTML = defaultOption + runnerNames.map(n => `<option value="${n}">${n}</option>`).join('');

        parent1NameSelect.addEventListener('change', () => {
            populateEntrySelect(parent1NameSelect, parent1EntrySelect, parent1Details);
        });
        parent2NameSelect.addEventListener('change', () => {
            populateEntrySelect(parent2NameSelect, parent2EntrySelect, parent2Details);
        });
        
        parent1EntrySelect.addEventListener('change', () => {
            displayParentDetails(parent1EntrySelect, parent1Details);
            renderLegaciesPlanner(); 
        });
        parent2EntrySelect.addEventListener('change', () => {
            displayParentDetails(parent2EntrySelect, parent2Details);
            renderLegaciesPlanner(); 
        });

        if (affinitySelect) {
            affinitySelect.addEventListener('change', renderLegaciesPlanner);
        }
        
        state.elements.legaciesPlannerBody.dataset.initialized = 'true';
    }
    
    const parent1EntryId = parent1EntrySelect.value;
    const parent2EntryId = parent2EntrySelect.value;

    displayParentDetails(parent1EntrySelect, parent1Details);
    displayParentDetails(parent2EntrySelect, parent2Details);

    if (parent1EntryId && parent2EntryId) {
        calculateOffspringPotential(parent1EntryId, parent2EntryId, affinity);
    } else {
        document.querySelector('.offspring-potential .spark-pool').innerHTML = '';
    }
}

function renderGrandparentAnalysis(filteredRunners) {
    const grandparentData = {};

    (filteredRunners || state.allRunners).forEach(runner => {
        const processGrandparent = (gpName, gpSparks, role) => {
            if (!gpName || gpName === 'N/A') return;
            const cleanedName = cleanName(gpName);
            if (!grandparentData[cleanedName]) {
                const gpAsRunner = findRunnerByDetails(gpName, gpSparks);
                grandparentData[cleanedName] = { 
                    name: cleanedName, 
                    total: 0, 
                    asGP1: 0, 
                    asGP2: 0, 
                    sparks: gpSparks || [],
                    runner: gpAsRunner
                };
            }
            grandparentData[cleanedName].total++;
            grandparentData[cleanedName][role]++;
        };
        processGrandparent(runner.gp1, runner.sparks?.gp1, 'asGP1');
        processGrandparent(runner.gp2, runner.sparks?.gp2, 'asGP2');
    });

    const sortedGrandparents = Object.values(grandparentData).sort((a, b) => b.total - a.total);
    const tableBody = document.getElementById('grandparent-summary-body');
    
    let html = sortedGrandparents.map(gp => {
        const topSparks = (gp.sparks)
            .filter(s => parseInt(s.count, 10) >= 3 || s.color === 'white')
            .map(s => `${s.spark_name} ${s.count}★`)
            .join(', ');
        
        const nameClass = gp.runner ? 'gp-link' : 'gp-borrowed';
        const entryIdAttr = gp.runner ? `data-entry-id="${gp.runner.entry_id}"` : '';

        return `
            <tr data-gp-name="${gp.name}" style="cursor: pointer;">
                <td class="${nameClass}" ${entryIdAttr}>${gp.name}</td>
                <td>${gp.total}</td>
                <td>${gp.asGP1}</td>
                <td>${gp.asGP2}</td>
                <td class="left-align">${topSparks}</td>
            </tr>
        `;
    }).join('');

    tableBody.innerHTML = html;
    document.getElementById('descendant-list-body').innerHTML = 'Click a grandparent to see their descendants.';

    if (!tableBody.dataset.initialized) {
        tableBody.addEventListener('click', (e) => {
            const row = e.target.closest('tr');
            if (!row) return;

            if (e.target.matches('.gp-link[data-entry-id]')) {
                const runner = state.allRunners.find(r => String(r.entry_id) === e.target.dataset.entryId);
                if (runner) showDetailModal(runner);
                return;
            }

            tableBody.querySelectorAll('tr').forEach(r => r.classList.remove('selected'));
            row.classList.add('selected');

            const gpName = row.dataset.gpName;
            const descendants = state.allRunners.filter(r => cleanName(r.gp1) === gpName || cleanName(r.gp2) === gpName);
            let descendantHtml = descendants.map(d => 
                `<li class="gp-link" data-entry-id="${d.entry_id}">
                    ${d.name} (Score: ${(d.score || 0).toLocaleString()})
                </li>`
            ).join('');
            document.getElementById('descendant-list-body').innerHTML = `<h5>Descendants of ${gpName}</h5><ul>${descendantHtml || '<li>None found in data.</li>'}</ul>`;
        });
        tableBody.dataset.initialized = 'true';
    }
}

function renderInheritanceLog() {
    const contentContainer = document.getElementById('inheritance-log-content');
    
    if (!contentContainer.querySelector('.inheritance-explanation')) {
        contentContainer.style.display = 'flex';
        contentContainer.style.gap = '20px';

        const mainContent = document.createElement('div');
        mainContent.className = 'inheritance-main';
        mainContent.style.flex = '3';

        const selectorWrapper = document.createElement('div');
        selectorWrapper.className = 'inheritance-search-container';
        
        selectorWrapper.innerHTML = `
            <select id="spark-select" class="runner-name-select"></select>
        `;
        mainContent.appendChild(selectorWrapper);
        
        const graph = document.createElement('div');
        graph.id = 'inheritance-graph';
        mainContent.appendChild(graph);

        contentContainer.innerHTML = '';
        contentContainer.appendChild(mainContent);

        const explanationDiv = document.createElement('div');
        explanationDiv.className = 'inheritance-explanation';
        explanationDiv.style.flex = '1';
        explanationDiv.style.padding = '15px';
        explanationDiv.style.border = '1px solid var(--uma-border-color)';
        explanationDiv.style.borderRadius = '5px';
        explanationDiv.style.alignSelf = 'flex-start';
        explanationDiv.innerHTML = `
            <h4 style="margin-top: 0;">What is this?</h4>
            <p style="font-size: 0.9em; line-height: 1.4;">
                The Inheritance Log visualizes the lineage of a single spark through your collection, creating a "family tree" for that specific trait.
            </p>
            <p style="font-size: 0.9em; line-height: 1.4;">
                This list is limited to the sparks in your data that have a family tree or 3 of more runners.
            </p>
            <h4>How to Use</h4>
            <p style="font-size: 0.9em; line-height: 1.4;">
                Select a spark from the dropdown. The list is filtered to only show sparks with inheritance chains of at least three generations.
            </p>
            <ul style="font-size: 0.9em; line-height: 1.4; padding-left: 20px;">
                <li>Each tree represents a distinct family line for the selected spark.</li>
                <li>The inheritance path (via which grandparent) is shown for each descendant.</li>
                <li>Click any runner's name to view their full details.</li>
            </ul>
        `;
        contentContainer.appendChild(explanationDiv);
    }

    const allSparks = new Set();
    state.allRunners.forEach(runner => {
        if (!runner.sparks) return;
        ['parent', 'gp1', 'gp2'].forEach(source => {
            if (Array.isArray(runner.sparks[source])) {
                runner.sparks[source].forEach(spark => {
                    if(spark.spark_name) allSparks.add(spark.spark_name);
                });
            }
        });
    });

    const sortedSparks = [...allSparks].sort();
    const sparksWithSufficientDepth = sortedSparks.filter(sparkName => {
        const chains = traceInheritance(sparkName);
        if (!chains || chains.length === 0) {
            return false;
        }
        const maxDepth = Math.max(...chains.map(sourceNode => calculateMaxDepth(sourceNode)));
        return maxDepth >= 3;
    });

    const sparkSelect = document.getElementById('spark-select');
    
    const currentVal = sparkSelect.value;
    sparkSelect.innerHTML = '<option value="">Select a deep-rooted spark</option>' + sparksWithSufficientDepth.map(s => `<option value="${s}">${s}</option>`).join('');
    if (sparksWithSufficientDepth.includes(currentVal)) {
        sparkSelect.value = currentVal;
    }

    if (!sparkSelect.dataset.initialized) {
        sparkSelect.addEventListener('change', renderInheritanceLog);
        sparkSelect.dataset.initialized = 'true';
    }
    
    const selectedSpark = sparkSelect.value;
    const graphContainer = document.getElementById('inheritance-graph');
    if (selectedSpark) {
        const chains = traceInheritance(selectedSpark);
        renderInheritanceGraph(chains, graphContainer);
    } else {
        graphContainer.innerHTML = 'Select a spark to see its inheritance tree.';
    }
}

function renderUsefulLinks() {
    
}

function traceInheritance(sparkName) {
    const nodes = new Map();
    state.allRunners.forEach(r => {
        const parentSparks = r.sparks?.parent || [];
        const sparkInstance = parentSparks.find(s => s.spark_name === sparkName);
        if (sparkInstance) {
            nodes.set(r.entry_id, { 
                runner: r, 
                sparkLevel: parseInt(sparkInstance.count, 10) || 1, 
                children: [] 
            });
        }
    });

    if (nodes.size === 0) return [];

    const hasParentInSet = new Set();

    nodes.forEach(node => {
        const runner = node.runner;

        const checkAndLinkParent = (gpName, gpSparks) => {
            const parentRunner = findRunnerByDetails(gpName, gpSparks);
            if (parentRunner && nodes.has(parentRunner.entry_id)) {
                nodes.get(parentRunner.entry_id).children.push(node);
                hasParentInSet.add(runner.entry_id);
            }
        };

        checkAndLinkParent(runner.gp1, runner.sparks?.gp1);
        checkAndLinkParent(runner.gp2, runner.sparks?.gp2);
    });

    const sources = [...nodes.values()].filter(node => !hasParentInSet.has(node.runner.entry_id));

    sources.sort((a,b) => (b.runner.score || 0) - (a.runner.score || 0));

    return sources;
}

function buildTreeHtml(node, parentNode = null) {
    const r = node.runner;
    const sl = node.sparkLevel;

    let inheritancePath = '';
    if (parentNode) {
        const parentRunner = parentNode.runner;
        let via = null;

        if (cleanName(r.gp1) === parentRunner.name) {
            via = cleanName(r.gp1);
        } 
        else if (cleanName(r.gp2) === parentRunner.name) {
            via = cleanName(r.gp2);
        }

        if (via) {
            inheritancePath = `<div class="inheritance-via">via ${via}</div>`;
        }
    }

    let html = `<li>
        <span class="gp-link" data-entry-id="${r.entry_id}">
            ${r.name} (Score: ${(r.score || 0).toLocaleString()}) - <b>${sl}★</b>
        </span>`;
    
    if (node.children && node.children.length > 0) {
        html += `<ul>`;
        node.children.sort((a, b) => (b.runner.score || 0) - (a.runner.score || 0));
        for (const child of node.children) {
            html += buildTreeHtml(child, node);
        }
        html += `</ul>`;
    }
    
    html += `</li>`;
    return html;
}

function renderInheritanceGraph(sources, container) {

    const deepChains = sources.filter(sourceNode => calculateMaxDepth(sourceNode) >= 3);

    if (!deepChains || deepChains.length === 0) {
        container.innerHTML = "<p>No inheritance chains found for this spark in your collection.</p>";
        return;
    }

    let html = deepChains.map(sourceNode => {
        return `<ul class="inheritance-tree">${buildTreeHtml(sourceNode)}</ul>`;
    }).join('');

    container.innerHTML = html;
}

// --- Helper functions for rendering ---

function hideEntryIdColumn(tabId) {
    const table = document.querySelector(`#${tabId} table`);
    if (!table) return;
    const headerCell = table.querySelector('thead th:first-child');
    const bodyCells = table.querySelectorAll('tbody td:first-child');
    if (headerCell) headerCell.style.display = 'none';
    bodyCells.forEach(cell => cell.style.display = 'none');
} 

function formatSparks(runner, allSparkCriteria) {
    const blueSparks = state.orderedSparks?.blue || [];
    const pinkSparks = state.orderedSparks?.pink || [];
    const greenSparks = state.orderedSparks?.green || [];
    const blueSparkOrder = new Map(blueSparks.map((name, index) => [name, index]));
    const pinkSparkOrder = new Map(pinkSparks.map((name, index) => [name, index]));
    const greenSparkOrder = new Map(greenSparks.map((name, index) => [name, index]));
    const colorOrder = { 'blue': 0, 'pink': 1, 'green': 2 };
    const maxSortVal = blueSparks.length + pinkSparks.length + greenSparks.length;

    const getSparkSortValue = (spark) => {
        if (spark.color === 'blue' && blueSparkOrder.has(spark.name)) {
            return blueSparkOrder.get(spark.name);
        }
        if (spark.color === 'pink' && pinkSparkOrder.has(spark.name)) {
            return pinkSparkOrder.get(spark.name);
        }
        if (spark.color === 'green' && greenSparkOrder.has(spark.name)) {
            return greenSparkOrder.get(spark.name);
        }
        return maxSortVal;
    };
    
    const allSparks = [];
    const parentSparksLookup = {};

    if (Array.isArray(runner.sparks?.parent)) {
        runner.sparks.parent.forEach(spark => {
            if (spark?.spark_name) {
                const name = spark.spark_name;
                const count = parseInt(spark.count || 0);
                if (!parentSparksLookup[name]) {
                    parentSparksLookup[name] = 0;
                }
                parentSparksLookup[name] += count;
            }
        });
    }

    const aggregatedSparks = {};
    ['parent', 'gp1', 'gp2'].forEach(source => {
        if (Array.isArray(runner.sparks?.[source])) {
            runner.sparks[source].forEach(spark => {
                if (spark?.color && ['blue', 'pink', 'green'].includes(spark.color) && spark.spark_name) {
                    const name = spark.spark_name;
                    if (!aggregatedSparks[name]) {
                        aggregatedSparks[name] = {
                            name: name,
                            color: spark.color,
                            totalCount: 0,
                            parentCount: parentSparksLookup[name] || 0,
                            isParent: (parentSparksLookup[name] || 0) > 0
                        };
                    }
                    aggregatedSparks[name].totalCount += parseInt(spark.count || 0);
                }
            });
        }
    });

    for (const spark of Object.values(aggregatedSparks)) {
        let shouldHighlight = false;
        for (const criteria of allSparkCriteria) {
            const countToCheck = criteria.isRepOnly ? spark.parentCount : spark.totalCount;
            const nameFilter = criteria[`${spark.color}Spark`];
            const minCount = criteria[`min${spark.color.charAt(0).toUpperCase() + spark.color.slice(1)}`];

            if (nameFilter) {
                if (spark.name.toLowerCase().includes(nameFilter.toLowerCase()) && countToCheck >= (minCount === 0 ? 1 : minCount)) {
                    shouldHighlight = true;
                    break;
                }
            } else if (minCount > 0 && countToCheck >= minCount) {
                shouldHighlight = true;
                break;
            }
        }
        spark.highlight = shouldHighlight;
        allSparks.push(spark);
    }

    allSparks.sort((a, b) => {
        const colorA = colorOrder[a.color];
        const colorB = colorOrder[b.color];
        if (colorA !== colorB) {
            return colorA - colorB;
        }

        if (a.isParent && !b.isParent) {
            return -1; 
        }
        if (!a.isParent && b.isParent) {
            return 1; 
        }

        const aSortVal = getSparkSortValue(a);
        const bSortVal = getSparkSortValue(b);
        if (aSortVal !== bSortVal) {
            return aSortVal - bSortVal;
        }

        return a.name.localeCompare(b.name);
    });
    
    const nameMap = {
        'Front Runner': 'Front',
        'Pace Chaser': 'Pace',
        'Late Surger': 'Late',
        'End Closer': 'End'
    };

    const parts = allSparks.map(spark => {
        const highlightClass = spark.highlight ? ' highlight' : '';
        const parentCountDisplay = spark.parentCount > 0 ? ` <span class="parent-count">(${spark.parentCount})</span>` : '';
        
        const displayName = nameMap[spark.name] || spark.name;

        return `
            <div class="spark-button ${spark.color}${highlightClass}">
                <span>${spark.totalCount}</span>
                <span class="star${spark.parentCount > 0 ? ' parent-spark' : ''}">★</span>
                <span class="spark-name">${displayName}</span>
                ${parentCountDisplay}
            </div>
        `;
    });

    return parts.length > 0 ? `<div class="spark-cell-container">${parts.join('')}</div>` : '';
}

function populateEntrySelect(nameSelect, entrySelect, detailsDiv) {
    const runnerName = nameSelect.value;
    
    const entries = state.allRunners
        .filter(r => r.name === runnerName)
        .sort((a,b) => b.score - a.score);
    
    entrySelect.innerHTML = '<option value="">Select an entry</option>';
    
    if (entries.length > 0) {
        const nameMap = {
            'Front Runner': 'Front',
            'Pace Chaser': 'Pace',
            'Late Surger': 'Late',
            'End Closer': 'End'
        };

        entrySelect.innerHTML += entries.map(entry => {
            const parentSparksLookup = {};
            let whiteParent = 0;
            if (Array.isArray(entry.sparks?.parent)) {
                entry.sparks.parent.forEach(spark => {
                    if (spark?.spark_name) {
                        if (spark.color === 'blue' || spark.color === 'pink') {
                            const name = spark.spark_name;
                            const count = parseInt(spark.count || 0, 10);
                            parentSparksLookup[name] = (parentSparksLookup[name] || 0) + count;
                        } else if (spark.color === 'white') {
                            whiteParent++; 
                        }
                    }
                });
            }

            const aggregatedSparks = {};
            ['parent', 'gp1', 'gp2'].forEach(source => {
                if (Array.isArray(entry.sparks?.[source])) {
                    entry.sparks[source].forEach(spark => {
                        if (spark?.color && (spark.color === 'blue' || spark.color === 'pink') && spark.spark_name) {
                            const name = spark.spark_name;
                            if (!aggregatedSparks[name]) {
                                aggregatedSparks[name] = {
                                    name: name,
                                    color: spark.color,
                                    totalCount: 0,
                                    parentCount: parentSparksLookup[name] || 0 
                                };
                            }
                            aggregatedSparks[name].totalCount += parseInt(spark.count || 0, 10);
                        }
                    });
                }
            });
            
            const blueSparkOrder = new Map((state.orderedSparks?.blue || []).map((name, index) => [name, index]));
            const pinkSparkOrder = new Map((state.orderedSparks?.pink || []).map((name, index) => [name, index]));
            const maxSortVal = blueSparkOrder.size + pinkSparkOrder.size;
            
            const colorSortOrder = { 'blue': 1, 'pink': 2};
            
            const sortedSparkValues = Object.values(aggregatedSparks).sort((a, b) => {
                const colorA = colorSortOrder[a.color];
                const colorB = colorSortOrder[b.color];
                if (colorA !== colorB) return colorA - colorB; 

                const getSortVal = (spark) => {
                    if (spark.color === 'blue') return blueSparkOrder.get(spark.name) ?? maxSortVal;
                    if (spark.color === 'pink') return pinkSparkOrder.get(spark.name) ?? maxSortVal;
                    return maxSortVal;
                };

                const sortA = getSortVal(a);
                const sortB = getSortVal(b);
                if (sortA !== sortB) return sortA - sortB;

                return b.totalCount - a.totalCount;
            });

            let blueSparksStr = '';
            let pinkSparksStr = '';

            sortedSparkValues.forEach(spark => {
                const displayName = nameMap[spark.name] || spark.name;
                const parentDisplay = spark.parentCount > 0 ? `(${spark.parentCount})` : '';
                const formattedSpark = `${displayName} ${spark.totalCount}${parentDisplay}★`;
                
                if (spark.color === 'blue') {
                    blueSparksStr += `${formattedSpark} `;
                } else if (spark.color === 'pink') {
                    pinkSparksStr += `${formattedSpark} `;
                }
            });

            blueSparksStr = blueSparksStr.trim();
            pinkSparksStr = pinkSparksStr.trim();

            let labelParts = [`Score: ${entry.score}`];
            if (blueSparksStr) labelParts.push(`${blueSparksStr}`);
            if (pinkSparksStr) labelParts.push(`${pinkSparksStr}`);
            labelParts.push(`Whites: x${whiteParent}★`);
            
            const label = labelParts.join(' | ');
            
            return `<option value="${entry.entry_id}">${label}</option>`;
        }).join('');
        entrySelect.style.display = 'block';
    } else {
        entrySelect.style.display = 'none';
    }

    detailsDiv.innerHTML = '';
    renderLegaciesPlanner();
}

function displayParentDetails(entrySelect, detailsElement) {
    const entryId = entrySelect.value;
    const runner = state.allRunners.find(r => String(r.entry_id) === String(entryId));
    
    if (runner) {
        const hasGreenParentSpark = runner.sparks?.parent?.some(s => s.color === 'green');
        let nameForImage = hasGreenParentSpark ? runner.name : `${runner.name} c`;
        nameForImage = (nameForImage || 'N/A').trim().replace(/ /g, '_');
        const runnerImgPath = `./assets/profile_images/${nameForImage}.png`;

        let sparksHtml = '';
        if(runner.sparks && runner.sparks.parent) {
            sparksHtml = runner.sparks.parent.map(s => `${s.spark_name} ${s.count}★`).join(', ');
        }

        detailsElement.innerHTML = `
            <img src="${runnerImgPath}" class="breeder-image" onerror="this.onerror=null; this.src='./assets/gui_icons/icon.png'; this.style.opacity=0.5;">
            <p><b>Score:</b> ${(runner.score || 0).toLocaleString()}</p>
            <div><b>Sparks:</b> ${sparksHtml || 'None'}</div>
        `;
    } else {
        detailsElement.innerHTML = '';
    }
}

function calculateOffspringPotential(parent1EntryId, parent2EntryId, affinity) {
    const parent1 = state.allRunners.find(r => String(r.entry_id) === String(parent1EntryId));
    const parent2 = state.allRunners.find(r => String(r.entry_id) === String(parent2EntryId));
    if (!parent1 || !parent2) return;

    const sparkPool = {};
    const ancestorList = {};

    const addSparksToPool = (runner, role) => {
        if (!runner || !runner.sparks || !runner.sparks.parent) {
            ancestorList[role] = { name: role, found: false };
            return;
        }
        ancestorList[role] = { name: runner.name, found: true, entry_id: runner.entry_id };
        
        runner.sparks.parent.forEach(spark => {
            if (!spark.spark_name) return;
            
            if (!sparkPool[spark.spark_name]) {
                sparkPool[spark.spark_name] = { 
                    name: spark.spark_name, 
                    color: spark.color, 
                    instances: []
                };
            }
            
            sparkPool[spark.spark_name].instances.push({
                role: role,
                stars: parseInt(spark.count, 10)
            });
        });
    };

    addSparksToPool(parent1, 'Parent 1');
    addSparksToPool(parent2, 'Parent 2');

    const gp1_1 = findRunnerByDetails(parent1.gp1, parent1.sparks?.gp1);
    const gp1_2 = findRunnerByDetails(parent1.gp2, parent1.sparks?.gp2);
    const gp2_1 = findRunnerByDetails(parent2.gp1, parent2.sparks?.gp1);
    const gp2_2 = findRunnerByDetails(parent2.gp2, parent2.sparks?.gp2);

    addSparksToPool(gp1_1, parent1.gp1 || 'P1-GP1');
    addSparksToPool(gp1_2, parent1.gp2 || 'P1-GP2');
    addSparksToPool(gp2_1, parent2.gp1 || 'P2-GP1');
    addSparksToPool(gp2_2, parent2.gp2 || 'P2-GP2');
    
    const colorSortOrder = { 'blue': 1, 'pink': 2, 'green': 3, 'white': 4 };

    const sortedSparks = Object.values(sparkPool).sort((a, b) => {
        const colorA = colorSortOrder[a.color] || 5;
        const colorB = colorSortOrder[b.color] || 5;
        if (colorA !== colorB) {
            return colorA - colorB;
        }
        return b.instances.length - a.instances.length; 
    });

    const statMultiplier = state.inspirationData.affinity_bonuses.stat_multiplier.multipliers[affinity] || 1.0;

    let html = sortedSparks.map(spark => {
        let totalStars = 0;
        let individualChances = [];

        spark.instances.forEach(instance => {
            const isParent = instance.role.startsWith('Parent');
            const baseChance = getBaseChance(spark.color, instance.stars);
            const effectiveChance = isParent ? baseChance : (baseChance / 2); 
            
            const probOverThreeEvents_Individual = (1 - Math.pow(1 - effectiveChance, 3));
            individualChances.push(probOverThreeEvents_Individual);
            
            totalStars += instance.stars;
        });

        let combinedProbOfNotInheriting = 1.0;
        individualChances.forEach(chance => {
            combinedProbOfNotInheriting *= (1 - chance);
        });
        const finalCombinedChance = 1 - combinedProbOfNotInheriting;
        const chancePercent = (finalCombinedChance * 100).toFixed(1);

        let chanceBreakdown = '';
        if (individualChances.length > 1) {
            chanceBreakdown = ` (${individualChances.map(c => (c*100).toFixed(1) + '%').join(' + ')})`;
        }

        let bonusInfo = '';
        if (spark.color === 'blue') {
            bonusInfo = ` <span class="spark-bonus-info">(+${((statMultiplier - 1) * 100).toFixed(0)}% stat bonus)</span>`;
        }

        return `<div class="spark-potential spark-color-${spark.color}">
            <b>${spark.name}</b>${bonusInfo}
            <div class="spark-details">
                (Total: ${totalStars}★ from ${spark.instances.length} contributors)
                <b>Total Chance: ~${chancePercent}%${chanceBreakdown}</b>
            </div>
        </div>`;
    }).join('');

    const affinityNote = `<p class="affinity-note"><b>Note:</b> ${state.inspirationData.affinity_bonuses.roll_bonus.description}</p>`;

    document.querySelector('.spark-pool').innerHTML = `${affinityNote}${html || '<p>No inheritable sparks found from parents or known grandparents.</p>'}`;
}

export function showDetailModal(runner, displayName) {
    const existingModal = document.getElementById('detail-modal-overlay');
    if (existingModal) existingModal.remove();

    const overlay = document.createElement('div');
    overlay.id = 'detail-modal-overlay';
    overlay.onclick = (e) => {
        if (e.target.id === 'detail-modal-overlay') {
             overlay.remove();
        }
    };

    const modal = document.createElement('div');
    modal.id = 'detail-modal';

    const header = document.createElement('div');
    header.className = 'modal-header';
    
    let nameForImage;
    if (displayName) {
        nameForImage = displayName;
    } else {
        const hasGreenParentSpark = runner.sparks?.parent?.some(s => s.color === 'green');
        nameForImage = hasGreenParentSpark ? runner.name : runner.name + ' c';
    }
    nameForImage = nameForImage || 'N/A';
    
    const runnerName = runner.name || 'N/A';
    const runnerImgName = nameForImage.trim().replace(/ /g, '_');
    const runnerImgPath = `./assets/profile_images/${runnerImgName}.png`;
    
    const score = runner.score || 0;
    const rankGrade = calculateRank(score);
    const rankColor = getAptitudeColor(rankGrade);
    const rankTopColor = adjustColor(rankColor, 40);
    const rankRibbonColor = adjustColor(rankColor, -25);
    const rankStyle = `
        --rank-base-color: ${rankColor};
        --rank-top-color: ${rankTopColor};
        --rank-ribbon-color: ${rankRibbonColor};
    `;
    const baseGradeLetter = rankGrade.replace('<sup>+</sup>', '').replace('+', '').replace('SS', 'S');
    const rankClass = `modal-rank-grade rank-fix-${baseGradeLetter}`;

    header.innerHTML = `
        <div class="modal-header-left">
            <div class="modal-profile-frame">
                <div class="modal-profile-frame-outline">
                    <div class="modal-profile-img" style="background-image: url('${runnerImgPath}')"></div>
                </div>
            </div>
            <div class="modal-score">${score.toLocaleString()}</div>
        </div>
        <div class="modal-header-right">
            <div class="modal-identity">
                <div class="modal-rank-container" style="${rankStyle}">
                    <div class="modal-rank-badge">
                        <div class="${rankClass}">${rankGrade}</div>
                        <div class="modal-rank-text">RANK</div>
                    </div>
                </div>
                <div class="modal-runner-name">${runnerName.replace(' ', ' ')}</div>
            </div>
        </div>
    `;

    const content = document.createElement('div');
    content.id = 'detail-modal-content';

    const statsBar = document.createElement('div');
    statsBar.className = 'modal-stats-bar';
    let statsHtml = '';
    ['speed', 'stamina', 'power', 'guts', 'wit'].forEach(stat => {
        const value = runner[stat] || 0;
        const grade = getStatGrade(value);
        const { gradeColor, topColor, bottomColor, outlineColor } = getGradeColors(grade);
        
        statsHtml += `
            <div class="modal-stat-column">
                <div class="modal-stat-header">
                    <img class="stat-icon" src="./assets/stat_icons/${CONSTANTS.STAT_ICONS[stat]}" alt="${stat}">
                    <span class="stat-text">${stat.charAt(0).toUpperCase() + stat.slice(1)}</span>
                </div>
                <div class="modal-stat-content">
                    <div class="modal-stat-grade stat-outline" style="--stat-outline-color: ${outlineColor}; background-image: linear-gradient(to bottom, ${topColor}, ${bottomColor});">
                        ${formatGradeForDisplay(grade)}
                    </div>
                    <div class="modal-stat-value">${value}</div>
                </div>
            </div>
        `;
    });
    statsBar.innerHTML = statsHtml;
    content.appendChild(statsBar);

    const aptitudes = document.createElement('div');
    aptitudes.className = 'modal-aptitudes';
    let aptsHtml = '';
    const aptTypes = {
        'Track': ['turf', 'dirt'],
        'Distance': ['sprint', 'mile', 'medium', 'long'],
        'Style': ['front', 'pace', 'late', 'end']
    };


    Object.entries(aptTypes).forEach(([typeLabel, aptKeys]) => {
        aptsHtml += `<div class="modal-apt-label">${typeLabel}</div>`;
        aptKeys.forEach(key => {
            const grade = runner[`${key}`]?.toUpperCase() || 'G';
            const { gradeColor, topColor, bottomColor, outlineColor } = getGradeColors(grade);
            aptsHtml += `
                <div class="modal-apt-button">
                    <div class="modal-apt-name">${key.charAt(0).toUpperCase() + key.slice(1)}</div>
                    <div class="modal-apt-grade apt-outline" style="--apt-outline-color: ${outlineColor}; background-image: linear-gradient(to bottom, ${topColor}, ${bottomColor});">
                        ${formatGradeForDisplay(grade)}
                    </div>
                </div>
            `;
        });
        if (aptKeys.length < 4) {
            aptsHtml += `<div style="grid-column: span ${4 - aptKeys.length};"></div>`;
        }
    });
    aptitudes.innerHTML = aptsHtml;
    content.appendChild(aptitudes);
    
    const modalTabs = document.createElement('div');
    modalTabs.className = 'modal-tabs';
    modalTabs.innerHTML = `
        <button class="modal-tab-button active" data-tab="skills">Skills</button>
        <button class="modal-tab-button" data-tab="inspiration">Inspiration</button>
    `;
    content.appendChild(modalTabs);

    const tabContentContainer = document.createElement('div');
    tabContentContainer.className = 'modal-tab-content-container';

    const skillsPanel = document.createElement('div');
    skillsPanel.id = 'modal-skills-panel';
    skillsPanel.className = 'modal-tab-panel active';
    
    const skillsList = document.createElement('div');
    skillsList.className = 'modal-skills-list';
    let skillsHtml = '';
    const runnerSkills = runner.skills || [];
    if (runnerSkills.length > 0) {
        let unique_set = false;
        runnerSkills.forEach(skillName => {
            const skillType = state.skillData[skillName] || null;
            let itemClass = 'modal-skill-item';
            if (skillType) {
                if (skillType.startsWith('unique') && !unique_set) {
                    unique_set = true
                    itemClass += ' unique';
                } else if (skillType.endsWith('_gold')) { 
                    itemClass += ' gold';
                }
            }
            const iconPath = skillType ? `./assets/skill_icons/${skillType}.png` : '';
            const iconStyle = iconPath ? `background-image: url('${iconPath}')` : '';
            
            skillsHtml += `
                <div class="${itemClass}">
                    <div class="modal-skill-icon" style="${iconStyle}"></div>
                    <div class="modal-skill-name">${formatSkillName(skillName)}</div>
                </div>
            `;
        });
    } else {
        skillsHtml = '<div style="grid-column: span 2; text-align: center; color: #888;">No skills listed.</div>';
    }
    skillsList.innerHTML = skillsHtml;
    skillsPanel.appendChild(skillsList);
    tabContentContainer.appendChild(skillsPanel);

    const sparksPanel = document.createElement('div');
    sparksPanel.id = 'modal-inspiration-panel';
    sparksPanel.className = 'modal-tab-panel';
    sparksPanel.innerHTML = generateSparksHtml(runner);
    tabContentContainer.appendChild(sparksPanel);
    content.appendChild(tabContentContainer);

    const footer = document.createElement('div');
    footer.className = 'modal-footer';
    footer.innerHTML = '<button id="modal-close-button">Close</button>';
    footer.querySelector('#modal-close-button').onclick = () => overlay.remove();

    modal.appendChild(header);
    modal.appendChild(content);
    modal.appendChild(footer);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    modal.querySelectorAll('.modal-tab-button').forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.dataset.tab;
            modal.querySelectorAll('.modal-tab-button').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            modal.querySelectorAll('.modal-tab-panel').forEach(panel => {
                panel.classList.toggle('active', panel.id === `modal-${tabName}-panel`);
            });
        });
    });
}

function generateSparksHtml(runner) {
    let html = '<div class="modal-sparks-list">';

    const createSection = (sourceRunner, sparks, fallbackName) => {
        if (!sparks || sparks.length === 0) return '';

        let sourceImgPath = './assets/gui_icons/icon.png';
        let nameForImage = '';

        if (sourceRunner) {
            const hasGreen = sourceRunner.sparks?.parent?.some(s => s.color === 'green');
            nameForImage = hasGreen ? sourceRunner.name : `${sourceRunner.name} c`;
        } else if (fallbackName) {
            nameForImage = fallbackName;
        }

        if (nameForImage) {
            const runnerImgName = nameForImage.trim().replace(/ /g, '_');
            sourceImgPath = `./assets/profile_images/${runnerImgName}.png`;
        }

        const profileImgClass = sourceRunner ? 'modal-profile-img' : 'modal-profile-img not-in-data';

        let sectionHtml = `
            <div class="spark-legacy-section">
                <div class="spark-legacy-image-container">
                    <div class="spark-legacy-frame-scaler"> 
                        <div class="modal-profile-frame">
                            <div class="modal-profile-frame-outline">
                                <div class="${profileImgClass}" style="background-image: url('${sourceImgPath}');">
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="spark-items-grid">
        `;

        sparks.forEach(spark => {
            const count = parseInt(spark.count, 10) || 1;
            const solidStars = '★'.repeat(count);
            const emptyCount = Math.max(0, 3 - count);
            const emptyStars = '☆'.repeat(emptyCount);
            const starsHtml = `<span class="solid-stars">${solidStars}</span><span class="empty-stars">${emptyStars}</span>`

            sectionHtml += `
            <div class="spark-item spark-${spark.color}">
                <span class="spark-item-name">${spark.spark_name}</span>
                <span class="spark-item-stars">${starsHtml}</span>
            </div>
            `;
        });

        sectionHtml += `</div></div>`;
        return sectionHtml;
    };

    html += createSection(runner, runner.sparks?.parent, runner.name);

    html += `<div class="legacy-bar-container"><p class="legacy-bar-label">Legacy Sparks:</p><hr class="legacy-bar" /></div>`

    const gp1 = findRunnerByDetails(runner.gp1, runner.sparks?.gp1);
    html += createSection(gp1, runner.sparks?.gp1, runner.gp1);

    const gp2 = findRunnerByDetails(runner.gp2, runner.sparks?.gp2);
    html += createSection(gp2, runner.sparks?.gp2, runner.gp2);

    html += '</div>';
    return html;
}