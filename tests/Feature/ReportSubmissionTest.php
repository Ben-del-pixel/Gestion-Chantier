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
    $project = Project::factory()->create(['engineer_id' => $engineer->id]);
    $project->workers()->sync([$magasinier->id]);

    $this->actingAs($magasinier)
        ->post(route('reports.submit'), [
            'title' => 'Rapport stock',
            'content' => 'Inventaire mis a jour, sorties de stock enregistrees et ecarts verifies.',
            'project_id' => $project->id,
        ])
        ->assertRedirect(route('reports.index'));

    $report = ReportSubmission::query()->latest('id')->first();

    expect($report)->not->toBeNull();
    expect($report->sender_id)->toBe($magasinier->id);
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

it('manager cannot submit operational report', function () {
    $manager = User::factory()->create(['role' => UserRole::Manager]);

    $this->actingAs($manager)
        ->post(route('reports.submit'), [
            'title' => 'Rapport',
            'content' => 'Contenu de test suffisamment long pour valider les contraintes minimales.',
        ])
        ->assertForbidden();
});
