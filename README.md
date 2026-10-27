# TeamSwap: Stage 1

Robotics, drone and Roboboat teams can share spare parts with each other. The app is built with Expo SDK 57 and Expo Router, uses Supabase (free tier) as the backend, and runs in Expo Go.

## One-time Supabase setup

1. Create a free project at <https://supabase.com>.
2. **SQL Editor → New query**: paste all of [`supabase/schema.sql`](supabase/schema.sql) and click **Run**. This creates:
   - the tables, Row Level Security policies and request-flow functions
   - the public `item-photos` Storage bucket and its upload policies

   The script is safe to run again. **Re-run it whenever `schema.sql` changes.** It upgrades an existing project in place (for example, it adds the availability-time and drop-off columns) without deleting data.
3. **Authentication → Sign In / Providers → Email**: turn **off** "Confirm email" while you're developing. Otherwise every new account has to click an email link before it can sign in.
4. **Project Settings → API Keys**: copy the **Project URL** and the **publishable** key (`sb_publishable_…`), or the legacy **anon** key.
   **Never** use the `service_role` / secret key in the app.
5. In this folder, copy `.env.example` to `.env` and paste in both values.
   - The URL must end at `.supabase.co`, with nothing after it (no `/rest/v1/`).
6. **For "Forgot password?"**, edit the **Reset password** template under **Authentication → Emails → Templates** so it includes the code. For example:
   ```html
   <h2>Reset your TeamSwap password</h2>
   <p>Your reset code is: <strong>{{ .Token }}</strong></p>
   ```
   The app asks for this code, so it never needs to open an email link. That's more reliable in Expo Go.
   - **Who gets the email:** Supabase's built-in email only sends to members of your Supabase project team, and only 2 emails per hour. To reset passwords for anyone else, set up custom SMTP under **Authentication → Emails → SMTP Settings**. Resend, Brevo and others have free tiers.

## Run on your phone

```bash
npm install
npx expo start --clear
```

Open **Expo Go** on your phone and scan the QR code. On iPhone, scan it with the Camera app. Your phone and computer need to be on the same Wi-Fi. If they can't connect (school or guest Wi-Fi, a firewall), run `npx expo start --tunnel` instead.

To try the full request flow you need **two accounts**. Sign up as Team A on one phone or simulator, then sign up as Team B on another, or sign out and back in on the same phone.

## How quantities work

Every item always satisfies `in_use + available + pending = total`. The database enforces this with a check constraint.

| Event | Effect |
|---|---|
| Owner flags units (swipe, steppers, or Add/Edit) | in_use → available |
| Requester submits | available → pending |
| Owner approves | stays in pending (reserved for this exchange) |
| Owner denies | pending → available |
| Owner taps **Mark as sent** | no change (it just notifies the requester) |
| **Requester** taps **Mark as received** | removed from pending **and** total |

`pending` can only be changed by the server-side request functions. A trigger ignores any attempt to edit it from the app.

Contact info lives in a private `contacts` table. It is copied into `request_contacts`, which can only be read **after approval** and only by the two parties.

## Assumptions (spec gaps)

- **"In use" means kept by your team.** An item shows up in Browse Community only while `available > 0`. New items default to 0 available, but you can set the available count when you add an item.
- **Either party** can confirm the final date. "Confirm final date" uses the date currently selected on your own calendar.
- **Only the owner (giver)** sees **Mark as sent**. It's optional and only notifies the requester.
- **Only the requester (receiver)** sees **Mark as received**. That tap closes the exchange and takes the units out of the owner's inventory. The owner can't mark it received for them.
- **Availability times:** for each day the requester selects, they choose **All day** (the default) or a from–to window in 30-minute steps. The owner sees these on the approve/deny and contact-revealed screens.
- **Drop-off window:** when the **owner** confirms the final date, they must also pick a drop-off window. It defaults to the requester's hours for that weekday, or 3–5 PM. When the requester confirms, only the date is set. If that changes the date, the owner's old window is cleared and they're asked to add a new one.
- **Categories** come from a fixed list (Motors, Electronics, Sensors, …), which keeps filtering simple.
- **Unspecified screens** have simple versions:
  - Sign-up with a role picker
  - Profile: team, role, and their shared items
  - Requests list: Incoming / Sent tabs
  - Account: edit team name, role and default contact info; sign out
- **Denied requests**: the requester sees a "Not this time" screen. No contact info is ever shared.
- An item with pending requests can't be deleted.

## Stage 2

### Part A: swipe feed and Saved Items (done)
- **Browse Community** is a full-screen feed with one item per screen; swipe up or down to move between items.
  - Over the photo, bottom-left: name, pennant badge, quantity available, condition and owner team.
  - Right-hand rail, top to bottom: **Profile**, **Request**, **Save**.
  - Tapping the card itself opens Item Detail (theirs).
  - The top bar has back, the title, and a filter icon (search, specialty tag, category). A number on the filter icon shows how many filters are active.
  - Pull down on the first card to refresh.
- **Saved Items** holds bookmarks only, separate from the wishlist. The save icon toggles a bookmark; a filled bookmark means it's saved.
  - On the Saved Items screen, tapping a row's filled bookmark removes it, and tapping the card opens Item Detail (theirs).
  - If you've requested the item and the owner hasn't answered yet, the row shows **Pending**.
  - When the owner **approves your request**, the item disappears from your Saved Items.
  - When **someone else's approved request takes the last units**, the item disappears from everyone's Saved Items. That only happens when nothing is available and no other request is still waiting; while one is waiting, a denial could put units back.
  - The server does this cleanup when the owner taps Approve, because other people's requests are private.
  - If the owner only un-flags units (no approval involved), the row stays and shows "None available right now".
  - If the owner deletes the item, it disappears from Saved Items.
  - Saving and unsaving run through server-side functions (`save_item` / `unsave_item`), which refuse to save your own items. Users can only read their own saved rows.
- Home has a **Saved Items** entry card with the bookmark count. Part C adds the rest of the new Home layout.

### Part B: Wishlist (done)
- **My Wishlist** (from the Home card) lists each entry with its name, pennant badge, quantity needed and need-by date, plus an **URGENT** badge when set. Urgent entries sort to the top.
  - Each card shows **"N matches available now"** (green) or **"No matches yet — we'll notify you"**. Part C sends the notification.
  - **Tap** a card to see its matches. **Hold** to edit. **Swipe left** to reveal a red **Delete** button. Swiping never deletes; only tapping that button does.
  - The footer notes that entries are removed after their need-by date.
- **Add to Wishlist** (the + button) and **Edit Wishlist Entry** (hold a card) have:
  - item name, specialty tag chips, quantity needed, a need-by calendar, an "urgent" switch, and notes
  - Edit also has **Save changes** and **Delete from wishlist**, which asks you to confirm.
- **How matching works:**
  - It counts other teams' items with **available > 0** whose name contains **every word** of your entry's name (ignoring case and a plural "s"). The **name is all that counts**: tag, condition and quantity are ignored. The tag on an entry is only for display.
  - Example: "NEO motors" matches "REV NEO Brushless Motor".
  - It runs on the server (`get_my_wishlist`, `get_wishlist_matches`); the app never searches other teams' data itself.
- **Auto-delete after the need-by date:**
  - When you open the wishlist (or Home), entries whose need-by date is before **today on your phone** are deleted.
  - A nightly **Supabase Cron** job (`teamswap-delete-expired-wishlist`, 00:15 UTC) deletes any left over. It waits one extra day so a phone in a timezone behind UTC never loses an entry early.
- Home has a **My Wishlist** card showing the entry count, how many are urgent, and how many have matches.

### Photos
- After you take or pick a photo, the app opens its own **square cropper**: drag to move, pinch or use +/- to zoom.
  - The phone's built-in crop screen isn't used, because on iPhone it often saved a different square than the one shown.
  - The square you frame is exactly what appears in thumbnails and on the item screens.
- Each upload saves two files: the **square crop** (`photo_url`) and an **uncropped copy** (`photo_full_url`, long side at most 1440 px).
  - The full-screen feed fills the screen from the uncropped copy. Phone photos are already tall, so little is cut off.
  - Items uploaded before this change only have the square crop. The feed uses that until the photo is replaced in Edit Item.

### Part C: Notifications and Home (done)
- **Database triggers create notifications automatically.** The app never creates them itself.
  | Event | Who's notified | Tapping it opens |
  |---|---|---|
  | New request submitted | Owner | Approve/Deny screen |
  | Request approved | Requester | Contact revealed screen |
  | Request denied | Requester | "Not this time" screen |
  | Final date / drop-off confirmed | The other person | Contact revealed screen |
  | Owner taps Mark as sent | Requester | Contact revealed screen |
  | Requester taps Mark as received | Owner | Contact revealed screen (exchange complete) |
  | New wishlist match | Wishlist owner | Item Detail (theirs) |
- **What counts as a new match:** you get a match notification in either case:
  - another team's item starts matching one of your active entries, by *becoming* available (from 0 to some) or by being renamed while available
  - you **add or rename a wishlist entry** and matching items are *already* available (up to 10 per add or rename)
  
  Each item is notified **once per entry**, so changing quantity again doesn't repeat it. Re-running `schema.sql` also sends a one-time catch-up for matches that existed before this rule.
- **Notifications screen:** unread rows are highlighted with a blue dot. Tapping one marks it read and opens the related screen. **Mark all read** is in the header, and you can pull down to refresh.
  - Notifications are kept for 90 days. A nightly cron job, `teamswap-delete-old-notifications`, removes older ones.
- **Live updates:** the app subscribes to your own notification rows through Supabase Realtime, so the badge updates without reloading. It also re-checks when the app returns to the foreground.
- **Home top row:**
  - A **notifications widget** on the left: bell, unread badge, and the 3 most recent notifications. Tapping one opens it; tapping the widget opens the full list.
  - A smaller **account widget** on the right, showing your role icon and team name.
- Push notifications (alerts while the app is closed) aren't included. They need a development build rather than Expo Go.

### Still to come
Photo auto-identify isn't planned yet.

## Project layout

```
src/app/            screens (Expo Router)
  index.tsx           Home
  inventory/          My Inventory
  item/new, item/[id], item/[id]/edit
  community/          Browse + Item Detail (theirs)
  request/[itemId]    Request form
  requests/           list + [id] (approve/deny, waiting, denied, contact revealed)
  profile/[id], account, sign-in, sign-up
src/components/     FlagBadge, Calendar, DayPicker, Stepper, SwipeRow, ItemForm, ReviewRequest, Exchange…
src/lib/            supabase client, api, auth context, photos, dates, theme, types
supabase/schema.sql
```

Checks: `npx tsc --noEmit` · `npx expo lint` · `npx expo-doctor`
