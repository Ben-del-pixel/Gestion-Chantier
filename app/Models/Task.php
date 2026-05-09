<?php

namespace App\Models;

use Database\Factories\TaskFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Task extends Model
{
    /** @use HasFactory<TaskFactory> */
    use HasFactory;

    protected $fillable = [
        'project_id',
        'project_step_id',
        'project_sub_step_id',
        'name',
        'description',
        'start_date',
        'end_date',
        'status',
    ];

    protected $casts = [
        'start_date' => 'datetime',
        'end_date' => 'datetime',
    ];

    public function project()
    {
        return $this->belongsTo(Project::class);
    }

    public function projectStep()
    {
        return $this->belongsTo(ProjectStep::class);
    }

    public function projectSubStep()
    {
        return $this->belongsTo(ProjectSubStep::class);
    }

    public function workers()
    {
        return $this->belongsToMany(User::class)
            ->withPivot(['executed_at'])
            ->withTimestamps();
    }
}
