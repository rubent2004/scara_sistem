# 🤖 Sistema de Control SCARA – Visualización 2D/3D + Control PS4 | Django

Este proyecto es un sistema de control remoto para un brazo robótico tipo SCARA, desarrollado con Django. Ofrece una interfaz gráfica intuitiva, con visualización 2D (Canvas) y 3D (Three.js), además de compatibilidad con un control de **PlayStation 4** para manejar los ángulos de los brazos y la apertura/cierre de la garra.

---

## ✨ Características

- 🎮 **Soporte para control PS4** vía USB o Bluetooth.
- 🖥️ Visualización en **2D** y **3D interactiva** del brazo robótico.
- ⚙️ Control manual de ángulos desde el navegador.
- 🦾 Control de apertura/cierre de garra.
- 📊 Panel web para registrar, visualizar y ejecutar movimientos.
- 🧠 Arquitectura extensible para integrar hardware real.

---

## 🧰 Requisitos del Sistema

- Python 3.8 o superior  
- pip  
- Virtualenv (opcional)  
- Navegador moderno (Chrome, Firefox)  
- Control de PS4 vía USB/Bluetooth  
- Acceso a puertos seriales (para hardware real)

---

## 🔌 Librerías recomendadas (Control PS4 y Puertos)

Para interpretar las señales del control PS4 y comunicarse con hardware, se recomienda instalar:

```bash
pip install inputs pyserial
```

- `inputs`: Captura eventos de gamepads en sistemas Linux/Windows.
- `pyserial`: Permite enviar datos a través de puertos seriales, útil para microcontroladores.

> **Nota**: El sistema está diseñado para usarse en modo simulación (sin hardware) o conectado a un brazo SCARA físico vía USB/Serial.

---

## ⚙️ Instalación y Configuración

### 1. Clonar el repositorio (opcional)
```bash
git clone https://github.com/usuario/control-scara.git
cd control-scara
```

### 2. Crear un entorno virtual

**Windows:**
```bash
python -m venv venv
venv\Scripts\activate
```

**Linux/Mac:**
```bash
python3 -m venv venv
source venv/bin/activate
```

### 3. Instalar dependencias

```bash
pip install -r requirements.txt
```

> También puedes agregar manualmente:
```bash
pip install inputs pyserial
```

### 4. Aplicar migraciones

```bash
python manage.py makemigrations
python manage.py migrate
```

### 5. Crear superusuario (opcional)

```bash
python manage.py createsuperuser
```

### 6. Ejecutar el servidor

```bash
python manage.py runserver
```

---

## 🌐 Acceso a la Aplicación

Abre tu navegador y accede a:

```
http://127.0.0.1:8000/
```

---

## 🕹️ Control PS4 - Funcionalidad

- Joystick izquierdo/derecho: Controlan ángulos de los brazos (θ1 y θ2).
- Botón `X` / `O`: Abrir o cerrar la garra.
- Comunicación en tiempo real con el navegador mediante JavaScript y APIs de entrada.
- Para conexiones físicas, los comandos se envían por puerto serial (`COMx` / `/dev/ttyUSBx`).

> Puedes adaptar el backend para enviar comandos a microcontroladores (como Arduino, ESP32, etc).

---

## 🧠 Estructura del Proyecto

```
├── control/              # App principal
├── static/               # Archivos JS, CSS (incluye Three.js)
├── templates/            # HTML frontend
├── media/                # Registros o capturas (opcional)
├── requirements.txt
└── manage.py
```

---

## 🛠️ Tecnologías Usadas

- **Django** – Backend web
- **HTML5 Canvas** – Visualización 2D del brazo
- **Three.js** – Modelo 3D interactivo en el navegador
- **JavaScript Gamepad API** – Lectura de control PS4 en frontend
- **pyserial** – Comunicación con hardware
- **inputs** – Lectura de gamepad en backend (opcional)

---



## 👨‍💻 Autor

**Rubén Alejandro Torres Sánchez**  
Estudiante de Ingeniería en Sistemas y Computación  
Universidad Dr. Andrés Bello

---

¿Deseas desplegarlo en producción, añadir animaciones o integrar controladores físicos reales? Este proyecto es flexible para escalar tanto en simulación como en hardware.


