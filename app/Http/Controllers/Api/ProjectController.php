<?php

namespace App\Http\Controllers\Api;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Material;
use App\Models\Project;
use App\Models\ProjectStep;
use App\Models\User;
use App\Support\ProjectDeadlineAlerts;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ProjectController extends Controller
{
    public function index(): Response
    {
        $user = auth()->user();

        // Filter projects based on user role
        if ($user->role === UserRole::ChefChantier) {
            // Chef de Chantier sees only projects assigned to him
            $projects = Project::with('engineer', 'manager', 'chefChantier', 'workers', 'steps')
                ->where('chef_chantier_id', $user->id)
                ->latest()
                ->get();
            // Show his engineer in the filter (if any project has one)
            $engineers = User::where('role', UserRole::Engineer)
                ->where('id', $user->engineer_id)
                ->get();
        } elseif ($user->role === UserRole::Engineer) {
            // Engineer sees his own projects and projects of his chefs de chantier
            $chefChantierIds = User::where('engineer_id', $user->id)->pluck('id');
            $projects = Project::with('engineer', 'manager', 'chefChantier', 'workers', 'steps')
                ->where(function ($query) use ($user, $chefChantierIds) {
                    $query->where('engineer_id', $user->id)
                        ->orWhereIn('chef_chantier_id', $chefChantierIds);
                })
                ->latest()
                ->get();
            // Engineers don't see other engineers in filter
            $engineers = collect();
        } else {
            // Manager sees all projects
            $projects = Project::with('engineer', 'manager', 'chefChantier', 'workers', 'steps')->latest()->get();
            $engineers = User::where('role', UserRole::Engineer)->get();
        }

        $storekeepers = $user->role === UserRole::Manager
            ? User::where('role', UserRole::Magasinier)->orderBy('name')->get(['id', 'name'])
            : collect();

        return Inertia::render('projects/index', [
            'projects' => $projects,
            'engineers' => $engineers,
            'storekeepers' => $storekeepers,
            'projectDeadlineAlerts' => ProjectDeadlineAlerts::fromProjects($projects),
            'canViewBudget' => $user->role !== UserRole::Engineer,
        ]);
    }

    public function store(Request $request)
    {
        $user = auth()->user();

        if ($user->role !== UserRole::Manager) {
            abort(403, 'Seul le manager peut créer un projet.');
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'start_date' => ['required', 'date', 'after_or_equal:today'],
            'deadline' => ['required', 'date', 'after_or_equal:start_date'],
            'progress' => 'nullable|integer|min:0|max:100',
            'status' => 'nullable|in:initialisation,planifie,en_cours,termine,suspendu',
            'engineer_id' => 'nullable|exists:users,id',
            'storekeeper_id' => 'nullable|exists:users,id',
            'steps' => 'required|array|min:1',
            'steps.*.name' => 'required|string|max:255',
            'steps.*.budget' => 'required|numeric|min:0',
            'materials' => 'nullable|array',
            'materials.*.name' => 'required|string|max:255',
            'materials.*.description' => 'nullable|string|max:255',
            'materials.*.quantity_in_stock' => 'required|numeric|min:0',
            'materials.*.unit' => 'required|string|max:255',
            'materials.*.type' => 'required|in:materiel,materiaux',
            'materials.*.category' => 'nullable|string|max:255',
            'materials.*.step_index' => 'required|integer|min:0',
        ]);

        if (! empty($validated['materials']) && empty($validated['storekeeper_id'])) {
            return back()->withErrors([
                'storekeeper_id' => 'Assignez un magasinier pour enregistrer des matériaux sur ce chantier.',
            ]);
        }

        if (! empty($validated['storekeeper_id'])) {
            $storekeeper = User::find($validated['storekeeper_id']);
            if (! $storekeeper || $storekeeper->role !== UserRole::Magasinier) {
                return back()->withErrors([
                    'storekeeper_id' => 'Le magasinier sélectionné est invalide.',
                ]);
            }
        }

        $project = Project::create([
            'name' => $validated['name'],
            'description' => $validated['description'] ?? null,
            'start_date' => $validated['start_date'] ?? null,
            'budget' => 0,
            'deadline' => $validated['deadline'],
            'progress' => $validated['progress'] ?? 0,
            'engineer_id' => $validated['engineer_id'] ?? null,
            'storekeeper_id' => $validated['storekeeper_id'] ?? null,
            'manager_id' => $user->id,
            'status' => $validated['status'] ?? 'initialisation',
        ]);

        $stepsByIndex = [];

        if (! empty($validated['steps'])) {
            foreach ($validated['steps'] as $index => $step) {
                $stepsByIndex[$index] = $project->steps()->create([
                    'name' => $step['name'],
                    'budget' => $step['budget'] ?? 0,
                    'order' => $index + 1,
                ]);
            }

            $project->syncBudgetFromSteps();
        }

        if (! empty($validated['materials'])) {
            $stepCount = count($validated['steps'] ?? []);

            foreach ($validated['materials'] as $materialData) {
                $stepIndex = (int) $materialData['step_index'];

                if ($stepIndex < 0 || $stepIndex >= $stepCount || ! isset($stepsByIndex[$stepIndex])) {
                    return back()->withErrors([
                        'materials' => 'Chaque matériau doit être rattaché à une étape du chantier.',
                    ]);
                }

                Material::create([
                    'name' => $materialData['name'],
                    'description' => $materialData['description'] ?? null,
                    'quantity_in_stock' => $materialData['quantity_in_stock'],
                    'unit' => $materialData['unit'],
                    'type' => $materialData['type'],
                    'category' => $materialData['category'] ?? null,
                    'project_id' => $project->id,
                    'project_step_id' => $stepsByIndex[$stepIndex]->id,
                    'storekeeper_id' => $project->storekeeper_id,
                ]);
            }
        }

        // Note: L'équipe sera assignée par le Chef de Chantier plus tard
        // Le Manager assigne l'Ingénieur et le magasinier au projet

        ActivityLog::create([
            'user_id' => auth()->id(),
            'action' => 'create_project',
            'description' => "Création du projet : {$project->name}",
            'properties' => [
                'project_id' => $project->id,
            ],
        ]);

        return redirect()->route('projects.show', $project)->with('success', 'Projet créé avec succès');
    }

    public function show(Project $project): Response
    {
        $project->load([
            'engineer',
            'manager',
            'chefChantier',
            'storekeeper',
            'steps.subSteps',
            'tasks.workers' => fn ($query) => $query->withPivot(['executed_at']),
            'workers',
        ]);

        $viewer = auth()->user();

        $engineers = User::where('role', UserRole::Engineer)->orderBy('name')->get();

        $chefsChantierQuery = User::where('role', UserRole::ChefChantier)->orderBy('name');
        if ($viewer->role === UserRole::Engineer) {
            $chefsChantierQuery->where('engineer_id', $viewer->id);
        }
        $chefsChantier = $chefsChantierQuery->get();
        $storekeepers = User::where('role', UserRole::Magasinier)->orderBy('name')->get();
        $allWorkers = User::whereIn('role', [UserRole::Worker, UserRole::Magasinier, UserRole::ChefChantier])->get();

        // Calculate total unique workers for the project (from workers relation or tasks)
        $totalWorkersCount = $project->workers->count();

        return Inertia::render('projects/show', [
            'project' => $project,
            'totalWorkersCount' => $totalWorkersCount,
            'engineers' => $engineers,
            'chefsChantier' => $chefsChantier,
            'storekeepers' => $storekeepers,
            'allWorkers' => $allWorkers,
            'canViewBudget' => $viewer->role !== UserRole::Engineer,
        ]);
    }

    public function update(Request $request, Project $project)
    {
        // Permission check: Only Manager or Engineer assigned to project can update
        $user = auth()->user();
        if ($user->role === UserRole::Manager) {
            // Manager can update any project
        } elseif ($user->role === UserRole::Engineer && $project->engineer_id === $user->id) {
            // Engineer can only update their own projects
        } else {
            abort(403, 'Vous n\'avez pas la permission de modifier ce projet.');
        }

        $validated = $request->validate([
            'name' => 'nullable|string|max:255',
            'description' => 'nullable|string',
            'start_date' => 'nullable|date',
            'deadline' => 'nullable|date',
            'progress' => 'nullable|integer|min:0|max:100',
            'budget_consumed' => 'nullable|numeric|min:0',
            'status' => 'nullable|in:initialisation,planifie,en_cours,termine,suspendu',
            'engineer_id' => 'nullable|exists:users,id',
            'chef_chantier_id' => 'nullable|exists:users,id',
            'storekeeper_id' => 'nullable|exists:users,id',
            'steps' => 'nullable|array',
            'steps.*.id' => 'nullable|exists:project_steps,id',
            'steps.*.name' => 'required|string|max:255',
            'steps.*.budget' => 'nullable|numeric|min:0',
        ]);

        // Capture original IDs before update
        $originalEngineerId = $project->engineer_id;
        $originalChefChanttierId = $project->chef_chantier_id;

        $projectData = $request->only([
            'name', 'description', 'start_date', 'deadline', 'status', 'progress', 'budget_consumed', 'engineer_id', 'chef_chantier_id', 'storekeeper_id',
        ]);

        // Convert empty strings to null for IDs
        if (isset($projectData['engineer_id']) && $projectData['engineer_id'] === '') {
            $projectData['engineer_id'] = null;
        }
        if (isset($projectData['chef_chantier_id']) && $projectData['chef_chantier_id'] === '') {
            $projectData['chef_chantier_id'] = null;
        }
        if (isset($projectData['storekeeper_id']) && $projectData['storekeeper_id'] === '') {
            $projectData['storekeeper_id'] = null;
        }

        foreach (['start_date', 'deadline'] as $dateField) {
            if (array_key_exists($dateField, $projectData) && $projectData[$dateField] === '') {
                $projectData[$dateField] = null;
            }
        }

        $mergedStart = array_key_exists('start_date', $projectData) && $projectData['start_date'] !== null
            ? Carbon::parse($projectData['start_date'])->startOfDay()
            : $project->start_date?->copy()->startOfDay();
        $mergedDeadline = array_key_exists('deadline', $projectData) && $projectData['deadline'] !== null
            ? Carbon::parse($projectData['deadline'])->startOfDay()
            : $project->deadline?->copy()->startOfDay();

        if ($mergedStart && $mergedDeadline && $mergedDeadline->lt($mergedStart)) {
            return back()->withErrors([
                'deadline' => 'La date limite doit être postérieure ou égale à la date de démarrage.',
            ]);
        }

        if ($user->role === UserRole::Engineer) {
            unset($projectData['engineer_id'], $projectData['storekeeper_id'], $projectData['budget_consumed']);
            if (! empty($projectData['chef_chantier_id'])) {
                $chef = User::find($projectData['chef_chantier_id']);
                if (! $chef || $chef->role !== UserRole::ChefChantier || (int) $chef->engineer_id !== (int) $user->id) {
                    return back()->with('error', 'Vous ne pouvez assigner qu’un chef de chantier rattaché à votre équipe.');
                }
            }
        }

        // Restriction: Only one magasinier per project (Storekeeper or in Workers)
        if (! empty($projectData['storekeeper_id'])) {
            $otherMagasinierInTeam = $project->workers()
                ->where('role', UserRole::Magasinier->value)
                ->where('users.id', '!=', $projectData['storekeeper_id'])
                ->exists();

            if ($otherMagasinierInTeam) {
                return back()->withErrors(['storekeeper_id' => 'Un autre magasinier est déjà présent dans l\'équipe terrain. Un projet ne peut avoir qu\'un seul magasinier.']);
            }
        }

        $project->update($projectData);

        // Auto-assign new engineer's team if engineer changed
        if (isset($projectData['engineer_id']) && (int) $projectData['engineer_id'] !== (int) $originalEngineerId) {
            if (! empty($projectData['engineer_id'])) {
                // Engineer change doesn't automatically change workers anymore,
                // as workers are linked to Chef de Chantier.
            } else {
                // Remove all workers if engineer removed?
                // Usually an engineer removal might mean project reset.
            }
        }

        // Auto-assign chef de chantier's team if chef de chantier changed or assigned
        // Per documentation: when a Chef de Chantier is assigned, his team is automatically linked to the project
        if (isset($projectData['chef_chantier_id']) && (int) $projectData['chef_chantier_id'] !== (int) $originalChefChanttierId) {
            if (! empty($projectData['chef_chantier_id'])) {
                $chefChantier = User::find($projectData['chef_chantier_id']);
                if ($chefChantier) {
                    // Get chef's team workers
                    $chefTeamIds = $chefChantier->team()->pluck('id')->toArray();

                    // Replace workers with chef's team
                    if (! empty($chefTeamIds)) {
                        $project->workers()->sync($chefTeamIds);
                    }
                }
            } else {
                // If chef de chantier is removed, we might want to keep or remove workers.
                // For now, let's keep them unless an engineer change also happens.
            }
        }

        if ($request->has('steps')) {
            $existingStepIds = [];

            foreach ($validated['steps'] as $index => $stepData) {
                if (isset($stepData['id'])) {
                    $step = $project->steps()->find($stepData['id']);

                    if ($step) {
                        $stepPayload = [
                            'name' => $stepData['name'],
                            'order' => $index + 1,
                        ];

                        if ($user->role !== UserRole::Engineer) {
                            $stepPayload['budget'] = $stepData['budget'] ?? 0;
                        }

                        $step->update($stepPayload);
                        $existingStepIds[] = $step->id;
                    }
                } else {
                    $newStep = $project->steps()->create([
                        'name' => $stepData['name'],
                        'budget' => $user->role === UserRole::Engineer ? 0 : ($stepData['budget'] ?? 0),
                        'order' => $index + 1,
                    ]);
                    $existingStepIds[] = $newStep->id;
                }
            }

            $project->steps()->whereNotIn('id', $existingStepIds)->delete();

            if ($user->role !== UserRole::Engineer) {
                $project->syncBudgetFromSteps();
            }
        }

        ActivityLog::create([
            'user_id' => auth()->id(),
            'action' => 'update_project',
            'description' => "Mise à jour complète du projet : {$project->name}",
            'properties' => [
                'project_id' => $project->id,
                'status' => $project->status,
            ],
        ]);

        return redirect()->route('projects.show', $project)->with('success', 'Projet mis à jour avec succès');
    }

    public function assignWorkers(Request $request, Project $project)
    {
        $validated = $request->validate([
            'worker_ids' => 'required|array',
            'worker_ids.*' => 'exists:users,id',
        ]);

        $project->workers()->sync($validated['worker_ids']);

        return back()->with('success', 'Équipe mise à jour avec succès');
    }

    public function toggleStep(Project $project, ProjectStep $step)
    {
        // Permission check
        $user = auth()->user();
        if ($user->role !== UserRole::Manager &&
            ! ($user->role === UserRole::Engineer && $project->engineer_id === $user->id) &&
            ! ($user->role === UserRole::ChefChantier && $project->chef_chantier_id === $user->id)
        ) {
            abort(403, "Vous n'avez pas la permission de modifier les étapes de ce projet.");
        }

        // Ensure the step belongs to the project
        if ($step->project_id !== $project->id) {
            abort(404);
        }

        if ($step->is_completed) {
            $step->uncomplete();
            $message = 'Étape marquée comme non terminée';
        } else {
            $step->complete();
            $message = 'Étape validée et budget consommé';
        }

        return back()->with('success', $message);
    }

    public function destroy(Project $project)
    {
        $user = auth()->user();

        if ($user->role !== UserRole::Manager) {
            abort(403, 'Seul le manager peut supprimer un projet.');
        }

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

        return redirect()->route('projects.index')->with('success', 'Projet supprimé avec succès');
    }
}
