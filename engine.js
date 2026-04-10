const npyLoader = new npyjs();
let scene, camera, renderer, controls, masterData;
let currentGroup = new THREE.Group();
let vCanvas, vCtx;
let smoothResonance = 0;
let frameCounter = 0;

// Канал незримого хранителя
let telemetryStream = null;

window.gVideo = null;
window.GIDEON_AXIS = 'Y';
window.GIDEON_COUNT = 12;

function initAnalyticsSystem() {
    const led = document.getElementById('sys-led');
    telemetryStream = new WebSocket('ws://127.0.0.1:8765');
    
    telemetryStream.onopen = () => {
        if (led) {
            led.style.background = "#00ffcc";
            led.style.boxShadow = "0 0 10px #00ffcc";
        }
        console.log("%c✨ QYDYR: Незримый хранитель в сети. Связь установлена.", "color: #00ffcc; font-style: italic; font-size: 13px;");
    };
    
    telemetryStream.onmessage = (event) => {
        try {
            const response = JSON.parse(event.data);
            const statusIndicator = document.getElementById('status-val');
            if (statusIndicator && response.status) {
                statusIndicator.innerText = response.status;
            }
        } catch(e) {}
    };
}

// ФУНКЦИЯ ГЕНЕРАЦИИ СФИРАЛИ ПО ФОРМУЛЕ (АВТОНОМНЫЙ РЕЖИМ)
function generateSfiralCore() {
    const points = [];
    const totalPoints = 12000; 
    const resonanceStep = 372.72; // Твой золотой коэффициент из GIDEON
    
    for (let i = 0; i < totalPoints; i++) {
        const t = (i / totalPoints) * Math.PI * 40;
        const section = Math.floor((i / totalPoints) * 4); // Разделение на 4 сегмента
        
        let x, y, z;
        const radius = t * 0.05;

        if (section === 0) { // 1. Левый виток
            x = Math.cos(t) * radius;
            y = Math.sin(t) * radius;
            z = t * 0.1;
        } else if (section === 1 || section === 2) { // 2 и 3. S-образные переходы
            x = Math.cos(t) * radius * Math.sin(t * 0.1);
            y = Math.sin(t) * radius;
            z = (t * 0.1) + (Math.sin(t * 0.5) * resonanceStep * 0.002);
        } else { // 4. Правый виток (инверсия)
            x = Math.cos(-t) * radius;
            y = Math.sin(-t) * radius;
            z = t * 0.1;
        }
        points.push(x, y, z);
    }
    return { data: new Float32Array(points), shape: [totalPoints, 3] };
}

async function loadProtectedCore() {
    try {
        console.log("⚡ QYDYR: Синтез автономного ядра...");
        // Мы больше не загружаем файл, а генерируем его "на лету"
        masterData = generateSfiralCore();
        console.log("✅ Ядро Сфирали сформировано математически.");
    } catch (e) {
        console.error("Ошибка синтеза:", e);
    }
}

function init3D() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    const ambientLight = new THREE.AmbientLight(0x404040, 2);
    scene.add(ambientLight);

    camera.position.z = 50;
    scene.add(currentGroup);
    
    vCanvas = document.createElement('canvas');
    vCtx = vCanvas.getContext('2d');
    
    initAnalyticsSystem();
}

function build3DCore(useAxis = false) {
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
            varying vec3 vPos;
            void main() {
                vPos = position;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                gl_PointSize = 2.1;
            }
        `,
        fragmentShader: `
            uniform float uTime;
            uniform float uCharge;
            varying vec3 vPos;
            void main() {
                float intensity = sin(vPos.z * 0.1 + uTime) * 0.5 + 0.5;
                vec3 color = mix(vec3(0.0, 0.5, 0.8), vec3(0.0, 1.0, 0.8), uCharge);
                gl_FragColor = vec4(color * intensity, 1.0);
            }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending
    });

    for (let i = 0; i < window.GIDEON_COUNT; i++) {
        const mesh = new THREE.Points(geometry, material);
        const angle = (i / window.GIDEON_COUNT) * Math.PI * 2;
        
        if (window.GIDEON_AXIS === 'Y') {
            mesh.rotation.y = angle;
        } else {
            mesh.rotation.x = angle;
        }
        currentGroup.add(mesh);
    }
}

function animate() {
    requestAnimationFrame(animate);
    frameCounter++;

    if (window.gVideo && window.gVideo.readyState === window.gVideo.HAVE_ENOUGH_DATA) {
        if (vCanvas.width !== window.gVideo.videoWidth) {
            vCanvas.width = 160; vCanvas.height = 120;
        }
        vCtx.drawImage(window.gVideo, 0, 0, vCanvas.width, vCanvas.height);
        const bright = vCtx.getImageData(80, 60, 1, 1).data[0] / 255;
        smoothResonance = (smoothResonance * 0.95) + (bright * 0.05);

        // Обновление UI
        const coh = document.getElementById('coh-val');
        const chg = document.getElementById('charge-val');
        const bar = document.getElementById('core-charge');
        
        if (coh) coh.innerText = smoothResonance.toFixed(4);
        if (chg) chg.innerText = (smoothResonance * 100).toFixed(0) + "%";
        if (bar) bar.style.width = (smoothResonance * 100) + "%";

        currentGroup.children.forEach(child => {
            if(child.material.uniforms) {
                child.material.uniforms.uTime.value = Date.now() * 0.002;
                child.material.uniforms.uCharge.value = smoothResonance;
            }
        });

        if (frameCounter % 10 === 0 && telemetryStream && telemetryStream.readyState === 1) {
            telemetryStream.send(JSON.stringify({ telemetry: [smoothResonance] }));
        }
    }

    controls.update();
    currentGroup.rotation.y += 0.002;
    renderer.render(scene, camera);
}

// Запуск системы
init3D();
loadProtectedCore().then(() => {
    build3DCore();
    animate();
});

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});