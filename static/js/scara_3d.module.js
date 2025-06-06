import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.157.0/build/three.module.js";
import { STLLoader } from "https://cdn.jsdelivr.net/npm/three@0.157.0/examples/jsm/loaders/STLLoader.js";
import { OrbitControls } from "https://cdn.jsdelivr.net/npm/three@0.157.0/examples/jsm/controls/OrbitControls.js";

document.addEventListener("DOMContentLoaded", () => {
    function logToTerminal(message, success = true) {
        if (typeof window.logMessage === "function") {
            window.logMessage(message, success);
        }
        if (success) {
            console.log(message);
        } else {
            console.warn(message);
        }
    }

    logToTerminal("✅ Módulo SCARA 3D inicializado", true);

    let renderer, scene, camera, controls;
    let scaraRobotModelGroup;
    let structureMesh, baseMesh, arm1Mesh, arm2Mesh;
    let structureGroup, baseGroup, arm1Group, arm2Group;
    let pivotHelper1, pivotHelper2;
    // ─── NUEVO: grupo intermedio para controlar el pivote de “brazo 1”
    let pivot1Group;
    // ─── NUEVO: grupo intermedio para controlar el pivote de “brazo 2”
    let pivot2Group;

    let animationId;
    let isInitialized = false;
    let autoRotateEnabled = false;

    const canvas = document.getElementById("canvas3d");
    const viewToggle3D = document.getElementById("view-toggle");

    const STL_PATHS = {
        structure: "/static/models/estructura.stl",
        base:      "/static/models/base.stl",
        arm1:      "/static/models/brazo1.stl",
        arm2:      "/static/models/brazo2.stl",
    };

    const COORDINATES = {
        structure: { x: -5.975, y: -40.575, z:   1.2,   rotationX: 0, rotationY: 0, rotationZ: 0 },
        base:      { x:   -5,   y:   40,    z: -8.2,  rotationX: 0, rotationY: 0, rotationZ: 0 },
        arm1:      { x:   -7,   y:   32.025, z: -45.52, rotationX: 0, rotationY: 0, rotationZ: 0 },
        // Brazo 2 arranca rotado -90°; no necesita x/y/z aquí
        arm2:      { rotationX: 0, rotationY: 0, rotationZ: -360 }
    };

    const ARM1_LENGTH = 80;
    const ARM2_LENGTH = 60;
    const GLOBAL_SCALE_FACTOR = 0.8;
    let controlButtonContainer = null;

    function createControlButtons() {
        if (controlButtonContainer) {
            controlButtonContainer.remove();
        }
        const parent = canvas.parentElement;
        if (!parent) {
            logToTerminal("⚠️ No se encontró el elemento padre del canvas para los botones de control.", false);
            return;
        }
        parent.style.position = parent.style.position || "relative";

        controlButtonContainer = document.createElement("div");
        controlButtonContainer.id = "threejs_controls_container";
        Object.assign(controlButtonContainer.style, {
            position: "absolute", top: "10px", right: "10px", zIndex: "20",
            display: "flex", flexDirection: "column", gap: "8px"
        });
        parent.appendChild(controlButtonContainer);

        const buttonStyleBase = `
            background: rgba(0,0,0,0.7);
            color: white;
            border: 1px solid rgba(255,255,255,0.2);
            padding: 8px 12px;
            border-radius: 6px;
            font-size: 13px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s ease;
            min-width: 100px;
            text-align: center;
        `;
        const hoverEffect = `
            background: rgba(0,0,0,0.9);
            border-color: rgba(255,255,255,0.4);
            transform: translateY(-1px);
        `;

        const addButton = (text, title, onClick) => {
            const btn = document.createElement("button");
            btn.textContent = text;
            btn.title = title;
            btn.style.cssText = buttonStyleBase;
            btn.addEventListener("click", onClick);
            btn.addEventListener("mouseenter", () => btn.style.cssText = buttonStyleBase + hoverEffect);
            btn.addEventListener("mouseleave", () => btn.style.cssText = buttonStyleBase);
            controlButtonContainer.appendChild(btn);
            return btn;
        };

        addButton("🔍+", "Acercar vista (FOV)", () => zoomStep(-8));
        addButton("🔍–", "Alejar vista (FOV)", () => zoomStep(8));
        addButton("🎯", "Resetear vista", resetCameraView);
        controlButtonContainer.autoRotateBtn = addButton("🔄", "Auto rotar", toggleAutoRotate);
    }

    function zoomStep(deltaFov) {
        if (!camera || !isInitialized) return;
        camera.fov = THREE.MathUtils.clamp(camera.fov + deltaFov, 12, 110);
        camera.updateProjectionMatrix();
        logToTerminal(`🔎 Zoom FOV: ${camera.fov.toFixed(1)}°`, true);
    }

    function resetCameraView() {
        if (!camera || !controls || !isInitialized) return;
        camera.position.set(150, 200, 250);
        camera.fov = 45;
        camera.updateProjectionMatrix();
        controls.target.set(0, 80, 0);
        controls.update();
        logToTerminal("🎯 Vista 3D reseteada", true);
    }

    function toggleAutoRotate() {
        if (!controls || !isInitialized) return;
        autoRotateEnabled = !autoRotateEnabled;
        controls.autoRotate = autoRotateEnabled;
        controls.autoRotateSpeed = autoRotateEnabled ? 0.8 : 0;
        if (controlButtonContainer && controlButtonContainer.autoRotateBtn) {
            controlButtonContainer.autoRotateBtn.textContent = autoRotateEnabled ? "⏸️" : "🔄";
        }
        logToTerminal(`🔄 Auto-rotación ${autoRotateEnabled ? 'activada' : 'desactivada'}`, true);
    }

    function setupKeyboardControls() {
        document.addEventListener("keydown", event => {
            if (!isInitialized || canvas.classList.contains("hidden")) return;
            if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) return;
            let handled = false;
            switch (event.code) {
                case "Equal": case "NumpadAdd": zoomStep(-5); handled = true; break;
                case "Minus": case "NumpadSubtract": zoomStep(5); handled = true; break;
                case "KeyR": resetCameraView(); handled = true; break;
                case "Space": toggleAutoRotate(); handled = true; break;
            }
            if (handled) event.preventDefault();
        });
    }

    async function loadSTL(path) {
        return new Promise((resolve, reject) => {
            const loader = new STLLoader();
            loader.load(path, geometry => {
                const material = new THREE.MeshStandardMaterial({ color: 0xAAAAAA, metalness: 0.5, roughness: 0.5 });
                const mesh = new THREE.Mesh(geometry, material);
                mesh.castShadow = true;
                mesh.receiveShadow = true;

                geometry.computeBoundingBox();
                const center = new THREE.Vector3();
                geometry.boundingBox.getCenter(center);
                mesh.geometry.translate(-center.x, -center.y, -center.z);

                mesh.scale.set(1, 1, 1);
                resolve(mesh);
            }, undefined, error => {
                logToTerminal(`❌ Error al cargar STL desde ${path}: ${error.message}`, false);
                reject(error);
            });
        });
    }

    async function loadModel() {
        logToTerminal("🔄 Cargando archivos STL...", true);

        if (scaraRobotModelGroup) {
            scene.remove(scaraRobotModelGroup);
            scaraRobotModelGroup = null;
        }

        scaraRobotModelGroup = new THREE.Group();
        scaraRobotModelGroup.name = "SCARA_Robot_Container";
        scaraRobotModelGroup.scale.set(GLOBAL_SCALE_FACTOR, GLOBAL_SCALE_FACTOR, GLOBAL_SCALE_FACTOR);
        scaraRobotModelGroup.rotation.x = -Math.PI / 2; // Poner modelo “boca arriba”
        scene.add(scaraRobotModelGroup);

        try {
            // ─── Estructura y base ─────────────────────────────────────────────
            structureMesh = await loadSTL(STL_PATHS.structure);
            structureMesh.material.color.set(0xFFFF66); 
            structureGroup = new THREE.Group();
            structureGroup.name = "Structure_Group";
            structureGroup.add(structureMesh);
            scaraRobotModelGroup.add(structureGroup);

            baseMesh = await loadSTL(STL_PATHS.base);
            baseMesh.material.color.set(0x8B4513)
            baseGroup = new THREE.Group();
            
            baseGroup.name = "Base_Z_Movable_Group";
            baseGroup.add(baseMesh);
            structureGroup.add(baseGroup);

            // ─── Brazo 1 ───────────────────────────────────────────────────────
            //  1) Creamos pivot1Group: su origen local (0,0,0) será
            //     el punto de pivote para todo brazo 1.
            pivot1Group = new THREE.Group();
            pivot1Group.name = "Pivot1_Group";
            //  Lo añadimos a baseGroup para que herede su rotación y posición:
            baseGroup.add(pivot1Group);

            //  2) PivotHelper1 (esfera roja) en (0,0,0) de pivot1Group. Esto marca el pivote.
            const pivotHelper1Geometry = new THREE.SphereGeometry(3, 16, 16);
            const pivotHelper1Material = new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.8 });
            pivotHelper1 = new THREE.Mesh(pivotHelper1Geometry, pivotHelper1Material);
            pivot1Group.add(pivotHelper1); // Make it a child of the pivot group
            pivotHelper1.position.set(0, 0, 0); // Keep it at the local origin of pivot1Group

            //  3) Cargamos la malla de brazo 1 y creamos su grupo
            arm1Mesh = await loadSTL(STL_PATHS.arm1);
            arm1Mesh.material.color.set(0xFFFFFF);
            arm1Group = new THREE.Group();
            arm1Group.name = "Arm1_Rotary_Group";
            // Colocar la malla de brazo 1 de modo que su tope superior quede en (0,0,0) del grupo
            arm1Mesh.position.set(0, (-ARM1_LENGTH / 2)-10, 0);
            arm1Group.add(arm1Mesh);

            //  4) Insertamos arm1Group dentro de pivot1Group:
            pivot1Group.add(arm1Group);

            // ─── Brazo 2 ───────────────────────────────────────────────────────
            //  1) Creamos pivot2Group: su origen local (0,0,0) será
            //     el punto de pivote para todo brazo 2.
            pivot2Group = new THREE.Group();
            pivot2Group.name = "Pivot2_Group";
            //  Lo añadimos a arm1Group para que herede su rotación y posición:
            pivot1Group.add(pivot2Group); // Corregido: pivot2Group ahora es hijo de pivot1Group

            //  2) PivotHelper2 (esfera azul) en (0,0,0) de pivot2Group. Esto marca el pivote.
            const pivotHelper2Geometry = new THREE.SphereGeometry(3, 16, 16);
            const pivotHelper2Material = new THREE.MeshBasicMaterial({ color: 0x0000ff, transparent: true, opacity: 0.8 });
            pivotHelper2 = new THREE.Mesh(pivotHelper2Geometry, pivotHelper2Material);
            pivot2Group.add(pivotHelper2);
            //  Deja pivotHelper2 en (0,0,0) local:
            pivotHelper2.position.set(0, 0, 0);

            //  3) Cargamos la malla de brazo 2 y centramos su extremo superior en (0,0,0) de arm2Group:
            arm2Mesh = await loadSTL(STL_PATHS.arm2);
            arm2Mesh.material.color.set(0x3CB371);
            arm2Group = new THREE.Group();
            arm2Group.name = "Arm2_Rotary_Group";
            //     Sacamos la malla de forma que su “tope superior” (punto de articulación) quede en (0,0,0):
            arm2Mesh.position.set(0, -ARM2_LENGTH , -15);
            arm2Group.add(arm2Mesh);

            //  4) Insertamos arm2Group dentro de pivot2Group:
            pivot2Group.add(arm2Group);

            //  5) Ponemos pivot2Group en el punto real donde debe unirse con brazo 1:
            //     (estos valores los ajustaste antes: (30, -ARM1_LENGTH-68, -15))
            //     Esta posición es relativa al padre (pivot1Group)
            pivot2Group.position.set(0, -ARM1_LENGTH -20, 0);

            //  6) Le damos la rotación base de −90° en Z a arm2Group:
            arm2Group.rotation.set(
                0,
                0,
                THREE.MathUtils.degToRad(COORDINATES.arm2.rotationZ)
            );

            // ─── Posicionar structureGroup, baseGroup, pivot1Group y pivot2Group en global ────
            structureGroup.position.set(
                COORDINATES.structure.x,
                COORDINATES.structure.z,
                -COORDINATES.structure.y
            );
            structureGroup.rotation.set(
                THREE.MathUtils.degToRad(COORDINATES.structure.rotationX),
                THREE.MathUtils.degToRad(COORDINATES.structure.rotationY),
                THREE.MathUtils.degToRad(COORDINATES.structure.rotationZ)
            );

            let basePosX = COORDINATES.base.x - COORDINATES.structure.x;
            let basePosY = COORDINATES.base.z - COORDINATES.structure.z;
            let basePosZ = -(COORDINATES.base.y - COORDINATES.structure.y);
            // **CAMBIO AQUI: Quitar la multiplicación por 4 en loadModel para baseGroup**
            // baseGroup.position.set(basePosX, basePosY * 4, basePosZ); // ANTERIOR
            baseGroup.position.set(basePosX, basePosY, basePosZ); // NUEVO
            baseGroup.rotation.set(
                THREE.MathUtils.degToRad(COORDINATES.base.rotationX),
                THREE.MathUtils.degToRad(COORDINATES.base.rotationY),
                THREE.MathUtils.degToRad(COORDINATES.base.rotationZ)
            );

            // ─── Posicionar pivot1Group (donde rota brazo 1) ───────────────────
            // Estas coordenadas definen la posición del pivote del brazo 1,
            // que ahora es el origen de pivot1Group, relativo a baseGroup.
            pivot1Group.position.set(
                COORDINATES.arm1.x - COORDINATES.base.x+1,
                COORDINATES.arm1.z - COORDINATES.base.z+8,
                -(COORDINATES.arm1.y - COORDINATES.base.y)
            );
            // arm1Group.position.set(0,0,0) implícitamente relativo a pivot1Group.

            // ─── Ajuste vertical final para que todo “descanse” en el suelo ────
            const box = new THREE.Box3().setFromObject(scaraRobotModelGroup);
            const initialMinY = box.min.y;
            scaraRobotModelGroup.position.y = -initialMinY + 0.1;
            logToTerminal(`✅ Robot levantado. Posición Y ajustada a: ${scaraRobotModelGroup.position.y.toFixed(2)}`, true);

            logToTerminal("✅ Todos los STL cargados y ensamblados. Ahora pivot1Group y pivot2Group controlan los puntos de rotación.", true);
            return true;

        } catch (error) {
            logToTerminal(`❌ Error al cargar y ensamblar modelos STL: ${error.message}`, false);
            return false;
        }
    }

    function init3DCore() {
        logToTerminal("🚀 Core: Iniciando configuración de escena 3D...", true);
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x1a1a2e);

        let width = canvas.clientWidth;
        let height = canvas.clientHeight;
        if (width === 0 || height === 0) {
            const parent = canvas.parentElement;
            width = parent ? parent.clientWidth : window.innerWidth;
            height = parent ? parent.clientHeight : window.innerHeight;
            if (width === 0 || height === 0) {
                width = 600; height = 400;
            }
            canvas.width = width;
            canvas.height = height;
        }
        logToTerminal(`📐 Dimensiones para init: ${width}x${height}`, true);

        camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 2000);
        camera.position.set(150, 200, 250);
        camera.lookAt(0, 80, 0);
        camera.fov = 45;
        camera.updateProjectionMatrix();

        renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        controls = new OrbitControls(camera, renderer.domElement);
        Object.assign(controls, {
            enableDamping: true, dampingFactor: 0.08, screenSpacePanning: false,
            minDistance: 50, maxDistance: 800, maxPolarAngle: Math.PI * 0.85,
            target: new THREE.Vector3(0, 80, 0),
            autoRotate: false, autoRotateSpeed: 0.8
        });

        scene.add(new THREE.AmbientLight(0x606060, 1.0));

        const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
        dirLight.position.set(150, 250, 120);
        dirLight.castShadow = true;
        Object.assign(dirLight.shadow, {
            mapSize: new THREE.Vector2(2048, 2048),
            camera: new THREE.OrthographicCamera(-250, 250, 250, -250, 0.5, 1000)
        });
        scene.add(dirLight);

        const ground = new THREE.Mesh(
            new THREE.PlaneGeometry(1000, 1000),
            new THREE.MeshLambertMaterial({ color: 0x252530 })
        );
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -0.1;
        ground.receiveShadow = true;
        scene.add(ground);

        const gridHelper = new THREE.GridHelper(500, 20, 0x444455, 0x333344);
        scene.add(gridHelper);
    }

    function update3D(stateToUse = window.appState) {
        if (!isInitialized ||
            !structureGroup || !baseGroup || !arm1Group || !pivot1Group ||
            !arm2Group || !pivotHelper1 || !pivotHelper2 || !pivot2Group) {
            logToTerminal("⚠️ Piezas del robot 3D o ayudantes de pivote no inicializados, saltando actualización visual.", false);
            return;
        }

        const currentAppState = stateToUse;
        if (!currentAppState || !currentAppState.angles) {
            return;
        }

        const { base, arm1, arm2 } = currentAppState.angles;

        // ─── Posición y rotación global de structureGroup y baseGroup ─────────
        structureGroup.position.set(
            COORDINATES.structure.x,
            COORDINATES.structure.z,
            -COORDINATES.structure.y
        );
        structureGroup.rotation.set(
            THREE.MathUtils.degToRad(COORDINATES.structure.rotationX),
            THREE.MathUtils.degToRad(COORDINATES.structure.rotationY),
            THREE.MathUtils.degToRad(COORDINATES.structure.rotationZ)
        );

        let basePosX = COORDINATES.base.x - COORDINATES.structure.x;
        let basePosY = COORDINATES.base.z - COORDINATES.structure.z;
        let basePosZ = -(COORDINATES.base.y - COORDINATES.structure.y);
        // **CAMBIO 1: Multiplicar la posición Z de la base por 4**
        basePosZ += base * 4; // Ajustar la multiplicación para el movimiento de la base
        baseGroup.position.set(basePosX, basePosY, basePosZ);

        baseGroup.rotation.set(
            THREE.MathUtils.degToRad(COORDINATES.base.rotationX),
            THREE.MathUtils.degToRad(COORDINATES.base.rotationY),
            THREE.MathUtils.degToRad(COORDINATES.base.rotationZ)
        );

        // ─── Posicionar pivot1Group (donde rota brazo 1) ───────────────────
        pivot1Group.position.set(
            COORDINATES.arm1.x - COORDINATES.base.x+1,
            COORDINATES.arm1.z - COORDINATES.base.z+8,
            -(COORDINATES.arm1.y - COORDINATES.base.y)
        );

        // ─── Rotación dinámica de brazo 1 ───────────────────────────────────
        // **CAMBIO 2: Invertir el signo de la rotación del brazo 1**
        let arm1RotZ = THREE.MathUtils.degToRad(COORDINATES.arm1.rotationZ);
        arm1RotZ += THREE.MathUtils.degToRad(-arm1); // Negativo para invertir dirección
        pivot1Group.rotation.set(
            THREE.MathUtils.degToRad(COORDINATES.arm1.rotationX),
            THREE.MathUtils.degToRad(COORDINATES.arm1.rotationY),
            arm1RotZ
        );

        // ─── Rotación dinámica de brazo 2 ───────────────────────────────────
        // **CAMBIO 3: Invertir el signo de la rotación del brazo 2**
        let baseZ2 = THREE.MathUtils.degToRad(COORDINATES.arm2.rotationZ); // −90°
        baseZ2 += THREE.MathUtils.degToRad(-arm2); // Negativo para invertir dirección
        arm2Group.rotation.set(0, 0, baseZ2);

        // Los pivotHelper1 y pivotHelper2 ahora son hijos de sus respectivos pivotGroups,
        // por lo que sus posiciones se actualizan automáticamente con sus padres.
    }

    function animate() {
        if (!isInitialized) return;
        animationId = requestAnimationFrame(animate);
        controls.update();
        update3D();
        renderer.render(scene, camera);
    }

    async function start3D() {
        logToTerminal("🎬 API: start3D() llamada.", true);
        if (isInitialized && !canvas.classList.contains("hidden")) {
            logToTerminal("ℹ️ Vista 3D ya iniciada y visible.", true);
            return true;
        }

        canvas.classList.remove("hidden");
        if (viewToggle3D) viewToggle3D.textContent = "Ver 2D";
        if (window.scara2D && typeof window.scara2D.hide === 'function') window.scara2D.hide();

        if (!isInitialized) {
            logToTerminal("🔄 Primera vez: Ejecutando init3DCore()...", true);
            init3DCore();
            const modelLoadedSuccessfully = await loadModel();
            if (!modelLoadedSuccessfully) {
                logToTerminal("❌ Falló la carga o el ensamblaje de los modelos STL. No se puede iniciar vista 3D.", false);
                canvas.classList.add("hidden");
                if (viewToggle3D) viewToggle3D.textContent = "Ver 3D";
                if (window.scara2D && typeof window.scara2D.show === 'function') window.scara2D.show();
                return false;
            }
            isInitialized = true;
            createControlButtons();
            setupKeyboardControls();
        }

        onResize();
        update3D();

        if (animationId) cancelAnimationFrame(animationId);
        animate();

        logToTerminal("✅ Vista 3D iniciada y animando.", true);
        return true;
    }

    function stop3D() {
        logToTerminal("🎬 API: stop3D() llamada.", true);
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }

        canvas.classList.add("hidden");
        if (viewToggle3D) viewToggle3D.textContent = "Ver 3D";
        if (window.scara2D && typeof window.scara2D.show === 'function') window.scara2D.show();

        if (controlButtonContainer) {
            controlButtonContainer.remove();
            controlButtonContainer = null;
        }
        logToTerminal("🛑 Vista 3D detenida.", true);
    }

    function onResize() {
        if (!renderer || !camera) return;

        let width = canvas.clientWidth;
        let height = canvas.clientHeight;

        if (width === 0 || height === 0) {
            const parent = canvas.parentElement;
            if (parent) {
                width = parent.clientWidth;
                height = parent.clientHeight;
            }
        }
        if (width === 0 || height === 0) {
            width = window.innerWidth;
            height = window.innerHeight;
        }

        renderer.setSize(width, height);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
    }
    window.addEventListener("resize", onResize);

    window.scara3D = {
        start: start3D,
        stop: stop3D,
        update: (state) => update3D(state),
        isInitialized: () => isInitialized,
        toggle: async () => {
            logToTerminal("🎬 API: toggle() llamado.", true);
            const isCurrentlyHidden = canvas.classList.contains("hidden");

            if (viewToggle3D) viewToggle3D.disabled = true;

            if (isCurrentlyHidden) {
                const success = await start3D();
                if (!success) {
                    logToTerminal("❌ toggle: Falló start3D. Volviendo a 2D.", false);
                    stop3D();
                }
            } else {
                stop3D();
            }
            if (viewToggle3D) viewToggle3D.disabled = false;
        }
    };

    if (viewToggle3D) {
        viewToggle3D.addEventListener("click", window.scara3D.toggle);
    } else {
        logToTerminal("⚠️ Botón 'view-toggle' no encontrado.", false);
    }

    logToTerminal("🎮 SCARA 3D listo para window.scara3D.toggle()", true);
});