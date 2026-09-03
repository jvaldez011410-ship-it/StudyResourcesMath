# My Music — private playlists

A minimalist browser music library using Supabase Auth, Postgres RLS, and a private Supabase Storage bucket.

## Architecture

- Frontend: plain HTML/CSS/JavaScript
- Authentication: Supabase Auth
- Database: Supabase Postgres
- Authorization: Postgres Row Level Security
- Audio storage: private Supabase Storage bucket
- Playback: browser `<audio>` element with temporary signed URLs

The public website does NOT make the music bucket public. Each signed-in user can only query their own playlists/songs and storage paths.

## Setup

1. Create a Supabase project.
2. Open SQL Editor and run `supabase.sql`.
3. In Supabase Project Settings -> API, copy the project URL and publishable/anon key.
4. Put them in `config.js`.
5. Open `index.html` locally to test.
6. For a public site, upload the files to a static host such as GitHub Pages.

Never put a `service_role` key in `config.js`. The browser should only receive the publishable/anon key; RLS is what enforces access.

## Supabase Auth

For a simple first version, email/password auth is enabled. In Supabase Auth settings, configure the allowed site URL and redirect URLs for your deployed site.

## Storage

The `music` bucket is private. The app asks Supabase for a signed URL when a user selects a song. The signed URL is short-lived and is only generated after the database/storage security checks pass.

## Important

Only upload music you are allowed to store and access.


## Updated playback controls
- Previous (↶) moves to the previous song.
- Next (↷) moves to the next song.
- When a song ends, playback automatically moves to the next song.
- Shuffle can be turned on/off. With shuffle on, the next song is randomly selected and will not immediately repeat the current song.
- Left/Right arrow keys move to previous/next songs.


## Shared Music update

Run the included `supabase.sql` in Supabase SQL Editor before using the shared music version.

- Uploaded songs go into one shared collection called **Shared Music**.
- Every signed-in user can see and play shared songs.
- Users can add shared songs to their own private playlists.
- Removing a song from a playlist only removes that playlist link; the shared song remains.
- Regular users cannot delete shared songs or the stored audio files.


## Step 5.6 updates

### Persistent player state
- The app remembers the selected playlist, current song, approximate playback position, volume/mute state, shuffle state, repeat mode, queue visibility, and active sleep timer in the signed-in user's browser.
- State is scoped per signed-in account on that browser using local storage.
- The app does not require a database change for this browser-local player state.

### Owner-only website deletion
- A signed-in user can permanently delete a song only when they are the uploader recorded in `shared_songs.uploaded_by`.
- The owner-only delete action removes the audio file from the private `music` bucket and the `shared_songs` record; playlist links are removed by the database foreign-key cascade.
- Supabase RLS/storage policies enforce the ownership rule. Hiding the menu item in the UI is not the security boundary.
- Other users can still remove a shared song from their own playlist without deleting the shared song.
- Run the updated `supabase.sql` in the Supabase SQL Editor to add the owner-only delete policies.
