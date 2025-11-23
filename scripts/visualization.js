// Visualization tab rendering and logic

import { state } from './state.js';
import { getGradeColors, formatGradeForDisplay } from './utils.js';

/**
 * Renders the Spark Coverage Map.
 * Visualizes which sparks are well-represented in the collection.
 */
export function renderSparkCoverageMap() {
    const container = document.getElementById('spark-coverage-map-content');
    if (!container) return;

    // TODO: Implement spark coverage logic
    container.innerHTML = '<div style="padding: 20px; text-align: center; color: #888;">Spark Coverage Map coming soon...</div>';
}

/**
 * Renders the Aptitude Heatmap.
 * Visualizes aptitude distribution across all runners.
 */
export function renderAptitudeHeatmap() {
    const container = document.getElementById('aptitude-heatmap-content');
    if (!container) return;

    // TODO: Implement aptitude heatmap logic
    container.innerHTML = '<div style="padding: 20px; text-align: center; color: #888;">Aptitude Heatmap coming soon...</div>';
}
