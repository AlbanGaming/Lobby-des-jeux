function getHistoryContent() {
    return `
        <h2 style="color: var(--primary-color); margin-bottom: 20px;">📚 Historique</h2>
        <div class="section">
            <h3>🏁 Résultats des Courses</h3>
            ${gameState.raceResults.length === 0 ?
                '<div style="color: #aaa; padding: 20px; text-align: center;">Aucune course disputée</div>' :
                `<table>
                    <thead>
                        <tr>
                            <th>Course</th>
                            <th>Pilote 1</th>
                            <th>Pos 1</th>
                            <th>Pilote 2</th>
                            <th>Pos 2</th>
                            <th>Points</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${gameState.raceResults.map(result => `
                            <tr>
                                <td>${result.raceName}</td>
                                <td>${result.driver1}</td>
                                <td class="position-${result.pos1 <= 3 ? result.pos1 : ''}">${result.pos1}</td>
                                <td>${result.driver2}</td>
                                <td class="position-${result.pos2 <= 3 ? result.pos2 : ''}">${result.pos2}</td>
                                <td style="font-weight: bold; color: var(--primary-color);">${result.points}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>`
            }
        </div>
        <div class="section" style="margin-top: 20px;">
            <h3>🔧 Historique de Fabrication</h3>
            ${gameState.history.length === 0 ?
                '<div style="color: #aaa; padding: 20px; text-align: center;">Aucune fabrication enregistrée</div>' :
                `<table>
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Pièce</th>
                            <th>Résultat</th>
                            <th>Qualité</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${gameState.history.map(entry => `
                            <tr>
                                <td>S${entry.week}</td>
                                <td>${entry.part}</td>
                                <td>${entry.success ? '✅ Réussi' : '❌ Échec'}</td>
                                <td>${entry.quality}%</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>`
            }
        </div>
    `;
}
