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
- **Preferences stick.** Your cities, 12/24-hour setting and seconds toggle are saved in your browser (`localStorage`). Nothing is sent anywhere.
- **Keyboard friendly.** Press `/` or `Ctrl/Cmd + K` to add a city, arrows to move, `Enter` to add, `Esc` to close.
- **Accessible.** Screen readers announce the city and time once a minute, focus rings are visible, and `prefers-reduced-motion` is respected.

## Run it

Open `index.html` in a browser. That's it.

Or serve the folder locally:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Put it on GitHub Pages

1. Create a new repository named `meridian-clock` on GitHub.
2. Upload every file from this folder to the **root** of the repository (or push with git, below).
3. Go to **Settings → Pages**. Under **Build and deployment**, choose **Deploy from a branch**, pick `main` and `/ (root)`, then save.
4. After a minute your clock is live at `https://YOUR-USERNAME.github.io/meridian-clock/`.

Using git instead:

```bash
cd meridian-clock
git init
git add .
git commit -m "Add Meridian world clock"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/meridian-clock.git
git push -u origin main
```

Then replace `YOUR-USERNAME` in `index.html` (footer link) and `YOUR NAME` in `LICENSE`.

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
