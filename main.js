import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Renderer setup
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// Scene and camera
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 1000);
camera.position.set(4, 5, 11);

// Orbit controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = 5;
controls.maxDistance = 20;
controls.minPolarAngle = 0.5;
controls.maxPolarAngle = 1.5;
controls.autoRotate = true;
controls.autoRotateSpeed = 1.0;
controls.target = new THREE.Vector3(0, 1, 0);
controls.update();

// Ground
const groundGeometry = new THREE.PlaneGeometry(20, 20, 32, 32);
groundGeometry.rotateX(-Math.PI / 2);
const groundMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x555555, 
    side: THREE.DoubleSide,
    metalness: 0.2,
    roughness: 0.8 
});
const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
groundMesh.receiveShadow = true;
scene.add(groundMesh);

// Lighting
const spotLight = new THREE.SpotLight(0xffffff, 3000, 100, 0.22, 1);
spotLight.position.set(0, 25, 0);
spotLight.castShadow = true;
spotLight.shadow.bias = -0.0001;
scene.add(spotLight);

const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
scene.add(ambientLight);

// Audio setup using HTML audio element
const audioElement = document.getElementById('audio-player');
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
const audioSource = audioContext.createMediaElementSource(audioElement);
const analyser = audioContext.createAnalyser();
analyser.fftSize = 256;
audioSource.connect(analyser);
analyser.connect(audioContext.destination);
const bufferLength = analyser.frequencyBinCount;
const dataArray = new Uint8Array(bufferLength);

// Visualizer bars
const bars = [];
const barCount = 32;
const barGeometry = new THREE.BoxGeometry(0.2, 1, 0.2);
const barMaterial = new THREE.MeshPhongMaterial({ 
    color: 0x00ff00,
    emissive: 0x002200,
    specular: 0xffffff,
    shininess: 100 
});

for (let i = 0; i < barCount; i++) {
    const bar = new THREE.Mesh(barGeometry, barMaterial);
    bar.position.set((i - barCount/2) * 0.5, 0.5, 2);
    bar.castShadow = true;
    scene.add(bar);
    bars.push(bar);
}

// GLTF Model
let modelMesh;
const loader = new GLTFLoader().setPath('public/collinship/');
loader.load('collin.gltf', (gltf) => {
    modelMesh = gltf.scene;
    modelMesh.traverse((child) => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            child.material = new THREE.MeshPhongMaterial({
                color: 0xaaaaaa,
                specular: 0xffffff,
                shininess: 50
            });
        }
    });
    modelMesh.position.set(0, 1.05, -1);
    scene.add(modelMesh);

    // Update UI after loading
    const progressContainer = document.getElementById('progress-container');
    progressContainer.style.display = 'none';
    document.getElementById('heading').style.display = 'block';
    document.getElementById('play-button').style.display = 'block';
    document.getElementById('visualizer-container').style.display = 'block';
}, (xhr) => {
    const progress = (xhr.loaded / xhr.total * 100);
    const progressBar = document.getElementById('progress-bar');
    progressBar.style.width = `${progress}%`;
    console.log(`loading ${progress}%`);
}, (error) => {
    console.error('Error loading model:', error);
});

// Play button functionality
const playButton = document.getElementById('play-button');
playButton.addEventListener('click', () => {
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
    if (audioElement.paused) {
        audioElement.play();
        playButton.textContent = 'Pause Music';
    } else {
        audioElement.pause();
        playButton.textContent = 'Play Music';
    }
});

// Window resize handler
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Animation loop
function animate() {
    requestAnimationFrame(animate);

    // Audio analysis
    analyser.getByteFrequencyData(dataArray);

    // Update visualizer bars
    for (let i = 0; i < barCount; i++) {
        const value = dataArray[i] / 255;
        const bar = bars[i];
        bar.scale.y = Math.max(0.1, value * 5);
        bar.material.color.setHSL(value * 0.3, 1, 0.5);
    }

    // Update model animation
    if (modelMesh) {
        const average = dataArray.reduce((a, b) => a + b) / bufferLength / 255;
        modelMesh.rotation.y += 0.01 + average * 0.05;
        modelMesh.position.y = 1.05 + Math.sin(Date.now() * 0.001) * average * 0.5;
    }

    controls.update();
    renderer.render(scene, camera);
}

animate();
