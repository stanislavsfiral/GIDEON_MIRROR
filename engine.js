const npyLoader = new npyjs();
let scene, camera, renderer, controls, masterData;
let currentGroup = new THREE.Group();
let vCanvas, vCtx;
let smoothResonance = 0.5;

window.gVideo = null;
window.GIDEON_AXIS = 'Y';
window.GIDEON_COUNT = 6; // Количество диполей

// --- ЗАГРУЗКА MASTER МОДЕЛИ ---
async function loadProtectedCore() {
    try {
        console.log("📡 Загрузка Master модели...");
        const data = await npyLoader.load('master.npy');
        masterData = data.data; 
        console.log("✅ Master модель загружена успешно.");
    } catch (e) {
        console.error("❌ Ошибка загрузки .npy:", e);
    }
}

// --- СОЗДАНИЕ СФИРАЛИ (Твоя логика из v13.7) ---
function createSfiral(data, ry, rx, rz) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(data, 3));
    
    const material = new THREE.ShaderMaterial({
        uniforms: { 
            uTime: { value: 0 }, 
            uCharge: { value: 0.5 } 
        },
        vertexShader: `
            uniform float uTime;
            uniform float uCharge;
            varying vec3 vPos;
            void main() {
                vPos = position;
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                gl_Position = projectionMatrix * mvPosition;
                gl_PointSize = (2.0 + uCharge * 5.0) * (300.0 / -mvPosition.z);
            }
        `,
        fragmentShader: `
            uniform float uTime;
            uniform float uCharge;
            varying vec3 vPos;
            void main() {
                float pulse = sin(vPos.z * 0.08 - uTime * 3.0) * 0.5 + 0.5;
                vec3 color = mix(vec3(0.0, 1.0, 0.8), vec3(0.8, 0.0, 1.0), uCharge);
                gl_FragColor = vec4(color * pulse, 0.8);
            }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });

    const points = new THREE.Points(geometry, material);
    points.rotation.set(rx, ry, rz);
    return points;
}

// --- СБОРКА ЯДРА (6 диполей = 12 сфиралей) ---
function build3DCore() {
    if (!masterData) return;
    currentGroup.clear();

    const count = window.GIDEON_COUNT;
    const step = (Math.PI * 2) / count;

    for (let i = 0; i < count; i++) {
        const angle = i * step;

        // ДИПОЛЬ: Оригинал + Зеркальный разворот (180 по Y и Z)
        currentGroup.add(createSfiral(masterData, angle, 0, 0));
        currentGroup.add(createSfiral(masterData, angle + Math.PI, 0, Math.PI));
    }
    
    // Авто-фокус (Твой centerView)
    const box = new THREE.Box3().setFromObject(currentGroup);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    camera.position.set(center.x, center.y, center.z + Math.max(size.x, size.y, size.z) * 1.8);
    controls.target.copy(center);
}

function init3D() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000);
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    scene.add(currentGroup);
    
    vCanvas = document.createElement('canvas');
    vCtx = vCanvas.getContext('2d', { willReadFrequently: true });
}

function animate() {
    requestAnimationFrame(animate);
    
    if (window.gVideo && window.gVideo.readyState === 4) {
        vCtx.drawImage(window.gVideo, 0, 0, 16, 16);
        const bright = vCtx.getImageData(8, 8, 1, 1).data[0] / 255;
        smoothResonance = (smoothResonance * 0.95) + (bright * 0.05);
    }

    currentGroup.children.forEach(child => {
        if (child.material && child.material.uniforms) {
            child.material.uniforms.uTime.value = Date.now() * 0.001;
            child.material.uniforms.uCharge.value = smoothResonance;
        }
    });

    currentGroup.rotation.y += 0.001;
    controls.update();
    renderer.render(scene, camera);
}

// ЗАПУСК
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