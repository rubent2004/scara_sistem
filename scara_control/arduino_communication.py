import serial
import threading
import time

from .mock_arduino_controller import MockArduinoController

class ArduinoController:
    """
    Controlador de Arduino mejorado con manejo de confirmación DONE.
    Servo: 180° = ABIERTO, 119° = CERRADO
    """
    _instance = None
    _lock = threading.Lock()

    def __new__(cls, port='COM10', baud=9600):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super(ArduinoController, cls).__new__(cls)
                cls._instance.port = port
                cls._instance.baud = baud
                cls._instance.serial_conn = None
                # Base inicial en centímetros (±12.5 cm)
                cls._instance.last_position = {
                    'arm1': 0,
                    'arm2': 0,
                    'base': 0,
                    'gripper': False,
                    'speed': 500
                }
                cls._instance.is_connected = False
                cls._instance.current_gripper_state = False
                cls._instance.is_busy = False          # Indica si está ejecutando un movimiento
                cls._instance.waiting_for_done = False # Esperando “DONE” del Arduino
                cls._instance.response_timeout = 30.0  # Timeout en segundos
                cls._instance.connect()
            return cls._instance
        
    def connect(self):
        """Establece la conexión serial con Arduino y espera el mensaje inicial."""
        if self.serial_conn is None or not self.serial_conn.is_open:
            try:
                self.serial_conn = serial.Serial(self.port, self.baud, timeout=1)
                # Pequeña pausa para que Arduino resetee
                time.sleep(2)
                
                # Leer el primer “Sistema iniciado… DONE”
                self._wait_for_ready()
                
                self.is_connected = True
                print(f"[ArduinoController] Conectado a Arduino en {self.port}")
            except Exception as e:
                self.is_connected = False
                print(f"[ArduinoController] Error conectando a Arduino: {e}")

    def _wait_for_ready(self, timeout=10):
        """Espera a que Arduino envíe 'DONE' o el mensaje inicial."""
        start_time = time.time()
        while time.time() - start_time < timeout:
            if self.serial_conn and self.serial_conn.in_waiting > 0:
                try:
                    response = self.serial_conn.readline().decode('utf-8').strip()
                    if response:
                        print(f"[ArduinoController] Arduino: {response}")
                        if "DONE" in response or "iniciado" in response:
                            return True
                except:
                    pass
            time.sleep(0.1)
        return False

    def _wait_for_confirmation(self):
        """Espera la confirmación 'DONE' del Arduino."""
        if not self.serial_conn or not self.serial_conn.is_open:
            return False
            
        start_time = time.time()
        self.waiting_for_done = True
        
        try:
            while time.time() - start_time < self.response_timeout:
                if self.serial_conn.in_waiting > 0:
                    response = self.serial_conn.readline().decode('utf-8').strip()
                    if response:
                        print(f"[ArduinoController] Arduino respuesta: {response}")
                        if "DONE" in response:
                            print("[ArduinoController] ✅ Confirmación DONE recibida")
                            self.waiting_for_done = False
                            return True
                        elif "ERROR" in response:
                            print(f"[ArduinoController] ❌ Error reportado por Arduino: {response}")
                            self.waiting_for_done = False
                            return False
                time.sleep(0.05)  # Polling cada 50 ms
            # Timeout sin recibir DONE
            print("[ArduinoController] ⚠️ Timeout esperando confirmación DONE")
            self.waiting_for_done = False
            return False
        except Exception as e:
            print(f"[ArduinoController] Error esperando confirmación: {e}")
            self.waiting_for_done = False
            return False

    def is_robot_busy(self):
        """Verifica si el robot está ocupado ejecutando un movimiento."""
        return self.is_busy or self.waiting_for_done

    def send_position(self, arm1_angle, arm2_angle, base_height, gripper_state, speed=500):
        """
        Envía un comando al Arduino y espera confirmación DONE.
        Parám: arm1_angle  (–90…+90)
               arm2_angle  (–120…+60)
               base_height (–12.5…+12.5) en cm
               gripper_state (bool o 0/1)
               speed       (100…2000 pasos/s)
        """
        # Si ya está ocupado, no enviamos nada
        if self.is_robot_busy():
            print("[ArduinoController] ⚠️ Robot ocupado, comando rechazado")
            return False
            
        try:
            # Validar rangos de ángulos
            arm1_angle = max(-90, min(90, arm1_angle))
            arm2_angle = max(-120, min(60, arm2_angle))
            # Validar rango de Z: ±12.5 cm
            base_height = max(-12.5, min(12.5, base_height))
            speed = max(100, min(2000, speed))

            # Gripper: aceptar bool o número
            if isinstance(gripper_state, bool):
                gripper_closed = gripper_state
            elif isinstance(gripper_state, (int, float)):
                gripper_closed = bool(gripper_state)
            else:
                gripper_closed = False
            
            arduino_gripper_code = 1 if gripper_closed else 0
            self.current_gripper_state = gripper_closed
            
            # Comando formateado: “arm1,arm2,base_cm,grip,speed\n”
            command = f"{arm1_angle},{arm2_angle},{base_height},{arduino_gripper_code},{speed}\n"

            if self.serial_conn and self.serial_conn.is_open:
                # Marcar ocupado antes de mandar
                self.is_busy = True
                print(f"[ArduinoController] Enviando comando: {command.strip()}")
                self.serial_conn.write(command.encode('utf-8'))
                self.serial_conn.flush()

                # Esperar “DONE”
                confirmation_received = self._wait_for_confirmation()
                self.is_busy = False

                if confirmation_received:
                    # Actualizar última posición conocida
                    self.last_position = {
                        'arm1': arm1_angle,
                        'arm2': arm2_angle,
                        'base': base_height,
                        'gripper': gripper_closed,
                        'speed': speed
                    }
                    estado_texto = "CERRADA (119°)" if gripper_closed else "ABIERTA (180°)"
                    pasos_calculados = base_height * 1000  # 1000 pasos/cm

                    print("[ArduinoController] ✅ Movimiento completado exitosamente")
                    print(f"[ArduinoController] Gripper: {estado_texto}")
                    print(f"[ArduinoController] Base: {base_height} cm → {pasos_calculados} pasos")
                    return True
                else:
                    print("[ArduinoController] ❌ No se recibió confirmación, comando falló")
                    return False
            else:
                print("[ArduinoController] Conexión serial no disponible, intentando reconectar...")
                self.connect()
                return False
        except Exception as e:
            print(f"[ArduinoController] Error enviando comando: {e}")
            self.is_busy = False
            return False

    # Alias para compatibilidad antigua
    def send_command(self, q1, q2, z, grip, speed=500):
        return self.send_position(q1, q2, z, grip, speed)

    def open_gripper(self, speed=500):
        """Abrir la pinza (180°) manteniendo la posición X, Y, Z actuales."""
        if self.is_robot_busy():
            print("[ArduinoController] ⚠️ Robot ocupado, no se puede abrir pinza")
            return False
        print("[ArduinoController] Comando específico: ABRIR pinza (180°)")
        return self.send_position(
            self.last_position['arm1'],
            self.last_position['arm2'],
            self.last_position['base'],
            False,
            speed
        )

    def close_gripper(self, speed=500):
        """Cerrar la pinza (119°) manteniendo la posición X, Y, Z actuales."""
        if self.is_robot_busy():
            print("[ArduinoController] ⚠️ Robot ocupado, no se puede cerrar pinza")
            return False
        print("[ArduinoController] Comando específico: CERRAR pinza (119°)")
        return self.send_position(
            self.last_position['arm1'],
            self.last_position['arm2'],
            self.last_position['base'],
            True,
            speed
        )

    def toggle_gripper(self, speed=500):
        """Alternar estado de la pinza manteniendo pozición X, Y, Z."""
        if self.is_robot_busy():
            print("[ArduinoController] ⚠️ Robot ocupado, no se puede alternar pinza")
            return False
        new_state = not self.current_gripper_state
        estado_nuevo = "CERRADA (119°)" if new_state else "ABIERTA (180°)"
        estado_actual = "CERRADA (119°)" if self.current_gripper_state else "ABIERTA (180°)"
        print(f"[ArduinoController] Alternando pinza: {estado_actual} → {estado_nuevo}")
        return self.send_position(
            self.last_position['arm1'],
            self.last_position['arm2'],
            self.last_position['base'],
            new_state,
            speed
        )

    def home_position(self):
        """Envía el robot a la posición home (0,0,0, pinza abierta)."""
        if self.is_robot_busy():
            print("[ArduinoController] ⚠️ Robot ocupado, no se puede enviar a home")
            return False
        print("[ArduinoController] Enviando a posición HOME")
        return self.send_position(0, 0, 0, False, 500)

    def get_last_position(self):
        """Devuelve la última posición conocida del robot en cm/deg/estado."""
        return self.last_position.copy()

    def get_gripper_state(self):
        """Retorna el estado lógico de la pinza (True=cerrada, False=abierta)."""
        return self.current_gripper_state

    def get_gripper_state_text(self):
        """Retorna el estado de la pinza como texto."""
        return "CERRADA (119°)" if self.current_gripper_state else "ABIERTA (180°)"

    def get_robot_status(self):
        """Retorna un dict con estado de conexión, busy, última posición y pinza."""
        return {
            'connected': self.is_connected_status(),
            'busy': self.is_robot_busy(),
            'waiting_confirmation': self.waiting_for_done,
            'last_position': self.get_last_position(),
            'gripper_state': self.get_gripper_state_text()
        }

    def is_connected_status(self):
        """Verifica si la conexión serial está abierta y viva."""
        return (self.serial_conn is not None 
                and self.serial_conn.is_open 
                and self.is_connected)

    def close(self):
        """Cierra la conexión serial."""
        if self.serial_conn and self.serial_conn.is_open:
            self.serial_conn.close()
            self.is_connected = False
            self.is_busy = False
            self.waiting_for_done = False
            print("[ArduinoController] Conexión serial cerrada")
            
            
USE_FAKE_ARDUINO = False  # Cambia esto a False cuando tengas el Arduino


if USE_FAKE_ARDUINO:
    arduino_controller = MockArduinoController()
else:
    arduino_controller = ArduinoController()
# Instancia global
#arduino_controller = ArduinoController()
