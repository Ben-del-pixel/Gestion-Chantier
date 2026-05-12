<?php

namespace App\Http\Controllers;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Hash;
use Inertia\Inertia;
use Inertia\Response;

class UserController extends Controller
{
    public function index(): Response
    {
        $user = auth()->user();

        if ($user->role === UserRole::ChefChantier) {
            $users = User::with(['engineer', 'chefChantier'])
                ->where(function ($query) use ($user) {
                    $query->where('id', $user->id)
                        ->orWhere('id', $user->engineer_id)
                        ->orWhere('chef_chantier_id', $user->id);
                })
                ->get()
                ->append('status');

            $engineers = collect();
            $chefChantiers = collect();
            $assignableWorkers = collect();
        } elseif ($user->role === UserRole::Engineer) {
            $chefChantierIds = User::where('engineer_id', $user->id)
                ->where('role', UserRole::ChefChantier)
                ->pluck('id');

            $users = User::with(['engineer', 'chefChantier'])
                ->where(function ($query) use ($user, $chefChantierIds) {
                    $query->where('id', $user->id)
                        ->orWhere('engineer_id', $user->id)
                        ->orWhereIn('chef_chantier_id', $chefChantierIds);
                })
                ->get()
                ->append('status');

            $engineers = collect([['id' => $user->id, 'name' => $user->name]]);
            $chefChantiers = User::where('role', UserRole::ChefChantier)
                ->where('engineer_id', $user->id)
                ->orderBy('name')
                ->get(['id', 'name']);
            $assignableWorkers = $this->assignableWorkersForEngineer($user);
        } else {
            $users = User::with(['engineer', 'chefChantier'])->get()->append('status');
            $engineers = User::where('role', UserRole::Engineer->value)->orderBy('name')->get();
            $chefChantiers = User::where('role', UserRole::ChefChantier->value)->orderBy('name')->get();
            $assignableWorkers = User::where('role', UserRole::Worker)
                ->orderBy('name')
                ->get(['id', 'name', 'chef_chantier_id']);
        }

        return Inertia::render('users/index', [
            'users' => $users,
            'roles' => UserRole::cases(),
            'engineers' => $engineers,
            'chefChantiers' => $chefChantiers,
            'assignableWorkers' => $assignableWorkers,
        ]);
    }

    public function store(Request $request)
    {
        $authenticatedUser = auth()->user();

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
            'password' => 'required|string|min:8',
            'role' => 'required|in:'.implode(',', array_map(fn ($role) => $role->value, UserRole::cases())),
            'phone' => 'nullable|string|max:255',
            'skills' => 'nullable|string',
            'engineer_id' => 'nullable|exists:users,id',
            'chef_chantier_id' => 'nullable|exists:users,id',
            'team_worker_ids' => 'nullable|array',
            'team_worker_ids.*' => 'integer|exists:users,id',
        ]);

        $role = UserRole::from($validated['role']);

        foreach (['engineer_id', 'chef_chantier_id'] as $field) {
            if (array_key_exists($field, $validated) && $validated[$field] === '') {
                $validated[$field] = null;
            }
        }

        if ($authenticatedUser->role === UserRole::ChefChantier && $role === UserRole::Worker) {
            abort(403, 'Le chef de chantier ne peut pas créer un ouvrier.');
        }

        if ($role === UserRole::ChefChantier && empty($validated['engineer_id'])) {
            return back()->with('error', 'Un chef de chantier doit être assigné à un ingénieur.');
        }

        if ($role === UserRole::Worker && empty($validated['chef_chantier_id'])) {
            return back()->with('error', 'Un ouvrier doit être assigné à un chef de chantier.');
        }

        if ($role === UserRole::ChefChantier && $authenticatedUser->role === UserRole::Engineer) {
            if ((int) $validated['engineer_id'] !== (int) $authenticatedUser->id) {
                return back()->with('error', 'Vous ne pouvez créer un chef de chantier que sous votre responsabilité.');
            }
        }

        $userData = [
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => Hash::make($validated['password']),
            'role' => $validated['role'],
            'phone' => $validated['phone'] ?? null,
            'skills' => $validated['skills'] ?? null,
        ];

        if ($role === UserRole::ChefChantier) {
            $userData['engineer_id'] = $validated['engineer_id'];
            $userData['chef_chantier_id'] = null;
        } elseif ($role === UserRole::Worker) {
            $userData['chef_chantier_id'] = $validated['chef_chantier_id'];
            $userData['engineer_id'] = null;
        } elseif ($role === UserRole::Magasinier) {
            $userData['engineer_id'] = $validated['engineer_id'] ?? null;
            $userData['chef_chantier_id'] = null;
        } else {
            $userData['engineer_id'] = null;
            $userData['chef_chantier_id'] = null;
        }

        $newUser = User::create($userData);

        if ($role === UserRole::ChefChantier && $request->has('team_worker_ids')) {
            $this->syncChefTeam($newUser, (array) $request->input('team_worker_ids', []), $authenticatedUser);
        }

        return back()->with('success', 'Utilisateur créé avec succès');
    }

    public function update(Request $request, User $user)
    {
        $authenticatedUser = auth()->user();

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email,'.$user->id,
            'password' => 'nullable|string|min:8',
            'role' => 'required|in:'.implode(',', array_map(fn ($role) => $role->value, UserRole::cases())),
            'phone' => 'nullable|string|max:255',
            'skills' => 'nullable|string',
            'engineer_id' => 'nullable|exists:users,id',
            'chef_chantier_id' => 'nullable|exists:users,id',
            'team_worker_ids' => 'nullable|array',
            'team_worker_ids.*' => 'integer|exists:users,id',
        ]);

        $role = UserRole::from($validated['role']);

        foreach (['engineer_id', 'chef_chantier_id'] as $field) {
            if (array_key_exists($field, $validated) && $validated[$field] === '') {
                $validated[$field] = null;
            }
        }

        if ($role === UserRole::ChefChantier && empty($validated['engineer_id'])) {
            return back()->with('error', 'Un chef de chantier doit être assigné à un ingénieur.');
        }

        if ($role === UserRole::Worker && empty($validated['chef_chantier_id'])) {
            return back()->with('error', 'Un ouvrier doit être assigné à un chef de chantier.');
        }

        if ($role === UserRole::ChefChantier && $authenticatedUser->role === UserRole::Engineer) {
            if ((int) $validated['engineer_id'] !== (int) $authenticatedUser->id) {
                return back()->with('error', 'Vous ne pouvez modifier ce chef de chantier que sous votre responsabilité.');
            }
        }

        if (! empty($validated['password'])) {
            $validated['password'] = Hash::make($validated['password']);
        } else {
            unset($validated['password']);
        }

        if ($role === UserRole::ChefChantier) {
            $validated['chef_chantier_id'] = null;
        } elseif ($role === UserRole::Worker) {
            $validated['engineer_id'] = null;
        } elseif ($role === UserRole::Magasinier) {
            $validated['chef_chantier_id'] = null;
        } else {
            $validated['engineer_id'] = null;
            $validated['chef_chantier_id'] = null;
        }

        unset($validated['team_worker_ids']);

        $user->update($validated);

        if ($role === UserRole::ChefChantier && $request->has('team_worker_ids')) {
            $this->syncChefTeam($user, (array) $request->input('team_worker_ids', []), $authenticatedUser);
        }

        return back()->with('success', 'Utilisateur mis à jour avec succès');
    }

    public function destroy(User $user)
    {
        $user->delete();

        return back()->with('success', 'Utilisateur supprimé avec succès');
    }

    /**
     * @return Collection<int, User>
     */
    private function assignableWorkersForEngineer(User $engineer)
    {
        $myChefIds = User::where('engineer_id', $engineer->id)
            ->where('role', UserRole::ChefChantier)
            ->pluck('id');

        return User::where('role', UserRole::Worker)
            ->where(function ($query) use ($myChefIds) {
                $query->whereNull('chef_chantier_id')
                    ->orWhereIn('chef_chantier_id', $myChefIds);
            })
            ->orderBy('name')
            ->get(['id', 'name', 'chef_chantier_id']);
    }

    /**
     * @param  array<int|string>  $workerIds
     */
    private function syncChefTeam(User $chef, array $workerIds, User $authenticatedUser): void
    {
        if ($chef->role !== UserRole::ChefChantier) {
            return;
        }

        $workerIds = array_values(array_unique(array_filter(array_map('intval', $workerIds))));

        User::query()
            ->where('chef_chantier_id', $chef->id)
            ->whereNotIn('id', $workerIds)
            ->update(['chef_chantier_id' => null]);

        foreach ($workerIds as $workerId) {
            $worker = User::query()->findOrFail($workerId);
            if ($worker->role !== UserRole::Worker) {
                abort(422, 'Seuls des ouvriers peuvent être affectés à l’équipe d’un chef de chantier.');
            }

            if (! $this->canAssignWorkerToChef($authenticatedUser, $chef, $worker)) {
                abort(403, 'Vous ne pouvez pas affecter cet ouvrier à ce chef de chantier.');
            }

            $worker->update(['chef_chantier_id' => $chef->id]);
        }
    }

    private function canAssignWorkerToChef(User $auth, User $chef, User $worker): bool
    {
        if ($auth->role === UserRole::Manager) {
            return true;
        }

        if ($auth->role !== UserRole::Engineer) {
            return false;
        }

        if ((int) $chef->engineer_id !== (int) $auth->id) {
            return false;
        }

        if ($worker->chef_chantier_id === null) {
            return true;
        }

        if ((int) $worker->chef_chantier_id === (int) $chef->id) {
            return true;
        }

        $currentChef = User::query()->find($worker->chef_chantier_id);

        return $currentChef
            && $currentChef->role === UserRole::ChefChantier
            && (int) $currentChef->engineer_id === (int) $auth->id;
    }
}
