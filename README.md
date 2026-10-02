# Meridian

A minimal dark world clock where every city carries its own sky.

Add any time zone, watch each card shift from midnight blue to sunrise amber to afternoon steel as the local day moves, and drag the time-travel slider to see what time it will be everywhere.

No build step. No dependencies. Just open `index.html`.

## Features

- **Any time zone.** Every IANA zone your browser knows (400+) is searchable, plus 180 curated cities with country names, nicknames and abbreviations. Type `Mumbai`, `SF`, `UAE`, `IST` or `UTC+5`.
- **Seamless digits.** Each digit lives in a fixed-width slot and rolls into place exactly on the second, so nothing ever jitters or shifts.
- **A sky for every city.** Card colours, stars and the day ruler follow each city's local time, and the page glow borrows the primary city's sky.
- **Time travel.** Slide up to 24 hours forward or back and every clock follows. See at a glance whether a call lands at lunch or at 3 a.m.
- **Primary clock.** Make any city the large hero clock. Drag cards to reorder (desktop).
- **Adjustable layout.** *Settings → Clocks per row* sets how many clocks sit side by side in the grid (Auto, or 1 to 6). *First row* sets how many big clocks share the top line (1 to 6). On narrow screens Meridian lowers the count so cards stay readable.
- **Your setup is remembered.** Cities, their order, the primary clock, 12/24-hour time, the seconds toggle and the row layout are saved on the device the moment you change them. Close the tab, restart the phone, come back next week: it opens exactly as you left it. Nothing is sent to a server.
- **Move it between devices.** *Settings → Copy link to these clocks* gives you a link that carries your setup to another phone or computer.
- **Keyboard friendly.** Press `/` or `Ctrl/Cmd + K` to add a city, arrows to move, `Enter` to add, `Esc` to close.
- **Accessible.** Screen readers announce the city and time once a minute, focus rings are visible, and `prefers-reduced-motion` is respected.

## How saving works

Meridian stores your setup in the browser's `localStorage`, under the key `meridian:v1`. This is per browser, per device, so each person who opens the site gets their own setup and never sees anyone else's.

- **Saved:** the list of cities, their order, which one is primary, 12/24-hour time, seconds on/off, and your row layout.
- **Not saved:** the time-travel slider. It always starts at "Now".
- **First visit:** you get your own local time first, plus a few big cities, and the clock follows your device's 12/24-hour habit. That starting setup is saved too, so it won't change on you.
- **Several tabs:** changes in one tab appear in the others straight away.
- **Another device:** use *Copy link to these clocks* and open the link there. If that device already has its own setup, it asks before replacing it.
- **Private browsing:** some browsers block saving in private mode. Meridian tells you when that happens.
- **Safari:** it can clear a site's saved data after about a week without a visit. Adding Meridian to the Home Screen avoids that.

Meridian is a static site with no server, so there are no accounts or automatic syncing between devices. If you want that later, it needs a small backend (for example Supabase or Firebase) added on top.

## Run it

Open `index.html` in a browser. That's it.

Or serve the folder locally:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Project structure

```
index.html    Page markup
style.css     Design tokens, cards, dock, palette
app.js        Clock logic, rolling digits, search, time travel
zones.js      Curated cities, country aliases, display-name fixes
favicon.svg   Icon
LICENSE       MIT
```

## Customise

**Add your own cities.** Open `zones.js` and add a line to `cities`:

```js
'Lagos Island|Africa/Lagos|Nigeria|Eko',
```

The format is `City|IANA zone|Country|extra search words`.

**Change the look.** The colour and type tokens live at the top of `style.css`:

```css
--sun: #ffc994;      /* colon, seconds, ruler marker */
--serif: 'Fraunces'; /* numerals and city names */
--sans: 'Hanken Grotesk';
```

The sky colours for each hour are the `SKY` table near the top of `app.js`.

**Change the default cities.** Edit `defaultClocks()` in `app.js`.

## Browser support

Any current Chrome, Edge, Safari or Firefox. The full time zone list needs `Intl.supportedValuesOf` (Chrome 99+, Safari 15.4+, Firefox 93+). Older browsers still get the 180 curated cities.

Fonts load from Google Fonts. If you're offline, the clock falls back to your system serif and sans-serif fonts.

## Design notes

Meridian is inspired by the command-palette pattern popularised by Raycast and Linear, the scrubbable timeline in tools like World Time Buddy, and the way analogue watches show time of day with a dial. All code here is original.

Type: [Fraunces](https://fonts.google.com/specimen/Fraunces) and [Hanken Grotesk](https://fonts.google.com/specimen/Hanken+Grotesk), both under the SIL Open Font License.

## License

MIT. See [LICENSE](LICENSE).
