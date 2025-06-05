from rest_framework import serializers
from .models import RobotPosition, RobotSequence, SequencePosition

class RobotPositionSerializer(serializers.ModelSerializer):
    class Meta:
        model = RobotPosition
        fields = '__all__'

class SequencePositionSerializer(serializers.ModelSerializer):
    position = RobotPositionSerializer()
    class Meta:
        model = SequencePosition
        fields = ('order', 'delay_seconds', 'position')

class RobotSequenceSerializer(serializers.ModelSerializer):
    positions = SequencePositionSerializer(source='sequenceposition_set', many=True)
    class Meta:
        model = RobotSequence
        fields = ('id', 'name', 'positions')