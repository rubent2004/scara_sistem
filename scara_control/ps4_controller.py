# scara_control/ps4_controller.py - 
from pyPS4Controller.controller import Controller
from .arduino_communication import arduino_controller
import threading
import time

# Bandera global para el estado del PS4
ps4_connected = False

class SCARAPS4Controller(Controller):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.increment = 5  # Incremento por defecto para movimientos
        self.current_speed = 500  # Velocidad por defecto

    def on_x_press(self):
        """Botón X: Incrementar arm1"""
        try:
            pos = arduino_controller.get_last_position()
            new_arm1 = pos['arm1'] + self.increment
            arduino_controller.send_position(new_arm1, pos['arm2'], pos['base'], pos['gripper'], self.current_speed)
            print(f"[PS4] X pressed: arm1 = {new_arm1}")
        except Exception as e:
            print(f"[PS4] Error en X press: {e}")

    def on_triangle_press(self):
        """Botón Triángulo: Decrementar arm1"""
        try:
            pos = arduino_controller.get_last_position()
            new_arm1 = pos['arm1'] - self.increment
            arduino_controller.send_position(new_arm1, pos['arm2'], pos['base'], pos['gripper'], self.current_speed)
            print(f"[PS4] Triangle pressed: arm1 = {new_arm1}")
        except Exception as e:
            print(f"[PS4] Error en Triangle press: {e}")

    def on_square_press(self):
        """Botón Cuadrado: Incrementar arm2"""
        try:
            pos = arduino_controller.get_last_position()
            new_arm2 = pos['arm2'] + self.increment
            arduino_controller.send_position(pos['arm1'], new_arm2, pos['base'], pos['gripper'], self.current_speed)
            print(f"[PS4] Square pressed: arm2 = {new_arm2}")
        except Exception as e:
            print(f"[PS4] Error en Square press: {e}")

    def on_circle_press(self):
        """Botón Círculo: Decrementar arm2"""
        try:
            pos = arduino_controller.get_last_position()
            new_arm2 = pos['arm2'] - self.increment
            arduino_controller.send_position(pos['arm1'], new_arm2, pos['base'], pos['gripper'], self.current_speed)
            print(f"[PS4] Circle pressed: arm2 = {new_arm2}")
        except Exception as e:
            print(f"[PS4] Error en Circle press: {e}")

    def on_up_arrow_press(self):
        """Flecha Arriba: Incrementar base (subir)"""
        try:
            pos = arduino_controller.get_last_position()
            new_base = pos['base'] + self.increment
            arduino_controller.send_position(pos['arm1'], pos['arm2'], new_base, pos['gripper'], self.current_speed)
            print(f"[PS4] Up arrow pressed: base = {new_base}")
        except Exception as e:
            print(f"[PS4] Error en Up arrow press: {e}")

    def on_down_arrow_press(self):
        """Flecha Abajo: Decrementar base (bajar)"""
        try:
            pos = arduino_controller.get_last_position()
            new_base = pos['base'] - self.increment
            arduino_controller.send_position(pos['arm1'], pos['arm2'], new_base, pos['gripper'], self.current_speed)
            print(f"[PS4] Down arrow pressed: base = {new_base}")
        except Exception as e:
            print(f"[PS4] Error en Down arrow press: {e}")

    def on_R1_press(self):
        """R1: Cerrar pinza"""
        try:
            pos = arduino_controller.get_last_position()
            arduino_controller.send_position(pos['arm1'], pos['arm2'], pos['base'], 100, self.current_speed)
            print("[PS4] R1 pressed: gripper closed")
        except Exception as e:
            print(f"[PS4] Error en R1 press: {e}")

    def on_L1_press(self):
        """L1: Abrir pinza"""
        try:
            pos = arduino_controller.get_last_position()
            arduino_controller.send_position(pos['arm1'], pos['arm2'], pos['base'], 0, self.current_speed)
            print("[PS4] L1 pressed: gripper opened")
        except Exception as e:
            print(f"[PS4] Error en L1 press: {e}")

    def on_R2_press(self, value):
        """R2: Aumentar velocidad"""
        if value > 0:
            self.current_speed = min(2000, self.current_speed + 100)
            print(f"[PS4] R2 pressed: speed = {self.current_speed}")

    def on_L2_press(self, value):
        """L2: Disminuir velocidad"""
        if value > 0:
            self.current_speed = max(100, self.current_speed - 100)
            print(f"[PS4] L2 pressed: speed = {self.current_speed}")

    def on_options_press(self):
        """Botón Options: Posición home"""
        try:
            arduino_controller.home_position()
            print("[PS4] Options pressed: going home")
        except Exception as e:
            print(f"[PS4] Error en Options press: {e}")

    def on_share_press(self):
        """Botón Share: Cambiar incremento"""
        if self.increment == 5:
            self.increment = 10
        elif self.increment == 10:
            self.increment = 1
        else:
            self.increment = 5
        print(f"[PS4] Share pressed: increment = {self.increment}")

def iniciar_controlador():
    """
    Función para iniciar el controlador PS4 en un hilo separado
    """
    global ps4_connected
    ps4_connected = False
    
    try:
        print("[PS4] Intentando conectar controlador PS4...")
        controller = SCARAPS4Controller(interface="/dev/input/js0", connecting_using_ds4drv=False)
        ps4_connected = True
        print("[PS4] Controlador PS4 conectado exitosamente")
        controller.listen()
    except Exception as e:
        ps4_connected = False
        print(f"[PS4] Error al iniciar el controlador PS4: {e}")
        print("[PS4] Asegúrate de que:")
        print("  - El controlador esté conectado via USB o Bluetooth")
        print("  - Tengas permisos para acceder al dispositivo")
        print("  - pyPS4Controller esté instalado correctamente")