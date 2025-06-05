document.addEventListener('DOMContentLoaded', function() {
    // Elementos de la interfaz
    const q1Slider = document.getElementById('q1Slider');
    const q1Value = document.getElementById('q1Value');
    const q1Minus = document.getElementById('q1Minus');
    const q1Plus = document.getElementById('q1Plus');
    const q1Step = document.getElementById('q1Step');
    
    const q2Slider = document.getElementById('q2Slider');
    const q2Value = document.getElementById('q2Value');
    const q2Minus = document.getElementById('q2Minus');
    const q2Plus = document.getElementById('q2Plus');
    const q2Step = document.getElementById('q2Step');
    
    const zSlider = document.getElementById('zSlider');
    const zValue = document.getElementById('zValue');
    const zMinus = document.getElementById('zMinus');
    const zPlus = document.getElementById('zPlus');
    const zStep = document.getElementById('zStep');
    
    const gripSlider = document.getElementById('gripSlider');
    const gripValue = document.getElementById('gripValue');
    
    const sendBtn = document.getElementById('sendBtn');
    const homeBtn = document.getElementById('homeBtn');
    const saveBtn = document.getElementById('saveBtn');
    const runBtn = document.getElementById('runBtn');
    const stopBtn = document.getElementById('stopBtn');
    const clearBtn = document.getElementById('clearBtn');
    
    const statusMessage = document.getElementById('statusMessage');
    const sequenceCount = document.getElementById('sequenceCount');
    const arduinoResponse = document.getElementById('arduinoResponse');
    
    // Variables de estado
    let currentPosition = {
        q1: 0,
        q2: 0,
        z: 0,
        grip: 0
    };
    
    // Actualizar valores cuando se mueven los sliders
    q1Slider.addEventListener('input', () => {
        currentPosition.q1 = parseInt(q1Slider.value);
        q1Value.textContent = currentPosition.q1;
    });
    
    q2Slider.addEventListener('input', () => {
        currentPosition.q2 = parseInt(q2Slider.value);
        q2Value.textContent = currentPosition.q2;
    });
    
    zSlider.addEventListener('input', () => {
        currentPosition.z = parseInt(zSlider.value);
        zValue.textContent = currentPosition.z;
    });
    
    gripSlider.addEventListener('input', () => {
        currentPosition.grip = parseInt(gripSlider.value);
        gripValue.textContent = currentPosition.grip;
    });
    
    // Botones de incremento/decremento
    q1Minus.addEventListener('click', () => {
        const step = parseInt(q1Step.value);
        currentPosition.q1 = Math.max(-90, currentPosition.q1 - step);
        q1Slider.value = currentPosition.q1;
        q1Value.textContent = currentPosition.q1;
    });
    
    q1Plus.addEventListener('click', () => {
        const step = parseInt(q1Step.value);
        currentPosition.q1 = Math.min(90, currentPosition.q1 + step);
        q1Slider.value = currentPosition.q1;
        q1Value.textContent = currentPosition.q1;
    });
    
    // (Repetir para q2 y z de manera similar)
    
    // Función para enviar comandos al servidor
    function sendCommand(endpoint, data = {}) {
        return fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken()
            },
            body: JSON.stringify(data)
        })
        .then(response => response.json());
    }
    
    // Obtener token CSRF
    function getCSRFToken() {
        return document.cookie.split('; ')
            .find(row => row.startsWith('csrftoken='))
            ?.split('=')[1];
    }
    
    // Enviar posición actual
    sendBtn.addEventListener('click', () => {
        sendCommand('/send-command/', currentPosition)
            .then(data => {
                if (data.status === 'success') {
                    arduinoResponse.textContent = `Arduino: ${data.response}`;
                    statusMessage.textContent = "Comando enviado";
                } else {
                    arduinoResponse.textContent = `Error: ${data.error}`;
                }
            });
    });
    
    // Enviar a posición home
    homeBtn.addEventListener('click', () => {
        sendCommand('/home/')
            .then(data => {
                if (data.status === 'success') {
                    // Resetear sliders
                    q1Slider.value = 0;
                    q2Slider.value = 0;
                    zSlider.value = 0;
                    gripSlider.value = 0;
                    
                    currentPosition = {q1: 0, q2: 0, z: 0, grip: 0};
                    q1Value.textContent = '0';
                    q2Value.textContent = '0';
                    zValue.textContent = '0';
                    gripValue.textContent = '0';
                    
                    arduinoResponse.textContent = `Arduino: ${data.response}`;
                    statusMessage.textContent = "Posición Home";
                }
            });
    });
    
    // Guardar posición actual
    saveBtn.addEventListener('click', () => {
        sendCommand('/save-position/', currentPosition)
            .then(data => {
                if (data.status === 'success') {
                    sequenceCount.textContent = data.sequence_length;
                    statusMessage.textContent = data.message;
                }
            });
    });
    
    // Ejecutar secuencia
    runBtn.addEventListener('click', () => {
        sendCommand('/run-sequence/')
            .then(data => {
                if (data.status === 'success') {
                    statusMessage.textContent = data.message;
                    runBtn.disabled = true;
                    stopBtn.disabled = false;
                    executeSequence();
                }
            });
    });
    
    // Detener secuencia
    stopBtn.addEventListener('click', () => {
        sendCommand('/stop-sequence/')
            .then(data => {
                if (data.status === 'success') {
                    statusMessage.textContent = data.message;
                    runBtn.disabled = false;
                    stopBtn.disabled = true;
                }
            });
    });
    
    // Borrar secuencia
    clearBtn.addEventListener('click', () => {
        sendCommand('/clear-sequence/')
            .then(data => {
                if (data.status === 'success') {
                    sequenceCount.textContent = '0';
                    statusMessage.textContent = data.message;
                }
            });
    });
    
    // Ejecutar la secuencia paso a paso
    function executeSequence() {
        fetch('/next-position/')
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    // Actualizar posición actual
                    currentPosition = data.position;
                    
                    // Actualizar UI
                    q1Slider.value = currentPosition.q1;
                    q2Slider.value = currentPosition.q2;
                    zSlider.value = currentPosition.z;
                    gripSlider.value = currentPosition.grip;
                    
                    q1Value.textContent = currentPosition.q1;
                    q2Value.textContent = currentPosition.q2;
                    zValue.textContent = currentPosition.z;
                    gripValue.textContent = currentPosition.grip;
                    
                    // Enviar comando al Arduino
                    sendCommand('/send-command/', currentPosition)
                        .then(result => {
                            if (result.status === 'success') {
                                arduinoResponse.textContent = `Paso ${data.index}/${data.total}: ${result.response}`;
                                
                                // Continuar con el siguiente paso
                                setTimeout(executeSequence, 1000);
                            }
                        });
                } else if (data.status === 'stopped') {
                    statusMessage.textContent = data.message;
                    runBtn.disabled = false;
                    stopBtn.disabled = true;
                }
            });
    }
});