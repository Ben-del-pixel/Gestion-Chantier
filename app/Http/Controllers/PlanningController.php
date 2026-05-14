<?php

namespace App\Http\Controllers;

use App\Enums\UserRole;
use App\Models\Project;
use App\Models\Task;
use App\Models\User;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class PlanningController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();

        if (! in_array($user->role, [UserRole::Manager, UserRole::Engineer, UserRole::ChefChantier], true)) {
            abort(403, 'Accès réservé au manager, à l\'ingénieur et au chef de chantier.');
        }

        $projectsQuery = Project::query()
            ->with([
                'engineer:id,name',
                'chefChantier:id,name',
                'steps' => fn ($query) => $query->orderBy('order')->with([
                    'tasks' => fn ($tasksQuery) => $tasksQuery
                        ->with('workers:id,name')
                        ->orderBy('start_date')
                        ->orderBy('id'),
                ]),
            ])
            ->orderBy('name');

        if ($user->role === UserRole::Engineer) {
            $chefChantierIds = User::query()
                ->where('engineer_id', $user->id)
                ->where('role', UserRole::ChefChantier)
                ->pluck('id');

            $projectsQuery->where(function ($query) use ($user, $chefChantierIds) {
                $query->where('engineer_id', $user->id)
                    ->orWhereIn('chef_chantier_id', $chefChantierIds);
            });
        } elseif ($user->role === UserRole::ChefChantier) {
            $projectsQuery->where('chef_chantier_id', $user->id);
        }

        $projects = $projectsQuery->get();
        $projectIds = $projects->pluck('id');

        $orphansGrouped = Task::query()
            ->whereIn('project_id', $projectIds)
            ->whereNull('project_step_id')
            ->with('workers:id,name')
            ->orderBy('start_date')
            ->orderBy('id')
            ->get()
            ->groupBy('project_id');

        $payload = $projects->map(function (Project $project) use ($orphansGrouped) {
            $orphans = $orphansGrouped->get($project->id, collect());

            return [
                'id' => $project->id,
                'name' => $project->name,
                'status' => $project->status,
                'start_date' => $project->start_date?->format('Y-m-d'),
                'deadline' => $project->deadline?->format('Y-m-d'),
                'engineer' => $project->engineer
                    ? ['id' => $project->engineer->id, 'name' => $project->engineer->name]
                    : null,
                'chef_chantier' => $project->chefChantier
                    ? ['id' => $project->chefChantier->id, 'name' => $project->chefChantier->name]
                    : null,
                'steps' => $project->steps->map(fn ($step) => [
                    'id' => $step->id,
                    'name' => $step->name,
                    'order' => $step->order,
                    'is_completed' => $step->is_completed,
                    'tasks' => $step->tasks->map(fn ($task) => [
                        'id' => $task->id,
                        'name' => $task->name,
                        'status' => $task->status,
                        'start_date' => $task->start_date?->format('Y-m-d'),
                        'end_date' => $task->end_date?->format('Y-m-d'),
                        'workers' => $task->workers->map(fn ($w) => [
                            'id' => $w->id,
                            'name' => $w->name,
                        ])->values()->all(),
                    ])->values()->all(),
                ])->values()->all(),
                'tasks_without_step' => $orphans->map(fn ($task) => [
                    'id' => $task->id,
                    'name' => $task->name,
                    'status' => $task->status,
                    'start_date' => $task->start_date?->format('Y-m-d'),
                    'end_date' => $task->end_date?->format('Y-m-d'),
                    'workers' => $task->workers->map(fn ($w) => [
                        'id' => $w->id,
                        'name' => $w->name,
                    ])->values()->all(),
                ])->values()->all(),
            ];
        })->values()->all();

        return Inertia::render('planning/index', [
            'projects' => $payload,
        ]);
    }
}
