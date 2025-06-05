# scara_control/views.py - VERSIÓN CORREGIDA

import threading
import time
import json

from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

from rest_framework.decorators import api_view
from rest_framework.response import Response

from .arduino_communication import arduino_controller
from .models import RobotPosition, RobotSequence, SequencePosition
from .serializers import RobotPositionSerializer, RobotSequenceSerializer
from .ps4_controller import iniciar_controlador, ps4_connected

def index(request):
    """
    Página principal (UI).
    """
    return render(request, 'scara_control/index.html')

@csrf_exempt
def send_command(request):
    """
    Recibe un POST con JSON: {'base':..., 'arm1':..., 'arm2':..., 'gripper':..., 'speed':...}
    y envía ese comando al Arduino (serial).
    """
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'Método no permitido'}, status=405)

    try:
        data = json.loads(request.body)
    except Exception as e:
        print(f"[views.send_command] ERROR parseando JSON: {e}")
        return JsonResponse({'success': False, 'error': 'JSON inválido'}, status=400)

    # Obtener valores con valores por defecto
    arm1 = data.get('arm1', 0)
    arm2 = data.get('arm2', 0)
    base = data.get('base', 20)
    gripper = data.get('gripper', 0)
    speed = data.get('speed', 500)

    print(f"[views.send_command] Comando recibido: arm1={arm1}, arm2={arm2}, base={base}, gripper={gripper}, speed={speed}")

    # Verificar conexión
    if not arduino_controller.is_connected_status():
        print("[views.send_command] Arduino no conectado, intentando reconectar...")
        arduino_controller.connect()
        if not arduino_controller.is_connected_status():
            return JsonResponse({'success': False, 'error': 'Arduino no conectado'}, status=500)

    # Enviar comando
    success = arduino_controller.send_position(arm1, arm2, base, gripper, speed)
    
    if success:
        return JsonResponse({'success': True})
    else:
        return JsonResponse({'success': False, 'error': 'Error enviando comando'}, status=500)

def get_status(request):
    """
    Devuelve el estado de conexión, si está ocupado (busy) y la última posición.
    """
    connected = arduino_controller.is_connected_status()
    last_position = arduino_controller.get_last_position() if connected else None

    # <-- AÑADIMOS busy AQUI:
    busy = False
    if connected:
        # is_robot_busy() es True mientras Arduino no haya enviado “DONE”
        busy = arduino_controller.is_robot_busy()

    response = {
        'connected': connected,
        'busy': busy,                # <-- este campo es nuevo
        'last_position': last_position
    }

    return JsonResponse(response)


@csrf_exempt 
def home_position(request):
    """
    Envía el robot a la posición home (0,0,0,0)
    """
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'Método no permitido'}, status=405)
    
    try:
        success = arduino_controller.home_position()
        if success:
            return JsonResponse({'success': True, 'message': 'Robot en posición home'})
        else:
            return JsonResponse({'success': False, 'error': 'Error enviando a home'}, status=500)
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

# ----------------------------------------------------------------------------------------------------
# CRUD de Posiciones y Secuencias (API REST – DRF)
# ----------------------------------------------------------------------------------------------------

@api_view(['GET', 'POST'])
def positions_list(request):
    if request.method == 'GET':
        qs = RobotPosition.objects.all()
        return Response(RobotPositionSerializer(qs, many=True).data)

    # POST - Crear nueva posición
    serializer = RobotPositionSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save()
        print(f"[views.positions_list] Nueva posición creada: {serializer.data}")
        return Response(serializer.data, status=201)
    else:
        return Response(serializer.errors, status=400)

@api_view(['GET', 'POST'])
def sequences_list(request):
    if request.method == 'GET':
        qs = RobotSequence.objects.all()
        return Response(RobotSequenceSerializer(qs, many=True).data)

    # POST - Crear nueva secuencia
    try:
        data = request.data
        seq = RobotSequence.objects.create(name=data.get('name', 'Sin nombre'))
        
        for item in data.get('positions', []):
            pos_data = item.get('position', {})
            pos, created = RobotPosition.objects.get_or_create(**pos_data)
            
            SequencePosition.objects.create(
                sequence=seq,
                position=pos,
                order=item.get('order', 0),
                delay_seconds=item.get('delay_seconds', 1.0)
            )
        
        serialized = RobotSequenceSerializer(seq).data
        return Response(serialized, status=201)
        
    except Exception as e:
        print(f"[views.sequences_list] Error creando secuencia: {e}")
        return Response({'error': str(e)}, status=500)

@csrf_exempt
@api_view(['POST'])
def run_sequence(request):
    """
    Ejecuta una secuencia de movimientos
    """
    seq_id = request.data.get('sequence_id')
    
    try:
        seq = RobotSequence.objects.get(id=seq_id)
    except RobotSequence.DoesNotExist:
        return Response({'success': False, 'error': 'Secuencia no encontrada'}, status=404)

    if not arduino_controller.is_connected_status():
        return Response({'success': False, 'error': 'Arduino no conectado'}, status=500)

    print(f"[views.run_sequence] Ejecutando secuencia: {seq.name}")

    try:
        for sp in seq.sequenceposition_set.all().order_by('order'):
            pos = sp.position
            print(f"   Paso {sp.order}: arm1={pos.arm1_angle}, arm2={pos.arm2_angle}, base={pos.base_height}, gripper={pos.gripper_state}")
            
            arduino_controller.send_position(
                pos.arm1_angle, 
                pos.arm2_angle, 
                pos.base_height, 
                pos.gripper_state,
                500  # Velocidad por defecto
            )
            
            time.sleep(sp.delay_seconds)

        return Response({'success': True, 'message': 'Secuencia ejecutada correctamente'})
        
    except Exception as e:
        print(f"[views.run_sequence] Error ejecutando secuencia: {e}")
        return Response({'success': False, 'error': str(e)}, status=500)

def control_robot(request):
    """
    Página para el control con PS4/Gamepad.
    """
    if request.method == "POST":
        try:
            print("[views.control_robot] Iniciando controlador PS4...")
            hilo = threading.Thread(target=iniciar_controlador, daemon=True)
            hilo.start()
            return render(request, 'scara_control/control.html', {"mensaje": "Controlador PS4 iniciado"})
        except Exception as e:
            return render(request, 'scara_control/control.html', {"error": f"Error iniciando PS4: {e}"})
    else:
        return render(request, 'scara_control/control.html')

@csrf_exempt
def get_ps4_status(request):
    """
    Devuelve el estado de conexión del controlador PS4
    """
    return JsonResponse({'connected': ps4_connected})

# ----------------------------------------------------------------------------------------------------
# ENDPOINTS ADICIONALES PARA COMPATIBILIDAD
# ----------------------------------------------------------------------------------------------------

@csrf_exempt
def save_position(request):
    """
    Guarda la posición actual como un RobotPosition
    """
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'Método no permitido'}, status=405)
    
    try:
        data = json.loads(request.body)
        position = RobotPosition.objects.create(
            name=data.get('name', f'Posición {RobotPosition.objects.count() + 1}'),
            arm1_angle=data.get('arm1', 0),
            arm2_angle=data.get('arm2', 0),
            base_height=data.get('base', 20),
            gripper_state=data.get('gripper', 0)
        )
        
        return JsonResponse({
            'success': True,
            'message': f'Posición guardada: {position.name}',
            'position_id': position.id
        })
        
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)