function getChassisContent() {
    return `
        <h2 style="color: var(--primary-color); margin-bottom: 20px;">🏗️ Recherche & Développement Châssis</h2>
        <div class="main-grid">
            <div class="section">
                <h3>🎯 Actions</h3>
                <div class="clicker-zone">
                    <button class="click-btn" onclick="performClick()">TRAVAILLER</button>
                    <div style="margin-top: 15px; color: #aaa;">
                        Temps: <span style="color: var(--primary-color); font-weight: bold;">${gameState.engineerTime} / ${gameState.maxEngineerTime}</span>
                    </div>
                    <div class="action-selector" style="margin-top: 20px;">
                        <select id="chassisActionSelect" onchange="changeAction(this.value)" style="background: rgba(0, 0, 0, 0.2); border: 1px solid var(--primary-color); color: var(--text-color);">
                            <option value="chassisWork" selected>🏗️ Travail Châssis (selon dev en cours)</option>
                            <option value="rdGeneration">🔬 Générer des points R&D (+10 points R&D | 10 temps)</option>
                        </select>
                    </div>
                </div>
            </div>
            <div class="section">
                <h3>📊 Classement Performance Châssis</h3>
                <table>
                    <thead>
                        <tr>
                            <th>Pos</th>
                            <th>Écurie</th>
                            <th>Performance</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${generateChassisRankings()}
                    </tbody>
                </table>
            </div>
        </div>
        <div class="section" style="margin-top: 20px;">
            <h3>🔧 Arbre de Développement Châssis</h3>
            <div class="dev-tree">
                ${Object.entries(chassisParts).map(([key, part]) => {
                    const dev = gameState.chassisDev[key] || { phase: 'locked', progress: 0 };
                    const isLocked = dev.phase === 'locked';
                    const isCompleted = dev.phase === 'completed';
                    return `
                        <div class="dev-item ${isLocked ? 'locked' : ''} ${isCompleted ? 'completed' : ''}" style="border: 2px solid ${isCompleted ? '#4ecca3' : isLocked ? '#555' : 'var(--primary-color)'};">
                            <h4>${part.name}</h4>
                            <div class="dev-cost">💰 ${(part.cost / 1000000).toFixed(1)}M €</div>
                            <div class="dev-cost">🔬 ${part.rd} points R&D</div>
                            <div class="dev-cost">⏱️ ${part.time} temps</div>
                            <div class="dev-cost">📈 +${part.perf} performance</div>
                            ${isCompleted ?
                                '<div style="color: #4ecca3; margin-top: 10px; font-weight: bold;">✅ Développé</div>' :
                                isLocked ?
                                    `<button class="small-btn" onclick="startDevelopment('chassis', '${key}')" style="background: var(--primary-color); border: 1px solid #fff;">Démarrer</button>` :
                                    `
                                        <div style="margin-top: 10px; color: #aaa; font-size: 0.9em;">Phase: ${dev.phase}</div>
                                        <div class="progress-bar" style="margin-top: 8px; background: rgba(0, 0, 0, 0.3);">
                                            <div class="progress-fill" style="width: ${dev.progress}%; background: linear-gradient(90deg, var(--primary-color), #ff6b81);">
                                                ${dev.progress}%
                                            </div>
                                        </div>
                                    `
                            }
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
}

function generateChassisRankings() {
    const rankings = [...gameState.constructorStandings];
    rankings.sort((a, b) => b.chassisPerf - a.chassisPerf);
    return rankings.slice(0, 11).map((team, index) => `
        <tr style="${team.team === gameState.teamName ? 'background: rgba(233, 69, 96, 0.1);' : ''}">
            <td class="position-${index + 1}">${index + 1}</td>
            <td style="font-weight: ${team.team === gameState.teamName ? 'bold' : 'normal'}; color: ${team.team === gameState.teamName ? 'var(--primary-color)' : 'inherit'};">
                ${team.team}${team.team === gameState.teamName ? ' 🏎️' : ''}
            </td>
            <td>${Math.round(team.chassisPerf)} pts</td>
        </tr>
    `).join('');
}
