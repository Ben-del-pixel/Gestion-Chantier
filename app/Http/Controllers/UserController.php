<?php

namespace App\Http\Controllers;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Inertia\Inertia;
use Inertia\Response;

class UserController extends Controller
{
    public function index(): Response
    {
        $user = auth()->user();

        // Debug: Log user role info
        \Log::info('User role debug', [
            'user_id' => $user->id,
            'user_email' => $user->email,
            'role' => $user->role,
            'role_value' => $user->role?->value,
            'is_chef_chantier' => $user->role === UserRole::ChefChantier,
        ]);

        if ($user->role === UserRole::ChefChantier) {
            // Chef de Chantier sees only himself, his engineer, and his workers
            $users = User::with(['engineer', 'chefChantier'])
                ->where(function ($query) use ($user) {
                    $query->where('id', $user->id) // Himself
                        ->orWhere('id', $user->engineer_id) // His engineer
                        ->orWhere('chef_chantier_id', $user->id); // His workers
                })
                ->get()
                ->append('status');

            // Empty - he doesn't need to see other engineers
            $engineers = collect();
            $chefChantiers = collect();
        } elseif ($user->role === UserRole::Engineer) {
            // Engineer sees himself, his chefs de chantier, and their workers
            $chefChantierIds = User::where('engineer_id', $user->id)->pluck('id');

            $users = User::with(['engineer', 'chefChantier'])
                ->where(function ($query) use ($user, $chefChantierIds) {
                    $query->where('id', $user->id) // Himself
                        ->orWhere('engineer_id', $user->id) // His chefs de chantier
                        ->orWhereIn('chef_chantier_id', $chefChantierIds); // Workers under his chefs
                })
                ->get()
                ->append('status');

            // Engineers don't see other engineers in dropdown
            $engineers = collect();
            $chefChantiers = collect();
        } else {
            // Manager sees all users
            $users = User::with(['engineer', 'chefChantier'])->get()->append('status');
            $engineers = User::where('role', UserRole::Engineer->value)->get();
            $chefChantiers = User::where('role', UserRole::ChefChantier->value)->get();
        }

        return Inertia::render('users/index', [
            'users' => $users,
            'roles' => UserRole::cases(),
            'engineers' => $engineers,
            'chefChantiers' => $chefChantiers,
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
        ]);

        // Validate hierarchy based on role
        $role = UserRole::from($validated['role']);

        if ($authenticatedUser->role === UserRole::ChefChantier && $role === UserRole::Worker) {
            abort(403, 'Le chef de chantier ne peut pas créer un ouvrier.');
        }

        if ($role === UserRole::ChefChantier && empty($validated['engineer_id'])) {
            return back()->with('error', 'Un chef de chantier doit être assigné à un ingénieur.');
        }

        if ($role === UserRole::Worker && empty($validated['chef_chantier_id'])) {
            return back()->with('error', 'Un ouvrier doit être assigné à un chef de chantier.');
        }

        // Create user with appropriate parent
        $userData = [
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => Hash::make($validated['password']),
            'role' => $validated['role'],
            'phone' => $validated['phone'] ?? null,
            'skills' => $validated['skills'] ?? null,
        ];

        // Set the appropriate parent based on role
        if ($role === UserRole::ChefChantier) {
            $userData['engineer_id'] = $validated['engineer_id'];
            $userData['chef_chantier_id'] = null; // Chef de Chantier doesn't have a chef_chantier
        } elseif ($role === UserRole::Worker) {
            $userData['chef_chantier_id'] = $validated['chef_chantier_id'];
            $userData['engineer_id'] = null; // Worker gets engineer from chef_chantier
        } else {
            // Manager, Engineer, Magasinier don't have parents
            $userData['engineer_id'] = null;
            $userData['chef_chantier_id'] = null;
        }

        $user = User::create($userData);

        return back()->with('success', 'Utilisateur créé avec succès');
    }

    public function update(Request $request, User $user)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email,'.$user->id,
            'password' => 'nullable|string|min:8',
            'role' => 'required|in:'.implode(',', array_map(fn ($role) => $role->value, UserRole::cases())),
            'phone' => 'nullable|string|max:255',
            'skills' => 'nullable|string',
            'engineer_id' => 'nullable|exists:users,id',
            'chef_chantier_id' => 'nullable|exists:users,id',
        ]);

        // Validate hierarchy based on role
        $role = UserRole::from($validated['role']);

        if ($role === UserRole::ChefChantier && empty($validated['engineer_id'])) {
            return back()->with('error', 'Un chef de chantier doit être assigné à un ingénieur.');
        }

        if ($role === UserRole::Worker && empty($validated['chef_chantier_id'])) {
            return back()->with('error', 'Un ouvrier doit être assigné à un chef de chantier.');
        }

        if (! empty($validated['password'])) {
            $validated['password'] = Hash::make($validated['password']);
        } else {
            unset($validated['password']);
        }

        // Set the appropriate parent based on role
        if ($role === UserRole::ChefChantier) {
            $validated['engineer_id'] = $validated['engineer_id'];
            $validated['chef_chantier_id'] = null;
        } elseif ($role === UserRole::Worker) {
            $validated['chef_chantier_id'] = $validated['chef_chantier_id'];
            $validated['engineer_id'] = null;
        } else {
            // Manager, Engineer, Magasinier don't have parents
            $validated['engineer_id'] = null;
            $validated['chef_chantier_id'] = null;
        }

        $user->update($validated);

        return back()->with('success', 'Utilisateur mis à jour avec succès');
    }

    public function destroy(User $user)
    {
        $user->delete();

        return back()->with('success', 'Utilisateur supprimé avec succès');
    }
}
