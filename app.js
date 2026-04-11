// ===== TANKS TECHNICAL - Main App =====

const DATA_URL = 'https://neoxe.io/menu-data.json';
const CORS_PROXY = 'https://corsproxy.io/?';

let tankData = [];        // processed tanks
let bulletClasses = {};   // bullet class reference
let bodyClasses = {};     // body class reference
let sortCol = 'name';
let sortAsc = true;
let activeFilters = { family: 'all', tier: 'all', weaponType: 'all' };
let currentPage = 'home';

// ===== DATA LOADING =====

async function loadData() {
    setLoadingText('Connecting to neoxe.io...');
    let json = null;

    // Try direct fetch first
    try {
        const res = await fetch(DATA_URL);
        if (res.ok) json = await res.json();
    } catch (e) {
        // Try CORS proxy
        try {
            setLoadingText('Using proxy...');
            const res = await fetch(CORS_PROXY + encodeURIComponent(DATA_URL));
            if (res.ok) json = await res.json();
        } catch (e2) {
            json = null;
        }
    }

    if (!json) {
        showManualInput();
        return;
    }

    processData(json);
}

function processData(json) {
    setLoadingText('Processing tanks...');

    bulletClasses = json.bulletClasses || {};
    bodyClasses = json.bodyClasses || {};
    const wc = json.weaponClasses || {};

    tankData = [];

    const internalNames = new Set([
        'op industry', 'op riot', 'op arsenal',
    ]);
    const internalKeywords = ['minion gun', 'minion guns'];

    for (const [key, tank] of Object.entries(wc)) {
        let name = tank.name || key;
        if (key === 'abyssling') name = 'Abyssling';

        const lname = name.toLowerCase();
        if (internalNames.has(lname)) continue;
        if (internalKeywords.some(k => lname.includes(k))) continue;

        const barrels = extractBarrels(tank.data?.barrels || []);
        const family = inferFamily(key, name);
        const tier = inferTier(key, name);

        tankData.push({ key, name, family, tier, barrels, raw: tank });
    }

    // Sort by family then name
    tankData.sort((a, b) => {
        if (a.family !== b.family) return a.family.localeCompare(b.family);
        return a.name.localeCompare(b.name);
    });

    setLoadingText('Building interface...');
    setTimeout(() => {
        hideLoading();
        updateStats();
        renderTankTable();
        renderReferenceSection();
        updateHomeStatus(true);
    }, 200);
}

function extractBarrels(rawBarrels) {
    const droneClasses = new Set(['drone', 'engineer_trap', 'arsenal_trap', 'raider_trap', 'photon_trap',
        'factory_minion', 'industry_minion', 'synope_minion', 'havoc_minion', 'manufacturer_minion', 'splitter_minion']);

    return rawBarrels.filter(b => {
        if (b.visualOnly === 1) return false;
        const mc = b.maxChildren;
        if (mc === 0 && droneClasses.has(b.bulletClass)) return false;
        return true;
    }).map(b => ({
        weaponClass: (b.bulletClass || '').replace(/_/g, ' '),
        bulletClass: b.bulletClass || '',
        size: b.bulletSize ?? 0,
        rotation: b.d ?? 0,
        reload: b.reload ?? 0,
        damage: b.bulletDamage ?? 0,
        health: b.bulletHealth ?? 0,
        speed: b.bulletSpeed ?? 0,
        maxChildren: b.maxChildren,
    }));
}

function inferFamily(key, name) {
    const celestialKeys = ['celestial','exosphere','meteor','sirius','heliosphere','ionosphere',
        'nebula','galaxy','oberon','pollux','corvus','naos','cygnus','triton','constellation',
        'hyperion','eclipse','chasm','comet','void','singularity','prime_celestial'];
    const primordialKeys = ['primordial','oven','halo','pounder','titan','chainsaw','shredder'];
    const bossKeys = ['abyssling','base_defender','abyss_guardian','prime_celestial'];

    if (bossKeys.includes(key)) return 'Boss';
    if (celestialKeys.includes(key)) return 'Celestial';
    if (primordialKeys.includes(key)) return 'Primordial';
    return 'Regular';
}

function inferTier(key, name) {
    // Tier is hard to infer from JSON alone — default based on family
    // Users fill this in on the spreadsheet; here we show it as a placeholder
    return '—';
}

// ===== RENDERING =====

function renderTankTable() {
    const tbody = document.getElementById('tank-tbody');
    if (!tbody) return;

    const filtered = getFilteredTanks();
    document.getElementById('tank-count').textContent = filtered.length;

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--white-dim)">No tanks match the current filters</td></tr>`;
        return;
    }

    tbody.innerHTML = '';

    for (const tank of filtered) {
        const hasBarrels = tank.barrels.length > 0;

        // Main row
        const tr = document.createElement('tr');
        tr.className = 'tank-header-row';
        tr.dataset.key = tank.key;

        const tierHtml = tank.tier !== '—'
            ? `<span class="tier-badge tier-${tank.tier}">T${tank.tier}</span>`
            : `<span class="tier-badge tier-0">—</span>`;

        const firstBarrel = tank.barrels[0];

        tr.innerHTML = `
            <td>
                <div class="tank-name">
                    ${hasBarrels ? '<span class="expand-arrow">▶</span>' : '<span class="expand-arrow" style="opacity:0.2">▶</span>'}
                    ${tank.name}
                    ${tank.barrels.length > 1 ? `<span class="badge-count">${tank.barrels.length}</span>` : ''}
                </div>
            </td>
            <td><span class="family-badge">${tank.family}</span></td>
            <td>${tierHtml}</td>
            <td class="mono">${firstBarrel ? `<span class="barrel-class">${firstBarrel.weaponClass}</span>` : '<span style="color:var(--white-faint)">—</span>'}</td>
            <td class="mono">${firstBarrel ? round(firstBarrel.reload) : '—'}</td>
            <td class="mono">${firstBarrel ? round(firstBarrel.damage) : '—'}</td>
            <td class="mono">${firstBarrel ? round(firstBarrel.health) : '—'}</td>
        `;

        tbody.appendChild(tr);

        // Barrel expand rows (tbody group)
        if (hasBarrels) {
            const tbodyGroup = document.createElement('tbody');
            tbodyGroup.className = 'barrel-rows';
            tbodyGroup.id = `barrels-${tank.key}`;

            for (let i = 0; i < tank.barrels.length; i++) {
                const b = tank.barrels[i];
                const btr = document.createElement('tr');
                btr.className = 'barrel-row';
                btr.innerHTML = `
                    <td style="padding-left:${i === 0 ? 36 : 48}px">
                        <span class="barrel-class">${b.weaponClass}</span>
                    </td>
                    <td></td>
                    <td class="mono" style="color:var(--white-faint);font-size:11px">rot: ${round(b.rotation)}°</td>
                    <td class="mono">${round(b.size)}</td>
                    <td class="mono">${round(b.reload)}</td>
                    <td class="mono">${round(b.damage)}</td>
                    <td class="mono">${round(b.health)}</td>
                `;
                tbodyGroup.appendChild(btr);
            }

            tbody.parentElement.insertBefore(tbodyGroup, tbody.nextSibling);
            tbody.parentElement.appendChild(tbody); // keep main tbody last for proper DOM

            tr.addEventListener('click', () => {
                const expanded = tr.classList.toggle('expanded');
                tbodyGroup.classList.toggle('visible', expanded);
            });
        }
    }
}

function getFilteredTanks() {
    let tanks = [...tankData];
    const f = activeFilters;

    if (f.family !== 'all') tanks = tanks.filter(t => t.family === f.family);
    if (f.tier !== 'all') tanks = tanks.filter(t => String(t.tier) === f.tier);
    if (f.weaponType !== 'all') {
        tanks = tanks.filter(t => t.barrels.some(b => {
            const bc = b.bulletClass;
            if (f.weaponType === 'bullet') return bc === 'basic';
            if (f.weaponType === 'drone') return bc === 'drone';
            if (f.weaponType === 'trap') return bc.includes('trap');
            if (f.weaponType === 'minion') return bc.includes('minion');
            return true;
        }));
    }

    // Search filter
    const q = document.getElementById('search-input')?.value?.toLowerCase() || '';
    if (q.length > 1) {
        tanks = tanks.filter(t =>
            t.name.toLowerCase().includes(q) ||
            t.barrels.some(b => b.weaponClass.includes(q))
        );
    }

    // Sort
    tanks.sort((a, b) => {
        let va = a[sortCol], vb = b[sortCol];
        if (sortCol === 'barrels') { va = a.barrels.length; vb = b.barrels.length; }
        if (typeof va === 'string') return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
        return sortAsc ? va - vb : vb - va;
    });

    return tanks;
}

function renderReferenceSection() {
    const bcContainer = document.getElementById('bullet-class-table');
    const bodyContainer = document.getElementById('body-class-table');
    if (!bcContainer || !bodyContainer) return;

    // Bullet classes
    const bcRows = Object.entries(bulletClasses).map(([key, bc]) => `
        <tr>
            <td><span class="barrel-class">${key.replace(/_/g, ' ')}</span></td>
            <td class="mono">${round(bc.baseBulletDamage ?? 0)}</td>
            <td class="mono">${round(bc.baseBulletHealth ?? 0)}</td>
            <td class="mono">${round(bc.baseBulletSpeed ?? 0)}</td>
            <td class="mono">${round(bc.baseBulletLifetime ?? 0)}s</td>
            <td class="mono">${round(bc.hitboxRadiusMul ?? 1)}x</td>
        </tr>
    `).join('');

    bcContainer.innerHTML = `
        <table>
            <thead><tr>
                <th>Class</th><th>Base DMG</th><th>Base HP</th>
                <th>Base SPD</th><th>Lifetime</th><th>Hitbox</th>
            </tr></thead>
            <tbody>${bcRows}</tbody>
        </table>
    `;

    // Body classes - filter to relevant playable ones
    const skipBodies = new Set(['spectator','base_defender','abyss_guardian','prime_celestial',
        'drone_minion','factory_minion_body','splitter_minion_body','synope_minion_body',
        'havoc_minion_body','engineer_trap_body','photon_trap_body','raider_trap_body',
        'arsenal_trap_body','manufacturer_minion_body']);

    const bodyRows = Object.entries(bodyClasses)
        .filter(([key]) => !skipBodies.has(key) && !key.startsWith('shape_') && !key.startsWith('infected_') && key !== 'fragmented_wall')
        .map(([key, bc]) => `
            <tr>
                <td style="font-weight:600">${bc.name || key}</td>
                <td class="mono">${round(bc.maxHealthMultiplier ?? 1)}x</td>
                <td class="mono">${round(bc.bodyDamageMultiplier ?? 1)}x</td>
                <td class="mono">${round(bc.movementSpeedMultiplier ?? 1)}x</td>
                <td class="mono">${round(bc.hitboxRadiusMul ?? 1)}x</td>
            </tr>
        `).join('');

    bodyContainer.innerHTML = `
        <table>
            <thead><tr>
                <th>Body</th><th>Max HP ×</th><th>Body DMG ×</th>
                <th>Move SPD ×</th><th>Hitbox ×</th>
            </tr></thead>
            <tbody>${bodyRows}</tbody>
        </table>
    `;
}

function updateStats() {
    const regularCount = tankData.filter(t => t.family === 'Regular').length;
    const celestialCount = tankData.filter(t => t.family === 'Celestial').length;
    const primordialCount = tankData.filter(t => t.family === 'Primordial').length;
    const bossCount = tankData.filter(t => t.family === 'Boss').length;
    const totalBarrels = tankData.reduce((s, t) => s + t.barrels.length, 0);

    setEl('stat-total', tankData.length);
    setEl('stat-regular', regularCount);
    setEl('stat-celestial', celestialCount);
    setEl('stat-primordial', primordialCount);
    setEl('stat-bosses', bossCount);
    setEl('stat-barrels', totalBarrels);
}

// ===== SCORE TRACKER =====

function initTracker() {
    const inputs = ['cur-score','cur-time','past-score','past-time','score-goal','time-goal-h'];
    inputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', calcTracker);
    });
}

function parseScore(val) {
    if (!val || val.trim() === '') return null;
    val = val.trim().toLowerCase();
    if (!isNaN(val)) return parseFloat(val);
    const num = parseFloat(val.replace(',', '.').replace(/[bB]$/, ''));
    if (!isNaN(num) && val.endsWith('b')) return num;
    return null;
}

function parseTime(val) {
    // returns Date or null
    if (!val) return null;
    // try as datetime-local value
    const d = new Date(val);
    if (!isNaN(d)) return d;
    return null;
}

function parseHours(val) {
    if (!val || val.trim() === '') return null;
    val = val.trim().toLowerCase();
    if (!isNaN(val)) return parseFloat(val);
    const minMatch = val.match(/^([\d.]+)\s*min/);
    if (minMatch) return parseFloat(minMatch[1]) / 60;
    const hMatch = val.match(/^([\d.]+)\s*h/);
    if (hMatch) return parseFloat(hMatch[1]);
    return null;
}

function calcTracker() {
    const curScore   = parseScore(document.getElementById('cur-score')?.value);
    const curTime    = parseTime(document.getElementById('cur-time')?.value);
    const pastScore  = parseScore(document.getElementById('past-score')?.value);
    const pastTime   = parseTime(document.getElementById('past-time')?.value);
    const scoreGoal  = parseScore(document.getElementById('score-goal')?.value);
    const timeGoalH  = parseHours(document.getElementById('time-goal-h')?.value);

    // Elapsed hours
    let elaHours = null;
    if (curTime && pastTime) {
        elaHours = (curTime - pastTime) / 3600000;
        setResult('res-elapsed', elaHours !== null ? `${round(elaHours, 2)} h` : '—');
    } else {
        setResult('res-elapsed', '—');
    }

    // Score rate
    let rate = null;
    if (curScore !== null && pastScore !== null && elaHours !== null && elaHours > 0) {
        rate = (curScore - pastScore) / elaHours;
        setResult('res-rate', `${round(rate, 2)} b/h`);
    } else {
        setResult('res-rate', '—');
    }

    // Estimated playtime (cur / rate)
    if (curScore !== null && rate !== null && rate > 0) {
        const estH = curScore / rate;
        setResult('res-playtime', `${round(estH, 1)} h`);
    } else {
        setResult('res-playtime', '—');
    }

    // Score goal calcs
    if (scoreGoal !== null && curScore !== null && rate !== null) {
        if (curScore >= scoreGoal) {
            setResult('res-goal-time', 'Already achieved!', 'good');
        } else if (rate > 0) {
            const hoursNeeded = (scoreGoal - curScore) / rate;
            setResult('res-goal-time', `${round(hoursNeeded, 1)} h from now`);
        } else {
            setResult('res-goal-time', '—');
        }
    } else {
        setResult('res-goal-time', '—');
    }

    // Score at time goal
    if (timeGoalH !== null && curScore !== null && rate !== null) {
        const projected = curScore + timeGoalH * rate;
        setResult('res-at-time', `${round(projected, 2)} b`);
    } else {
        setResult('res-at-time', '—');
    }
}

// ===== NAVIGATION =====

function navigate(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    const pageEl = document.getElementById(`page-${page}`);
    const navEl = document.querySelector(`.nav-item[data-page="${page}"]`);

    if (pageEl) pageEl.classList.add('active');
    if (navEl) navEl.classList.add('active');

    currentPage = page;
}

// ===== SEARCH =====

function initSearch() {
    const input = document.getElementById('search-input');
    const results = document.getElementById('search-results');
    if (!input || !results) return;

    input.addEventListener('input', () => {
        const q = input.value.toLowerCase().trim();
        if (q.length < 2) {
            results.classList.remove('visible');
            if (currentPage === 'tanks') renderTankTable();
            return;
        }

        // Show results dropdown
        const matches = tankData.filter(t =>
            t.name.toLowerCase().includes(q) ||
            t.barrels.some(b => b.weaponClass.includes(q))
        ).slice(0, 8);

        if (matches.length === 0) {
            results.innerHTML = '<div class="search-result-item"><span style="color:var(--white-dim)">No results</span></div>';
        } else {
            results.innerHTML = matches.map(t => `
                <div class="search-result-item" onclick="goToTank('${t.key}')">
                    <div>
                        <div class="res-name">${t.name}</div>
                        <div class="res-meta">${t.barrels.length} barrel${t.barrels.length !== 1 ? 's' : ''}</div>
                    </div>
                    <span class="search-tag tag-${t.family.toLowerCase()}">${t.family}</span>
                </div>
            `).join('');
        }

        results.classList.add('visible');

        // Also filter tank table if on tanks page
        if (currentPage === 'tanks') renderTankTable();
    });

    document.addEventListener('click', e => {
        if (!results.contains(e.target) && e.target !== input) {
            results.classList.remove('visible');
        }
    });
}

function goToTank(key) {
    navigate('tanks');
    document.getElementById('search-results').classList.remove('visible');
    // Expand the tank row
    setTimeout(() => {
        const row = document.querySelector(`.tank-header-row[data-key="${key}"]`);
        if (row) {
            row.scrollIntoView({ behavior: 'smooth', block: 'center' });
            row.click();
            row.style.boxShadow = '0 0 0 2px var(--purple)';
            setTimeout(() => row.style.boxShadow = '', 2000);
        }
    }, 100);
}

// ===== FILTERS =====

function initFilters() {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const group = btn.dataset.group;
            const val = btn.dataset.val;

            document.querySelectorAll(`.filter-btn[data-group="${group}"]`).forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            activeFilters[group] = val;
            renderTankTable();
        });
    });
}

// ===== SORTING =====

function initSorting() {
    document.querySelectorAll('th[data-sort]').forEach(th => {
        th.addEventListener('click', () => {
            const col = th.dataset.sort;
            if (sortCol === col) {
                sortAsc = !sortAsc;
                th.classList.toggle('asc', sortAsc);
            } else {
                document.querySelectorAll('th[data-sort]').forEach(t => t.classList.remove('sorted', 'asc'));
                sortCol = col;
                sortAsc = true;
            }
            th.classList.add('sorted');
            renderTankTable();
        });
    });
}

// ===== LOADING / UI HELPERS =====

function setLoadingText(text) {
    const el = document.getElementById('loading-text');
    if (el) el.textContent = text;
}

function hideLoading() {
    const el = document.getElementById('loading-overlay');
    if (el) {
        el.classList.add('hidden');
        setTimeout(() => el.style.display = 'none', 500);
    }
}

function updateHomeStatus(ok) {
    const dot = document.getElementById('status-dot');
    const text = document.getElementById('status-text');
    if (dot && text) {
        if (ok) {
            dot.style.background = '#44cc88';
            dot.style.boxShadow = '0 0 8px #44cc8888';
            text.textContent = `Live data · ${tankData.length} weapon classes loaded`;
        } else {
            dot.style.background = '#cc4444';
            dot.style.boxShadow = '0 0 8px #cc444488';
            text.textContent = 'Could not load live data';
        }
    }
}

function showManualInput() {
    const el = document.getElementById('loading-overlay');
    if (el) {
        el.innerHTML = `
            <div style="text-align:center;max-width:480px;padding:20px">
                <div class="loading-logo" style="margin-bottom:20px">TT</div>
                <p style="color:var(--white-dim);margin-bottom:16px;line-height:1.6">
                    Could not reach neoxe.io directly.<br>
                    Paste the contents of <code style="color:var(--purple-bright)">neoxe.io/menu-data.json</code> below.
                </p>
                <textarea id="manual-json" style="width:100%;height:120px;background:var(--surface);border:1px solid var(--border);border-radius:6px;color:var(--white);font-family:var(--font-mono);font-size:12px;padding:10px;resize:none;outline:none" placeholder="Paste JSON here..."></textarea>
                <button onclick="loadManual()" style="margin-top:12px;background:var(--purple);border:none;color:white;padding:10px 24px;border-radius:6px;font-family:var(--font-ui);font-size:14px;font-weight:600;cursor:pointer;letter-spacing:0.05em">Load Data</button>
            </div>
        `;
    }
}

function loadManual() {
    const val = document.getElementById('manual-json')?.value;
    if (!val) return;
    try {
        const json = JSON.parse(val);
        processData(json);
    } catch (e) {
        alert('Invalid JSON — make sure you copied the full contents of the file.');
    }
}

function setEl(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}

function setResult(id, val, cls = '') {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = val;
    el.className = 'result-value' + (cls ? ` ${cls}` : '');
}

function round(n, decimals = 3) {
    if (n === null || n === undefined || isNaN(n)) return '—';
    return +parseFloat(n).toFixed(decimals);
}

// ===== INIT =====

document.addEventListener('DOMContentLoaded', () => {
    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => navigate(item.dataset.page));
    });

    document.querySelectorAll('.home-card').forEach(card => {
        card.addEventListener('click', () => navigate(card.dataset.page));
    });

    initSearch();
    initFilters();
    initSorting();
    initTracker();

    loadData();
});
