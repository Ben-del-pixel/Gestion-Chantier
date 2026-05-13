<?php

use App\Enums\UserRole;
use App\Models\User;
use Database\Seeders\UserSeeder;
use Illuminate\Support\Facades\Hash;

test('user seeder creates expected hierarchy and credentials', function () {
    $this->seed(UserSeeder::class);

    expect(
        User::where('role', UserRole::Manager)->count()
    )->toBe(2);

    expect(
        User::where('role', UserRole::Engineer)->count()
    )->toBe(3);

    expect(
        User::where('role', UserRole::Worker)->count()
    )->toBe(20);

    expect(
        User::where('role', UserRole::Magasinier)->count()
    )->toBe(4);

    expect(
        User::where('role', UserRole::ChefChantier)->count()
    )->toBe(4);

    $manager = User::where('email', 'directeur1@example.com')->first();
    $chef = User::where('role', UserRole::ChefChantier)->first();

    expect($manager)->not()->toBeNull();
    expect($chef?->engineer_id)->not()->toBeNull();
    expect(Hash::check('password', $manager->password))->toBeTrue();
});
