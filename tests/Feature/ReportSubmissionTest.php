<?php

use App\Enums\UserRole;
use App\Models\Project;
use App\Models\ReportSubmission;
use App\Models\User;

it('worker cannot access reports or submit', function () {
    $engineer = User::factory()->create(['role' => UserRole::Engineer]);
    $worker = User::factory()->create(['role' => UserRole::Worker]);
    $project = Project::factory()->create(['engineer_id' => $engineer->id]);
    $project->workers()->sync([$worker->id]);

    $this->actingAs($worker)
        ->get(route('reports.index'))
        ->assertForbidden();

    $this->actingAs($worker)
        ->post(route('reports.submit'), [
            'title' => 'Rapport journalier',
            'content' => 'Progression du coffrage et verification des materiaux sur site.',
            'project_id' => $project->id,
        ])
        ->assertForbidden();

    expect(ReportSubmission::query()->count())->toBe(0);
});

it('magasinier submits report to engineer', function () {
    $engineer = User::factory()->create(['role' => UserRole::Engineer]);
    $magasinier = User::factory()->create(['role' => UserRole::Magasinier]);
    $project = Project::factory()->create([
        'engineer_id' => $engineer->id,
        'storekeeper_id' => $magasinier->id,
    ]);

    $this->actingAs($magasinier)
        ->post(route('reports.submit'), [
            'title' => 'Rapport stock',
            'content' => 'Inventaire mis a jour, sorties de stock enregistrees et ecarts verifies.',
            'project_id' => $project->id,
            'recipient_id' => '',
        ])
        ->assertRedirect(route('reports.index'));

    $report = ReportSubmission::query()->latest('id')->first();

    expect($report)->not->toBeNull();
    expect($report->sender_id)->toBe($magasinier->id);
    expect($report->recipient_id)->toBe($engineer->id);
});

it('magasinier without project still submits to an engineer', function () {
    $engineer = User::factory()->create(['role' => UserRole::Engineer]);
    $magasinier = User::factory()->create(['role' => UserRole::Magasinier]);
    Project::factory()->create([
        'engineer_id' => $engineer->id,
        'storekeeper_id' => $magasinier->id,
    ]);

    $this->actingAs($magasinier)
        ->post(route('reports.submit'), [
            'title' => 'Rapport stock hebdomadaire',
            'content' => 'Etat des stocks, mouvements et alertes pour la semaine en cours.',
            'recipient_id' => '',
        ])
        ->assertRedirect(route('reports.index'));

    $report = ReportSubmission::query()->latest('id')->first();

    expect($report)->not->toBeNull();
    expect($report->recipient_id)->toBe($engineer->id);
});

it('engineer submits report to manager', function () {
    $manager = User::factory()->create(['role' => UserRole::Manager]);
    $engineer = User::factory()->create(['role' => UserRole::Engineer]);

    $this->actingAs($engineer)
        ->post(route('reports.submit'), [
            'title' => 'Rapport de progression',
            'content' => 'Etat global du chantier, avancement, besoins et risques du prochain cycle.',
        ])
        ->assertRedirect(route('reports.index'));

    $report = ReportSubmission::query()->latest('id')->first();

    expect($report)->not->toBeNull();
    expect($report->sender_id)->toBe($engineer->id);
    expect($report->recipient_id)->toBe($manager->id);
});

it('manager submits report to engineer', function () {
    $manager = User::factory()->create(['role' => UserRole::Manager]);
    $engineer = User::factory()->create(['role' => UserRole::Engineer]);

    $this->actingAs($manager)
        ->post(route('reports.submit'), [
            'title' => 'Rapport managérial',
            'content' => 'Contenu de test suffisamment long pour valider les contraintes minimales.',
            'recipient_id' => $engineer->id,
        ])
        ->assertRedirect(route('reports.index'));

    $report = ReportSubmission::query()->latest('id')->first();

    expect($report)->not->toBeNull();
    expect($report->sender_id)->toBe($manager->id);
    expect($report->recipient_id)->toBe($engineer->id);
});

it('manager submits report to chef de chantier', function () {
    $manager = User::factory()->create(['role' => UserRole::Manager]);
    $chef = User::factory()->create(['role' => UserRole::ChefChantier]);

    $this->actingAs($manager)
        ->post(route('reports.submit'), [
            'title' => 'Rapport managérial',
            'content' => 'Contenu de test suffisamment long pour valider les contraintes minimales.',
            'recipient_id' => $chef->id,
        ])
        ->assertRedirect(route('reports.index'));

    $report = ReportSubmission::query()->latest('id')->first();

    expect($report)->not->toBeNull();
    expect($report->sender_id)->toBe($manager->id);
    expect($report->recipient_id)->toBe($chef->id);
});

it('manager cannot submit report without recipient', function () {
    $manager = User::factory()->create(['role' => UserRole::Manager]);

    $this->actingAs($manager)
        ->from(route('reports.index'))
        ->post(route('reports.submit'), [
            'title' => 'Rapport managérial',
            'content' => 'Contenu de test suffisamment long pour valider les contraintes minimales.',
        ])
        ->assertRedirect(route('reports.index'))
        ->assertSessionHasErrors(['recipient_id']);
});

it('manager cannot submit report to worker', function () {
    $manager = User::factory()->create(['role' => UserRole::Manager]);
    $worker = User::factory()->create(['role' => UserRole::Worker]);

    $this->actingAs($manager)
        ->from(route('reports.index'))
        ->post(route('reports.submit'), [
            'title' => 'Rapport managérial',
            'content' => 'Contenu de test suffisamment long pour valider les contraintes minimales.',
            'recipient_id' => $worker->id,
        ])
        ->assertRedirect(route('reports.index'))
        ->assertSessionHasErrors(['recipient_id']);
});
