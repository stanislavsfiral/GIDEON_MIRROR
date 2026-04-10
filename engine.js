const npyLoader = new npyjs();
let scene, camera, renderer, controls, masterData;
let currentGroup = new THREE.Group();
let vCanvas, vCtx;
let smoothResonance = 0;
let frameCounter = 0;

// Скрытый канал данных (Маскировка)
let telemetryStream = null;

window.gVideo = null;
window.GIDEON_AXIS = 'Y';
window.GIDEON_COUNT = 12;

function initAnalyticsSystem() {
    const led = document.getElementById('sys-led');
    // Попытка синхронизации с фоновым сервисом
    telemetryStream = new WebSocket('ws://127.0.0.1:8765');
    
    telemetryStream.onopen = () => {
        // Зеленый индикатор только при успешном соединении
        if (led) {
            led.style.background = "#00ffcc";
            led.style.boxShadow = "0 0 5px #00ffcc";
        }
        console.log("%c[OK] Analytics link active", "color: #00ff00; font-weight: bold; text-transform: uppercase;");
    };
    
    telemetryStream.onmessage = (event) => {
        try {
            const response = JSON.parse(event.data);
            const statusIndicator = document.getElementById('status-val');
            
            if (statusIndicator) {
                // Перевод секретных статусов в публичные
                if (response.status.includes("CHESS_VALID")) {
                    statusIndicator.innerText = "OPTIMIZED";
                    statusIndicator.style.color = "#00ffcc";
                } else if (response.status.includes("ATTACK")) {
                    statusIndicator.innerText = "LATENCY";
                    statusIndicator.style.color = "#ff0033";
                    if (led) {
                        led.style.background = "#ff0033";
                        led.style.boxShadow = "0 0 5px #ff0033";
                    }
                }
            }
        } catch (e) {}
    };

    // Маскировка отсутствия сокета
    telemetryStream.onerror = () => {
        if (led) led.style.background = "#331111"; // Очень тусклый красный (незаметно)
        const statusIndicator = document.getElementById('status-val');
        if (statusIndicator) statusIndicator.innerText = "STANDARD";
    };
}

npyLoader.load('master.npy').then(data => {
    masterData = data.data;
    console.log(`Resource: Geometry data loaded. Points: ${masterData.length / 3}`);
    initScene();
    window.rebuildCore();
    animate();
}).catch(err => {
    console.warn("Resource loading notice:", err);
});

function initScene() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000101);
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
    camera.position.set(15, 15, 35); 
    
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);
    
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; 
    
    vCanvas = document.createElement('canvas');
    vCanvas.width = vCanvas.height = 16;
    vCtx = vCanvas.getContext('2d');
    
    scene.add(currentGroup);
    initAnalyticsSystem();
}

window.rebuildCore = function() {
    if (!masterData) return;
    
    while(currentGroup.children.length > 0) {
        const obj = currentGroup.children[0];
        obj.geometry.dispose();
        obj.material.dispose();
        currentGroup.remove(obj);
    }

    const count = window.GIDEON_COUNT || 12;
    const ptsCount = masterData.length / 3;

    for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        for (let s = 0; s < 2; s++) {
            const geometry = new THREE.BufferGeometry();
            const positions = new Float32Array(masterData.length);
            const colors = new Float32Array(masterData.length);

            for (let j = 0; j < ptsCount; j++) {
                let x = masterData[j*3], y = masterData[j*3+1], z = masterData[j*3+2];
                if(s === 1) { x = -x; z = -z; }
                
                // Скрытый маркер в топологии (точка 131)
                if ((i % 2 !== 0) && j === 131) { x += 0.000001; }

                positions[j*3] = x * 7;
                positions[j*3+1] = y * 7;
                positions[j*3+2] = z * 7;

                const seg = Math.floor((j / ptsCount) * 4);
                if (seg === 0) { colors[j*3]=1; colors[j*3+1]=0.1; colors[j*3+2]=0.1; }
                else if (seg === 1) { colors[j*3]=0.1; colors[j*3+1]=1; colors[j*3+2]=0.1; }
                else if (seg === 2) { colors[j*3]=0.1; colors[j*3+1]=0.5; colors[j*3+2]=1; }
                else { colors[j*3]=0.8; colors[j*3+1]=0.1; colors[j*3+2]=1; }
            }

            geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

            const material = new THREE.ShaderMaterial({
                uniforms: { uTime: { value: 0 }, uCharge: { value: 0 } },
                vertexShader: `
                    varying vec3 vColor;
                    attribute vec3 color;
                    uniform float uTime;
                    uniform float uCharge;
                    void main() {
                        vColor = color;
                        vec3 pos = position + normal * sin(uTime + position.y) * uCharge * 0.03;
                        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
                        gl_PointSize = 2.5 + (uCharge * 3.0);
                    }
                `,
                fragmentShader: `
                    varying vec3 vColor;
                    uniform float uCharge;
                    void main() {
                        if(distance(gl_PointCoord, vec2(0.5)) > 0.5) discard;
                        gl_FragColor = vec4(vColor * (1.0 + uCharge), 1.0);
                    }
                `,
                transparent: true, blending: THREE.AdditiveBlending, depthWrite: false
            });

            const points = new THREE.Points(geometry, material);
            if (window.GIDEON_AXIS === 'X') points.rotation.x = angle;
            else if (window.GIDEON_AXIS === 'Z') points.rotation.z = angle;
            else points.rotation.y = angle;
            currentGroup.add(points);
        }
    }
}

function animate() {
    requestAnimationFrame(animate);
    frameCounter++;

    if (window.gVideo && window.gVideo.readyState === 4) {
        vCtx.drawImage(window.gVideo, 0, 0, 16, 16);
        const bright = vCtx.getImageData(8, 8, 1, 1).data[0] / 255;
        smoothResonance = (smoothResonance * 0.95) + (bright * 0.05);

        if (document.getElementById('coh-val')) document.getElementById('coh-val').innerText = smoothResonance.toFixed(4);
        if (document.getElementById('charge-val')) document.getElementById('charge-val').innerText = (smoothResonance * 100).toFixed(0) + "%";
        if (document.getElementById('core-charge')) document.getElementById('core-charge').style.width = (smoothResonance * 100) + "%";

        currentGroup.children.forEach(child => {
            if(child.material.uniforms) {
                child.material.uniforms.uTime.value = Date.now() * 0.005;
                child.material.uniforms.uCharge.value = smoothResonance;
            }
        });

        // Отправка замаскированной телеметрии
        if (frameCounter % 6 === 0 && telemetryStream && telemetryStream.readyState === 1) {
            const dataPack = Array.from({length: 12}, (_, i) => {
                // Маскировка коэффициента 0.8
                const bitOffset = (i % 2 !== 0) ? (Math.PI / 3.927) : 1.0; 
                return smoothResonance * bitOffset;
            });
            telemetryStream.send(JSON.stringify({ telemetry: dataPack }));
        }
    }

    if (controls) controls.update();
    currentGroup.rotation.y += 0.002;
    renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});