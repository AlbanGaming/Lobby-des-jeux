function getEngineContent() {
    const hasEngine = gameState.engineSupplier !== null || gameState.ownEngine;
    return `
        <h2 style="color: var(--primary-color); margin-bottom: 20px;">⚙️ Recherche & Développement Moteur</h2>
        ${!hasEngine ? `
            <div class="message">
                ⚠️ Vous devez d'abord choisir un fournisseur de moteur pour commencer la saison !
            </div>
            <div class="section">
                <h3>🏭 Fournisseurs de Moteurs Disponibles</h3>
                <div class="dev-tree">
                    ${engineSuppliers.map(supplier => `
                        <div class="dev-item">
                            <h4>${supplier.name}</h4>
                            <div class="dev-cost">💰 ${(supplier.cost / 1000000).toFixed(1)}M € / an</div>
                            <div class="dev-cost">📈 ${supplier.perf} pts performance</div>
                            <button class="small-btn" onclick="selectEngineSupplier('${supplier.name}', ${supplier.cost}, ${supplier.perf})">
                                Sélectionner
                            </button>
                        </div>
                    `).join('')}
                </div>
            </div>
        ` : `
            <div class="section">
                <h3>🏭 Moteur Actuel</h3>
                <div style="padding: 20px; background: rgba(78, 204, 163, 0.1); border-radius: 8px; border: 2px solid #4ecca3;">
                    <div style="font-size: 1.2em; font-weight: bold; color: #4ecca3; margin-bottom: 10px;">
                        ${gameState.ownEngine ? '🏭 Moteur Maison' : `🏭 ${gameState.engineSupplier}`}
                    </div>
                    <div style="color: #aaa;">
                        Performance: <span style="color: var(--primary-color); font-weight: bold;">${gameState.enginePerf} pts</span>
                    </div>
                    ${!gameState.ownEngine ? `
                        <div style="color: #aaa; margin-top: 5px;">
                            Coût annuel: <span style="color: var(--primary-color); font-weight: bold;">${(gameState.engineCost / 1000000).toFixed(1)}M €</span>
                        </div>
                    ` : ''}
                </div>
                ${!gameState.ownEngine && gameState.year >= 2024 ? `
                    <div class="message" style="margin-top: 20px;">
                        💡 Après 2 ans d'activité, vous pouvez développer votre propre moteur !
                        <button class="btn" style="margin-top: 15px;" onclick="startOwnEngine()">
                            Demander l'accréditation moteur (Coût: 50M €)
                        </button>
                    </div>
                ` : ''}
            </div>
            ${gameState.ownEngine ? `
                <div class="section" style="margin-top: 20px;">
                    <h3>🔧 Développement Moteur</h3>
                    <div class="dev-tree">
                        ${Object.entries(engineParts).map(([key, part]) => {
                            const dev = gameState.engineDev[key] || { phase: 'locked', progress: 0 };
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
                                            `<button class="small-btn" onclick="startDevelopment('engine', '${key}')">Démarrer</button>` :
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
            ` : ''}
        `}
    `;
}
