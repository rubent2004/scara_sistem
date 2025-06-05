// static/js/ps4_settings.js - VERSIÓN CORREGIDA PARA CONTROL TOTAL DEL PS4
// ———————————————————————————————
// 1. Lista de botones predeterminados
const defaultMapping = {
  arm1: "dpad-left/dpad-right",
  arm2: "l1/r1",
  base: "dpad-up/dpad-down",
  grip: "x/o",
  sensLeft: 1.0,
  sensRight: 1.0,
};

// Estado global para evitar spam de inputs
let lastInputTime = 0;
let lastGripTime = 0; // Separamos el anti-rebote del grip
const INPUT_THROTTLE = 100; // ms
const GRIP_THROTTLE = 500; // ms para grip

// Variable para el envío automático
let autoSendEnabled = true;
let sendMovementTimer = null;
const AUTO_SEND_DELAY = 300; // ms después del último input

// ———————————————————————————————
// 2. Funciones de Modal y pestañas mejoradas
function openCalibrationModal() {
  document.getElementById("calibration-modal").classList.remove("hidden");
  document.getElementById("calibration-modal").classList.add("flex");
  
  // Actualizar valores de sensibilidad en tiempo real
  updateSensitivityDisplay();
  
  // Iniciar detección de botones para ayuda visual
  startButtonDetection();
}

function closeCalibrationModal() {
  document.getElementById("calibration-modal").classList.add("hidden");
  document.getElementById("calibration-modal").classList.remove("flex");
  
  // Detener detección de botones
  stopButtonDetection();
}

function switchTab(tab) {
  // Oculta todas las secciones
  document.querySelectorAll("#tab-mapping, #tab-sensitivity, #tab-info, #tab-test").forEach((sec) => {
    sec.classList.add("hidden");
  });
  
  // Desactivar todos los botones
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.classList.remove("bg-indigo-600", "text-white");
    btn.classList.add("hover:bg-gray-700", "text-gray-400", "bg-gray-800");
  });
  
  // Mostrar la sección solicitada
  document.getElementById("tab-" + tab).classList.remove("hidden");
  
  // Activar el botón correspondiente
  const activeBtn = document.querySelector(`.tab-btn[data-tab="${tab}"]`);
  activeBtn.classList.add("bg-indigo-600", "text-white");
  activeBtn.classList.remove("hover:bg-gray-700", "text-gray-400", "bg-gray-800");
}

// Inicializa la pestaña "mapeo" al abrir
function initializeTabs() {
  switchTab("mapping");
}

// ———————————————————————————————
// 3. Detección de botones en tiempo real para el modal
let buttonDetectionInterval = null;
let detectedButtons = new Set();

function startButtonDetection() {
  if (buttonDetectionInterval) return;
  
  buttonDetectionInterval = setInterval(() => {
    const gp = navigator.getGamepads()[0];
    if (!gp) return;
    
    // Detectar botones presionados
    gp.buttons.forEach((button, index) => {
      if (button.pressed) {
        const buttonName = getButtonName(index);
        if (buttonName) {
          highlightDetectedButton(buttonName);
          detectedButtons.add(buttonName);
        }
      }
    });
    
    // Detectar movimientos de sticks
    gp.axes.forEach((axis, index) => {
      if (Math.abs(axis) > 0.3) {
        const axisName = getAxisName(index, axis);
        if (axisName) {
          highlightDetectedAxis(axisName);
        }
      }
    });
    
    // Limpiar highlights después de un tiempo
    setTimeout(() => {
      clearAllHighlights();
    }, 200);
    
  }, 50);
}

function stopButtonDetection() {
  if (buttonDetectionInterval) {
    clearInterval(buttonDetectionInterval);
    buttonDetectionInterval = null;
  }
  clearAllHighlights();
  detectedButtons.clear();
}

function getButtonName(index) {
  const buttonMap = {
    0: "x", 1: "o", 2: "square", 3: "triangle",
    4: "l1", 5: "r1", 6: "l2", 7: "r2",
    12: "dpad-up", 13: "dpad-down", 14: "dpad-left", 15: "dpad-right"
  };
  return buttonMap[index];
}

function getAxisName(index, value) {
  const axisMap = {
    0: value < 0 ? "left-stick-left" : "left-stick-right",
    1: value < 0 ? "left-stick-up" : "left-stick-down",
    2: value < 0 ? "right-stick-left" : "right-stick-right",
    3: value < 0 ? "right-stick-up" : "right-stick-down"
  };
  return axisMap[index];
}

function highlightDetectedButton(buttonName) {
  const indicator = document.getElementById(`btn-${buttonName}`);
  if (indicator) {
    indicator.classList.add("bg-green-500", "animate-pulse");
    indicator.classList.remove("bg-gray-600");
  }
}

function highlightDetectedAxis(axisName) {
  const indicator = document.getElementById(`axis-${axisName}`);
  if (indicator) {
    indicator.classList.add("bg-blue-500", "animate-pulse");
    indicator.classList.remove("bg-gray-600");
  }
}

function clearAllHighlights() {
  document.querySelectorAll('.gamepad-button, .gamepad-axis').forEach(el => {
    el.classList.remove("bg-green-500", "bg-blue-500", "animate-pulse");
    el.classList.add("bg-gray-600");
  });
}

// ———————————————————————————————
// 4. Actualizar display de sensibilidad
function updateSensitivityDisplay() {
  const leftSens = document.getElementById("sens-left");
  const rightSens = document.getElementById("sens-right");
  const leftDisplay = document.getElementById("sens-left-display");
  const rightDisplay = document.getElementById("sens-right-display");
  
  if (leftDisplay) leftDisplay.textContent = `${leftSens.value}×`;
  if (rightDisplay) rightDisplay.textContent = `${rightSens.value}×`;
}

// ———————————————————————————————
// 5. Restaurar Valores Predeterminados
function resetToDefaultConfig() {
  document.getElementById("map-arm1").value = defaultMapping.arm1;
  document.getElementById("map-arm2").value = defaultMapping.arm2;
  document.getElementById("map-base").value = defaultMapping.base;
  document.getElementById("map-grip").value = defaultMapping.grip;
  document.getElementById("sens-left").value = defaultMapping.sensLeft;
  document.getElementById("sens-right").value = defaultMapping.sensRight;
  
  updateSensitivityDisplay();
  clearButtonHighlights();
  saveCustomConfig();
  
  // Mostrar confirmación mejorada
  showNotification("Configuración restaurada a valores predeterminados", "success");
}

// ———————————————————————————————
// 6. Guardar Configuración (sin localStorage por restricciones de Claude)
let customConfig = null;

function saveCustomConfig() {
  customConfig = {
    arm1: document.getElementById("map-arm1").value,
    arm2: document.getElementById("map-arm2").value,
    base: document.getElementById("map-base").value,
    grip: document.getElementById("map-grip").value,
    sensLeft: parseFloat(document.getElementById("sens-left").value),
    sensRight: parseFloat(document.getElementById("sens-right").value),
  };
  
  showNotification("Configuración guardada exitosamente", "success");
  console.log("Configuración guardada:", customConfig);
}

function loadConfig() {
  if (customConfig) {
    document.getElementById("map-arm1").value = customConfig.arm1;
    document.getElementById("map-arm2").value = customConfig.arm2;
    document.getElementById("map-base").value = customConfig.base;
    document.getElementById("map-grip").value = customConfig.grip;
    document.getElementById("sens-left").value = customConfig.sensLeft;
    document.getElementById("sens-right").value = customConfig.sensRight;
  } else {
    resetToDefaultConfig();
  }
  updateSensitivityDisplay();
}

// ———————————————————————————————
// 7. Sistema de notificaciones
function showNotification(message, type = "info") {
  const notification = document.createElement("div");
  notification.className = `fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 transition-all transform translate-x-full`;
  
  switch(type) {
    case "success":
      notification.className += " bg-green-600 text-white";
      break;
    case "error":
      notification.className += " bg-red-600 text-white";
      break;
    case "warning":
      notification.className += " bg-yellow-600 text-white";
      break;
    default:
      notification.className += " bg-blue-600 text-white";
  }
  
  notification.textContent = message;
  document.body.appendChild(notification);
  
  // Animación de entrada
  setTimeout(() => {
    notification.classList.remove("translate-x-full");
  }, 100);
  
  // Remover después de 3 segundos
  setTimeout(() => {
    notification.classList.add("translate-x-full");
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, 3000);
}

// ———————————————————————————————
// 8. Detección de Gamepad mejorada
let haveGamepad = false;
let gamepadIndex = -1;

window.addEventListener("gamepadconnected", (e) => {
  haveGamepad = true;
  gamepadIndex = e.gamepad.index;
  updateGamepadStatus(true);
  showNotification(`🎮 Control PS4 conectado y listo`, "success");
  updateControlModeDisplay();
  console.log("Gamepad conectado:", e.gamepad.id);
});

window.addEventListener("gamepaddisconnected", (e) => {
  haveGamepad = false;
  gamepadIndex = -1;
  updateGamepadStatus(false);
  clearButtonHighlights();
  updateControlModeDisplay();
  showNotification("🎮 Control PS4 desconectado", "warning");
  console.log("Gamepad desconectado:", e.gamepad.id);
});

function updateGamepadStatus(connected) {
  const dot = document.getElementById("ps4-dot");
  if (connected) {
    dot.classList.remove("bg-gray-500");
    dot.classList.add("bg-green-500");
  } else {
    dot.classList.remove("bg-green-500");
    dot.classList.add("bg-gray-500");
  }
}

// ———————————————————————————————
// 9. Actualizar display de modo de control
function updateControlModeDisplay() {
  // Agregar mensaje de estado del control
  let statusMsg = document.getElementById("control-mode-status");
  if (!statusMsg) {
    statusMsg = document.createElement("div");
    statusMsg.id = "control-mode-status";
   
    
    // Insertarlo al principio del contenedor principal
    const mainContainer = document.querySelector(".container") || document.body;
    mainContainer.insertBefore(statusMsg, mainContainer.firstChild);
  }
  
  
}

// Feedback visual mejorado
function highlightSelect(selectId) {
  const el = document.getElementById(selectId);
  if (el) {
    el.classList.add("ring-2", "ring-green-400", "ring-opacity-75");
    el.classList.remove("ring-red-400");
  }
}

function clearHighlight(selectId) {
  const el = document.getElementById(selectId);
  if (el) {
    el.classList.remove("ring-2", "ring-green-400", "ring-opacity-75");
  }
}

function clearButtonHighlights() {
  ["map-arm1", "map-arm2", "map-base", "map-grip"].forEach((id) => {
    clearHighlight(id);
  });
}

// ———————————————————————————————
// 10. Función para programar envío automático
function scheduleAutoSend() {
  if (!autoSendEnabled) return;
  
  // Cancelar envío previo si existe
  if (sendMovementTimer) {
    clearTimeout(sendMovementTimer);
  }
  
  // Programar nuevo envío
  sendMovementTimer = setTimeout(async () => {
    if (window.scara2D && window.scara2D.appState && !window.scara2D.appState.busy) {
      try {
        // Usar la función sendCmd del módulo scara_2d
        if (typeof window.scara2D.sendCmd === 'function') {
          await window.scara2D.sendCmd();
        } else if (typeof window.updateRobot === 'function') {
          await window.updateRobot();
        }
        console.log("🎮 Movimiento enviado automáticamente desde PS4");
      } catch (error) {
        console.error("Error enviando movimiento automático:", error);
      }
    }
    sendMovementTimer = null;
  }, AUTO_SEND_DELAY);
}

// ———————————————————————————————
// 11. Mapeo de inputs del Gamepad (VERSIÓN CORREGIDA CON ENVÍO AUTOMÁTICO)
function applyGamepadMapping() {
  const now = Date.now();
  if (now - lastInputTime < INPUT_THROTTLE) {
    return;
  }

  const gamepads = navigator.getGamepads();
  const gp = gamepads[gamepadIndex] || gamepads[0];
  if (!gp) return;

  // Verificar si el robot está ocupado
  if (window.scara2D && window.scara2D.appState && window.scara2D.appState.busy) {
    return; // No procesar inputs si está ocupado
  }

  // Accedemos al mismo appState que usa scara_2d.module.js
  const appState = window.scara2D ? window.scara2D.appState : null;
  if (!appState) return;

  const mapping = customConfig || defaultMapping;
  let inputDetected = false;
  let movementMade = false;

  clearButtonHighlights();

  // — Funciones para cambiar valores y programar envío —
  function changeArm1(delta) {
    const newValue = Math.max(-90, Math.min(90, appState.angles.arm1 + delta));
    if (newValue !== appState.angles.arm1) {
      appState.angles.arm1 = newValue;
      window.scara2D.update();
      inputDetected = true;
      movementMade = true;
    }
  }

  function changeArm2(delta) {
    const newValue = Math.max(-120, Math.min(60, appState.angles.arm2 + delta));
    if (newValue !== appState.angles.arm2) {
      appState.angles.arm2 = newValue;
      window.scara2D.update();
      inputDetected = true;
      movementMade = true;
    }
  }

  function changeBase(delta) {
    const newValue = Math.max(0, Math.min(40, appState.angles.base + delta));
    if (newValue !== appState.angles.base) {
      appState.angles.base = newValue;
      window.scara2D.update();
      inputDetected = true;
      movementMade = true;
    }
  }

  async function toggleGrip() {
    if (now - lastGripTime < GRIP_THROTTLE) return;
    
    // Llamar directamente a la función toggleGripper del módulo scara2D
    if (window.scara2D && typeof window.scara2D.toggleGripper === 'function') {
      await window.scara2D.toggleGripper();
      inputDetected = true;
      lastGripTime = now;
      console.log("🎮 Gripper activado desde PS4");
    }
  }

  // — Índice de botones —
  const buttonIndex = {
    "dpad-up": 12, "dpad-down": 13, "dpad-left": 14, "dpad-right": 15,
    "l1": 4, "r1": 5, "l2": 6, "r2": 7,
    "x": 0, "o": 1, "square": 2, "triangle": 3
  };

  // — Procesar controles con retroalimentación visual —

  // ARM1
  if (mapping.arm1.includes("/")) {
    const [btnA, btnB] = mapping.arm1.split("/").map(s => s.trim());
    if (gp.buttons[buttonIndex[btnA]]?.pressed) {
      changeArm1(-2);
      highlightSelect("map-arm1");
    } else if (gp.buttons[buttonIndex[btnB]]?.pressed) {
      changeArm1(+2);
      highlightSelect("map-arm1");
    }
  } else if (mapping.arm1.startsWith("axis-")) {
    const axis = mapping.arm1.split("-")[1];
    if (axis === "left-x") {
      const val = gp.axes[0] * mapping.sensLeft;
      if (Math.abs(val) > 0.15) {
        changeArm1(Math.sign(val) * 2);
        highlightSelect("map-arm1");
      }
    }
  }

  // ARM2
  if (mapping.arm2.includes("/")) {
    const [btnA, btnB] = mapping.arm2.split("/").map(s => s.trim());
    if (gp.buttons[buttonIndex[btnA]]?.pressed) {
      changeArm2(+2);
      highlightSelect("map-arm2");
    } else if (gp.buttons[buttonIndex[btnB]]?.pressed) {
      changeArm2(-2);
      highlightSelect("map-arm2");
    }
  } else if (mapping.arm2.startsWith("axis-")) {
    const axis = mapping.arm2.split("-")[1];
    if (axis === "left-y") {
      const val = gp.axes[1] * mapping.sensLeft;
      if (Math.abs(val) > 0.15) {
        changeArm2(-Math.sign(val) * 2);
        highlightSelect("map-arm2");
      }
    }
  }

  // BASE
  if (mapping.base.includes("/")) {
    const [btnA, btnB] = mapping.base.split("/").map(s => s.trim());
    if (gp.buttons[buttonIndex[btnA]]?.pressed) {
      changeBase(+1);
      highlightSelect("map-base");
    } else if (gp.buttons[buttonIndex[btnB]]?.pressed) {
      changeBase(-1);
      highlightSelect("map-base");
    }
  } else if (mapping.base.startsWith("axis-")) {
    const axis = mapping.base.split("-")[1];
    if (axis === "right-y") {
      const val = gp.axes[3] * mapping.sensRight;
      if (Math.abs(val) > 0.15) {
        changeBase(-Math.sign(val) * 1);
        highlightSelect("map-base");
      }
    }
  }

  // GRIP (manejo especial - envío inmediato)
  if (mapping.grip.includes("/")) {
    const [btnA, btnB] = mapping.grip.split("/").map(s => s.trim());
    if (gp.buttons[buttonIndex[btnA]]?.pressed || gp.buttons[buttonIndex[btnB]]?.pressed) {
      toggleGrip();
      highlightSelect("map-grip");
    }
  }

  // Si hubo movimiento de posición, programar envío automático
  if (movementMade) {
    scheduleAutoSend();
    lastInputTime = now;
  }
}

// ———————————————————————————————
// 12. Polling mejorado para gamepad
function pollGamepad() {
  const gamepads = navigator.getGamepads();
  const gp = gamepads[0] || gamepads[gamepadIndex];

  if (gp && !haveGamepad) {
    haveGamepad = true;
    gamepadIndex = gp.index;
    updateGamepadStatus(true);
    updateControlModeDisplay();
    console.log("Gamepad detectado por polling:", gp.id);
  }

  if (!gp && haveGamepad) {
    haveGamepad = false;
    gamepadIndex = -1;
    updateGamepadStatus(false);
    updateControlModeDisplay();
    clearButtonHighlights();
    console.log("Gamepad no encontrado en polling");
  }

  if (haveGamepad && gp) {
    applyGamepadMapping();
  }
}

setInterval(pollGamepad, 50);

// ———————————————————————————————
// 13. Verificar estado de Arduino (solo indica conectado/desconectado)
async function checkArduinoStatus() {
  try {
    let res = await fetch("/get-status/");
    let data = await res.json();
    const dot = document.getElementById("arduino-dot");
    if (dot) {
      dot.classList.remove("bg-green-500", "bg-gray-500");
      dot.classList.add(data.connected ? "bg-green-500" : "bg-gray-500");
    }
    // Actualizamos busy para usarlo en el momento de aplicar movimientos
    if (window.scara2D && window.scara2D.appState) {
      window.scara2D.appState.busy = data.busy;
    }
  } catch (e) {
    console.error("Error al verificar estado Arduino:", e);
    const dot = document.getElementById("arduino-dot");
    if (dot) {
      dot.classList.remove("bg-green-500");
      dot.classList.add("bg-gray-500");
    }
    if (window.scara2D && window.scara2D.appState) {
      window.scara2D.appState.busy = false;
    }
  }
}

checkArduinoStatus();
setInterval(checkArduinoStatus, 3000);

// ———————————————————————————————
// 14. Resto de inicialización
document.addEventListener("DOMContentLoaded", function() {
  loadConfig();
  initializeTabs();
  updateControlModeDisplay();

  // Ya no necesitamos el botón "Aplicar movimientos" porque es automático
  // Pero si existe, podemos usarlo como backup manual
  const applyBtn = document.getElementById("apply-movement-btn");
  if (applyBtn) {
    applyBtn.style.display = "none"; // Ocultar porque ya no es necesario
  }

  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const tab = e.currentTarget.getAttribute("data-tab");
      switchTab(tab);
    });
  });
  
  const modal = document.getElementById("calibration-modal");
  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target.id === "calibration-modal") {
        closeCalibrationModal();
      }
    });
  }
  
  const sensLeft = document.getElementById("sens-left");
  const sensRight = document.getElementById("sens-right");
  if (sensLeft) sensLeft.addEventListener("input", updateSensitivityDisplay);
  if (sensRight) sensRight.addEventListener("input", updateSensitivityDisplay);
  
  document.querySelectorAll("#map-arm1, #map-arm2, #map-base, #map-grip").forEach(select => {
    select.addEventListener("change", saveCustomConfig);
  });
  
  console.log("🎮 PS4 Controller integration v2 listo y funcionando");
});

// ———————————————————————————————
// 15. Funciones de testing y exportConfig
function testCurrentMapping() {
  showNotification("🎮 Prueba tu configuración moviendo el control PS4", "info");
}

function exportConfig() {
  const config = customConfig || defaultMapping;
  console.log("Configuración actual:", JSON.stringify(config, null, 2));
  showNotification("Configuración exportada a la consola", "info");
}

// ———————————————————————————————
// 16. Función para toggle del envío automático (opcional)
function toggleAutoSend() {
  autoSendEnabled = !autoSendEnabled;
  const status = autoSendEnabled ? "activado" : "desactivado";
  showNotification(`Envío automático ${status}`, autoSendEnabled ? "success" : "warning");
  console.log(`Auto-send ${status}`);
}