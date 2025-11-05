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
        { name: 'Pilote 1', skill: 75, salary: 2000000 },
        { name: 'Pilote 2', skill: 70, salary: 1500000 }
    ],
    engineSupplier: null,
    engineCost: 0,
    ownEngine: false,
    sponsors: [],
    aeroPerf: 50,  // Performance initiale de votre écurie
    chassisPerf: 50,
    enginePerf: 50,
    electronicsPerf: 50,
    brakesPerf: 50,
    aeroDev: {},
    chassisDev: {},
    engineDev: {},
    electronicsDev: {},
    brakesDev: {},
    parts: {
        frontWing: [],
        rearWing: [],
        floor: [],
        sidepods: [],
        chassis: [],
        suspension: [],
        engine: [],
        electronics: [],
        brakes: []
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
    frontWingV3: { name: 'Ailette avant V3', cost: 2500000, rd: 250, time: 500, perf: 12, category: 'frontWing' },
    frontWingV4: { name: 'Ailette avant V4', cost: 4000000, rd: 400, time: 700, perf: 18, category: 'frontWing' },
    rearWingV1: { name: 'Aileron arrière V1', cost: 900000, rd: 90, time: 220, perf: 4, category: 'rearWing' },
    rearWingV2: { name: 'Aileron arrière V2', cost: 1800000, rd: 180, time: 400, perf: 9, category: 'rearWing' },
    rearWingV3: { name: 'Aileron arrière V3', cost: 3000000, rd: 300, time: 600, perf: 15, category: 'rearWing' },
    floorV1: { name: 'Fond plat V1', cost: 1200000, rd: 120, time: 300, perf: 5, category: 'floor' },
    floorV2: { name: 'Fond plat V2', cost: 2500000, rd: 250, time: 550, perf: 11, category: 'floor' },
    floorV3: { name: 'Fond plat V3', cost: 4000000, rd: 400, time: 800, perf: 18, category: 'floor' },
    sidepodsV1: { name: 'Pontons V1', cost: 1000000, rd: 100, time: 250, perf: 4, category: 'sidepods' },
    sidepodsV2: { name: 'Pontons V2', cost: 2000000, rd: 200, time: 450, perf: 9, category: 'sidepods' },
    sidepodsV3: { name: 'Pontons V3', cost: 3500000, rd: 350, time: 700, perf: 15, category: 'sidepods' },
    diffuserV1: { name: 'Diffuseur V1', cost: 1500000, rd: 150, time: 350, perf: 6, category: 'floor' },
    diffuserV2: { name: 'Diffuseur V2', cost: 3000000, rd: 300, time: 650, perf: 13, category: 'floor' },
    bargeboardsV1: { name: 'Déflecteurs V1', cost: 1300000, rd: 130, time: 320, perf: 5, category: 'sidepods' },
    bargeboardsV2: { name: 'Déflecteurs V2', cost: 2800000, rd: 280, time: 600, perf: 11, category: 'sidepods' }
};

// Définition des composants châssis
const chassisParts = {
    chassisV1: { name: 'Châssis V1', cost: 3000000, rd: 300, time: 600, perf: 8, category: 'chassis' },
    chassisV2: { name: 'Châssis V2', cost: 6000000, rd: 600, time: 1100, perf: 18, category: 'chassis' },
    chassisV3: { name: 'Châssis V3', cost: 10000000, rd: 1000, time: 1800, perf: 30, category: 'chassis' },
    suspensionV1: { name: 'Suspension V1', cost: 2000000, rd: 200, time: 450, perf: 6, category: 'suspension' },
    suspensionV2: { name: 'Suspension V2', cost: 4500000, rd: 450, time: 900, perf: 14, category: 'suspension' },
    suspensionV3: { name: 'Suspension V3', cost: 8000000, rd: 800, time: 1500, perf: 24, category: 'suspension' },
    coolingV1: { name: 'Refroidissement V1', cost: 1800000, rd: 180, time: 400, perf: 5, category: 'chassis' },
    coolingV2: { name: 'Refroidissement V2', cost: 3800000, rd: 380, time: 800, perf: 12, category: 'chassis' },
    gearboxV1: { name: 'Boîte de vitesses V1', cost: 2500000, rd: 250, time: 550, perf: 7, category: 'chassis' },
    gearboxV2: { name: 'Boîte de vitesses V2', cost: 5500000, rd: 550, time: 1200, perf: 16, category: 'chassis' }
};

// Définition des composants moteur
const engineParts = {
    engineV1: { name: 'Moteur V1', cost: 5000000, rd: 500, time: 1000, perf: 10, category: 'engine' },
    engineV2: { name: 'Moteur V2', cost: 10000000, rd: 1000, time: 1800, perf: 22, category: 'engine' },
    engineV3: { name: 'Moteur V3', cost: 18000000, rd: 1800, time: 2800, perf: 36, category: 'engine' },
    turboV1: { name: 'Turbo V1', cost: 3000000, rd: 300, time: 700, perf: 8, category: 'engine' },
    turboV2: { name: 'Turbo V2', cost: 7000000, rd: 700, time: 1400, perf: 18, category: 'engine' },
    ersV1: { name: 'ERS V1', cost: 4000000, rd: 400, time: 900, perf: 10, category: 'engine' },
    ersV2: { name: 'ERS V2', cost: 9000000, rd: 900, time: 1700, perf: 22, category: 'engine' },
    batteryV1: { name: 'Batterie V1', cost: 2500000, rd: 250, time: 600, perf: 6, category: 'engine' },
    batteryV2: { name: 'Batterie V2', cost: 6000000, rd: 600, time: 1200, perf: 14, category: 'engine' }
};

// Définition des composants électronique
const electronicsParts = {
    ecuV1: { name: 'ECU V1', cost: 2000000, rd: 200, time: 500, perf: 5, category: 'electronics' },
    ecuV2: { name: 'ECU V2', cost: 4500000, rd: 450, time: 1000, perf: 12, category: 'electronics' },
    ecuV3: { name: 'ECU V3', cost: 8000000, rd: 800, time: 1600, perf: 20, category: 'electronics' },
    sensorsV1: { name: 'Capteurs V1', cost: 1500000, rd: 150, time: 400, perf: 4, category: 'electronics' },
    sensorsV2: { name: 'Capteurs V2', cost: 3500000, rd: 350, time: 800, perf: 10, category: 'electronics' },
    telemetryV1: { name: 'Télémétrie V1', cost: 1800000, rd: 180, time: 450, perf: 5, category: 'electronics' },
    telemetryV2: { name: 'Télémétrie V2', cost: 4000000, rd: 400, time: 900, perf: 12, category: 'electronics' }
};

// Définition des composants freins
const brakesParts = {
    brakesV1: { name: 'Freins V1', cost: 1500000, rd: 150, time: 400, perf: 4, category: 'brakes' },
    brakesV2: { name: 'Freins V2', cost: 3500000, rd: 350, time: 800, perf: 10, category: 'brakes' },
    brakesV3: { name: 'Freins V3', cost: 6000000, rd: 600, time: 1300, perf: 18, category: 'brakes' },
    brakeCoolingV1: { name: 'Refroidissement freins V1', cost: 1200000, rd: 120, time: 350, perf: 3, category: 'brakes' },
    brakeCoolingV2: { name: 'Refroidissement freins V2', cost: 2800000, rd: 280, time: 700, perf: 8, category: 'brakes' }
};

// Fournisseurs de moteurs
const engineSuppliers = [
    { name: 'Mercedes', cost: 15000000, perf: 95 },
    { name: 'Ferrari', cost: 15000000, perf: 93 },
    { name: 'Renault', cost: 12000000, perf: 88 },
    { name: 'Honda', cost: 14000000, perf: 91 },
    { name: 'Red Bull Powertrains', cost: 16000000, perf: 96 }
];

// Sponsors disponibles
const availableSponsors = [
    { name: 'Petronas', monthlyPay: 1500000, requirements: { position: 8 }, duration: 12 },
    { name: 'Shell', monthlyPay: 1200000, requirements: { position: 10 }, duration: 12 },
    { name: 'Aramco', monthlyPay: 2000000, requirements: { position: 5 }, duration: 24 },
    { name: 'Heineken', monthlyPay: 1000000, requirements: { position: 12 }, duration: 12 },
    { name: 'Rolex', monthlyPay: 1800000, requirements: { position: 6 }, duration: 18 },
    { name: 'DHL', monthlyPay: 900000, requirements: { position: 15 }, duration: 12 },
    { name: 'Pirelli', monthlyPay: 800000, requirements: { position: 10 }, duration: 12 },
    { name: 'AWS', monthlyPay: 1500000, requirements: { position: 8 }, duration: 12 },
    { name: 'Monster Energy', monthlyPay: 1200000, requirements: { position: 12 }, duration: 12 },
    { name: 'Oracle', monthlyPay: 1000000, requirements: { position: 10 }, duration: 12 }
];

// Calendrier 2022
const calendar2022 = [
    { name: 'Bahrain GP', circuit: 'Sakhir', week: 3 },
    { name: 'Saudi Arabia GP', circuit: 'Jeddah', week: 5 },
    { name: 'Australian GP', circuit: 'Melbourne', week: 7 },
    { name: 'Emilia Romagna GP', circuit: 'Imola', week: 9 },
    { name: 'Miami GP', circuit: 'Miami', week: 11 },
    { name: 'Spanish GP', circuit: 'Barcelona', week: 14 },
    { name: 'Monaco GP', circuit: 'Monte Carlo', week: 16 },
    { name: 'Azerbaijan GP', circuit: 'Baku', week: 18 },
    { name: 'Canadian GP', circuit: 'Montreal', week: 20 },
    { name: 'British GP', circuit: 'Silverstone', week: 22 },
    { name: 'Austrian GP', circuit: 'Spielberg', week: 24 },
    { name: 'French GP', circuit: 'Paul Ricard', week: 26 },
    { name: 'Hungarian GP', circuit: 'Hungaroring', week: 28 },
    { name: 'Belgian GP', circuit: 'Spa', week: 32 },
    { name: 'Dutch GP', circuit: 'Zandvoort', week: 34 },
    { name: 'Italian GP', circuit: 'Monza', week: 36 },
    { name: 'Singapore GP', circuit: 'Marina Bay', week: 38 },
    { name: 'Japanese GP', circuit: 'Suzuka', week: 40 },
    { name: 'USA GP', circuit: 'Austin', week: 43 },
    { name: 'Mexico GP', circuit: 'Mexico City', week: 45 },
    { name: 'Brazil GP', circuit: 'Interlagos', week: 47 },
    { name: 'Abu Dhabi GP', circuit: 'Yas Marina', week: 50 }
];

// Initialiser les classements avec 10 équipes
const teams = [
    'Red Bull Racing', 'Ferrari', 'Mercedes', 'McLaren', 'Alpine',
    'Alfa Romeo', 'Haas', 'AlphaTauri', 'Aston Martin', 'Williams'
];

// Pièces de base (montables sur la voiture)
const baseParts = {
    frontWing: { name: 'Ailette avant de base', perf: 2, condition: 100 },
    rearWing: { name: 'Aileron arrière de base', perf: 3, condition: 100 },
    floor: { name: 'Fond plat de base', perf: 4, condition: 100 },
    sidepods: { name: 'Pontons de base', perf: 3, condition: 100 },
    chassis: { name: 'Châssis de base', perf: 5, condition: 100 },
    suspension: { name: 'Suspension de base', perf: 2, condition: 100 },
    engine: { name: 'Moteur de base', perf: 8, condition: 100 },
    electronics: { name: 'Électronique de base', perf: 3, condition: 100 },
    brakes: { name: 'Freins de base', perf: 2, condition: 100 }
};

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

// Augmenter les performances chaque semaine (0 à 5 points par catégorie)
function increaseWeeklyPerformances() {
    // Augmenter les performances de votre écurie
    gameState.aeroPerf += Math.floor(Math.random() * 6);
    gameState.chassisPerf += Math.floor(Math.random() * 6);
    gameState.enginePerf += Math.floor(Math.random() * 6);
    gameState.electronicsPerf += Math.floor(Math.random() * 6);
    gameState.brakesPerf += Math.floor(Math.random() * 6);

    // Augmenter les performances des rivaux
    teams.forEach(team => {
        rivalPerformances[team].aero += Math.floor(Math.random() * 6);
        rivalPerformances[team].chassis += Math.floor(Math.random() * 6);
        rivalPerformances[team].engine += Math.floor(Math.random() * 6);
        rivalPerformances[team].electronics += Math.floor(Math.random() * 6);
        rivalPerformances[team].brakes += Math.floor(Math.random() * 6);
        rivalPerformances[team].totalPerf = rivalPerformances[team].aero + rivalPerformances[team].chassis +
                                             rivalPerformances[team].engine + rivalPerformances[team].electronics +
                                             rivalPerformances[team].brakes;
    });

    // Mettre à jour les classements
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
    } else {
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
    }

    // Re-trier par performance totale
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
    gameState.races = JSON.parse(JSON.stringify(calendar2022));
    initializeRivalPerformances();
    initializeStandings();
    gameState.parts = {
        frontWing: [baseParts.frontWing],
        rearWing: [baseParts.rearWing],
        floor: [baseParts.floor],
        sidepods: [baseParts.sidepods],
        chassis: [baseParts.chassis],
        suspension: [baseParts.suspension],
        engine: [baseParts.engine],
        electronics: [baseParts.electronics],
        brakes: [baseParts.brakes]
    };
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

function getOrdinalSuffix(position) {
    if (position === 1) return 'er';
    return 'ème';
}

// Changer d'onglet
function switchTab(tab) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');
    const content = document.getElementById('content');
    switch(tab) {
        case 'home':
            content.innerHTML = getHomeContent();
            break;
        case 'aero':
            content.innerHTML = getAeroContent();
            break;
        case 'chassis':
            content.innerHTML = getChassisContent();
            break;
        case 'engine':
            content.innerHTML = getEngineContent();
            break;
        case 'electronics':
            content.innerHTML = getElectronicsContent();
            break;
        case 'brakes':
            content.innerHTML = getBrakesContent();
            break;
        case 'manufacturing':
            content.innerHTML = getManufacturingContent();
            break;
        case 'team':
            content.innerHTML = getTeamContent();
            break;
        case 'history':
            content.innerHTML = getHistoryContent();
            break;
    }
}

// Passer à la semaine suivante
function advanceWeek() {
    gameState.week++;
    gameState.engineerTime = gameState.maxEngineerTime;
    increaseWeeklyPerformances(); // Augmenter les performances chaque semaine

    if (gameState.week % 4 === 0) {
        let totalSponsor = 0;
        gameState.sponsors.forEach(sponsor => {
            totalSponsor += sponsor.monthlyPay;
            sponsor.remainingMonths--;
        });
        gameState.money += totalSponsor;
        gameState.sponsors = gameState.sponsors.filter(s => s.remainingMonths > 0);
        const salaries = gameState.drivers.reduce((sum, d) => sum + d.salary, 0) / 12 +
                        gameState.engineers * 50000;
        gameState.money -= salaries;
        gameState.budgetSpent += salaries;
        if (gameState.budgetSpent > 140000000) {
            alert('⚠️ ATTENTION ! Vous avez dépassé le Budget Cap de 140M € ! Pénalités possibles.');
        }
    }
    const currentRace = gameState.races.find(r => r.week === gameState.week && !r.completed);
    if (currentRace) {
        simulateRace(currentRace);
    }
    Object.values(gameState.parts).forEach(category => {
        if (Array.isArray(category)) {
            category.forEach(part => {
                part.condition = Math.max(0, part.condition - Math.random() * 2);
            });
        }
    });
    if (gameState.week > 52) {
        alert(`🏁 Fin de la saison ${gameState.year} !`);
        gameState.year++;
        gameState.week = 1;
        gameState.races = JSON.parse(JSON.stringify(calendar2022));
        gameState.budgetSpent = 0;
        initializeRivalPerformances(); // Réinitialiser les performances aléatoires
        initializeStandings();
    }
    updateStats();
    switchTab(getCurrentTab());
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
            gameState.rdPoints += gameState.timePerClick;
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

function getCurrentTab() {
    const activeTab = document.querySelector('.tab.active');
    const tabs = ['home', 'aero', 'chassis', 'engine', 'electronics', 'brakes', 'manufacturing', 'team', 'history'];
    const index = Array.from(document.querySelectorAll('.tab')).indexOf(activeTab);
    return tabs[index] || 'home';
}

function changeAction(action) {
    gameState.currentAction = action;
}

function updateTimePerClick(value) {
    gameState.timePerClick = parseInt(value);
}

function startDevelopment(type, key) {
    let parts, devState;
    switch(type) {
        case 'aero':
            parts = aeroParts;
            devState = gameState.aeroDev;
            break;
        case 'chassis':
            parts = chassisParts;
            devState = gameState.chassisDev;
            break;
        case 'engine':
            parts = engineParts;
            devState = gameState.engineDev;
            break;
        case 'electronics':
            parts = electronicsParts;
            devState = gameState.electronicsDev;
            break;
        case 'brakes':
            parts = brakesParts;
            devState = gameState.brakesDev;
            break;
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

function progressDevelopment(type, timeAdded) {
    let devState;
    switch(type) {
        case 'aero':
            devState = gameState.aeroDev;
            break;
        case 'chassis':
            devState = gameState.chassisDev;
            break;
        case 'engine':
            devState = gameState.engineDev;
            break;
        case 'electronics':
            devState = gameState.electronicsDev;
            break;
        case 'brakes':
            devState = gameState.brakesDev;
            break;
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
                } else if (dev.phase === 'test') {
                    const success = Math.random() > 0.2;
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

                        // Mettre à jour la performance totale de votre écurie
                        const ourTeam = gameState.constructorStandings.find(t => t.team === gameState.teamName);
                        if (ourTeam) {
                            ourTeam.aeroPerf = gameState.aeroPerf;
                            ourTeam.chassisPerf = gameState.chassisPerf;
                            ourTeam.enginePerf = gameState.enginePerf;
                            ourTeam.electronicsPerf = gameState.electronicsPerf;
                            ourTeam.brakesPerf = gameState.brakesPerf;
                            ourTeam.totalPerf = gameState.aeroPerf + gameState.chassisPerf + gameState.enginePerf +
                                               gameState.electronicsPerf + gameState.brakesPerf;
                        }

                        const category = parts[key].category;
                        if (!gameState.parts[category]) gameState.parts[category] = [];
                        gameState.parts[category].push({
                            name: parts[key].name,
                            perf: parts[key].perf,
                            condition: 100
                        });
                        gameState.tasks = gameState.tasks.filter(t => t.key !== key || t.type !== type);

                        // Re-trier les classements après un développement réussi
                        gameState.constructorStandings.sort((a, b) => b.totalPerf - a.totalPerf);
                        gameState.constructorStandings.forEach((team, index) => {
                            team.position = index + 1;
                        });
                    } else {
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

// Fabrication des pièces
function manufacturePart(type, key) {
    let parts, devState, category;
    switch(type) {
        case 'aero':
            parts = aeroParts;
            devState = gameState.aeroDev;
            category = parts[key].category;
            break;
        case 'chassis':
            parts = chassisParts;
            devState = gameState.chassisDev;
            category = parts[key].category;
            break;
        case 'engine':
            parts = engineParts;
            devState = gameState.engineDev;
            category = parts[key].category;
            break;
        case 'electronics':
            parts = electronicsParts;
            devState = gameState.electronicsDev;
            category = parts[key].category;
            break;
        case 'brakes':
            parts = brakesParts;
            devState = gameState.brakesDev;
            category = parts[key].category;
            break;
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
            condition: Math.round(quality)
        });
        devState[key].manufactured = true;
        gameState.history.push({
            week: gameState.week,
            part: part.name,
            success: true,
            quality: Math.round(quality)
        });
        alert(`✅ ${part.name} fabriqué avec succès ! Qualité: ${Math.round(quality)}%`);
    } else {
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

// Sélectionner un fournisseur de moteur
function selectEngineSupplier(name, cost, perf) {
    if (gameState.money < cost) {
        alert('Pas assez d\'argent pour acheter ce moteur !');
        return;
    }
    gameState.money -= cost;
    gameState.budgetSpent += cost;
    gameState.engineSupplier = name;
    gameState.engineCost = cost;
    gameState.enginePerf = perf;

    // Mettre à jour la performance totale de votre écurie
    const ourTeam = gameState.constructorStandings.find(t => t.team === gameState.teamName);
    if (ourTeam) {
        ourTeam.enginePerf = gameState.enginePerf;
        ourTeam.totalPerf = gameState.aeroPerf + gameState.chassisPerf + gameState.enginePerf +
                           gameState.electronicsPerf + gameState.brakesPerf;
    }

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
            gameState.drivers[1] = { name, skill, salary };
        }
    } else {
        gameState.drivers.push({ name, skill, salary });
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

// Simuler une course
function simulateRace(race) {
    const totalPerf = gameState.aeroPerf + gameState.chassisPerf + gameState.enginePerf +
                      gameState.electronicsPerf + gameState.brakesPerf;
    const basePosition = Math.max(1, Math.min(20, Math.round(21 - totalPerf / 30)));
    const pos1 = Math.max(1, basePosition + Math.round((Math.random() - 0.5) * 4));
    const pos2 = Math.max(1, basePosition + Math.round((Math.random() - 0.5) * 4));
    const pointsSystem = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
    const points1 = pos1 <= 10 ? pointsSystem[pos1 - 1] : 0;
    const points2 = pos2 <= 10 ? pointsSystem[pos2 - 1] : 0;
    const totalPoints = points1 + points2;

    // Mettre à jour les points de votre écurie
    const ourTeam = gameState.constructorStandings.find(t => t.team === gameState.teamName);
    if (ourTeam) {
        ourTeam.points += totalPoints;
    }

    // Mettre à jour les points des rivaux (simulation)
    gameState.constructorStandings.forEach(team => {
        if (team.team !== gameState.teamName) {
            team.points += Math.round(Math.random() * 30);
        }
    });

    // Enregistrer le résultat de la course
    gameState.raceResults.push({
        raceName: race.name,
        driver1: gameState.drivers[0].name,
        pos1: pos1,
        driver2: gameState.drivers[1].name,
        pos2: pos2,
        points: totalPoints
    });

    // Trier le classement par points
    gameState.constructorStandings.sort((a, b) => b.points - a.points);
    gameState.constructorStandings.forEach((team, index) => {
        team.position = index + 1;
    });

    race.completed = true;
    alert(`🏁 ${race.name} terminé !\n\n${gameState.drivers[0].name}: P${pos1} (${points1} pts)\n${gameState.drivers[1].name}: P${pos2} (${points2} pts)\n\nTotal: ${totalPoints} points`);
}
