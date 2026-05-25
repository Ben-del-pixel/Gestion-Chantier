<?php

use App\Enums\UserRole;
use App\Models\ActivityLog;
use App\Models\Project;
use App\Models\Task;
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

it('stores project engineer and chef on incident when worker has task', function () {
    $manager = User::factory()->create(['role' => UserRole::Manager]);
    $engineer = User::factory()->create(['role' => UserRole::Engineer]);
    $chef = User::factory()->create([
        'role' => UserRole::ChefChantier,
        'engineer_id' => $engineer->id,
    ]);
    $worker = User::factory()->create([
        'role' => UserRole::Worker,
        'chef_chantier_id' => $chef->id,
    ]);
    $project = Project::factory()->create([
        'manager_id' => $manager->id,
        'engineer_id' => $engineer->id,
        'chef_chantier_id' => $chef->id,
    ]);
    $task = Task::create([
        'project_id' => $project->id,
        'name' => 'Tache chantier',
        'description' => null,
        'start_date' => now(),
        'end_date' => now()->addDay(),
        'status' => 'planifie',
    ]);
    $task->workers()->attach($worker->id);

    $this->actingAs($worker)
        ->postJson(route('incidents.store'), [
            'title' => 'Chute legere',
            'details' => 'Description suffisamment longue pour valider le formulaire.',
            'severity' => 'faible',
        ])
        ->assertOk();

    $incident = ActivityLog::query()
        ->where('user_id', $worker->id)
        ->where('action', 'incident_declared')
        ->latest('id')
        ->first();

    expect($incident)->not->toBeNull();
    expect((int) $incident->properties['project_id'])->toBe($project->id);
    expect((int) $incident->properties['engineer_id'])->toBe($engineer->id);
    expect((int) $incident->properties['chef_chantier_id'])->toBe($chef->id);
    expect($incident->properties['status'])->toBe('open');
});

it('chef de chantier can resolve worker incident for own project', function () {
    $manager = User::factory()->create(['role' => UserRole::Manager]);
    $engineer = User::factory()->create(['role' => UserRole::Engineer]);
    $chef = User::factory()->create([
        'role' => UserRole::ChefChantier,
        'engineer_id' => $engineer->id,
    ]);
    $worker = User::factory()->create([
        'role' => UserRole::Worker,
        'chef_chantier_id' => $chef->id,
    ]);
    $project = Project::factory()->create([
        'manager_id' => $manager->id,
        'engineer_id' => $engineer->id,
        'chef_chantier_id' => $chef->id,
    ]);
    $task = Task::create([
        'project_id' => $project->id,
        'name' => 'Tache',
        'description' => null,
        'start_date' => now(),
        'end_date' => now()->addDay(),
        'status' => 'planifie',
    ]);
    $task->workers()->attach($worker->id);

    $this->actingAs($worker)
        ->postJson(route('incidents.store'), [
            'title' => 'Risque',
            'details' => 'Description detaillee du risque observe sur le chantier.',
            'severity' => 'moyen',
        ])
        ->assertOk();

    $incident = ActivityLog::query()
        ->where('user_id', $worker->id)
        ->where('action', 'incident_declared')
        ->latest('id')
        ->first();

    $this->actingAs($chef)
        ->postJson(route('incidents.resolve', $incident), [
            'resolution_note' => 'Securisation effectuee ce matin.',
        ])
        ->assertOk();

    $incident->refresh();
    expect($incident->properties['status'])->toBe('resolved');
    expect($incident->properties['resolution_note'])->toBe('Securisation effectuee ce matin.');
});

it('engineer can resolve worker incident for own project', function () {
    $manager = User::factory()->create(['role' => UserRole::Manager]);
    $engineer = User::factory()->create(['role' => UserRole::Engineer]);
    $chef = User::factory()->create([
        'role' => UserRole::ChefChantier,
        'engineer_id' => $engineer->id,
    ]);
    $worker = User::factory()->create([
        'role' => UserRole::Worker,
        'chef_chantier_id' => $chef->id,
    ]);
    $project = Project::factory()->create([
        'manager_id' => $manager->id,
        'engineer_id' => $engineer->id,
        'chef_chantier_id' => $chef->id,
    ]);
    $task = Task::create([
        'project_id' => $project->id,
        'name' => 'Tache',
        'description' => null,
        'start_date' => now(),
        'end_date' => now()->addDay(),
        'status' => 'planifie',
    ]);
    $task->workers()->attach($worker->id);

    $this->actingAs($worker)
        ->postJson(route('incidents.store'), [
            'title' => 'Incident',
            'details' => 'Description detaillee pour la validation du formulaire.',
            'severity' => 'faible',
        ])
        ->assertOk();

    $incident = ActivityLog::query()
        ->where('user_id', $worker->id)
        ->where('action', 'incident_declared')
        ->latest('id')
        ->first();

    $this->actingAs($engineer)
        ->postJson(route('incidents.resolve', $incident), [
            'resolution_note' => 'Intervention planifiee demain matin.',
        ])
        ->assertOk();

    $incident->refresh();
    expect($incident->properties['status'])->toBe('resolved');
    expect((int) $incident->properties['resolved_by_user_id'])->toBe($engineer->id);
    expect($incident->properties['resolution_note'])->toBe('Intervention planifiee demain matin.');
});

it('engineer cannot resolve incident outside own projects', function () {
    $manager = User::factory()->create(['role' => UserRole::Manager]);
    $engineerA = User::factory()->create(['role' => UserRole::Engineer]);
    $engineerB = User::factory()->create(['role' => UserRole::Engineer]);
    $chef = User::factory()->create([
        'role' => UserRole::ChefChantier,
        'engineer_id' => $engineerB->id,
    ]);
    $worker = User::factory()->create([
        'role' => UserRole::Worker,
        'chef_chantier_id' => $chef->id,
    ]);
    $project = Project::factory()->create([
        'manager_id' => $manager->id,
        'engineer_id' => $engineerB->id,
        'chef_chantier_id' => $chef->id,
    ]);
    $task = Task::create([
        'project_id' => $project->id,
        'name' => 'Tache',
        'description' => null,
        'start_date' => now(),
        'end_date' => now()->addDay(),
        'status' => 'planifie',
    ]);
    $task->workers()->attach($worker->id);

    $this->actingAs($worker)
        ->postJson(route('incidents.store'), [
            'title' => 'Incident',
            'details' => 'Description detaillee pour la validation du formulaire.',
            'severity' => 'faible',
        ])
        ->assertOk();

    $incident = ActivityLog::query()
        ->where('user_id', $worker->id)
        ->where('action', 'incident_declared')
        ->latest('id')
        ->first();

    $this->actingAs($engineerA)
        ->postJson(route('incidents.resolve', $incident), [])
        ->assertForbidden();
});

it('chef cannot resolve incident outside own projects', function () {
    $manager = User::factory()->create(['role' => UserRole::Manager]);
    $engineer = User::factory()->create(['role' => UserRole::Engineer]);
    $chefA = User::factory()->create([
        'role' => UserRole::ChefChantier,
        'engineer_id' => $engineer->id,
    ]);
    $chefB = User::factory()->create([
        'role' => UserRole::ChefChantier,
        'engineer_id' => $engineer->id,
    ]);
    $worker = User::factory()->create([
        'role' => UserRole::Worker,
        'chef_chantier_id' => $chefA->id,
    ]);
    $project = Project::factory()->create([
        'manager_id' => $manager->id,
        'engineer_id' => $engineer->id,
        'chef_chantier_id' => $chefA->id,
    ]);
    $task = Task::create([
        'project_id' => $project->id,
        'name' => 'Tache',
        'description' => null,
        'start_date' => now(),
        'end_date' => now()->addDay(),
        'status' => 'planifie',
    ]);
    $task->workers()->attach($worker->id);

    $this->actingAs($worker)
        ->postJson(route('incidents.store'), [
            'title' => 'Probleme',
            'details' => 'Description detaillee du probleme sur le chantier.',
            'severity' => 'faible',
        ])
        ->assertOk();

    $incident = ActivityLog::query()
        ->where('user_id', $worker->id)
        ->where('action', 'incident_declared')
        ->latest('id')
        ->first();

    $this->actingAs($chefB)
        ->postJson(route('incidents.resolve', $incident), [])
        ->assertForbidden();
});

it('chef cannot resolve same incident twice', function () {
    $manager = User::factory()->create(['role' => UserRole::Manager]);
    $engineer = User::factory()->create(['role' => UserRole::Engineer]);
    $chef = User::factory()->create([
        'role' => UserRole::ChefChantier,
        'engineer_id' => $engineer->id,
    ]);
    $worker = User::factory()->create([
        'role' => UserRole::Worker,
        'chef_chantier_id' => $chef->id,
    ]);
    $project = Project::factory()->create([
        'manager_id' => $manager->id,
        'engineer_id' => $engineer->id,
        'chef_chantier_id' => $chef->id,
    ]);
    $task = Task::create([
        'project_id' => $project->id,
        'name' => 'Tache',
        'description' => null,
        'start_date' => now(),
        'end_date' => now()->addDay(),
        'status' => 'planifie',
    ]);
    $task->workers()->attach($worker->id);

    $this->actingAs($worker)
        ->postJson(route('incidents.store'), [
            'title' => 'Alerte',
            'details' => 'Description detaillee de l alerte sur le chantier.',
            'severity' => 'eleve',
        ])
        ->assertOk();

    $incident = ActivityLog::query()
        ->where('user_id', $worker->id)
        ->where('action', 'incident_declared')
        ->latest('id')
        ->first();

    $this->actingAs($chef)
        ->postJson(route('incidents.resolve', $incident), [])
        ->assertOk();

    $this->actingAs($chef)
        ->postJson(route('incidents.resolve', $incident), [])
        ->assertStatus(422);
});
