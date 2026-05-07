<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ProjectSubStep extends Model
{
    use HasFactory;

    protected $fillable = [
        'project_step_id',
        'name',
        'description',
        'chef_chantier_id',
        'planned_date',
        'status',
    ];

    protected $casts = [
        'planned_date' => 'date',
    ];

    public function projectStep()
    {
        return $this->belongsTo(ProjectStep::class);
    }

    public function chefChantier()
    {
        return $this->belongsTo(User::class, 'chef_chantier_id');
    }

    public function workers()
    {
        return $this->belongsToMany(User::class, 'project_sub_step_worker', 'project_sub_step_id', 'worker_id')
            ->withPivot(['is_completed', 'completed_at'])
            ->withTimestamps();
    }

    public function task()
    {
        return $this->hasOne(Task::class, 'project_sub_step_id');
    }

    public function getProgressPercentage(): int
    {
        $totalWorkers = $this->workers()->count();
        if ($totalWorkers === 0) {
            return 0;
        }

        $completedWorkers = $this->workers()->wherePivot('is_completed', true)->count();

        return (int) round(($completedWorkers / $totalWorkers) * 100);
    }

    public function isFullyCompleted(): bool
    {
        return $this->getProgressPercentage() === 100;
    }
}
