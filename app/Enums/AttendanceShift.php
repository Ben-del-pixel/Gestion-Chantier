<?php

namespace App\Enums;

enum AttendanceShift: string
{
    case Morning = 'morning';
    case Evening = 'evening';

    public function label(): string
    {
        return match ($this) {
            self::Morning => 'Matin',
            self::Evening => 'Soir',
        };
    }

    public function icon(): string
    {
        return match ($this) {
            self::Morning => '🌅',
            self::Evening => '🌆',
        };
    }
}
