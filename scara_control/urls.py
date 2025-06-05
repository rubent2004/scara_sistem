from django.urls import path
from . import views

urlpatterns = [
    # Página principal
    path('', views.index, name='index'),
    
    # Control básico del robot
    path('send-command/', views.send_command, name='send_command'),
    path('get-status/', views.get_status, name='get_status'),
    path('home/', views.home_position, name='home_position'),
    
    # Gestión de posiciones
    path('positions/', views.positions_list, name='positions_list'),
    path('save-position/', views.save_position, name='save_position'),
    
    # Gestión de secuencias  
    path('sequences/', views.sequences_list, name='sequences_list'),
    path('run-sequence/', views.run_sequence, name='run_sequence'),
    
    # Control con PS4
    path('control/', views.control_robot, name='control_robot'),
    path('ps4-status/', views.get_ps4_status, name='get_ps4_status'),
]