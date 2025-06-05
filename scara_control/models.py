from django.db import models

class RobotPosition(models.Model):
    name = models.CharField(max_length=100)
    arm1_angle = models.FloatField()
    arm2_angle = models.FloatField()
    base_height = models.FloatField()
    gripper_state = models.IntegerField()
    created_at = models.DateTimeField(auto_now_add=True)
    def __str__(self):
        return f"{self.name} - A1:{self.arm1_angle}° A2:{self.arm2_angle}° Z:{self.base_height}cm"

class RobotSequence(models.Model):
    name = models.CharField(max_length=100)
    positions = models.ManyToManyField(RobotPosition, through='SequencePosition')
    created_at = models.DateTimeField(auto_now_add=True)
    def __str__(self):
        return self.name

class SequencePosition(models.Model):
    sequence = models.ForeignKey(RobotSequence, on_delete=models.CASCADE)
    position = models.ForeignKey(RobotPosition, on_delete=models.CASCADE)
    order = models.IntegerField()
    delay_seconds = models.FloatField(default=1.0)
    class Meta:
        ordering = ['order']