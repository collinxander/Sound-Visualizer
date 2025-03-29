"use client"

import type React from "react"

import { useEffect, useRef, useState } from "react"
import * as THREE from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader"

interface MusicVisualizerProps {
  audioRef: React.RefObject<HTMLAudioElement>
  isPlaying: boolean
}

export default function MusicVisualizer({ audioRef, isPlaying }: MusicVisualizerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null)
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null)
  const [dataArray, setDataArray] = useState<Uint8Array | null>(null)
  const [scene, setScene] = useState<THREE.Scene | null>(null)
  const [wormhole, setWormhole] = useState<THREE.Mesh | null>(null)
  const [soundWavePlane, setSoundWavePlane] = useState<THREE.Mesh | null>(null)
  const [asteroids, setAsteroids] = useState<THREE.Object3D[]>([])
  const [galaxies, setGalaxies] = useState<THREE.Points[]>([])
  const [model, setModel] = useState<THREE.Object3D | null>(null)

  // Initialize Three.js scene
  useEffect(() => {
    if (!containerRef.current) return

    // Create scene
    const newScene = new THREE.Scene()
    newScene.fog = new THREE.FogExp2(0x000000, 0.001)

    // Create renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.setClearColor(0x000000)
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    containerRef.current.appendChild(renderer.domElement)

    // Create camera
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000)
    camera.position.set(0, 10, 30)

    // Create controls
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.05
    controls.enablePan = false
    controls.minDistance = 10
    controls.maxDistance = 100
    controls.autoRotate = true
    controls.autoRotateSpeed = 0.2
    controls.update()

    // Create starfield
    const starGeometry = new THREE.BufferGeometry()
    const starCount = 10000
    const starPositions = new Float32Array(starCount * 3)
    const starSizes = new Float32Array(starCount)

    for (let i = 0; i < starCount; i++) {
      const i3 = i * 3
      starPositions[i3] = (Math.random() - 0.5) * 2000
      starPositions[i3 + 1] = (Math.random() - 0.5) * 2000
      starPositions[i3 + 2] = (Math.random() - 0.5) * 2000
      starSizes[i] = Math.random() * 2
    }

    starGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3))
    starGeometry.setAttribute("size", new THREE.BufferAttribute(starSizes, 1))

    const starMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 1,
      transparent: true,
      sizeAttenuation: true,
      blending: THREE.AdditiveBlending,
      vertexColors: false,
    })

    const stars = new THREE.Points(starGeometry, starMaterial)
    newScene.add(stars)

    // Create wormhole
    const wormholeGeometry = new THREE.TorusGeometry(15, 3, 16, 100)
    const wormholeMaterial = new THREE.MeshStandardMaterial({
      color: 0x0033ff,
      emissive: 0x0033ff,
      emissiveIntensity: 0.5,
      side: THREE.DoubleSide,
      wireframe: true,
    })
    const wormholeMesh = new THREE.Mesh(wormholeGeometry, wormholeMaterial)
    wormholeMesh.rotation.x = Math.PI / 2
    wormholeMesh.position.z = -50
    newScene.add(wormholeMesh)
    setWormhole(wormholeMesh)

    // Create sound wave plane
    const planeGeometry = new THREE.PlaneGeometry(40, 40, 64, 64)
    const planeMaterial = new THREE.MeshStandardMaterial({
      color: 0x00ffff,
      wireframe: true,
      side: THREE.DoubleSide,
      emissive: 0x00ffff,
      emissiveIntensity: 0.2,
    })
    const planeMesh = new THREE.Mesh(planeGeometry, planeMaterial)
    planeMesh.rotation.x = Math.PI / 2
    planeMesh.position.y = -10
    newScene.add(planeMesh)
    setSoundWavePlane(planeMesh)

    // Create asteroids
    const asteroidGeometries = [
      new THREE.IcosahedronGeometry(1, 0),
      new THREE.DodecahedronGeometry(1, 0),
      new THREE.TetrahedronGeometry(1, 0),
    ]

    const asteroidMaterial = new THREE.MeshStandardMaterial({
      color: 0x888888,
      roughness: 0.9,
      metalness: 0.1,
    })

    const asteroidObjects: THREE.Object3D[] = []
    for (let i = 0; i < 50; i++) {
      const geometry = asteroidGeometries[Math.floor(Math.random() * asteroidGeometries.length)]
      const asteroid = new THREE.Mesh(geometry, asteroidMaterial.clone())

      // Random position in a spherical distribution
      const radius = 50 + Math.random() * 100
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)

      asteroid.position.x = radius * Math.sin(phi) * Math.cos(theta)
      asteroid.position.y = radius * Math.sin(phi) * Math.sin(theta)
      asteroid.position.z = radius * Math.cos(phi)

      // Random scale
      const scale = 0.5 + Math.random() * 2
      asteroid.scale.set(scale, scale, scale)

      // Random rotation
      asteroid.rotation.x = Math.random() * Math.PI
      asteroid.rotation.y = Math.random() * Math.PI
      asteroid.rotation.z =
        Math.random() * Math.PI
      
      // Store initial position for animation
      (asteroid as any).initialPosition =
        asteroid.position.clone()(asteroid as any).orbitSpeed =
        0.001 + Math.random() * 0.005
      (asteroid as any).orbitRadius =
        5 + Math.random() * 10
      (asteroid as any).orbitOffset =
          Math.random() * Math.PI * 2

      newScene.add(asteroid)
      asteroidObjects.push(asteroid)
    }
    setAsteroids(asteroidObjects)

    // Create galaxies
    const galaxyColors = [
      new THREE.Color(0xff9999), // Reddish
      new THREE.Color(0x99ccff), // Bluish
      new THREE.Color(0xffcc99), // Orangish
      new THREE.Color(0xcc99ff), // Purplish
    ]

    const galaxyObjects: THREE.Points[] = []
    for (let g = 0; g < 3; g++) {
      const galaxyGeometry = new THREE.BufferGeometry()
      const galaxyParticleCount = 5000
      const galaxyPositions = new Float32Array(galaxyParticleCount * 3)
      const galaxyColors = new Float32Array(galaxyParticleCount * 3)

      const galaxyColor = new THREE.Color()
      galaxyColor.setHSL(Math.random(), 0.7, 0.5)

      const arms = 3 + Math.floor(Math.random() * 3)
      const armWidth = 0.5 + Math.random() * 0.5

      for (let i = 0; i < galaxyParticleCount; i++) {
        const i3 = i * 3

        // Spiral galaxy distribution
        const radius = 5 + Math.pow(Math.random(), 2) * 30
        const spinAngle = radius * 0.5
        const armAngle = (Math.floor(Math.random() * arms) / arms) * Math.PI * 2
        const angle = armAngle + spinAngle + Math.random() * armWidth

        galaxyPositions[i3] = Math.cos(angle) * radius
        galaxyPositions[i3 + 1] = (Math.random() - 0.5) * radius * 0.1
        galaxyPositions[i3 + 2] = Math.sin(angle) * radius

        // Color variation
        const hue = (angle / (Math.PI * 2)) % 1
        const color = new THREE.Color().setHSL(hue, 0.7, 0.5 + Math.random() * 0.2)
        galaxyColors[i3] = color.r
        galaxyColors[i3 + 1] = color.g
        galaxyColors[i3 + 2] = color.b
      }

      galaxyGeometry.setAttribute("position", new THREE.BufferAttribute(galaxyPositions, 3))
      galaxyGeometry.setAttribute("color", new THREE.BufferAttribute(galaxyColors, 3))

      const galaxyMaterial = new THREE.PointsMaterial({
        size: 0.5,
        transparent: true,
        opacity: 0.8,
        vertexColors: true,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
      })

      const galaxy = new THREE.Points(galaxyGeometry, galaxyMaterial)

      // Position the galaxy
      galaxy.position.set((Math.random() - 0.5) * 150, (Math.random() - 0.5) * 150, (Math.random() - 0.5) * 150)

      // Rotate the galaxy
      galaxy.rotation.x = Math.random() * Math.PI
      galaxy.rotation.y = Math.random() * Math.PI
      galaxy.rotation.z = Math.random() * Math.PI
      
      // Store rotation speed for animation
      (galaxy as any).rotationSpeed = {
        x: (Math.random() - 0.5) * 0.001,
        y: (Math.random() - 0.5) * 0.001,
        z: (Math.random() - 0.5) * 0.001,
      }

      newScene.add(galaxy)
      galaxyObjects.push(galaxy)
    }
    setGalaxies(galaxyObjects)

    // Add ambient light for better visibility
    const ambientLight = new THREE.AmbientLight(0x404040, 2)
    newScene.add(ambientLight)

    // Add directional colored lights
    const blueLight = new THREE.PointLight(0x0033ff, 50, 100)
    blueLight.position.set(30, 30, 30)
    newScene.add(blueLight)

    const purpleLight = new THREE.PointLight(0x9900ff, 50, 100)
    purpleLight.position.set(-30, -30, 30)
    newScene.add(purpleLight)

    // Load 3D model
    const loader = new GLTFLoader()
    loader.load("/collinship/collin.gltf", (gltf) => {
      const mesh = gltf.scene

      mesh.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          child.castShadow = true
          child.receiveShadow = true

          // Add emissive properties to make the ship glow
          if ((child as THREE.Mesh).material) {
            const material = (child as THREE.Mesh).material as THREE.MeshStandardMaterial
            material.emissive = new THREE.Color(0x0066ff)
            material.emissiveIntensity = 0.5
          }
        }
      })

      mesh.position.set(0, 0, 0)
      mesh.scale.set(0.5, 0.5, 0.5)
      newScene.add(mesh)
      setModel(mesh)
    })

    setScene(newScene)

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate)
      controls.update()

      // Animate stars (subtle twinkling)
      const positions = stars.geometry.attributes.position.array
      const sizes = stars.geometry.attributes.size.array
      for (let i = 0; i < starCount; i++) {
        sizes[i] = Math.max(0.1, Math.sin(Date.now() * 0.001 + i) * 1.5)
      }
      stars.geometry.attributes.size.needsUpdate = true

      // Rotate wormhole
      if (wormholeMesh) {
        wormholeMesh.rotation.z += 0.002
      }

      // Animate asteroids
      asteroidObjects.forEach((asteroid) => {
        asteroid.rotation.x += 0.01
        asteroid.rotation.y += 0.01

        // Orbit movement
        const time = Date.now() * (asteroid as any).orbitSpeed
        const radius = (asteroid as any).orbitRadius
        const initialPos = (asteroid as any).initialPosition

        asteroid.position.x = initialPos.x + Math.cos(time + (asteroid as any).orbitOffset) * radius
        asteroid.position.y = initialPos.y + Math.sin(time + (asteroid as any).orbitOffset) * radius
        asteroid.position.z = initialPos.z + Math.cos(time * 0.5 + (asteroid as any).orbitOffset) * radius
      })

      // Rotate galaxies
      galaxyObjects.forEach((galaxy) => {
        galaxy.rotation.x += (galaxy as any).rotationSpeed.x
        galaxy.rotation.y += (galaxy as any).rotationSpeed.y
        galaxy.rotation.z += (galaxy as any).rotationSpeed.z
      })

      // Animate lights
      const time = Date.now() * 0.001
      blueLight.position.x = Math.sin(time * 0.3) * 50
      blueLight.position.z = Math.cos(time * 0.3) * 50
      purpleLight.position.x = Math.sin(time * 0.3 + Math.PI) * 50
      purpleLight.position.z = Math.cos(time * 0.3 + Math.PI) * 50

      renderer.render(newScene, camera)
    }

    animate()

    // Handle window resize
    const handleResize = () => {
      if (!containerRef.current) return

      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()
      renderer.setSize(window.innerWidth, window.innerHeight)
    }

    window.addEventListener("resize", handleResize)

    return () => {
      window.removeEventListener("resize", handleResize)
      containerRef.current?.removeChild(renderer.domElement)
      renderer.dispose()
    }
  }, [])

  // Initialize Audio Context and Analyzer
  useEffect(() => {
    if (!audioRef.current) return

    const context = new (window.AudioContext || (window as any).webkitAudioContext)()
    const audioSource = context.createMediaElementSource(audioRef.current)
    const audioAnalyser = context.createAnalyser()

    audioAnalyser.fftSize = 256
    const bufferLength = audioAnalyser.frequencyBinCount
    const newDataArray = new Uint8Array(bufferLength)

    audioSource.connect(audioAnalyser)
    audioAnalyser.connect(context.destination)

    setAudioContext(context)
    setAnalyser(audioAnalyser)
    setDataArray(newDataArray)

    return () => {
      audioSource.disconnect()
      audioAnalyser.disconnect()
      context.close()
    }
  }, [audioRef])

  // Update visualizer based on audio data
  useEffect(() => {
    if (!analyser || !dataArray || !isPlaying || !scene) return

    const updateVisualizer = () => {
      analyser.getByteFrequencyData(dataArray)

      // Update sound wave plane
      if (soundWavePlane) {
        const positions = (soundWavePlane.geometry as THREE.PlaneGeometry).attributes.position.array
        const vertex = new THREE.Vector3()
        const count = positions.length / 3

        for (let i = 0; i < count; i++) {
          vertex.fromBufferAttribute((soundWavePlane.geometry as THREE.PlaneGeometry).attributes.position, i)

          // Original vertex position (flat plane)
          const originalZ = vertex.z

          // Calculate distance from center
          const distance = Math.sqrt(vertex.x * vertex.x + vertex.y * vertex.y)

          // Get frequency data based on distance
          const index = Math.min(dataArray.length - 1, Math.floor((distance / 20) * dataArray.length))
          const value = dataArray[index] / 255

          // Apply wave effect
          const time = Date.now() * 0.001
          const waveHeight = value * 5
          const wave = Math.sin(distance - time * 2) * waveHeight

          // Update z position
          positions[i * 3 + 2] = originalZ + wave
        }
        ;(soundWavePlane.geometry as THREE.PlaneGeometry).attributes.position.needsUpdate = true

        // Update color based on average frequency
        const avgFrequency = Array.from(dataArray).reduce((sum, val) => sum + val, 0) / dataArray.length / 255
        const hue = avgFrequency * 0.3 + 0.6 // Blue to purple range
        const color = (new THREE.Color()
          .setHSL(
            hue,
            1,
            0.5,
          )(soundWavePlane.material as THREE.MeshStandardMaterial)
          .color.copy(color)(soundWavePlane.material as THREE.MeshStandardMaterial)
          .emissive.copy(color)(soundWavePlane.material as THREE.MeshStandardMaterial).emissiveIntensity =
          avgFrequency * 0.5 + 0.2)
      }

      // Update wormhole based on bass frequencies
      if (wormhole) {
        const bassAvg = Array.from(dataArray.slice(0, 5)).reduce((a, b) => a + b, 0) / 5 / 255

        // Pulse the wormhole
        const scale = 1 + bassAvg * 0.5
        wormhole.scale.set(scale, scale, scale)

        // Change color based on frequency
        const hue = bassAvg * 0.2 + 0.6 // Blue to purple range
        const color = (new THREE.Color()
          .setHSL(
            hue,
            1,
            0.5,
          )(wormhole.material as THREE.MeshStandardMaterial)
          .color.copy(color)(wormhole.material as THREE.MeshStandardMaterial)
          .emissive.copy(color)(wormhole.material as THREE.MeshStandardMaterial).emissiveIntensity =
          bassAvg * 0.8 + 0.2)

        // Increase rotation speed with bass
        wormhole.rotation.z += 0.002 + bassAvg * 0.01
      }

      // Make the model react to mid frequencies
      if (model) {
        const midAvg = Array.from(dataArray.slice(5, 15)).reduce((a, b) => a + b, 0) / 10 / 255

        // Move the model
        model.position.y = midAvg * 2
        model.rotation.y += 0.01 + midAvg * 0.05

        // Pulse the model scale
        const scale = 0.5 + midAvg * 0.2
        model.scale.set(scale, scale, scale)
      }

      // Update galaxies based on high frequencies
      galaxies.forEach((galaxy, index) => {
        const highAvg =
          (Array.from(dataArray.slice(15, 30)).reduce((a, b) => a + b, 0) / 15 / 255
        
        // Increase rotation speed with high frequencies
        (galaxy as any).rotationSpeed.x =
          (Math.random() - 0.5) * 0.001 * (1 + highAvg * 2)
        (galaxy as any).rotationSpeed.y =
          (Math.random() - 0.5) * 0.001 * (1 + highAvg * 2)
        (galaxy as any).rotationSpeed.z =
            (Math.random() - 0.5) * 0.001 * (1 + highAvg * 2))

        // Pulse the galaxy
        const scale = 1 + highAvg * 0.5
        galaxy.scale.set(scale, scale, scale)
      })

      if (isPlaying) {
        requestAnimationFrame(updateVisualizer)
      }
    }

    updateVisualizer()
  }, [analyser, dataArray, isPlaying, scene, soundWavePlane, wormhole, model, galaxies, asteroids])

  // Resume audio context on user interaction
  useEffect(() => {
    if (isPlaying && audioContext?.state === "suspended") {
      audioContext.resume()
    }
  }, [isPlaying, audioContext])

  return <div ref={containerRef} className="w-full h-full" />
}

