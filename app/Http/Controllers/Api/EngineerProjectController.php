<?php

namespace App\Http\Controllers\Api;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class EngineerProjectController extends Controller
{
    /**
     * Afficher les projets de l'ingénieur avec possibilité d'affecter personnel
     */
    public function index()
    {
        $user = Auth::user();

        if ($user->role !== UserRole::Engineer) {
            abort(403, 'Accès réservé aux ingénieurs.');
        }

        // Projets assignés à cet ingénieur
        $projects = Project::with(['manager', 'chefChantier', 'storekeeper', 'workers', 'steps'])
            ->where('engineer_id', $user->id)
            ->latest()
            ->get();

        // Liste des magasiniers disponibles (non assignés à un projet)
        $availableStorekeepers = User::where('role', UserRole::Magasinier)
            ->whereNotIn('id', Project::whereNotNull('storekeeper_id')->pluck('storekeeper_id'))
            ->orWhereIn('id', $projects->pluck('storekeeper_id'))
            ->get();

        // Liste des chefs de chantier de cet ingénieur
        $myChefChantiers = User::where('role', UserRole::ChefChantier)
            ->where('engineer_id', $user->id)
            ->with('team')
            ->get();

        return response()->json([
            'projects' => $projects,
            'availableStorekeepers' => $availableStorekeepers,
            'myChefChantiers' => $myChefChantiers,
        ]);
    }

    /**
     * Affecter un magasinier à un projet
     */
    public function assignStorekeeper(Request $request, Project $project)
    {
        $user = Auth::user();

        if ($user->role !== UserRole::Engineer || $project->engineer_id !== $user->id) {
            abort(403, 'Vous ne pouvez pas modifier ce projet.');
        }

        $validated = $request->validate([
            'storekeeper_id' => 'required|exists:users,id',
        ]);

        $storekeeper = User::find($validated['storekeeper_id']);
        if ($storekeeper->role !== UserRole::Magasinier) {
            return response()->json(['error' => 'L\'utilisateur sélectionné n\'est pas un magasinier.'], 422);
        }

        $project->update(['storekeeper_id' => $validated['storekeeper_id']]);

        return response()->json([
            'success' => true,
            'message' => 'Magasinier assigné avec succès.',
            'project' => $project->fresh(['storekeeper']),
        ]);
    }

    /**
     * Affecter un chef de chantier à un projet
     */
    public function assignChefChantier(Request $request, Project $project)
    {
        $user = Auth::user();

        if ($user->role !== UserRole::Engineer || $project->engineer_id !== $user->id) {
            abort(403, 'Vous ne pouvez pas modifier ce projet.');
        }

        $validated = $request->validate([
            'chef_chantier_id' => 'required|exists:users,id',
        ]);

        $chefChantier = User::find($validated['chef_chantier_id']);
        if ($chefChantier->role !== UserRole::ChefChantier) {
            return response()->json(['error' => 'L\'utilisateur sélectionné n\'est pas un chef de chantier.'], 422);
        }

        // Vérifier que le chef de chantier appartient à cet ingénieur
        if ($chefChantier->engineer_id !== $user->id) {
            return response()->json(['error' => 'Ce chef de chantier ne fait pas partie de votre équipe.'], 403);
        }

        $project->update(['chef_chantier_id' => $validated['chef_chantier_id']]);

        // Assigner automatiquement l'équipe du chef de chantier au projet
        $teamIds = $chefChantier->team()->pluck('id')->toArray();
        if (!empty($teamIds)) {
            // Créer les entrées dans project_workers
            foreach ($teamIds as $workerId) {
                $project->projectWorkers()->create([
                    'worker_id' => $workerId,
                    'chef_chantier_id' => $chefChantier->id,
                ]);
            }
            // Sync pour la relation many-to-many existante
            $project->workers()->sync($teamIds);
        }

        return response()->json([
            'success' => true,
            'message' => 'Chef de chantier et son équipe assignés avec succès.',
            'project' => $project->fresh(['chefChantier', 'workers']),
        ]);
    }
}
