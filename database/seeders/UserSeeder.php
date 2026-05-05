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
        // 1. Create Managers (top level)
        $managers = [];
        for ($i = 1; $i <= 3; $i++) {
            $managers[] = User::updateOrCreate(
                ['email' => "manager{$i}@example.com"],
                [
                    'name' => "Directeur {$i}",
                    'password' => Hash::make('password'),
                    'role' => UserRole::Manager,
                ]
            );
        }

        // 2. Create Chef de Chantier (under Managers)
        $chefChantiers = [];
        for ($i = 1; $i <= 5; $i++) {
            $chefChantiers[] = User::updateOrCreate(
                ['email' => "chef_chantier{$i}@example.com"],
                [
                    'name' => "Chef de Chantier {$i}",
                    'password' => Hash::make('password'),
                    'role' => UserRole::ChefChantier,
                ]
            );
        }

        // 3. Create Engineers (under Chef de Chantier)
        $engineers = [];
        for ($i = 1; $i <= 10; $i++) {
            $chefChantier = $chefChantiers[($i - 1) % count($chefChantiers)];
            $engineers[] = User::updateOrCreate(
                ['email' => "engineer{$i}@example.com"],
                [
                    'name' => "Ingénieur {$i}",
                    'password' => Hash::make('password'),
                    'role' => UserRole::Engineer,
                    'chef_chantier_id' => $chefChantier->id,
                ]
            );
        }

        // 4. Create Workers (under Engineers)
        for ($i = 1; $i <= 20; $i++) {
            $engineer = $engineers[($i - 1) % count($engineers)];
            User::updateOrCreate(
                ['email' => "worker{$i}@example.com"],
                [
                    'name' => "Ouvrier {$i}",
                    'password' => Hash::make('password'),
                    'role' => UserRole::Worker,
                    'engineer_id' => $engineer->id,
                ]
            );
        }

        // 5. Create Magasiniers (under Engineers)
        for ($i = 1; $i <= 5; $i++) {
            $engineer = $engineers[($i - 1) % count($engineers)];
            User::updateOrCreate(
                ['email' => "magasinier{$i}@example.com"],
                [
                    'name' => "Magasinier {$i}",
                    'password' => Hash::make('password'),
                    'role' => UserRole::Magasinier,
                    'engineer_id' => $engineer->id,
                ]
            );
        }
    }
}
