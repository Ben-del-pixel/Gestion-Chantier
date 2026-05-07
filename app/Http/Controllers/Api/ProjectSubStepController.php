<?php

namespace App\Http\Controllers\Api;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Project;
use App\Models\ProjectStep;
use App\Models\ProjectSubStep;
use App\Models\Task;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProjectSubStepController extends Controller
{
    /**
     * Create a new sub-step (Chef de Chantier only)
     */
    public function store(Request $request): JsonResponse
    {
        $user = auth()->user();

        if ($user->role !== UserRole::ChefChantier) {
            return response()->json(['error' => 'Accès réservé aux chefs de chantier.'], 403);
        }

        $validated = $request->validate([
            'project_step_id' => 'required|exists:project_steps,id',
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'planned_date' => 'required|date',
            'worker_ids' => 'required|array|min:1|max:3',
            'worker_ids.*' => 'exists:users,id',
        ]);

        // Verify the step belongs to a project assigned to this chef de chantier
        $step = ProjectStep::find($validated['project_step_id']);
        if (! $step || $step->project->chef_chantier_id !== $user->id) {
            return response()->json(['error' => 'Vous n\'avez pas accès à cette étape.'], 403);
        }

        // Verify all workers belong to this chef de chantier
        $workers = User::whereIn('id', $validated['worker_ids'])
            ->where('chef_chantier_id', $user->id)
            ->get();

        if ($workers->count() !== count($validated['worker_ids'])) {
            return response()->json(['error' => 'Certains ouvriers ne font pas partie de votre équipe.'], 403);
        }

        $subStep = ProjectSubStep::create([
            'project_step_id' => $validated['project_step_id'],
            'name' => $validated['name'],
            'description' => $validated['description'],
            'chef_chantier_id' => $user->id,
            'planned_date' => $validated['planned_date'],
            'status' => 'pending',
        ]);

        // Attach workers with pivot data
        foreach ($validated['worker_ids'] as $workerId) {
            $subStep->workers()->attach($workerId, [
                'is_completed' => false,
                'completed_at' => null,
            ]);
        }

        $task = Task::create([
            'project_id' => $step->project_id,
            'project_step_id' => $step->id,
            'project_sub_step_id' => $subStep->id,
            'name' => $subStep->name,
            'description' => $subStep->description,
            'start_date' => $subStep->planned_date->copy()->startOfDay(),
            'end_date' => $subStep->planned_date->copy()->endOfDay(),
            'status' => 'planifie',
        ]);
        $task->workers()->sync($validated['worker_ids']);

        return response()->json([
            'message' => 'Sous-étape créée avec succès',
            'subStep' => $subStep->load('workers'),
        ], 201);
    }

    /**
     * List sub-steps for a project step (for Chef de Chantier)
     */
    public function index(Request $request): JsonResponse
    {
        $user = auth()->user();
        $stepId = $request->query('project_step_id');

        if (! $stepId) {
            return response()->json(['error' => 'project_step_id requis.'], 400);
        }

        $step = ProjectStep::find($stepId);
        if (! $step) {
            return response()->json(['error' => 'Étape non trouvée.'], 404);
        }

        // Authorization check
        if ($user->role === UserRole::ChefChantier && $step->project->chef_chantier_id !== $user->id) {
            return response()->json(['error' => 'Accès non autorisé.'], 403);
        }

        if ($user->role === UserRole::Worker) {
            // Worker can only see sub-steps assigned to him
            $subSteps = $step->subSteps()
                ->whereHas('workers', function ($q) use ($user) {
                    $q->where('users.id', $user->id);
                })
                ->with(['workers' => function ($q) use ($user) {
                    $q->where('users.id', $user->id);
                }])
                ->get();
        } else {
            $subSteps = $step->subSteps()->with('workers')->get();
        }

        return response()->json(['subSteps' => $subSteps]);
    }

    /**
     * Mark a sub-step as completed by a worker
     */
    public function markCompleted(ProjectSubStep $subStep): JsonResponse
    {
        $user = auth()->user();

        // Only the assigned worker can mark their sub-step as completed
        if (! $subStep->workers()->where('users.id', $user->id)->exists()) {
            return response()->json([
                'error' => 'Vous n\'êtes pas assigné à cette sous-étape.',
            ], 403);
        }

        // Update the pivot table to mark as completed
        $subStep->workers()->updateExistingPivot($user->id, [
            'is_completed' => true,
            'completed_at' => now(),
        ]);

        if ($subStep->isFullyCompleted()) {
            $subStep->update(['status' => 'completed']);
        }
        $this->syncLinkedTaskStatus($subStep);

        // Check if all sub-steps of the parent step are completed
        $this->checkAndCompleteParentStep($subStep->projectStep);

        return response()->json([
            'message' => 'Sous-étape marquée comme exécutée',
            'completed' => true,
        ]);
    }

    /**
     * Mark a sub-step as not completed by a worker
     */
    public function markIncomplete(ProjectSubStep $subStep): JsonResponse
    {
        $user = auth()->user();

        // Only the assigned worker can mark their sub-step as incomplete
        if (! $subStep->workers()->where('users.id', $user->id)->exists()) {
            return response()->json([
                'error' => 'Vous n\'êtes pas assigné à cette sous-étape.',
            ], 403);
        }

        // Update the pivot table to mark as not completed
        $subStep->workers()->updateExistingPivot($user->id, [
            'is_completed' => false,
            'completed_at' => null,
        ]);

        $subStep->update(['status' => 'pending']);
        $subStep->projectStep->uncomplete();
        $this->syncLinkedTaskStatus($subStep);

        return response()->json([
            'message' => 'Sous-étape marquée comme non exécutée',
            'completed' => false,
        ]);
    }

    /**
     * Check and automatically complete parent step if all sub-steps are completed
     */
    private function checkAndCompleteParentStep(ProjectStep $step): void
    {
        // Get all sub-steps for this project step
        $totalSubSteps = $step->subSteps()->count();

        if ($totalSubSteps === 0) {
            return;
        }

        // Count sub-steps where ALL assigned workers have marked them as completed
        $completedSubSteps = 0;
        foreach ($step->subSteps()->get() as $subStep) {
            $totalWorkers = $subStep->workers()->count();
            $completedWorkers = $subStep->workers()->wherePivot('is_completed', true)->count();

            if ($totalWorkers > 0 && $completedWorkers === $totalWorkers) {
                $completedSubSteps++;
            }
        }

        // If all sub-steps are completed, mark the parent step as completed
        if ($completedSubSteps === $totalSubSteps && ! $step->is_completed) {
            $step->complete();

            // Send notifications to Chef de Chantier, Engineer, and Manager
            $project = $step->project;
            if ($project) {
                $this->sendStepCompletionNotifications($project, $step);
            }
        }
    }

    /**
     * Send notifications for step completion
     */
    private function sendStepCompletionNotifications(Project $project, ProjectStep $step): void
    {
        $recipients = [];

        // Add Chef de Chantier
        if ($project->chef_chantier_id) {
            $recipients[] = $project->chef_chantier_id;
        }

        // Add Engineer
        if ($project->engineer_id) {
            $recipients[] = $project->engineer_id;
        }

        // Add Manager
        if ($project->manager_id) {
            $recipients[] = $project->manager_id;
        }

        // Remove duplicates and send activity log instead of notifications (no notification system yet)
        $recipients = array_unique($recipients);

        foreach ($recipients as $userId) {
            // Log the completion for audit trail
            ActivityLog::create([
                'user_id' => auth()->id(),
                'action' => 'step_completed',
                'description' => "Étape complétée : {$step->name} du projet {$project->name}",
                'properties' => [
                    'project_id' => $project->id,
                    'step_id' => $step->id,
                    'recipient_id' => $userId,
                ],
            ]);
        }
    }

    private function syncLinkedTaskStatus(ProjectSubStep $subStep): void
    {
        $task = $subStep->task;

        if (! $task) {
            return;
        }

        $completedWorkers = $subStep->workers()->wherePivot('is_completed', true)->count();
        if ($subStep->isFullyCompleted()) {
            $task->update(['status' => 'termine']);

            return;
        }

        if ($completedWorkers > 0) {
            $task->update(['status' => 'en_cours']);

            return;
        }

        $task->update(['status' => 'planifie']);
    }
}
