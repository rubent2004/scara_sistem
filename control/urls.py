#urls.py que si funciona
from django.urls import path
from . import views

urlpatterns = [
    path('', views.control_panel, name='control_panel'),
    path('send-command/', views.send_command, name='send_command'),
    path('save-position/', views.save_position, name='save_position'),
    path('home/', views.home_position, name='home_position'),
    path('run-sequence/', views.run_sequence, name='run_sequence'),
    path('stop-sequence/', views.stop_sequence, name='stop_sequence'),
    path('clear-sequence/', views.clear_sequence, name='clear_sequence'),
    path('next-position/', views.get_next_position, name='get_next_position'),
]