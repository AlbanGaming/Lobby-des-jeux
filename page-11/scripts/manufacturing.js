function getManufacturingContent() {
    return `
        <h2 style="color: var(--primary-color); margin-bottom: 20px;">🏭 Fabrication & Configuration des Voitures</h2>
        <div class="section">
            <h3>🔨 Pièces Développées (Prêtes à fabriquer)</h3>
            <div style="color: #aaa; margin: 15px 0;">
                Les pièces développées doivent être fabriquées avant de pouvoir être montées sur les voitures.
            </div>
            <div class="dev-tree">
                ${getReadyToManufacture()}
            </div>
        </div>
        <div class="section" style="margin-top: 20px;">
            <h3>📦 Stock de Pièces Fabriquées</h3>
            <table>
                <thead>
                    <tr>
                        <th>Pièce</th>
                        <th>Catégorie</th>
                        <th>État</th>
                        <th>Performance</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${getInventoryTable()}
                </tbody>
            </table>
        </div>
        <div class="car-config" style="margin-top: 20px;">
            <div class="driver-card">
                <h3>🏎️ Voiture #1 - ${gameState.drivers[0].name} (Compétence: ${gameState.drivers[0].skill})</h3>
                ${getCarConfigUI(0)}
            </div>
            <div class="driver-card">
                <h3>🏎️ Voiture #2 - ${gameState.drivers[1].name} (Compétence: ${gameState.drivers[1].skill})</h3>
                ${getCarConfigUI(1)}
            </div>
        </div>
        <div class="section" style="margin-top: 20px;">
            <h3>📊 Performance Totale des Voitures</h3>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 15px;">
                <div style="background: rgba(0, 0, 0, 0.2); padding: 15px; border-radius: 8px;">
                    <h4>Voiture #1</h4>
                    <div style="margin-top: 10px; font-size: 1.2em; color: var(--primary-color); font-weight: bold;">
                        ${calculateCarPerformance(0)} pts
                    </div>
                </div>
                <div style="background: rgba(0, 0, 0, 0.2); padding: 15px; border-radius: 8px;">
                    <h4>Voiture #2</h4>
                    <div style="margin-top: 10px; font-size: 1.2em; color: var(--primary-color); font-weight: bold;">
                        ${calculateCarPerformance(1)} pts
                    </div>
                </div>
            </div>
        </div>
    `;
}

function getReadyToManufacture() {
    const ready = [];
    Object.entries(gameState.aeroDev).forEach(([key, dev]) => {
        if (dev.phase === 'completed' && !dev.manufactured) {
            ready.push({ type: 'aero', key: key, part: aeroParts[key] });
        }
    });
    Object.entries(gameState.chassisDev).forEach(([key, dev]) => {
        if (dev.phase === 'completed' && !dev.manufactured) {
            ready.push({ type: 'chassis', key: key, part: chassisParts[key] });
        }
    });
    Object.entries(gameState.engineDev).forEach(([key, dev]) => {
        if (dev.phase === 'completed' && !dev.manufactured) {
            ready.push({ type: 'engine', key: key, part: engineParts[key] });
        }
    });
    Object.entries(gameState.electronicsDev).forEach(([key, dev]) => {
        if (dev.phase === 'completed' && !dev.manufactured) {
            ready.push({ type: 'electronics', key: key, part: electronicsParts[key] });
        }
    });
    Object.entries(gameState.brakesDev).forEach(([key, dev]) => {
        if (dev.phase === 'completed' && !dev.manufactured) {
            ready.push({ type: 'brakes', key: key, part: brakesParts[key] });
        }
    });

    if (ready.length === 0) {
        return '<div style="color: #aaa; padding: 20px; text-align: center;">Aucune pièce prête à fabriquer</div>';
    }

    return ready.map(item => `
        <div class="dev-item" style="border: 2px solid var(--primary-color);">
            <h4>${item.part.name}</h4>
            <div class="dev-cost">💰 ${(item.part.cost * 0.3 / 1000000).toFixed(1)}M € (coût fab.)</div>
            <div class="dev-cost">⏱️ ${Math.round(item.part.time * 0.5)} temps</div>
            <button class="small-btn" onclick="manufacturePart('${item.type}', '${item.key}')" style="background: var(--primary-color); border: 1px solid #fff;">
                Fabriquer
            </button>
        </div>
    `).join('');
}

function getInventoryTable() {
    let html = '';
    let hasItems = false;

    Object.entries(gameState.parts).forEach(([category, items]) => {
        items.forEach((item, index) => {
            hasItems = true;
            html += `
                <tr>
                    <td>${item.name}</td>
                    <td>${category}</td>
                    <td style="color: ${item.condition < 30 ? '#ff4444' : item.condition < 70 ? '#ffbb33' : '#4ecca3'}; font-weight: bold;">
                        ${item.condition}%
                    </td>
                    <td>${item.effectivePerf || item.perf} pts</td>
                    <td>
                        ${item.condition < 80 ?
                            `<button class="small-btn" onclick="sellPart('${category}', ${index})" style="background: #ff4444; border: 1px solid #fff;">Vendre (${(item.perf * 10000 / 1000000).toFixed(2)}M €)</button>` :
                            '-'
                        }
                    </td>
                </tr>
            `;
        });
    });

    if (!hasItems) {
        return '<tr><td colspan="5" style="text-align: center; color: #aaa;">Aucune pièce en stock</td></tr>';
    }

    return html;
}

function getCarConfigUI(carIndex) {
    const config = carIndex === 0 ? gameState.car1Config : gameState.car2Config;
    return `
        <div class="part-selector">
            <label>Aileron avant:</label>
            <select onchange="updateCarConfig(${carIndex}, 'frontWing', this.value)" style="background: rgba(0, 0, 0, 0.2); border: 1px solid var(--primary-color); color: var(--text-color);">
                <option value="">-- Sélectionner --</option>
                ${gameState.parts.frontWing?.map((part, index) => `
                    <option value="${index}" ${config.frontWing === index ? 'selected' : ''} style="background: ${part.condition < 50 ? 'rgba(255, 0, 0, 0.1)' : 'inherit'};">
                        ${part.name} (${part.condition}% - ${part.effectivePerf || part.perf} pts)
                    </option>
                `).join('') || ''}
            </select>
        </div>
        <div class="part-selector">
            <label>Aileron arrière:</label>
            <select onchange="updateCarConfig(${carIndex}, 'rearWing', this.value)" style="background: rgba(0, 0, 0, 0.2); border: 1px solid var(--primary-color); color: var(--text-color);">
                <option value="">-- Sélectionner --</option>
                ${gameState.parts.rearWing?.map((part, index) => `
                    <option value="${index}" ${config.rearWing === index ? 'selected' : ''} style="background: ${part.condition < 50 ? 'rgba(255, 0, 0, 0.1)' : 'inherit'};">
                        ${part.name} (${part.condition}% - ${part.effectivePerf || part.perf} pts)
                    </option>
                `).join('') || ''}
            </select>
        </div>
        <div class="part-selector">
            <label>Fond plat:</label>
            <select onchange="updateCarConfig(${carIndex}, 'floor', this.value)" style="background: rgba(0, 0, 0, 0.2); border: 1px solid var(--primary-color); color: var(--text-color);">
                <option value="">-- Sélectionner --</option>
                ${gameState.parts.floor?.map((part, index) => `
                    <option value="${index}" ${config.floor === index ? 'selected' : ''} style="background: ${part.condition < 50 ? 'rgba(255, 0, 0, 0.1)' : 'inherit'};">
                        ${part.name} (${part.condition}% - ${part.effectivePerf || part.perf} pts)
                    </option>
                `).join('') || ''}
            </select>
        </div>
        <div class="part-selector">
            <label>Pontons:</label>
            <select onchange="updateCarConfig(${carIndex}, 'sidepods', this.value)" style="background: rgba(0, 0, 0, 0.2); border: 1px solid var(--primary-color); color: var(--text-color);">
                <option value="">-- Sélectionner --</option>
                ${gameState.parts.sidepods?.map((part, index) => `
                    <option value="${index}" ${config.sidepods === index ? 'selected' : ''} style="background: ${part.condition < 50 ? 'rgba(255, 0, 0, 0.1)' : 'inherit'};">
                        ${part.name} (${part.condition}% - ${part.effectivePerf || part.perf} pts)
                    </option>
                `).join('') || ''}
            </select>
        </div>
        <div class="part-selector">
            <label>Châssis:</label>
            <select onchange="updateCarConfig(${carIndex}, 'chassis', this.value)" style="background: rgba(0, 0, 0, 0.2); border: 1px solid var(--primary-color); color: var(--text-color);">
                <option value="">-- Sélectionner --</option>
                ${gameState.parts.chassis?.map((part, index) => `
                    <option value="${index}" ${config.chassis === index ? 'selected' : ''} style="background: ${part.condition < 50 ? 'rgba(255, 0, 0, 0.1)' : 'inherit'};">
                        ${part.name} (${part.condition}% - ${part.effectivePerf || part.perf} pts)
                    </option>
                `).join('') || ''}
            </select>
        </div>
        <div class="part-selector">
            <label>Suspension:</label>
            <select onchange="updateCarConfig(${carIndex}, 'suspension', this.value)" style="background: rgba(0, 0, 0, 0.2); border: 1px solid var(--primary-color); color: var(--text-color);">
                <option value="">-- Sélectionner --</option>
                ${gameState.parts.suspension?.map((part, index) => `
                    <option value="${index}" ${config.suspension === index ? 'selected' : ''} style="background: ${part.condition < 50 ? 'rgba(255, 0, 0, 0.1)' : 'inherit'};">
                        ${part.name} (${part.condition}% - ${part.effectivePerf || part.perf} pts)
                    </option>
                `).join('') || ''}
            </select>
        </div>
        <div class="part-selector">
            <label>Électronique:</label>
            <select onchange="updateCarConfig(${carIndex}, 'electronics', this.value)" style="background: rgba(0, 0, 0, 0.2); border: 1px solid var(--primary-color); color: var(--text-color);">
                <option value="">-- Sélectionner --</option>
                ${gameState.parts.electronics?.map((part, index) => `
                    <option value="${index}" ${config.electronics === index ? 'selected' : ''} style="background: ${part.condition < 50 ? 'rgba(255, 0, 0, 0.1)' : 'inherit'};">
                        ${part.name} (${part.condition}% - ${part.effectivePerf || part.perf} pts)
                    </option>
                `).join('') || ''}
            </select>
        </div>
        <div class="part-selector">
            <label>Freins:</label>
            <select onchange="updateCarConfig(${carIndex}, 'brakes', this.value)" style="background: rgba(0, 0, 0, 0.2); border: 1px solid var(--primary-color); color: var(--text-color);">
                <option value="">-- Sélectionner --</option>
                ${gameState.parts.brakes?.map((part, index) => `
                    <option value="${index}" ${config.brakes === index ? 'selected' : ''} style="background: ${part.condition < 50 ? 'rgba(255, 0, 0, 0.1)' : 'inherit'};">
                        ${part.name} (${part.condition}% - ${part.effectivePerf || part.perf} pts)
                    </option>
                `).join('') || ''}
            </select>
        </div>
    `;
}
