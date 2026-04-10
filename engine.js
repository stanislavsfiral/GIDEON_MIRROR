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
        console.log("%c[MASTER CORE] Связь с трансивером установлена", "color: #00ffcc; font-weight: bold;");
    };
}

// --- СТРОГАЯ ЛОГИКА ПОСТРОЕНИЯ MASTER MODEL (4 сегмента) ---
function generateMasterSfiral() {
    const points = [];
    const totalPoints = 8000; // Плотность эталонной модели
    const resonanceStep = 372.72;

    for (let i = 0; i < totalPoints; i++) {
        const t = i / totalPoints; // Прогресс от 0 до 1
        const angle = t * Math.PI * 30;
        const radius = Math.exp(t * 2.2) * 1.8; // Экспонента для формы "ракушки"
        
        let x, y, z;

        // 1. ЛЕВЫЙ ВИТОК (0% - 25%)
        if (t < 0.25) {
            x = Math.cos(angle) * radius;
            y = Math.sin(angle) * radius;
            z = t * 30;
        } 
        // 2. S-ПЕРЕХОД ЧАСТЬ А (25% - 50%)
        else if (t < 0.50) {
            const localT = (t - 0.25) / 0.25;
            const phaseShift = Math.sin(localT * Math.PI) * 2.0;
            x = Math.cos(angle) * radius * Math.cos(localT * Math.PI * 0.2);
            y = Math.sin(angle) * radius;
            z = t * 30 + phaseShift;
        }
        // 3. S-ПЕРЕХОД ЧАСТЬ Б (50% - 75%)
        else if (t < 0.75) {
            const localT = (t - 0.50) / 0.25;
            const phaseShift = Math.cos(localT * Math.PI) * 2.0;
            x = Math.cos(angle + Math.PI) * radius * Math.sin(localT * Math.PI * 0.2);
            y = Math.sin(angle) * radius;
            z = t * 30 + phaseShift;
        }
        // 4. ПРАВЫЙ ВИТОК (75% - 100%) - Инверсия хиральности
        else {
            x = Math.cos(-angle) * radius;
            y = Math.sin(-angle) * radius;
            z = t * 30;
        }

        points.push(x, y, z);
    }
    return { data: new Float32Array(points), shape: [totalPoints, 3] };
}

async function loadProtectedCore() {
    console.log("⚡ Синтез эталонной модели Master...");
    masterData = generateMasterSfiral();
}

function init3D() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    camera.position.set(120, 120, 300);
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
                gl_PointSize = (2.5 + uCharge * 3.0) * (250.0 / -mvPosition.z);
            }
        `,
        fragmentShader: `
            uniform float uTime;
            uniform float uCharge;
            varying vec3 vPos;
            void main() {
                float pulse = sin(vPos.z * 0.1 - uTime * 4.0) * 0.5 + 0.5;
                vec3 cyan = vec3(0.0, 1.0, 0.8);
                vec3 magnet = vec3(0.7, 0.0, 1.0);
                vec3 color = mix(cyan, magnet, uCharge);
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

        if (frameCounter % 6 === 0 && telemetryStream && telemetryStream.readyState === WebSocket.OPEN) {
            telemetryStream.send(JSON.stringify({ telemetry: [smoothResonance] }));
        }
    }

    controls.update();
    currentGroup.rotation.y += 0.001;
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