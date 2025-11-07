function getEngineContent() {
    const hasEngine = gameState.engineSupplier !== null || gameState.ownEngine;
    return `
        <h2 style="color: var(--primary-color); margin-bottom: 20px;">⚙️ Recherche & Développement Moteur</h2>
        ${!hasEngine ? `
            <div class="message" style="background: rgba(233, 69, 96, 0.1); border-left: 4px solid var(--primary-color); padding: 15px; margin-bottom: 20px;">
                ⚠️ Vous devez d'abord choisir un fournisseur de moteur pour commencer la saison !
            </div>
            <div class="section">
                <h3>🏭 Fournisseurs de Moteurs Disponibles</h3>
                <div class="dev-tree">
                    ${engineSuppliers.map(supplier => `
                        <div class="dev-item" style="border: 2px solid var(--primary-color);">
                            <h4>${supplier.name}</h4>
                            <div class="dev-cost">💰 ${(supplier.cost / 1000000).toFixed(1)}M € / an</div>
                            <div class="dev-cost">📈 ${supplier.perf} pts performance</div>
                            <div class="dev-cost">🔧 Pièces incluses: ${supplier.parts.join(', ')}</div>
                            <button class="small-btn" onclick="selectEngineSupplier('${supplier.name}', ${supplier.cost}, ${supplier.perf}, ['${supplier.parts.join("','")}'])" style="background: var(--primary-color); border: 1px solid #fff;">
                                Sélectionner
                            </button>
                        </div>
                    `).join('')}
                </div>
            </div>
        ` : `
            <div class="section">
                <h3>🏭 Moteur Actuel</h3>
                <div style="padding: 20px; background: rgba(78, 204, 163, 0.1); border-radius: 8px; border: 2px solid #4ecca3; margin-bottom: 20px;">
                    <div style="font-size: 1.2em; font-weight: bold; color: #4ecca3; margin-bottom: 10px;">
                        ${gameState.ownEngine ? '🏭 Moteur Maison' : `🏭 ${gameState.engineSupplier}`}
                    </div>
                    <div style="color: #aaa; margin: 5px 0;">
                        Performance: <span style="color: var(--primary-color); font-weight: bold;">${gameState.enginePerf} pts</span>
                    </div>
                    ${!gameState.ownEngine ? `
                        <div style="color: #aaa; margin: 5px 0;">
                            Coût annuel: <span style="color: var(--primary-color); font-weight: bold;">${(gameState.engineCost / 1000000).toFixed(1)}M €</span>
                        </div>
                    ` : ''}
                    <div style="color: #aaa; margin: 5px 0;">
                        Pièces installées: <span style="color: var(--primary-color); font-weight: bold;">${gameState.parts.engine.map(p => p.name).join(', ')}</span>
                    </div>
                </div>
                ${!gameState.ownEngine && gameState.year >= 2024 ? `
                    <div class="message" style="background: rgba(78, 204, 163, 0.1); border-left: 4px solid #4ecca3; padding: 15px; margin-bottom: 20px;">
                        💡 Après 2 ans d'activité, vous pouvez développer votre propre moteur !
                        <button class="btn" style="margin-top: 15px; background: #4ecca3;" onclick="startOwnEngine()">
                            Demander l'accréditation moteur (Coût: 50M €)
                        </button>
                    </div>
                ` : ''}
            </div>
            ${gameState.ownEngine ? `
                <div class="section" style="margin-top: 20px;">
                    <h3>🔧 Développement Moteur</h3>
                    <div class="clicker-zone" style="margin-bottom: 20px;">
                        <button class="click-btn" onclick="performClick()">TRAVAILLER</button>
                        <div style="margin-top: 15px; color: #aaa;">
                            Temps: <span style="color: var(--primary-color); font-weight: bold;">${gameState.engineerTime} / ${gameState.maxEngineerTime}</span>
                        </div>
                        <div class="action-selector" style="margin-top: 20px;">
                            <select id="engineActionSelect" onchange="changeAction(this.value)" style="background: rgba(0, 0, 0, 0.2); border: 1px solid var(--primary-color); color: var(--text-color);">
                                <option value="engineWork" selected>⚙️ Travail Moteur (selon dev en cours)</option>
                                <option value="rdGeneration">🔬 Générer des points R&D (+10 points R&D | 10 temps)</option>
                            </select>
                        </div>
                    </div>
                    <div class="dev-tree">
                        ${Object.entries(engineParts).map(([key, part]) => {
                            const dev = gameState.engineDev[key] || { phase: 'locked', progress: 0 };
                            const isLocked = dev.phase === 'locked';
                            const isCompleted = dev.phase === 'completed';
                            return `
                                <div class="dev-item ${isLocked ? 'locked' : ''} ${isCompleted ? 'completed' : ''}" style="border: 2px solid ${isCompleted ? '#4ecca3' : isLocked ? '#555' : 'var(--primary-color)'};">
                                    <h4>${part.name} (${part.subCategory})</h4>
                                    <div class="dev-cost">💰 ${(part.cost / 1000000).toFixed(1)}M €</div>
                                    <div class="dev-cost">🔬 ${part.rd} points R&D</div>
                                    <div class="dev-cost">⏱️ ${part.time} temps</div>
                                    <div class="dev-cost">📈 +${part.perf} performance</div>
                                    ${isCompleted ?
                                        '<div style="color: #4ecca3; margin-top: 10px; font-weight: bold;">✅ Développé</div>' :
                                        isLocked ?
                                            `<button class="small-btn" onclick="startDevelopment('engine', '${key}')" style="background: var(--primary-color); border: 1px solid #fff;">Démarrer</button>` :
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
            ` : ''}
            <div class="section" style="margin-top: 20px;">
                <h3>📊 Configuration Moteur</h3>
                <div style="color: #aaa; margin-bottom: 15px;">
                    Sélectionnez les pièces à installer sur vos voitures. L'usure affecte la performance.
                </div>
                <div class="car-config">
                    <div class="driver-card">
                        <h4>🏎️ Voiture #1 - ${gameState.drivers[0].name}</h4>
                        ${getEngineConfigUI(0)}
                    </div>
                    <div class="driver-card">
                        <h4>🏎️ Voiture #2 - ${gameState.drivers[1].name}</h4>
                        ${getEngineConfigUI(1)}
                    </div>
                </div>
            </div>
        `}
    `;
}

function getEngineConfigUI(carIndex) {
    const config = carIndex === 0 ? gameState.car1Config : gameState.car2Config;
    return `
        <div class="part-selector">
            <label>ICE (Moteur thermique):</label>
            <select onchange="updateCarConfig(${carIndex}, 'ice', this.value)" style="background: rgba(0, 0, 0, 0.2); border: 1px solid var(--primary-color); color: var(--text-color);">
                <option value="">-- Sélectionner --</option>
                ${gameState.parts.engine?.filter(p => p.subCategory === 'ice').map((part, index) => `
                    <option value="${index}" ${config.ice === index ? 'selected' : ''} style="background: ${part.condition < 50 ? 'rgba(255, 0, 0, 0.1)' : 'inherit'};">
                        ${part.name} (${part.condition}% - ${part.effectivePerf || part.perf} pts)
                    </option>
                `).join('') || ''}
            </select>
        </div>
        <div class="part-selector">
            <label>MGU-K:</label>
            <select onchange="updateCarConfig(${carIndex}, 'mghk', this.value)" style="background: rgba(0, 0, 0, 0.2); border: 1px solid var(--primary-color); color: var(--text-color);">
                <option value="">-- Sélectionner --</option>
                ${gameState.parts.engine?.filter(p => p.subCategory === 'mghk').map((part, index) => `
                    <option value="${index}" ${config.mghk === index ? 'selected' : ''} style="background: ${part.condition < 50 ? 'rgba(255, 0, 0, 0.1)' : 'inherit'};">
                        ${part.name} (${part.condition}% - ${part.effectivePerf || part.perf} pts)
                    </option>
                `).join('') || ''}
            </select>
        </div>
        <div class="part-selector">
            <label>MGU-H:</label>
            <select onchange="updateCarConfig(${carIndex}, 'mghu', this.value)" style="background: rgba(0, 0, 0, 0.2); border: 1px solid var(--primary-color); color: var(--text-color);">
                <option value="">-- Sélectionner --</option>
                ${gameState.parts.engine?.filter(p => p.subCategory === 'mghu').map((part, index) => `
                    <option value="${index}" ${config.mghu === index ? 'selected' : ''} style="background: ${part.condition < 50 ? 'rgba(255, 0, 0, 0.1)' : 'inherit'};">
                        ${part.name} (${part.condition}% - ${part.effectivePerf || part.perf} pts)
                    </option>
                `).join('') || ''}
            </select>
        </div>
    `;
}
