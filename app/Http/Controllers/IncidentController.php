<?php

namespace App\Http\Controllers;

use App\Enums\UserRole;
use App\Models\ActivityLog;
use Illuminate\Http\Request;

class IncidentController extends Controller
{
    public function store(Request $request)
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

        ActivityLog::create([
            'user_id' => $user->id,
            'action' => 'incident_declared',
            'description' => $validated['title'],
            'properties' => [
                'details' => $validated['details'],
                'severity' => $validated['severity'],
                'project_id' => $validated['project_id'] ?? null,
            ],
            'ip_address' => $request->ip(),
        ]);

        if ($request->expectsJson()) {
            return response()->json([
                'message' => 'Incident declare avec succes.',
            ]);
        }

        return back()->with('success', 'Incident declare avec succes.');
    }
}
