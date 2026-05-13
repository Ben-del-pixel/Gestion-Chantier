<?php

namespace Database\Seeders;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class UserSeeder extends Seeder
{
    /**
     * Comptes de démonstration : directeurs, ingénieurs, chefs de chantier, magasiniers, ouvriers.
     *
     * Connexion (mot de passe : password) — e-mails en français :
     * - directeur1@example.com, ingenieur1@example.com, chefchantier1@example.com,
     *   magasinier1@example.com, ouvrier1@example.com, etc.
     */
    public function run(): void
    {
        // 1. Directeurs (managers)
        $managers = [];
        for ($i = 1; $i <= 2; $i++) {
            $managers[] = User::updateOrCreate(
                ['email' => "manager{$i}@example.com"],
                [
                    'name' => "Directeur de projet {$i}",
                    'password' => Hash::make('password'),
                    'role' => UserRole::Manager,
                ]
            );
        }

        // 2. Ingénieurs
        $engineers = [];
        for ($i = 1; $i <= 3; $i++) {
            $engineers[] = User::updateOrCreate(
                ['email' => "ingenieur{$i}@example.com"],
                [
                    'name' => "Ingénieur principal {$i}",
                    'password' => Hash::make('password'),
                    'role' => UserRole::Engineer,
                ]
            );
        }

        // 3. Chefs de chantier (rattachés à un ingénieur)
        $chefChantiers = [];
        for ($i = 1; $i <= 4; $i++) {
            $engineer = $engineers[($i - 1) % count($engineers)];
            $chefChantiers[] = User::updateOrCreate(
                ['email' => "chefchantier{$i}@example.com"],
                [
                    'name' => "Chef de chantier {$i}",
                    'password' => Hash::make('password'),
                    'role' => UserRole::ChefChantier,
                    'engineer_id' => $engineer->id,
                ]
            );
        }

        // 4. Magasiniers
        $magasiniers = [];
        for ($i = 1; $i <= 4; $i++) {
            $magasiniers[] = User::updateOrCreate(
                ['email' => "magasinier{$i}@example.com"],
                [
                    'name' => "Magasinier chantier {$i}",
                    'password' => Hash::make('password'),
                    'role' => UserRole::Magasinier,
                ]
            );
        }

        // 5. Ouvriers (équipe par chef de chantier)
        foreach ($chefChantiers as $index => $chef) {
            for ($j = 1; $j <= 5; $j++) {
                $workerIndex = ($index * 5) + $j;
                User::updateOrCreate(
                    ['email' => "ouvrier{$workerIndex}@example.com"],
                    [
                        'name' => "Ouvrier qualifié {$workerIndex}",
                        'password' => Hash::make('password'),
                        'role' => UserRole::Worker,
                        'chef_chantier_id' => $chef->id,
                    ]
                );
            }
        }
    }
}
