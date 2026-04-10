const npyLoader = new npyjs();
let scene, camera, renderer, controls, masterData;
let currentGroup = new THREE.Group();
let vCanvas, vCtx;
let smoothResonance = 0;
let frameCounter = 0;

window.gVideo = null;
window.GIDEON_AXIS = 'Y';
window.GIDEON_COUNT = 12;

// --- ИНИЦИАЛИЗАЦИЯ АНАЛИТИКИ ---
let telemetryStream = null;
function initAnalyticsSystem() {
    const led = document.getElementById('sys-led');
    telemetryStream = new WebSocket('ws://127.0.0.1:8765');
    telemetryStream.onopen = () => {
        if (led) { led.style.background = "#00ffcc"; led.style.boxShadow = "0 0 15px #00ffcc"; }
        console.log("%c[GIDEON AI] Связь установлена. Режим Nexus активен", "color: #00ffcc; font-weight: bold;");
    };
}

// --- ГЕНЕРАЦИЯ ЯДРА (Твоя формула 4-х сегментов) ---
function generateSfiralCore() {
    const points = [];
    const totalPoints = 12000;
    const resonanceStep = 372.72;

    for (let i = 0; i < totalPoints; i++) {
        const t = (i / totalPoints);
        const angle = t * Math.PI * 40;
        const radius = Math.exp(t * 2.5) * 1.5; 
        const segment = Math.floor(t * 4);
        let x, y, z;

        if (segment === 0) { // Левый виток
            x = Math.cos(angle) * radius;
            y = Math.sin(angle) * radius;
            z = i * 0.004;
        } else if (segment === 1 || segment === 2) { // S-переходы
            const sMod = Math.sin(angle * 0.2) * resonanceStep * 0.01;
            x = Math.cos(angle) * radius * (1.1 + Math.sin(t * Math.PI));
            y = Math.sin(angle) * radius;
            z = (i * 0.004) + sMod;
        } else { // Правый виток (инверсия)
            x = Math.cos(-angle) * radius;
            y = Math.sin(-angle) * radius;
            z = i * 0.004;
        }
        points.push(x, y, z);
    }
    return { data: new Float32Array(points), shape: [totalPoints, 3] };
}

async function loadProtectedCore() {
    console.log("⚡ Синтез матрицы...");
    masterData = generateSfiralCore();
}

function init3D() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    camera.position.set(100, 100, 250);
    scene.add(currentGroup);

    vCanvas = document.createElement('canvas');
    vCtx = vCanvas.getContext('2d', { willReadFrequently: true });
    initAnalyticsSystem();
}

function build3DCore() {
    if (!masterData) return;
    currentGroup.clear();

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(masterData.data, 3));

    const material = new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0 },
            uCharge: { value: 0 }
        },
        vertexShader: `
            uniform float uTime;
            uniform float uCharge;
            varying vec3 vPos;
            void main() {
                vPos = position;
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                gl_Position = projectionMatrix * mvPosition;
                // Размер точки теперь корректно зависит от uCharge и глубины
                gl_PointSize = (2.8 + uCharge * 2.0) * (200.0 / -mvPosition.z);
            }
        `,
        fragmentShader: `
            uniform float uTime;
            uniform float uCharge;
            varying vec3 vPos;
            void main() {
                float pulse = sin(vPos.z * 0.08 - uTime * 3.0) * 0.5 + 0.5;
                vec3 cyan = vec3(0.0, 1.0, 0.8);
                vec3 magenta = vec3(1.0, 0.0, 1.0);
                vec3 color = mix(cyan, magenta, uCharge * 0.5);
                gl_FragColor = vec4(color * pulse, 0.7);
            }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });

    for (let i = 0; i < window.GIDEON_COUNT; i++) {
        const mesh = new THREE.Points(geometry, material);
        const angle = (i / window.GIDEON_COUNT) * Math.PI * 2;
        if (window.GIDEON_AXIS === 'Y') mesh.rotation.y = angle;
        else mesh.rotation.x = angle;
        currentGroup.add(mesh);
    }
}

function animate() {
    requestAnimationFrame(animate);
    frameCounter++;

    if (window.gVideo && window.gVideo.readyState === 4) {
        if (frameCounter % 2 === 0) {
            vCtx.drawImage(window.gVideo, 0, 0, 16, 16);
            const pixel = vCtx.getImageData(8, 8, 1, 1).data;
            const bright = pixel[0] / 255;
            smoothResonance = (smoothResonance * 0.9) + (bright * 0.1);
        }

        const cohVal = document.getElementById('coh-val');
        if (cohVal) cohVal.innerText = smoothResonance.toFixed(4);
        
        const bar = document.getElementById('core-charge');
        if (bar) bar.style.width = (smoothResonance * 100) + "%";

        currentGroup.children.forEach(child => {
            child.material.uniforms.uTime.value = Date.now() * 0.001;
            child.material.uniforms.uCharge.value = smoothResonance;
        });

        if (frameCounter % 6 === 0 && telemetryStream && telemetryStream.readyState === 1) {
            telemetryStream.send(JSON.stringify({ telemetry: [smoothResonance] }));
        }
    }

    controls.update();
    currentGroup.rotation.y += 0.0015;
    renderer.render(scene, camera);
}

init3D();
loadProtectedCore().then(() => {
    build3DCore();
    animate();
});

window.rebuildCore = build3DCore;

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});