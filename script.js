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
let transitionMatrix = [[0.3417490146907609, 0.08330955493819141, 0.006442483553574744, 0.055381137838318044, 0.007301868251405789, 0.012538914867676195, 0.00461471350450765, 0.011076455830745973, 0.00620565322489457, 0.008094626608538637, 0.1305527308764948, 0.21669876621981984, 0.07585522393477556, 0.01980303493162401, 0.020375820728671785], [0.21428114142350171, 0.11374865247646444, 0.012220180555496982, 0.09163888670662933, 0.027242860405821096, 0.04112189776416427, 0.00011641895068444474, 0.0065710437493174175, 0.0076787927525465574, 0.009011729678862608, 0.2096316418412612, 0.17545840188510764, 0.08045103941543326, 0.005525805674350364, 0.005301506720358728], [0.1976004746369295, 0.09040920458828897, 0.01671801017846409, 0.07595368005665047, 0.019279496833072892, 0.018175778697402695, 0.010469338545986024, 0.0206978567236751, 0.00930610390874481, 0.011482683569153218, 0.21087714764474433, 0.20287551202329734, 0.06234492969474146, 0.027299954626953504, 0.026509828271895693], [0.2348635763723033, 0.12063940013555452, 0.007018278251803514, 0.07866469862604887, 0.012370690896374648, 0.055845818522601974, 0.007140755939738697, 0.008184957540627534, 0.01136866944921369, 0.008560699382714034, 0.15225667036720572, 0.22801537740991717, 0.04577090966130558, 0.024736842004849113, 0.00456265543974154], [0.238238771857134, 0.11056413881182652, 0.01940493516789263, 0.11555180624857161, 0.013333095015085556, 0.020637337237311624, 0.01157055527858772, 0.01874844085326228, 0.010396051986889223, 0.016020868560142013, 0.16874927228484327, 0.18766507636639765, 0.05450855602734714, 0.008263462632628131, 0.0063476316720806085], [0.2525124318277993, 0.09718302016968956, 0.011490426827218425, 0.09426627258707253, 0.011115963258028026, 0.06255286014945725, 0.007479205188316951, 0.03051732318965866, 0.012064490484221712, 0.008274755268454281, 0.1563176395260349, 0.1853340869512396, 0.0616247465764684, 0.005229354599509693, 0.004037423396830932], [0.22654513706368323, 0.12543072428156596, 0.01720191327884866, 0.09204691498907021, 0.01956412428352613, 0.01827168744335039, 0.0352975675639888, 0.016609039280653805, 0.009598575588849438, 0.011876859390781242, 0.17287024840586382, 0.15194232322428636, 0.06966474355918442, 0.007653739576065785, 0.02542640207028175], [0.2464389362680671, 0.10411654491819337, 0.009998821309791876, 0.08304688165394113, 0.012527693522469945, 0.017959061573162093, 0.03451968870755186, 0.016438607014957873, 0.016770038371786897, 0.020990802061803267, 0.1527410484881528, 0.19668955404708646, 0.0509302185265319, 0.02740800542502698, 0.00942409811147652], [0.3042562902112874, 0.06038502818667906, 0.03416768818192765, 0.045748583457076254, 0.008818769636605146, 0.01087463387192655, 0.034601141484518226, 0.009689124742246223, 0.01058756095163658, 0.025729798442684422, 0.1971018329996829, 0.18416526320889975, 0.04753795997854476, 0.013620958315170356, 0.012715366331114388], [0.25903555969286524, 0.09370037827897817, 0.009392242407603252, 0.07593674663158004, 0.010729587483798743, 0.02057958872632728, 0.034004065613493985, 0.01622911964868139, 0.018703984927561746, 0.028967002162768957, 0.152545093873776, 0.14766381826690225, 0.08588690562729973, 0.011041615170032848, 0.03558429148833046], [0.23015672708969176, 0.07097110162743599, 0.006129263345075439, 0.010275032088528006, 0.006488782507385178, 0.006981540863411205, 0.004776622295340615, 0.013716398921143631, 0.08622122458955549, 0.014431466617938971, 0.22005488317172778, 0.22313159631294618, 0.04842579097719443, 0.03425619660323866, 0.02398337298938653], [0.31942899735190927, 0.03789497321264321, 0.008955812406716775, 0.03171565488131706, 0.007669659645112742, 0.017674283355695992, 0.013888914971907664, 0.010427732700832517, 0.007578759255396875, 0.017741973280467227, 0.17911606522138107, 0.24686301550207357, 0.0963670380726701, 0.002642274821210669, 0.0020348453206652183], [0.20228317878701316, 0.0579753892321564, 0.013336837245916834, 0.040141172344556615, 0.0077209767630860345, 0.008464770743565577, 0.007500953139031625, 0.00795678612225335, 0.005657501794371623, 0.005959456755768191, 0.19996912372071432, 0.15419332044674947, 0.27186648170155553, 0.008792005980017753, 0.008182045223243492], [0.08972448436282258, 0.2461046705971702, 0.02449657786912342, 0.22881797879477728, 0.051247024415713195, 0.04779121481010202, 0.02622223518530036, 0.04188584869865793, 0.00159790233637284, 0.028511184323533553, 0.03059112768917084, 0.07094709690225487, 0.05555631742142745, 0.04290541663214778, 0.013600919961425876], [0.04771261537933694, 0.25725489216730246, 0.026881324782839007, 0.24638388724360438, 0.031481817933785905, 0.050497223944404875, 0.005057338235457902, 0.05649036958829154, 0.02488344460254922, 0.03189917055082248, 0.03392626128010368, 0.07869024352481017, 0.06168783694426439, 0.025845002187233873, 0.021308571635193233]];

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
