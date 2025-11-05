function getTeamContent() {
    return `
        <h2 style="color: var(--primary-color); margin-bottom: 20px;">💼 Gestion de l'Équipe</h2>
        <div class="main-grid">
            <div class="section">
                <h3>👥 Pilotes</h3>
                ${gameState.drivers.map((driver, index) => `
                    <div class="driver-card" style="margin-bottom: 15px;">
                        <h4>Pilote #${index + 1}: ${driver.name}</h4>
                        <div style="color: #aaa; margin: 5px 0;">
                            Compétence: <span style="color: var(--primary-color); font-weight: bold;">${driver.skill}/100</span>
                        </div>
                        <div style="color: #aaa; margin: 5px 0;">
                            Salaire: <span style="color: var(--primary-color); font-weight: bold;">${(driver.salary / 1000000).toFixed(1)}M € /an</span>
                        </div>
                    </div>
                `).join('')}
                <button class="btn" onclick="hireDriver()">Recruter un nouveau pilote</button>
            </div>
            <div class="section">
                <h3>👷 Ingénieurs</h3>
                <div style="margin: 15px 0;">
                    <div style="color: #aaa;">
                        Nombre d'ingénieurs: <span style="color: var(--primary-color); font-weight: bold;">${gameState.engineers}</span>
                    </div>
                    <div style="color: #aaa; margin-top: 8px;">
                        Temps disponible: <span style="color: var(--primary-color); font-weight: bold;">${gameState.maxEngineerTime}</span>
                    </div>
                    <div style="color: #aaa; margin-top: 8px;">
                        Coût mensuel: <span style="color: var(--primary-color); font-weight: bold;">${(gameState.engineers * 50000 / 1000000).toFixed(2)}M €</span>
                    </div>
                </div>
                <button class="small-btn" onclick="hireEngineer()">
                    Embaucher ingénieur (+1, coût: 50k €/mois)
                </button>
            </div>
        </div>
        <div class="section" style="margin-top: 20px;">
            <h3>🏆 Sponsors</h3>
            ${gameState.sponsors.length === 0 ?
                '<div style="color: #aaa; padding: 20px; text-align: center;">Aucun sponsor actif</div>' :
                gameState.sponsors.map(sponsor => `
                    <div class="sponsor-card active">
                        <div style="font-weight: bold; color: #4ecca3; font-size: 1.1em;">${sponsor.name}</div>
                        <div style="color: #aaa; margin-top: 8px;">
                            Paiement mensuel: <span style="color: var(--primary-color); font-weight: bold;">${(sponsor.monthlyPay / 1000000).toFixed(1)}M €</span>
                        </div>
                        <div style="color: #aaa; margin-top: 5px;">
                            Contrat restant: <span style="color: var(--primary-color); font-weight: bold;">${sponsor.remainingMonths} mois</span>
                        </div>
                    </div>
                `).join('')
            }
            <h4 style="color: var(--primary-color); margin-top: 25px; margin-bottom: 15px;">Sponsors Disponibles</h4>
            <div class="dev-tree">
                ${availableSponsors.filter(s => !gameState.sponsors.find(gs => gs.name === s.name)).map(sponsor => {
                    const ourPosition = gameState.constructorStandings.find(t => t.team === gameState.teamName)?.position || 11;
                    const meetsRequirements = ourPosition <= sponsor.requirements.position;
                    return `
                        <div class="sponsor-card ${meetsRequirements ? '' : 'locked'}">
                            <h4>${sponsor.name}</h4>
                            <div class="dev-cost">💰 ${(sponsor.monthlyPay / 1000000).toFixed(1)}M € / mois</div>
                            <div class="dev-cost">📅 Durée: ${sponsor.duration} mois</div>
                            <div class="dev-cost">🏆 Requis: Top ${sponsor.requirements.position}</div>
                            ${meetsRequirements ?
                                `<button class="small-btn" onclick="signSponsor('${sponsor.name}', ${sponsor.monthlyPay}, ${sponsor.duration})">Signer</button>` :
                                '<div style="color: #888; margin-top: 10px;">🔒 Position insuffisante</div>'
                            }
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
        <div class="section" style="margin-top: 20px;">
            <h3>📅 Calendrier Important</h3>
            <table>
                <thead>
                    <tr>
                        <th>Événement</th>
                        <th>Date</th>
                        <th>Statut</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>Paiement salaires</td>
                        <td>Chaque 4 semaines</td>
                        <td>${gameState.week % 4 === 0 ? '⚠️ Aujourd\'hui' : `Dans ${4 - (gameState.week % 4)} semaines`}</td>
                    </tr>
                    <tr>
                        <td>Rapport Budget Cap</td>
                        <td>Chaque 4 semaines</td>
                        <td>${gameState.week % 4 === 0 ? '⚠️ Aujourd\'hui' : `Dans ${4 - (gameState.week % 4)} semaines`}</td>
                    </tr>
                    ${gameState.races.filter(r => !r.completed).slice(0, 3).map(race => `
                        <tr>
                            <td>${race.name}</td>
                            <td>Semaine ${race.week}</td>
                            <td>${race.week <= gameState.week ? '🏁 En cours' : `Dans ${race.week - gameState.week} semaines`}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}
