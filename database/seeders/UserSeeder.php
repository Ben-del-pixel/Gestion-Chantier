<?php

namespace Database\Seeders;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class UserSeeder extends Seeder
{
    /**
     * Run the database seeds with hierarchy:
     * Manager > ChefChantier > Engineer > Worker/Magasinier
     */
    public function run(): void
    {
        // 1. Create Managers
        $managers = [];
        for ($i = 1; $i <= 2; $i++) {
            $managers[] = User::updateOrCreate(
                ['email' => "manager{$i}@example.com"],
                [
                    'name' => "Manager {$i}",
                    'password' => Hash::make('password'),
                    'role' => UserRole::Manager,
                ]
            );
        }

        // 2. Create Engineers
        $engineers = [];
        for ($i = 1; $i <= 3; $i++) {
            $engineers[] = User::updateOrCreate(
                ['email' => "engineer{$i}@example.com"],
                [
                    'name' => "Ingénieur {$i}",
                    'password' => Hash::make('password'),
                    'role' => UserRole::Engineer,
                ]
            );
        }

        // 3. Create Chef de Chantier
        // Note: Relationally, ChefChantier will be assigned to a project and an engineer
        $chefChantiers = [];
        for ($i = 1; $i <= 4; $i++) {
            $chefChantiers[] = User::updateOrCreate(
                ['email' => "chef_chantier{$i}@example.com"],
                [
                    'name' => "Chef de Chantier {$i}",
                    'password' => Hash::make('password'),
                    'role' => UserRole::ChefChantier,
                ]
            );
        }

        // 4. Create Magasiniers
        $magasiniers = [];
        for ($i = 1; $i <= 4; $i++) {
            $magasiniers[] = User::updateOrCreate(
                ['email' => "magasinier{$i}@example.com"],
                [
                    'name' => "Magasinier {$i}",
                    'password' => Hash::make('password'),
                    'role' => UserRole::Magasinier,
                ]
            );
        }

        // 5. Create Workers and assign to Chef de Chantier
        // Each Chef de Chantier gets 5 workers
        foreach ($chefChantiers as $index => $chef) {
            for ($j = 1; $j <= 5; $j++) {
                $workerIndex = ($index * 5) + $j;
                User::updateOrCreate(
                    ['email' => "worker{$workerIndex}@example.com"],
                    [
                        'name' => "Ouvrier {$workerIndex}",
                        'password' => Hash::make('password'),
                        'role' => UserRole::Worker,
                        'chef_chantier_id' => $chef->id,
                    ]
                );
            }
        }
    }
}
