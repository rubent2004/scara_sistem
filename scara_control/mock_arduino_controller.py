class MockArduinoController:
    def __init__(self):
        self.last_position = {
            'arm1': 0,
            'arm2': 0,
            'base': 0,
            'gripper': False,
            'speed': 500
        }
        self.current_gripper_state = False
        self.is_busy = False
        self.waiting_for_done = False
        self.is_connected = True

    def send_position(self, arm1_angle, arm2_angle, base_height, gripper_state, speed=500):
        print(f"[MOCK] Comando simulado: {arm1_angle},{arm2_angle},{base_height},{gripper_state},{speed}")
        self.last_position = {
            'arm1': arm1_angle,
            'arm2': arm2_angle,
            'base': base_height,
            'gripper': gripper_state,
            'speed': speed
        }
        self.current_gripper_state = gripper_state
        return True

    def send_command(self, q1, q2, z, grip, speed=500):
        return self.send_position(q1, q2, z, grip, speed)

    def open_gripper(self, speed=500):
        return self.send_position(
            self.last_position['arm1'],
            self.last_position['arm2'],
            self.last_position['base'],
            False,
            speed
        )

    def close_gripper(self, speed=500):
        return self.send_position(
            self.last_position['arm1'],
            self.last_position['arm2'],
            self.last_position['base'],
            True,
            speed
        )

    def toggle_gripper(self, speed=500):
        new_state = not self.current_gripper_state
        return self.send_position(
            self.last_position['arm1'],
            self.last_position['arm2'],
            self.last_position['base'],
            new_state,
            speed
        )

    def home_position(self):
        return self.send_position(0, 0, 0, False, 500)

    def is_robot_busy(self):
        return False

    def get_last_position(self):
        return self.last_position.copy()

    def get_gripper_state(self):
        return self.current_gripper_state

    def get_gripper_state_text(self):
        return "CERRADA (119°)" if self.current_gripper_state else "ABIERTA (180°)"

    def get_robot_status(self):
        return {
            'connected': True,
            'busy': False,
            'waiting_confirmation': False,
            'last_position': self.get_last_position(),
            'gripper_state': self.get_gripper_state_text()
        }

    def is_connected_status(self):
        return True

    def close(self):
        print("[MOCK] Conexión simulada cerrada")
