<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('chef_chantier_id')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete()
                ->after('engineer_id');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['chef_chantier_id']);
            $table->dropColumn('chef_chantier_id');
        });
    }
};
