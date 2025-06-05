from django.contrib import admin
from .models import RobotPosition, RobotSequence, SequencePosition

class SequencePositionInline(admin.TabularInline):
    model = SequencePosition
    extra = 1

@admin.register(RobotPosition)
class RobotPositionAdmin(admin.ModelAdmin):
    list_display = ('name', 'arm1_angle', 'arm2_angle', 'base_height', 'gripper_state', 'created_at')
    list_filter = ('created_at',)
    search_fields = ('name',)

@admin.register(RobotSequence)
class RobotSequenceAdmin(admin.ModelAdmin):
    list_display = ('name', 'created_at')
    inlines = (SequencePositionInline,)
    search_fields = ('name',)