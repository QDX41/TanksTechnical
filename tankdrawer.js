// ===== TANK DRAWER =====
// Draws a tank from JSON barrel data onto a canvas

const IFRAME_MS = 77; // ms per damage frame

const TANK_BODY_COLOR = '#85008A';
const TANK_BODY_STROKE = '#5A0060';
const BARREL_COLOR = '#302e2f';
const BARREL_STROKE = '#1f1d1f';
const PROJECTILE_ALPHA = 0.7;

// Bullet class projectile shapes
const PROJ_SHAPES = {
    basic: 'circle',
    trap: 'square',
    abyss_guardian_trap: 'square',
    engineer_trap: 'square',
    photon_trap: 'square',
    arsenal_trap: 'square',
    raider_trap: 'square',
    drone: 'triangle',
    factory_minion: 'circle',
    industry_minion: 'circle',
    synope_minion: 'triangle',
    havoc_minion: 'circle',
    manufacturer_minion: 'circle',
    splitter_minion: 'circle',
};

function toRadians(d) {
    // Detect if value is already in radians
    if (d !== 0 && d > -6.3 && d < 6.3 && !Number.isInteger(d) && Math.abs(d) < 6.3) {
        return d;
    }
    return d * Math.PI / 180;
}

function darken(hex, pct) {
    // Darken a hex color by pct (0-1)
    let r = parseInt(hex.slice(1,3),16);
    let g = parseInt(hex.slice(3,5),16);
    let b = parseInt(hex.slice(5,7),16);
    r = Math.round(r*(1-pct)); g = Math.round(g*(1-pct)); b = Math.round(b*(1-pct));
    return `rgb(${r},${g},${b})`;
}

function getSizeMultiplier(family) {
    if (family === 'Celestial') return 1.5;
    if (family === 'Primordial') return 1.1;
    return 1.0;
}

function drawTank(canvas, tankRaw, family, bulletClassesData) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const SCALE = 5; // px per game unit
    const BASE_BODY_RADIUS = 16;
    const sizeMultiplier = getSizeMultiplier(family);
    const bodyRadius = BASE_BODY_RADIUS * sizeMultiplier * SCALE;

    const cx = W / 2, cy = H / 2;

    const allBarrels = tankRaw.data?.barrels || [];

    // Sort: draw visualOnly first (back), then real barrels on top
    const sorted = [...allBarrels].sort((a, b) => {
        const aVis = a.visualOnly === 1 ? 0 : 1;
        const bVis = b.visualOnly === 1 ? 0 : 1;
        return aVis - bVis;
    });

    // Draw barrels (behind body)
    for (const b of sorted) {
        drawBarrel(ctx, b, cx, cy, SCALE, sizeMultiplier);
    }

    // Draw projectiles in front of each non-visual barrel
    for (const b of allBarrels) {
        if (b.visualOnly === 1) continue;
        drawProjectile(ctx, b, cx, cy, SCALE, sizeMultiplier, bulletClassesData);
    }

    // Draw body on top of barrels
    const bodyColor = TANK_BODY_COLOR;
    const bodyStroke = darken(bodyColor, 0.2);

    // Get body shape from bodyClasses if available — for now draw standard circle
    ctx.beginPath();
    ctx.arc(cx, cy, bodyRadius, 0, Math.PI * 2);
    ctx.fillStyle = bodyColor;
    ctx.fill();
    ctx.strokeStyle = bodyStroke;
    ctx.lineWidth = 3;
    ctx.stroke();
}

function drawBarrel(ctx, b, cx, cy, scale, sizeMul) {
    const angleRad = toRadians(b.d || 0);
    const offset = (b.offset || 0) * sizeMul * scale;
    const sideOff = (b.sideOffset || 0) * sizeMul * scale;
    const length = (b.length || 8) * sizeMul * scale;
    const widthNear = (b.width || 4) * sizeMul * scale;
    const aspect = b.aspect ?? 1;
    const widthFar = widthNear * aspect;

    // Barrel local coords: forward = +x, side = +y
    // Near edge starts at offset from center, far edge at offset+length
    const x0 = offset;
    const x1 = offset + length;

    // Four corners of trapezoid in local coords
    const corners = [
        { x: x0, y: -widthNear / 2 },
        { x: x1, y: -widthFar / 2 },
        { x: x1, y:  widthFar / 2 },
        { x: x0, y:  widthNear / 2 },
    ];

    // Rotate corners by angleRad and translate to world
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);

    // sideOffset is perpendicular to the direction
    const perpX = -sin;
    const perpY = cos;

    ctx.save();
    ctx.translate(cx + sideOff * perpX, cy + sideOff * perpY);
    ctx.rotate(angleRad);

    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);
    for (let i = 1; i < corners.length; i++) {
        ctx.lineTo(corners[i].x, corners[i].y);
    }
    ctx.closePath();

    const isVisualOnly = b.visualOnly === 1;
    ctx.fillStyle = isVisualOnly
        ? 'rgba(48,46,47,0.55)'
        : BARREL_COLOR;
    ctx.fill();
    ctx.strokeStyle = isVisualOnly
        ? 'rgba(31,29,31,0.4)'
        : BARREL_STROKE;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();
}

function drawProjectile(ctx, b, cx, cy, scale, sizeMul, bulletClassesData) {
    const angleRad = toRadians(b.d || 0);
    const offset = (b.offset || 0) * sizeMul * scale;
    const length = (b.length || 8) * sizeMul * scale;
    const sideOff = (b.sideOffset || 0) * sizeMul * scale;

    const bulletClass = b.bulletClass || 'basic';
    const bcData = bulletClassesData?.[bulletClass] || {};
    const bcSizeMul = bcData.sizeMultiplier ?? 1;

    const projRadius = (b.bulletSize || 1) * bcSizeMul * sizeMul * scale;
    const GAP = projRadius * 0.8;

    // Position: tip of barrel + gap
    const tipDist = offset + length + GAP + projRadius;

    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);
    const perpX = -sin;
    const perpY = cos;

    const px = cx + tipDist * cos + sideOff * perpX;
    const py = cy + tipDist * sin + sideOff * perpY;

    const shape = PROJ_SHAPES[bulletClass] || 'circle';
    const color = TANK_BODY_COLOR;
    const stroke = darken(color, 0.2);

    ctx.save();
    ctx.globalAlpha = PROJECTILE_ALPHA;

    if (shape === 'circle') {
        ctx.beginPath();
        ctx.arc(px, py, projRadius, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 1.5;
        ctx.stroke();
    } else if (shape === 'square') {
        const s = projRadius * 1.4;
        ctx.translate(px, py);
        ctx.rotate(Math.PI / 4);
        ctx.fillStyle = color;
        ctx.fillRect(-s, -s, s*2, s*2);
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-s, -s, s*2, s*2);
    } else if (shape === 'triangle') {
        ctx.translate(px, py);
        ctx.rotate(angleRad - Math.PI/2);
        ctx.beginPath();
        ctx.moveTo(0, -projRadius);
        ctx.lineTo( projRadius * 0.87, projRadius * 0.5);
        ctx.lineTo(-projRadius * 0.87, projRadius * 0.5);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 1.5;
        ctx.stroke();
    }

    ctx.restore();
}

// ===== STAT BOX GENERATION =====

function groupBarrels(allBarrels) {
    const visual = allBarrels.filter(b => b.visualOnly === 1);
    const real = allBarrels.filter(b => b.visualOnly !== 1);

    // Group real barrels by stats (ignoring d/direction)
    const groups = [];
    for (const b of real) {
        const key = [
            b.bulletClass,
            b.bulletSize,
            b.reload,
            b.bulletDamage,
            b.bulletHealth,
            b.bulletSpeed,
            b.bulletLifetime ?? 0,
            b.maxChildren ?? 0,
        ].join('|');

        const existing = groups.find(g => g.key === key);
        if (existing) {
            existing.count++;
            existing.directions.push(b.d || 0);
        } else {
            groups.push({
                key,
                count: 1,
                barrel: b,
                directions: [b.d || 0],
            });
        }
    }

    return { groups, visualCount: visual.length };
}

function buildStatBoxes(container, tankRaw, bulletClassesData) {
    container.innerHTML = '';

    const allBarrels = tankRaw.data?.barrels || [];
    const { groups, visualCount } = groupBarrels(allBarrels);

    if (visualCount > 0) {
        const cosmetic = document.createElement('div');
        cosmetic.className = 'cosmetic-note';
        cosmetic.textContent = `+ ${visualCount} cosmetic barrel${visualCount > 1 ? 's' : ''} (visual only)`;
        container.appendChild(cosmetic);
    }

    if (groups.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'barrel-empty';
        empty.textContent = 'No active barrels';
        container.appendChild(empty);
        return;
    }

    for (const g of groups) {
        const b = g.barrel;
        const bc = bulletClassesData?.[b.bulletClass] || {};
        const bcSizeMul = bc.sizeMultiplier ?? 1;
        const bcHitbox = bc.hitboxRadiusMul ?? 1;

        // Applied stats
        const appDmg    = (b.bulletDamage || 0) * (bc.baseBulletDamage ?? 1);
        const appHp     = (b.bulletHealth || 0) * (bc.baseBulletHealth ?? 1);
        const appSpd    = (b.bulletSpeed || 0) * (bc.baseBulletSpeed ?? 1);
        const appSize   = (b.bulletSize || 0) * bcSizeMul;
        const appLife   = (b.bulletLifetime || 0) * (bc.baseBulletLifetime ?? 1);

        // Per-second damage
        const dps = appDmg / (IFRAME_MS / 1000);

        const box = document.createElement('div');
        box.className = 'barrel-box';

        const classStr = (b.bulletClass || 'basic').replace(/_/g, ' ');
        const countBadge = g.count > 1
            ? `<span class="barrel-count-badge">×${g.count}</span>`
            : '';
        const dirsStr = g.count > 1
            ? `<span class="barrel-dirs">${g.directions.map(d => `${round2(d)}°`).join(', ')}</span>`
            : `<span class="barrel-dirs">${round2(b.d || 0)}°</span>`;

        box.innerHTML = `
            <div class="barrel-box-header">
                <span class="barrel-box-class">${classStr}</span>
                ${countBadge}
                ${dirsStr}
            </div>
            <div class="barrel-box-stats">
                <div class="bstat-section">
                    <div class="bstat-title">Raw (from JSON)</div>
                    <div class="bstat-row"><span class="bstat-label">Reload</span><span class="bstat-val">${b.reload ?? 0} <span class="bstat-unit">ms</span></span></div>
                    <div class="bstat-row"><span class="bstat-label">Damage</span><span class="bstat-val">${b.bulletDamage ?? 0} <span class="bstat-unit">dmg/iframe</span></span></div>
                    <div class="bstat-row"><span class="bstat-label">Health</span><span class="bstat-val">${b.bulletHealth ?? 0}</span></div>
                    <div class="bstat-row"><span class="bstat-label">Speed</span><span class="bstat-val">${b.bulletSpeed ?? 0} <span class="bstat-unit">qy/s</span></span></div>
                    <div class="bstat-row"><span class="bstat-label">Size</span><span class="bstat-val">${b.bulletSize ?? 0} <span class="bstat-unit">qy</span></span></div>
                    <div class="bstat-row"><span class="bstat-label">Lifetime</span><span class="bstat-val">${b.bulletLifetime ?? 0} <span class="bstat-unit">s</span></span></div>
                    ${b.maxChildren !== undefined ? `<div class="bstat-row"><span class="bstat-label">Max Children</span><span class="bstat-val">${b.maxChildren}</span></div>` : ''}
                </div>
                <div class="bstat-section">
                    <div class="bstat-title">Applied (× bullet class)</div>
                    <div class="bstat-row"><span class="bstat-label">Damage</span><span class="bstat-val applied">${round3(appDmg)} <span class="bstat-unit">dmg/iframe</span></span></div>
                    <div class="bstat-row"><span class="bstat-label">DPS</span><span class="bstat-val applied">${round3(dps)} <span class="bstat-unit">dmg/s</span></span></div>
                    <div class="bstat-row"><span class="bstat-label">Health</span><span class="bstat-val applied">${round3(appHp)}</span></div>
                    <div class="bstat-row"><span class="bstat-label">Speed</span><span class="bstat-val applied">${round3(appSpd)} <span class="bstat-unit">qy/s</span></span></div>
                    <div class="bstat-row"><span class="bstat-label">Size</span><span class="bstat-val applied">${round3(appSize)} <span class="bstat-unit">qy</span></span></div>
                    <div class="bstat-row"><span class="bstat-label">Lifetime</span><span class="bstat-val applied">${round3(appLife)} <span class="bstat-unit">s</span></span></div>
                </div>
            </div>
        `;
        container.appendChild(box);
    }

    // Iframe note
    const note = document.createElement('div');
    note.className = 'iframe-note';
    note.textContent = `1 iframe = ${IFRAME_MS} ms  ·  damage is applied once per iframe`;
    container.appendChild(note);
}

function round2(n) { return Math.round(n * 100) / 100; }
function round3(n) { return Math.round(n * 1000) / 1000; }
