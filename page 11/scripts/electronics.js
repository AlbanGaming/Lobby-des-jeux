function getElectronicsContent() {
    return `
        <h2 style="color: var(--primary-color); margin-bottom: 20px;">📡 Recherche & Développement Électronique</h2>
        <div class="main-grid">
            <div class="section">
                <h3>🎯 Actions</h3>
                <div class="clicker-zone">
                    <button class="click-btn" onclick="performClick()">TRAVAILLER</button>
                    <div style="margin-top: 15px; color: #aaa;">
                        Temps: <span style="color: var(--primary-color); font-weight: bold;">${gameState.engineerTime} / ${gameState.maxEngineerTime}</span>
                    </div>
                </div>
            </div>
            <div class="section">
                <h3>📊 Classement Performance Électronique</h3>
                <table>
                    <thead>
                        <tr>
                            <th>Pos</th>
                            <th>Écurie</th>
                            <th>Performance</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${generateElectronicsRankings()}
                    </tbody>
                </table>
            </div>
        </div>
        <div class="section" style="margin-top: 20px;">
            <h3>🔧 Arbre de Développement Électronique</h3>
            <div class="dev-tree">
                ${Object.entries(electronicsParts).map(([key, part]) => {
                    const dev = gameState.electronicsDev[key] || { phase: 'locked', progress: 0 };
                    const isLocked = dev.phase === 'locked';
                    const isCompleted = dev.phase === 'completed';
                    return `
                        <div class="dev-item ${isLocked ? 'locked' : ''} ${isCompleted ? 'completed' : ''}">
                            <h4>${part.name}</h4>
                            <div class="dev-cost">💰 ${(part.cost / 1000000).toFixed(1)}M €</div>
                            <div class="dev-cost">🔬 ${part.rd} points R&D</div>
                            <div class="dev-cost">⏱️ ${part.time} temps</div>
                            <div class="dev-cost">📈 +${part.perf} performance</div>
                            ${isCompleted ?
                                '<div style="color: #4ecca3; margin-top: 10px;">✅ Développé</div>' :
                                isLocked ?
                                    `<button class="small-btn" onclick="startDevelopment('electronics', '${key}')">Démarrer</button>` :
                                    `
                                        <div style="margin-top: 10px; color: #aaa;">Phase: ${dev.phase}</div>
                                        <div class="progress-bar" style="margin-top: 8px;">
                                            <div class="progress-fill" style="width: ${dev.progress}%;">
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

function generateElectronicsRankings() {
    const rankings = gameState.constructorStandings.map(team => ({
        team: team.team,
        perf: team.electronicsPerf
    }));
    rankings.sort((a, b) => b.perf - a.perf);
    return rankings.slice(0, 11).map((team, index) => `
        <tr style="${team.team === gameState.teamName ? 'background: rgba(233, 69, 96, 0.2);' : ''}">
            <td class="position-${index + 1}">${index + 1}</td>
            <td style="font-weight: ${team.team === gameState.teamName ? 'bold' : 'normal'};">
                ${team.team}${team.team === gameState.teamName ? ' 🏎️' : ''}
            </td>
            <td>${Math.round(team.perf)} pts</td>
        </tr>
    `).join('');
}
