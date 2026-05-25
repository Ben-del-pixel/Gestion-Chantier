<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Project extends Model
{
    /** @use HasFactory<ProjectFactory> */
    use HasFactory;

    protected $fillable = [
        'name',
        'description',
        'start_date',
        'budget',
        'deadline',
        'status',
        'progress',
        'budget_consumed',
        'manager_id',
        'engineer_id',
        'chef_chantier_id',
        'storekeeper_id',
    ];

    protected $casts = [
        'start_date' => 'date',
        'deadline' => 'date',
        'budget' => 'decimal:2',
        'progress' => 'integer',
        'budget_consumed' => 'decimal:2',
    ];

    public function manager()
    {
        return $this->belongsTo(User::class, 'manager_id');
    }

    public function engineer()
    {
        return $this->belongsTo(User::class, 'engineer_id');
    }

    public function chefChantier()
    {
        return $this->belongsTo(User::class, 'chef_chantier_id');
    }

    public function storekeeper()
    {
        return $this->belongsTo(User::class, 'storekeeper_id');
    }

    public function tasks()
    {
        return $this->hasMany(Task::class);
    }

    public function attendances()
    {
        return $this->hasMany(Attendance::class);
    }

    public function workers()
    {
        return $this->belongsToMany(User::class, 'project_user');
    }

    public function steps()
    {
        return $this->hasMany(ProjectStep::class)->orderBy('order');
    }

    public function materials()
    {
        return $this->hasMany(Material::class);
    }

    public function projectWorkers()
    {
        return $this->hasMany(ProjectWorker::class);
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

    /**
     * @return array<int, int>
     */
    public function assignableTaskUserIds(): array
    {
        $ids = $this->workers()->pluck('users.id')->map(fn ($id) => (int) $id)->all();

        if ($this->chef_chantier_id) {
            $ids[] = (int) $this->chef_chantier_id;
        }

        return array_values(array_unique($ids));
    }
}
