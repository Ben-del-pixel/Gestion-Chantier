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

        if ($user->role === UserRole::ChefChantier->value) {
            // Chef de Chantier sees only his team
            $engineerIds = User::where('chef_chantier_id', $user->id)->pluck('id');

            $users = User::with(['engineer', 'chefChantier'])
                ->where(function ($query) use ($user, $engineerIds) {
                    $query->where('id', $user->id) // Himself
                        ->orWhere('chef_chantier_id', $user->id) // His engineers
                        ->orWhereIn('engineer_id', $engineerIds); // Workers under his engineers
                })
                ->get()
                ->append('status');

            // Only his engineers for the dropdown
            $engineers = User::where('role', UserRole::Engineer->value)
                ->where('chef_chantier_id', $user->id)
                ->get();
            $chefChantiers = collect(); // Empty - he doesn't need to see other chefs
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

        $user = User::create([
            ...$validated,
            'password' => Hash::make($validated['password']),
        ]);

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

        if (! empty($validated['password'])) {
            $validated['password'] = Hash::make($validated['password']);
        } else {
            unset($validated['password']);
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
