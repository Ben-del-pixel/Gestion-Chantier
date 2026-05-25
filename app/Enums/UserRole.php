<?php

namespace App\Enums;

enum UserRole: string
{
    case Manager = 'manager';
    case Engineer = 'engineer';
    case Worker = 'worker';
    case Magasinier = 'magasinier';
    case ChefChantier = 'chef_chantier';

    public function canViewBudget(): bool
    {
        return ! in_array($this, [self::Engineer, self::ChefChantier], true);
    }

    public static function canViewBudgetFor(mixed $role): bool
    {
        if ($role instanceof self) {
            return $role->canViewBudget();
        }

        if (is_string($role)) {
            $resolved = self::tryFrom($role);

            return $resolved?->canViewBudget() ?? false;
        }

        return false;
    }
}
