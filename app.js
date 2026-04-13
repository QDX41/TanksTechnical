// ===== TANKS TECHNICAL - App =====

const DATA_URL = 'https://neoxe.io/menu-data.json';
const CORS_PROXY = 'https://corsproxy.io/?';
const IFRAME_MS = 77;

let tanks = [];
let bulletClasses = {};
let bodyClasses = {};
let sortCol = 'name';
let sortAsc = true;
let filters = { family: 'all', wtype: 'all' };
let searchQ = '';

// ===== LOADING =====

async function loadData() {
    setProgress(10); setLtxt('Connecting to neoxe.io...');
    let json = null;

    try {
        const res = await fetch(DATA_URL);
        if (res.ok) json = await res.json();
    } catch (_) {}

    if (!json) {
        try {
            setLtxt('Trying proxy...');
            const res = await fetch(CORS_PROXY + encodeURIComponent(DATA_URL));
            if (res.ok) json = await res.json();
        } catch (_) {}
    }

    if (!json) { showManual(); return; }

    setProgress(60); setLtxt('Processing tanks...');
    await sleep(80);
    processData(json);
}

function processData(json) {
    bulletClasses = json.bulletClasses || {};
    bodyClasses   = json.bodyClasses || {};
    const wc = json.weaponClasses || {};

    const skipNames = new Set(['op industry','op riot','op arsenal']);
    const skipKw = ['minion gun','minion guns'];

    tanks = [];

    for (const [key, tank] of Object.entries(wc)) {
        let name = tank.name || key;
        if (key === 'abyssling') name = 'Abyssling';

        const ln = name.toLowerCase();
        if (skipNames.has(ln)) continue;
        if (skipKw.some(k => ln.includes(k))) continue;

        tanks.push({
            key, name,
            family: inferFamily(key),
            tier: '—',
            raw: tank,
        });
    }

    tanks.sort((a,b) => a.family.localeCompare(b.family) || a.name.localeCompare(b.name));

    setProgress(100); setLtxt('Done!');
    setTimeout(() => {
        hideLoading();
        renderStats();
        renderWeapons();
        renderBodies();
        renderBullets();
        setStatus(true, `Live data · ${tanks.length} weapon classes loaded`);
    }, 250);
}

function inferFamily(key) {
    const cel = ['celestial','exosphere','meteor','sirius','heliosphere','ionosphere',
        'nebula','galaxy','oberon','pollux','corvus','naos','cygnus','triton',
        'constellation','hyperion','eclipse','chasm','comet','void','singularity'];
    const pri = ['primordial','oven','halo','pounder','titan','chainsaw','shredder'];
    const boss = ['abyssling','base_defender','abyss_guardian','prime_celestial'];
    if (boss.includes(key)) return 'Boss';
    if (cel.includes(key)) return 'Celestial';
    if (pri.includes(key)) return 'Primordial';
    return 'Regular';
}

// ===== WEAPON CLASS TABLE =====

function getFilteredTanks() {
    return tanks.filter(t => {
        if (filters.family !== 'all' && t.family !== filters.family) return false;
        if (filters.wtype !== 'all') {
            const barrels = t.raw.data?.barrels || [];
            const active = barrels.filter(b => b.visualOnly !== 1);
            const has = active.some(b => {
                const c = b.bulletClass || '';
                if (filters.wtype === 'bullet') return c === 'basic';
                if (filters.wtype === 'drone')  return c === 'drone';
                if (filters.wtype === 'trap')   return c.includes('trap');
                if (filters.wtype === 'minion') return c.includes('minion');
                return true;
            });
            if (!has) return false;
        }
        if (searchQ.length > 1 && !t.name.toLowerCase().includes(searchQ)) return false;
        return true;
    }).sort((a, b) => {
        let va, vb;
        if (sortCol === 'name')   { va = a.name;   vb = b.name; }
        else if (sortCol === 'family') { va = a.family; vb = b.family; }
        else if (sortCol === 'tier')   { va = a.tier === '—' ? 99 : +a.tier; vb = b.tier === '—' ? 99 : +b.tier; }
        else {
            // Numeric sorts based on first active barrel
            const ab = firstActiveBarrel(a.raw);
            const bb = firstActiveBarrel(b.raw);
            va = ab ? (ab[sortCol === 'reload' ? 'reload' : sortCol === 'damage' ? 'bulletDamage' : 'bulletHealth'] ?? 0) : 0;
            vb = bb ? (bb[sortCol === 'reload' ? 'reload' : sortCol === 'damage' ? 'bulletDamage' : 'bulletHealth'] ?? 0) : 0;
        }
        if (typeof va === 'string') return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
        return sortAsc ? va - vb : vb - va;
    });
}

function firstActiveBarrel(raw) {
    return (raw.data?.barrels || []).find(b => b.visualOnly !== 1 && b.maxChildren !== 0);
}

function renderWeapons() {
    const tbody = document.getElementById('wc-tbody');
    const filtered = getFilteredTanks();
    document.getElementById('wc-count').textContent = filtered.length;

    // Remove old expand tbodies
    document.querySelectorAll('.bwrap').forEach(el => el.remove());

    tbody.innerHTML = '';

    for (const tank of filtered) {
        const fb = firstActiveBarrel(tank.raw);
        const allBarrels = tank.raw.data?.barrels || [];
        const hasExpand = allBarrels.length > 0;

        const tr = document.createElement('tr');
        tr.className = 'tankrow';
        tr.dataset.key = tank.key;

        const tierCls = tank.tier === '—' ? 'tx' : `t${tank.tier}`;
        const tierTxt = tank.tier === '—' ? '—' : `T${tank.tier}`;

        tr.innerHTML = `
            <td><div class="tname">
                <span class="earr">${hasExpand ? '▶' : ''}</span>
                ${tank.name}
            </div></td>
            <td><span class="wpill" style="background:none;border:none;padding:0;color:#f8d4f099">${tank.family}</span></td>
            <td><span class="tier ${tierCls}">${tierTxt}</span></td>
            <td>${fb ? `<span class="wpill">${(fb.bulletClass||'').replace(/_/g,' ')}</span>` : '<span style="color:#f8d4f022">—</span>'}</td>
            <td class="mn">${fb ? fb.reload ?? '—' : '—'}</td>
            <td class="mn">${fb ? fb.bulletDamage ?? '—' : '—'}</td>
            <td class="mn">${fb ? fb.bulletHealth ?? '—' : '—'}</td>
        `;

        tbody.appendChild(tr);

        // Expand tbody
        const etbody = document.createElement('tbody');
        etbody.className = 'bwrap';
        etbody.id = `bw-${tank.key}`;

        const etr = document.createElement('tr');
        etr.className = 'brow';
        const etd = document.createElement('td');
        etd.colSpan = 7;

        const inner = document.createElement('div');
        inner.className = 'binner';

        // Canvas for tank drawing
        const canvasWrap = document.createElement('div');
        canvasWrap.className = 'tank-canvas-wrap';
        const cvs = document.createElement('canvas');
        cvs.width = 240; cvs.height = 240;
        canvasWrap.appendChild(cvs);
        inner.appendChild(canvasWrap);

        // Barrel boxes
        const bboxes = document.createElement('div');
        bboxes.className = 'bboxes';
        inner.appendChild(bboxes);

        etd.appendChild(inner);
        etr.appendChild(etd);
        etbody.appendChild(etr);

        // Insert after tbody
        tbody.parentElement.insertBefore(etbody, tbody.nextSibling);

        let drawn = false;

        tr.addEventListener('click', () => {
            const expanded = tr.classList.toggle('exp');
            etbody.classList.toggle('open', expanded);

            if (expanded && !drawn) {
                drawn = true;
                drawTank(cvs, tank.raw, tank.family, bulletClasses);
                buildStatBoxes(bboxes, tank.raw, bulletClasses);
            }
        });
    }

    // Put tbody back at bottom for correct rendering
    tbody.parentElement.appendChild(tbody);
}

// ===== BODIES TABLE =====

function renderBodies() {
    const tbody = document.getElementById('body-tbody');
    if (!tbody) return;

    const skip = new Set(['spectator','base_defender','abyss_guardian','prime_celestial',
        'drone_minion','factory_minion_body','splitter_minion_body','synope_minion_body',
        'havoc_minion_body','engineer_trap_body','photon_trap_body','raider_trap_body',
        'arsenal_trap_body','manufacturer_minion_body']);

    const rows = Object.entries(bodyClasses)
        .filter(([k]) => !skip.has(k) && !k.startsWith('shape_') && !k.startsWith('infected_') && k !== 'fragmented_wall')
        .map(([, bc]) => `
            <tr>
                <td style="font-weight:700">${bc.name || '—'}</td>
                <td class="mn">${r3(bc.maxHealthMultiplier ?? 1)}</td>
                <td class="mn">${r3(bc.bodyDamageMultiplier ?? 1)}</td>
                <td class="mn">${r3(bc.movementSpeedMultiplier ?? 1)}</td>
                <td class="mn">${r3(bc.hitboxRadiusMul ?? 1)}</td>
                <td class="mn">${r3(bc.sizeMultiplier ?? 1)}</td>
                <td class="mn">${r3(bc.cameraSizeMultiplier ?? 1)}</td>
            </tr>
        `).join('');

    tbody.innerHTML = rows || '<tr><td colspan="7" style="text-align:center;padding:30px;color:#f8d4f033">No data</td></tr>';
}

// ===== BULLETS TABLE =====

function renderBullets() {
    const tbody = document.getElementById('bullet-tbody');
    if (!tbody) return;

    const rows = Object.entries(bulletClasses).map(([key, bc]) => `
        <tr>
            <td><span class="wpill">${key.replace(/_/g,' ')}</span></td>
            <td class="mn">${r3(bc.baseBulletDamage ?? 0)}</td>
            <td class="mn">${r3(bc.baseBulletHealth ?? 0)}</td>
            <td class="mn">${r3(bc.baseBulletSpeed ?? 0)}</td>
            <td class="mn">${r3(bc.baseBulletLifetime ?? 0)}</td>
            <td class="mn">${r3(bc.sizeMultiplier ?? 1)}</td>
            <td class="mn">${r3(bc.hitboxRadiusMul ?? 1)}</td>
            <td class="mn" style="font-size:11px">${bc.collisionMaterial || '—'}</td>
        </tr>
    `).join('');

    tbody.innerHTML = rows;
}

// ===== HOME STATS =====

function renderStats() {
    const counts = { Regular:0, Celestial:0, Primordial:0, Boss:0 };
    tanks.forEach(t => counts[t.family] = (counts[t.family] || 0) + 1);
    setEl('hs-total', tanks.length);
    setEl('hs-reg',   counts.Regular || 0);
    setEl('hs-cel',   counts.Celestial || 0);
    setEl('hs-pri',   counts.Primordial || 0);
    setEl('hs-boss',  counts.Boss || 0);
}

// ===== SCORE TRACKER =====

function initTracker() {
    ['t-curscore','t-curtime','t-pastscore','t-pasttime','t-goalsc','t-goalh','t-goalclock']
        .forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('input', calcTracker);
        });
}

function parseScore(v) {
    if (!v || !v.trim()) return null;
    v = v.trim().toLowerCase().replace(',','.');
    if (v.endsWith('b')) {
        const n = parseFloat(v.slice(0,-1));
        return isNaN(n) ? null : n;
    }
    const n = parseFloat(v);
    return isNaN(n) ? null : n;
}

function parseHours(v) {
    if (!v || !v.trim()) return null;
    v = v.trim().toLowerCase();
    const min = v.match(/^([\d.,]+)\s*min/);
    if (min) return parseFloat(min[1].replace(',','.')) / 60;
    const h = v.match(/^([\d.,]+)\s*h/);
    if (h) return parseFloat(h[1].replace(',','.'));
    const n = parseFloat(v.replace(',','.'));
    return isNaN(n) ? null : n;
}

function fmtDate(d) {
    if (!d) return '—';
    return d.toLocaleString([], { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
}

function calcTracker() {
    const curSc  = parseScore(document.getElementById('t-curscore')?.value);
    const curT   = document.getElementById('t-curtime')?.value ? new Date(document.getElementById('t-curtime').value) : null;
    const pastSc = parseScore(document.getElementById('t-pastscore')?.value);
    const pastT  = document.getElementById('t-pasttime')?.value ? new Date(document.getElementById('t-pasttime').value) : null;
    const goalSc = parseScore(document.getElementById('t-goalsc')?.value);
    const goalH  = parseHours(document.getElementById('t-goalh')?.value);
    const goalClock = document.getElementById('t-goalclock')?.value ? new Date(document.getElementById('t-goalclock').value) : null;

    // Elapsed hours
    let elaH = null;
    if (curT && pastT) {
        elaH = (curT - pastT) / 3600000;
        setRes('r-elapsed', elaH < 0 ? 'Check times!' : `${r2(elaH)} h`, elaH < 0 ? 'warn' : '');
    } else setRes('r-elapsed', '—');

    // Score rate
    let rate = null;
    if (curSc !== null && pastSc !== null && elaH !== null && elaH > 0) {
        rate = (curSc - pastSc) / elaH;
        setRes('r-rate', `${r2(rate)} b/h`);
    } else setRes('r-rate', '—');

    // Estimated total playtime (curScore / rate)
    if (curSc !== null && rate !== null && rate > 0) {
        setRes('r-playtime', `${r2(curSc / rate)} h`);
    } else setRes('r-playtime', '—');

    // Score goal
    if (goalSc !== null && curSc !== null) {
        if (curSc >= goalSc) {
            setRes('r-goalh', 'Already achieved!', 'good');
            setRes('r-goalat', 'Already achieved!', 'good');
        } else if (rate !== null && rate > 0) {
            const hNeeded = (goalSc - curSc) / rate;
            setRes('r-goalh', `${r2(hNeeded)} h`);
            if (curT) {
                const achievedAt = new Date(curT.getTime() + hNeeded * 3600000);
                setRes('r-goalat', fmtDate(achievedAt));
            } else setRes('r-goalat', '—');
        } else {
            setRes('r-goalh', '—');
            setRes('r-goalat', '—');
        }
    } else {
        setRes('r-goalh', '—');
        setRes('r-goalat', '—');
    }

    // Score at +hours
    if (goalH !== null && curSc !== null && rate !== null) {
        setRes('r-atph', `${r2(curSc + goalH * rate)} b`);
    } else setRes('r-atph', '—');

    // Score at clock time
    if (goalClock && curT && curSc !== null && rate !== null) {
        const diffH = (goalClock - curT) / 3600000;
        if (diffH < 0) {
            setRes('r-atclock', 'Time already passed!', 'warn');
        } else {
            setRes('r-atclock', `${r2(curSc + diffH * rate)} b`);
        }
    } else setRes('r-atclock', '—');
}

// ===== SEARCH =====

function initSearch() {
    const input = document.getElementById('search-input');
    const drop  = document.getElementById('search-drop');

    input.addEventListener('input', () => {
        searchQ = input.value.toLowerCase().trim();
        const q = searchQ;

        if (q.length < 2) { drop.classList.remove('open'); return; }

        const matches = tanks.filter(t => t.name.toLowerCase().includes(q)).slice(0, 7);
        if (!matches.length) { drop.innerHTML = '<div class="si"><span style="color:#f8d4f044">No results</span></div>'; drop.classList.add('open'); return; }

        drop.innerHTML = matches.map(t => `
            <div class="si" onclick="goTank('${t.key}')">
                <div><div class="si-name">${t.name}</div>
                <div class="si-meta">${t.family} · ${(t.raw.data?.barrels||[]).filter(b=>b.visualOnly!==1).length} active barrel(s)</div></div>
                <span class="fb fb-${t.family}">${t.family}</span>
            </div>
        `).join('');
        drop.classList.add('open');
    });

    document.addEventListener('click', e => {
        if (!drop.contains(e.target) && e.target !== input) drop.classList.remove('open');
    });
}

function goTank(key) {
    document.getElementById('search-drop').classList.remove('open');
    navigate('weapons');
    setTimeout(() => {
        const row = document.querySelector(`.tankrow[data-key="${key}"]`);
        if (!row) return;
        row.scrollIntoView({ behavior:'smooth', block:'center' });
        if (!row.classList.contains('exp')) row.click();
        row.style.outline = '2px solid #85008A';
        setTimeout(() => row.style.outline = '', 2000);
    }, 120);
}

// ===== NAVIGATION =====

function navigate(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item[data-page]').forEach(n => n.classList.remove('active'));
    const p = document.getElementById(`page-${page}`);
    const n = document.querySelector(`.nav-item[data-page="${page}"]`);
    if (p) p.classList.add('active');
    if (n) n.classList.add('active');
}

// ===== FILTERS & SORTING =====

function initFilters() {
    document.querySelectorAll('.fbtn').forEach(btn => {
        btn.addEventListener('click', () => {
            const g = btn.dataset.g, v = btn.dataset.v;
            document.querySelectorAll(`.fbtn[data-g="${g}"]`).forEach(b => b.classList.remove('on'));
            btn.classList.add('on');
            filters[g] = v;
            renderWeapons();
        });
    });
}

function initSorting() {
    document.querySelectorAll('th[data-sort]').forEach(th => {
        th.addEventListener('click', () => {
            const col = th.dataset.sort;
            if (sortCol === col) { sortAsc = !sortAsc; th.classList.toggle('asc', sortAsc); }
            else {
                document.querySelectorAll('th[data-sort]').forEach(t => t.classList.remove('sorted','asc'));
                sortCol = col; sortAsc = true;
            }
            th.classList.add('sorted');
            renderWeapons();
        });
    });
}

// ===== LOADING UI =====

function setProgress(pct) {
    const b = document.getElementById('lbar');
    if (b) b.style.width = pct + '%';
}

function setLtxt(t) {
    const el = document.getElementById('ltxt');
    if (el) el.textContent = t;
}

function hideLoading() {
    const el = document.getElementById('loading');
    if (el) { el.classList.add('fade'); setTimeout(() => el.style.display = 'none', 400); }
}

function showManual() {
    const el = document.getElementById('loading');
    if (!el) return;
    el.innerHTML = `
        <div id="manual-wrap">
            <div class="ltitle" style="font-size:32px;margin-bottom:16px">Tanks <span>Technical</span></div>
            <p>Could not reach neoxe.io.<br>Paste the contents of <code style="color:#f8d4f0">neoxe.io/menu-data.json</code> below.</p>
            <textarea id="manual-ta" placeholder="Paste JSON here..."></textarea>
            <button onclick="loadManual()">Load Data</button>
        </div>
    `;
}

function loadManual() {
    const v = document.getElementById('manual-ta')?.value;
    if (!v) return;
    try { processData(JSON.parse(v)); }
    catch(e) { alert('Invalid JSON. Make sure you copied the full file.'); }
}

function setStatus(ok, msg) {
    const dot = document.getElementById('sdot');
    const txt = document.getElementById('stxt');
    if (dot) { dot.style.background = ok ? '#44cc88' : '#cc4444'; dot.style.boxShadow = ok ? '0 0 8px #44cc8866' : '0 0 8px #cc444466'; }
    if (txt) txt.textContent = msg;
}

// ===== HELPERS =====

function setEl(id, v) { const e = document.getElementById(id); if (e) e.textContent = v; }
function setRes(id, v, cls = '') {
    const e = document.getElementById(id);
    if (!e) return;
    e.textContent = v;
    e.className = 'trv' + (cls ? ' ' + cls : '');
}
function r2(n) { return Math.round(n * 100) / 100; }
function r3(n) { return Math.round(n * 1000) / 1000; }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ===== INIT =====

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.nav-item[data-page]').forEach(n => {
        n.addEventListener('click', () => navigate(n.dataset.page));
    });

    initSearch();
    initFilters();
    initSorting();
    initTracker();
    loadData();
});
