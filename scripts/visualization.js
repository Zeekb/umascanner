// Visualization tab rendering and logic

import { state } from './state.js';

/**
 * Renders the Spark Coverage Map.
 * Visualizes which sparks are well-represented in the collection.
 */
export function renderSparkCoverageMap(filteredRunners = null) {
    const container = document.getElementById('spark-coverage-map-content');
    if (!container) return;

    const runners = filteredRunners || state.allRunners;

    // Count sparks by color and name (total, parent, and star counts)
    const sparkCounts = {
        blue: {},
        pink: {},
        green: {},
        white: {}
    };

    runners.forEach(runner => {
        ['parent', 'gp1', 'gp2'].forEach(source => {
            const sparks = runner.sparks?.[source] || [];
            sparks.forEach(spark => {
                if (spark && spark.spark_name && spark.color) {
                    const color = spark.color;
                    const name = spark.spark_name;
                    const stars = parseInt(spark.count || 0, 10);
                    
                    if (!sparkCounts[color][name]) {
                        sparkCounts[color][name] = { 
                            total: 0, 
                            parent: 0,
                            stars: { 1: 0, 2: 0, 3: 0 },
                            parentStars: { 1: 0, 2: 0, 3: 0 }
                        };
                    }
                    sparkCounts[color][name].total++;
                    if (source === 'parent') {
                        sparkCounts[color][name].parent++;
                    }
                    // Track star counts
                    if (stars >= 1 && stars <= 3) {
                        sparkCounts[color][name].stars[stars]++;
                        if (source === 'parent') {
                            sparkCounts[color][name].parentStars[stars]++;
                        }
                    }
                }
            });
        });
    });

    // Get current sort option from localStorage or default
    const currentSort = localStorage.getItem('sparkCoverageSortBy') || 'order';

    let html = '<div style="padding: 20px;">';
    html += '<h2 style="margin-top: 0;">Spark Coverage Map</h2>';
    html += '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">';
    html += '<p style="color: var(--uma-text-light); margin: 0;">Click on any spark to filter runners that have it</p>';
    html += '<div style="display: flex; align-items: center; gap: 10px;">';
    html += '<label for="spark-sort-select" style="font-weight: bold;">Sort by:</label>';
    html += '<select id="spark-sort-select" style="padding: 6px 12px; border-radius: 4px;">';
    html += `<option value="order" ${currentSort === 'order' ? 'selected' : ''}>Order (Default)</option>`;
    html += `<option value="alphabetical" ${currentSort === 'alphabetical' ? 'selected' : ''}>Alphabetical</option>`;
    html += `<option value="total" ${currentSort === 'total' ? 'selected' : ''}>Total Count</option>`;
    html += `<option value="parent" ${currentSort === 'parent' ? 'selected' : ''}>Parent Count</option>`;
    html += '</select>';
    html += '</div></div>';

    // Render each color category
    ['blue', 'pink', 'green', 'white'].forEach(color => {
        const colorSparks = sparkCounts[color];
        let sparkList = Object.keys(colorSparks).map(name => ({
            name,
            total: colorSparks[name].total,
            parent: colorSparks[name].parent,
            stars: colorSparks[name].stars,
            parentStars: colorSparks[name].parentStars
        }));
        
        if (sparkList.length === 0) return;

        // Sort based on selected option
        const orderedSparks = state.orderedSparks?.[color];
        if (currentSort === 'order' && orderedSparks) {
            // For white sparks, combine race and skill arrays
            const orderMap = new Map();
            if (color === 'white') {
                const raceList = orderedSparks.race || [];
                const skillList = orderedSparks.skill || [];
                [...raceList, ...skillList].forEach((name, idx) => orderMap.set(name, idx));
            } else {
                orderedSparks.forEach((name, idx) => orderMap.set(name, idx));
            }
            sparkList.sort((a, b) => {
                const aOrder = orderMap.get(a.name) ?? 999999;
                const bOrder = orderMap.get(b.name) ?? 999999;
                return aOrder - bOrder;
            });
        } else if (currentSort === 'alphabetical') {
            sparkList.sort((a, b) => a.name.localeCompare(b.name));
        } else if (currentSort === 'total') {
            sparkList.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
        } else if (currentSort === 'parent') {
            sparkList.sort((a, b) => b.parent - a.parent || a.name.localeCompare(b.name));
        }

        html += `<h3 style="text-transform: capitalize; color: var(--spark-${color}-bg); margin-top: 30px;">${color} Sparks ${(color !== 'blue' && color !== 'pink') ? `(${sparkList.length} unique)` : ''}</h3>`;
        html += '<div class="spark-coverage-grid">';

        sparkList.forEach(spark => {
            const colorClass = `spark-${color}`;
            const starBreakdown = `<span class="spark-star-span">1★:${spark.stars[1]}(${spark.parentStars[1]})</span><span class="spark-star-span">2★:${spark.stars[2]}(${spark.parentStars[2]})</span><span class="spark-star-span">3★:${spark.stars[3]}(${spark.parentStars[3]})</span>`;
            
            html += `
                <div class="spark-coverage-card ${colorClass} add-filter-click" 
                     data-filter-type="spark" 
                     data-filter-value="${spark.name}" 
                     data-filter-color="${color}"
                     title="Click to filter by ${spark.name}">
                    <div class="spark-coverage-count">${spark.total}<span class="parent-count">(${spark.parent})</span></div>
                    <div class="spark-coverage-name">${spark.name}</div>
                    <div class="spark-coverage-stars">${starBreakdown}</div>
                </div>
            `;
        });

        html += '</div>';
    });

    html += '</div>';
    container.innerHTML = html;

    // Add event listener for sort selection
    const sortSelect = document.getElementById('spark-sort-select');
    if (sortSelect) {
        sortSelect.addEventListener('change', (e) => {
            localStorage.setItem('sparkCoverageSortBy', e.target.value);
            renderSparkCoverageMap(runners);
        });
    }
}
