<?php

namespace App\Http\Controllers\Api;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Project;
use App\Models\User;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ProjectController extends Controller
{
    public function index(): Response
    {
        $projects = Project::with('engineer', 'manager', 'tasks.workers')->latest()->get();
        $engineers = User::where('role', UserRole::Engineer)->get();

        return Inertia::render('projects/index', [
            'projects' => $projects,
            'engineers' => $engineers,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'start_date' => 'nullable|date',
            'deadline' => 'required|date',
            'budget' => 'nullable|numeric|min:0',
            'status' => 'nullable|in:initialisation,planifie,en_cours,termine,suspendu',
            'engineer_id' => 'nullable|exists:users,id',
            'steps' => 'nullable|array',
            'steps.*.name' => 'nullable|string|max:255',
            'steps.*.budget' => 'nullable|numeric|min:0',
        ]);

        $project = Project::create([
            'name' => $validated['name'],
            'description' => $validated['description'] ?? null,
            'start_date' => $validated['start_date'] ?? null,
            'budget' => $validated['budget'] ?? 0,
            'deadline' => $validated['deadline'],
            'engineer_id' => $validated['engineer_id'] ?? null,
            'manager_id' => auth()->id(),
            'status' => $validated['status'] ?? 'initialisation',
        ]);

        // Create project steps if provided
        if (! empty($validated['steps'])) {
            foreach ($validated['steps'] as $index => $step) {
                $project->steps()->create([
                    'name' => $step['name'],
                    'budget' => $step['budget'] ?? 0,
                    'order' => $index + 1,
                ]);
            }

            // Sync total budget from steps
            $project->syncBudgetFromSteps();
        }

        ActivityLog::create([
            'user_id' => auth()->id(),
            'action' => 'create_project',
            'description' => "Création du projet : {$project->name}",
            'properties' => [
                'project_id' => $project->id,
            ],
        ]);

        return response()->json([
            'project' => $project->load('steps'),
            'message' => 'Projet créé avec succès',
        ], 201);
    }

    public function show(Project $project): Response
    {
        $project->load(['engineer', 'manager', 'steps', 'tasks.workers']);

        // Calculate total unique workers for the project
        $totalWorkers = $project->tasks
            ->flatMap(fn ($task) => $task->workers)
            ->unique('id')
            ->count();

        return Inertia::render('projects/show', [
            'project' => $project,
            'totalWorkers' => $totalWorkers,
        ]);
    }

    public function update(Request $request, Project $project)
    {
        $validated = $request->validate([
            'status' => 'required|in:initialisation,planifie,en_cours,termine',
        ]);

        $oldStatus = $project->status;
        $project->update($validated);

        ActivityLog::create([
            'user_id' => auth()->id(),
            'action' => 'update_project',
            'description' => "Mise à jour du projet : {$project->name} (Statut: {$oldStatus} → {$validated['status']})",
            'properties' => [
                'project_id' => $project->id,
                'old_status' => $oldStatus,
                'new_status' => $validated['status'],
            ],
        ]);

        return response()->json([
            'project' => $project,
            'message' => 'Projet mis à jour avec succès',
        ]);
    }

    public function destroy(Project $project)
    {
        $projectName = $project->name;

        ActivityLog::create([
            'user_id' => auth()->id(),
            'action' => 'delete_project',
            'description' => "Suppression du projet : {$projectName}",
            'properties' => [
                'project_id' => $project->id,
            ],
        ]);

        $project->delete();

        return response()->json([
            'message' => 'Projet supprimé avec succès',
        ]);
    }
}
