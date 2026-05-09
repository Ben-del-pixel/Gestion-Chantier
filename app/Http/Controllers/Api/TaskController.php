<?php

namespace App\Http\Controllers\Api;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Project;
use App\Models\ProjectStep;
use App\Models\Task;
use Illuminate\Http\Request;

class TaskController extends Controller
{
    public function markExecuted(Task $task)
    {
        $user = auth()->user();

        if (! in_array($user->role, [UserRole::Worker, UserRole::ChefChantier], true)) {
            abort(403, 'Seuls les ouvriers et chefs de chantier assignés peuvent confirmer l\'exécution.');
        }

        if (! $task->workers()->where('users.id', $user->id)->exists()) {
            abort(403, 'Vous n\'êtes pas assigné à cette tâche.');
        }

        $task->workers()->updateExistingPivot($user->id, ['executed_at' => now()]);
        $task->refresh();
        $task->unsetRelation('workers');

        $this->syncTaskStatusFromWorkerExecutions($task);

        ActivityLog::create([
            'user_id' => $user->id,
            'action' => 'task_execution_confirmed',
            'description' => "Exécution confirmée pour la tâche : {$task->name}",
            'properties' => ['task_id' => $task->id, 'project_id' => $task->project_id],
        ]);

        return back()->with('success', 'Votre travail sur cette tâche est enregistré.');
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'project_id' => 'required|exists:projects,id',
            'project_step_id' => 'required|exists:project_steps,id',
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'start_date' => 'required|date',
            'end_date' => 'required|date|after_or_equal:start_date',
            'status' => 'required|in:planifie,en_cours,termine,retard',
            'worker_ids' => 'nullable|array',
            'worker_ids.*' => 'exists:users,id',
        ]);

        $project = Project::findOrFail($validated['project_id']);
        $user = auth()->user();

        // Permission check
        if ($user->role !== UserRole::Manager &&
            ! ($user->role === UserRole::Engineer && $project->engineer_id === $user->id) &&
            ! ($user->role === UserRole::ChefChantier && $project->chef_chantier_id === $user->id)
        ) {
            abort(403, "Vous n'avez pas la permission de créer des tâches pour ce projet.");
        }

        $step = ProjectStep::findOrFail($validated['project_step_id']);
        if ($step->project_id !== $project->id) {
            abort(422, 'L\'étape sélectionnée n\'appartient pas à ce projet.');
        }

        $this->assertWorkersAssignableToProject($project, $validated['worker_ids'] ?? []);

        $task = Task::create([
            'project_id' => $validated['project_id'],
            'project_step_id' => $validated['project_step_id'],
            'project_sub_step_id' => null,
            'name' => $validated['name'],
            'description' => $validated['description'],
            'start_date' => $validated['start_date'],
            'end_date' => $validated['end_date'],
            'status' => $validated['status'],
        ]);

        if (! empty($validated['worker_ids'])) {
            $task->workers()->sync($validated['worker_ids']);
        }
        $this->syncTaskStatusFromWorkerExecutions($task->fresh());

        ActivityLog::create([
            'user_id' => auth()->id(),
            'action' => 'create_task',
            'description' => "Création de la tâche : {$task->name}",
            'properties' => ['task_id' => $task->id, 'project_id' => $task->project_id],
        ]);

        return back()->with('success', 'Tâche créée avec succès');
    }

    public function update(Request $request, Task $task)
    {
        $previousStepId = $task->project_step_id;

        $validated = $request->validate([
            'project_step_id' => 'required|exists:project_steps,id',
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'start_date' => 'required|date',
            'end_date' => 'required|date|after_or_equal:start_date',
            'status' => 'required|in:planifie,en_cours,termine,retard',
            'worker_ids' => 'nullable|array',
            'worker_ids.*' => 'exists:users,id',
        ]);

        $project = $task->project;
        $user = auth()->user();

        // Permission check
        if ($user->role !== UserRole::Manager &&
            ! ($user->role === UserRole::Engineer && $project->engineer_id === $user->id) &&
            ! ($user->role === UserRole::ChefChantier && $project->chef_chantier_id === $user->id)
        ) {
            abort(403, "Vous n'avez pas la permission de modifier des tâches pour ce projet.");
        }

        $step = ProjectStep::findOrFail($validated['project_step_id']);
        if ($step->project_id !== $project->id) {
            abort(422, 'L\'étape sélectionnée n\'appartient pas à ce projet.');
        }

        if (isset($validated['worker_ids'])) {
            $this->assertWorkersAssignableToProject($project, $validated['worker_ids']);
        }

        $task->update([
            'project_step_id' => $validated['project_step_id'],
            'project_sub_step_id' => null,
            'name' => $validated['name'],
            'description' => $validated['description'],
            'start_date' => $validated['start_date'],
            'end_date' => $validated['end_date'],
            'status' => $validated['status'],
        ]);

        if (isset($validated['worker_ids'])) {
            $task->workers()->sync($validated['worker_ids']);
        }
        $this->syncTaskStatusFromWorkerExecutions($task->fresh());
        if ($previousStepId && $previousStepId !== $step->id) {
            $this->syncStepCompletionFromTasks(ProjectStep::find($previousStepId));
        }

        ActivityLog::create([
            'user_id' => auth()->id(),
            'action' => 'update_task',
            'description' => "Mise à jour de la tâche : {$task->name}",
            'properties' => ['task_id' => $task->id],
        ]);

        return back()->with('success', 'Tâche mise à jour avec succès');
    }

    public function destroy(Task $task)
    {
        $step = $task->projectStep;
        $project = $task->project;
        $user = auth()->user();

        // Permission check
        if ($user->role !== UserRole::Manager &&
            ! ($user->role === UserRole::Engineer && $project->engineer_id === $user->id) &&
            ! ($user->role === UserRole::ChefChantier && $project->chef_chantier_id === $user->id)
        ) {
            abort(403, "Vous n'avez pas la permission de supprimer des tâches pour ce projet.");
        }

        $taskName = $task->name;
        $projectId = $task->project_id;

        $task->delete();
        $this->syncStepCompletionFromTasks($step);

        ActivityLog::create([
            'user_id' => auth()->id(),
            'action' => 'delete_task',
            'description' => "Suppression de la tâche : {$taskName}",
            'properties' => ['project_id' => $projectId],
        ]);

        return back()->with('success', 'Tâche supprimée avec succès');
    }

    /**
     * @param  array<int, mixed>  $workerIds
     */
    private function assertWorkersAssignableToProject(Project $project, array $workerIds): void
    {
        if ($workerIds === []) {
            return;
        }

        $allowed = $project->assignableTaskUserIds();

        foreach ($workerIds as $workerId) {
            if (! in_array((int) $workerId, $allowed, true)) {
                abort(422, 'Un ou plusieurs membres ne sont pas affectés à ce chantier (ouvriers ou chef de chantier du projet).');
            }
        }
    }

    private function syncTaskStatusFromWorkerExecutions(Task $task): void
    {
        $stepId = $task->project_step_id;

        // Compter depuis la base (pivot) pour éviter tout cache / pivot non rechargé après updateExistingPivot.
        $total = $task->workers()->count();

        if ($total === 0) {
            $this->syncStepCompletionFromTasks(ProjectStep::query()->find($stepId));

            return;
        }

        $executed = $task->workers()->wherePivotNotNull('executed_at')->count();

        if ($executed === $total) {
            $task->update(['status' => 'termine']);
        } elseif ($executed > 0 && $task->fresh()->status !== 'termine') {
            $task->update(['status' => 'en_cours']);
        }

        $this->syncStepCompletionFromTasks(ProjectStep::query()->find($stepId));
    }

    private function syncStepCompletionFromTasks(?ProjectStep $step): void
    {
        if (! $step) {
            return;
        }

        $tasksQuery = Task::where('project_step_id', $step->id);
        $totalTasks = (clone $tasksQuery)->count();
        $completedTasks = (clone $tasksQuery)->where('status', 'termine')->count();

        if ($totalTasks > 0 && $completedTasks === $totalTasks) {
            if (! $step->is_completed) {
                $step->complete();
                $this->notifyStepStakeholders($step);
            }

            return;
        }

        if ($step->is_completed) {
            $step->uncomplete();
        }
    }

    private function notifyStepStakeholders(ProjectStep $step): void
    {
        $project = $step->project;
        if (! $project) {
            return;
        }

        $recipientIds = array_unique(array_filter([
            $project->chef_chantier_id,
            $project->engineer_id,
            $project->manager_id,
        ]));

        foreach ($recipientIds as $userId) {
            ActivityLog::create([
                'user_id' => auth()->id(),
                'action' => 'step_completed',
                'description' => "Étape terminée (toutes les tâches complétées) : {$step->name} — projet {$project->name}",
                'properties' => [
                    'project_id' => $project->id,
                    'step_id' => $step->id,
                    'recipient_id' => $userId,
                ],
            ]);
        }
    }
}
