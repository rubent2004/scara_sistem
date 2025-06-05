#arduino_controller.py que si funciona 
import serial
import threading
import time

class ArduinoController:
    _instance = None
    _lock = threading.Lock()
    
    def __new__(cls, port='COM7', baud=9600):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super(ArduinoController, cls).__new__(cls)
                cls._instance.port = port
                cls._instance.baud = baud
                cls._instance.serial_conn = None
                cls._instance.connect()
            return cls._instance

    def connect(self):
        if self.serial_conn is None or not self.serial_conn.is_open:
            try:
                self.serial_conn = serial.Serial(self.port, self.baud, timeout=1)
                time.sleep(2)  # Esperar a que se establezca la conexión
                print(f"Connected to Arduino on {self.port}")
            except Exception as e:
                print(f"Error connecting to Arduino: {e}")

    def send_command(self, q1, q2, z, grip):
        """Envía un comando al Arduino en el formato: q1,q2,z,grip"""
        command = f"{q1},{q2},{z},{grip}\n"
        try:
            if self.serial_conn and self.serial_conn.is_open:
                self.serial_conn.write(command.encode('utf-8'))
                # Leer respuesta (si la hay)
                response = self.serial_conn.readline().decode().strip()
                return response
            else:
                self.connect()
                return "Reconnected and sent"
        except Exception as e:
            print(f"Error sending command: {e}")
            return f"Error: {e}"

    def close(self):
        if self.serial_conn and self.serial_conn.is_open:
            self.serial_conn.close()
            print("Serial connection closed")

# Instancia global para usar en las vistas
arduino_controller = ArduinoController()