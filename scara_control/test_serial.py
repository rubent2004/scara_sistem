import serial
import time

puerto = 'COM7'
baudios = 9600

try:
    arduino = serial.Serial(puerto, baudios)
    time.sleep(2)  # Esperar a que el Arduino se reinicie

    # Formato: arm1,arm2,base,gripper (ejemplo: mover brazo 1 a 90 grados)
    comando = "0,-75,0,1,500\n"
    arduino.write(comando.encode())
    print("Comando enviado:", comando.strip())

    arduino.close()
    print("Conexión cerrada correctamente.")

except Exception as e:
    print("Error al conectar o enviar:", e)
