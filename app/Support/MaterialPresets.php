<?php

namespace App\Support;

use Illuminate\Support\Collection;

class MaterialPresets
{
    /**
     * @return list<string>
     */
    public static function defaultNames(): array
    {
        return [
            'Bêche',
            'Marteau',
            'Pelle',
            'Pioche',
            'Ciment',
            'Acier',
            'Briques',
            'Bois',
            'Peinture',
            'Sable',
        ];
    }

    /**
     * @return list<string>
     */
    public static function defaultUnits(): array
    {
        return ['sacs', 'tonnes', 'milliers', 'm3', 'unite', 'litres', 'rouleaux', 'pieces'];
    }

    /**
     * @return list<string>
     */
    public static function defaultCategories(): array
    {
        return [
            'construction',
            'metaux',
            'maconnerie',
            'charpente',
            'plomberie',
            'electricite',
            'outillage',
            'consommables',
        ];
    }

    /**
     * @param  iterable<int, object{ name?: string|null }|array{ name?: string|null }>  $materials
     * @return list<string>
     */
    public static function nameOptions(iterable $materials = []): array
    {
        return self::mergeUniqueStrings(
            collect($materials)->pluck('name'),
            collect(self::defaultNames()),
        );
    }

    /**
     * @param  iterable<int, object{ unit?: string|null }|array{ unit?: string|null }>  $materials
     * @return list<string>
     */
    public static function unitOptions(iterable $materials = []): array
    {
        return self::mergeUniqueStrings(
            collect($materials)->pluck('unit'),
            collect(self::defaultUnits()),
        );
    }

    /**
     * @param  iterable<int, object{ category?: string|null }|array{ category?: string|null }>  $materials
     * @return list<string>
     */
    public static function categoryOptions(iterable $materials = []): array
    {
        return self::mergeUniqueStrings(
            collect($materials)->pluck('category'),
            collect(self::defaultCategories()),
        );
    }

    /**
     * @param  Collection<int, mixed>  $fromMaterials
     * @param  Collection<int, string>  $defaults
     * @return list<string>
     */
    private static function mergeUniqueStrings(Collection $fromMaterials, Collection $defaults): array
    {
        return $fromMaterials
            ->filter(fn ($value) => filled($value))
            ->map(fn ($value) => trim((string) $value))
            ->merge($defaults)
            ->unique()
            ->sort()
            ->values()
            ->all();
    }
}
