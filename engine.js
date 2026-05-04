// ============================================================================
// QYDYR NEXUS ENGINE v85.1 — Unified Master Control (GIDEON CORE)
// ============================================================================

const npyLoader = new npyjs();
let scene, camera, renderer, controls, mainGroup;
let smoothResonance = 0.5;
let telemetryStream = null;
let vCanvas, vCtx;

// Глобальные параметры (подхватываются из index.html и настроек)
window.GIDEON_AXIS = window.GIDEON_AXIS || 'Y';
window.GIDEON_COUNT = window.GIDEON_COUNT || 12;
let currentThickness = 3.5;
const R = 150, H = 200;

function initCoreSystem() {
    // 1. Инициализация графики
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000205);
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 15000);
    camera.position.set(0, 500, 1200);

    renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(1);
    document.body.appendChild(renderer.domElement);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    mainGroup = new THREE.Group();
    scene.add(mainGroup);

    // 2. Звездная пыль (Эфир)
    const starGeo = new THREE.BufferGeometry();
    const starCoords = [];
    for (let i = 0; i < 1500; i++) starCoords.push((Math.random()-0.5)*10000, (Math.random()-0.5)*10000, (Math.random()-0.5)*10000);
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starCoords, 3));
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0x00ffff, size: 0.8, transparent: true, opacity: 0.3 })));

    // 3. Аналитика видео (Canvas для захвата яркости)
    vCanvas = document.createElement('canvas');
    vCanvas.width = 16; vCanvas.height = 16;
    vCtx = vCanvas.getContext('2d', { willReadFrequently: true });

    // 4. Запуск систем
    initTelemetry();
    rebuildCore();
    animate();
}

function initTelemetry() {
    const led = document.getElementById('sys-led');
    telemetryStream = new WebSocket('ws://127.0.0.1:8765');
    telemetryStream.onopen = () => {
        if (led) { led.style.background = "#00ffcc"; led.style.boxShadow = "0 0 15px #00ffcc"; }
        console.log("QYDYR NEXUS: Связь с защищенным ядром установлена.");
    };
    telemetryStream.onmessage = (msg) => {
        const data = JSON.parse(msg.data);
        // Здесь можно обрабатывать команды от Python-сервера
    };
}

function getSfiralPath() {
    let pts = [];
    let junctionZ = H / 5;
    for (let i = 0; i <= 250; i++) {
        let t = i / 250;
        pts.push(new THREE.Vector3(R * Math.cos(Math.PI*2*t), R * Math.sin(Math.PI*2*t), THREE.MathUtils.lerp(H, junctionZ, t)));
    }
    for (let i = 0; i <= 150; i++) {
        let t = i / 150;
        pts.push(new THREE.Vector3(R/2 + (R/2)*Math.cos(Math.PI*t), (R/2)*Math.sin(Math.PI*t), THREE.MathUtils.lerp(junctionZ, 0, t)));
    }
    let halfLen = pts.length;
    for (let i = halfLen - 1; i >= 0; i--) {
        let p = pts[i]; pts.push(new THREE.Vector3(-p.x, -p.y, -p.z));
    }
    return new THREE.CatmullRomCurve3(pts);
}

function createCable(radius) {
    const cableGroup = new THREE.Group();
    const centralCurve = getSfiralPath();
    const strands = 3;

    for (let s = 0; s < strands; s++) {
        const strandOffset = (Math.PI * 2 / strands) * s;
        const curve = new THREE.Curve();
        curve.getPoint = (t) => {
            const basePt = centralCurve.getPoint(t);
            const tangent = centralCurve.getTangent(t);
            let normal = new THREE.Vector3(0, 1, 0).cross(tangent).normalize();
            let binormal = tangent.clone().cross(normal).normalize();
            let conv = Math.abs(t - 0.5) * 2;
            const angle = strandOffset + t * Math.PI * 15;
            const off = radius * 4.5 * conv;
            return basePt.clone().add(new THREE.Vector3(
                (normal.x * Math.cos(angle) + binormal.x * Math.sin(angle)) * off,
                (normal.y * Math.cos(angle) + binormal.y * Math.sin(angle)) * off,
                (normal.z * Math.cos(angle) + binormal.z * Math.sin(angle)) * off
            ));
        };

        const segs = 140;
        const geo = new THREE.TubeGeometry(curve, segs, radius, 6, false);
        const colors = [];
        for (let i = 0; i <= segs; i++) {
            let t = i / segs;
            let r, g, b;
            if (t <= 0.5) {
                // ВХОД: RGB -> БЕЛЫЙ ЦЕНТР
                let spark = Math.pow(t * 2, 4) * (0.5 + smoothResonance * 0.5); 
                r = (s === 0) ? 1 : spark; g = (s === 1) ? 1 : spark; b = (s === 2) ? 1 : spark;
            } else {
                // ВЫХОД: Стыковка "Цвет в Цвет" (RGB -> CMY)
                let f = (t - 0.5) * 2;
                if (s === 0) { r = f; g = f; b = 0; } // Красный -> Желтый
                if (s === 1) { r = 0; g = f; b = f; } // Зеленый -> Голубой
                if (s === 2) { r = f; g = 0; b = f; } // Синий -> Пурпурный
            }
            for (let j = 0; j <= 6; j++) colors.push(r, g, b);
        }
        geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        const mat = new THREE.MeshBasicMaterial({ 
            vertexColors: true, 
            blending: THREE.AdditiveBlending, 
            transparent: true, 
            opacity: 0.85,
            side: THREE.FrontSide
        });
        cableGroup.add(new THREE.Mesh(geo, mat));
    }
    return cableGroup;
}

// Экспортируем функцию для index.html
window.rebuildCore = function() {
    if(!mainGroup) return;
    while(mainGroup.children.length > 0) {
        const c = mainGroup.children[0];
        if(c.isGroup) {
            c.children.forEach(mesh => { mesh.geometry.dispose(); mesh.material.dispose(); });
        }
        mainGroup.remove(c);
    }
    
    const master = createCable(currentThickness);
    const count = window.GIDEON_COUNT || 12;
    const step = (Math.PI * 2) / count;
    const axis = (window.GIDEON_AXIS || 'Y').toLowerCase();

    for (let n = 0; n < count; n++) {
        const pair = new THREE.Group();
        const s1 = master.clone();
        pair.add(s1);
        
        const s2 = master.clone();
        s2.rotation.y = Math.PI;
        pair.add(s2);

        pair.rotation[axis] = step * n;
        mainGroup.add(pair);
    }
}

function animate() {
    requestAnimationFrame(animate);
    
    // Анализ резонанса из видеопотока
    if (window.gVideo && window.gVideo.readyState === 4) {
        vCtx.drawImage(window.gVideo, 0, 0, 16, 16);
        const br = vCtx.getImageData(8, 8, 1, 1).data[0] / 255;
        smoothResonance = (smoothResonance * 0.95) + (br * 0.05);
        
        // Обновление телеметрии в UI
        const coh = document.getElementById('coh-val');
        if(coh) coh.innerText = smoothResonance.toFixed(4);
    }

    controls.update();
    renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Старт системы
window.onload = initCoreSystem;