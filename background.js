// Grid map background - #100010 base, #f8d4f0 grid lines
// ~200 cells visible, square cells

(function() {
    const canvas = document.getElementById('bg-canvas');
    const ctx = canvas.getContext('2d');

    let W, H, cellSize;

    function resize() {
        W = canvas.width = window.innerWidth;
        H = canvas.height = window.innerHeight;
        // Target ~200 cells visible: sqrt(200) ≈ 14 cells across
        // So cellSize = width / 14
        cellSize = Math.round(W / 14);
    }

    function draw() {
        ctx.clearRect(0, 0, W, H);

        // Base fill - already handled by CSS background #100010
        // Draw grid lines
        ctx.strokeStyle = '#f8d4f0';
        ctx.globalAlpha = 0.08;
        ctx.lineWidth = 1;

        // Vertical lines
        for (let x = 0; x <= W; x += cellSize) {
            ctx.beginPath();
            ctx.moveTo(x + 0.5, 0);
            ctx.lineTo(x + 0.5, H);
            ctx.stroke();
        }

        // Horizontal lines
        for (let y = 0; y <= H; y += cellSize) {
            ctx.beginPath();
            ctx.moveTo(0, y + 0.5);
            ctx.lineTo(W, y + 0.5);
            ctx.stroke();
        }

        ctx.globalAlpha = 1;
    }

    resize();
    draw();

    window.addEventListener('resize', () => {
        resize();
        draw();
    });
})();
