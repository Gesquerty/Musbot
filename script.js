// ===== Configuration =====
const bpm = 400;
const numNotes = 10;
const matrixSize = 15;
const clickReward = 0.05;//0.025;
const stepDuration = 60 / bpm; // seconds per beat

// Reverb settings
const reverbDuration = 2.0;  // seconds — length of the impulse response
const reverbDecay = 2.5;     // higher = faster tail fall-off
const reverbWet = 0.5;       // 0 = dry only, 1 = full wet send

// Chromatic scale starting at C4
const baseFrequency = 261.63;
const chromaticScale = [];
for (let i = 0; i < 12; i++) {
    chromaticScale.push(baseFrequency * Math.pow(2, i / 12));
}

// ===== Audio setup =====
const audioCtx = new AudioContext();

// Shared reverb bus: convolver with a synthesized decaying-noise impulse response.
function makeImpulseResponse(duration, decay) {
    const rate = audioCtx.sampleRate;
    const length = Math.floor(rate * duration);
    const impulse = audioCtx.createBuffer(2, length, rate);
    for (let ch = 0; ch < 2; ch++) {
        const data = impulse.getChannelData(ch);
        for (let i = 0; i < length; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
        }
    }
    return impulse;
}
const reverb = audioCtx.createConvolver();
reverb.buffer = makeImpulseResponse(reverbDuration, reverbDecay);
const reverbGain = audioCtx.createGain();
reverbGain.gain.value = reverbWet;
reverb.connect(reverbGain);
reverbGain.connect(audioCtx.destination);

// ===== Markov state =====
let transitionMatrix = [];
let currentState = 0;          // last drawn number, 0-indexed (represents 1..15)
let lastNoteIndex = 0;         // last pitched note's pitch class (0..11)
let currentOctaveOffset = 0;   // octave offset relative to starting pitch
let noteHistory = [];          // last numNotes states (0-indexed)

let isPlaying = false;
let stepTimeoutId = null;
let forcedNext = null;         // if set, step() uses this instead of sampling

// ===== Matrix persistence (CSV via localStorage) =====
const STORAGE_KEY = 'transitionMatrix.csv';

function matrixToCsv(matrix) {
    return matrix.map(row => row.join(',')).join('\n');
}

function csvToMatrix(csv) {
    return csv.trim().split('\n').map(row => row.split(',').map(Number));
}

function saveMatrix() {
    localStorage.setItem(STORAGE_KEY, matrixToCsv(transitionMatrix));
}

function initializeMatrix() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        const parsed = csvToMatrix(saved);
        if (parsed.length === matrixSize && parsed.every(r => r.length === matrixSize)) {
            transitionMatrix = parsed;
            return;
        }
    }
    transitionMatrix = [];
    for (let i = 0; i < matrixSize; i++) {
        transitionMatrix.push(new Array(matrixSize).fill(1 / matrixSize));
    }
}

// ===== Visualization =====
const gridEl = document.getElementById('grid');
const cells = [];

function buildGrid() {
    gridEl.innerHTML = '';
    for (let i = 0; i < matrixSize; i++) {
        cells[i] = [];
        for (let j = 0; j < matrixSize; j++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.title = `from ${i + 1} to ${j + 1}`;
            cell.addEventListener('click', () => handleCellClick(i, j));
            gridEl.appendChild(cell);
            cells[i][j] = cell;
        }
    }
}

function handleCellClick(row, col) {
    transitionMatrix[row][col] += clickReward;

    const sum = transitionMatrix[row].reduce((a, b) => a + b, 0);
    if (sum > 0) {
        for (let j = 0; j < matrixSize; j++) {
            transitionMatrix[row][j] /= sum;
        }
    }

    forcedNext = col;
    saveMatrix();
    updateHeatmap();
}

function probColor(p, max) {
    const t = max > 0 ? Math.min(1, p / max) : 0;
    // Dark -> red -> yellow -> white heatmap
    const r = Math.round(255 * Math.min(1, t * 2));
    const g = Math.round(255 * Math.max(0, Math.min(1, t * 2 - 0.6)));
    const b = Math.round(255 * Math.max(0, t * 2 - 1.4));
    return `rgb(${r}, ${g}, ${b})`;
}

function updateHeatmap() {
    let max = 0;
    for (let i = 0; i < matrixSize; i++) {
        for (let j = 0; j < matrixSize; j++) {
            if (transitionMatrix[i][j] > max) max = transitionMatrix[i][j];
        }
    }
    for (let i = 0; i < matrixSize; i++) {
        for (let j = 0; j < matrixSize; j++) {
            cells[i][j].style.backgroundColor = probColor(transitionMatrix[i][j], max);
        }
    }
}

function flashCell(from, to) {
    const cell = cells[from][to];
    cell.classList.add('active');
    setTimeout(() => cell.classList.remove('active'), 180);
}

// ===== Markov sampling =====
function sampleNext(state) {
    const row = transitionMatrix[state];
    const r = Math.random();
    let cumulative = 0;
    for (let i = 0; i < row.length; i++) {
        cumulative += row[i];
        if (r < cumulative) return i;
    }
    return row.length - 1;
}

// ===== Note playback with ADSR =====
function playNote(frequency) {
    const gainNode = audioCtx.createGain();
    gainNode.connect(audioCtx.destination); // dry path
    gainNode.connect(reverb);                // wet path (shared reverb bus)

    const makeOsc = (type, freq, mix) => {
        const osc = audioCtx.createOscillator();
        osc.type = type;
        osc.frequency.value = freq;
        const mixGain = audioCtx.createGain();
        mixGain.gain.value = mix;
        osc.connect(mixGain);
        mixGain.connect(gainNode);
        return osc;
    };

    const osc1 = makeOsc('sine', frequency, 1.0);
    const osc2 = makeOsc('sine', frequency * 2, 0.35);
    const osc3 = makeOsc('triangle', frequency * 4, 0.2);

    const now = audioCtx.currentTime;
    const attackTime = 0.05;
    const decayTime = 0.1;
    const sustainLevel = 0.5;
    const releaseTime = 0.4;
    const peak = 0.5;
    const holdTime = Math.max(0.02, stepDuration - attackTime - decayTime - releaseTime);
    const endTime = now + attackTime + decayTime + holdTime + releaseTime;

    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.linearRampToValueAtTime(peak, now + attackTime);
    gainNode.gain.linearRampToValueAtTime(sustainLevel, now + attackTime + decayTime);
    gainNode.gain.setValueAtTime(sustainLevel, now + attackTime + decayTime + holdTime);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, endTime);

    const stopTime = endTime + 0.05;
    osc1.start(now); osc2.start(now); osc3.start(now);
    osc1.stop(stopTime); osc2.stop(stopTime); osc3.stop(stopTime);
}

// ===== Markov step =====
function step() {
    let next;
    if (forcedNext !== null) {
        next = forcedNext;
        forcedNext = null;
    } else {
        next = sampleNext(currentState); // 0..14
    }
    const action = next + 1;                // 1..15

    let shouldPlay = false;
    if (action >= 1 && action <= 12) {
        lastNoteIndex = (lastNoteIndex + action) % 12;
        shouldPlay = true;
    } else if (action === 13) {
        shouldPlay = false;
    } else if (action === 14) {
        if (currentOctaveOffset - 1 >= -3) {
            currentOctaveOffset -= 1;
        }
        shouldPlay = true;
    } else if (action === 15) {
        if (currentOctaveOffset + 1 <= 3) {
            currentOctaveOffset += 1;
        }
        shouldPlay = true;
    }

    if (shouldPlay) {
        const freq = chromaticScale[lastNoteIndex] * Math.pow(2, currentOctaveOffset);
        playNote(freq);
    }

    flashCell(currentState, next);

    currentState = next;
    noteHistory.push(next);
    if (noteHistory.length > numNotes) {
        noteHistory.shift();
    }

    stepTimeoutId = setTimeout(step, stepDuration * 1000);
}

// ===== Reward / matrix update =====
function rewardFunc(i) {
    return 0.03 * Math.pow(2, -Math.pow(i - 3, 2)*0.1);
}

function giveReward() {
    const n = noteHistory.length;
    for (let i = 1; i <= numNotes - 1 && i < n; i++) {
        const from = noteHistory[n - 1 - i];
        const to = noteHistory[n - i];
        transitionMatrix[from][to] += rewardFunc(i);
    }

    for (let i = 0; i < matrixSize; i++) {
        const sum = transitionMatrix[i].reduce((a, b) => a + b, 0);
        if (sum > 0) {
            for (let j = 0; j < matrixSize; j++) {
                transitionMatrix[i][j] /= sum;
            }
        }
    }
    console.log('Reward given. Updated transition matrix:');
    console.table(transitionMatrix);
    saveMatrix();
    updateHeatmap();
}

// ===== Buttons =====
const startButton = document.getElementById('start_button');
const rewardButton = document.getElementById('reward_button');

startButton.addEventListener('click', () => {
    if (!isPlaying) {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        isPlaying = true;
        startButton.textContent = 'pause';
        step();
    } else {
        isPlaying = false;
        startButton.textContent = 'start';
        audioCtx.suspend();
        if (stepTimeoutId !== null) {
            clearTimeout(stepTimeoutId);
            stepTimeoutId = null;
        }
    }
});

rewardButton.addEventListener('click', giveReward);

// ===== Init =====
initializeMatrix();
buildGrid();
updateHeatmap();
