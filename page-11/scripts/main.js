// Variables globales du jeu
let gameState = {
    teamName: 'Racing Team',
    year: 2022,
    week: 1,
    money: 50000000,
    rdPoints: 100,
    engineerTime: 300,
    maxEngineerTime: 300,
    engineers: 15,
    primaryColor: '#e94560',
    secondaryColor: '#0f3460',
    clicks: 0,
    currentAction: 'rdGeneration',
    timePerClick: 10,
    drivers: [
        { name: 'Charles Leclerc', skill: 92, salary: 12000000, carIndex: 0 },
        { name: 'Lando Norris', skill: 88, salary: 8000000, carIndex: 1 }
    ],
    engineSupplier: null,
    engineCost: 0,
    ownEngine: false,
    sponsors: [],
    aeroPerf: 50,
    chassisPerf: 50,
    enginePerf: 0, // Pas de moteur de base
    electronicsPerf: 50,
    brakesPerf: 50,
    aeroDev: {},
    chassisDev: {},
    engineDev: {},
    electronicsDev: {},
    brakesDev: {},
    parts: {
        frontWing: [
            { name: 'Ailette avant de base', perf: 10, condition: 100, category: 'frontWing' },
            { name: 'Ailette avant de base (rechange)', perf: 10, condition: 100, category: 'frontWing' }
        ],
        rearWing: [
            { name: 'Aileron arrière de base', perf: 10, condition: 100, category: 'rearWing' },
            { name: 'Aileron arrière de base (rechange)', perf: 10, condition: 100, category: 'rearWing' }
        ],
        floor: [
            { name: 'Fond plat de base', perf: 10, condition: 100, category: 'floor' },
            { name: 'Fond plat de base (rechange)', perf: 10, condition: 100, category: 'floor' }
        ],
        sidepods: [
            { name: 'Pontons de base', perf: 10, condition: 100, category: 'sidepods' },
            { name: 'Pontons de base (rechange)', perf: 10, condition: 100, category: 'sidepods' }
        ],
        chassis: [
            { name: 'Châssis de base', perf: 10, condition: 100, category: 'chassis' },
            { name: 'Châssis de base (rechange)', perf: 10, condition: 100, category: 'chassis' }
        ],
        suspension: [
            { name: 'Suspension de base', perf: 10, condition: 100, category: 'suspension' },
            { name: 'Suspension de base (rechange)', perf: 10, condition: 100, category: 'suspension' }
        ],
        engine: [],
        electronics: [
            { name: 'Électronique de base', perf: 10, condition: 100, category: 'electronics' },
            { name: 'Électronique de base (rechange)', perf: 10, condition: 100, category: 'electronics' }
        ],
        brakes: [
            { name: 'Freins de base', perf: 10, condition: 100, category: 'brakes' },
            { name: 'Freins de base (rechange)', perf: 10, condition: 100, category: 'brakes' }
        ]
    },
    car1Config: {},
    car2Config: {},
    tasks: [],
    races: [],
    raceResults: [],
    constructorStandings: [],
    driverStandings: [],
    history: [],
    budgetSpent: 0,
    currentRacePhase: null, // 'qualif' ou 'race'
};

// Performances initiales aléatoires par écurie
const rivalBasePerformanceRanges = {
    'Red Bull Racing': { min: 350, max: 450 },
    'Ferrari': { min: 300, max: 400 },
    'Mercedes': { min: 290, max: 390 },
    'McLaren': { min: 280, max: 380 },
    'Alpine': { min: 270, max: 370 },
    'Alfa Romeo': { min: 250, max: 350 },
    'Haas': { min: 200, max: 300 },
    'AlphaTauri': { min: 220, max: 320 },
    'Aston Martin': { min: 230, max: 330 },
    'Williams': { min: 210, max: 310 }
};

// Stockage des performances des rivaux
let rivalPerformances = {};

// Définition des composants aéro
const aeroParts = {
    frontWingV1: { name: 'Ailette avant V1', cost: 800000, rd: 80, time: 200, perf: 3, category: 'frontWing' },
    frontWingV2: { name: 'Ailette avant V2', cost: 1500000, rd: 150, time: 350, perf: 7, category: 'frontWing' },
    // ... (autres pièces aéro)
};

// Définition des composants châssis
const chassisParts = {
    chassisV1: { name: 'Châssis V1', cost: 3000000, rd: 300, time: 600, perf: 8, category: 'chassis' },
    // ... (autres pièces châssis)
};

// Définition des composants moteur
const engineParts = {
    iceV1: { name: 'ICE V1', cost: 5000000, rd: 500, time: 1000, perf: 15, category: 'engine', subCategory: 'ice' },
    mghkV1: { name: 'MGU-K V1', cost: 4000000, rd: 400, time: 900, perf: 12, category: 'engine', subCategory: 'mghk' },
    mghuV1: { name: 'MGU-H V1', cost: 4500000, rd: 450, time: 950, perf: 10, category: 'engine', subCategory: 'mghu' },
    // ... (autres pièces moteur)
};

// Définition des composants électronique
const electronicsParts = {
    ecuV1: { name: 'ECU V1', cost: 2000000, rd: 200, time: 500, perf: 5, category: 'electronics' },
    // ... (autres pièces électronique)
};

// Définition des composants freins
const brakesParts = {
    brakesV1: { name: 'Freins V1', cost: 1500000, rd: 150, time: 400, perf: 4, category: 'brakes' },
    // ... (autres pièces freins)
};

// Fournisseurs de moteurs
const engineSuppliers = [
    { name: 'Mercedes', cost: 15000000, perf: 95, parts: ['iceV1', 'mghkV1', 'mghuV1'] },
    { name: 'Ferrari', cost: 15000000, perf: 93, parts: ['iceV1', 'mghkV1', 'mghuV1'] },
    // ... (autres fournisseurs)
];

// Sponsors disponibles
const availableSponsors = [
    { name: 'Petronas', monthlyPay: 1500000, requirements: { position: 8 }, duration: 12 },
    // ... (autres sponsors)
];

// Calendrier 2022
const calendar2022 = [
    { name: 'Bahrain GP', circuit: 'Sakhir', week: 3, completed: false, qualifDone: false },
    // ... (autres courses)
];

// Initialiser les classements avec 10 équipes
const teams = [
    'Red Bull Racing', 'Ferrari', 'Mercedes', 'McLaren', 'Alpine',
    'Alfa Romeo', 'Haas', 'AlphaTauri', 'Aston Martin', 'Williams'
];

// Initialisation des performances aléatoires des rivaux
function initializeRivalPerformances() {
    teams.forEach(team => {
        const range = rivalBasePerformanceRanges[team];
        rivalPerformances[team] = {
            aero: Math.floor(Math.random() * (range.max - range.min + 1)) + range.min,
            chassis: Math.floor(Math.random() * (range.max - range.min + 1)) + range.min,
            engine: Math.floor(Math.random() * (range.max - range.min + 1)) + range.min,
            electronics: Math.floor(Math.random() * (range.max - range.min + 1)) + range.min,
            brakes: Math.floor(Math.random() * (range.max - range.min + 1)) + range.min,
            totalPerf: 0
        };
        rivalPerformances[team].totalPerf = rivalPerformances[team].aero + rivalPerformances[team].chassis +
                                             rivalPerformances[team].engine + rivalPerformances[team].electronics +
                                             rivalPerformances[team].brakes;
    });
}

// Initialiser les classements avec 0 point et les performances aléatoires
function initializeStandings() {
    gameState.constructorStandings = teams.map((team, index) => ({
        team: team,
        points: 0,
        aeroPerf: rivalPerformances[team].aero,
        chassisPerf: rivalPerformances[team].chassis,
        enginePerf: rivalPerformances[team].engine,
        electronicsPerf: rivalPerformances[team].electronics,
        brakesPerf: rivalPerformances[team].brakes,
        totalPerf: rivalPerformances[team].totalPerf,
        position: index + 1
    }));
    // Ajouter votre écurie avec des performances initiales
    gameState.constructorStandings.push({
        team: gameState.teamName,
        points: 0,
        aeroPerf: gameState.aeroPerf,
        chassisPerf: gameState.chassisPerf,
        enginePerf: gameState.enginePerf,
        electronicsPerf: gameState.electronicsPerf,
        brakesPerf: gameState.brakesPerf,
        totalPerf: gameState.aeroPerf + gameState.chassisPerf + gameState.enginePerf +
                    gameState.electronicsPerf + gameState.brakesPerf,
        position: 11
    });
    // Trier par performance totale
    gameState.constructorStandings.sort((a, b) => b.totalPerf - a.totalPerf);
    gameState.constructorStandings.forEach((team, index) => {
        team.position = index + 1;
    });
}

// Démarrer le jeu
function startGame() {
    const teamName = document.getElementById('teamName').value || 'Racing Team';
    const year = parseInt(document.getElementById('startYear').value);
    const primaryColor = document.getElementById('primaryColor').value;
    const secondaryColor = document.getElementById('secondaryColor').value;

    gameState.teamName = teamName;
    gameState.year = year;
    gameState.primaryColor = primaryColor;
    gameState.secondaryColor = secondaryColor;

    document.documentElement.style.setProperty('--primary-color', primaryColor);
    document.documentElement.style.setProperty('--secondary-color', secondaryColor);

    document.getElementById('setupScreen').style.display = 'none';
    document.getElementById('gameContainer').style.display = 'block';
    document.getElementById('gameContainer').style.paddingTop = '120px'; // Espace pour la barre fixe

    gameState.races = JSON.parse(JSON.stringify(calendar2022));
    initializeRivalPerformances();
    initializeStandings();

    updateStats();
    switchTab('home');
}

// Mettre à jour les statistiques
function updateStats() {
    document.getElementById('teamNameDisplay').textContent = `🏎️ ${gameState.teamName}`;
    document.getElementById('money').textContent = `${(gameState.money / 1000000).toFixed(1)}M €`;
    document.getElementById('rdPoints').textContent = gameState.rdPoints;
    document.getElementById('engineerTime').textContent = `${gameState.engineerTime} / ${gameState.maxEngineerTime}`;
    document.getElementById('engineers').textContent = gameState.engineers;
    document.getElementById('currentWeek').textContent = `${gameState.week} / 52`;
    document.getElementById('budgetCap').textContent = `${(gameState.budgetSpent / 1000000).toFixed(1)}M / 140M`;

    const nextRace = gameState.races.find(r => r.week >= gameState.week && !r.completed);
    if (nextRace) {
        document.getElementById('nextRace').textContent = `${nextRace.name} (S${nextRace.week})`;
    } else {
        document.getElementById('nextRace').textContent = 'Saison terminée';
    }

    const ourTeam = gameState.constructorStandings.find(t => t.team === gameState.teamName);
    if (ourTeam) {
        document.getElementById('position').textContent = `${ourTeam.position}${getOrdinalSuffix(ourTeam.position)}`;
    }
}

// Changer d'onglet
function switchTab(tab) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');
    const content = document.getElementById('content');
    switch(tab) {
        case 'home': content.innerHTML = getHomeContent(); break;
        case 'aero': content.innerHTML = getAeroContent(); break;
        case 'chassis': content.innerHTML = getChassisContent(); break;
        case 'engine': content.innerHTML = getEngineContent(); break;
        case 'electronics': content.innerHTML = getElectronicsContent(); break;
        case 'brakes': content.innerHTML = getBrakesContent(); break;
        case 'manufacturing': content.innerHTML = getManufacturingContent(); break;
        case 'team': content.innerHTML = getTeamContent(); break;
        case 'history': content.innerHTML = getHistoryContent(); break;
    }
}

// Passer à la semaine suivante
function advanceWeek() {
    gameState.week++;
    gameState.engineerTime = gameState.maxEngineerTime;

    // Usure des pièces (affecte la performance)
    Object.values(gameState.parts).forEach(category => {
        if (Array.isArray(category)) {
            category.forEach(part => {
                part.condition = Math.max(0, part.condition - Math.floor(Math.random() * 3));
                part.effectivePerf = Math.round(part.perf * (part.condition / 100));
            });
        }
    });

    // Vérifier si c'est une semaine de course
    const currentRace = gameState.races.find(r => r.week === gameState.week && !r.completed);
    if (currentRace) {
        gameState.currentRacePhase = 'qualif';
        alert(`🏁 Semaine de course : ${currentRace.name} ! Cliquez sur "Simuler la qualification" pour commencer.`);
    }

    // Mise à jour des performances hebdomadaires
    increaseWeeklyPerformances();
    updateStats();
    switchTab(getCurrentTab());
}

// Simuler la qualification
function simulateQualif() {
    if (!gameState.currentRacePhase || gameState.currentRacePhase !== 'qualif') {
        alert("Ce n'est pas une semaine de qualification !");
        return;
    }
    const currentRace = gameState.races.find(r => r.week === gameState.week && !r.completed);
    if (!currentRace) return;

    // Animation simple
    const qualifAnimation = setInterval(() => {
        const dots = document.getElementById('qualifDots') || document.createElement('div');
        dots.id = 'qualifDots';
        dots.textContent = 'Qualification en cours' + '.'.repeat((gameState.qualifDotsCount || 0) % 4);
        dots.style.color = 'var(--primary-color)';
        dots.style.fontWeight = 'bold';
        dots.style.margin = '10px 0';
        document.getElementById('content').prepend(dots);
        gameState.qualifDotsCount = (gameState.qualifDotsCount || 0) + 1;
    }, 500);

    setTimeout(() => {
        clearInterval(qualifAnimation);
        document.getElementById('qualifDots').remove();
        gameState.currentRacePhase = 'race';
        alert(`✅ Qualification terminée ! Cliquez sur "Simuler la course" pour continuer.`);
    }, 3000);
}

// Simuler la course
function simulateRace() {
    if (!gameState.currentRacePhase || gameState.currentRacePhase !== 'race') {
        alert("La qualification n'a pas encore été simulée !");
        return;
    }

    const currentRace = gameState.races.find(r => r.week === gameState.week && !r.completed);
    if (!currentRace) return;

    // Animation simple
    const raceAnimation = setInterval(() => {
        const dots = document.getElementById('raceDots') || document.createElement('div');
        dots.id = 'raceDots';
        dots.textContent = 'Course en cours' + '.'.repeat((gameState.raceDotsCount || 0) % 4);
        dots.style.color = 'var(--primary-color)';
        dots.style.fontWeight = 'bold';
        dots.style.margin = '10px 0';
        document.getElementById('content').prepend(dots);
        gameState.raceDotsCount = (gameState.raceDotsCount || 0) + 1;
    }, 500);

    setTimeout(() => {
        clearInterval(raceAnimation);
        document.getElementById('raceDots').remove();

        // Calcul des performances des voitures
        const car1Perf = calculateCarPerformance(0);
        const car2Perf = calculateCarPerformance(1);

        // Simulation des positions
        const basePosition = Math.max(1, Math.min(20, 21 - Math.round((car1Perf + car2Perf) / 2 / 30)));
        const pos1 = Math.max(1, basePosition + Math.round((Math.random() - 0.5) * 4));
        const pos2 = Math.max(1, basePosition + Math.round((Math.random() - 0.5) * 4));

        // Points F1
        const pointsSystem = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
        const points1 = pos1 <= 10 ? pointsSystem[pos1 - 1] : 0;
        const points2 = pos2 <= 10 ? pointsSystem[pos2 - 1] : 0;
        const totalPoints = points1 + points2;

        // Mise à jour des points
        const ourTeam = gameState.constructorStandings.find(t => t.team === gameState.teamName);
        if (ourTeam) {
            ourTeam.points += totalPoints;
        }

        // Mise à jour des points des rivaux
        gameState.constructorStandings.forEach(team => {
            if (team.team !== gameState.teamName) {
                team.points += Math.round(Math.random() * 30);
            }
        });

        // Enregistrement du résultat
        gameState.raceResults.push({
            raceName: currentRace.name,
            driver1: gameState.drivers[0].name,
            pos1: pos1,
            driver2: gameState.drivers[1].name,
            pos2: pos2,
            points: totalPoints
        });

        // Tri du classement
        gameState.constructorStandings.sort((a, b) => b.points - a.points);
        gameState.constructorStandings.forEach((team, index) => {
            team.position = index + 1;
        });

        currentRace.completed = true;
        gameState.currentRacePhase = null;

        alert(`🏁 ${currentRace.name} terminé !\n\n${gameState.drivers[0].name}: P${pos1} (${points1} pts)\n${gameState.drivers[1].name}: P${pos2} (${points2} pts)\n\nTotal: ${totalPoints} points`);

        updateStats();
        switchTab('home');
    }, 5000);
}

// Calculer la performance d'une voiture
function calculateCarPerformance(carIndex) {
    const config = carIndex === 0 ? gameState.car1Config : gameState.car2Config;
    let totalPerf = 0;

    // Aéro
    if (config.frontWing !== undefined) {
        const part = gameState.parts.frontWing[config.frontWing];
        totalPerf += part.effectivePerf || part.perf;
    }

    // Châssis
    if (config.chassis !== undefined) {
        const part = gameState.parts.chassis[config.chassis];
        totalPerf += part.effectivePerf || part.perf;
    }

    // Moteur
    if (config.engine !== undefined) {
        const part = gameState.parts.engine[config.engine];
        totalPerf += part.effectivePerf || part.perf;
    }

    // Électronique
    if (config.electronics !== undefined) {
        const part = gameState.parts.electronics[config.electronics];
        totalPerf += part.effectivePerf || part.perf;
    }

    // Freins
    if (config.brakes !== undefined) {
        const part = gameState.parts.brakes[config.brakes];
        totalPerf += part.effectivePerf || part.perf;
    }

    // Bonus pilote
    totalPerf += gameState.drivers[carIndex].skill / 2;

    return Math.round(totalPerf);
}

// Augmenter les performances chaque semaine
function increaseWeeklyPerformances() {
    gameState.aeroPerf += Math.floor(Math.random() * 3);
    gameState.chassisPerf += Math.floor(Math.random() * 3);
    gameState.enginePerf += Math.floor(Math.random() * 3);
    gameState.electronicsPerf += Math.floor(Math.random() * 3);
    gameState.brakesPerf += Math.floor(Math.random() * 3);

    // Mise à jour des rivaux
    teams.forEach(team => {
        rivalPerformances[team].aero += Math.floor(Math.random() * 3);
        rivalPerformances[team].chassis += Math.floor(Math.random() * 3);
        rivalPerformances[team].engine += Math.floor(Math.random() * 3);
        rivalPerformances[team].electronics += Math.floor(Math.random() * 3);
        rivalPerformances[team].brakes += Math.floor(Math.random() * 3);
        rivalPerformances[team].totalPerf = rivalPerformances[team].aero + rivalPerformances[team].chassis +
                                             rivalPerformances[team].engine + rivalPerformances[team].electronics +
                                             rivalPerformances[team].brakes;
    });

    // Mise à jour des classements
    gameState.constructorStandings = teams.map((team, index) => ({
        team: team,
        points: gameState.constructorStandings.find(t => t.team === team)?.points || 0,
        aeroPerf: rivalPerformances[team].aero,
        chassisPerf: rivalPerformances[team].chassis,
        enginePerf: rivalPerformances[team].engine,
        electronicsPerf: rivalPerformances[team].electronics,
        brakesPerf: rivalPerformances[team].brakes,
        totalPerf: rivalPerformances[team].totalPerf,
        position: index + 1
    }));

    // Ajouter votre écurie
    const ourTeamIndex = gameState.constructorStandings.findIndex(t => t.team === gameState.teamName);
    if (ourTeamIndex !== -1) {
        gameState.constructorStandings[ourTeamIndex] = {
            team: gameState.teamName,
            points: gameState.constructorStandings[ourTeamIndex].points,
            aeroPerf: gameState.aeroPerf,
            chassisPerf: gameState.chassisPerf,
            enginePerf: gameState.enginePerf,
            electronicsPerf: gameState.electronicsPerf,
            brakesPerf: gameState.brakesPerf,
            totalPerf: gameState.aeroPerf + gameState.chassisPerf + gameState.enginePerf +
                        gameState.electronicsPerf + gameState.brakesPerf,
            position: 11
        };
    }

    // Re-trier par performance totale
    gameState.constructorStandings.sort((a, b) => b.totalPerf - a.totalPerf);
    gameState.constructorStandings.forEach((team, index) => {
        team.position = index + 1;
    });
}

// Actions du jeu
function performClick() {
    if (gameState.engineerTime < gameState.timePerClick) {
        alert('Pas assez de temps ingénieur disponible !');
        return;
    }

    gameState.clicks++;
    gameState.engineerTime -= gameState.timePerClick;

    switch(gameState.currentAction) {
        case 'rdGeneration':
            gameState.rdPoints += 10;
            break;
        case 'aeroWork':
            progressDevelopment('aero', gameState.timePerClick);
            break;
        case 'chassisWork':
            progressDevelopment('chassis', gameState.timePerClick);
            break;
        case 'engineWork':
            progressDevelopment('engine', gameState.timePerClick);
            break;
        case 'electronicsWork':
            progressDevelopment('electronics', gameState.timePerClick);
            break;
        case 'brakesWork':
            progressDevelopment('brakes', gameState.timePerClick);
            break;
    }

    updateStats();
    switchTab(getCurrentTab());
}

// Démarrer un développement
function startDevelopment(type, key) {
    let parts, devState;
    switch(type) {
        case 'aero': parts = aeroParts; devState = gameState.aeroDev; break;
        case 'chassis': parts = chassisParts; devState = gameState.chassisDev; break;
        case 'engine': parts = engineParts; devState = gameState.engineDev; break;
        case 'electronics': parts = electronicsParts; devState = gameState.electronicsDev; break;
        case 'brakes': parts = brakesParts; devState = gameState.brakesDev; break;
    }

    const part = parts[key];
    if (gameState.money < part.cost) {
        alert('Pas assez d\'argent !');
        return;
    }
    if (gameState.rdPoints < part.rd) {
        alert('Pas assez de points R&D !');
        return;
    }

    gameState.money -= part.cost;
    gameState.rdPoints -= part.rd;
    gameState.budgetSpent += part.cost;

    devState[key] = {
        phase: 'conception',
        progress: 0,
        timeNeeded: part.time,
        timeSpent: 0
    };

    gameState.tasks.push({
        name: `${part.name} (${type})`,
        phase: 'Conception 3D',
        progress: 0,
        type: type,
        key: key
    });

    updateStats();
    switchTab(getCurrentTab());
}

// Progression du développement (avec 10% d'échec)
function progressDevelopment(type, timeAdded) {
    let devState;
    switch(type) {
        case 'aero': devState = gameState.aeroDev; break;
        case 'chassis': devState = gameState.chassisDev; break;
        case 'engine': devState = gameState.engineDev; break;
        case 'electronics': devState = gameState.electronicsDev; break;
        case 'brakes': devState = gameState.brakesDev; break;
    }

    for (let key in devState) {
        const dev = devState[key];
        if (dev.phase !== 'completed' && dev.phase !== 'locked') {
            dev.timeSpent += timeAdded;
            dev.progress = Math.min(100, Math.round((dev.timeSpent / dev.timeNeeded) * 100));

            if (dev.progress >= 100) {
                if (dev.phase === 'conception') {
                    dev.phase = 'test';
                    dev.progress = 0;
                    dev.timeSpent = 0;
                    dev.timeNeeded = Math.round(dev.timeNeeded * 0.3);
                }
                else if (dev.phase === 'test') {
                    const success = Math.random() > 0.1; // 10% d'échec
                    if (success) {
                        dev.phase = 'completed';
                        dev.progress = 100;
                        const parts = type === 'aero' ? aeroParts :
                                     (type === 'chassis' ? chassisParts :
                                     (type === 'engine' ? engineParts :
                                     (type === 'electronics' ? electronicsParts : brakesParts)));
                        const perf = parts[key].perf;
                        if (type === 'aero') gameState.aeroPerf += perf;
                        else if (type === 'chassis') gameState.chassisPerf += perf;
                        else if (type === 'engine') gameState.enginePerf += perf;
                        else if (type === 'electronics') gameState.electronicsPerf += perf;
                        else if (type === 'brakes') gameState.brakesPerf += perf;

                        const category = parts[key].category;
                        if (!gameState.parts[category]) gameState.parts[category] = [];
                        gameState.parts[category].push({
                            name: parts[key].name,
                            perf: parts[key].perf,
                            condition: 100,
                            effectivePerf: parts[key].perf
                        });

                        gameState.tasks = gameState.tasks.filter(t => t.key !== key || t.type !== type);
                    }
                    else {
                        dev.phase = 'conception';
                        dev.progress = 0;
                        dev.timeSpent = 0;
                        alert(`❌ Test échoué pour ${parts[key].name}. Retour à la conception !`);
                    }
                }
            }

            const task = gameState.tasks.find(t => t.key === key && t.type === type);
            if (task) {
                task.progress = dev.progress;
                task.phase = dev.phase === 'conception' ? 'Conception 3D' : 'Tests simulés';
            }
        }
    }
}

// Sélectionner un fournisseur de moteur
function selectEngineSupplier(name, cost, perf, parts) {
    if (gameState.money < cost) {
        alert('Pas assez d\'argent pour acheter ce moteur !');
        return;
    }

    gameState.money -= cost;
    gameState.budgetSpent += cost;
    gameState.engineSupplier = name;
    gameState.engineCost = cost;
    gameState.enginePerf = perf;

    // Ajouter les pièces du moteur
    parts.forEach(partKey => {
        const part = engineParts[partKey];
        if (!gameState.parts.engine) gameState.parts.engine = [];
        gameState.parts.engine.push({
            name: part.name,
            perf: part.perf,
            condition: 100,
            effectivePerf: part.perf,
            subCategory: part.subCategory
        });
    });

    alert(`✅ Moteur ${name} acheté ! Performance: ${perf} pts`);
    updateStats();
    switchTab('engine');
}

// Démarrer le développement de votre propre moteur
function startOwnEngine() {
    const cost = 50000000;
    if (gameState.money < cost) {
        alert('Pas assez d\'argent ! Il faut 50M € pour développer votre propre moteur.');
        return;
    }
    if (gameState.year < 2024) {
        alert('Vous devez attendre 2 ans d\'activité avant de pouvoir développer votre propre moteur !');
        return;
    }

    gameState.money -= cost;
    gameState.budgetSpent += cost;
    gameState.ownEngine = true;
    alert('🏭 Accréditation moteur obtenue ! Vous pouvez maintenant développer votre propre moteur.');
    updateStats();
    switchTab('engine');
}

// Fabriquer une pièce
function manufacturePart(type, key) {
    let parts, devState, category;
    switch(type) {
        case 'aero': parts = aeroParts; devState = gameState.aeroDev; category = parts[key].category; break;
        case 'chassis': parts = chassisParts; devState = gameState.chassisDev; category = parts[key].category; break;
        case 'engine': parts = engineParts; devState = gameState.engineDev; category = parts[key].category; break;
        case 'electronics': parts = electronicsParts; devState = gameState.electronicsDev; category = parts[key].category; break;
        case 'brakes': parts = brakesParts; devState = gameState.brakesDev; category = parts[key].category; break;
    }

    const part = parts[key];
    const cost = part.cost * 0.3;
    const time = Math.round(part.time * 0.5);

    if (gameState.money < cost) {
        alert('Pas assez d\'argent pour fabriquer cette pièce !');
        return;
    }
    if (gameState.engineerTime < time) {
        alert('Pas assez de temps ingénieur disponible !');
        return;
    }

    gameState.money -= cost;
    gameState.engineerTime -= time;
    gameState.budgetSpent += cost;

    const quality = 70 + Math.random() * 30;
    const success = quality > 75;

    if (success) {
        if (!gameState.parts[category]) gameState.parts[category] = [];
        gameState.parts[category].push({
            name: part.name,
            perf: part.perf,
            condition: Math.round(quality),
            effectivePerf: Math.round(part.perf * (quality / 100))
        });

        devState[key].manufactured = true;
        gameState.history.push({
            week: gameState.week,
            part: part.name,
            success: true,
            quality: Math.round(quality)
        });

        alert(`✅ ${part.name} fabriqué avec succès ! Qualité: ${Math.round(quality)}%`);
    }
    else {
        gameState.history.push({
            week: gameState.week,
            part: part.name,
            success: false,
            quality: Math.round(quality)
        });

        alert(`❌ Échec de fabrication pour ${part.name}. Qualité insuffisante: ${Math.round(quality)}%`);
    }

    updateStats();
    switchTab('manufacturing');
}

// Vendre une pièce
function sellPart(category, index) {
    const part = gameState.parts[category][index];
    const value = part.perf * 10000;
    gameState.money += value;
    gameState.parts[category].splice(index, 1);
    alert(`Pièce vendue pour ${(value / 1000000).toFixed(2)}M € !`);
    updateStats();
    switchTab('manufacturing');
}

// Mettre à jour la configuration de la voiture
function updateCarConfig(carIndex, partType, value) {
    const config = carIndex === 0 ? gameState.car1Config : gameState.car2Config;
    config[partType] = parseInt(value);
    if (carIndex === 0) gameState.car1Config = config;
    else gameState.car2Config = config;
}

// Embaucher un ingénieur
function hireEngineer() {
    gameState.engineers++;
    gameState.maxEngineerTime += 20;
    alert('Nouvel ingénieur embauché ! +20 temps disponible');
    updateStats();
    switchTab('team');
}

// Embaucher un pilote
function hireDriver() {
    const name = prompt('Nom du pilote:');
    if (!name) return;

    const skill = Math.round(60 + Math.random() * 30);
    const salary = skill * 50000;

    if (gameState.drivers.length >= 2) {
        const replace = confirm(`Remplacer ${gameState.drivers[1].name} ?`);
        if (replace) {
            gameState.drivers[1] = { name, skill, salary, carIndex: 1 };
        }
    }
    else {
        gameState.drivers.push({ name, skill, salary, carIndex: gameState.drivers.length });
    }

    updateStats();
    switchTab('team');
}

// Signer un sponsor
function signSponsor(name, monthlyPay, duration) {
    gameState.sponsors.push({
        name: name,
        monthlyPay: monthlyPay,
        remainingMonths: duration
    });
    alert(`✅ Sponsor ${name} signé ! Vous recevrez ${(monthlyPay / 1000000).toFixed(1)}M € par mois.`);
    updateStats();
    switchTab('team');
}

// Obtenir l'onglet actuel
function getCurrentTab() {
    const activeTab = document.querySelector('.tab.active');
    const tabs = ['home', 'aero', 'chassis', 'engine', 'electronics', 'brakes', 'manufacturing', 'team', 'history'];
    const index = Array.from(document.querySelectorAll('.tab')).indexOf(activeTab);
    return tabs[index] || 'home';
}

// Changer l'action actuelle
function changeAction(action) {
    gameState.currentAction = action;
}

// Mettre à jour le temps par clic
function updateTimePerClick(value) {
    gameState.timePerClick = parseInt(value);
}

// Suffixe ordinal
function getOrdinalSuffix(position) {
    if (position === 1) return 'er';
    return 'ème';
}
