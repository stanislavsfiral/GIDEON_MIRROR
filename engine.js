// ... (начало файла с аналитикой и генерацией Master Сфирали остается прежним)

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
                gl_PointSize = (2.5 + uCharge * 3.0) * (200.0 / -mvPosition.z);
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

    // ЛОГИКА РАСПРЕДЕЛЕНИЯ ДИПОЛЕЙ (360 / n)
    // Допустим, GIDEON_COUNT — это количество ДИПОЛЕЙ
    const dipoleCount = window.GIDEON_COUNT; 
    const stepAngle = (Math.PI * 2) / dipoleCount;

    for (let i = 0; i < dipoleCount; i++) {
        const rotationAngle = i * stepAngle;

        // Создаем группу для одного диполя
        const dipolePair = new THREE.Group();

        // 1. ПЕРВАЯ СФИРАЛЬ ДИПОЛЯ
        const sfiralA = new THREE.Points(geometry, material);
        dipolePair.add(sfiralA);

        // 2. ВТОРАЯ СФИРАЛЬ ДИПОЛЯ (Разворот на 180 градусов относительно первой)
        const sfiralB = new THREE.Points(geometry, material);
        sfiralB.rotation.y = Math.PI; // Поворот вокруг оси Y на 180
        sfiralB.rotation.z = Math.PI; // Зеркальная антисимметрия (верх-низ)
        dipolePair.add(sfiralB);

        // Поворачиваем весь диполь на нужный угол в общем контуре
        dipolePair.rotation.y = rotationAngle;
        
        currentGroup.add(dipolePair);
    }
}

// ... (остальной код animate и init)