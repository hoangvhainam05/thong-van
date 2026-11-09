"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { playTap, playSuccess } from "@/lib/audio-juice";

export default function Logistics3DSimulation({
  height = 480,
  showControls = true,
  interactive = true,
  autoRotate = false,
  className = "",
}) {
  const mountRef = useRef(null);
  const [themeMode, setThemeMode] = useState("night"); // 'night' | 'day' | 'sunset'
  const [camMode, setCamMode] = useState("iso"); // 'iso' | 'chase' | 'depot'
  const [speed, setSpeed] = useState(1);
  const [paused, setPaused] = useState(false);
  const [activeInfo, setActiveInfo] = useState(null);
  const [fps, setFps] = useState(60);

  // References across render loop
  const stateRef = useRef({
    themeMode: "night",
    camMode: "iso",
    speed: 1,
    paused: false,
    truckT: 0,
    dirLight: null,
    ambientLight: null,
    scene: null,
    camera: null,
    truckGroup: null,
    wheels: [],
    pathCurve: null,
    nodes: [],
    particles: null,
    headlightL: null,
    headlightR: null,
  });

  // Sync stateRef
  useEffect(() => {
    stateRef.current.themeMode = themeMode;
  }, [themeMode]);

  useEffect(() => {
    stateRef.current.camMode = camMode;
  }, [camMode]);

  useEffect(() => {
    stateRef.current.speed = speed;
  }, [speed]);

  useEffect(() => {
    stateRef.current.paused = paused;
  }, [paused]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let width = container.clientWidth || 800;
    let heightPx = container.clientHeight || height;

    // 1. Scene & Renderer
    const scene = new THREE.Scene();
    stateRef.current.scene = scene;

    const camera = new THREE.PerspectiveCamera(45, width / heightPx, 0.1, 1000);
    stateRef.current.camera = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setSize(width, heightPx);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;

    // Clear existing canvas
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
    container.appendChild(renderer.domElement);

    // 2. Lighting System
    const ambientLight = new THREE.AmbientLight(0x0e172a, 1.8);
    scene.add(ambientLight);
    stateRef.current.ambientLight = ambientLight;

    const dirLight = new THREE.DirectionalLight(0x60a5fa, 2.2);
    dirLight.position.set(25, 40, 20);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 120;
    const d = 35;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    scene.add(dirLight);
    stateRef.current.dirLight = dirLight;

    // Accent Pointlights (Hub glow & neon highway)
    const hubGlow = new THREE.PointLight(0x38bdf8, 3, 25);
    hubGlow.position.set(-18, 5, -12);
    scene.add(hubGlow);

    const destGlow = new THREE.PointLight(0xf59e0b, 2.5, 20);
    destGlow.position.set(16, 4, 14);
    scene.add(destGlow);

    // 3. Ground with cyber grid & road
    const groundGeo = new THREE.PlaneGeometry(80, 80);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x090d16,
      roughness: 0.85,
      metalness: 0.15,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05;
    ground.receiveShadow = true;
    scene.add(ground);

    // Grid Helper with cyber styling
    const grid = new THREE.GridHelper(80, 40, 0x1e3a8a, 0x1e293b);
    grid.position.y = 0.01;
    scene.add(grid);

    // 4. Logistics Route Curve (Waypoints: Depot -> Stop 1 -> Stop 2 -> Stop 3 -> Stop 4 -> Return)
    const waypoints = [
      new THREE.Vector3(-18, 0.1, -12), // Depot
      new THREE.Vector3(-8, 0.1, -14),
      new THREE.Vector3(2, 0.1, -10),   // Stop 1
      new THREE.Vector3(14, 0.1, -8),
      new THREE.Vector3(16, 0.1, 4),    // Stop 2
      new THREE.Vector3(8, 0.1, 14),    // Stop 3
      new THREE.Vector3(-6, 0.1, 16),   // Stop 4
      new THREE.Vector3(-16, 0.1, 8),
      new THREE.Vector3(-18, 0.1, -12), // Loop to Depot
    ];
    const pathCurve = new THREE.CatmullRomCurve3(waypoints, true, "centripetal", 0.5);
    stateRef.current.pathCurve = pathCurve;

    // Draw glowing road ribbon along the curve
    const pathPoints = pathCurve.getPoints(120);
    const roadShape = new THREE.Shape();
    roadShape.moveTo(-0.9, 0);
    roadShape.lineTo(0.9, 0);

    const roadGeo = new THREE.TubeGeometry(pathCurve, 120, 0.9, 4, true);
    const roadMat = new THREE.MeshStandardMaterial({
      color: 0x1b2838,
      roughness: 0.5,
      metalness: 0.2,
    });
    const roadMesh = new THREE.Mesh(roadGeo, roadMat);
    roadMesh.scale.set(1, 0.02, 1);
    roadMesh.position.y = 0.02;
    scene.add(roadMesh);

    // Glowing Neon Centerline
    const lineGeo = new THREE.BufferGeometry().setFromPoints(pathPoints.map(p => new THREE.Vector3(p.x, 0.08, p.z)));
    const lineMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, linewidth: 2 });
    const centerline = new THREE.Line(lineGeo, lineMat);
    scene.add(centerline);

    // 5. Buildings and Hub Models
    const nodes = [];

    // Central Depot (Kho Trung Tâm Thông Vân)
    const depotGroup = new THREE.Group();
    depotGroup.position.set(-18, 0, -12);
    depotGroup.userData = {
      type: "depot",
      title: "Tổng Kho Trung Tâm Tân Bình",
      desc: "Trung tâm phân loại tự động & điều phối VRPTW 5.000m²",
      status: "Sẵn sàng xuất bến 8 chuyến xe",
    };

    // Main depot hangar
    const hangarGeo = new THREE.BoxGeometry(7, 3.5, 9);
    const hangarMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.4, roughness: 0.3 });
    const hangar = new THREE.Mesh(hangarGeo, hangarMat);
    hangar.position.y = 1.75;
    hangar.castShadow = true;
    hangar.receiveShadow = true;
    depotGroup.add(hangar);

    // Roof glass strip
    const roofGeo = new THREE.BoxGeometry(6.6, 0.3, 3);
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, emissive: 0x0369a1, emissiveIntensity: 0.6, roughness: 0.2 });
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.set(0, 3.6, 0);
    depotGroup.add(roof);

    // Loading bays
    for (let b = -2; b <= 2; b += 2) {
      const bayGeo = new THREE.BoxGeometry(1.4, 1.8, 0.2);
      const bayMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xb45309, emissiveIntensity: 0.3 });
      const bay = new THREE.Mesh(bayGeo, bayMat);
      bay.position.set(b, 0.9, 4.51);
      depotGroup.add(bay);
    }

    // Antenna tower with pulsing light
    const towerGeo = new THREE.CylinderGeometry(0.08, 0.15, 3.5, 8);
    const towerMat = new THREE.MeshStandardMaterial({ color: 0x64748b });
    const tower = new THREE.Mesh(towerGeo, towerMat);
    tower.position.set(3, 4.5, -3.5);
    depotGroup.add(tower);

    const beaconGeo = new THREE.SphereGeometry(0.25, 8, 8);
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
    const beacon = new THREE.Mesh(beaconGeo, beaconMat);
    beacon.position.set(3, 6.3, -3.5);
    depotGroup.add(beacon);

    scene.add(depotGroup);
    nodes.push(depotGroup);

    // City Drop-off Stops (Residential apartments & villas)
    const stopsData = [
      {
        pos: [2, 0, -10],
        color: 0x334155,
        title: "Điểm #1: Chung cư Botanica Premier",
        desc: "Đơn TV-1082: Tủ lạnh Panasonic Inverter 410L",
        status: "Đã hoàn thành lắp đặt (10:15)",
        done: true,
      },
      {
        pos: [16, 0, 4],
        color: 0x1e3a5f,
        title: "Điểm #2: Nhà phố KDC Him Lam",
        desc: "Đơn TV-1084: Máy giặt sấy LG AI DD 11kg",
        status: "Xe đang di chuyển tới (ETA: 10:45)",
        active: true,
      },
      {
        pos: [8, 0, 14],
        color: 0x312e81,
        title: "Điểm #3: Biệt thự Phú Mỹ Hưng",
        desc: "Đơn TV-1089: Smart Tivi Sony Bravia 75 inch 4K",
        status: "Đang chờ đến lượt (#2 sau điểm Him Lam)",
      },
      {
        pos: [-6, 0, 16],
        color: 0x374151,
        title: "Điểm #4: Căn hộ Sunrise Riverside",
        desc: "Đơn TV-1092: Điều hoà Daikin Inverter 2.0 HP",
        status: "Khung giờ hẹn: 13:00 - 15:00",
      },
    ];

    stopsData.forEach((st, idx) => {
      const stopGroup = new THREE.Group();
      stopGroup.position.set(st.pos[0], st.pos[1], st.pos[2]);
      stopGroup.userData = { type: "stop", ...st };

      // Building block
      const height = 4 + (idx % 3) * 2;
      const bGeo = new THREE.BoxGeometry(3.5, height, 3.5);
      const bMat = new THREE.MeshStandardMaterial({
        color: st.color,
        roughness: 0.4,
        metalness: 0.3,
      });
      const bldg = new THREE.Mesh(bGeo, bMat);
      bldg.position.y = height / 2;
      bldg.castShadow = true;
      bldg.receiveShadow = true;
      stopGroup.add(bldg);

      // Windows (grid dots)
      const winGeo = new THREE.BoxGeometry(0.35, 0.45, 0.05);
      const winMat = new THREE.MeshBasicMaterial({ color: st.active ? 0xfef08a : 0x7dd3fc });
      for (let y = 1; y < height - 0.5; y += 1) {
        for (let x = -1.2; x <= 1.2; x += 0.8) {
          const win = new THREE.Mesh(winGeo, winMat);
          win.position.set(x, y, 1.76);
          stopGroup.add(win);
        }
      }

      // Floating Stop Marker with radar ring
      const ringGeo = new THREE.RingGeometry(1.6, 1.9, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: st.active ? 0xf59e0b : st.done ? 0x10b981 : 0x38bdf8,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.05;
      stopGroup.add(ring);
      stopGroup.userData.ring = ring;

      // Holographic parcel icon bobbing
      const parcelGeo = new THREE.BoxGeometry(0.7, 0.6, 0.7);
      const parcelMat = new THREE.MeshStandardMaterial({
        color: st.active ? 0xf59e0b : 0x0284c7,
        emissive: st.active ? 0xb45309 : 0x0369a1,
        emissiveIntensity: 0.4,
      });
      const parcel = new THREE.Mesh(parcelGeo, parcelMat);
      parcel.position.set(0, height + 1.2, 0);
      stopGroup.add(parcel);
      stopGroup.userData.parcel = parcel;

      scene.add(stopGroup);
      nodes.push(stopGroup);
    });

    stateRef.current.nodes = nodes;

    // 6. The 3D Smart Delivery Truck (Thông Vân EV-Truck)
    const truckGroup = new THREE.Group();
    truckGroup.userData = {
      type: "truck",
      title: "Xe Giao Hàng TV-Express 01",
      desc: "Xe tải điện thông minh 1.5 tấn · Tối ưu tải trọng VRPTW 92%",
      status: "Tốc độ: 42 km/h · Pin: 84% · Nhiệt độ thùng: 24°C",
    };

    // Chassis
    const chassisGeo = new THREE.BoxGeometry(1.8, 0.4, 3.6);
    const chassisMat = new THREE.MeshStandardMaterial({ color: 0x111827 });
    const chassis = new THREE.Mesh(chassisGeo, chassisMat);
    chassis.position.y = 0.45;
    truckGroup.add(chassis);

    // Cab (Cabin tài xế)
    const cabGeo = new THREE.BoxGeometry(1.7, 1.1, 1.2);
    const cabMat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.3, roughness: 0.2 });
    const cab = new THREE.Mesh(cabGeo, cabMat);
    cab.position.set(0, 1.15, 1.1);
    cab.castShadow = true;
    truckGroup.add(cab);

    // Windshield (kính chắn gió góc nghiêng đẹp)
    const windGeo = new THREE.BoxGeometry(1.5, 0.6, 0.3);
    const windMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.1, metalness: 0.8 });
    const wind = new THREE.Mesh(windGeo, windMat);
    wind.position.set(0, 1.25, 1.7);
    wind.rotation.x = 0.2;
    truckGroup.add(wind);

    // Cargo Container (Thùng hàng Thông Vân)
    const cargoGeo = new THREE.BoxGeometry(1.76, 1.5, 2.3);
    const cargoMat = new THREE.MeshStandardMaterial({ color: 0x1b4f8c, metalness: 0.2, roughness: 0.3 });
    const cargo = new THREE.Mesh(cargoGeo, cargoMat);
    cargo.position.set(0, 1.35, -0.65);
    cargo.castShadow = true;
    truckGroup.add(cargo);

    // Cargo Branding Stripe (Yellow Signal Amber)
    const stripeGeo = new THREE.BoxGeometry(1.8, 0.2, 2.32);
    const stripeMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xd97706, emissiveIntensity: 0.3 });
    const stripe = new THREE.Mesh(stripeGeo, stripeMat);
    stripe.position.set(0, 1.35, -0.65);
    truckGroup.add(stripe);

    // Headlights (Đèn pha LED sáng rực rọi xuống mặt đường)
    const headMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const hl1 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.15, 0.1), headMat);
    hl1.position.set(-0.6, 0.95, 1.72);
    truckGroup.add(hl1);
    const hl2 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.15, 0.1), headMat);
    hl2.position.set(0.6, 0.95, 1.72);
    truckGroup.add(hl2);

    // Spotlights for beam projection
    const spotL = new THREE.SpotLight(0xffffff, 5, 12, Math.PI / 6, 0.5, 1);
    spotL.position.set(-0.6, 0.95, 1.75);
    spotL.target.position.set(-0.6, 0, 8);
    truckGroup.add(spotL);
    truckGroup.add(spotL.target);

    const spotR = new THREE.SpotLight(0xffffff, 5, 12, Math.PI / 6, 0.5, 1);
    spotR.position.set(0.6, 0.95, 1.75);
    spotR.target.position.set(0.6, 0, 8);
    truckGroup.add(spotR);
    truckGroup.add(spotR.target);

    stateRef.current.headlightL = spotL;
    stateRef.current.headlightR = spotR;

    // 4 Wheels with rotation
    const wheels = [];
    const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.25, 16);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.9 });
    const rimGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.26, 8);
    const rimMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8 });

    const wheelPositions = [
      [-0.95, 0.35, 1.0],
      [0.95, 0.35, 1.0],
      [-0.95, 0.35, -1.0],
      [0.95, 0.35, -1.0],
    ];

    wheelPositions.forEach((wp) => {
      const wheelGroup = new THREE.Group();
      wheelGroup.position.set(wp[0], wp[1], wp[2]);

      const tire = new THREE.Mesh(wheelGeo, wheelMat);
      tire.rotation.z = Math.PI / 2;
      tire.castShadow = true;
      wheelGroup.add(tire);

      const rim = new THREE.Mesh(rimGeo, rimMat);
      rim.rotation.z = Math.PI / 2;
      wheelGroup.add(rim);

      truckGroup.add(wheelGroup);
      wheels.push(wheelGroup);
    });

    stateRef.current.wheels = wheels;
    scene.add(truckGroup);
    stateRef.current.truckGroup = truckGroup;

    // 7. Particle Dust Trail behind truck
    const particleCount = 40;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    for (let p = 0; p < particleCount * 3; p++) {
      particlePositions[p] = 0;
    }
    particleGeo.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0x60a5fa,
      size: 0.18,
      transparent: true,
      opacity: 0.6,
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);
    stateRef.current.particles = particles;
    const particleAges = new Float32Array(particleCount).fill(100);

    // 8. Camera Initial Position
    camera.position.set(24, 30, 36);
    camera.lookAt(0, 0, 0);

    // 9. Mouse Orbit & Raycasting Interaction
    let isDragging = false;
    let prevMouse = { x: 0, y: 0 };
    let cameraAngle = { theta: 0.8, phi: 0.7, radius: 48 };

    const onMouseDown = (e) => {
      isDragging = true;
      prevMouse = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e) => {
      if (!isDragging) return;
      const dx = (e.clientX - prevMouse.x) * 0.006;
      const dy = (e.clientY - prevMouse.y) * 0.006;
      prevMouse = { x: e.clientX, y: e.clientY };

      cameraAngle.theta -= dx;
      cameraAngle.phi = Math.max(0.2, Math.min(Math.PI / 2 - 0.05, cameraAngle.phi - dy));
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    const onWheel = (e) => {
      e.preventDefault();
      cameraAngle.radius = Math.max(18, Math.min(85, cameraAngle.radius + e.deltaY * 0.04));
    };

    // Touch support for mobile devices
    const onTouchStart = (e) => {
      if (e.touches.length === 1) {
        isDragging = true;
        prevMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    };

    const onTouchMove = (e) => {
      if (!isDragging || e.touches.length !== 1) return;
      const dx = (e.touches[0].clientX - prevMouse.x) * 0.008;
      const dy = (e.touches[0].clientY - prevMouse.y) * 0.008;
      prevMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      cameraAngle.theta -= dx;
      cameraAngle.phi = Math.max(0.2, Math.min(Math.PI / 2 - 0.05, cameraAngle.phi - dy));
    };

    const onTouchEnd = () => {
      isDragging = false;
    };

    const raycaster = new THREE.Raycaster();
    const mouseCoord = new THREE.Vector2();

    const onClick = (e) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouseCoord.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseCoord.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouseCoord, camera);
      const interactables = [...nodes, truckGroup];
      const intersects = raycaster.intersectObjects(interactables, true);

      if (intersects.length > 0) {
        let obj = intersects[0].object;
        while (obj && !obj.userData?.title && obj.parent) {
          obj = obj.parent;
        }
        if (obj?.userData?.title) {
          setActiveInfo(obj.userData);
          playTap(1000, 0.06);
        }
      }
    };

    const dom = renderer.domElement;
    dom.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    dom.addEventListener("wheel", onWheel, { passive: false });
    dom.addEventListener("click", onClick);
    dom.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd);

    // 10. Animation & Render Loop
    let animId = null;
    const timer = typeof THREE.Timer === "function" ? new THREE.Timer() : null;
    let lastTime = performance.now();
    let frameCount = 0;
    let lastFpsUpdate = 0;

    const animate = () => {
      animId = requestAnimationFrame(animate);
      let delta = 0.016;
      let elapsed = 0;
      if (timer) {
        timer.update();
        delta = timer.getDelta();
        elapsed = timer.getElapsed();
      } else {
        const now = performance.now();
        delta = Math.min((now - lastTime) / 1000, 0.1);
        lastTime = now;
        elapsed = now / 1000;
      }

      // FPS Counter
      frameCount++;
      if (elapsed - lastFpsUpdate > 1) {
        setFps(Math.round(frameCount / (elapsed - lastFpsUpdate)));
        frameCount = 0;
        lastFpsUpdate = elapsed;
      }

      // Theme Update
      const curTheme = stateRef.current.themeMode;
      if (curTheme === "day") {
        scene.background = new THREE.Color(0xf0fdf4);
        ambientLight.color.setHex(0xffffff);
        ambientLight.intensity = 1.4;
        dirLight.color.setHex(0xfef08a);
        dirLight.intensity = 2.0;
        groundMat.color.setHex(0xdcfce7);
        grid.material.color.setHex(0x86efac);
      } else if (curTheme === "sunset") {
        scene.background = new THREE.Color(0x1a1026);
        ambientLight.color.setHex(0xf472b6);
        ambientLight.intensity = 1.2;
        dirLight.color.setHex(0xfb923c);
        dirLight.intensity = 2.4;
        groundMat.color.setHex(0x271938);
        grid.material.color.setHex(0x7c3aed);
      } else {
        // Night Cyber
        scene.background = new THREE.Color(0x060911);
        ambientLight.color.setHex(0x0e172a);
        ambientLight.intensity = 1.8;
        dirLight.color.setHex(0x60a5fa);
        dirLight.intensity = 2.2;
        groundMat.color.setHex(0x090d16);
        grid.material.color.setHex(0x1e3a8a);
      }

      // Truck Movement
      if (!stateRef.current.paused) {
        const moveStep = (delta * 0.045 * stateRef.current.speed);
        stateRef.current.truckT = (stateRef.current.truckT + moveStep) % 1;
      }

      const t = stateRef.current.truckT;
      const point = pathCurve.getPointAt(t);
      const nextPoint = pathCurve.getPointAt((t + 0.005) % 1);

      truckGroup.position.copy(point);

      // Facing tangent with slight dynamic sway
      const dir = new THREE.Vector3().subVectors(nextPoint, point).normalize();
      const targetAngle = Math.atan2(dir.x, dir.z);
      truckGroup.rotation.y = targetAngle;
      truckGroup.rotation.z = Math.sin(elapsed * 8) * 0.02; // Suspension sway

      // Spin Wheels
      wheels.forEach((w) => {
        w.children[0].rotation.x += delta * 15 * stateRef.current.speed;
        w.children[1].rotation.x += delta * 15 * stateRef.current.speed;
      });

      // Beacon blinking on depot
      beacon.material.opacity = (Math.sin(elapsed * 6) + 1) * 0.5;

      // Animate node markers (rings pulsation & parcels hover)
      nodes.forEach((nd) => {
        if (nd.userData?.parcel) {
          nd.userData.parcel.rotation.y += delta * 1.5;
          nd.userData.parcel.position.y += Math.sin(elapsed * 3 + nd.position.x) * 0.004;
        }
        if (nd.userData?.ring) {
          const s = 1 + Math.sin(elapsed * 4) * 0.08;
          nd.userData.ring.scale.set(s, s, s);
        }
      });

      // Update Particle Trail
      const pPos = particles.geometry.attributes.position.array;
      for (let i = 0; i < particleCount; i++) {
        particleAges[i] += delta;
        if (particleAges[i] > 1.2 && !stateRef.current.paused) {
          particleAges[i] = 0;
          // Spawn at truck back
          const backOffset = new THREE.Vector3(0, 0.4, -1.8).applyAxisAngle(new THREE.Vector3(0, 1, 0), targetAngle);
          pPos[i * 3] = point.x + backOffset.x + (Math.random() - 0.5) * 0.3;
          pPos[i * 3 + 1] = 0.2 + Math.random() * 0.2;
          pPos[i * 3 + 2] = point.z + backOffset.z + (Math.random() - 0.5) * 0.3;
        } else {
          pPos[i * 3 + 1] += delta * 0.3; // Rise
        }
      }
      particles.geometry.attributes.position.needsUpdate = true;

      // Camera Control Mode
      const camMode = stateRef.current.camMode;
      if (camMode === "chase") {
        // Smoothly follow behind truck
        const behind = new THREE.Vector3(0, 4.5, -9).applyAxisAngle(new THREE.Vector3(0, 1, 0), targetAngle);
        const desiredCamPos = new THREE.Vector3().copy(point).add(behind);
        camera.position.lerp(desiredCamPos, 0.06);
        camera.lookAt(point.x, point.y + 1.2, point.z);
      } else if (camMode === "depot") {
        camera.position.lerp(new THREE.Vector3(-10, 10, -3), 0.05);
        camera.lookAt(-18, 2, -12);
      } else {
        // Isometric Orbit
        if (autoRotate && !isDragging) {
          cameraAngle.theta += delta * 0.08;
        }
        const x = cameraAngle.radius * Math.sin(cameraAngle.phi) * Math.sin(cameraAngle.theta);
        const y = cameraAngle.radius * Math.cos(cameraAngle.phi);
        const z = cameraAngle.radius * Math.sin(cameraAngle.phi) * Math.cos(cameraAngle.theta);
        camera.position.set(x, y, z);
        camera.lookAt(0, 0, 0);
      }

      renderer.render(scene, camera);
    };

    animate();

    // 11. Resize handling
    const resizeObserver = new ResizeObserver(() => {
      if (!container) return;
      const newWidth = container.clientWidth;
      const newHeight = container.clientHeight || height;
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
    });
    resizeObserver.observe(container);

    // Cleanup
    return () => {
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
      dom.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      dom.removeEventListener("wheel", onWheel);
      dom.removeEventListener("click", onClick);
      dom.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      renderer.dispose();
      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }
    };
  }, [height, autoRotate]);

  return (
    <div className={`logistics-3d-wrapper ${className}`} style={{ position: "relative", width: "100%", height }}>
      {/* Three.js Canvas Container */}
      <div ref={mountRef} style={{ width: "100%", height: "100%", borderRadius: "inherit", overflow: "hidden" }} />

      {/* Cyber HUD Overlay Top Bar */}
      {showControls && (
        <div className="logistics-3d-hud-top">
          <div className="hud-badge">
            <span className="live-dot" />
            <span>SA BÀN 3D DIGITAL TWIN • VRPTW ENGINE</span>
            <span className="fps-counter">{fps} FPS</span>
          </div>

          <div className="hud-controls-row">
            {/* Camera angle selection */}
            <div className="hud-pill-group">
              <button
                type="button"
                className={`hud-pill ${camMode === "iso" ? "on" : ""}`}
                onClick={() => { setCamMode("iso"); playTap(700); }}
                title="Góc nhìn Toàn cảnh Sa bàn"
              >
                📐 Sa bàn
              </button>
              <button
                type="button"
                className={`hud-pill ${camMode === "chase" ? "on" : ""}`}
                onClick={() => { setCamMode("chase"); playTap(850); }}
                title="Góc nhìn Theo đuôi xe tải"
              >
                🚚 Theo xe
              </button>
              <button
                type="button"
                className={`hud-pill ${camMode === "depot" ? "on" : ""}`}
                onClick={() => { setCamMode("depot"); playTap(950); }}
                title="Góc nhìn Tổng kho Tân Bình"
              >
                🏢 Tổng kho
              </button>
            </div>

            {/* Environment Lighting */}
            <div className="hud-pill-group">
              <button
                type="button"
                className={`hud-pill ${themeMode === "night" ? "on" : ""}`}
                onClick={() => { setThemeMode("night"); playTap(); }}
                title="Ánh sáng Cyber Neon Ban đêm"
              >
                🌙 Đêm
              </button>
              <button
                type="button"
                className={`hud-pill ${themeMode === "day" ? "on" : ""}`}
                onClick={() => { setThemeMode("day"); playTap(); }}
                title="Ánh sáng Ban ngày"
              >
                ☀️ Ngày
              </button>
              <button
                type="button"
                className={`hud-pill ${themeMode === "sunset" ? "on" : ""}`}
                onClick={() => { setThemeMode("sunset"); playTap(); }}
                title="Ánh sáng Hoàng hôn"
              >
                🌆 Hoàng hôn
              </button>
            </div>

            {/* Simulation speed */}
            <div className="hud-pill-group">
              <button
                type="button"
                className={`hud-pill ${paused ? "on" : ""}`}
                onClick={() => { setPaused(!paused); playTap(); }}
              >
                {paused ? "▶ Tiếp tục" : "⏸ Dừng"}
              </button>
              <button
                type="button"
                className="hud-pill"
                onClick={() => {
                  const nextSpeed = speed === 1 ? 2 : speed === 2 ? 4 : 1;
                  setSpeed(nextSpeed);
                  playTap(600 + nextSpeed * 200);
                }}
              >
                ⚡ {speed}x
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Info Card when an object is selected */}
      {activeInfo && (
        <div className="logistics-3d-popup">
          <div className="popup-header">
            <span className="popup-tag">
              {activeInfo.type === "truck" ? "🚚 PHƯƠNG TIỆN" : activeInfo.type === "depot" ? "🏢 TRUNG TÂM" : "📍 ĐIỂM GIAO HÀNG"}
            </span>
            <button className="popup-close" onClick={() => setActiveInfo(null)}>✕</button>
          </div>
          <div className="popup-title">{activeInfo.title}</div>
          <div className="popup-desc">{activeInfo.desc}</div>
          <div className="popup-status">
            <span className="popup-status-dot" />
            {activeInfo.status}
          </div>
        </div>
      )}

      {/* Bottom Hint */}
      <div className="logistics-3d-hud-bottom">
        <span>💡 Giữ chuột trái & kéo để xoay góc 360° · Cuộn chuột để phóng to/thu nhỏ · Nhấp vào xe hoặc tòa nhà để xem chi tiết</span>
      </div>
    </div>
  );
}
