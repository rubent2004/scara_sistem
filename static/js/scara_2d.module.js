// static/js/scara_2d.module.js - VERSIÓN CON RECORRIDO DE Z 0–25cm
document.addEventListener("DOMContentLoaded", () => {
  // --------------------------
  // Función auxiliar para escribir en el div#console
  // --------------------------
  function logToTerminal(message, success = true) {
    if (typeof logMessage === "function") {
      logMessage(message, success);
    }
    if (success) {
      console.log(message);
    } else {
      console.warn(message);
    }
  }

  logToTerminal("✅ Módulo SCARA 2D inicializado", true);

  // ===== ESTADO GLOBAL COMPARTIDO =====
  const appState = {
    // base ahora entre 0 y 25 (cm)
    angles: { base: 0, arm1: 0, arm2: 0 },
    globalSpeed: 50,            // Porcentaje 1–100
    gripperClosed: false,       // false = abierta(180°), true = cerrada(119°)
    isConnected: false,
    lastPosition: null,
    busy: false                 // <-- Indica si el robot está ocupado según backend
  };

  // ===== REFERENCIAS DOM =====
  const svg                = document.getElementById("robot-svg");
  const baseSlider         = document.getElementById("base-slider");
  const arm1Slider         = document.getElementById("arm1-slider");
  const arm2Slider         = document.getElementById("arm2-slider");
  const inputBase          = document.getElementById("input-base");
  const inputArm1          = document.getElementById("input-arm1");
  const inputArm2          = document.getElementById("input-arm2");
  const btnManual          = document.getElementById("btn-manual-send");
  const btnGrip            = document.getElementById("btn-grip-toggle");
  const resetBtn           = document.getElementById("reset-btn");
  const posDisplay         = document.getElementById("position-display");
  const homeBtn            = document.getElementById("home-btn");
  const saveBtn            = document.getElementById("save-position-btn");
  const statusIndicator    = document.getElementById("status-indicator");
  const speedGlobalSlider  = document.getElementById("speed-global");
  const speedGlobalInput   = document.getElementById("speed-global-input");
  const pctSpeedLabel      = document.getElementById("pct-speed");

  // ===== FUNCIONES DE VISIBILIDAD =====
  function show2D() {
    if (svg) {
      svg.classList.remove("hidden");
      logToTerminal("Vista 2D mostrada", true);
    }
  }

  function hide2D() {
    if (svg) {
      svg.classList.add("hidden");
      logToTerminal("Vista 2D oculta", true);
    }
  }

  // ===== FUNCIONES PARA HABILITAR/DESHABILITAR CONTROLES =====
  function setControlsEnabled(enabled) {
    const controls = [
      baseSlider, arm1Slider, arm2Slider,
      inputBase, inputArm1, inputArm2,
      btnManual, btnGrip, resetBtn, homeBtn,
      saveBtn, speedGlobalSlider, speedGlobalInput
    ];
    controls.forEach(el => {
      if (el) el.disabled = !enabled;
    });
  }

  // ===== CINEMÁTICA 2D MEJORADA =====
  function update2D() {
    if (!svg) {
      logToTerminal("⚠️ SVG no encontrado, no se actualiza 2D", false);
      return;
    }

    const { base, arm1, arm2 } = appState.angles;
    const arm2Absolute = arm1 + arm2;

    const cx = 150;
    const minY = 40;
    const maxY = 200;
    // Ahora usamos 25 cm como recorrido máximo
    const baseY = maxY - (base / 25) * (maxY - minY);

    // Base
    const baseJoint = document.getElementById("base-joint");
    if (baseJoint) {
      baseJoint.setAttribute("cy", baseY);
    }

    // Longitudes
    const L1 = 80;
    const L2 = 60;

    // Ángulos en radianes (negativo para que 0° apunte a la derecha, positivos rotan “hacia arriba”)
    const r1 = -(arm1 * Math.PI) / 180;
    const r2 = -(arm2Absolute * Math.PI) / 180;

    // Calculamos sin invertir la X: 
    //    r=0 → brazo apuntando a la derecha (x = cx + L)
    const x1 = cx + L1 * Math.cos(r1);
    const y1 = baseY - L1 * Math.sin(r1);
    const x2 = x1 + L2 * Math.cos(r2);
    const y2 = y1 - L2 * Math.sin(r2);

    // Brazo 1
    const arm1Line = document.getElementById("arm1-line");
    if (arm1Line) {
      arm1Line.setAttribute("x1", cx);
      arm1Line.setAttribute("y1", baseY);
      arm1Line.setAttribute("x2", x1);
      arm1Line.setAttribute("y2", y1);
    }

    // Brazo 2
    const arm2Line = document.getElementById("arm2-line");
    if (arm2Line) {
      arm2Line.setAttribute("x1", x1);
      arm2Line.setAttribute("y1", y1);
      arm2Line.setAttribute("x2", x2);
      arm2Line.setAttribute("y2", y2);
    }

    // Articulaciones
    const arm1Joint = document.getElementById("arm1-joint");
    if (arm1Joint) {
      arm1Joint.setAttribute("cx", x1);
      arm1Joint.setAttribute("cy", y1);
    }

    const endEffector = document.getElementById("end-effector");
    if (endEffector) {
      endEffector.setAttribute("cx", x2);
      endEffector.setAttribute("cy", y2);
    }

    // Etiqueta θ₁
    const labelArm1 = document.getElementById("label-arm1");
    if (labelArm1) {
      labelArm1.setAttribute("x", (cx + x1) / 2 + 15);
      labelArm1.setAttribute("y", (baseY + y1) / 2 - 5);
      labelArm1.textContent = `θ₁=${arm1}°`;
    }

    // Etiqueta θ₂ (absoluto)
    const labelArm2 = document.getElementById("label-arm2");
    if (labelArm2) {
      labelArm2.setAttribute("x", (x1 + x2) / 2 + 15);
      labelArm2.setAttribute("y", (y1 + y2) / 2 - 5);
      labelArm2.textContent = `θ₂=${arm2Absolute}°`;
    }

    updateGripper(x2, y2, r2);
  }

  // ===== ACTUALIZAR GRIPPER =====
  function updateGripper(x2, y2, baseAngle) {
    const gripLen = 15;
    
    // 180°=abierto, 119°=cerrado
    const gripAngle = appState.gripperClosed ? -15 : -60;

    const leftAngle  = baseAngle + (gripAngle * Math.PI) / 180;
    const rightAngle = baseAngle - (gripAngle * Math.PI) / 180;

    const lx = x2 + gripLen * Math.cos(leftAngle);
    const ly = y2 - gripLen * Math.sin(leftAngle);
    const rx = x2 + gripLen * Math.cos(rightAngle);
    const ry = y2 - gripLen * Math.sin(rightAngle);

    const gripLeft = document.getElementById("grip-left");
    if (gripLeft) {
      gripLeft.setAttribute("x1", x2);
      gripLeft.setAttribute("y1", y2);
      gripLeft.setAttribute("x2", lx);
      gripLeft.setAttribute("y2", ly);
    }

    const gripRight = document.getElementById("grip-right");
    if (gripRight) {
      gripRight.setAttribute("x1", x2);
      gripRight.setAttribute("y1", y2);
      gripRight.setAttribute("x2", rx);
      gripRight.setAttribute("y2", ry);
    }

    // Actualizar botón de pinza
    if (btnGrip) {
      btnGrip.textContent = appState.gripperClosed
        ? "🔓 Abrir Pinza (180°)"
        : "🔒 Cerrar Pinza (119°)";
      btnGrip.className = appState.gripperClosed
        ? "btn btn-warning"
        : "btn btn-success";
      
      const gripperColor = appState.gripperClosed ? "#ff6b6b" : "#51cf66";
      if (gripLeft)  gripLeft.setAttribute("stroke", gripperColor);
      if (gripRight) gripRight.setAttribute("stroke", gripperColor);
    }
  }

  // ===== OBTENER CSRF TOKEN =====
  function getCSRFToken() {
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === 'csrftoken') {
        return value;
      }
    }
    const csrfMeta = document.querySelector('meta[name="csrf-token"]');
    return csrfMeta ? csrfMeta.getAttribute('content') : null;
  }

  // ===== ACTUALIZAR ESTADO DE CONEXIÓN (y BUSY) =====
  function updateConnectionStatus(data) {
    // data.connected → verdadero/falso
    // data.busy → verdadero/falso
    appState.isConnected = data.connected;
    appState.busy = data.busy;

    if (statusIndicator) {
      statusIndicator.className = appState.isConnected
        ? (appState.busy ? 'status-busy' : 'status-connected')
        : 'status-disconnected';

      if (!appState.isConnected) {
        statusIndicator.textContent = '🔴 Desconectado';
      } else if (appState.busy) {
        statusIndicator.textContent = '🟡 Ocupado';
      } else {
        statusIndicator.textContent = '🟢 Conectado';
      }
    }

    // Habilitar controles solo si está conectado Y no está ocupado
    setControlsEnabled(appState.isConnected && !appState.busy);

    // Sincronizar estado local del gripper y posición
    if (data.last_position) {
      appState.lastPosition = data.last_position;
      if (typeof data.last_position.gripper === 'boolean') {
        appState.gripperClosed = data.last_position.gripper;
      }
    }
  }

  // ===== VERIFICAR ESTADO DEL SISTEMA =====
  async function checkSystemStatus() {
    try {
      const response = await fetch('/get-status/', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin'
      });

      if (response.ok) {
        const data = await response.json();
        updateConnectionStatus(data);
        return data;
      } else {
        logToTerminal("⚠️ Error obteniendo estado del sistema", false);
        updateConnectionStatus({ connected: false, busy: false });
        return null;
      }
    } catch (error) {
      logToTerminal(`❌ Error verificando estado: ${error}`, false);
      updateConnectionStatus({ connected: false, busy: false });
      return null;
    }
  }

  // ===== ESPERAR HASTA QUE busy === false =====
  function waitUntilNotBusy(pollInterval = 500) {
    return new Promise((resolve) => {
      const intervalId = setInterval(async () => {
        const status = await checkSystemStatus();
        if (!status || !status.busy) {
          clearInterval(intervalId);
          resolve();
        }
      }, pollInterval);
    });
  }

  // ===== ACTUALIZACIÓN COMPLETA DE LA INTERFAZ =====
  async function updateRobotInterface() {
    const { base, arm1, arm2 } = appState.angles;
    const arm2Absolute = arm1 + arm2;

    // Mostrar posición en pantalla
    if (posDisplay) {
      const gripperText = appState.gripperClosed ? 'Cerrada (119°)' : 'Abierta (180°)';
      posDisplay.textContent = `Z=${base}cm | θ₁=${arm1}° | θ₂=${arm2Absolute}° | Pinza: ${gripperText}`;
    }

    // Actualizar valores numéricos
    const valBase = document.getElementById("val-base");
    const valArm1 = document.getElementById("val-arm1");
    const valArm2 = document.getElementById("val-arm2");
    if (valBase)  valBase.textContent = base;
    if (valArm1)  valArm1.textContent = arm1;
    if (valArm2)  valArm2.textContent = arm2Absolute;

    // Sincronizar inputs de posición
    if (inputBase   && Number(inputBase.value)   !== base)  inputBase.value   = base;
    if (inputArm1   && Number(inputArm1.value)   !== arm1)  inputArm1.value   = arm1;
    if (inputArm2   && Number(inputArm2.value)   !== arm2)  inputArm2.value   = arm2;

    // Sincronizar sliders de posición
    if (baseSlider  && Number(baseSlider.value)  !== base)  baseSlider.value  = base;
    if (arm1Slider  && Number(arm1Slider.value)  !== arm1)  arm1Slider.value  = arm1;
    if (arm2Slider  && Number(arm2Slider.value)  !== arm2)  arm2Slider.value  = arm2;

    // Actualizar dibujo 2D
    update2D();
  }

  // ===== FUNCIÓN sendCmd() —> ENVÍA por fetch al back-end =====
  async function sendCmd() {
    // Si ya está ocupado, rechazamos
    if (appState.busy) {
      logToTerminal("⏳ Robot ocupado, no se envía comando", false);
      return false;
    }

    // Convertir porcentaje 1–100 a rango 100–1000
    const finalSpeed = Math.max(100, Math.min(1000, Math.round((appState.globalSpeed / 100) * 1000)));
    const payload = {
      // Ya usamos base directamente entre 0 y 25 (cm)
      base: appState.angles.base,
      arm1: appState.angles.arm1,
      arm2: appState.angles.arm2,
      gripper: appState.gripperClosed,
      speed: finalSpeed
    };

    try {
      // Antes de enviar, marcar busy en interfaz
      appState.busy = true;
      setControlsEnabled(false);
      logToTerminal(`[sendCmd] POST /send-command/ -> ${JSON.stringify(payload)}`, true);
      logToTerminal(`[sendCmd] Estado gripper: ${appState.gripperClosed ? 'CERRAR (119°)' : 'ABRIR (180°)'}`, true);

      const response = await fetch("/send-command/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": getCSRFToken() || ""
        },
        credentials: 'same-origin',
        body: JSON.stringify(payload)
      });

      const json = await response.json();
      logToTerminal(`[sendCmd] Respuesta servidor: ${JSON.stringify(json)}`, json.success);

      if (!json.success) {
        logToTerminal(`[sendCmd] Error del servidor: ${json.error}`, false);
        // En caso de error, volver a chequear estado para actualizar busy
        await checkSystemStatus();
        return false;
      }

      // Si todo OK, esperar hasta que Arduino mande DONE (backend actualiza busy=false)
      await waitUntilNotBusy();
      logToTerminal("✅ Robot libre, controles habilitados", true);
      return true;

    } catch (err) {
      logToTerminal(`[sendCmd] Excepción: ${err}`, false);
      // Intentar actualizar estado
      await checkSystemStatus();
      return false;
    }
  }

  // ===== ENVIAR ROBOT A HOME =====
  async function sendHome() {
    if (appState.busy) {
      logToTerminal("⏳ Robot ocupado, no se envía Home", false);
      return false;
    }

    try {
      // Marcar busy
      appState.busy = true;
      setControlsEnabled(false);
      logToTerminal("[sendHome] POST /home/", true);

      const response = await fetch("/home/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": getCSRFToken() || ""
        },
        credentials: 'same-origin'
      });

      const json = await response.json();
      logToTerminal(`[sendHome] Respuesta servidor: ${JSON.stringify(json)}`, json.success);

      if (!json.success) {
        logToTerminal(`[sendHome] Error: ${json.error}`, false);
        await checkSystemStatus();
        return false;
      }

      // Actualizar estado local de ángulos a home
      appState.angles = { base: 0, arm1: 0, arm2: 0 };
      appState.gripperClosed = false;
      await updateRobotInterface();

      // Esperar hasta que Arduino mande DONE
      await waitUntilNotBusy();
      logToTerminal("✅ Home completado, controles habilitados", true);
      return true;

    } catch (error) {
      logToTerminal(`[sendHome] Excepción: ${error}`, false);
      await checkSystemStatus();
      return false;
    }
  }

  // ===== GUARDAR POSICIÓN ACTUAL =====
  async function saveCurrentPosition() {
    if (appState.busy) {
      logToTerminal("⏳ Robot ocupado, no se guarda posición", false);
      return false;
    }

    const positionName = prompt("Nombre para esta posición:", `Posición_${Date.now()}`);
    if (!positionName) return false;

    const payload = {
      name: positionName,
      base: appState.angles.base,
      arm1: appState.angles.arm1,
      arm2: appState.angles.arm2,
      gripper: appState.gripperClosed
    };

    try {
      logToTerminal(`[saveCurrentPosition] POST /save-position/ -> ${JSON.stringify(payload)}`, true);

      const response = await fetch("/save-position/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": getCSRFToken() || ""
        },
        credentials: 'same-origin',
        body: JSON.stringify(payload)
      });

      const json = await response.json();
      if (json.success) {
        logToTerminal(`✅ Posición guardada: ${json.message}`, true);
      } else {
        logToTerminal(`❌ Error guardando posición: ${json.error}`, false);
      }
      return json.success;

    } catch (error) {
      logToTerminal(`[saveCurrentPosition] Excepción: ${error}`, false);
      return false;
    }
  }

  // ===== CONTROL ESPECÍFICO DEL GRIPPER =====
  async function toggleGripper() {
    if (appState.busy) {
      logToTerminal("⏳ Robot ocupado, no se cambia pinza", false);
      return false;
    }

    const previousState = appState.gripperClosed;
    appState.gripperClosed = !appState.gripperClosed;

    const action = appState.gripperClosed ? 'CERRAR' : 'ABRIR';
    const angle  = appState.gripperClosed ? '119°' : '180°';
    logToTerminal(`[toggleGripper] Intentando ${action} pinza (${angle})`, true);

    // Actualizar visualmente
    update2D();

    // Enviar comando (que internamente esperará DONE)
    const success = await sendCmd();
    if (!success) {
      // Si hubo fallo, revertir estado local
      appState.gripperClosed = previousState;
      update2D();
      logToTerminal("❌ Error cambiando pinza, revertido", false);
      return false;
    }

    logToTerminal(`✅ Pinza ${action} ejecutado`, true);
    return true;
  }

  // ===== EVENT LISTENERS =====

  // 1) Slider para Z (0–25 cm)
  if (baseSlider) {
    baseSlider.setAttribute("min", "0");
    baseSlider.setAttribute("max", "25");
    baseSlider.addEventListener("input", (e) => {
      appState.angles.base = parseInt(e.target.value);
      update2D();
    });
    baseSlider.addEventListener("change", () => {
      const val = Math.max(0, Math.min(25, parseInt(baseSlider.value) || 0));
      appState.angles.base = val;
      updateRobotInterface();
      sendCmd();
    });
  }

  // 2) Slider para Brazo 1 (–90…+90)
  if (arm1Slider) {
    arm1Slider.addEventListener("input", (e) => {
      appState.angles.arm1 = parseInt(e.target.value);
      update2D();
    });
    arm1Slider.addEventListener("change", () => {
      const val = Math.max(-90, Math.min(90, parseInt(arm1Slider.value) || 0));
      appState.angles.arm1 = val;
      updateRobotInterface();
      sendCmd();
    });
  }

  // 3) Slider para Brazo 2 (–120…+60)
  if (arm2Slider) {
    arm2Slider.addEventListener("input", (e) => {
      appState.angles.arm2 = parseInt(e.target.value);
      update2D();
    });
    arm2Slider.addEventListener("change", () => {
      const val = Math.max(-120, Math.min(60, parseInt(arm2Slider.value) || 0));
      appState.angles.arm2 = val;
      updateRobotInterface();
      sendCmd();
    });
  }

  // Inputs numéricos de posición
  if (inputBase) {
    inputBase.setAttribute("min", "0");
    inputBase.setAttribute("max", "25");
    inputBase.addEventListener("change", () => {
      const val = Math.max(0, Math.min(25, parseInt(inputBase.value) || 0));
      appState.angles.base = val;
      update2D();
      sendCmd();
    });
  }
  if (inputArm1) {
    inputArm1.setAttribute("min", "-90");
    inputArm1.setAttribute("max", "90");
    inputArm1.addEventListener("change", () => {
      const val = Math.max(-90, Math.min(90, parseInt(inputArm1.value) || 0));
      appState.angles.arm1 = val;
      update2D();
      sendCmd();
    });
  }
  if (inputArm2) {
    inputArm2.setAttribute("min", "-120");
    inputArm2.setAttribute("max", "60");
    inputArm2.addEventListener("change", () => {
      const val = Math.max(-120, Math.min(60, parseInt(inputArm2.value) || 0));
      appState.angles.arm2 = val;
      update2D();
      sendCmd();
    });
  }

  // Botón de pinza
  if (btnGrip) {
    btnGrip.addEventListener("click", async () => {
      await toggleGripper();
    });
  }

  // Botón de envío manual
  if (btnManual) {
    btnManual.addEventListener("click", () => {
      if (appState.busy) {
        logToTerminal("⏳ Robot ocupado, no se envían valores manuales", false);
        return;
      }
      const newBase = Math.max(0, Math.min(25, parseInt(inputBase.value) || 0));
      const newArm1 = Math.max(-90, Math.min(90, parseInt(inputArm1.value) || 0));
      const newArm2 = Math.max(-120, Math.min(60, parseInt(inputArm2.value) || 0));

      appState.angles.base = newBase;
      appState.angles.arm1 = newArm1;
      appState.angles.arm2 = newArm2;

      updateRobotInterface();
      sendCmd();
      logToTerminal(`Valores enviados manualmente: base=${newBase}, arm1=${newArm1}, arm2=${newArm2}`, true);
    });
  }

  // Botón de reset
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      if (appState.busy) {
        logToTerminal("⏳ Robot ocupado, no se resetea", false);
        return;
      }
      appState.angles = { base: 0, arm1: 0, arm2: 0 };
      appState.gripperClosed = false;
      updateRobotInterface();
      logToTerminal("🔄 Sistema reseteado a valores por defecto (pinza abierta)", true);
      sendCmd();
    });
  }

  // Botón HOME
  if (homeBtn) {
    homeBtn.addEventListener("click", sendHome);
  }

  // Botón guardar posición
  if (saveBtn) {
    saveBtn.addEventListener("click", saveCurrentPosition);
  }

  // Control de velocidad global
  if (speedGlobalSlider) {
    speedGlobalSlider.addEventListener("input", () => {
      const val = parseInt(speedGlobalSlider.value);
      appState.globalSpeed = val;
      pctSpeedLabel.textContent = `${val} %`;
    });
  }

  if (speedGlobalInput) {
    speedGlobalInput.addEventListener("input", () => {
      let val = parseInt(speedGlobalInput.value);
      if (isNaN(val) || val < 1) val = 1;
      if (val > 100) val = 100;
      speedGlobalInput.value = val;
      speedGlobalSlider.value = val;
      appState.globalSpeed = val;
      pctSpeedLabel.textContent = `${val} %`;
    });
  }

  // ===== MONITOREO PERIÓDICO DEL ESTADO =====
  function startStatusMonitoring() {
    setInterval(async () => {
      await checkSystemStatus();
    }, 5000);
  }

  // ===== EXPOSICIÓN GLOBAL =====
  window.appState = appState;
  window.updateRobot = updateRobotInterface;

  window.scara2D = {
    appState,
    update: updateRobotInterface,
    show: show2D,
    hide: hide2D,
    sendHome: sendHome,
    savePosition: saveCurrentPosition,
    checkStatus: checkSystemStatus,
    toggleGripper: toggleGripper,
    sendCmd: sendCmd  // <-- AGREGAR ESTA LÍNEA
  };
  if (window.scara3D && typeof window.scara3D.update === 'function') {
    // Pasa el appState actual a la función de actualización 3D
    window.scara3D.update(appState);
  }
  // Para compatibilidad con PS4:
  window.sendRobotCommand = sendCmd;

  // ===== INICIALIZACIÓN =====
  async function initialize() {
    logToTerminal("🚀 Inicializando sistema SCARA 2D...", true);

    pctSpeedLabel.textContent = `${appState.globalSpeed} %`;
    if (speedGlobalSlider) speedGlobalSlider.value = appState.globalSpeed;
    if (speedGlobalInput) speedGlobalInput.value = appState.globalSpeed;

    // Primera actualización visual
    await checkSystemStatus();
    updateRobotInterface();
    startStatusMonitoring();
    show2D();

    const gripperText = appState.gripperClosed ? 'cerrado (119°)' : 'abierto (180°)';
    logToTerminal(
      `🔢 Estado inicial: ${JSON.stringify(appState.angles)}, velocidad=${appState.globalSpeed}%, gripper=${gripperText}`,
      true
    );
  }

  initialize();
});
