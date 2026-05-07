<?php

namespace App\Http\Controllers\Api;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Project;
use App\Models\ProjectStep;
use App\Models\ProjectSubStep;
use App\Models\Task;
use Illuminate\Http\Request;

class TaskController extends Controller
{
    public function store(Request $request)
    {
        $validated = $request->validate([
            'project_id' => 'required|exists:projects,id',
            'project_step_id' => 'nullable|exists:project_steps,id',
            'project_sub_step_id' => 'nullable|exists:project_sub_steps,id',
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

        if (! empty($validated['project_step_id'])) {
            $step = ProjectStep::findOrFail($validated['project_step_id']);
            if ($step->project_id !== $project->id) {
                abort(422, 'L\'étape sélectionnée n\'appartient pas à ce projet.');
            }
        }

        if (! empty($validated['project_sub_step_id'])) {
            $subStep = ProjectSubStep::findOrFail($validated['project_sub_step_id']);
            if ($subStep->projectStep->project_id !== $project->id) {
                abort(422, 'La sous-étape sélectionnée n\'appartient pas à ce projet.');
            }
            if (! empty($validated['project_step_id']) && $subStep->project_step_id !== (int) $validated['project_step_id']) {
                abort(422, 'La sous-étape ne correspond pas à l\'étape sélectionnée.');
            }
        }

        $task = Task::create([
            'project_id' => $validated['project_id'],
            'project_step_id' => $validated['project_step_id'] ?? null,
            'project_sub_step_id' => $validated['project_sub_step_id'] ?? null,
            'name' => $validated['name'],
            'description' => $validated['description'],
            'start_date' => $validated['start_date'],
            'end_date' => $validated['end_date'],
            'status' => $validated['status'],
        ]);

        if (! empty($validated['worker_ids'])) {
            $task->workers()->sync($validated['worker_ids']);
        }

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
        $validated = $request->validate([
            'project_step_id' => 'nullable|exists:project_steps,id',
            'project_sub_step_id' => 'nullable|exists:project_sub_steps,id',
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

        if (! empty($validated['project_step_id'])) {
            $step = ProjectStep::findOrFail($validated['project_step_id']);
            if ($step->project_id !== $project->id) {
                abort(422, 'L\'étape sélectionnée n\'appartient pas à ce projet.');
            }
        }

        if (! empty($validated['project_sub_step_id'])) {
            $subStep = ProjectSubStep::findOrFail($validated['project_sub_step_id']);
            if ($subStep->projectStep->project_id !== $project->id) {
                abort(422, 'La sous-étape sélectionnée n\'appartient pas à ce projet.');
            }
            if (! empty($validated['project_step_id']) && $subStep->project_step_id !== (int) $validated['project_step_id']) {
                abort(422, 'La sous-étape ne correspond pas à l\'étape sélectionnée.');
            }
        }

        $task->update([
            'project_step_id' => $validated['project_step_id'] ?? null,
            'project_sub_step_id' => $validated['project_sub_step_id'] ?? null,
            'name' => $validated['name'],
            'description' => $validated['description'],
            'start_date' => $validated['start_date'],
            'end_date' => $validated['end_date'],
            'status' => $validated['status'],
        ]);

        if (isset($validated['worker_ids'])) {
            $task->workers()->sync($validated['worker_ids']);
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

        ActivityLog::create([
            'user_id' => auth()->id(),
            'action' => 'delete_task',
            'description' => "Suppression de la tâche : {$taskName}",
            'properties' => ['project_id' => $projectId],
        ]);

        return back()->with('success', 'Tâche supprimée avec succès');
    }
}
