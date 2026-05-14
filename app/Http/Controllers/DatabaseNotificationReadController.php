<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Notifications\DatabaseNotification;

class DatabaseNotificationReadController extends Controller
{
    public function __invoke(Request $request, string $notification): RedirectResponse
    {
        $user = $request->user();

        if (! $user instanceof User) {
            abort(403);
        }

        $row = DatabaseNotification::query()
            ->whereKey($notification)
            ->where('notifiable_type', User::class)
            ->where('notifiable_id', $user->id)
            ->firstOrFail();

        $row->markAsRead();

        return back();
    }
}
