"use client"

import * as THREE from "three"
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js"
import { OrbitControls } from "three/addons/controls/OrbitControls.js"
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js"
import { RenderPass } from "three/addons/postprocessing/RenderPass.js"
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js"
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js"
import { RGBShiftShader } from "three/addons/shaders/RGBShiftShader.js"
import { useEffect, useRef } from "react"

// Mobile detection
function isMobileDevice() {
  return (
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    window.innerWidth <= 768
  )
}

export default function AudioVisualizer() {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const visualizerCanvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!containerRef.current || !canvasRef.current || !visualizerCanvasRef.current) return

    // Scene variables
    let composer: EffectComposer | null = null,
      spaceship: THREE.Group | null = null,
      starField: THREE.Points | null = null,
      floatingCrystals: THREE.Mesh[] = [],
      ring: THREE.Group | null = null,
      thrusterParticles: THREE.Points | null = null,
      burstParticles: THREE.Points | null = null,
      energyWaves: any[] = [],
      visualizerBars: THREE.Mesh[] = [],
      lightningEffects: any[] = [],
      skybox: THREE.Mesh | null = null,
      asteroidBelts: any[] = [],
      wormholes: any[] = [],
      soundWavePlane: THREE.Mesh | null = null

    let mouseX = 0,
      mouseY = 0
    const clock = new THREE.Clock()

    // Audio variables
    let audioContext: AudioContext | null = null,
      audioAnalyser: AnalyserNode | null = null,
      audioSource: MediaElementAudioSourceNode | null = null
    let audioData: Float32Array | null = null,
      bassData: Float32Array | null = null,
      midData: Float32Array | null = null,
      trebleData: Float32Array | null = null
    let isPlaying = false
    let visualizerContext: CanvasRenderingContext2D | null = null
    let lastBeatTime = 0
    const beatThreshold = 0.5
    let beatDetected = false

    // Detect if we're on mobile
    const isMobile = isMobileDevice()

    // Adjust quality settings based on device
    const qualitySettings = {
      pixelRatio: isMobile ? 0.5 : Math.min(window.devicePixelRatio, 1.5),
      starCount: isMobile ? 2000 : 10000,
      crystalCount: isMobile ? 5 : 15,
      visualizerBarCount: isMobile ? 32 : 64,
      usePostProcessing: !isMobile,
      useComplexShaders: !isMobile,
      asteroidBeltCount: isMobile ? 1 : 3,
      wormholeCount: isMobile ? 1 : 3,
      useSoundWavePlane: !isMobile,
    }

    // Renderer setup with optimized settings
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: !isMobile,
      powerPreference: "high-performance",
    })
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.setClearColor(0x000000)
    renderer.setPixelRatio(qualitySettings.pixelRatio)
    renderer.shadowMap.enabled = !isMobile
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.8

    // Scene setup
    const scene = new THREE.Scene()
    scene.fog = new THREE.FogExp2(0x000000, 0.002)

    // Camera setup
    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 1000)
    camera.position.set(4, 5, 11)

    // Orbit Controls
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.05
    controls.enablePan = false
    controls.minDistance = 5
    controls.maxDistance = 20
    controls.minPolarAngle = 0.5
    controls.maxPolarAngle = 1.5
    controls.autoRotate = false
    controls.target = new THREE.Vector3(0, 1, 0)
    controls.update()

    // Audio setup
    function setupAudio() {
      const audioElement = document.getElementById("audio-player") as HTMLAudioElement
      if (!audioElement) {
        console.error("Audio element not found")
        return
      }

      // Create audio context
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()

      // Create analyser
      audioAnalyser = audioContext.createAnalyser()
      audioAnalyser.fftSize = isMobile ? 512 : 2048 // Lower FFT size on mobile
      audioAnalyser.smoothingTimeConstant = 0.85

      // Connect audio element to analyser
      audioSource = audioContext.createMediaElementSource(audioElement)
      audioSource.connect(audioAnalyser)
      audioAnalyser.connect(audioContext.destination)

      // Create data arrays
      const bufferLength = audioAnalyser.frequencyBinCount
      audioData = new Float32Array(bufferLength)

      // Create frequency band arrays (bass, mid, treble)
      const bandSize = Math.floor(bufferLength / 3)
      bassData = new Float32Array(bandSize)
      midData = new Float32Array(bandSize)
      trebleData = new Float32Array(bandSize)

      // Setup play button
      const playButton = document.getElementById("play-button")
      if (playButton) {
        playButton.style.display = "block"
        playButton.addEventListener("click", toggleAudio)
      }

      // Setup visualizer
      setupVisualizer()
    }

    function toggleAudio() {
      const audioElement = document.getElementById("audio-player") as HTMLAudioElement
      const playButton = document.getElementById("play-button")

      if (!audioElement || !playButton) return

      if (audioContext?.state === "suspended") {
        audioContext.resume()
      }

      if (isPlaying) {
        audioElement.pause()
        playButton.textContent = "Play Music"
        isPlaying = false
      } else {
        audioElement.play()
        playButton.textContent = "Pause Music"
        isPlaying = true

        // Show heading when music starts
        const heading = document.getElementById("heading")
        if (heading) {
          heading.style.opacity = "0"
          heading.style.transform = "translateY(-20px)"
          heading.style.display = "block"

          setTimeout(() => {
            heading.style.transition = "opacity 1s ease, transform 1s ease"
            heading.style.opacity = "1"
            heading.style.transform = "translateY(0)"
          }, 100)
        }

        // Show visualizer
        const visualizerContainer = document.getElementById("visualizer-container")
        if (visualizerContainer) {
          visualizerContainer.style.display = "block"
        }
      }
    }

    function setupVisualizer() {
      const visualizerCanvas = visualizerCanvasRef.current
      if (!visualizerCanvas) return

      visualizerContext = visualizerCanvas.getContext("2d")

      // Set canvas dimensions
      visualizerCanvas.width = visualizerCanvas.clientWidth
      visualizerCanvas.height = visualizerCanvas.clientHeight
    }

    function updateAudioData() {
      if (!audioAnalyser || !isPlaying) return

      // Initialize arrays if they don't exist
      if (!audioData) audioData = new Float32Array(audioAnalyser.frequencyBinCount)
      if (!bassData) bassData = new Float32Array(Math.floor(audioAnalyser.frequencyBinCount / 3))
      if (!midData) midData = new Float32Array(Math.floor(audioAnalyser.frequencyBinCount / 3))
      if (!trebleData) trebleData = new Float32Array(Math.floor(audioAnalyser.frequencyBinCount / 3))

      // Get frequency data
      audioAnalyser.getFloatFrequencyData(audioData)

      // Normalize the data to a range of 0-1 (from dB scale)
      for (let i = 0; i < audioData.length; i++) {
        // Convert from dB (-100 to 0 typical range) to 0-1
        audioData[i] = (audioData[i] + 100) / 100

        // Clamp values
        if (audioData[i] < 0) audioData[i] = 0
        if (audioData[i] > 1) audioData[i] = 1
      }

      // Split into frequency bands
      const bandSize = Math.floor(audioData.length / 3)

      // Bass (low frequencies)
      for (let i = 0; i < bandSize && i < bassData.length; i++) {
        bassData[i] = audioData[i]
      }

      // Mids (mid frequencies)
      for (let i = 0; i < bandSize && i < midData.length; i++) {
        midData[i] = audioData[i + bandSize]
      }

      // Treble (high frequencies)
      for (let i = 0; i < bandSize && i < trebleData.length; i++) {
        trebleData[i] = audioData[i + bandSize * 2]
      }

      // Beat detection
      const bassAvg = getAverageFrequency(bassData)
      const currentTime = clock.getElapsedTime()

      if (bassAvg > beatThreshold && currentTime - lastBeatTime > 0.3) {
        beatDetected = true
        lastBeatTime = currentTime

        // Create lightning effect on beat (only on non-mobile)
        if (!isMobile) {
          createLightningEffect()
          pulseWormholes()
        }
      } else {
        beatDetected = false
      }

      // Draw visualizer
      drawVisualizer()
    }

    function drawVisualizer() {
      if (!visualizerContext || !visualizerCanvasRef.current) return

      const width = visualizerCanvasRef.current.width
      const height = visualizerCanvasRef.current.height

      // Clear canvas
      visualizerContext.clearRect(0, 0, width, height)

      // Draw background
      visualizerContext.fillStyle = "rgba(0, 0, 0, 0.2)"
      visualizerContext.fillRect(0, 0, width, height)

      // Draw frequency bars
      if (!audioData) return

      // Reduce the number of bars on mobile
      const barCount = isMobile ? Math.min(64, audioData.length) : audioData.length
      const barWidth = width / barCount

      for (let i = 0; i < barCount; i++) {
        const dataIndex = Math.floor((i / barCount) * audioData.length)
        const barHeight = audioData[dataIndex] * height

        // Determine color based on frequency range
        let hue
        if (i < barCount / 3) {
          // Bass - red to orange
          hue = 0 + (i / (barCount / 3)) * 30
        } else if (i < (barCount * 2) / 3) {
          // Mid - yellow to green
          hue = 30 + ((i - barCount / 3) / (barCount / 3)) * 90
        } else {
          // Treble - cyan to blue
          hue = 180 + ((i - (barCount * 2) / 3) / (barCount / 3)) * 60
        }

        visualizerContext.fillStyle = `hsl(${hue}, 80%, 50%)`
        visualizerContext.fillRect(i * barWidth, height - barHeight, barWidth, barHeight)
      }
    }

    function getAverageFrequency(dataArray: Float32Array | null) {
      if (!dataArray || dataArray.length === 0) return 0

      let sum = 0
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i]
      }
      return sum / dataArray.length
    }

    // Create Skybox - simplified for mobile
    function createSkybox() {
      const geometry = new THREE.BoxGeometry(500, 500, 500)
      const materialArray = []

      const textureLoader = new THREE.TextureLoader()
      const texture = textureLoader.load("/placeholder.svg?height=1024&width=1024")

      for (let i = 0; i < 6; i++) {
        const material = new THREE.MeshBasicMaterial({
          map: texture,
          side: THREE.BackSide,
          transparent: true,
          opacity: 0.3,
          color: 0x000000,
        })
        materialArray.push(material)
      }

      const skyboxMesh = new THREE.Mesh(geometry, materialArray)
      scene.add(skyboxMesh)
      return skyboxMesh
    }

    // Optimized Moving Starfield
    function createStarField(count = qualitySettings.starCount) {
      const geometry = new THREE.BufferGeometry()
      const positions = new Float32Array(count * 3)
      const colors = new Float32Array(count * 3)
      const sizes = new Float32Array(count)
      const velocities = new Float32Array(count * 3)

      for (let i = 0; i < count; i++) {
        const radius = 50 + Math.random() * 150
        const theta = Math.random() * Math.PI * 2
        const phi = Math.random() * Math.PI

        positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta)
        positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta)
        positions[i * 3 + 2] = radius * Math.cos(phi)

        let r, g, b
        const colorType = Math.random()

        if (colorType < 0.25) {
          r = 0.5 + Math.random() * 0.2
          g = 0.7 + Math.random() * 0.3
          b = 0.9 + Math.random() * 0.1
        } else if (colorType < 0.5) {
          r = 0.9 + Math.random() * 0.1
          g = 0.9 + Math.random() * 0.1
          b = 0.9 + Math.random() * 0.1
        } else if (colorType < 0.75) {
          r = 0.9 + Math.random() * 0.1
          g = 0.9 + Math.random() * 0.1
          b = 0.5 + Math.random() * 0.2
        } else {
          r = 0.9 + Math.random() * 0.1
          g = 0.5 + Math.random() * 0.2
          b = 0.5 + Math.random() * 0.2
        }

        colors[i * 3] = r
        colors[i * 3 + 1] = g
        colors[i * 3 + 2] = b

        sizes[i] = Math.random() < 0.1 ? Math.random() * 4 + 2 : Math.random() * 2 + 1

        velocities[i * 3] = (Math.random() - 0.5) * 0.03
        velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.03
        velocities[i * 3 + 2] = -Math.random() * 0.1 - 0.05
      }

      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3))
      geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3))
      geometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1))
      geometry.setAttribute("velocity", new THREE.BufferAttribute(velocities, 3))

      // Simplified shader for mobile
      const starMaterial = new THREE.ShaderMaterial({
        uniforms: {
          time: { value: 0 },
          pixelRatio: { value: renderer.getPixelRatio() },
          audioIntensity: { value: 0 },
        },
        vertexShader: `
          attribute float size;
          attribute vec3 color;
          attribute vec3 velocity;
          uniform float time;
          uniform float pixelRatio;
          uniform float audioIntensity;
          varying vec3 vColor;
          
          void main() {
            vColor = color;
            
            // Simplified pulse effect for mobile
            float pulse = sin(time * 0.3) * 0.5 + 0.5;
            gl_PointSize = size * pixelRatio * (1.0 + audioIntensity);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          varying vec3 vColor;
          
          void main() {
            float distanceToCenter = length(gl_PointCoord - vec2(0.5));
            float strength = 1.0 - smoothstep(0.0, 0.5, distanceToCenter);
            gl_FragColor = vec4(vColor, strength);
          }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })

      const stars = new THREE.Points(geometry, starMaterial)
      scene.add(stars)
      return stars
    }

    // Create 3D Visualizer Bars - reduced count for mobile
    function createVisualizerBars() {
      const bars = []
      const barCount = qualitySettings.visualizerBarCount
      const barWidth = 0.2
      const barDepth = 0.2
      const spacing = 0.3

      for (let i = 0; i < barCount; i++) {
        const geometry = new THREE.BoxGeometry(barWidth, 0.1, barDepth)

        // Calculate hue based on position
        const hue = (i / barCount) * 360
        const color = new THREE.Color().setHSL(hue / 360, 0.8, 0.5)

        // Use standard material for mobile
        const material = isMobile
          ? new THREE.MeshBasicMaterial({
              color: color,
              transparent: true,
              opacity: 0.8,
            })
          : new THREE.MeshPhongMaterial({
              color: color,
              emissive: color.clone().multiplyScalar(0.3),
              shininess: 100,
              transparent: true,
              opacity: 0.8,
            })

        const bar = new THREE.Mesh(geometry, material)

        // Position bars in a circle
        const angle = (i / barCount) * Math.PI * 2
        const radius = 12
        bar.position.x = Math.sin(angle) * radius
        bar.position.z = Math.cos(angle) * radius
        bar.position.y = 0

        // Rotate bars to face center
        bar.lookAt(new THREE.Vector3(0, 0, 0))

        scene.add(bar)
        bars.push(bar)
      }

      return bars
    }

    // Create Energy Waves - skip on mobile
    function createEnergyWaves() {
      if (isMobile) return []

      const waves = []
      const waveCount = 5

      for (let i = 0; i < waveCount; i++) {
        const geometry = new THREE.TorusGeometry(2 + i * 0.5, 0.05, 16, 100)
        const material = new THREE.MeshPhongMaterial({
          color: new THREE.Color().setHSL(i / waveCount, 0.8, 0.5),
          emissive: new THREE.Color().setHSL(i / waveCount, 0.9, 0.3),
          transparent: true,
          opacity: 0.7,
          side: THREE.DoubleSide,
        })

        const wave = new THREE.Mesh(geometry, material)
        wave.rotation.x = Math.PI / 2
        wave.position.y = 0.1
        wave.scale.set(0.1, 0.1, 0.1)
        wave.visible = false

        scene.add(wave)
        waves.push({
          mesh: wave,
          initialScale: 0.1,
          maxScale: 5 + i,
          speed: 0.5 + i * 0.1,
          active: false,
          progress: 0,
        })
      }

      return waves
    }

    // Create Lightning Effect - skip on mobile
    function createLightningEffect() {
      if (isMobile || !isPlaying) return

      const points = []
      const segmentCount = 10
      const maxOffset = 2

      // Create a zigzag path
      for (let i = 0; i <= segmentCount; i++) {
        const t = i / segmentCount
        const x = (Math.random() - 0.5) * maxOffset * (1 - t)
        const y = 10 - t * 20
        const z = (Math.random() - 0.5) * maxOffset * (1 - t)
        points.push(new THREE.Vector3(x, y, z))
      }

      const curve = new THREE.CatmullRomCurve3(points)
      const geometry = new THREE.TubeGeometry(curve, 20, 0.05, 8, false)

      // Random color for the lightning
      const hue = Math.random()
      const color = new THREE.Color().setHSL(hue, 0.8, 0.8)

      const material = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 1,
      })

      const lightning = new THREE.Mesh(geometry, material)
      scene.add(lightning)

      lightningEffects.push({
        mesh: lightning,
        life: 1.0,
        decay: 0.05,
      })
    }

    // Optimized Floating Crystals - reduced count for mobile
    function createFloatingCrystals() {
      const crystals = []
      const count = qualitySettings.crystalCount

      for (let i = 0; i < count; i++) {
        const geometry = new THREE.OctahedronGeometry(Math.random() * 0.5 + 0.2, 0)

        // Simplified material for mobile
        const material = isMobile
          ? new THREE.MeshBasicMaterial({
              color: new THREE.Color().setHSL(Math.random(), 0.8, 0.6),
              transparent: true,
              opacity: 0.8,
            })
          : new THREE.MeshPhysicalMaterial({
              color: new THREE.Color().setHSL(Math.random(), 0.8, 0.6),
              metalness: 0.3,
              roughness: 0.4,
              transmission: 0.6,
              thickness: 0.5,
              emissive: new THREE.Color().setHSL(Math.random(), 0.9, 0.4),
              emissiveIntensity: 0.6,
            })

        const crystal = new THREE.Mesh(geometry, material)

        const radius = 8 + Math.random() * 8
        const theta = Math.random() * Math.PI * 2
        const phi = Math.random() * Math.PI

        crystal.position.set(
          radius * Math.sin(phi) * Math.cos(theta),
          radius * Math.sin(phi) * Math.sin(theta) + 2,
          radius * Math.cos(phi),
        )

        crystal.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI)

        crystal.userData = {
          rotationSpeed: {
            x: (Math.random() - 0.5) * 0.01,
            y: (Math.random() - 0.5) * 0.01,
            z: (Math.random() - 0.5) * 0.01,
          },
          floatSpeed: Math.random() * 0.01 + 0.005,
          floatOffset: Math.random() * Math.PI * 2,
          originalY: crystal.position.y,
          orbitRadius: radius,
          orbitSpeed: Math.random() * 0.0005 + 0.0002,
          orbitOffset: Math.random() * Math.PI * 2,
          orbitCenter: new THREE.Vector3(0, 2, 0),
        }

        crystal.castShadow = !isMobile
        crystal.receiveShadow = !isMobile
        scene.add(crystal)
        crystals.push(crystal)
      }
      return crystals
    }

    // Glowing Ring (static, no rotation)
    function createGlowingRing() {
      const ringGroup = new THREE.Group()

      const ringGeometry = new THREE.TorusGeometry(5, 0.15, 32, 100)
      // Simplified material for mobile
      const ringMaterial = isMobile
        ? new THREE.MeshBasicMaterial({
            color: 0x00aaff,
            transparent: true,
            opacity: 0.8,
          })
        : new THREE.MeshStandardMaterial({
            color: 0x000000,
            emissive: 0x00aaff,
            emissiveIntensity: 5,
            metalness: 0.9,
            roughness: 0.3,
          })

      const ring = new THREE.Mesh(ringGeometry, ringMaterial)
      ring.position.y = 0.1
      ring.rotation.x = Math.PI / 2
      ringGroup.add(ring)

      const innerRingGeometry = new THREE.TorusGeometry(4.7, 0.08, 32, 100)
      // Simplified material for mobile
      const innerRingMaterial = isMobile
        ? new THREE.MeshBasicMaterial({
            color: 0xff5500,
            transparent: true,
            opacity: 0.8,
          })
        : new THREE.MeshStandardMaterial({
            color: 0x000000,
            emissive: 0xff5500,
            emissiveIntensity: 4,
            metalness: 0.9,
            roughness: 0.3,
          })

      const innerRing = new THREE.Mesh(innerRingGeometry, innerRingMaterial)
      innerRing.position.y = 0.1
      innerRing.rotation.x = Math.PI / 2
      ringGroup.add(innerRing)

      // Only add light on non-mobile
      if (!isMobile) {
        const ringLight = new THREE.PointLight(0x00aaff, 5, 10)
        ringLight.position.set(0, 0.1, 0)
        ringGroup.add(ringLight)
      }

      scene.add(ringGroup)
      return ringGroup
    }

    // Create Asteroid Belt - reduced for mobile
    function createAsteroidBelts() {
      const belts = []
      const beltCount = qualitySettings.asteroidBeltCount

      for (let b = 0; b < beltCount; b++) {
        const beltGroup = new THREE.Group()
        // Reduce asteroid count on mobile
        const asteroidCount = isMobile ? 50 : 150 + Math.floor(Math.random() * 100)
        const beltRadius = 25 + b * 15
        const beltThickness = 5 + b * 2
        const beltHeight = 10 + b * 5

        // Create galaxy core for this belt
        const galaxyCoreGeometry = new THREE.SphereGeometry(3 + b * 1.5, 32, 32)
        // Simplified material for mobile
        const galaxyCoreMaterial = isMobile
          ? new THREE.MeshBasicMaterial({
              color: new THREE.Color().setHSL(Math.random(), 0.8, 0.5),
              transparent: true,
              opacity: 0.8,
            })
          : new THREE.MeshPhongMaterial({
              color: 0x000000,
              emissive: new THREE.Color().setHSL(Math.random(), 0.8, 0.5),
              emissiveIntensity: 2,
              transparent: true,
              opacity: 0.8,
            })

        const galaxyCore = new THREE.Mesh(galaxyCoreGeometry, galaxyCoreMaterial)

        // Position the galaxy core randomly in space
        const coreX = (Math.random() - 0.5) * 100
        const coreY = (Math.random() - 0.5) * 60
        const coreZ = (Math.random() - 0.5) * 100

        galaxyCore.position.set(coreX, coreY, coreZ)
        beltGroup.position.copy(galaxyCore.position)
        scene.add(galaxyCore)

        // Create asteroids for this belt
        for (let i = 0; i < asteroidCount; i++) {
          // Randomize asteroid size
          const size = Math.random() * 0.8 + 0.2

          // Create asteroid geometry with random shape
          let asteroidGeometry
          const shapeType = Math.random()

          if (shapeType < 0.5) {
            // Irregular polyhedron
            asteroidGeometry = new THREE.DodecahedronGeometry(size, 0)
          } else if (shapeType < 0.8) {
            // More complex shape
            asteroidGeometry = new THREE.OctahedronGeometry(size, 1)
          } else {
            // Simple shape
            asteroidGeometry = new THREE.TetrahedronGeometry(size, 0)
          }

          // Create material with random color tint - simplified for mobile
          const hue = 0.05 + Math.random() * 0.1 // Brownish/grayish
          const saturation = 0.3 + Math.random() * 0.3
          const lightness = 0.2 + Math.random() * 0.3

          const asteroidMaterial = isMobile
            ? new THREE.MeshBasicMaterial({
                color: new THREE.Color().setHSL(hue, saturation, lightness),
              })
            : new THREE.MeshStandardMaterial({
                color: new THREE.Color().setHSL(hue, saturation, lightness),
                roughness: 0.8 + Math.random() * 0.2,
                metalness: Math.random() * 0.3,
              })

          const asteroid = new THREE.Mesh(asteroidGeometry, asteroidMaterial)

          // Position asteroid in an elliptical orbit
          const angle = Math.random() * Math.PI * 2
          const radiusVariation = (Math.random() - 0.5) * beltThickness
          const heightVariation = (Math.random() - 0.5) * beltHeight

          asteroid.position.x = Math.cos(angle) * (beltRadius + radiusVariation)
          asteroid.position.z = Math.sin(angle) * (beltRadius + radiusVariation)
          asteroid.position.y = heightVariation

          // Random rotation
          asteroid.rotation.x = Math.random() * Math.PI * 2
          asteroid.rotation.y = Math.random() * Math.PI * 2
          asteroid.rotation.z = Math.random() * Math.PI * 2

          // Store orbit data
          asteroid.userData = {
            orbitRadius: beltRadius + radiusVariation,
            orbitSpeed: 0.0001 + Math.random() * 0.0005,
            orbitOffset: angle,
            rotationSpeed: {
              x: (Math.random() - 0.5) * 0.01,
              y: (Math.random() - 0.5) * 0.01,
              z: (Math.random() - 0.5) * 0.01,
            },
          }

          asteroid.castShadow = !isMobile
          asteroid.receiveShadow = !isMobile

          beltGroup.add(asteroid)
        }

        // Add dust particles around the belt - skip or reduce on mobile
        if (!isMobile) {
          const dustCount = isMobile ? 500 : 2000
          const dustGeometry = new THREE.BufferGeometry()
          const dustPositions = new Float32Array(dustCount * 3)
          const dustColors = new Float32Array(dustCount * 3)
          const dustSizes = new Float32Array(dustCount)

          for (let i = 0; i < dustCount; i++) {
            const angle = Math.random() * Math.PI * 2
            const radiusVariation = (Math.random() - 0.5) * beltThickness * 2
            const heightVariation = (Math.random() - 0.5) * beltHeight * 1.5

            dustPositions[i * 3] = Math.cos(angle) * (beltRadius + radiusVariation)
            dustPositions[i * 3 + 1] = heightVariation
            dustPositions[i * 3 + 2] = Math.sin(angle) * (beltRadius + radiusVariation)

            // Dust color based on galaxy core with variation
            const coreColor = galaxyCoreMaterial.color || new THREE.Color(0xffffff)
            const hue = (Math.random() - 0.5) * 0.1 + 0.5
            const saturation = 0.7 + Math.random() * 0.3
            const lightness = 0.5 + Math.random() * 0.3

            const color = new THREE.Color().setHSL(hue, saturation, lightness)

            dustColors[i * 3] = color.r
            dustColors[i * 3 + 1] = color.g
            dustColors[i * 3 + 2] = color.b

            dustSizes[i] = Math.random() * 0.5 + 0.1
          }

          dustGeometry.setAttribute("position", new THREE.BufferAttribute(dustPositions, 3))
          dustGeometry.setAttribute("color", new THREE.BufferAttribute(dustColors, 3))
          dustGeometry.setAttribute("size", new THREE.BufferAttribute(dustSizes, 1))

          const dustMaterial = new THREE.PointsMaterial({
            size: 0.1,
            vertexColors: true,
            transparent: true,
            opacity: 0.6,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          })

          const dustParticles = new THREE.Points(dustGeometry, dustMaterial)
          beltGroup.add(dustParticles)
        }

        // Add belt to scene and store in array
        scene.add(beltGroup)
        belts.push({
          group: beltGroup,
          core: galaxyCore,
          rotationAxis: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(),
          rotationSpeed: Math.random() * 0.0001 + 0.00005,
        })
      }

      return belts
    }

    // Create Wormholes - reduced for mobile
    function createWormholes() {
      const wormholeCount = qualitySettings.wormholeCount
      const wormholes = []

      for (let i = 0; i < wormholeCount; i++) {
        const wormholeGroup = new THREE.Group()

        // Create the wormhole tunnel - simplified for mobile
        const tunnelGeometry = new THREE.TorusGeometry(4, 2, 32, 100)

        // Use simpler material on mobile
        const tunnelMaterial = isMobile
          ? new THREE.MeshBasicMaterial({
              color: new THREE.Color().setHSL(Math.random(), 0.8, 0.5),
              transparent: true,
              opacity: 0.7,
              side: THREE.DoubleSide,
            })
          : new THREE.ShaderMaterial({
              uniforms: {
                time: { value: 0 },
                color1: { value: new THREE.Color().setHSL(Math.random(), 0.8, 0.5) },
                color2: { value: new THREE.Color().setHSL((Math.random() + 0.5) % 1, 0.8, 0.5) },
                pulseIntensity: { value: 0.0 },
              },
              vertexShader: `
                varying vec2 vUv;
                varying vec3 vPosition;
                
                void main() {
                  vUv = uv;
                  vPosition = position;
                  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
              `,
              fragmentShader: `
                uniform float time;
                uniform vec3 color1;
                uniform vec3 color2;
                uniform float pulseIntensity;
                
                varying vec2 vUv;
                varying vec3 vPosition;
                
                void main() {
                  // Create swirling effect
                  float noise = sin(vUv.x * 20.0 + time * 2.0) * 0.5 + 0.5;
                  noise *= sin(vUv.y * 15.0 - time * 3.0) * 0.5 + 0.5;
                  
                  // Add pulse effect
                  float pulse = sin(time * 5.0) * 0.5 + 0.5;
                  pulse = pulse * pulseIntensity + (1.0 - pulseIntensity);
                  
                  // Mix colors based on noise
                  vec3 finalColor = mix(color1, color2, noise);
                  
                  // Apply pulse brightness
                  finalColor *= pulse;
                  
                  // Edge glow
                  float edge = 1.0 - abs(vUv.y - 0.5) * 2.0;
                  edge = pow(edge, 3.0);
                  
                  gl_FragColor = vec4(finalColor, edge * 0.7);
                }
              `,
              transparent: true,
              side: THREE.DoubleSide,
              blending: THREE.AdditiveBlending,
              depthWrite: false,
            })

        const tunnel = new THREE.Mesh(tunnelGeometry, tunnelMaterial)

        // Position wormhole randomly in space
        const x = (Math.random() - 0.5) * 150
        const y = (Math.random() - 0.5) * 80
        const z = (Math.random() - 0.5) * 150

        wormholeGroup.position.set(x, y, z)

        // Random rotation
        wormholeGroup.rotation.x = Math.random() * Math.PI
        wormholeGroup.rotation.y = Math.random() * Math.PI
        wormholeGroup.rotation.z = Math.random() * Math.PI

        // Add energy particles around the wormhole - skip on mobile or reduce count
        if (!isMobile) {
          const particleCount = 500
          const particleGeometry = new THREE.BufferGeometry()
          const particlePositions = new Float32Array(particleCount * 3)
          const particleColors = new Float32Array(particleCount * 3)

          for (let j = 0; j < particleCount; j++) {
            // Position particles in a torus shape around the wormhole
            const angle1 = Math.random() * Math.PI * 2
            const angle2 = Math.random() * Math.PI * 2
            const radius = 4 + (Math.random() - 0.5) * 1.5

            particlePositions[j * 3] = (radius + Math.cos(angle2) * 1.5) * Math.cos(angle1)
            particlePositions[j * 3 + 1] = (radius + Math.cos(angle2) * 1.5) * Math.sin(angle1)
            particlePositions[j * 3 + 2] = Math.sin(angle2) * 1.5

            // Match particle colors to wormhole colors
            const color = isMobile ? new THREE.Color(0xffffff) : tunnelMaterial.uniforms.color1.value.clone()

            if (!isMobile) {
              color.lerp(tunnelMaterial.uniforms.color2.value, Math.random())
            }

            particleColors[j * 3] = color.r
            particleColors[j * 3 + 1] = color.g
            particleColors[j * 3 + 2] = color.b
          }

          particleGeometry.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3))
          particleGeometry.setAttribute("color", new THREE.BufferAttribute(particleColors, 3))

          const particleMaterial = new THREE.PointsMaterial({
            size: 0.2,
            vertexColors: true,
            transparent: true,
            opacity: 0.7,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          })

          const particles = new THREE.Points(particleGeometry, particleMaterial)
          wormholeGroup.add(particles)
        }

        // Add glow light - skip on mobile
        if (!isMobile) {
          const wormholeLight = new THREE.PointLight(isMobile ? 0xffffff : tunnelMaterial.uniforms.color1.value, 2, 20)
          wormholeGroup.add(wormholeLight)
        }

        // Add tunnel to group
        wormholeGroup.add(tunnel)

        // Add to scene
        scene.add(wormholeGroup)

        // Store wormhole data
        wormholes.push({
          group: wormholeGroup,
          tunnel: tunnel,
          material: tunnelMaterial,
          light: !isMobile ? wormholeGroup.children[1] : null,
          particles: !isMobile ? wormholeGroup.children[0] : null,
          rotationAxis: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(),
          rotationSpeed: Math.random() * 0.001 + 0.0005,
          pulsing: false,
          pulseTime: 0,
        })
      }

      return wormholes
    }

    // Create Sound Wave Plane - skip on mobile
    function createSoundWavePlane() {
      if (!qualitySettings.useSoundWavePlane) return null

      // Create a plane geometry with many segments for detailed wave movement
      const planeGeometry = new THREE.PlaneGeometry(60, 40, 128, 128)

      // Create shader material for the wave effect
      const waveMaterial = new THREE.ShaderMaterial({
        uniforms: {
          time: { value: 0 },
          audioData: { value: new Float32Array(128).fill(0) },
          baseColor: { value: new THREE.Color().setHSL(0.6, 0.8, 0.5) },
          highlightColor: { value: new THREE.Color().setHSL(0.7, 0.9, 0.7) },
          lowColor: { value: new THREE.Color().setHSL(0.2, 0.8, 0.3) },
          amplitude: { value: 2.0 },
          opacity: { value: 0.7 },
        },
        vertexShader: `
          uniform float time;
          uniform float amplitude;
          uniform float[128] audioData;
          
          varying vec2 vUv;
          varying float vElevation;
          
          float getElevation(vec2 position) {
            // Get audio data index based on x position
            float xIndex = clamp(position.x * 0.5 + 0.5, 0.0, 1.0) * 127.0;
            int index = int(xIndex);
            float remainder = fract(xIndex);
            
            // Interpolate between two adjacent audio data points
            float audioValue1 = audioData[index];
            float audioValue2 = index < 127 ? audioData[index + 1] : audioData[index];
            float audioValue = mix(audioValue1, audioValue2, remainder);
            
            // Create wave pattern
            float elevation = audioValue * amplitude;
            
            // Add some additional waves based on time
            elevation += sin(position.x * 3.0 + time * 0.5) * 0.2 * amplitude;
            elevation += sin(position.y * 2.0 + time * 0.3) * 0.1 * amplitude;
            
            return elevation;
          }
          
          void main() {
            vUv = uv;
            
            // Calculate elevation
            vElevation = getElevation(position.xy);
            
            // Apply elevation to vertex
            vec3 newPosition = position;
            newPosition.z += vElevation;
            
            gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
          }
        `,
        fragmentShader: `
          uniform vec3 baseColor;
          uniform vec3 highlightColor;
          uniform vec3 lowColor;
          uniform float opacity;
          
          varying vec2 vUv;
          varying float vElevation;
          
          void main() {
            // Mix colors based on elevation
            vec3 color = baseColor;
            
            if (vElevation > 0.5) {
              float t = (vElevation - 0.5) * 2.0;
              color = mix(baseColor, highlightColor, t);
            } else if (vElevation < -0.5) {
              float t = (-vElevation - 0.5) * 2.0;
              color = mix(baseColor, lowColor, t);
            }
            
            // Add grid lines
            float gridX = step(0.98, 1.0 - abs(fract(vUv.x * 20.0) * 2.0 - 1.0));
            float gridY = step(0.98, 1.0 - abs(fract(vUv.y * 20.0) * 2.0 - 1.0));
            float grid = max(gridX, gridY) * 0.3;
            
            color = mix(color, vec3(1.0), grid);
            
            // Edge glow effect
            float edge = 1.0 - max(abs(vUv.x - 0.5) * 2.0, abs(vUv.y - 0.5) * 2.0);
            edge = pow(edge, 3.0);
            
            gl_FragColor = vec4(color, opacity * edge);
          }
        `,
        transparent: true,
        side: THREE.DoubleSide,
        wireframe: false,
      })

      // Create the plane mesh
      const plane = new THREE.Mesh(planeGeometry, waveMaterial)

      // Position and rotate the plane
      plane.rotation.x = -Math.PI / 2 // Horizontal plane
      plane.position.y = -15 // Below the main scene

      // Add to scene
      scene.add(plane)

      return plane
    }

    // Enhanced Lighting Setup - REDUCED FOR MOBILE
    const ambientLight = new THREE.AmbientLight(0xffffff, isMobile ? 0.8 : 0.6)
    scene.add(ambientLight)

    // Reduce number of lights on mobile
    if (!isMobile) {
      const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2)
      directionalLight.position.set(5, 10, 8)
      directionalLight.castShadow = true
      directionalLight.shadow.mapSize.set(1024, 1024)
      directionalLight.shadow.camera.near = 1
      directionalLight.shadow.camera.far = 50
      directionalLight.shadow.camera.left = -10
      directionalLight.shadow.camera.right = 10
      directionalLight.shadow.camera.top = 10
      directionalLight.shadow.camera.bottom = -10
      directionalLight.shadow.bias = -0.0005
      scene.add(directionalLight)

      const fillLight = new THREE.DirectionalLight(0xffffee, 3.5)
      fillLight.position.set(-5, 5, 15)
      scene.add(fillLight)

      const spotLight = new THREE.SpotLight(0xffffff, 50, 100, 0.3, 0.5)
      spotLight.position.set(0, 15, 0)
      spotLight.castShadow = true
      spotLight.shadow.bias = -0.0001
      scene.add(spotLight)

      const rimLight1 = new THREE.PointLight(0xff3300, 12, 3)
      rimLight1.position.set(-10, 5, 0)
      scene.add(rimLight1)

      const rimLight2 = new THREE.PointLight(0x00aaff, 12, 2)
      rimLight2.position.set(10, 5, 0)
      scene.add(rimLight2)

      const movingLight1 = new THREE.PointLight(0xffffff, 1.0, 1.0, 0.5)
      movingLight1.position.set(0, 0, 0)
      scene.add(movingLight1)

      const movingLight2 = new THREE.PointLight(0xffffff, 1.0, 1.0, 0.5)
      movingLight2.position.set(0, 0, 0)
      scene.add(movingLight2)

      const hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x404040, 1.0)
      scene.add(hemiLight)

      // Add a new light specifically for the model
      const modelFillLight = new THREE.DirectionalLight(0xffffff, 2.0)
      modelFillLight.position.set(0, 3, 5)
      scene.add(modelFillLight)
    } else {
      // Just add a few essential lights for mobile
      const mainLight = new THREE.DirectionalLight(0xffffff, 1.5)
      mainLight.position.set(0, 10, 10)
      scene.add(mainLight)

      const fillLight = new THREE.DirectionalLight(0xffffee, 1.0)
      fillLight.position.set(-5, 5, 5)
      scene.add(fillLight)
    }

    // Initialize scene elements - with mobile optimizations
    starField = createStarField()
    floatingCrystals = createFloatingCrystals()
    ring = createGlowingRing()
    skybox = createSkybox()
    visualizerBars = createVisualizerBars()
    energyWaves = createEnergyWaves()
    asteroidBelts = createAsteroidBelts()
    wormholes = createWormholes()

    // Skip sound wave plane on mobile
    if (qualitySettings.useSoundWavePlane) {
      soundWavePlane = createSoundWavePlane()
    }

    // Optimized Thruster Particles
    function createThrusterParticles() {
      // Reduce particle count on mobile
      const thrusterCount = isMobile ? 50 : 100
      const thrusterGeometry = new THREE.BufferGeometry()
      const thrusterPositions = new Float32Array(thrusterCount * 3)
      const thrusterVelocities = new Float32Array(thrusterCount * 3)
      const thrusterColors = new Float32Array(thrusterCount * 3)

      for (let i = 0; i < thrusterCount; i++) {
        thrusterPositions[i * 3] = (Math.random() - 0.5) * 0.1
        thrusterPositions[i * 3 + 1] = (Math.random() - 0.5) * 0.1
        thrusterPositions[i * 3 + 2] = -Math.random() * 0.5

        thrusterVelocities[i * 3] = (Math.random() - 0.5) * 0.01
        thrusterVelocities[i * 3 + 1] = (Math.random() - 0.5) * 0.01
        thrusterVelocities[i * 3 + 2] = -Math.random() * 0.1 - 0.05

        const t = Math.random()
        thrusterColors[i * 3] = t * 1.0
        thrusterColors[i * 3 + 1] = 0.5 + t * 0.5
        thrusterColors[i * 3 + 2] = 1.0
      }

      thrusterGeometry.setAttribute("position", new THREE.BufferAttribute(thrusterPositions, 3))
      thrusterGeometry.setAttribute("velocity", new THREE.BufferAttribute(thrusterVelocities, 3))
      thrusterGeometry.setAttribute("color", new THREE.BufferAttribute(thrusterColors, 3))

      const thrusterMaterial = new THREE.PointsMaterial({
        size: 0.05,
        vertexColors: true,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })

      return new THREE.Points(thrusterGeometry, thrusterMaterial)
    }

    // Optimized Particle Burst - skip on mobile
    function createBurstParticles() {
      if (isMobile) return null

      const burstGeometry = new THREE.BufferGeometry()
      const burstCount = 100
      const burstPositions = new Float32Array(burstCount * 3)
      const burstVelocities = new Float32Array(burstCount * 3)
      const burstColors = new Float32Array(burstCount * 3)

      for (let i = 0; i < burstCount; i++) {
        burstPositions[i * 3] = 0
        burstPositions[i * 3 + 1] = 1
        burstPositions[i * 3 + 2] = 0

        const theta = Math.random() * Math.PI * 2
        const phi = Math.random() * Math.PI
        const speed = Math.random() * 0.1 + 0.05

        burstVelocities[i * 3] = speed * Math.sin(phi) * Math.cos(theta)
        burstVelocities[i * 3 + 1] = speed * Math.cos(phi)
        burstVelocities[i * 3 + 2] = speed * Math.sin(phi) * Math.sin(theta)

        const hue = Math.random()
        const color = new THREE.Color().setHSL(hue, 0.9, 0.6)
        burstColors[i * 3] = color.r
        burstColors[i * 3 + 1] = color.g
        burstColors[i * 3 + 2] = color.b
      }

      burstGeometry.setAttribute("position", new THREE.BufferAttribute(burstPositions, 3))
      burstGeometry.setAttribute("velocity", new THREE.BufferAttribute(burstVelocities, 3))
      burstGeometry.setAttribute("color", new THREE.BufferAttribute(burstColors, 3))

      const burstMaterial = new THREE.PointsMaterial({
        size: 0.1,
        vertexColors: true,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })

      return new THREE.Points(burstGeometry, burstMaterial)
    }

    // Optimized Post-Processing Setup - SKIP ON MOBILE
    function setupPostProcessing() {
      if (!qualitySettings.usePostProcessing) return

      composer = new EffectComposer(renderer)

      const renderPass = new RenderPass(scene, camera)
      composer.addPass(renderPass)

      const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        0.7, // bloom strength
        0.4, // Radius
        0.85, // Threshold
      )
      composer.addPass(bloomPass)

      const rgbShiftPass = new ShaderPass(RGBShiftShader)
      rgbShiftPass.uniforms.amount.value = 0.0005
      composer.addPass(rgbShiftPass)
    }

    // Load GLTF Model - with mobile optimizations
    const loader = new GLTFLoader().setPath("public/collinship/")
    loader.load(
      "collin.gltf",
      (gltf) => {
        console.log("loading model")
        spaceship = gltf.scene // Assign the entire scene to spaceship variable

        spaceship.traverse((child) => {
          if (child.isMesh) {
            if (child.material) {
              // Simplified materials for mobile
              if (isMobile) {
                // Replace complex materials with basic materials on mobile
                const color = child.material.color ? child.material.color.clone() : new THREE.Color(0xcccccc)
                child.material = new THREE.MeshBasicMaterial({
                  color: color,
                  transparent: true,
                  opacity: 0.9,
                })
              } else {
                child.material.metalness = 0.7
                child.material.roughness = 0.3
                child.material.envMapIntensity = 2.0
                child.material.emissive = new THREE.Color(0x555555)
                child.material.emissiveIntensity = 0.5

                // Brighten the base color if it exists
                if (child.material.color) {
                  // Get current HSL values
                  const hsl = { h: 0, s: 0, l: 0 }
                  child.material.color.getHSL(hsl)
                  // Increase lightness by 20% but cap at 1.0
                  hsl.l = Math.min(1.0, hsl.l * 1.2)
                  child.material.color.setHSL(hsl.h, hsl.s, hsl.l)
                }
              }
            }

            child.castShadow = !isMobile
            child.receiveShadow = !isMobile
          }
        })

        spaceship.position.set(0, 1.05, -1)
        spaceship.scale.set(0.5, 0.5, 0.5)
        scene.add(spaceship)

        // Add engine glow - simplified on mobile
        const engineGlow = new THREE.PointLight(0x00aaff, isMobile ? 8 : 12, isMobile ? 4 : 6)
        engineGlow.position.set(0, 0.5, 2)
        spaceship.add(engineGlow)

        thrusterParticles = createThrusterParticles()
        spaceship.add(thrusterParticles)

        // Enhanced model lighting - skip on mobile
        if (!isMobile) {
          const modelSpotlight = new THREE.SpotLight(0xffffff, 30, 20, 0.5, 0.5)
          modelSpotlight.position.set(0, 10, 5)
          modelSpotlight.target = spaceship
          scene.add(modelSpotlight)

          const modelUplight = new THREE.SpotLight(0xffffee, 15, 15, 0.6, 0.5)
          modelUplight.position.set(0, -2, 5)
          modelUplight.target = spaceship
          scene.add(modelUplight)

          const modelFrontLight = new THREE.SpotLight(0xffffff, 20, 20, 0.5, 0.5)
          modelFrontLight.position.set(0, 2, 8)
          modelFrontLight.target = spaceship
          scene.add(modelFrontLight)

          const modelSideLight = new THREE.PointLight(0xffffee, 10, 10)
          modelSideLight.position.set(5, 2, 0)
          spaceship.add(modelSideLight)
        }

        const progressContainer = document.getElementById("progress-container")
        if (progressContainer) {
          progressContainer.style.display = "none"
        }

        // Initialize audio after model loads
        setupAudio()

        // Show play button
        const playButton = document.getElementById("play-button")
        if (playButton) {
          playButton.style.display = "block"
        }
      },
      (xhr) => {
        const progressPercent = xhr.total > 0 ? ((xhr.loaded / xhr.total) * 100).toFixed(0) : 0
        console.log(`Loading Model: ${progressPercent}%`)

        const progressElement = document.getElementById("progress")
        if (progressElement) {
          progressElement.textContent = `Loading Model: ${progressPercent}%`
        }

        const progressBar = document.getElementById("progress-bar")
        if (progressBar) {
          progressBar.style.width = `${progressPercent}%`
        }
      },
      (error) => {
        console.error("Error Loading Model:", error)

        const progressElement = document.getElementById("progress")
        if (progressElement) {
          progressElement.textContent = "Error Loading Model. Please refresh."
        }
      },
    )

    // Event Listeners
    document.addEventListener("mousemove", (event) => {
      mouseX = (event.clientX / window.innerWidth) * 2 - 1
      mouseY = -(event.clientY / window.innerHeight) * 2 + 1
    })

    window.addEventListener("resize", () => {
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()
      renderer.setSize(window.innerWidth, window.innerHeight)
      if (composer) composer.setSize(window.innerWidth, window.innerHeight)

      // Resize visualizer canvas if it exists
      if (visualizerCanvasRef.current) {
        visualizerCanvasRef.current.width = visualizerCanvasRef.current.clientWidth
        visualizerCanvasRef.current.height = visualizerCanvasRef.current.clientHeight
      }
    })

    document.addEventListener("click", () => {
      try {
        // Skip particle burst on mobile
        if (isMobile) return

        if (!burstParticles) {
          burstParticles = createBurstParticles()
          scene.add(burstParticles)
        }

        const positions = burstParticles.geometry.attributes.position.array
        const velocities = burstParticles.geometry.attributes.velocity.array
        const colors = burstParticles.geometry.attributes.color.array

        for (let i = 0; i < positions.length / 3; i++) {
          positions[i * 3] = 0
          positions[i * 3 + 1] = 1
          positions[i * 3 + 2] = 0

          const theta = Math.random() * Math.PI * 2
          const phi = Math.random() * Math.PI
          const speed = Math.random() * 0.1 + 0.05

          velocities[i * 3] = speed * Math.sin(phi) * Math.cos(theta)
          velocities[i * 3 + 1] = speed * Math.cos(phi)
          velocities[i * 3 + 2] = speed * Math.sin(phi) * Math.sin(theta)

          const hue = Math.random()
          const color = new THREE.Color().setHSL(hue, 0.9, 0.6)
          colors[i * 3] = color.r
          colors[i * 3 + 1] = color.g
          colors[i * 3 + 2] = color.b
        }

        burstParticles.geometry.attributes.position.needsUpdate = true
        burstParticles.geometry.attributes.color.needsUpdate = true

        // Trigger an energy wave on click
        triggerEnergyWave()
      } catch (error) {
        console.error("Error in click handler:", error)
      }
    })

    // Trigger Energy Wave
    function triggerEnergyWave() {
      if (!energyWaves || energyWaves.length === 0) return

      // Find an inactive wave
      const inactiveWave = energyWaves.find((wave) => !wave.active)
      if (inactiveWave) {
        inactiveWave.active = true
        inactiveWave.progress = 0
        inactiveWave.mesh.visible = true
        inactiveWave.mesh.scale.set(inactiveWave.initialScale, inactiveWave.initialScale, inactiveWave.initialScale)

        // Set a random color
        const hue = Math.random()
        inactiveWave.mesh.material.color.setHSL(hue, 0.8, 0.5)
        inactiveWave.mesh.material.emissive.setHSL(hue, 0.9, 0.3)
      }
    }

    // Pulse Wormholes
    function pulseWormholes() {
      if (!wormholes || wormholes.length === 0 || isMobile) return

      wormholes.forEach((wormhole) => {
        if (!wormhole.pulsing) {
          wormhole.pulsing = true
          wormhole.pulseTime = 0

          if (!isMobile && wormhole.material.uniforms) {
            wormhole.material.uniforms.pulseIntensity.value = 1.0
          }

          if (wormhole.light) {
            wormhole.light.intensity = 5
          }
        }
      })
    }

    // Setup Post-Processing
    setupPostProcessing()

    // Optimized Animation Loop
    function animate() {
      requestAnimationFrame(animate)

      try {
        const elapsedTime = clock.getElapsedTime()
        controls.update()

        // Update audio data
        updateAudioData()

        // Get average frequency values for different bands
        let bassAvg = 0,
          midAvg = 0,
          trebleAvg = 0

        if (isPlaying) {
          bassAvg = getAverageFrequency(bassData)
          midAvg = getAverageFrequency(midData)
          trebleAvg = getAverageFrequency(trebleData)
        }

        // Update skybox
        if (skybox && skybox.material) {
          for (let i = 0; i < skybox.material.length; i++) {
            const material = skybox.material[i]
            // Pulse opacity with bass
            material.opacity = 0.3 + bassAvg * 0.3

            // Change color with time and audio
            const hue = (elapsedTime * 0.02 + bassAvg * 0.2) % 1
            material.color.setHSL(hue, 0.7, 0.1 + bassAvg * 0.2)
          }
        }

        // Update visualizer bars
        if (visualizerBars && visualizerBars.length > 0 && audioData) {
          const barCount = visualizerBars.length
          const step = Math.floor(audioData.length / barCount)

          for (let i = 0; i < barCount; i++) {
            const bar = visualizerBars[i]
            if (!bar) continue

            // Get audio data for this bar
            const audioIndex = i * step
            const audioValue = audioData[audioIndex] || 0

            // Scale bar height based on audio
            const targetHeight = 0.1 + audioValue * 5
            bar.scale.y = targetHeight

            // Center the bar vertically
            bar.position.y = targetHeight / 2

            // Pulse color intensity with audio
            const hue = (i / barCount + elapsedTime * 0.05) % 1
            bar.material.color.setHSL(hue, 0.8, 0.5 + audioValue * 0.5)

            // Only update emissive for non-mobile
            if (!isMobile && bar.material.emissive) {
              bar.material.emissive.setHSL(hue, 0.9, 0.3 + audioValue * 0.3)
            }
          }
        }

        // Update asteroid belts - simplified for mobile
        if (asteroidBelts && asteroidBelts.length > 0) {
          asteroidBelts.forEach((belt) => {
            // Rotate the entire belt group
            belt.group.rotateOnAxis(belt.rotationAxis, belt.rotationSpeed * (1 + bassAvg * 2))

            // Update galaxy core
            if (belt.core && belt.core.material) {
              // For mobile, just update color
              if (isMobile) {
                const hue = (elapsedTime * 0.05) % 1
                belt.core.material.color.setHSL(hue, 0.8, 0.5)
              } else {
                // Pulse with bass
                belt.core.material.emissiveIntensity = 2 + bassAvg * 3

                // Change color over time
                const hue = (elapsedTime * 0.05 + bassAvg * 0.1) % 1
                belt.core.material.emissive.setHSL(hue, 0.8, 0.5)
              }

              // Scale with bass
              const scale = 1 + bassAvg * 0.3
              belt.core.scale.set(scale, scale, scale)
            }

            // Update individual asteroids - limit updates on mobile
            const updateFrequency = isMobile ? 5 : 1 // Only update every 5th frame on mobile
            if (Math.floor(elapsedTime * 60) % updateFrequency === 0) {
              belt.group.children.forEach((child) => {
                if (child instanceof THREE.Mesh && child.userData && child.userData.rotationSpeed) {
                  // Rotate asteroids individually
                  child.rotation.x += child.userData.rotationSpeed.x * (1 + midAvg)
                  child.rotation.y += child.userData.rotationSpeed.y * (1 + midAvg)
                  child.rotation.z += child.userData.rotationSpeed.z * (1 + midAvg)
                }
              })
            }
          })
        }

        // Update wormholes - simplified for mobile
        if (wormholes && wormholes.length > 0) {
          wormholes.forEach((wormhole) => {
            // Update shader time for non-mobile
            if (!isMobile && wormhole.material.uniforms) {
              wormhole.material.uniforms.time.value = elapsedTime
            }

            // Rotate wormhole
            wormhole.group.rotateOnAxis(wormhole.rotationAxis, wormhole.rotationSpeed)

            // Handle pulsing effect for non-mobile
            if (!isMobile && wormhole.pulsing) {
              wormhole.pulseTime += 0.05

              if (wormhole.pulseTime >= 1.0) {
                wormhole.pulsing = false
                if (wormhole.material.uniforms) {
                  wormhole.material.uniforms.pulseIntensity.value = 0.0
                }
                if (wormhole.light) {
                  wormhole.light.intensity = 2
                }
              }
            }

            // Make wormhole react to treble
            const trebleEffect = trebleAvg * 0.5
            wormhole.tunnel.scale.set(1 + trebleEffect, 1 + trebleEffect, 1 + trebleEffect)

            // Slowly change colors over time for non-mobile
            if (!isMobile && wormhole.material.uniforms) {
              const hue1 = (elapsedTime * 0.03) % 1
              const hue2 = (elapsedTime * 0.02 + 0.5) % 1
              wormhole.material.uniforms.color1.value.setHSL(hue1, 0.8, 0.5)
              wormhole.material.uniforms.color2.value.setHSL(hue2, 0.8, 0.5)
              if (wormhole.light) {
                wormhole.light.color.copy(wormhole.material.uniforms.color1.value)
              }
            } else if (isMobile && wormhole.tunnel.material) {
              // For mobile, just update the basic material color
              const hue = (elapsedTime * 0.03) % 1
              wormhole.tunnel.material.color.setHSL(hue, 0.8, 0.5)
            }
          })
        }

        // Update sound wave plane - skip on mobile
        if (soundWavePlane && soundWavePlane.material.uniforms) {
          soundWavePlane.material.uniforms.time.value = elapsedTime

          // Update audio data in the shader
          if (isPlaying && audioData) {
            // Create a downsampled version of the audio data for the shader
            const audioDataLength = Math.min(audioData.length, 128)
            const downsampledData = new Float32Array(128)

            for (let i = 0; i < 128; i++) {
              const sourceIndex = Math.floor((i * audioData.length) / 128)
              downsampledData[i] = audioData[sourceIndex] * 2.0 // Amplify for better visibility
            }

            soundWavePlane.material.uniforms.audioData.value = downsampledData

            // Update colors based on audio frequencies
            const bassColor = new THREE.Color().setHSL((elapsedTime * 0.05 + bassAvg * 0.2) % 1, 0.8, 0.5)
            const trebleColor = new THREE.Color().setHSL((elapsedTime * 0.03 + trebleAvg * 0.2 + 0.5) % 1, 0.9, 0.7)
            const midColor = new THREE.Color().setHSL((elapsedTime * 0.04 + midAvg * 0.2 + 0.3) % 1, 0.8, 0.4)

            soundWavePlane.material.uniforms.baseColor.value = midColor
            soundWavePlane.material.uniforms.highlightColor.value = trebleColor
            soundWavePlane.material.uniforms.lowColor.value = bassColor

            // Adjust amplitude based on overall audio level
            const overallLevel = (bassAvg + midAvg + trebleAvg) / 3
            soundWavePlane.material.uniforms.amplitude.value = 2.0 + overallLevel * 8.0
          }

          // Rotate the plane slowly
          soundWavePlane.rotation.z += 0.001
        }

        // Update energy waves - skip on mobile
        if (!isMobile && energyWaves && energyWaves.length > 0) {
          energyWaves.forEach((wave) => {
            if (wave.active) {
              wave.progress += wave.speed * 0.01
              const scale = wave.initialScale + (wave.maxScale - wave.initialScale) * wave.progress
              wave.mesh.scale.set(scale, scale, scale)

              // Fade out as it expands
              wave.mesh.material.opacity = 0.7 * (1 - wave.progress)

              // Reset when complete
              if (wave.progress >= 1) {
                wave.active = false
                wave.mesh.visible = false
              }
            }
          })
        }

        // Update lightning effects - skip on mobile
        if (!isMobile && lightningEffects && lightningEffects.length > 0) {
          for (let i = lightningEffects.length - 1; i >= 0; i--) {
            const lightning = lightningEffects[i]
            lightning.life -= lightning.decay

            if (lightning.life <= 0) {
              scene.remove(lightning.mesh)
              lightningEffects.splice(i, 1)
            } else {
              lightning.mesh.material.opacity = lightning.life
            }
          }
        }

        if (spaceship) {
          // Make spaceship react to bass
          const bassIntensity = bassAvg * 0.2
          spaceship.rotation.y = Math.sin(elapsedTime * 0.1) * 0.05 + bassIntensity * 0.1
          spaceship.position.x += (mouseX * 0.5 - spaceship.position.x) * 0.02
          spaceship.rotation.z += (-mouseX * 0.2 - spaceship.rotation.z) * 0.02

          // Make spaceship bounce slightly with the beat
          spaceship.position.y = 1.05 + bassAvg * 0.2

          if (thrusterParticles && thrusterParticles.geometry.attributes.position) {
            const positions = thrusterParticles.geometry.attributes.position.array
            const velocities = thrusterParticles.geometry.attributes.velocity.array
            const colors = thrusterParticles.geometry.attributes.color.array

            // On mobile, update fewer particles per frame
            const updateCount = isMobile ? Math.min(positions.length / 3, 10) : positions.length / 3
            const startIdx = Math.floor(Math.random() * (positions.length / 3 - updateCount))

            for (let i = startIdx; i < startIdx + updateCount; i++) {
              positions[i * 3] += velocities[i * 3]
              positions[i * 3 + 1] += velocities[i * 3 + 1]
              positions[i * 3 + 2] += velocities[i * 3 + 2]

              if (positions[i * 3 + 2] < -2) {
                positions[i * 3] = (Math.random() - 0.5) * 0.1
                positions[i * 3 + 1] = (Math.random() - 0.5) * 0.1
                positions[i * 3 + 2] = -Math.random() * 0.5

                const t = Math.random()
                colors[i * 3] = t * 1.0
                colors[i * 3 + 1] = 0.5 + t * 0.5
                colors[i * 3 + 2] = 1.0
              }
            }

            thrusterParticles.geometry.attributes.position.needsUpdate = true
            thrusterParticles.geometry.attributes.color.needsUpdate = true
          }
        }

        if (starField && starField.material.uniforms) {
          starField.material.uniforms.time.value = elapsedTime
          starField.material.uniforms.pixelRatio.value = renderer.getPixelRatio()

          // Update audio intensity in shader
          if (starField.material.uniforms.audioIntensity) {
            starField.material.uniforms.audioIntensity.value = trebleAvg
          }

          if (starField.geometry.attributes.position && starField.geometry.attributes.velocity) {
            const positions = starField.geometry.attributes.position.array
            const velocities = starField.geometry.attributes.velocity.array
            const count = positions.length / 3

            // Speed up star movement based on treble
            const speedMultiplier = 1 + trebleAvg * 2

            // On mobile, update fewer stars per frame
            const updateCount = isMobile ? Math.min(count, 500) : Math.min(count, 2000)
            const startIdx = Math.floor(Math.random() * (count - updateCount))

            for (let i = startIdx; i < startIdx + updateCount; i++) {
              positions[i * 3] += velocities[i * 3] * speedMultiplier
              positions[i * 3 + 1] += velocities[i * 3 + 1] * speedMultiplier
              positions[i * 3 + 2] += velocities[i * 3 + 2] * speedMultiplier

              if (positions[i * 3 + 2] < -150) {
                const radius = 150
                const theta = Math.random() * Math.PI * 2
                const phi = Math.random() * Math.PI

                positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta)
                positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta)
                positions[i * 3 + 2] = radius * Math.cos(phi)
              }
            }

            starField.geometry.attributes.position.needsUpdate = true
          }
        }

        if (floatingCrystals && floatingCrystals.length > 0) {
          // On mobile, update fewer crystals per frame
          const updateFrequency = isMobile ? 3 : 1 // Only update every 3rd frame on mobile

          if (Math.floor(elapsedTime * 60) % updateFrequency === 0) {
            floatingCrystals.forEach((crystal, index) => {
              if (!crystal) return

              const data = crystal.userData
              if (!data) return

              // Make crystals react to mid frequencies
              const audioIndex = index % (midData ? midData.length : 1)
              const audioValue = isPlaying && midData ? midData[audioIndex] : 0
              const audioBoost = audioValue * 3

              crystal.rotation.x += data.rotationSpeed.x * (1 + audioBoost)
              crystal.rotation.y += data.rotationSpeed.y * (1 + audioBoost)
              crystal.rotation.z += data.rotationSpeed.z * (1 + audioBoost)

              const floatY = Math.sin(elapsedTime * data.floatSpeed + data.floatOffset) * 0.5 * (1 + audioBoost)

              if (data.orbitRadius) {
                const orbitAngle = elapsedTime * data.orbitSpeed + data.orbitOffset
                crystal.position.x =
                  data.orbitCenter.x + Math.sin(orbitAngle) * data.orbitRadius * (1 + audioBoost * 0.2)
                crystal.position.z =
                  data.orbitCenter.z + Math.cos(orbitAngle) * data.orbitRadius * (1 + audioBoost * 0.2)
                crystal.position.y = data.originalY + floatY
              }

              if (crystal.material && crystal.material.color) {
                const hue = (elapsedTime * 0.01 + data.floatOffset + audioBoost * 0.1) % 1
                crystal.material.color.setHSL(hue, 0.8, 0.6)

                if (!isMobile && crystal.material.emissive) {
                  crystal.material.emissive.setHSL((hue + 0.5) % 1, 0.9, 0.4)
                  crystal.material.emissiveIntensity =
                    0.6 + Math.sin(elapsedTime * 2 + data.floatOffset) * 0.2 + audioBoost
                }
              }
            })
          }
        }

        if (ring && ring.children && ring.children.length > 0) {
          const mainRing = ring.children[0]
          if (mainRing && mainRing.material) {
            // Make ring pulse with bass
            const bassValue = bassAvg || 0

            if (!isMobile && mainRing.material.emissiveIntensity !== undefined) {
              mainRing.material.emissiveIntensity = 5 + Math.sin(elapsedTime * 2) * 2 + bassValue * 5
              const hue1 = (elapsedTime * 0.05 + bassValue * 0.1) % 1
              mainRing.material.emissive.setHSL(hue1, 0.7, 0.5)
            } else if (isMobile) {
              // For mobile, just update the color
              const hue1 = (elapsedTime * 0.05 + bassValue * 0.1) % 1
              mainRing.material.color.setHSL(hue1, 0.7, 0.5)
            }

            // Scale ring with bass
            mainRing.scale.set(1 + bassValue * 0.2, 1 + bassValue * 0.2, 1 + bassValue * 0.2)
          }

          if (ring.children.length > 1) {
            const innerRing = ring.children[1]
            if (innerRing && innerRing.material) {
              // Make inner ring pulse with mids
              const midValue = midAvg || 0

              if (!isMobile && innerRing.material.emissiveIntensity !== undefined) {
                innerRing.material.emissiveIntensity = 4 + Math.cos(elapsedTime * 2.5) * 1.5 + midValue * 4
                const hue2 = (elapsedTime * 0.07 + 0.5 + midValue * 0.1) % 1
                innerRing.material.emissive.setHSL(hue2, 0.7, 0.5)
              } else if (isMobile) {
                // For mobile, just update the color
                const hue2 = (elapsedTime * 0.07 + 0.5 + midValue * 0.1) % 1
                innerRing.material.color.setHSL(hue2, 0.7, 0.5)
              }

              // Scale inner ring with mids
              innerRing.scale.set(1 + midValue * 0.15, 1 + midValue * 0.15, 1 + midValue * 0.15)
            }
          }

          if (!isMobile && ring.children.length > 2) {
            const ringLight = ring.children[2]
            if (ringLight) {
              const bassValue = bassAvg || 0
              ringLight.intensity = 5 + Math.sin(elapsedTime * 3) * 2 + bassValue * 10
              const hue3 = (elapsedTime * 0.05) % 1
              ringLight.color.setHSL(hue3, 0.7, 0.5)
            }
          }
        }

        // Make lights react to audio - skip most on mobile
        if (!isMobile) {
          // These are the non-mobile lights
          if (scene.children.find((child) => child instanceof THREE.SpotLight)) {
            const spotLight = scene.children.find((child) => child instanceof THREE.SpotLight)
            if (spotLight) {
              spotLight.intensity = 30 + Math.sin(elapsedTime) * 5 + trebleAvg * 20
              const spotHue = (elapsedTime * 0.02 + trebleAvg * 0.1) % 1
              spotLight.color.setHSL(spotHue, 0.5, 0.6)
            }
          }

          // Find and update moving lights
          const movingLights = scene.children.filter(
            (child) => child instanceof THREE.PointLight && child !== ring?.children[2],
          )

          if (movingLights.length >= 2) {
            const movingLight1 = movingLights[0]
            const movingLight2 = movingLights[1]

            const movingAngle1 = elapsedTime * 0.5
            movingLight1.position.x = Math.sin(movingAngle1) * 10
            movingLight1.position.y = 5 + Math.sin(elapsedTime * 0.7) * 2 + midAvg * 3
            movingLight1.position.z = Math.cos(movingAngle1) * 10
            movingLight1.intensity = 0.5 + bassAvg * 2

            const movingAngle2 = elapsedTime * 0.5 + Math.PI
            movingLight2.position.x = Math.sin(movingAngle2) * 10
            movingLight2.position.y = 5 + Math.cos(elapsedTime * 0.7) * 2 + trebleAvg * 3
            movingLight2.position.z = Math.cos(movingAngle2) * 10
            movingLight2.intensity = 0.5 + trebleAvg * 2
          }
        }

        if (!isMobile && burstParticles && burstParticles.geometry.attributes.position) {
          const positions = burstParticles.geometry.attributes.position.array
          const velocities = burstParticles.geometry.attributes.velocity.array

          for (let i = 0; i < positions.length / 3; i++) {
            positions[i * 3] += velocities[i * 3]
            positions[i * 3 + 1] += velocities[i * 3 + 1]
            positions[i * 3 + 2] += velocities[i * 3 + 2]

            velocities[i * 3 + 1] -= 0.001

            if (positions[i * 3 + 1] < -5) {
              positions[i * 3] = 0
              positions[i * 3 + 1] = 1
              positions[i * 3 + 2] = 0

              const theta = Math.random() * Math.PI * 2
              const phi = Math.random() * Math.PI
              const speed = Math.random() * 0.1 + 0.05

              velocities[i * 3] = speed * Math.sin(phi) * Math.cos(theta)
              velocities[i * 3 + 1] = speed * Math.cos(phi)
              velocities[i * 3 + 2] = speed * Math.sin(phi) * Math.sin(theta)
            }
          }

          burstParticles.geometry.attributes.position.needsUpdate = true
        }

        if (composer && qualitySettings.usePostProcessing) {
          composer.render()
        } else {
          renderer.render(scene, camera)
        }
      } catch (error) {
        console.error("Error in animation loop:", error)
        renderer.render(scene, camera)
      }
    }

    animate()

    // Cleanup function
    return () => {
      // Remove event listeners
      window.removeEventListener("resize", () => {})
      document.removeEventListener("mousemove", () => {})
      document.removeEventListener("click", () => {})

      // Dispose of Three.js resources
      renderer.dispose()

      // Dispose of audio resources
      if (audioContext) {
        audioContext.close()
      }
    }
  }, [])

  return (
    <div ref={containerRef} className="relative w-full h-screen overflow-hidden bg-black">
      {/* Loading progress */}
      <div
        id="progress-container"
        className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-black/80 p-4 rounded-lg z-10 w-64"
      >
        <div id="progress" className="text-white text-center mb-2">
          Loading Model: 0%
        </div>
        <div className="w-full bg-gray-700 rounded-full h-2.5">
          <div id="progress-bar" className="bg-blue-600 h-2.5 rounded-full" style={{ width: "0%" }}></div>
        </div>
      </div>

      {/* Main canvas */}
      <canvas ref={canvasRef} className="w-full h-full"></canvas>

      {/* Audio player (hidden) */}
      <audio id="audio-player" className="hidden" loop></audio>

      {/* Play button */}
      <button
        id="play-button"
        className="absolute bottom-8 left-1/2 transform -translate-x-1/2 bg-blue-600 hover:bg-blue-700 text-white py-2 px-6 rounded-full shadow-lg hidden"
      >
        Play Music
      </button>

      {/* Heading */}
      <h1
        id="heading"
        className="absolute top-8 left-1/2 transform -translate-x-1/2 text-white text-3xl font-bold hidden"
      >
        Audio Visualizer
      </h1>

      {/* Visualizer container */}
      <div
        id="visualizer-container"
        className="absolute bottom-20 left-1/2 transform -translate-x-1/2 w-3/4 max-w-3xl h-24 hidden"
      >
        <canvas ref={visualizerCanvasRef} id="visualizer" className="w-full h-full"></canvas>
      </div>
    </div>
  )
}

