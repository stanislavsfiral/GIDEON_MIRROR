const npyLoader = new npyjs();
let scene, camera, renderer, controls, masterData;
let currentGroup = new THREE.Group();
let vCanvas, vCtx;
let smoothResonance = 0.5;
let telemetryStream = null;

window.gVideo = null;
window.GIDEON_AXIS = 'Y';
window.GIDEON_COUNT = 12;

function initAnalyticsSystem() {
    const led = document.getElementById('sys-led');
    telemetryStream = new WebSocket('ws://127.0.0.1:8765');
    telemetryStream.onopen = () => {
        if (led) { led.style.background = "#00ffcc"; led.style.boxShadow = "0 0 10px #00ffcc"; }
    };
}

async function loadProtectedCore() {
    try {
        const data = await npyLoader.load('master.npy');
        masterData = data.data;
        build3DCore();
    } catch (e) {
        console.error("Master DNA missing");
    }
}

function createSfiral(data, ry, rx, rz) {
    const group = new THREE.Group();
    const colors = [0x00ffff, 0xff00ff, 0xffff00, 0x00ff00];

    for (let s = 0; s < 4; s++) {
        const geo = new THREE.BufferGeometry();
        const start = s * 66 * 3;
        const end = (s + 1) * 66 * 3;
        geo.setAttribute('position', new THREE.BufferAttribute(data.slice(start, end), 3));
        
        const mat = new THREE.ShaderMaterial({
            uniforms: { 
                uTime: { value: 0 }, 
                uCharge: { value: 0.5 }, 
                uColor: { value: new THREE.Color(colors[s]) } 
            },
            vertexShader: `
                uniform float uCharge;
                varying vec3 vPos;
                void main() {
                    vPos = position;
                    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
                    gl_Position = projectionMatrix * mvPos;
                    gl_PointSize = (3.5 + uCharge * 5.0) * (300.0 / -mvPos.z);
                }
            `,
            fragmentShader: `
                uniform vec3 uColor;
                uniform float uCharge;
                void main() {
                    // Стабильное свечение: базовые 0.4 + динамика резонанса
                    float br = 0.4 + uCharge * 0.6;
                    gl_FragColor = vec4(uColor * br, 0.9);
                }
            `,
            transparent: true, blending: THREE.AdditiveBlending, depthWrite: false
        });
        group.add(new THREE.Points(geo, mat));
    }
    group.rotation.set(rx, ry, rz);
    return group;
}

function build3DCore() {
    if (!masterData) return;
    currentGroup.clear();
    const step = (Math.PI * 2) / window.GIDEON_COUNT;
    for (let i = 0; i < window.GIDEON_COUNT; i++) {
        const angle = i * step;
        currentGroup.add(createSfiral(masterData, angle, 0, 0));
        currentGroup.add(createSfiral(masterData, angle + Math.PI, 0, Math.PI));
    }
}

function init3D() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 10000);
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);
    
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    camera.position.set(0, 0, 300);
    scene.add(currentGroup);
    
    vCanvas = document.createElement('canvas');
    vCanvas.width = 16; vCanvas.height = 16;
    vCtx = vCanvas.getContext('2d', { willReadFrequently: true });
}

function animate() {
    requestAnimationFrame(animate);
    if (window.gVideo && window.gVideo.readyState === 4) {
        vCtx.drawImage(window.gVideo, 0, 0, 16, 16);
        const br = vCtx.getImageData(8, 8, 1, 1).data[0] / 255;
        smoothResonance = (smoothResonance * 0.9) + (br * 0.1);
        
        document.getElementById('coh-val').innerText = smoothResonance.toFixed(4);
        document.getElementById('charge-val').innerText = Math.round(smoothResonance * 100) + "%";
        document.getElementById('core-charge').style.width = (smoothResonance * 100) + "%";
    }

    currentGroup.children.forEach(dipole => {
        dipole.children.forEach(sfiral => {
            sfiral.children.forEach(segment => {
                segment.material.uniforms.uCharge.value = smoothResonance;
            });
        });
    });

    currentGroup.rotation.y += 0.002;
    controls.update();
    renderer.render(scene, camera);
}

window.rebuildCore = build3DCore;
init3D();
initAnalyticsSystem();
loadProtectedCore().then(animate);