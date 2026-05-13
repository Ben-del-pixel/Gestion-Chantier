<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ProjectStep extends Model
{
    protected $fillable = ['name', 'budget', 'order', 'is_completed', 'completed_at'];

    protected $casts = [
        'budget' => 'decimal:2',
        'is_completed' => 'boolean',
        'completed_at' => 'datetime',
    ];

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function subSteps(): HasMany
    {
        return $this->hasMany(ProjectSubStep::class, 'project_step_id');
    }

    public function tasks(): HasMany
    {
        return $this->hasMany(Task::class, 'project_step_id');
    }

    /**
     * Check if all sub-steps assigned to workers are completed
     */
    public function areAllSubStepsCompleted(): bool
    {
        $totalSubSteps = $this->subSteps()->count();

        if ($totalSubSteps === 0) {
            return true; // No sub-steps means step can be completed
        }

        $completedSubSteps = $this->subSteps()
            ->whereHas('workers', function ($q) {
                $q->where('project_sub_step_worker.is_completed', true);
            })
            ->count();

        // All sub-steps must have at least one worker who completed them
        return $completedSubSteps === $totalSubSteps;
    }

    /**
     * Mark step as completed and update project progress and budget
     */
    public function complete(): void
    {
        if ($this->is_completed) {
            return;
        }

        $this->update([
            'is_completed' => true,
            'completed_at' => now(),
        ]);

        // Update project progress based on completed steps
        $project = $this->project;
        $totalSteps = $project->steps()->count();
        $completedSteps = $project->steps()->where('is_completed', true)->count();

        if ($totalSteps > 0) {
            $progress = (int) round(($completedSteps / $totalSteps) * 100);
            $project->update(['progress' => $progress]);
        }

        // Add step budget to consumed budget
        $project->increment('budget_consumed', $this->budget);
    }

    /**
     * Mark step as not completed and recalculate project progress and budget
     */
    public function uncomplete(): void
    {
        if (! $this->is_completed) {
            return;
        }

        $this->update([
            'is_completed' => false,
            'completed_at' => null,
        ]);

        // Recalculate project progress
        $project = $this->project;
        $totalSteps = $project->steps()->count();
        $completedSteps = $project->steps()->where('is_completed', true)->count();

        if ($totalSteps > 0) {
            $progress = (int) round(($completedSteps / $totalSteps) * 100);
            $project->update(['progress' => $progress]);
        } else {
            $project->update(['progress' => 0]);
        }

        // Subtract step budget from consumed budget
        $project->decrement('budget_consumed', $this->budget);
    }
}
