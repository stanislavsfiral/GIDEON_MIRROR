const npyLoader = new npyjs();
let scene, camera, renderer, controls, masterData;
let currentGroup = new THREE.Group();
let vCanvas, vCtx;
let smoothResonance = 0.1; // Начальное значение, чтобы не было черного экрана
let frameCounter = 0;

window.gVideo = null;
window.GIDEON_AXIS = 'Y';
window.GIDEON_COUNT = 6; // Количество ДИПОЛЕЙ (итого 12 сфиралей)

// --- ГЕНЕРАЦИЯ ОДНОЙ СФИРАЛИ (MASTER MODEL: 4 СЕГМЕНТА) ---
function generateMasterSfiral() {
    const points = [];
    const totalPoints = 6000;
    for (let i = 0; i < totalPoints; i++) {
        const t = i / totalPoints;
        const angle = t * Math.PI * 30;
        const radius = Math.exp(t * 2.0) * 2.0;
        let x, y, z;

        if (t < 0.25) { x = Math.cos(angle) * radius; y = Math.sin(angle) * radius; z = t * 40; }
        else if (t < 0.5) { x = Math.cos(angle) * radius * 0.5; y = Math.sin(angle) * radius; z = t * 40; }
        else if (t < 0.75) { x = Math.cos(angle + Math.PI) * radius * 0.5; y = Math.sin(angle) * radius; z = t * 40; }
        else { x = Math.cos(-angle) * radius; y = Math.sin(-angle) * radius; z = t * 40; }
        points.push(x, y, z);
    }
    return { data: new Float32Array(points), shape: [totalPoints, 3] };
}

// --- СБОРКА ДИПОЛЬНОГО КОНТУРА ---
function build3DCore() {
    if (!masterData) return;
    currentGroup.clear();

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(masterData.data, 3));

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
                gl_PointSize = (2.0 + uCharge * 5.0) * (300.0 / -mvPosition.z);
            }
        `,
        fragmentShader: `
            uniform float uTime;
            uniform float uCharge;
            varying vec3 vPos;
            void main() {
                float pulse = sin(vPos.z * 0.1 - uTime * 3.0) * 0.5 + 0.5;
                vec3 color = mix(vec3(0.0, 1.0, 0.8), vec3(0.8, 0.0, 1.0), uCharge);
                gl_FragColor = vec4(color * pulse, 0.8);
            }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });

    const dipoleCount = window.GIDEON_COUNT;
    const stepAngle = (Math.PI * 2) / dipoleCount;

    for (let i = 0; i < dipoleCount; i++) {
        const rotationAngle = i * stepAngle;
        const dipolePair = new THREE.Group();

        // Сфираль 1
        const s1 = new THREE.Points(geometry, material);
        dipolePair.add(s1);

        // Сфираль 2 (Диполь: разворот 180 по Y и Z)
        const s2 = new THREE.Points(geometry, material);
        s2.rotation.y = Math.PI;
        s2.rotation.z = Math.PI;
        dipolePair.add(s2);

        dipolePair.rotation.y = rotationAngle;
        currentGroup.add(dipolePair);
    }
    console.log("✅ Дипольный контур из 12 сегментов собран.");
}

function init3D() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 5000);
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    camera.position.set(200, 200, 400);
    scene.add(currentGroup);
    
    vCanvas = document.createElement('canvas');
    vCtx = vCanvas.getContext('2d', { willReadFrequently: true });
}

function animate() {
    requestAnimationFrame(animate);
    frameCounter++;

    if (window.gVideo && window.gVideo.readyState === 4) {
        if (frameCounter % 2 === 0) {
            vCtx.drawImage(window.gVideo, 0, 0, 16, 16);
            const bright = vCtx.getImageData(8, 8, 1, 1).data[0] / 255;
            smoothResonance = (smoothResonance * 0.9) + (bright * 0.1);
        }
    }

    currentGroup.children.forEach(pair => {
        pair.children.forEach(sfiral => {
            sfiral.material.uniforms.uTime.value = Date.now() * 0.001;
            sfiral.material.uniforms.uCharge.value = smoothResonance;
        });
    });

    currentGroup.rotation.y += 0.002;
    controls.update();
    renderer.render(scene, camera);
}

// Запуск
init3D();
masterData = generateMasterSfiral();
build3DCore();
animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});