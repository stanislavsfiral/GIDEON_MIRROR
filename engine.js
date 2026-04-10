let scene, camera, renderer, controls, masterData;
let currentGroup = new THREE.Group();
let vCanvas, vCtx;
let smoothResonance = 0.5;
let frameCounter = 0;

window.gVideo = null;
window.GIDEON_AXIS = 'Y';
window.GIDEON_COUNT = 6; // Количество Диполей

// 1. ТВОЙ ПРИНЦИП ПОСТРОЕНИЯ БАЗОВОЙ ГЕОМЕТРИИ (ВИХРЬ)
function generateSfiralBase() {
    const pts = [];
    const count = 4000; 
    const resonanceStep = 372.72; // Твой коэффициент

    for (let i = 0; i < count; i++) {
        const t = i / count;
        // Рекурсивная логика витков
        const angle = t * Math.PI * 20;
        const r = Math.pow(t, 0.5) * 15;
        
        const x = Math.cos(angle) * r;
        const y = Math.sin(angle) * r;
        const z = t * resonanceStep * 0.1;
        
        pts.push(x, y, z);
    }
    return new Float32Array(pts);
}

// 2. ТВОЯ ФУНКЦИЯ СОЗДАНИЯ СФИРАЛИ (ИЗ HTML)
function createSfiral(data, ry, rx, rz) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(data, 3));
    
    // Тот самый материал с твоего сайта
    const material = new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uCharge: { value: 0.5 } },
        vertexShader: `
            uniform float uTime;
            uniform float uCharge;
            varying vec3 vPos;
            void main() {
                vPos = position;
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                gl_Position = projectionMatrix * mvPosition;
                gl_PointSize = (2.0 + uCharge * 4.0) * (300.0 / -mvPosition.z);
            }
        `,
        fragmentShader: `
            uniform float uTime;
            uniform float uCharge;
            varying vec3 vPos;
            void main() {
                float pulse = sin(vPos.z * 0.05 - uTime * 2.0) * 0.5 + 0.5;
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

// 3. ТВОЙ ПРИНЦИП СБОРКИ ЯДРА (ИЗ HTML)
function build3DCore() {
    if (!masterData) return;
    currentGroup.clear();

    const count = window.GIDEON_COUNT;
    const step = (Math.PI * 2) / count;

    for (let i = 0; i < count; i++) {
        const angle = i * step;

        // Создаем ДИПОЛЬ (как прописано у тебя в build3DCore(false))
        // Прямая сфираль
        const s1 = createSfiral(masterData, angle, 0, 0);
        currentGroup.add(s1);

        // Зеркальная сфираль (дипольный разворот на 180 градусов)
        const s2 = createSfiral(masterData, angle + Math.PI, 0, Math.PI);
        currentGroup.add(s2);
    }
    console.log("✅ Ядро собрано по принципу GIDEON v13.7");
}

function init3D() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 5000);
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    camera.position.set(0, 50, 200);
    scene.add(currentGroup);
    
    vCanvas = document.createElement('canvas');
    vCtx = vCanvas.getContext('2d', { willReadFrequently: true });
}

function animate() {
    requestAnimationFrame(animate);
    
    if (window.gVideo && window.gVideo.readyState === 4) {
        vCtx.drawImage(window.gVideo, 0, 0, 16, 16);
        const bright = vCtx.getImageData(8, 8, 1, 1).data[0] / 255;
        smoothResonance = (smoothResonance * 0.9) + (bright * 0.1);
    }

    currentGroup.children.forEach(child => {
        if (child.material.uniforms) {
            child.material.uniforms.uTime.value = Date.now() * 0.001;
            child.material.uniforms.uCharge.value = smoothResonance;
        }
    });

    currentGroup.rotation.y += 0.002;
    controls.update();
    renderer.render(scene, camera);
}

// Старт системы
init3D();
masterData = generateSfiralBase();
build3DCore();
animate();

window.rebuildCore = build3DCore;
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});