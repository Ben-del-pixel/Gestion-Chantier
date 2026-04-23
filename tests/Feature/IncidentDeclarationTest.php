<?php

use App\Enums\UserRole;
use App\Models\ActivityLog;
use App\Models\User;

it('worker can declare incident', function () {
    $worker = User::factory()->create(['role' => UserRole::Worker]);

    $this->actingAs($worker)
        ->post(route('incidents.store'), [
            'title' => 'Incident materiel',
            'details' => 'Une palette de ciment est tombee pendant le dechargement.',
            'severity' => 'moyen',
        ])
        ->assertRedirect();

    $incident = ActivityLog::query()
        ->where('user_id', $worker->id)
        ->where('action', 'incident_declared')
        ->latest('id')
        ->first();

    expect($incident)->not->toBeNull();
    expect($incident->description)->toBe('Incident materiel');
    expect($incident->properties['severity'])->toBe('moyen');
});

it('non worker cannot declare incident', function () {
    $engineer = User::factory()->create(['role' => UserRole::Engineer]);

    $this->actingAs($engineer)
        ->post(route('incidents.store'), [
            'title' => 'Incident test',
            'details' => 'Contenu de test pour verifier la restriction.',
            'severity' => 'faible',
        ])
        ->assertForbidden();
});

it('worker receives json validation error when incident payload is invalid', function () {
    $worker = User::factory()->create(['role' => UserRole::Worker]);

    $this->actingAs($worker)
        ->postJson(route('incidents.store'), [
            'title' => 'Incident court',
            'details' => 'court',
            'severity' => 'moyen',
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['details']);
});
