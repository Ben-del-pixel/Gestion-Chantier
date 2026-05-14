<?php

namespace App\Http\Controllers;

use App\Enums\UserRole;
use App\Models\ActivityLog;
use App\Models\Project;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class IncidentController extends Controller
{
    public function store(Request $request): JsonResponse|RedirectResponse
    {
        $user = $request->user();

        if (! $user || $user->role->value !== UserRole::Worker->value) {
            if ($request->expectsJson()) {
                return response()->json([
                    'message' => 'Seul un ouvrier peut declarer un incident.',
                ], 403);
            }

            abort(403, 'Seul un ouvrier peut declarer un incident.');
        }

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'details' => ['required', 'string', 'min:10'],
            'severity' => ['required', 'in:faible,moyen,eleve,critique'],
            'project_id' => ['nullable', 'exists:projects,id'],
        ]);

        $projectId = $validated['project_id'] ?? $user->tasks()
            ->orderByDesc('tasks.id')
            ->value('tasks.project_id');

        $engineerId = null;
        $chefChantierId = null;
        $projectName = null;

        if ($projectId) {
            $project = Project::query()->find($projectId);
            if ($project) {
                $engineerId = $project->engineer_id;
                $chefChantierId = $project->chef_chantier_id;
                $projectName = $project->name;
            }
        }

        ActivityLog::create([
            'user_id' => $user->id,
            'action' => 'incident_declared',
            'description' => $validated['title'],
            'properties' => [
                'details' => $validated['details'],
                'severity' => $validated['severity'],
                'project_id' => $projectId ? (int) $projectId : null,
                'project_name' => $projectName,
                'engineer_id' => $engineerId,
                'chef_chantier_id' => $chefChantierId,
                'status' => 'open',
                'resolved_at' => null,
                'resolved_by_user_id' => null,
                'resolved_by_name' => null,
                'resolution_note' => null,
            ],
            'ip_address' => $request->ip(),
        ]);

        if ($request->expectsJson()) {
            return response()->json([
                'message' => 'Incident declare avec succes. Votre chef de chantier et l\'ingenieur en charge du projet en sont informes.',
            ]);
        }

        return back()->with('success', 'Incident declare avec succes.');
    }

    public function resolve(Request $request, ActivityLog $activityLog): JsonResponse|RedirectResponse
    {
        $user = $request->user();

        if (! $user || $user->role !== UserRole::ChefChantier) {
            if ($request->expectsJson()) {
                return response()->json([
                    'message' => 'Seul le chef de chantier du projet peut marquer cet incident comme corrige.',
                ], 403);
            }

            abort(403, 'Seul le chef de chantier du projet peut marquer cet incident comme corrige.');
        }

        if ($activityLog->action !== 'incident_declared') {
            abort(404);
        }

        $properties = $activityLog->properties ?? [];

        if (($properties['status'] ?? 'open') === 'resolved') {
            if ($request->expectsJson()) {
                return response()->json([
                    'message' => 'Cet incident est deja marque comme corrige.',
                ], 422);
            }

            return back()->withErrors(['incident' => 'Cet incident est deja marque comme corrige.']);
        }

        $projectId = $properties['project_id'] ?? null;
        $project = $projectId ? Project::query()->find($projectId) : null;

        if (! $project || (int) $project->chef_chantier_id !== (int) $user->id) {
            if ($request->expectsJson()) {
                return response()->json([
                    'message' => 'Vous ne pouvez pas traiter un incident en dehors de vos chantiers.',
                ], 403);
            }

            abort(403, 'Vous ne pouvez pas traiter un incident en dehors de vos chantiers.');
        }

        $validated = $request->validate([
            'resolution_note' => ['nullable', 'string', 'max:500'],
        ]);

        $properties['status'] = 'resolved';
        $properties['resolved_at'] = now()->toIso8601String();
        $properties['resolved_by_user_id'] = $user->id;
        $properties['resolved_by_name'] = $user->name;
        $properties['resolution_note'] = $validated['resolution_note'] ?? null;

        $activityLog->update([
            'properties' => $properties,
        ]);

        if ($request->expectsJson()) {
            return response()->json([
                'message' => 'L\'ouvrier verra sur son tableau de bord que l\'incident a ete corrige.',
                'activity_log' => $activityLog->fresh(['user:id,name']),
            ]);
        }

        return back()->with('success', 'Incident marque comme corrige ; l\'ouvrier en est informe sur son espace.');
    }
}
