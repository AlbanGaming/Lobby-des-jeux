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
                        <th>Quantité</th>
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
                <h3>🏎️ Voiture #1 - ${gameState.drivers[0].name}</h3>
                ${getCarConfigUI(0)}
            </div>
            <div class="driver-card">
                <h3>🏎️ Voiture #2 - ${gameState.drivers[1].name}</h3>
                ${getCarConfigUI(1)}
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
        <div class="dev-item">
            <h4>${item.part.name}</h4>
            <div class="dev-cost">💰 ${(item.part.cost * 0.3 / 1000000).toFixed(1)}M € (coût fab.)</div>
            <div class="dev-cost">⏱️ ${Math.round(item.part.time * 0.5)} temps</div>
            <button class="small-btn" onclick="manufacturePart('${item.type}', '${item.key}')">
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
                    <td>1</td>
                    <td>${item.condition}%</td>
                    <td>+${item.perf} pts</td>
                    <td>
                        ${item.condition < 80 ?
                            `<button class="small-btn" onclick="sellPart('${category}', ${index})">Vendre (${(item.perf * 10000).toFixed(0)} €)</button>` :
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
            <select onchange="updateCarConfig(${carIndex}, 'frontWing', this.value)">
                <option value="">-- Sélectionner --</option>
                ${gameState.parts.frontWing?.map((part, index) => `
                    <option value="${index}" ${config.frontWing === index ? 'selected' : ''}>
                        ${part.name} (${part.condition}% - +${part.perf}pts)
                    </option>
                `).join('') || ''}
            </select>
        </div>
        <div class="part-selector">
            <label>Aileron arrière:</label>
            <select onchange="updateCarConfig(${carIndex}, 'rearWing', this.value)">
                <option value="">-- Sélectionner --</option>
                ${gameState.parts.rearWing?.map((part, index) => `
                    <option value="${index}" ${config.rearWing === index ? 'selected' : ''}>
                        ${part.name} (${part.condition}% - +${part.perf}pts)
                    </option>
                `).join('') || ''}
            </select>
        </div>
        <div class="part-selector">
            <label>Fond plat:</label>
            <select onchange="updateCarConfig(${carIndex}, 'floor', this.value)">
                <option value="">-- Sélectionner --</option>
                ${gameState.parts.floor?.map((part, index) => `
                    <option value="${index}" ${config.floor === index ? 'selected' : ''}>
                        ${part.name} (${part.condition}% - +${part.perf}pts)
                    </option>
                `).join('') || ''}
            </select>
        </div>
        <div class="part-selector">
            <label>Pontons:</label>
            <select onchange="updateCarConfig(${carIndex}, 'sidepods', this.value)">
                <option value="">-- Sélectionner --</option>
                ${gameState.parts.sidepods?.map((part, index) => `
                    <option value="${index}" ${config.sidepods === index ? 'selected' : ''}>
                        ${part.name} (${part.condition}% - +${part.perf}pts)
                    </option>
                `).join('') || ''}
            </select>
        </div>
        <div class="part-selector">
            <label>Châssis:</label>
            <select onchange="updateCarConfig(${carIndex}, 'chassis', this.value)">
                <option value="">-- Sélectionner --</option>
                ${gameState.parts.chassis?.map((part, index) => `
                    <option value="${index}" ${config.chassis === index ? 'selected' : ''}>
                        ${part.name} (${part.condition}% - +${part.perf}pts)
                    </option>
                `).join('') || ''}
            </select>
        </div>
        <div class="part-selector">
            <label>Suspension:</label>
            <select onchange="updateCarConfig(${carIndex}, 'suspension', this.value)">
                <option value="">-- Sélectionner --</option>
                ${gameState.parts.suspension?.map((part, index) => `
                    <option value="${index}" ${config.suspension === index ? 'selected' : ''}>
                        ${part.name} (${part.condition}% - +${part.perf}pts)
                    </option>
                `).join('') || ''}
            </select>
        </div>
        <div class="part-selector">
            <label>Moteur:</label>
            <select onchange="updateCarConfig(${carIndex}, 'engine', this.value)">
                <option value="">-- Sélectionner --</option>
                ${gameState.parts.engine?.map((part, index) => `
                    <option value="${index}" ${config.engine === index ? 'selected' : ''}>
                        ${part.name} (${part.condition}% - +${part.perf}pts)
                    </option>
                `).join('') || ''}
            </select>
        </div>
        <div class="part-selector">
            <label>Électronique:</label>
            <select onchange="updateCarConfig(${carIndex}, 'electronics', this.value)">
                <option value="">-- Sélectionner --</option>
                ${gameState.parts.electronics?.map((part, index) => `
                    <option value="${index}" ${config.electronics === index ? 'selected' : ''}>
                        ${part.name} (${part.condition}% - +${part.perf}pts)
                    </option>
                `).join('') || ''}
            </select>
        </div>
        <div class="part-selector">
            <label>Freins:</label>
            <select onchange="updateCarConfig(${carIndex}, 'brakes', this.value)">
                <option value="">-- Sélectionner --</option>
                ${gameState.parts.brakes?.map((part, index) => `
                    <option value="${index}" ${config.brakes === index ? 'selected' : ''}>
                        ${part.name} (${part.condition}% - +${part.perf}pts)
                    </option>
                `).join('') || ''}
            </select>
        </div>
    `;
}
