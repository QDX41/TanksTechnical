// Background canvas animation - floating shapes and auras like Neoxe menu
const canvas = document.getElementById('bg-canvas');
const ctx = canvas.getContext('2d');

let W, H, entities = [], rotation = 0;

function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
}

// Shape types matching Neoxe's shapes
const SHAPES = [
    { sides: 3, color: '#FFE46B44', stroke: '#E1C64D22', size: 18 }, // triangle
    { sides: 4, color: '#FC767644', stroke: '#DE585822', size: 20 }, // square
    { sides: 5, color: '#768CFC44', stroke: '#586EDE22', size: 24 }, // pentagon
    { sides: 6, color: '#FCA64444', stroke: '#DE882622', size: 28 }, // hexagon
    { sides: 0, color: '#00B0E133', stroke: '#0092C322', size: 22 }, // circle (tank)
];

// Aura types
const AURAS = [
    { color: '#FC767620', radius: 60 }, // fire
    { color: '#38B76420', radius: 55 }, // heal
    { color: '#B2DFDB20', radius: 65 }, // freeze
    { color: '#aa33ff18', radius: 70 }, // celestial
];

function spawnEntity() {
    const shape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
    const hasAura = Math.random() < 0.3;
    const aura = hasAura ? AURAS[Math.floor(Math.random() * AURAS.length)] : null;

    return {
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        angle: Math.random() * Math.PI * 2,
        vangle: (Math.random() - 0.5) * 0.005,
        shape,
        aura,
        auraPhase: Math.random() * Math.PI * 2,
        opacity: 0.3 + Math.random() * 0.4,
        scale: 0.6 + Math.random() * 0.8,
    };
}

function drawPoly(cx, cy, sides, radius, angle) {
    if (sides === 0) {
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        return;
    }
    ctx.moveTo(
        cx + radius * Math.cos(angle),
        cy + radius * Math.sin(angle)
    );
    for (let i = 1; i <= sides; i++) {
        ctx.lineTo(
            cx + radius * Math.cos(angle + (i / sides) * Math.PI * 2),
            cy + radius * Math.sin(angle + (i / sides) * Math.PI * 2)
        );
    }
}

// Slow scene rotation — the whole field rotates gently
let sceneAngle = 0;
const SCENE_SPEED = 0.00015;

function draw(timestamp) {
    ctx.clearRect(0, 0, W, H);

    sceneAngle += SCENE_SPEED;

    const cx = W / 2, cy = H / 2;
    const dist = Math.max(W, H) * 0.6;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(sceneAngle);
    ctx.translate(-cx, -cy);

    for (const e of entities) {
        // Move
        e.x += e.vx;
        e.y += e.vy;
        e.angle += e.vangle;

        // Wrap around
        if (e.x < -100) e.x = W + 100;
        if (e.x > W + 100) e.x = -100;
        if (e.y < -100) e.y = H + 100;
        if (e.y > H + 100) e.y = -100;

        const r = e.shape.size * e.scale;

        // Draw aura (animated pulse)
        if (e.aura) {
            e.auraPhase += 0.02;
            const auraR = e.aura.radius * e.scale * (1 + 0.08 * Math.sin(e.auraPhase));
            const grad = ctx.createRadialGradient(e.x, e.y, r * 0.5, e.x, e.y, auraR);
            grad.addColorStop(0, e.aura.color);
            grad.addColorStop(1, 'transparent');
            ctx.beginPath();
            ctx.arc(e.x, e.y, auraR, 0, Math.PI * 2);
            ctx.fillStyle = grad;
            ctx.fill();
        }

        // Draw shape
        ctx.save();
        ctx.globalAlpha = e.opacity;
        ctx.beginPath();
        drawPoly(e.x, e.y, e.shape.sides, r, e.angle);
        ctx.closePath();
        ctx.fillStyle = e.shape.color;
        ctx.strokeStyle = e.shape.stroke;
        ctx.lineWidth = 3;
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }

    ctx.restore();

    requestAnimationFrame(draw);
}

function init() {
    resize();
    // Spawn entities spread across a larger area so rotation reveals them
    entities = [];
    const count = Math.min(40, Math.floor((W * H) / 30000));
    for (let i = 0; i < count; i++) {
        // Spread beyond canvas bounds too
        const e = spawnEntity();
        e.x = (Math.random() - 0.5) * W * 1.4 + W / 2;
        e.y = (Math.random() - 0.5) * H * 1.4 + H / 2;
        entities.push(e);
    }
    requestAnimationFrame(draw);
}

window.addEventListener('resize', () => {
    resize();
});

init();
