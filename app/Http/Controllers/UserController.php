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
        $users = User::with('engineer')->get()->append('status');
        $engineers = User::where('role', UserRole::Engineer->value)->get();

        return Inertia::render('users/index', [
            'users' => $users,
            'roles' => UserRole::cases(),
            'engineers' => $engineers,
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
