// scripts/data-loader.js
import { state } from './state.js';
import { initializeApp, showError } from './main.js';

export async function handleFileLoad() {
    const file = state.elements.fileInput.files[0];

    state.elements.loadingMessage.style.display = 'block';
    state.elements.errorMessage.style.display = 'none';

    if (!file) {
        showError('Please select a file first.');
        return;
    }

    let fileContent;
    try {
        fileContent = await file.text();
        state.allRunners = JSON.parse(fileContent);
    } catch (err) {
        showError(`Error reading file: ${err.message}`);
        return;
    }

    if (!Array.isArray(state.allRunners)) {
        showError('Invalid file format. The JSON file must contain an array of runners.');
        return;
    }
    
    try {
        localStorage.setItem('savedRunnerData', fileContent);
    } catch (e) {
        console.error("Could not save to localStorage:", e);
    }

    await loadGameDataAndInitialize();
}

export async function handleTestFileLoad() {
    state.elements.loadingMessage.style.display = 'block';
    state.elements.errorMessage.style.display = 'none';

    try {
        const response = await fetch('./assets/all_runners_Zeek.json');
        if (!response.ok) throw new Error(`Could not find file: ${response.statusText}`);
        const fileContent = await response.text();
        state.allRunners = JSON.parse(fileContent);

        if (!Array.isArray(state.allRunners)) {
            showError('Invalid test file format. The JSON file must contain an array of runners.');
            return;
        }
        
        localStorage.setItem('savedRunnerData', fileContent);
    } catch (err) {
        showError(`Error loading test file (all_runners_Zeek.json): ${err.message}. <br>Make sure the file is in the 'assets' folder.`);
        return;
    }

    await loadGameDataAndInitialize();
}

export async function loadFromSavedData(jsonData) {
    state.elements.loadingMessage.style.display = 'block';
    state.elements.errorMessage.style.display = 'none';
    
    try {
        state.allRunners = JSON.parse(jsonData);
    } catch (e) {
        showError('Error parsing saved data. Please load a file again.');
        localStorage.removeItem('savedRunnerData');
        state.elements.loadDataButton.addEventListener('click', handleFileLoad);
        return;
    }

    await loadGameDataAndInitialize();
}

async function loadGameDataAndInitialize() {
    try {
        const [skillData, uniqueSkillsData, orderedSparks, inheritanceModel] = await Promise.all([
            fetch('./data/skills.json').then(res => res.json()),
            fetch('./data/runner_skills.json').then(res => res.json()),
            fetch('./data/sparks.json').then(res => res.json()),
            fetch('./data/umamusume_inheritance_model.json').then(res => res.json())
        ]);

        state.skillData = skillData || {};
        state.runnerUniqueSkills = uniqueSkillsData || {};
        state.orderedSparks = orderedSparks || {};
        state.inheritanceModel = inheritanceModel || {};
        state.orderedSkills = Object.keys(state.skillData);

        initializeApp();
    } catch (err) {
        showError(`Failed to load game data (skills.json, etc.): ${err.message}`);
    }
}

export function extractSparkNames() {
    const extracted = { blue: new Set(), green: new Set(), pink: new Set(), white: new Set() };
    state.allRunners.forEach(runner => {
        ['parent', 'gp1', 'gp2'].forEach(source => {
            if (Array.isArray(runner.sparks?.[source])) {
                runner.sparks[source].forEach(spark => {
                    if (spark?.spark_name && extracted[spark.color]) {
                        extracted[spark.color].add(spark.spark_name);
                    }
                });
            }
        });
    });

    if (state.orderedSparks?.blue && Array.isArray(state.orderedSparks.blue)) {
        state.blueSparkNames = state.orderedSparks.blue.filter(name => extracted.blue.has(name));
    } else {
        state.blueSparkNames = [...extracted.blue].sort();
    }
    if (state.orderedSparks?.pink && Array.isArray(state.orderedSparks.pink)) {
        state.pinkSparkNames = state.orderedSparks.pink.filter(name => extracted.pink.has(name));
    } else {
        state.pinkSparkNames = [...extracted.pink].sort();
    }
    if (state.orderedSparks?.green && Array.isArray(state.orderedSparks.green)) {
        state.greenSparkNames = state.orderedSparks.green.filter(name => extracted.green.has(name));
    } else {
        state.greenSparkNames = [...extracted.green].sort();
    }
    if (state.orderedSparks?.white && Array.isArray(state.orderedSparks.white.race) && Array.isArray(state.orderedSparks.white.skill)) {
        const orderedWhiteSparks = [...state.orderedSparks.white.race, ...state.orderedSparks.white.skill];
        state.whiteSparkNames = orderedWhiteSparks.filter(name => extracted.white.has(name));
    } else {
        state.whiteSparkNames = [...extracted.white].sort();
    }
}