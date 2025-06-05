#views.py del que si funciona 
from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from .arduino_controller import arduino_controller
import json

# Estado global para la secuencia de movimientos
sequence = {'q1': [], 'q2': [], 'z': [], 'grip': []}
is_running = False
current_index = 0

def control_panel(request):
    return render(request, 'control/control.html')

@csrf_exempt
def send_command(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            q1 = data.get('q1', 0)
            q2 = data.get('q2', 0)
            z = data.get('z', 0)
            grip = data.get('grip', 0)
            
            # Validar rangos
            if not (-90 <= q1 <= 90) or not (-90 <= q2 <= 90) or not (-60 <= z <= 60) or not (0 <= grip <= 100):
                return JsonResponse({'error': 'Valores fuera de rango'}, status=400)
            
            # Enviar comando al Arduino
            response = arduino_controller.send_command(q1, q2, z, grip)
            print(f"Comando enviado: q1={q1}, q2={q2}, z={z}, grip={grip}")
            return JsonResponse({'status': 'success', 'response': response})
            
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)
    return JsonResponse({'error': 'Método no permitido'}, status=405)

@csrf_exempt
def save_position(request):
    global sequence
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            sequence['q1'].append(data.get('q1', 0))
            sequence['q2'].append(data.get('q2', 0))
            sequence['z'].append(data.get('z', 0))
            sequence['grip'].append(data.get('grip', 0))
            
            return JsonResponse({
                'status': 'success',
                'message': f'Posición guardada: {len(sequence["q1"])}',
                'sequence_length': len(sequence['q1'])
            })
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)
    return JsonResponse({'error': 'Método no permitido'}, status=405)

@csrf_exempt
def home_position(request):
    if request.method == 'POST':
        try:
            # Enviar comando home (0,0,0,0)
            response = arduino_controller.send_command(0, 0, 0, 0)
            return JsonResponse({'status': 'success', 'response': response})
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)
    return JsonResponse({'error': 'Método no permitido'}, status=405)

@csrf_exempt
def run_sequence(request):
    global is_running, current_index
    if request.method == 'POST':
        try:
            is_running = True
            current_index = 0
            return JsonResponse({
                'status': 'success',
                'message': 'Secuencia iniciada'
            })
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)
    return JsonResponse({'error': 'Método no permitido'}, status=405)

@csrf_exempt
def stop_sequence(request):
    global is_running
    if request.method == 'POST':
        try:
            is_running = False
            return JsonResponse({
                'status': 'success',
                'message': 'Secuencia detenida'
            })
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)
    return JsonResponse({'error': 'Método no permitido'}, status=405)

@csrf_exempt
def clear_sequence(request):
    global sequence
    if request.method == 'POST':
        try:
            sequence = {'q1': [], 'q2': [], 'z': [], 'grip': []}
            return JsonResponse({
                'status': 'success',
                'message': 'Secuencia borrada'
            })
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)
    return JsonResponse({'error': 'Método no permitido'}, status=405)

@csrf_exempt
def get_next_position(request):
    global is_running, current_index, sequence
    if request.method == 'GET':
        try:
            if not is_running or current_index >= len(sequence['q1']):
                is_running = False
                return JsonResponse({
                    'status': 'stopped',
                    'message': 'Secuencia completada o detenida'
                })
            
            position = {
                'q1': sequence['q1'][current_index],
                'q2': sequence['q2'][current_index],
                'z': sequence['z'][current_index],
                'grip': sequence['grip'][current_index]
            }
            
            current_index += 1
            return JsonResponse({
                'status': 'success',
                'position': position,
                'index': current_index,
                'total': len(sequence['q1'])
            })
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)
    return JsonResponse({'error': 'Método no permitido'}, status=405)