function getHomeContent() {
    const totalPerf = gameState.aeroPerf + gameState.chassisPerf + gameState.enginePerf + gameState.electronicsPerf + gameState.brakesPerf;
    return `
        <div class="main-grid">
            <div class="section">
                <h3>🎯 Centre de Commande</h3>
                <div style="display: flex; gap: 20px;">
                    <div style="flex: 1;">
                        <div class="clicker-zone">
                            <button class="click-btn" onclick="performClick()">TRAVAILLER</button>
                            <div style="margin-top: 15px; color: #aaa;">
                                Clics: <span style="color: var(--primary-color); font-weight: bold;">${gameState.clicks}</span>
                            </div>
                            <div style="margin-top: 10px; color: #aaa;">
                                Coût: <span style="color: var(--primary-color); font-weight: bold;">${gameState.timePerClick}</span> unités de temps
                            </div>
                        </div>
                        <div class="action-selector">
                            <select id="actionSelect" onchange="changeAction(this.value)">
                                <option value="rdGeneration" ${gameState.currentAction === 'rdGeneration' ? 'selected' : ''}>
                                    🔬 Générer des points R&D (+10 points R&D | 10 temps)
                                </option>
                                <option value="aeroWork" ${gameState.currentAction === 'aeroWork' ? 'selected' : ''}>
                                    ✈️ Travail Aéro (selon dev en cours)
                                </option>
                                <option value="chassisWork" ${gameState.currentAction === 'chassisWork' ? 'selected' : ''}>
                                    🏗️ Travail Châssis (selon dev en cours)
                                </option>
                                <option value="engineWork" ${gameState.currentAction === 'engineWork' ? 'selected' : ''}>
                                    ⚙️ Travail Moteur (selon dev en cours)
                                </option>
                                <option value="electronicsWork" ${gameState.currentAction === 'electronicsWork' ? 'selected' : ''}>
                                    📡 Travail Électronique (selon dev en cours)
                                </option>
                                <option value="brakesWork" ${gameState.currentAction === 'brakesWork' ? 'selected' : ''}>
                                    🛑 Travail Freins (selon dev en cours)
                                </option>
                            </select>
                            <div class="input-group" style="margin-top: 15px;">
                                <label style="color: #aaa;">Temps par clic:</label>
                                <input type="number" id="timePerClick" value="${gameState.timePerClick}" min="1" max="100" onchange="updateTimePerClick(this.value)">
                            </div>
                        </div>
                        <button class="btn" onclick="advanceWeek()" style="margin-top: 20px;">
                            ⏭️ PASSER À LA SEMAINE SUIVANTE
                        </button>
                    </div>
                    <div style="flex: 1;">
                        <h4>🏎️ Performance de la voiture</h4>
                        <div style="margin-top: 10px;">
                            <div style="display: flex; justify-content: space-between; margin: 8px 0;">
                                <span>Aéro:</span>
                                <span style="color: var(--primary-color); font-weight: bold;">${gameState.aeroPerf} pts</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; margin: 8px 0;">
                                <span>Châssis:</span>
                                <span style="color: var(--primary-color); font-weight: bold;">${gameState.chassisPerf} pts</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; margin: 8px 0;">
                                <span>Moteur:</span>
                                <span style="color: var(--primary-color); font-weight: bold;">${gameState.enginePerf} pts</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; margin: 8px 0;">
                                <span>Électronique:</span>
                                <span style="color: var(--primary-color); font-weight: bold;">${gameState.electronicsPerf} pts</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; margin: 8px 0;">
                                <span>Freins:</span>
                                <span style="color: var(--primary-color); font-weight: bold;">${gameState.brakesPerf} pts</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; margin: 15px 0; padding-top: 10px; border-top: 2px solid var(--primary-color);">
                                <span style="font-weight: bold;">TOTAL:</span>
                                <span style="color: var(--primary-color); font-weight: bold; font-size: 1.3em;">${totalPerf} pts</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="section">
                <h3>📋 Tâches en cours</h3>
                <div class="task-list">
                    ${gameState.tasks.length === 0 ?
                        '<div style="color: #aaa; text-align: center; padding: 20px;">Aucune tâche en cours</div>' :
                        gameState.tasks.map(task => `
                            <div class="task-item">
                                <div style="font-weight: bold; color: var(--primary-color);">${task.name}</div>
                                <div style="font-size: 0.9em; color: #aaa; margin-top: 5px;">
                                    ${task.phase} - ${task.progress}%
                                </div>
                                <div class="progress-bar" style="margin-top: 8px;">
                                    <div class="progress-fill" style="width: ${task.progress}%;">
                                        ${task.progress}%
                                    </div>
                                </div>
                            </div>
                        `).join('')
                    }
                </div>
            </div>
        </div>
        <div class="main-grid">
            <div class="section">
                <h3>🏁 Calendrier des Courses ${gameState.year}</h3>
                <div style="max-height: 400px; overflow-y: auto;">
                    <table>
                        <thead>
                            <tr>
                                <th>Course</th>
                                <th>Circuit</th>
                                <th>Semaine</th>
                                <th>Statut</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${gameState.races.map(race => `
                                <tr>
                                    <td>${race.name}</td>
                                    <td>${race.circuit}</td>
                                    <td>S${race.week}</td>
                                    <td>${race.completed ? '✅ Terminée' : (race.week <= gameState.week ? '🏁 En cours' : '⏳ À venir')}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
            <div class="section">
                <h3>🏆 Classement Constructeurs</h3>
                <table class="championship-table">
                    <thead>
                        <tr>
                            <th>Pos</th>
                            <th>Écurie</th>
                            <th>Points</th>
                            <th>Performance</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${gameState.constructorStandings.slice(0, 11).map((team, index) => `
                            <tr class="${team.team === gameState.teamName ? 'position-' + (index + 1) : ''}" style="${team.team === gameState.teamName ? 'background: rgba(233, 69, 96, 0.2);' : ''}">
                                <td class="position-${index + 1}">${index + 1}</td>
                                <td style="font-weight: ${team.team === gameState.teamName ? 'bold' : 'normal'};">
                                    ${team.team}${team.team === gameState.teamName ? ' 🏎️' : ''}
                                </td>
                                <td>${Math.round(team.points)}</td>
                                <td>${team.team === gameState.teamName ? totalPerf : Math.round(500 - index * 40 + Math.random() * 20)} pts</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
        <div class="section">
            <h3>🏎️ Configuration des Voitures</h3>
            <div class="car-config">
                <div class="driver-card">
                    <h3>🏎️ Voiture #1 - ${gameState.drivers[0].name}</h3>
                    ${getCarConfigUI(0)}
                </div>
                <div class="driver-card">
                    <h3>🏎️ Voiture #2 - ${gameState.drivers[1].name}</h3>
                    ${getCarConfigUI(1)}
                </div>
            </div>
        </div>
    `;
}
