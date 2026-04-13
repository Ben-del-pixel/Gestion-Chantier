<?php

namespace App\Models;

use Database\Factories\ProjectFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Project extends Model
{
    /** @use HasFactory<ProjectFactory> */
    use HasFactory;

    protected $fillable = [
        'name',
        'description',
        'budget',
        'deadline',
        'status',
        'manager_id',
        'engineer_id',
    ];

    protected $casts = [
        'deadline' => 'date',
        'budget' => 'decimal:2',
    ];

    public function manager()
    {
        return $this->belongsTo(User::class, 'manager_id');
    }

    public function engineer()
    {
        return $this->belongsTo(User::class, 'engineer_id');
    }

    public function tasks()
    {
        return $this->hasMany(Task::class);
    }

    public function attendances()
    {
        return $this->hasMany(Attendance::class);
    }

    public function steps()
    {
        return $this->hasMany(ProjectStep::class)->orderBy('order');
    }

    public function getTotalBudgetFromSteps(): float|int
    {
        return $this->steps->sum('budget') ?? 0;
    }

    public function syncBudgetFromSteps(): void
    {
        $total = $this->getTotalBudgetFromSteps();
        $this->update(['budget' => $total]);
    }
}
