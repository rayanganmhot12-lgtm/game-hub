# One navigation column

## Why

The app has two mutually exclusive navigation columns, and which one you get
depends on where you are.

`Sidebar` lists Dashboard, Library, Achievements, Connections, Theme Editor and
Recap — and hides itself entirely on `/friends`, `/store`, `/playlist`,
`/moderation` and `/groups`. `FriendsSidebar` takes over on the first four,
listing Game Hub, Friends and Missions, then a group labelled "More" holding
Store, Playlist and Moderation.

So six destinations vanish the moment you open Friends. Getting back means
clicking a row called "Game Hub", which leads to `/friends/game-hub` — a page
whose entire content is four cards linking to Dashboard, Library, Achievements
and Connections. A whole page exists to undo the split, and it does so
incompletely: four cards against the six links the other column carries, so
Theme Editor and Recap are unreachable from that side except through a navbar
button.

Three smaller faults follow from the same place:

- **"Game Hub" names three different things** on one screen: the app in the
  navbar, a navigation row, and a server in the rail.
- **"More" describes nothing.** Store, Playlist and Moderation are not more of
  anything; they are distinct areas.
- **The profile card floats mid-column.** `SidebarProfilePanel` is written to
  drop to the bottom with `mt-auto` and stay there with `sticky`, and its own
  comment says so — but `FriendsSidebar`'s root is a `flex flex-col` with no
  height, so `mt-auto` has nothing to push against. `Sidebar` is a full-height
  sticky column, which is why the same intent works there and not here. This is
  the empty space that prompted the request.

## What changes

### One column, everywhere

`Sidebar` becomes the app's only navigation column and stops hiding on
`/friends`, `/store`, `/playlist` and `/moderation`. `FriendsSidebar` is
deleted.

Inside a server it still steps aside: `GroupChannelsSidebar` replaces it,
because a server brings its own channel navigation and the server rail is how
you leave. That is the one remaining exception, and it is a real one.

### The list, grouped

| Group | Rows |
|---|---|
| (unlabelled) | Dashboard, Library, Achievements, Connections |
| Social | Friends, Missions |
| More | Store, Playlist, Recap |
| Admin | Moderation — admin only |

Theme Editor stays where it already is, a button in the navbar, rather than
appearing in two places at once.

The first group carries no label: it is what the app is, and a heading over it
would be naming the obvious.

### What gets deleted

The "Game Hub" row disappears, and `/friends/game-hub` with it — its four
cards are four of the rows above now. `/friends/game-hub` becomes a redirect to
`/dashboard` rather than a 404, for anyone who bookmarked it.

That also ends the three-way collision on the name.

### One profile panel

`UserPanel` and `SidebarProfilePanel` are the same component written twice —
avatar, name, friend code, settings link. The merged column keeps `UserPanel`,
which already sits correctly at the bottom of a full-height column;
`SidebarProfilePanel` is deleted along with the two layouts that render it
directly.

### Section navigation is left alone

Store and Moderation carry their own section columns — Avatar Frames / Badges /
Profile Banners, and Actions / Admin / Store Mod / Store Prices. Those navigate
a different axis than the app nav and stay as they are, sitting beside the app
column the way the channel list already sits beside the server rail. They lose
only their copy of the profile panel, which the app column now carries.

## Verification

Typecheck, lint, and live in the browser, which this session can reach:

- The column renders on `/dashboard`, `/friends`, `/store`, `/playlist` and
  `/moderation`, and does not render inside a server.
- The correct row is marked current on each of those routes.
- `/friends/game-hub` redirects to `/dashboard`.
- Moderation appears for an admin and the group is absent otherwise.
- The profile panel sits at the bottom of the column, with no gap above it.
