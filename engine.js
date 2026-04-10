const npyLoader = new npyjs();
let scene, camera, renderer, controls, masterData;
let currentGroup = new THREE.Group();
let vCanvas, vCtx;
let smoothResonance = 0;
let frameCounter = 0;
let telemetryStream = null;

window.gVideo = null;
window.GIDEON_AXIS = 'Y';
window.GIDEON_COUNT = 12;

function initAnalyticsSystem() {
    const led = document.getElementById('sys-led');
    telemetryStream = new WebSocket('ws://127.0.0.1:8765');
    telemetryStream.onopen = () => {
        if (led) { led.style.background = "#00ffcc"; led.style.boxShadow = "0 0 10px #00ffcc"; }
        console.log("%c✨ QYDYR: Связь с хранителем установлена.", "color: #00ffcc; font-style: italic;");
    };
}

// ЛОГИКА ИЗ GIDEON v13.7: Рекурсивная генерация точек
function generateSfiralCore() {
    const points = [];
    const resonanceStep = 372.72;
    const iterations = 8000;

    for (let i = 0; i < iterations; i++) {
        // Параметрическая прогрессия
        const t = (i / iterations);
        const angle = t * Math.PI * 25; // Закрутка
        const expRadius = Math.exp(t * 2) * 2; // Экспоненциальное расширение как на фото
        
        // Разделение на 4 фазовых сегмента (Твоя Master структура)
        const segment = Math.floor(t * 4);
        let x, y, z;

        if (segment === 0) { // Левый виток (S-Left)
            x = Math.cos(angle) * expRadius;
            y = Math.sin(angle) * expRadius;
            z = i * 0.005;
        } else if (segment === 1 || segment === 2) { // S-образные переходы
            const sPhase = Math.sin(angle * 0.1) * resonanceStep * 0.01;
            x = Math.cos(angle) * expRadius * (1 + Math.sin(t * Math.PI));
            y = Math.sin(angle) * expRadius;
            z = (i * 0.005) + sPhase;
        } else { // Правый виток (S-Right, инверсия хиральности)
            x = Math.cos(-angle) * expRadius;
            y = Math.sin(-angle) * expRadius;
            z = i * 0.005;
        }

        points.push(x, y, z);
    }
    return { data: new Float32Array(points), shape: [iterations, 3] };
}

async function loadProtectedCore() {
    masterData = generateSfiralCore();
    console.log("✅ Математический синтез GIDEON v13.7 завершен.");
}

function init3D() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    camera.position.set(50, 50, 150);
    scene.add(currentGroup);
    
    vCanvas = document.createElement('canvas');
    vCtx = vCanvas.getContext('2d');
    initAnalyticsSystem();
}

function build3DCore() {
    if (!masterData) return;
    currentGroup.clear();

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(masterData.data, 3));

    const material = new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uCharge: { value: 0 } },
        vertexShader: `
            varying vec3 vPos;
            void main() {
                vPos = position;
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                gl_Position = projectionMatrix * mvPosition;
                gl_PointSize = 2.5 * (100.0 / -mvPosition.z);
            }
        `,
        fragmentShader: `
            uniform float uTime;
            uniform float uCharge;
            varying vec3 vPos;
            void main() {
                float pulse = sin(vPos.z * 0.05 - uTime * 2.0) * 0.5 + 0.5;
                vec3 baseColor = mix(vec3(0.0, 0.3, 0.6), vec3(0.0, 1.0, 0.9), uCharge);
                gl_FragColor = vec4(baseColor * pulse, 0.8);
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
        if (vCanvas.width !== 160) { vCanvas.width = 160; vCanvas.height = 120; }
        vCtx.drawImage(window.gVideo, 0, 0, 160, 120);
        const bright = vCtx.getImageData(80, 60, 1, 1).data[0] / 255;
        smoothResonance = (smoothResonance * 0.9) + (bright * 0.1);

        document.getElementById('coh-val').innerText = smoothResonance.toFixed(4);
        document.getElementById('charge-val').innerText = (smoothResonance * 100).toFixed(0) + "%";
        document.getElementById('core-charge').style.width = (smoothResonance * 100) + "%";

        currentGroup.children.forEach(child => {
            child.material.uniforms.uTime.value = Date.now() * 0.001;
            child.material.uniforms.uCharge.value = smoothResonance;
        });
    }

    controls.update();
    currentGroup.rotation.y += 0.001;
    renderer.render(scene, camera);
}

init3D();
loadProtectedCore().then(() => { build3DCore(); animate(); });

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});