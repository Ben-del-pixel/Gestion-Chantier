<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

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
